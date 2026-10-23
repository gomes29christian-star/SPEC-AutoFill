/**
 * Fillbox — Content Script Principal
 * Orquestra vinculação contextual, escuta cliques em campos vinculados e gerencia diálogo de vinculação
 */

(function () {
  'use strict';

  // Guarda o último elemento e coordenadas clicadas com o botão direito para o context menu
  let lastContextTarget = null;
  let lastContextCoords = null;
  const store = window.FillboxStorage ? window.FillboxStorage.store : null;
  const selector = window.FillboxSelector ? window.FillboxSelector.selectorInstance : null;
  const identifier = window.FieldIdentifier;
  const filler = window.FillboxFiller;

  // Rastreia o elemento e posição do clique com botão direito
  document.addEventListener(
    'contextmenu',
    (e) => {
      lastContextCoords = { x: e.clientX, y: e.clientY };
      const field = identifier && identifier.resolveSupportedField
        ? identifier.resolveSupportedField(e)
        : (identifier && identifier.isFieldSupported(e.target) ? e.target : null);
      lastContextTarget = field || e.target;
    },
    true
  );

  // Escuta clique com botão esquerdo em campos editáveis
  document.addEventListener(
    'click',
    async (e) => {
      // Se o clique foi dentro do próprio seletor flutuante ou modal, não reabre
      if (e.target && (e.target.closest('#fillbox-floating-container') || e.target.closest('#fillbox-bind-modal'))) {
        return;
      }

      const target = identifier && identifier.resolveSupportedField
        ? identifier.resolveSupportedField(e)
        : e.target;

      if (!target || !identifier || !identifier.isFieldSupported(target)) {
        return;
      }

      // Regra: A interface de fills só deve aparecer em espaços vazios (campos sem texto preenchido)
      const currentVal = (target.isContentEditable ? target.textContent : target.value) || '';
      if (currentVal.trim().length > 0) {
        return;
      }

      // Cria assinatura do campo
      const signature = identifier.createFieldSignature(target);
      if (!signature) return;

      const norm = identifier.normalizeUrl(window.location.href);

      try {
        const found = await store.findBindingForField(norm.origin, norm.path, signature);
        if (found && found.folder) {
          // Campo possui vínculo ativo e está vazio! Abre o seletor flutuante
          selector.open(target, found.folder, (fillItem) => {
            filler.insertTextIntoElement(target, fillItem.fill);
          });
        }
      } catch (err) {
        console.error('[Fillbox] Erro ao verificar vínculo do campo:', err);
      }
    },
    false
  );

  // Escuta mensagens do Background Script (como menu de contexto)
  const runtime = typeof browser !== 'undefined' ? browser.runtime : (typeof chrome !== 'undefined' ? chrome.runtime : null);

  if (runtime && runtime.onMessage) {
    runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'OPEN_BIND_DIALOG') {
        const resolved = (identifier && identifier.resolveSupportedField ? identifier.resolveSupportedField(lastContextTarget) : lastContextTarget)
          || (identifier && identifier.resolveSupportedField ? identifier.resolveSupportedField(document.activeElement) : document.activeElement)
          || (identifier && identifier.getDeepActiveElement ? identifier.getDeepActiveElement() : null);
        handleOpenBindDialog(resolved);
        sendResponse({ received: true });
        return true;
      }

      if (message.action === 'OPEN_ADD_FOLDER_DIALOG') {
        handleOpenAddFolderDialog();
        sendResponse({ received: true });
        return true;
      }

      if (message.action === 'OPEN_ADD_FILL_DIALOG') {
        handleOpenAddFillDialog(message.selectedText || '');
        sendResponse({ received: true });
        return true;
      }

      if (message.action === 'OPEN_DELETE_DIALOG') {
        handleOpenDeleteDialog();
        sendResponse({ received: true });
        return true;
      }

      if (message.action === 'PING') {
        sendResponse({ status: 'pong' });
        return true;
      }
    });
  }

  // Abre diálogo de vinculação permitindo escolher o campo e a pasta
  async function handleOpenBindDialog(rawTarget) {
    let target = (identifier && identifier.resolveSupportedField ? identifier.resolveSupportedField(rawTarget) : rawTarget);

    if (!target || !identifier || !identifier.isFieldSupported(target)) {
      if (lastContextCoords) {
        try {
          const elAtPoint = document.elementFromPoint(lastContextCoords.x, lastContextCoords.y);
          if (elAtPoint) {
            target = identifier.resolveSupportedField(elAtPoint);
          }
        } catch (e) {}
      }
    }

    if (!target || !identifier || !identifier.isFieldSupported(target)) {
      target = identifier && identifier.getDeepActiveElement ? identifier.getDeepActiveElement() : null;
    }

    const allPageFields = (identifier && identifier.findAllEditableFields)
      ? identifier.findAllEditableFields()
      : [];

    if ((!target || !identifier.isFieldSupported(target)) && allPageFields.length > 0) {
      target = allPageFields[0];
    }

    if (!target || !identifier || !identifier.isFieldSupported(target)) {
      showToast('Fillbox: Nenhum campo de texto editável encontrado nesta página.', 'error');
      return;
    }

    if (!allPageFields.includes(target)) {
      allPageFields.unshift(target);
    }

    const norm = identifier.normalizeUrl(window.location.href);
    const folders = await store.getFolders();

    renderBindModal(target, norm, folders, allPageFields);
  }

  async function renderBindModal(initialTarget, norm, folders, allPageFields) {
    const oldModal = document.getElementById('fillbox-bind-modal');
    if (oldModal) oldModal.remove();

    let currentTarget = initialTarget;
    let signature = identifier.createFieldSignature(currentTarget);
    let existing = signature ? await store.findBindingForField(norm.origin, norm.path, signature) : null;

    const overlay = document.createElement('div');
    overlay.id = 'fillbox-bind-modal';
    overlay.style.cssText = `
      all: initial;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(3px);
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      color: #e4e4e7;
    `;

    async function updateModalView() {
      signature = identifier.createFieldSignature(currentTarget);
      existing = signature ? await store.findBindingForField(norm.origin, norm.path, signature) : null;

      const fieldOptionsHtml = allPageFields.map((f, idx) => {
        const isSel = f === currentTarget;
        const label = identifier.getAssociatedLabelText ? identifier.getAssociatedLabelText(f) : '';
        const tag = f.tagName.toLowerCase();
        const displayLabel = label ? `${label} (${tag}${f.id ? '#' + f.id : ''})` : `Campo ${idx + 1} (${tag}${f.id ? '#' + f.id : ''})`;
        return `<option value="${idx}" ${isSel ? 'selected' : ''}>📝 ${escapeHTML(displayLabel)}</option>`;
      }).join('');

      const folderOptions = folders.map((f) => {
        const isSelected = existing && existing.folder && existing.folder.id === f.id;
        return `<option value="${f.id}" ${isSelected ? 'selected' : ''}>📁 ${escapeHTML(f.name)} (${(f.fills || []).length} Fills)</option>`;
      }).join('');

      overlay.innerHTML = `
        <div style="background:#18181b; border:1px solid #3f3f46; border-radius:10px; width:410px; max-width:92vw; box-shadow:0 20px 40px rgba(0,0,0,0.8); overflow:hidden;">
          <div style="padding:12px 16px; background:#27272a; border-bottom:1px solid #3f3f46; display:flex; justify-content:space-between; align-items:center;">
            <strong style="color:#f59e0b; font-size:13px; display:flex; align-items:center; gap:6px;">
              <span>⚡ Vincular Pasta Fill</span>
            </strong>
            <button type="button" id="fillbox-modal-close" style="background:transparent; border:none; color:#a1a1aa; cursor:pointer; font-size:16px;">✕</button>
          </div>

          <div style="padding:16px;">
            <div style="margin-bottom:12px;">
              <label style="display:block; font-size:11px; font-weight:600; color:#a1a1aa; margin-bottom:4px;">
                1. Selecione o Campo Alvo na Página:
              </label>
              <select id="fillbox-field-select" style="width:100%; box-sizing:border-box; background:#27272a; border:1px solid #3f3f46; border-radius:6px; color:#f4f4f5; padding:8px; font-size:12px; outline:none;">
                ${fieldOptionsHtml}
              </select>
            </div>

            <div style="margin-bottom:14px;">
              <label style="display:block; font-size:11px; font-weight:600; color:#a1a1aa; margin-bottom:4px;">
                2. Selecione a Pasta Fillbox para Vincular:
              </label>
              <select id="fillbox-folder-select" style="width:100%; box-sizing:border-box; background:#27272a; border:1px solid #3f3f46; border-radius:6px; color:#f4f4f5; padding:8px; font-size:12px; outline:none;">
                ${folders.length === 0 ? '<option value="" disabled>Nenhuma pasta cadastrada</option>' : folderOptions}
              </select>
            </div>

            <div style="font-size:11px; color:#a1a1aa; margin-bottom:16px; background:#27272a; padding:8px 10px; border-radius:6px; line-height:1.5;">
              <div><strong>Página:</strong> ${escapeHTML(norm.path)}</div>
              <div><strong>Identificação do Campo:</strong> ${escapeHTML(signature ? signature.strategy : 'N/A')}</div>
              ${signature && signature.labelText ? `<div><strong>Rótulo/Nome:</strong> ${escapeHTML(signature.labelText)}</div>` : ''}
              ${existing ? `<div style="color:#10b981; font-weight:600; margin-top:2px;">✓ Já vinculado à pasta: ${escapeHTML(existing.folder.name)}</div>` : '<div style="color:#71717a; margin-top:2px;">Campo sem vínculo atual</div>'}
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
              <div>
                ${
                  existing
                    ? `<button type="button" id="fillbox-unbind-btn" style="background:#ef4444; color:#fff; border:none; padding:7px 12px; border-radius:6px; font-size:11px; cursor:pointer; font-weight:600;">Remover Vínculo</button>`
                    : ''
                }
              </div>
              <div style="display:flex; gap:8px;">
                <button type="button" id="fillbox-cancel-btn" style="background:#3f3f46; color:#d4d4d8; border:none; padding:7px 12px; border-radius:6px; font-size:11px; cursor:pointer;">Cancelar</button>
                <button type="button" id="fillbox-save-btn" style="background:#f59e0b; color:#18181b; border:none; padding:7px 14px; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;">Salvar Vínculo</button>
              </div>
            </div>
          </div>
        </div>
      `;

      // Event Listeners
      overlay.querySelector('#fillbox-modal-close').addEventListener('click', () => overlay.remove());
      overlay.querySelector('#fillbox-cancel-btn').addEventListener('click', () => overlay.remove());

      const fieldSelect = overlay.querySelector('#fillbox-field-select');
      if (fieldSelect) {
        fieldSelect.addEventListener('change', async (e) => {
          const idx = parseInt(e.target.value, 10);
          if (allPageFields[idx]) {
            currentTarget = allPageFields[idx];
            updateModalView();
          }
        });
      }

      const unbindBtn = overlay.querySelector('#fillbox-unbind-btn');
      if (unbindBtn && existing) {
        unbindBtn.addEventListener('click', async () => {
          await store.removeBinding(existing.binding.id);
          showToast('Vínculo removido deste campo com sucesso.', 'info');
          overlay.remove();
        });
      }

      overlay.querySelector('#fillbox-save-btn').addEventListener('click', async () => {
        const select = overlay.querySelector('#fillbox-folder-select');
        const folderId = select ? select.value : null;
        if (!folderId) {
          showToast('Selecione uma pasta válida.', 'warning');
          return;
        }

        if (!signature) {
          showToast('Não foi possível gerar assinatura para este campo.', 'error');
          return;
        }

        await store.bindField({
          folderId,
          origin: norm.origin,
          path: norm.path,
          fieldSignature: signature
        });

        const selectedFolder = folders.find(f => f.id === folderId);
        showToast(`Campo vinculado com sucesso à pasta "${selectedFolder ? selectedFolder.name : ''}"!`, 'success');
        overlay.remove();
      });
    }

    document.body.appendChild(overlay);
    await updateModalView();
  }

  // Diálogo para Adicionar Nova Pasta via Botão Direito
  async function handleOpenAddFolderDialog() {
    const old = document.getElementById('fillbox-action-modal');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'fillbox-action-modal';
    overlay.style.cssText = `all:initial; position:fixed; inset:0; background:rgba(0,0,0,0.75); backdrop-filter:blur(2px); z-index:2147483647; display:flex; align-items:center; justify-content:center; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; font-size:13px; color:#e4e4e7;`;

    overlay.innerHTML = `
      <div style="background:#18181b; border:1px solid #3f3f46; border-radius:10px; width:380px; max-width:92vw; box-shadow:0 20px 40px rgba(0,0,0,0.8); overflow:hidden;">
        <div style="padding:12px 16px; background:#27272a; border-bottom:1px solid #3f3f46; display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:#f59e0b; font-size:13px;">📁 Nova Pasta Fillbox</strong>
          <button type="button" id="fillbox-action-close" style="background:transparent; border:none; color:#a1a1aa; cursor:pointer; font-size:16px;">✕</button>
        </div>
        <div style="padding:16px;">
          <label style="display:block; font-size:11px; font-weight:600; color:#a1a1aa; margin-bottom:6px;">Nome da Pasta:</label>
          <input type="text" id="fillbox-folder-name-input" placeholder="Ex: Clientes, Suporte, Respostas Rápidas" style="width:100%; box-sizing:border-box; background:#27272a; border:1px solid #3f3f46; border-radius:6px; color:#f4f4f5; padding:8px 10px; font-size:12px; outline:none; margin-bottom:16px;" />
          <div style="display:flex; justify-content:flex-end; gap:8px;">
            <button type="button" id="fillbox-action-cancel" style="background:#3f3f46; color:#d4d4d8; border:none; padding:7px 12px; border-radius:6px; font-size:11px; cursor:pointer;">Cancelar</button>
            <button type="button" id="fillbox-action-save" style="background:#f59e0b; color:#18181b; border:none; padding:7px 14px; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;">Criar Pasta</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    const input = overlay.querySelector('#fillbox-folder-name-input');
    setTimeout(() => input && input.focus(), 50);

    const close = () => overlay.remove();
    overlay.querySelector('#fillbox-action-close').addEventListener('click', close);
    overlay.querySelector('#fillbox-action-cancel').addEventListener('click', close);
    overlay.querySelector('#fillbox-action-save').addEventListener('click', async () => {
      const val = (input.value || '').trim();
      if (!val) {
        showToast('Digite um nome válido para a pasta.', 'warning');
        return;
      }
      try {
        await store.createFolder(val);
        showToast(`Pasta "${val}" criada com sucesso!`, 'success');
        close();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // Diálogo para Adicionar Novo Fill via Botão Direito
  async function handleOpenAddFillDialog(prefillContent = '') {
    const old = document.getElementById('fillbox-action-modal');
    if (old) old.remove();

    const folders = await store.getFolders();
    if (folders.length === 0) {
      showToast('Crie ao menos uma pasta antes de adicionar Fills.', 'warning');
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'fillbox-action-modal';
    overlay.style.cssText = `all:initial; position:fixed; inset:0; background:rgba(0,0,0,0.75); backdrop-filter:blur(2px); z-index:2147483647; display:flex; align-items:center; justify-content:center; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; font-size:13px; color:#e4e4e7;`;

    const folderOpts = folders.map(f => `<option value="${f.id}">📁 ${escapeHTML(f.name)}</option>`).join('');

    overlay.innerHTML = `
      <div style="background:#18181b; border:1px solid #3f3f46; border-radius:10px; width:420px; max-width:92vw; box-shadow:0 20px 40px rgba(0,0,0,0.8); overflow:hidden;">
        <div style="padding:12px 16px; background:#27272a; border-bottom:1px solid #3f3f46; display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:#f59e0b; font-size:13px;">🏷️ Novo Fill (Texto Reutilizável)</strong>
          <button type="button" id="fillbox-action-close" style="background:transparent; border:none; color:#a1a1aa; cursor:pointer; font-size:16px;">✕</button>
        </div>
        <div style="padding:16px;">
          <label style="display:block; font-size:11px; font-weight:600; color:#a1a1aa; margin-bottom:4px;">Pasta de Destino:</label>
          <select id="fillbox-fill-folder-select" style="width:100%; box-sizing:border-box; background:#27272a; border:1px solid #3f3f46; border-radius:6px; color:#f4f4f5; padding:7px; font-size:12px; outline:none; margin-bottom:12px;">
            ${folderOpts}
          </select>

          <label style="display:block; font-size:11px; font-weight:600; color:#a1a1aa; margin-bottom:4px;">Nome do Fill:</label>
          <input type="text" id="fillbox-fill-name-input" placeholder="Ex: Assinatura, Saudação, Template" style="width:100%; box-sizing:border-box; background:#27272a; border:1px solid #3f3f46; border-radius:6px; color:#f4f4f5; padding:8px 10px; font-size:12px; outline:none; margin-bottom:12px;" />

          <label style="display:block; font-size:11px; font-weight:600; color:#a1a1aa; margin-bottom:4px;">Conteúdo do Fill:</label>
          <textarea id="fillbox-fill-content-input" rows="4" placeholder="Digite ou cole o texto..." style="width:100%; box-sizing:border-box; background:#27272a; border:1px solid #3f3f46; border-radius:6px; color:#f4f4f5; padding:8px 10px; font-size:12px; outline:none; margin-bottom:16px; font-family:monospace; resize:vertical;">${escapeHTML(prefillContent)}</textarea>

          <div style="display:flex; justify-content:flex-end; gap:8px;">
            <button type="button" id="fillbox-action-cancel" style="background:#3f3f46; color:#d4d4d8; border:none; padding:7px 12px; border-radius:6px; font-size:11px; cursor:pointer;">Cancelar</button>
            <button type="button" id="fillbox-action-save" style="background:#f59e0b; color:#18181b; border:none; padding:7px 14px; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;">Salvar Fill</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    const nameInput = overlay.querySelector('#fillbox-fill-name-input');
    setTimeout(() => nameInput && nameInput.focus(), 50);

    const close = () => overlay.remove();
    overlay.querySelector('#fillbox-action-close').addEventListener('click', close);
    overlay.querySelector('#fillbox-action-cancel').addEventListener('click', close);
    overlay.querySelector('#fillbox-action-save').addEventListener('click', async () => {
      const folderId = overlay.querySelector('#fillbox-fill-folder-select').value;
      const name = (nameInput.value || '').trim();
      const content = overlay.querySelector('#fillbox-fill-content-input').value;
      if (!name) {
        showToast('O nome do Fill é obrigatório.', 'warning');
        return;
      }
      try {
        await store.createFill(folderId, name, content);
        showToast(`Fill "${name}" salvo com sucesso!`, 'success');
        close();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // Diálogo para Deletar Pasta ou Fill via Botão Direito
  async function handleOpenDeleteDialog() {
    const old = document.getElementById('fillbox-action-modal');
    if (old) old.remove();

    const folders = await store.getFolders();
    if (folders.length === 0) {
      showToast('Nenhuma pasta disponível para excluir.', 'info');
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'fillbox-action-modal';
    overlay.style.cssText = `all:initial; position:fixed; inset:0; background:rgba(0,0,0,0.75); backdrop-filter:blur(2px); z-index:2147483647; display:flex; align-items:center; justify-content:center; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; font-size:13px; color:#e4e4e7;`;

    let activeFolder = folders[0];

    function renderModalContent() {
      const folderOpts = folders.map(f => `<option value="${f.id}" ${f.id === activeFolder.id ? 'selected' : ''}>📁 ${escapeHTML(f.name)} (${(f.fills || []).length} Fills)</option>`).join('');
      const fillsList = (activeFolder.fills || []).map(item => `
        <div style="background:#27272a; border:1px solid #3f3f46; border-radius:6px; padding:6px 10px; display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <div>
            <div style="font-weight:600; font-size:12px; color:#f4f4f5;">🏷️ ${escapeHTML(item.name)}</div>
            <div style="font-size:10px; color:#a1a1aa; font-family:monospace; max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHTML(item.fill)}</div>
          </div>
          <button type="button" class="del-fill-btn" data-fill-id="${item.id}" style="background:#ef4444; color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:10px; cursor:pointer; font-weight:600;">Excluir</button>
        </div>
      `).join('');

      overlay.innerHTML = `
        <div style="background:#18181b; border:1px solid #3f3f46; border-radius:10px; width:440px; max-width:92vw; box-shadow:0 20px 40px rgba(0,0,0,0.8); overflow:hidden;">
          <div style="padding:12px 16px; background:#27272a; border-bottom:1px solid #3f3f46; display:flex; justify-content:space-between; align-items:center;">
            <strong style="color:#ef4444; font-size:13px;">🗑️ Excluir Pastas ou Fills</strong>
            <button type="button" id="fillbox-action-close" style="background:transparent; border:none; color:#a1a1aa; cursor:pointer; font-size:16px;">✕</button>
          </div>
          <div style="padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <label style="font-size:11px; font-weight:600; color:#a1a1aa;">Selecione a Pasta:</label>
              <button type="button" id="del-folder-btn" style="background:transparent; color:#ef4444; border:1px solid #ef4444; padding:3px 8px; border-radius:4px; font-size:10px; cursor:pointer; font-weight:600;">🗑️ Excluir Pasta Inteira</button>
            </div>
            <select id="del-folder-select" style="width:100%; box-sizing:border-box; background:#27272a; border:1px solid #3f3f46; border-radius:6px; color:#f4f4f5; padding:7px; font-size:12px; outline:none; margin-bottom:12px;">
              ${folderOpts}
            </select>

            <label style="display:block; font-size:11px; font-weight:600; color:#a1a1aa; margin-bottom:6px;">Fills desta Pasta (${(activeFolder.fills || []).length}):</label>
            <div style="max-height:180px; overflow-y:auto; margin-bottom:16px;">
              ${(activeFolder.fills || []).length === 0 ? '<div style="color:#71717a; font-size:11px; padding:10px; text-align:center;">Pasta sem Fills.</div>' : fillsList}
            </div>

            <div style="display:flex; justify-content:flex-end;">
              <button type="button" id="fillbox-action-done" style="background:#3f3f46; color:#d4d4d8; border:none; padding:7px 14px; border-radius:6px; font-size:11px; cursor:pointer;">Concluído</button>
            </div>
          </div>
        </div>
      `;

      overlay.querySelector('#fillbox-action-close').addEventListener('click', () => overlay.remove());
      overlay.querySelector('#fillbox-action-done').addEventListener('click', () => overlay.remove());

      overlay.querySelector('#del-folder-select').addEventListener('change', (e) => {
        const found = folders.find(f => f.id === e.target.value);
        if (found) {
          activeFolder = found;
          renderModalContent();
        }
      });

      overlay.querySelector('#del-folder-btn').addEventListener('click', async () => {
        if (!confirm(`Atenção: Excluir a pasta "${activeFolder.name}" apagará todos os seus Fills e desativará os vínculos associados. Confirmar?`)) return;
        await store.deleteFolder(activeFolder.id);
        showToast(`Pasta "${activeFolder.name}" excluída.`, 'info');
        overlay.remove();
      });

      overlay.querySelectorAll('.del-fill-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const fillId = e.target.getAttribute('data-fill-id');
          await store.deleteFill(activeFolder.id, fillId);
          activeFolder.fills = activeFolder.fills.filter(item => item.id !== fillId);
          showToast('Fill excluído com sucesso.', 'info');
          renderModalContent();
        });
      });
    }

    document.body.appendChild(overlay);
    renderModalContent();
  }

  function showToast(text, type = 'info') {
    const toast = document.createElement('div');
    const color = type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#10b981';
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #18181b;
      border: 1px solid ${color};
      color: #f4f4f5;
      padding: 10px 14px;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.6);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 12px;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    toast.textContent = text;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();
