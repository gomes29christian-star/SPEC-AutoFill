/**
 * Fillbox — Background Service Worker / Script
 * Gerencia menús de contexto para vincular, adicionar e deletar pastas e fills com botão direito
 */

if (typeof importScripts === 'function') {
  try {
    importScripts('/shared/storage.js');
  } catch (e) {
    try {
      importScripts('../shared/storage.js');
    } catch (e2) {}
  }
}

const isFirefox = typeof browser !== 'undefined';
const ext = isFirefox ? browser : chrome;

// Criação do Menu de Contexto completo e seguro contra exceções fatais no Service Worker
function setupContextMenu() {
  if (!ext || !ext.contextMenus) return;

  try {
    ext.contextMenus.removeAll(() => {
      if (ext.runtime && ext.runtime.lastError) {
        // Silencia aviso de remoção para evitar crash
      }

      const items = [
        { id: 'fillbox-root', title: 'Fillbox', contexts: ['all'] },
        { id: 'fillbox-bind-field', parentId: 'fillbox-root', title: '🔗 Vincular pasta a este campo', contexts: ['all'] },
        { id: 'fillbox-sep-1', parentId: 'fillbox-root', type: 'separator', contexts: ['all'] },
        { id: 'fillbox-add-folder', parentId: 'fillbox-root', title: '📁➕ Nova Pasta...', contexts: ['all'] },
        { id: 'fillbox-add-fill', parentId: 'fillbox-root', title: '🏷️➕ Novo Fill...', contexts: ['all'] },
        { id: 'fillbox-sep-2', parentId: 'fillbox-root', type: 'separator', contexts: ['all'] },
        { id: 'fillbox-delete-item', parentId: 'fillbox-root', title: '🗑️ Excluir Pasta ou Fill...', contexts: ['all'] },
        { id: 'fillbox-open-manager', parentId: 'fillbox-root', title: '⚙ Abrir Gerenciador Fillbox', contexts: ['all'] }
      ];

      items.forEach((item) => {
        try {
          ext.contextMenus.create(item, () => {
            if (ext.runtime && ext.runtime.lastError) {
              // Silencia erros de ID duplicado para impedir que o navegador desative a extensão
            }
          });
        } catch (err) {}
      });
    });
  } catch (err) {}
}

if (ext && ext.runtime) {
  if (ext.runtime.onInstalled) {
    ext.runtime.onInstalled.addListener(() => {
      setupContextMenu();
    });
  }
  if (ext.runtime.onStartup) {
    ext.runtime.onStartup.addListener(() => {
      setupContextMenu();
    });
  }
}

// Ações ao clicar no menu de contexto
if (ext && ext.contextMenus) {
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

    const msg = {
      action,
      selectedText: info.selectionText || ''
    };

    const options = (info && info.frameId !== undefined) ? { frameId: info.frameId } : {};

    ext.tabs.sendMessage(
      tab.id,
      msg,
      options,
      async (res) => {
        if (ext.runtime && ext.runtime.lastError) {
          try {
            if (ext.scripting && ext.scripting.executeScript) {
              await ext.scripting.executeScript({
                target: { tabId: tab.id, allFrames: true },
                files: ['shared/storage.js', 'content/field-identifier.js', 'content/filler.js', 'content/selector.js', 'content/content.js']
              });
              setTimeout(() => {
                ext.tabs.sendMessage(tab.id, msg, options, () => {
                  if (ext.runtime && ext.runtime.lastError && options.frameId !== undefined) {
                    ext.tabs.sendMessage(tab.id, msg);
                  }
                });
              }, 120);
            }
          } catch (err) {}
        }
      }
    );
  });
}
