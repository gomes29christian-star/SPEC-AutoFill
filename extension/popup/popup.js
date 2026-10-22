/**
 * Fillbox — Lógica do Popup
 */

document.addEventListener('DOMContentLoaded', async () => {
  const store = window.FillboxStorage.store;
  const isFirefox = typeof browser !== 'undefined';
  const ext = isFirefox ? browser : chrome;

  const folderCountEl = document.getElementById('folder-count');
  const fillCountEl = document.getElementById('fill-count');
  const bindCountEl = document.getElementById('bind-count');
  const listEl = document.getElementById('folders-quick-list');
  const openManagerBtn = document.getElementById('open-manager-btn');

  // Abre a aba do Gerenciador completo
  openManagerBtn.addEventListener('click', () => {
    if (ext.runtime.openOptionsPage) {
      ext.runtime.openOptionsPage();
    } else {
      window.open(ext.runtime.getURL('manager/manager.html'));
    }
  });

  try {
    const data = await store.load();
    const folders = data.folders || [];
    const bindings = data.bindings || [];

    const totalFills = folders.reduce((acc, f) => acc + (f.fills ? f.fills.length : 0), 0);

    folderCountEl.textContent = String(folders.length);
    fillCountEl.textContent = String(totalFills);
    bindCountEl.textContent = String(bindings.length);

    if (folders.length === 0) {
      listEl.innerHTML = '<div style="color:#71717a; font-size:11px; padding:8px; text-align:center;">Nenhuma pasta cadastrada.</div>';
    } else {
      listEl.innerHTML = folders
        .map(
          (f) => `
        <div class="folder-row">
          <span class="folder-name">📁 ${escapeHTML(f.name)}</span>
          <span class="folder-count-badge">${(f.fills || []).length} fills</span>
        </div>
      `
        )
        .join('');
    }
  } catch (e) {
    console.error('[Fillbox Popup] Erro ao carregar dados:', e);
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
});
