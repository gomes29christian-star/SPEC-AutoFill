/**
 * Fillbox — Background Service Worker / Script
 * Gerencia menús de contexto e inicialização do ciclo de vida da extensão
 */

const isFirefox = typeof browser !== 'undefined';
const ext = isFirefox ? browser : chrome;

// Criação do Menu de Contexto ao instalar ou iniciar
function setupContextMenu() {
  ext.contextMenus.removeAll(() => {
    ext.contextMenus.create({
      id: 'fillbox-bind-field',
      title: 'Vincular pasta Fill',
      contexts: ['editable']
    });
  });
}

ext.runtime.onInstalled.addListener(() => {
  setupContextMenu();
});

// Abertura do diálogo de vinculação ao clicar no menu de contexto
ext.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'fillbox-bind-field' && tab && tab.id) {
    ext.tabs.sendMessage(tab.id, { action: 'OPEN_BIND_DIALOG' }, (response) => {
      if (ext.runtime.lastError) {
        // Se o content script não respondeu (ex: página não recarregada ou página especial), injeta se necessário
        console.warn('[Fillbox Background] Falha ao comunicar com a aba:', ext.runtime.lastError.message);
      }
    });
  }
});
