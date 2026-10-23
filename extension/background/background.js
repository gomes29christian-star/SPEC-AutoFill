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
      contexts: ['all']
    });

    // 1. Vincular campo (em qualquer elemento/campo)
    ext.contextMenus.create({
      id: 'fillbox-bind-field',
      parentId: 'fillbox-root',
      title: '🔗 Vincular pasta a este campo',
      contexts: ['all']
    });

    // Separador
    ext.contextMenus.create({
      id: 'fillbox-sep-1',
      parentId: 'fillbox-root',
      type: 'separator',
      contexts: ['all']
    });

    // 2. Adicionar Pasta
    ext.contextMenus.create({
      id: 'fillbox-add-folder',
      parentId: 'fillbox-root',
      title: '📁➕ Nova Pasta...',
      contexts: ['all']
    });

    // 3. Adicionar Fill (inclusive a partir do texto selecionado!)
    ext.contextMenus.create({
      id: 'fillbox-add-fill',
      parentId: 'fillbox-root',
      title: '🏷️➕ Novo Fill...',
      contexts: ['all']
    });

    // Separador
    ext.contextMenus.create({
      id: 'fillbox-sep-2',
      parentId: 'fillbox-root',
      type: 'separator',
      contexts: ['all']
    });

    // 4. Deletar Pasta ou Fill
    ext.contextMenus.create({
      id: 'fillbox-delete-item',
      parentId: 'fillbox-root',
      title: '🗑️ Excluir Pasta ou Fill...',
      contexts: ['all']
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

if (ext.runtime.onStartup) {
  ext.runtime.onStartup.addListener(() => {
    setupContextMenu();
  });
}

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
    async (res) => {
      if (ext.runtime.lastError) {
        console.warn('[Fillbox Background] Reinjando scripts na aba:', ext.runtime.lastError.message);
        try {
          if (ext.scripting && ext.scripting.executeScript) {
            await ext.scripting.executeScript({
              target: { tabId: tab.id, allFrames: true },
              files: ['shared/storage.js', 'content/field-identifier.js', 'content/filler.js', 'content/selector.js', 'content/content.js']
            });
            setTimeout(() => {
              ext.tabs.sendMessage(tab.id, { action, selectedText: info.selectionText || '' });
            }, 100);
          }
        } catch (err) {
          console.error('[Fillbox Background] Falha na injeção de fallback:', err);
        }
      }
    }
  );
});
