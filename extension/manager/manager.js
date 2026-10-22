/**
 * Fillbox — Lógica da Interface de Gerenciamento Completa
 */

document.addEventListener('DOMContentLoaded', async () => {
  const store = window.FillboxStorage.store;

  let activeFolderId = null;
  let currentSearchQuery = '';

  // Elementos do DOM
  const foldersContainer = document.getElementById('folders-container');
  const fillsList = document.getElementById('fills-list');
  const activeFolderName = document.getElementById('active-folder-name');
  const activeFolderInfo = document.getElementById('active-folder-info');
  const addFolderBtn = document.getElementById('add-folder-btn');
  const renameFolderBtn = document.getElementById('rename-folder-btn');
  const deleteFolderBtn = document.getElementById('delete-folder-btn');
  const addFillBtn = document.getElementById('add-fill-btn');
  const searchInput = document.getElementById('search-fills-input');
  const viewBindingsBtn = document.getElementById('view-bindings-btn');
  const totalBindingsCount = document.getElementById('total-bindings-count');
  const exportBtn = document.getElementById('export-btn');
  const importFile = document.getElementById('import-file');

  // Modal
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalCloseX = document.getElementById('modal-close-x');
  const modalCancelBtn = document.getElementById('modal-cancel-btn');
  const modalConfirmBtn = document.getElementById('modal-confirm-btn');

  let onModalConfirm = null;

  function openModal(title, bodyHtml, onConfirm, confirmText = 'Confirmar') {
    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHtml;
    modalConfirmBtn.textContent = confirmText;
    onModalConfirm = onConfirm;
    modalBackdrop.classList.remove('hidden');

    const firstInput = modalBody.querySelector('input, textarea');
    if (firstInput) setTimeout(() => firstInput.focus(), 50);
  }

  function closeModal() {
    modalBackdrop.classList.add('hidden');
    onModalConfirm = null;
  }

  modalCloseX.addEventListener('click', closeModal);
  modalCancelBtn.addEventListener('click', closeModal);
  modalConfirmBtn.addEventListener('click', async () => {
    if (onModalConfirm) {
      const shouldClose = await onModalConfirm();
      if (shouldClose !== false) closeModal();
    } else {
      closeModal();
    }
  });

  // Normalização de texto
  function normalizeText(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
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

  function showToast(msg, isError = false) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.borderColor = isError ? '#ef4444' : '#f59e0b';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Renderiza Lista de Pastas
  async function refreshFolders() {
    const folders = await store.getFolders();
    const bindings = await store.getBindings();
    totalBindingsCount.textContent = String(bindings.length);

    if (folders.length === 0) {
      foldersContainer.innerHTML = '<div style="color:#71717a; padding:12px; font-size:11px;">Nenhuma pasta cadastrada.</div>';
      activeFolderId = null;
      renderActiveFolder();
      return;
    }

    if (!activeFolderId || !folders.some((f) => f.id === activeFolderId)) {
      activeFolderId = folders[0].id;
    }

    foldersContainer.innerHTML = folders
      .map((f) => {
        const isActive = f.id === activeFolderId;
        const count = (f.fills || []).length;
        return `
        <div class="folder-item ${isActive ? 'active' : ''}" data-id="${f.id}">
          <span>📁 ${escapeHTML(f.name)}</span>
          <span class="badge">${count}</span>
        </div>
      `;
      })
      .join('');

    foldersContainer.querySelectorAll('.folder-item').forEach((el) => {
      el.addEventListener('click', () => {
        activeFolderId = el.getAttribute('data-id');
        refreshFolders();
        renderActiveFolder();
      });
    });

    renderActiveFolder();
  }

  // Renderiza a pasta ativa e seus Fills
  async function renderActiveFolder() {
    if (!activeFolderId) {
      activeFolderName.textContent = 'Nenhuma pasta selecionada';
      activeFolderInfo.textContent = '';
      renameFolderBtn.style.display = 'none';
      deleteFolderBtn.style.display = 'none';
      addFillBtn.style.display = 'none';
      fillsList.innerHTML = '<div style="color:#71717a; padding:20px;">Crie ou selecione uma pasta para gerenciar os Fills.</div>';
      return;
    }

    const folder = await store.getFolder(activeFolderId);
    if (!folder) return;

    activeFolderName.textContent = folder.name;
    activeFolderInfo.textContent = `Criada em ${folder.createdAt || 'N/A'} • ${(folder.fills || []).length} Fills armazenados`;
    renameFolderBtn.style.display = 'inline-flex';
    deleteFolderBtn.style.display = 'inline-flex';
    addFillBtn.style.display = 'inline-flex';

    let fills = folder.fills || [];
    if (currentSearchQuery.trim()) {
      const q = normalizeText(currentSearchQuery.trim());
      fills = fills.filter((f) => normalizeText(f.name).includes(q) || normalizeText(f.fill).includes(q));
    }

    if (fills.length === 0) {
      fillsList.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: #71717a;">
          <p>${folder.fills.length === 0 ? 'Esta pasta ainda não possui nenhum Fill cadastrado.' : 'Nenhum Fill corresponde à sua busca.'}</p>
          <button type="button" id="inner-add-fill-btn" class="btn btn-secondary btn-sm" style="margin-top: 10px;">+ Criar Primeiro Fill</button>
        </div>
      `;
      const innerAdd = fillsList.querySelector('#inner-add-fill-btn');
      if (innerAdd) innerAdd.addEventListener('click', () => triggerAddFill());
      return;
    }

    fillsList.innerHTML = fills
      .map(
        (fill) => `
      <div class="fill-card" data-fill-id="${fill.id}">
        <div>
          <div class="fill-card-title">
            <span>🏷 ${escapeHTML(fill.name)}</span>
            <div style="display:flex; gap:2px;">
              <button class="btn-icon edit-fill-btn" title="Editar Fill">✏</button>
              <button class="btn-icon text-danger delete-fill-btn" title="Excluir Fill">🗑</button>
            </div>
          </div>
          <div class="fill-card-body">${escapeHTML(fill.fill)}</div>
        </div>
        <div class="fill-card-footer">
          <span>Criado em: ${fill.createdAt || 'N/A'}</span>
          <span>${fill.fill.length} caracteres</span>
        </div>
      </div>
    `
      )
      .join('');

    fillsList.querySelectorAll('.fill-card').forEach((card) => {
      const fillId = card.getAttribute('data-fill-id');
      const item = folder.fills.find((f) => f.id === fillId);
      if (!item) return;

      card.querySelector('.edit-fill-btn').addEventListener('click', () => triggerEditFill(item));
      card.querySelector('.delete-fill-btn').addEventListener('click', () => triggerDeleteFill(item));
    });
  }

  // ================= AÇÕES DE PASTA =================
  addFolderBtn.addEventListener('click', () => {
    openModal(
      'Criar Nova Pasta',
      `
      <div class="form-group">
        <label>Nome da Pasta</label>
        <input type="text" id="modal-folder-name" class="form-input" placeholder="Ex: Suporte, Vendas, Respostas Rápidas" />
      </div>
    `,
      async () => {
        const val = document.getElementById('modal-folder-name').value.trim();
        if (!val) {
          showToast('Digite um nome válido.', true);
          return false;
        }
        const newFolder = await store.createFolder(val);
        activeFolderId = newFolder.id;
        showToast(`Pasta "${newFolder.name}" criada.`);
        await refreshFolders();
      }
    );
  });

  renameFolderBtn.addEventListener('click', async () => {
    const folder = await store.getFolder(activeFolderId);
    if (!folder) return;

    openModal(
      'Renomear Pasta',
      `
      <div class="form-group">
        <label>Novo Nome</label>
        <input type="text" id="modal-folder-rename" class="form-input" value="${escapeHTML(folder.name)}" />
      </div>
    `,
      async () => {
        const val = document.getElementById('modal-folder-rename').value.trim();
        if (!val) {
          showToast('Digite um nome válido.', true);
          return false;
        }
        await store.renameFolder(folder.id, val);
        showToast('Pasta renomeada.');
        await refreshFolders();
      }
    );
  });

  deleteFolderBtn.addEventListener('click', async () => {
    const folder = await store.getFolder(activeFolderId);
    if (!folder) return;

    openModal(
      'Excluir Pasta',
      `
      <p style="color:#ef4444; font-weight:600; margin-bottom:8px;">Atenção: Operação Irreversível</p>
      <p style="color:#d4d4d8; font-size:12px; margin-bottom:12px;">
        Tem certeza que deseja excluir a pasta <strong>"${escapeHTML(folder.name)}"</strong>?
      </p>
      <div style="background:#27272a; padding:10px; border-radius:6px; font-size:11px; color:#a1a1aa; line-height:1.4;">
        Todos os <strong>${(folder.fills || []).length} Fills</strong> e os vínculos associados a esta pasta em páginas web <strong>deixarão de funcionar</strong> imediatamente.
      </div>
    `,
      async () => {
        const res = await store.deleteFolder(folder.id);
        showToast(`Pasta excluída. ${res.removedBindings} vínculos desativados.`);
        activeFolderId = null;
        await refreshFolders();
      },
      'Excluir Pasta Definitivamente'
    );
  });

  // ================= AÇÕES DE FILL =================
  function triggerAddFill() {
    if (!activeFolderId) return;

    openModal(
      'Criar Novo Fill',
      `
      <div class="form-group">
        <label>Nome do Fill (Identificação)</label>
        <input type="text" id="modal-fill-name" class="form-input" placeholder="Ex: Assinatura de E-mail, Resposta FAQ" />
      </div>
      <div class="form-group">
        <label>Conteúdo do Fill (Texto a ser inserido no campo)</label>
        <textarea id="modal-fill-content" class="form-textarea" placeholder="Digite ou cole o texto que será preenchido..."></textarea>
      </div>
    `,
      async () => {
        const name = document.getElementById('modal-fill-name').value.trim();
        const content = document.getElementById('modal-fill-content').value;
        if (!name) {
          showToast('O nome do Fill é obrigatório.', true);
          return false;
        }
        await store.createFill(activeFolderId, name, content);
        showToast(`Fill "${name}" criado.`);
        await refreshFolders();
      }
    );
  }

  addFillBtn.addEventListener('click', triggerAddFill);

  function triggerEditFill(fillItem) {
    openModal(
      'Editar Fill',
      `
      <div class="form-group">
        <label>Nome do Fill</label>
        <input type="text" id="modal-fill-name-edit" class="form-input" value="${escapeHTML(fillItem.name)}" />
      </div>
      <div class="form-group">
        <label>Conteúdo do Fill</label>
        <textarea id="modal-fill-content-edit" class="form-textarea">${escapeHTML(fillItem.fill)}</textarea>
      </div>
    `,
      async () => {
        const name = document.getElementById('modal-fill-name-edit').value.trim();
        const content = document.getElementById('modal-fill-content-edit').value;
        if (!name) {
          showToast('O nome não pode estar vazio.', true);
          return false;
        }
        await store.updateFill(activeFolderId, fillItem.id, name, content);
        showToast('Fill atualizado.');
        await refreshFolders();
      }
    );
  }

  function triggerDeleteFill(fillItem) {
    openModal(
      'Excluir Fill',
      `
      <p style="color:#d4d4d8; font-size:12px;">Deseja realmente excluir o Fill <strong>"${escapeHTML(fillItem.name)}"</strong>?</p>
    `,
      async () => {
        await store.deleteFill(activeFolderId, fillItem.id);
        showToast('Fill excluído com sucesso.');
        await refreshFolders();
      },
      'Excluir'
    );
  }

  // Busca de Fills
  searchInput.addEventListener('input', (e) => {
    currentSearchQuery = e.target.value;
    renderActiveFolder();
  });

  // Gerenciador de Vínculos
  viewBindingsBtn.addEventListener('click', async () => {
    const bindings = await store.getBindings();
    const folders = await store.getFolders();

    const bindingsRows =
      bindings.length === 0
        ? '<div style="color:#71717a; padding:12px; text-align:center;">Nenhum campo vinculado no momento.</div>'
        : bindings
            .map((b) => {
              const f = folders.find((fol) => fol.id === b.folderId);
              const folderName = f ? f.name : '(Pasta Excluída)';
              return `
          <div style="background:#121215; border:1px solid #27272a; border-radius:6px; padding:10px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-weight:600; color:#f4f4f5; font-size:12px;">📁 ${escapeHTML(folderName)}</div>
              <div style="font-size:11px; color:#a1a1aa;">${escapeHTML(b.origin)}${escapeHTML(b.path)}</div>
              <div style="font-size:10px; color:#71717a;">Estratégia: ${escapeHTML(b.fieldSignature.strategy)} | Criado: ${b.createdAt}</div>
            </div>
            <button type="button" class="btn btn-secondary btn-sm delete-binding-btn" data-id="${b.id}" style="color:#ef4444;">Remover</button>
          </div>
        `;
            })
            .join('');

    openModal(
      'Vínculos Ativos de Páginas Web',
      `
      <div style="max-height:300px; overflow-y:auto;">
        ${bindingsRows}
      </div>
    `,
      null,
      'Fechar'
    );

    // Conecta botões de remoção dentro do modal
    modalBody.querySelectorAll('.delete-binding-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        await store.removeBinding(id);
        showToast('Vínculo desativado.');
        closeModal();
        refreshFolders();
      });
    });
  });

  // Exportação JSON
  exportBtn.addEventListener('click', async () => {
    try {
      const json = await store.exportJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fillbox_backup_${window.FillboxStorage.formatDateBR().replace(/\//g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Exportação concluída com sucesso.');
    } catch (e) {
      showToast('Falha na exportação: ' + e.message, true);
    }
  });

  // Importação JSON
  importFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        await store.importJSON(evt.target.result);
        showToast('Backup importado com sucesso!');
        await refreshFolders();
      } catch (err) {
        showToast('Erro ao importar: ' + err.message, true);
      } finally {
        importFile.value = '';
      }
    };
    reader.readAsText(file);
  });

  // Inicialização
  await refreshFolders();
});
