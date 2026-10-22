/**
 * Fillbox — Background Service Worker / Script
 * Gerencia menús de contexto para vincular, adicionar e deletar pastas e fills com botão direito
 */

const isFirefox = typeof browser !== 'undefined';
const ext = isFirefox ? browser : chrome;

// Criação do Menu de Contexto completo
function setupContextMenu() {
  ext.contextMenus.removeAll(() => {
    // Menu Principal Fillbox
    ext.contextMenus.create({
      id: 'fillbox-root',
      title: 'Fillbox',
      contexts: ['editable', 'selection', 'page']
    });

    // 1. Vincular campo (em campos editáveis)
    ext.contextMenus.create({
      id: 'fillbox-bind-field',
      parentId: 'fillbox-root',
      title: '🔗 Vincular pasta a este campo',
      contexts: ['editable']
    });

    // Separador
    ext.contextMenus.create({
      id: 'fillbox-sep-1',
      parentId: 'fillbox-root',
      type: 'separator',
      contexts: ['editable', 'selection', 'page']
    });

    // 2. Adicionar Pasta
    ext.contextMenus.create({
      id: 'fillbox-add-folder',
      parentId: 'fillbox-root',
      title: '📁➕ Nova Pasta...',
      contexts: ['editable', 'page', 'selection']
    });

    // 3. Adicionar Fill (inclusive a partir do texto selecionado!)
    ext.contextMenus.create({
      id: 'fillbox-add-fill',
      parentId: 'fillbox-root',
      title: '🏷️➕ Novo Fill...',
      contexts: ['editable', 'selection']
    });

    // Separador
    ext.contextMenus.create({
      id: 'fillbox-sep-2',
      parentId: 'fillbox-root',
      type: 'separator',
      contexts: ['editable', 'selection', 'page']
    });

    // 4. Deletar Pasta ou Fill
    ext.contextMenus.create({
      id: 'fillbox-delete-item',
      parentId: 'fillbox-root',
      title: '🗑️ Excluir Pasta ou Fill...',
      contexts: ['editable', 'page', 'selection']
    });

    // 5. Gerenciador Completo
    ext.contextMenus.create({
      id: 'fillbox-open-manager',
      parentId: 'fillbox-root',
      title: '⚙ Abrir Gerenciador Fillbox',
      contexts: ['all']
    });
  });
}

ext.runtime.onInstalled.addListener(() => {
  setupContextMenu();
});

// Ações ao clicar no menu de contexto
ext.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) return;

  if (info.menuItemId === 'fillbox-open-manager') {
    if (ext.runtime.openOptionsPage) {
      ext.runtime.openOptionsPage();
    } else {
      ext.tabs.create({ url: ext.runtime.getURL('manager/manager.html') });
    }
    return;
  }

  let action = 'OPEN_BIND_DIALOG';
  if (info.menuItemId === 'fillbox-add-folder') action = 'OPEN_ADD_FOLDER_DIALOG';
  else if (info.menuItemId === 'fillbox-add-fill') action = 'OPEN_ADD_FILL_DIALOG';
  else if (info.menuItemId === 'fillbox-delete-item') action = 'OPEN_DELETE_DIALOG';

  ext.tabs.sendMessage(
    tab.id,
    {
      action,
      selectedText: info.selectionText || ''
    },
    (res) => {
      if (ext.runtime.lastError) {
        console.warn('[Fillbox Background] Comunicação com a aba:', ext.runtime.lastError.message);
      }
    }
  );
});
