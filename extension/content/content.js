/**
 * Fillbox — Content Script Principal
 * Orquestra vinculação contextual, escuta cliques em campos vinculados e gerencia diálogo de vinculação
 */

(function () {
  'use strict';

  // Guarda o último elemento clicado com o botão direito para o context menu
  let lastContextTarget = null;
  const store = window.FillboxStorage ? window.FillboxStorage.store : null;
  const selector = window.FillboxSelector ? window.FillboxSelector.selectorInstance : null;
  const identifier = window.FieldIdentifier;
  const filler = window.FillboxFiller;

  // Rastreia o elemento do clique com botão direito
  document.addEventListener(
    'contextmenu',
    (e) => {
      if (identifier && identifier.isFieldSupported(e.target)) {
        lastContextTarget = e.target;
      }
    },
    true
  );

  // Escuta clique com botão esquerdo em campos editáveis
  document.addEventListener(
    'click',
    async (e) => {
      const target = e.target;
      if (!target || !identifier || !identifier.isFieldSupported(target)) {
        return;
      }

      // Se o clique foi dentro do próprio seletor flutuante ou modal, não reabre
      if (e.target.closest('#fillbox-floating-container') || e.target.closest('#fillbox-bind-modal')) {
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
        const target = lastContextTarget || document.activeElement;
        handleOpenBindDialog(target);
        sendResponse({ received: true });
        return true;
      }

      if (message.action === 'PING') {
        sendResponse({ status: 'pong' });
        return true;
      }
    });
  }

  // Abre diálogo discreto na página para vincular ou remover vínculo da pasta
  async function handleOpenBindDialog(target) {
    if (!target || !identifier.isFieldSupported(target)) {
      showToast('Fillbox: Este campo não é editável ou é um campo de senha protegido.', 'error');
      return;
    }

    const signature = identifier.createFieldSignature(target);
    if (!signature) {
      showToast('Fillbox: Não foi possível identificar este campo de forma segura e confiável.', 'warning');
      return;
    }

    const norm = identifier.normalizeUrl(window.location.href);
    const existing = await store.findBindingForField(norm.origin, norm.path, signature);
    const folders = await store.getFolders();

    renderBindModal(target, signature, norm, existing, folders);
  }

  function renderBindModal(target, signature, norm, existing, folders) {
    // Remove modal anterior se houver
    const oldModal = document.getElementById('fillbox-bind-modal');
    if (oldModal) oldModal.remove();

    const overlay = document.createElement('div');
    overlay.id = 'fillbox-bind-modal';
    overlay.style.cssText = `
      all: initial;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(2px);
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      color: #e4e4e7;
    `;

    const folderOptions = folders.map((f) => {
      const isSelected = existing && existing.folder && existing.folder.id === f.id;
      return `<option value="${f.id}" ${isSelected ? 'selected' : ''}>📁 ${escapeHTML(f.name)} (${(f.fills || []).length} Fills)</option>`;
    }).join('');

    overlay.innerHTML = `
      <div style="background:#18181b; border:1px solid #3f3f46; border-radius:10px; width:380px; max-width:92vw; box-shadow:0 20px 40px rgba(0,0,0,0.8); overflow:hidden;">
        <div style="padding:12px 16px; background:#27272a; border-bottom:1px solid #3f3f46; display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:#f59e0b; font-size:13px; display:flex; align-items:center; gap:6px;">
            <span>⚡ Vincular Pasta Fill</span>
          </strong>
          <button type="button" id="fillbox-modal-close" style="background:transparent; border:none; color:#a1a1aa; cursor:pointer; font-size:16px;">✕</button>
        </div>

        <div style="padding:16px;">
          <div style="font-size:11px; color:#a1a1aa; margin-bottom:12px; background:#27272a; padding:8px 10px; border-radius:6px; line-height:1.5;">
            <div><strong>Página:</strong> ${escapeHTML(norm.path)}</div>
            <div><strong>Estratégia:</strong> ${escapeHTML(signature.strategy)}</div>
            ${signature.name ? `<div><strong>Nome do campo:</strong> ${escapeHTML(signature.name)}</div>` : ''}
            ${signature.labelText ? `<div><strong>Rótulo:</strong> ${escapeHTML(signature.labelText)}</div>` : ''}
          </div>

          <label style="display:block; font-weight:600; margin-bottom:6px; color:#f4f4f5;">
            Selecione a Pasta para este campo:
          </label>
          <select id="fillbox-folder-select" style="width:100%; background:#27272a; border:1px solid #3f3f46; border-radius:6px; color:#f4f4f5; padding:8px; font-size:12px; outline:none; margin-bottom:16px;">
            ${folders.length === 0 ? '<option value="" disabled>Nenhuma pasta encontrada</option>' : folderOptions}
          </select>

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

    document.body.appendChild(overlay);

    const closeModal = () => overlay.remove();

    overlay.querySelector('#fillbox-modal-close').addEventListener('click', closeModal);
    overlay.querySelector('#fillbox-cancel-btn').addEventListener('click', closeModal);

    const unbindBtn = overlay.querySelector('#fillbox-unbind-btn');
    if (unbindBtn && existing) {
      unbindBtn.addEventListener('click', async () => {
        await store.removeBinding(existing.binding.id);
        showToast('Vínculo removido deste campo com sucesso.', 'info');
        closeModal();
      });
    }

    overlay.querySelector('#fillbox-save-btn').addEventListener('click', async () => {
      const select = overlay.querySelector('#fillbox-folder-select');
      const folderId = select.value;
      if (!folderId) {
        showToast('Selecione uma pasta válida.', 'warning');
        return;
      }

      await store.bindField({
        folderId,
        origin: norm.origin,
        path: norm.path,
        fieldSignature: signature
      });

      showToast('Campo vinculado com sucesso! Clique nele para abrir os Fills.', 'success');
      closeModal();
    });
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
