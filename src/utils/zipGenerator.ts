import JSZip from 'jszip';

export type BrowserTarget = 'firefox' | 'chromium';

export async function generateExtensionZipBlob(target: BrowserTarget = 'firefox'): Promise<Blob> {
  const zip = new JSZip();

  // 1. Manifest V3 específico por alvo de navegador
  const isChromium = target === 'chromium';
  const manifest: any = {
    manifest_version: 3,
    name: 'Fillbox — Autofill Minimalista',
    version: '1.0.0',
    description: 'Ferramenta rápida e minimalista de preenchimento contextual de campos com textos reutilizáveis organizados em pastas.',
    icons: {
      '16': 'icons/icon-16.png',
      '48': 'icons/icon-48.png',
      '128': 'icons/icon-128.png'
    },
    permissions: [
      'storage',
      'contextMenus',
      'activeTab'
    ],
    action: {
      default_popup: 'popup/popup.html',
      default_title: 'Fillbox',
      default_icon: {
        '16': 'icons/icon-16.png',
        '48': 'icons/icon-48.png',
        '128': 'icons/icon-128.png'
      }
    },
    options_ui: {
      page: 'manager/manager.html',
      open_in_tab: true
    },
    content_scripts: [
      {
        matches: ['http://*/*', 'https://*/*'],
        js: [
          'shared/storage.js',
          'content/field-identifier.js',
          'content/filler.js',
          'content/selector.js',
          'content/content.js'
        ],
        css: ['content/selector.css'],
        run_at: 'document_idle'
      }
    ]
  };

  if (isChromium) {
    // Configuração para Chromium (Chrome, Edge, Brave, Opera, Vivaldi)
    manifest.background = {
      service_worker: 'background/background.js'
    };
  } else {
    // Configuração para Mozilla Firefox e Floorp
    manifest.background = {
      scripts: ['shared/storage.js', 'background/background.js']
    };
    manifest.browser_specific_settings = {
      gecko: {
        id: 'fillbox@local.extension',
        strict_min_version: '109.0'
      }
    };
  }

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  // 2. Shared Storage (completíssimo com datas brasileiras dd/mm/aaaa)
  const sharedStorageCode = `/**
 * Fillbox — Módulo Compartilhado de Armazenamento e Modelo de Dados
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FillboxStorage = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const STORAGE_KEY = 'fillbox_data_v1';
  const CURRENT_SCHEMA_VERSION = 1;

  function formatDateBR(date = new Date()) {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return day + '/' + month + '/' + d.getFullYear();
  }

  function generateId(prefix = 'id') {
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
  }

  function getDefaultState() {
    return {
      version: CURRENT_SCHEMA_VERSION,
      createdAt: formatDateBR(),
      updatedAt: formatDateBR(),
      folders: [
        {
          id: 'folder_default',
          name: 'Respostas Frequentes',
          createdAt: formatDateBR(),
          fills: [
            { id: 'fill_1', name: 'Saudação Padrão', fill: 'Olá! Agradeço pelo contato e estou à disposição para ajudar.', createdAt: formatDateBR() },
            { id: 'fill_2', name: 'Assinatura Comercial', fill: 'Atenciosamente,\\nEquipe Fillbox', createdAt: formatDateBR() }
          ]
        },
        {
          id: 'folder_dev',
          name: 'Dev & Suporte Técnico',
          createdAt: formatDateBR(),
          fills: [
            { id: 'fill_3', name: 'Template de Bug', fill: 'Passos para reproduzir:\\n1. Acessar tela\\n2. Clicar no botão\\nResultado obtido:', createdAt: formatDateBR() }
          ]
        }
      ],
      bindings: []
    };
  }

  const storageAdapter = {
    async get(key) {
      if (typeof browser !== 'undefined' && browser.storage?.local) {
        const res = await browser.storage.local.get(key);
        return res[key];
      }
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        return new Promise(r => chrome.storage.local.get([key], res => r(res ? res[key] : null)));
      }
      const item = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
      return item ? JSON.parse(item) : null;
    },
    async set(key, value) {
      if (typeof browser !== 'undefined' && browser.storage?.local) return browser.storage.local.set({ [key]: value });
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        return new Promise((r, j) => chrome.storage.local.set({ [key]: value }, () => chrome.runtime.lastError ? j(chrome.runtime.lastError) : r()));
      }
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(value));
    }
  };

  class FillboxStore {
    async load() {
      try {
        const data = await storageAdapter.get(STORAGE_KEY);
        if (!data || !data.version) {
          const fresh = getDefaultState();
          await this.save(fresh);
          return fresh;
        }
        return data;
      } catch (e) {
        return getDefaultState();
      }
    }
    async save(data) {
      data.updatedAt = formatDateBR();
      await storageAdapter.set(STORAGE_KEY, data);
      return data;
    }
    async getFolders() { return (await this.load()).folders || []; }
    async getFolder(id) { return (await this.getFolders()).find(f => f.id === id) || null; }
    async getBindings() { return (await this.load()).bindings || []; }
    async createFolder(name) {
      const clean = (name || '').trim();
      if (!clean) throw new Error('Nome da pasta não pode ser vazio');
      const state = await this.load();
      const folder = { id: generateId('folder'), name: clean, createdAt: formatDateBR(), fills: [] };
      state.folders.push(folder);
      await this.save(state);
      return folder;
    }
    async renameFolder(id, newName) {
      const clean = (newName || '').trim();
      if (!clean) throw new Error('Nome da pasta não pode ser vazio');
      const state = await this.load();
      const f = state.folders.find(x => x.id === id);
      if (!f) throw new Error('Pasta não encontrada');
      f.name = clean;
      await this.save(state);
      return f;
    }
    async deleteFolder(id) {
      const state = await this.load();
      state.folders = state.folders.filter(f => f.id !== id);
      const prevB = state.bindings.length;
      state.bindings = state.bindings.filter(b => b.folderId !== id);
      await this.save(state);
      return { success: true, removedBindings: prevB - state.bindings.length };
    }
    async createFill(folderId, name, fill) {
      const cleanName = (name || '').trim();
      if (!cleanName) throw new Error('Nome do Fill é obrigatório');
      const state = await this.load();
      const folder = state.folders.find(f => f.id === folderId);
      if (!folder) throw new Error('Pasta não encontrada');
      const item = { id: generateId('fill'), name: cleanName, fill: fill || '', createdAt: formatDateBR() };
      folder.fills.push(item);
      await this.save(state);
      return item;
    }
    async updateFill(folderId, fillId, name, fill) {
      const cleanName = (name || '').trim();
      if (!cleanName) throw new Error('Nome do Fill é obrigatório');
      const state = await this.load();
      const folder = state.folders.find(f => f.id === folderId);
      if (!folder) throw new Error('Pasta não encontrada');
      const item = folder.fills.find(i => i.id === fillId);
      if (!item) throw new Error('Fill não encontrado');
      item.name = cleanName;
      item.fill = fill || '';
      item.updatedAt = formatDateBR();
      await this.save(state);
      return item;
    }
    async deleteFill(folderId, fillId) {
      const state = await this.load();
      const folder = state.folders.find(f => f.id === folderId);
      if (folder) folder.fills = folder.fills.filter(i => i.id !== fillId);
      await this.save(state);
      return { success: true };
    }
    async bindField(bindingData) {
      const { folderId, origin, path, fieldSignature } = bindingData;
      const state = await this.load();
      state.bindings = state.bindings.filter(b => !(b.origin === origin && b.path === path && b.fieldSignature?.id === fieldSignature?.id));
      const newB = { id: generateId('bind'), folderId, origin, path, fieldSignature, createdAt: formatDateBR() };
      state.bindings.push(newB);
      await this.save(state);
      return newB;
    }
    async removeBinding(id) {
      const state = await this.load();
      state.bindings = state.bindings.filter(b => b.id !== id);
      await this.save(state);
      return { success: true };
    }
    async findBindingForField(origin, path, sig) {
      const state = await this.load();
      for (const b of state.bindings) {
        if (b.origin === origin && b.path === path) {
          if (b.fieldSignature?.id && sig.id && b.fieldSignature.id === sig.id) {
            const folder = state.folders.find(f => f.id === b.folderId);
            if (folder) return { binding: b, folder };
          }
          if (b.fieldSignature?.name && sig.name && b.fieldSignature.name === sig.name) {
            const folder = state.folders.find(f => f.id === b.folderId);
            if (folder) return { binding: b, folder };
          }
        }
      }
      return null;
    }
    async exportJSON() {
      const state = await this.load();
      return JSON.stringify({ app: 'Fillbox', version: CURRENT_SCHEMA_VERSION, exportedAt: formatDateBR(), folders: state.folders, bindings: state.bindings }, null, 2);
    }
    async importJSON(jsonStr) {
      const parsed = JSON.parse(jsonStr);
      if (!parsed || !Array.isArray(parsed.folders)) throw new Error('Arquivo JSON inválido.');
      const newState = { version: CURRENT_SCHEMA_VERSION, createdAt: formatDateBR(), updatedAt: formatDateBR(), folders: parsed.folders, bindings: parsed.bindings || [] };
      await this.save(newState);
      return newState;
    }
  }

  return { formatDateBR, generateId, getDefaultState, store: new FillboxStore() };
});
`;
  zip.file('shared/storage.js', sharedStorageCode);

  // 3. Background Script (compatível com Service Worker e Event Page)
  const bgCode = `/**
 * Fillbox — Background Script
 */
if (typeof importScripts === 'function') {
  try { importScripts('../shared/storage.js'); } catch (e) {}
}

const ext = typeof chrome !== 'undefined' ? chrome : (typeof browser !== 'undefined' ? browser : null);

function setupContextMenu() {
  if (!ext || !ext.contextMenus) return;
  ext.contextMenus.removeAll(() => {
    ext.contextMenus.create({ id: 'fillbox-root', title: 'Fillbox', contexts: ['editable', 'selection', 'page'] });
    ext.contextMenus.create({ id: 'fillbox-bind-field', parentId: 'fillbox-root', title: '🔗 Vincular pasta a este campo', contexts: ['editable'] });
    ext.contextMenus.create({ id: 'fillbox-sep-1', parentId: 'fillbox-root', type: 'separator', contexts: ['editable', 'selection', 'page'] });
    ext.contextMenus.create({ id: 'fillbox-add-folder', parentId: 'fillbox-root', title: '📁➕ Nova Pasta...', contexts: ['editable', 'page', 'selection'] });
    ext.contextMenus.create({ id: 'fillbox-add-fill', parentId: 'fillbox-root', title: '🏷️➕ Novo Fill...', contexts: ['editable', 'selection'] });
    ext.contextMenus.create({ id: 'fillbox-sep-2', parentId: 'fillbox-root', type: 'separator', contexts: ['editable', 'selection', 'page'] });
    ext.contextMenus.create({ id: 'fillbox-delete-item', parentId: 'fillbox-root', title: '🗑️ Excluir Pasta ou Fill...', contexts: ['editable', 'page', 'selection'] });
    ext.contextMenus.create({ id: 'fillbox-open-manager', parentId: 'fillbox-root', title: '⚙ Abrir Gerenciador Fillbox', contexts: ['all'] });
  });
}

if (ext && ext.runtime) {
  ext.runtime.onInstalled.addListener(() => setupContextMenu());
  if (ext.runtime.onStartup) ext.runtime.onStartup.addListener(() => setupContextMenu());
}

if (ext && ext.contextMenus) {
  ext.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab || !tab.id) return;
    if (info.menuItemId === 'fillbox-open-manager') {
      if (ext.runtime.openOptionsPage) ext.runtime.openOptionsPage();
      else ext.tabs.create({ url: ext.runtime.getURL('manager/manager.html') });
      return;
    }
    let action = 'OPEN_BIND_DIALOG';
    if (info.menuItemId === 'fillbox-add-folder') action = 'OPEN_ADD_FOLDER_DIALOG';
    else if (info.menuItemId === 'fillbox-add-fill') action = 'OPEN_ADD_FILL_DIALOG';
    else if (info.menuItemId === 'fillbox-delete-item') action = 'OPEN_DELETE_DIALOG';

    ext.tabs.sendMessage(tab.id, { action, selectedText: info.selectionText || '' });
  });
}
`;
  zip.file('background/background.js', bgCode);

  // 4. Content Field Identifier
  const fieldIdCode = `(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FieldIdentifier = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function normalizeUrl(urlStr) {
    try {
      const p = new URL(urlStr || window.location.href);
      return { origin: p.origin, path: p.pathname.replace(/\\/+$/, '') || '/' };
    } catch {
      return { origin: window.location.origin, path: window.location.pathname || '/' };
    }
  }
  function isFieldSupported(el) {
    if (!el || !(el instanceof Element)) return false;
    if (el.tagName === 'INPUT' && el.type && el.type.toLowerCase() === 'password') return false;
    if (el.tagName === 'INPUT') return ['text','search','email','url','tel','number'].includes((el.type || 'text').toLowerCase());
    return el.tagName === 'TEXTAREA' || el.isContentEditable;
  }
  function createFieldSignature(el) {
    if (!isFieldSupported(el)) return null;
    const doc = el.ownerDocument || document;
    const sig = {
      tagName: el.tagName.toLowerCase(),
      type: el.getAttribute('type') || (el.tagName === 'TEXTAREA' ? 'textarea' : 'text'),
      id: el.id || null,
      name: el.getAttribute('name') || null,
      labelText: el.getAttribute('aria-label') || el.getAttribute('placeholder') || '',
      strategy: el.id ? 'unique_id' : (el.getAttribute('name') ? 'form_scoped_name' : 'attribute_match')
    };
    return sig;
  }
  return { normalizeUrl, isFieldSupported, createFieldSignature };
});`;
  zip.file('content/field-identifier.js', fieldIdCode);

  // 5. Content Filler
  const fillerCode = `(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FillboxFiller = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function insertTextIntoElement(el, text) {
    if (!el || el.disabled || el.readOnly) return { success: false };
    el.focus();
    if (el.isContentEditable) {
      document.execCommand('insertText', false, text);
      el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      return { success: true };
    }
    const proto = el.tagName === 'INPUT' ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, text);
    else el.value = text;
    el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    return { success: true };
  }
  return { insertTextIntoElement };
});`;
  zip.file('content/filler.js', fillerCode);

  // 6. Selector CSS & JS
  const selectorCssCode = `#fillbox-floating-container { all: initial; position: absolute; z-index: 2147483647; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px; line-height: 1.4; color: #e4e4e7; }
#fillbox-floating-container * { box-sizing: border-box; font-family: inherit; }
.fillbox-card { background: #18181b; border: 1px solid #3f3f46; border-radius: 8px; width: 320px; box-shadow: 0 12px 30px rgba(0,0,0,0.7); overflow: hidden; display: flex; flex-direction: column; }
.fillbox-header { padding: 8px 10px; background: #27272a; border-bottom: 1px solid #3f3f46; display: flex; justify-content: space-between; align-items: center; }
.fillbox-badge { font-size: 11px; font-weight: 600; color: #f59e0b; display: flex; align-items: center; gap: 4px; }
.fillbox-search-input { width: 100%; background: #27272a; border: 1px solid #3f3f46; border-radius: 6px; color: #fff; font-size: 12px; padding: 6px 8px; outline: none; }
.fillbox-search-input:focus { border-color: #f59e0b; }
.fillbox-list { list-style: none; margin: 0; padding: 4px; max-height: 220px; overflow-y: auto; }
.fillbox-item { padding: 6px 8px; border-radius: 5px; cursor: pointer; display: flex; flex-direction: column; gap: 2px; }
.fillbox-item:hover, .fillbox-item.is-selected { background: rgba(245, 158, 11, 0.16); border-left: 2px solid #f59e0b; }
.fillbox-item-name { font-weight: 600; font-size: 12px; color: #fff; }
.fillbox-item-preview { font-size: 11px; color: #a1a1aa; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: monospace; }
.fillbox-footer { padding: 6px 10px; background: #121215; border-top: 1px solid #27272a; display: flex; justify-content: space-between; font-size: 10px; color: #71717a; }
.fillbox-kbd { background: #27272a; border: 1px solid #3f3f46; border-radius: 3px; padding: 1px 3px; color: #d4d4d8; font-family: monospace; }
`;
  zip.file('content/selector.css', selectorCssCode);

  const selectorJsCode = `(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FillboxSelector = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function normalizeSearchText(t) {
    return (t || '').toString().toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
  }
  class ContextualSelector {
    constructor() {
      this.container = null;
      this.activeElement = null;
      this.filteredFills = [];
      this.selectedIndex = 0;
      this.isOpen = false;
    }
    open(el, folder, onSelect) {
      this.close();
      this.activeElement = el;
      this.folder = folder;
      this.fills = folder.fills || [];
      this.filteredFills = [...this.fills];
      this.selectedIndex = 0;
      this.onSelect = onSelect;
      this.isOpen = true;
      this.render();
      this.position();
    }
    close() {
      if (!this.isOpen) return;
      if (this.container) this.container.remove();
      this.container = null;
      this.isOpen = false;
    }
    position() {
      if (!this.container || !this.activeElement) return;
      const rect = this.activeElement.getBoundingClientRect();
      const sx = window.pageXOffset || document.documentElement.scrollLeft;
      const sy = window.pageYOffset || document.documentElement.scrollTop;
      const cardH = 240;
      const spaceBelow = window.innerHeight - rect.bottom;
      let top = (spaceBelow >= cardH || spaceBelow >= rect.top) ? rect.bottom + sy + 6 : Math.max(10, rect.top + sy - cardH - 6);
      let left = Math.min(rect.left + sx, window.innerWidth - 330);
      this.container.style.left = Math.round(left) + 'px';
      this.container.style.top = Math.round(top) + 'px';
    }
    render() {
      const div = document.createElement('div');
      div.id = 'fillbox-floating-container';
      div.innerHTML = \`
        <div class="fillbox-card">
          <div class="fillbox-header">
            <div class="fillbox-badge">⚡ Fillbox › \${this.folder.name}</div>
            <button type="button" class="close-btn" style="background:none;border:none;color:#aaa;cursor:pointer;">✕</button>
          </div>
          <div style="padding:8px 10px; background:#18181b; border-bottom:1px solid #27272a;">
            <input type="text" class="fillbox-search-input" placeholder="Buscar Fills... (↑/↓ navega, Enter insere)" />
          </div>
          <ul class="fillbox-list"></ul>
          <div class="fillbox-footer">
            <span><span class="fillbox-kbd">↑</span> <span class="fillbox-kbd">↓</span> navegar</span>
            <span><span class="fillbox-kbd">Enter</span> inserir</span>
            <span><span class="fillbox-kbd">Esc</span> fechar</span>
          </div>
        </div>\`;
      document.body.appendChild(div);
      this.container = div;
      const input = div.querySelector('.fillbox-search-input');
      setTimeout(() => input?.focus(), 10);
      div.querySelector('.close-btn').addEventListener('click', () => this.close());
      input.addEventListener('input', (e) => {
        const q = normalizeSearchText(e.target.value);
        this.filteredFills = this.fills.filter(f => normalizeSearchText(f.name).includes(q) || normalizeSearchText(f.fill).includes(q));
        this.selectedIndex = 0;
        this.renderList();
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.preventDefault(); this.close(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); if (this.filteredFills.length) { this.selectedIndex = (this.selectedIndex + 1) % this.filteredFills.length; this.renderList(); } }
        else if (e.key === 'ArrowUp') { e.preventDefault(); if (this.filteredFills.length) { this.selectedIndex = (this.selectedIndex - 1 + this.filteredFills.length) % this.filteredFills.length; this.renderList(); } }
        else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (this.filteredFills[this.selectedIndex]) { this.onSelect(this.filteredFills[this.selectedIndex]); this.close(); } }
      });
      document.addEventListener('mousedown', (e) => {
        if (this.isOpen && this.container && !this.container.contains(e.target) && e.target !== this.activeElement) this.close();
      }, true);
      this.renderList();
    }
    renderList() {
      const list = this.container.querySelector('.fillbox-list');
      if (!list) return;
      if (!this.filteredFills.length) { list.innerHTML = '<li style="padding:16px;text-align:center;color:#888;font-size:12px;">Nenhum Fill disponível.</li>'; return; }
      list.innerHTML = this.filteredFills.map((f, i) => \`
        <li class="fillbox-item \${i === this.selectedIndex ? 'is-selected' : ''}" data-idx="\${i}">
          <div class="fillbox-item-name">\${f.name}</div>
          <div class="fillbox-item-preview">\${f.fill}</div>
        </li>\`).join('');
      list.querySelectorAll('.fillbox-item').forEach(el => {
        el.addEventListener('mousedown', (e) => {
          e.preventDefault();
          const idx = parseInt(el.getAttribute('data-idx'));
          this.onSelect(this.filteredFills[idx]);
          this.close();
        });
      });
    }
  }
  return { selectorInstance: new ContextualSelector() };
});`;
  zip.file('content/selector.js', selectorJsCode);

  // 7. Content Script Principal (com clique direito e checagem de espaço vazio)
  const contentJsCode = `(function () {
  'use strict';
  let lastTarget = null;
  const store = window.FillboxStorage?.store;
  const selector = window.FillboxSelector?.selectorInstance;
  const identifier = window.FieldIdentifier;
  const filler = window.FillboxFiller;

  document.addEventListener('contextmenu', (e) => {
    if (identifier?.isFieldSupported(e.target)) lastTarget = e.target;
  }, true);

  // Abre seletor flutuante APENAS se o campo estiver vazio
  document.addEventListener('click', async (e) => {
    const target = e.target;
    if (!target || !identifier?.isFieldSupported(target)) return;
    if (e.target.closest('#fillbox-floating-container') || e.target.closest('#fillbox-modal')) return;

    const val = (target.isContentEditable ? target.textContent : target.value) || '';
    if (val.trim().length > 0) return; // Só abre em espaços vazios

    const sig = identifier.createFieldSignature(target);
    const norm = identifier.normalizeUrl();
    const found = await store.findBindingForField(norm.origin, norm.path, sig);
    if (found?.folder) {
      selector.open(target, found.folder, (fill) => filler.insertTextIntoElement(target, fill.fill));
    }
  }, false);

  const ext = typeof chrome !== 'undefined' ? chrome : (typeof browser !== 'undefined' ? browser : null);
  if (ext?.runtime?.onMessage) {
    ext.runtime.onMessage.addListener((msg) => {
      const target = lastTarget || document.activeElement;
      if (msg.action === 'OPEN_BIND_DIALOG') openBindModal(target);
      else if (msg.action === 'OPEN_ADD_FOLDER_DIALOG') openAddFolderModal();
      else if (msg.action === 'OPEN_ADD_FILL_DIALOG') openAddFillModal(msg.selectedText || '');
      else if (msg.action === 'OPEN_DELETE_DIALOG') openDeleteModal();
    });
  }

  async function openBindModal(target) {
    if (!target || !identifier?.isFieldSupported(target)) return alert('Campo não editável ou protegido.');
    const sig = identifier.createFieldSignature(target);
    const norm = identifier.normalizeUrl();
    const folders = await store.getFolders();
    const name = prompt('Vincular a qual pasta?\\n' + folders.map((f, i) => (i + 1) + '. ' + f.name).join('\\n') + '\\nDigite o número:');
    const idx = parseInt(name) - 1;
    if (folders[idx]) {
      await store.bindField({ folderId: folders[idx].id, origin: norm.origin, path: norm.path, fieldSignature: sig });
      alert('Campo vinculado com sucesso à pasta: ' + folders[idx].name);
    }
  }

  async function openAddFolderModal() {
    const name = prompt('Nome da nova pasta:');
    if (name && name.trim()) {
      await store.createFolder(name.trim());
      alert('Pasta "' + name.trim() + '" criada com sucesso!');
    }
  }

  async function openAddFillModal(prefill) {
    const folders = await store.getFolders();
    if (!folders.length) return alert('Crie uma pasta antes de adicionar Fills.');
    const folderIdx = parseInt(prompt('Escolha a pasta:\\n' + folders.map((f, i) => (i + 1) + '. ' + f.name).join('\\n') + '\\nNúmero:')) - 1;
    if (!folders[folderIdx]) return;
    const name = prompt('Nome do Fill:');
    if (!name) return;
    const content = prompt('Conteúdo do Fill:', prefill);
    await store.createFill(folders[folderIdx].id, name, content || '');
    alert('Fill "' + name + '" salvo na pasta ' + folders[folderIdx].name);
  }

  async function openDeleteModal() {
    const folders = await store.getFolders();
    if (!folders.length) return alert('Nenhuma pasta para excluir.');
    const idx = parseInt(prompt('Excluir qual pasta?\\n' + folders.map((f, i) => (i + 1) + '. ' + f.name + ' (' + (f.fills?.length||0) + ' fills)').join('\\n') + '\\nNúmero:')) - 1;
    if (folders[idx] && confirm('Tem certeza que deseja excluir a pasta "' + folders[idx].name + '"?')) {
      await store.deleteFolder(folders[idx].id);
      alert('Pasta excluída com sucesso.');
    }
  }
})();`;
  zip.file('content/content.js', contentJsCode);

  // 8. Popup HTML, JS, CSS
  const popupHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Fillbox</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="popup-container">
    <header class="header">
      <div class="brand">
        <span class="logo-icon">⚡</span>
        <h1 class="logo-title">Fillbox</h1>
      </div>
      <button id="open-manager-btn" class="icon-btn">⚙ Gerenciar</button>
    </header>
    <div class="stats-bar">
      <div class="stat-pill"><span class="stat-num" id="folder-count">0</span><span class="stat-lbl">Pastas</span></div>
      <div class="stat-pill"><span class="stat-num" id="fill-count">0</span><span class="stat-lbl">Fills</span></div>
      <div class="stat-pill"><span class="stat-num" id="bind-count">0</span><span class="stat-lbl">Vínculos</span></div>
    </div>
    <div class="section-title">Pastas Disponíveis</div>
    <div id="folders-quick-list" class="folders-list"></div>
    <footer class="footer">
      <span class="footer-tip">Dica: Clique com botão direito em qualquer campo para vincular ou adicionar Fills.</span>
    </footer>
  </div>
  <script src="../shared/storage.js"></script>
  <script src="popup.js"></script>
</body>
</html>`;
  zip.file('popup/popup.html', popupHtml);

  const popupCss = `* { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, sans-serif; }
body { width: 310px; background: #121215; color: #e4e4e7; font-size: 13px; line-height: 1.4; }
.popup-container { padding: 12px; }
.header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #27272a; padding-bottom: 8px; margin-bottom: 10px; }
.brand { display: flex; align-items: center; gap: 6px; }
.logo-icon { color: #f59e0b; font-size: 16px; }
.logo-title { font-size: 15px; font-weight: 700; color: #fff; }
.icon-btn { background: #27272a; border: 1px solid #3f3f46; color: #fff; padding: 4px 8px; border-radius: 5px; font-size: 11px; cursor: pointer; }
.icon-btn:hover { background: #3f3f46; }
.stats-bar { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 12px; }
.stat-pill { background: #18181b; border: 1px solid #27272a; border-radius: 6px; padding: 6px; text-align: center; }
.stat-num { display: block; font-weight: 700; font-size: 15px; color: #f59e0b; }
.stat-lbl { font-size: 10px; color: #71717a; }
.section-title { font-size: 11px; font-weight: 600; color: #a1a1aa; text-transform: uppercase; margin-bottom: 6px; }
.folders-list { max-height: 160px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
.folder-row { display: flex; justify-content: space-between; padding: 6px 8px; background: #18181b; border: 1px solid #27272a; border-radius: 5px; font-size: 12px; }
.folder-count-badge { font-size: 10px; background: #27272a; color: #aaa; padding: 2px 6px; border-radius: 10px; }
.footer { border-top: 1px solid #27272a; padding-top: 8px; font-size: 10px; color: #71717a; }`;
  zip.file('popup/popup.css', popupCss);

  const popupJs = `document.addEventListener('DOMContentLoaded', async () => {
  const store = window.FillboxStorage.store;
  const ext = typeof chrome !== 'undefined' ? chrome : browser;
  document.getElementById('open-manager-btn').addEventListener('click', () => {
    if (ext?.runtime?.openOptionsPage) ext.runtime.openOptionsPage();
    else window.open(ext.runtime.getURL('manager/manager.html'));
  });
  const data = await store.load();
  const folders = data.folders || [];
  const bindings = data.bindings || [];
  const totalFills = folders.reduce((acc, f) => acc + (f.fills?.length || 0), 0);
  document.getElementById('folder-count').textContent = folders.length;
  document.getElementById('fill-count').textContent = totalFills;
  document.getElementById('bind-count').textContent = bindings.length;
  const listEl = document.getElementById('folders-quick-list');
  if (!folders.length) listEl.innerHTML = '<div style="color:#71717a;font-size:11px;padding:8px;text-align:center;">Nenhuma pasta cadastrada.</div>';
  else listEl.innerHTML = folders.map(f => '<div class="folder-row"><span>📁 ' + f.name + '</span><span class="folder-count-badge">' + (f.fills?.length || 0) + ' fills</span></div>').join('');
});`;
  zip.file('popup/popup.js', popupJs);

  // 9. Manager HTML, CSS, JS COMPLETO (Resolvendo o problema da tela em branco!)
  const managerHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fillbox — Gerenciador</title>
  <link rel="stylesheet" href="manager.css">
</head>
<body>
  <div class="manager-layout">
    <header class="topbar">
      <div class="topbar-brand">
        <span class="topbar-logo">⚡</span>
        <div>
          <h1 class="topbar-title">Fillbox</h1>
          <span class="topbar-sub">Gerenciador de Pastas e Fills</span>
        </div>
      </div>
      <div class="topbar-actions">
        <button id="export-btn" class="btn btn-secondary">↓ Exportar JSON</button>
        <label class="btn btn-secondary" style="cursor:pointer;">
          ↑ Importar JSON
          <input type="file" id="import-file" accept=".json" style="display:none;">
        </label>
      </div>
    </header>

    <div class="manager-main">
      <aside class="sidebar">
        <div class="sidebar-header">
          <h2>Pastas</h2>
          <button id="add-folder-btn" class="btn btn-primary btn-sm">+ Nova Pasta</button>
        </div>
        <div id="folders-container" class="folders-tree" title="Clique com o botão direito para opções"></div>
        <div class="sidebar-footer">
          <button id="view-bindings-btn" class="btn btn-ghost btn-sm" style="width:100%; text-align:left;">
            🔗 Vínculos de Páginas (<span id="total-bindings-count">0</span>)
          </button>
        </div>
      </aside>

      <main class="content-panel">
        <div class="panel-header">
          <div>
            <div class="folder-title-row">
              <h2 id="active-folder-name">Selecione uma pasta</h2>
              <button id="rename-folder-btn" class="btn-icon" title="Renomear Pasta">✏</button>
              <button id="delete-folder-btn" class="btn-icon text-danger" title="Excluir Pasta">🗑</button>
            </div>
            <p id="active-folder-info" class="text-muted"></p>
          </div>
          <div class="panel-header-actions">
            <input type="text" id="search-fills-input" class="search-box" placeholder="Buscar Fills por nome...">
            <button id="add-fill-btn" class="btn btn-primary">+ Novo Fill</button>
          </div>
        </div>
        <div id="fills-list" class="fills-grid" title="Clique com o botão direito para opções"></div>
      </main>
    </div>
  </div>

  <div id="modal-backdrop" class="modal-backdrop hidden">
    <div class="modal-card">
      <div class="modal-header">
        <h3 id="modal-title">Título</h3>
        <button id="modal-close-x" class="btn-icon">✕</button>
      </div>
      <div id="modal-body" class="modal-body"></div>
      <div class="modal-footer">
        <button id="modal-cancel-btn" class="btn btn-secondary">Cancelar</button>
        <button id="modal-confirm-btn" class="btn btn-primary">Confirmar</button>
      </div>
    </div>
  </div>

  <div id="context-menu" class="context-menu hidden"></div>
  <div id="toast-container" class="toast-container"></div>

  <script src="../shared/storage.js"></script>
  <script src="manager.js"></script>
</body>
</html>`;
  zip.file('manager/manager.html', managerHtml);

  const managerCss = `:root {
  --bg-main: #09090b; --bg-surface: #18181b; --bg-subtle: #27272a; --border-color: #3f3f46;
  --text-main: #f4f4f5; --text-muted: #a1a1aa; --color-primary: #f59e0b; --color-danger: #ef4444;
}
* { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
body { background: var(--bg-main); color: var(--text-main); font-size: 13px; height: 100vh; display: flex; flex-direction: column; }
.manager-layout { display: flex; flex-direction: column; height: 100%; }
.topbar { display: flex; justify-content: space-between; align-items: center; padding: 12px 24px; background: var(--bg-surface); border-bottom: 1px solid var(--border-color); }
.topbar-brand { display: flex; align-items: center; gap: 10px; }
.topbar-logo { font-size: 20px; color: var(--color-primary); }
.topbar-title { font-size: 16px; font-weight: 700; }
.topbar-sub { font-size: 11px; color: var(--text-muted); }
.topbar-actions { display: flex; gap: 10px; }
.manager-main { display: flex; flex: 1; overflow: hidden; }
.sidebar { width: 280px; background: #121215; border-right: 1px solid var(--border-color); display: flex; flex-direction: column; }
.sidebar-header { padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #27272a; }
.sidebar-header h2 { font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
.folders-tree { flex: 1; overflow-y: auto; padding: 10px 8px; display: flex; flex-direction: column; gap: 4px; }
.folder-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-radius: 6px; cursor: pointer; transition: 0.1s; }
.folder-item:hover { background: var(--bg-subtle); }
.folder-item.active { background: rgba(245, 158, 11, 0.15); border-left: 3px solid var(--color-primary); font-weight: 600; color: #f59e0b; }
.badge { background: #27272a; color: var(--text-muted); font-size: 10px; padding: 2px 6px; border-radius: 10px; }
.sidebar-footer { padding: 12px; border-top: 1px solid #27272a; }
.content-panel { flex: 1; display: flex; flex-direction: column; overflow-y: auto; padding: 24px 32px; }
.panel-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--border-color); }
.folder-title-row { display: flex; align-items: center; gap: 10px; }
.folder-title-row h2 { font-size: 18px; font-weight: 700; }
.text-muted { color: var(--text-muted); font-size: 11px; }
.panel-header-actions { display: flex; gap: 12px; align-items: center; }
.search-box { background: var(--bg-surface); border: 1px solid var(--border-color); color: #fff; padding: 6px 12px; border-radius: 6px; font-size: 12px; width: 220px; outline: none; }
.search-box:focus { border-color: var(--color-primary); }
.fills-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
.fill-card { background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.fill-card:hover { border-color: #52525b; }
.fill-card-title { font-size: 13px; font-weight: 600; display: flex; justify-content: space-between; align-items: center; }
.fill-card-body { background: #121215; border: 1px solid #27272a; border-radius: 6px; padding: 8px 10px; font-size: 11px; color: #d4d4d8; max-height: 90px; overflow-y: auto; white-space: pre-wrap; font-family: monospace; }
.fill-card-footer { display: flex; justify-content: space-between; font-size: 10px; color: var(--text-muted); }
.btn { display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; padding: 6px 12px; font-size: 12px; cursor: pointer; border: 1px solid transparent; font-weight: 500; }
.btn-primary { background: var(--color-primary); color: #121215; font-weight: 700; }
.btn-primary:hover { background: #d97706; }
.btn-secondary { background: var(--bg-surface); border-color: var(--border-color); color: #fff; }
.btn-secondary:hover { background: var(--bg-subtle); }
.btn-ghost { background: transparent; color: var(--text-muted); }
.btn-sm { padding: 4px 8px; font-size: 11px; }
.btn-icon { background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; border-radius: 4px; font-size: 13px; }
.btn-icon:hover { background: var(--bg-subtle); color: #fff; }
.text-danger { color: var(--color-danger); }
.modal-backdrop { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal-backdrop.hidden, .context-menu.hidden { display: none; }
.modal-card { background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 10px; width: 440px; max-width: 90vw; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.8); }
.modal-header { padding: 12px 16px; background: var(--bg-subtle); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; font-weight: 600; }
.modal-body { padding: 16px; }
.modal-footer { padding: 12px 16px; border-top: 1px solid #27272a; display: flex; justify-content: flex-end; gap: 10px; }
.form-group { margin-bottom: 12px; }
.form-group label { display: block; font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; }
.form-input, .form-textarea { width: 100%; background: #121215; border: 1px solid var(--border-color); border-radius: 6px; color: #fff; padding: 8px 10px; font-size: 12px; outline: none; }
.form-input:focus, .form-textarea:focus { border-color: var(--color-primary); }
.form-textarea { min-height: 80px; resize: vertical; font-family: inherit; }
.context-menu { position: fixed; z-index: 3000; background: #18181b; border: 1px solid #3f3f46; border-radius: 8px; box-shadow: 0 12px 30px rgba(0,0,0,0.8); padding: 4px; min-width: 190px; }
.context-menu-item { display: flex; align-items: center; gap: 8px; padding: 7px 10px; font-size: 12px; color: #f4f4f5; cursor: pointer; border-radius: 5px; }
.context-menu-item:hover { background: #27272a; }
.context-menu-item.danger { color: #ef4444; }
.context-menu-sep { height: 1px; background: #27272a; margin: 4px 0; }
.toast-container { position: fixed; bottom: 20px; right: 20px; display: flex; flex-direction: column; gap: 8px; z-index: 2000; }
.toast { background: var(--bg-surface); border: 1px solid var(--color-primary); padding: 10px 14px; border-radius: 6px; font-size: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }`;
  zip.file('manager/manager.css', managerCss);

  const managerJs = `document.addEventListener('DOMContentLoaded', async () => {
  const store = window.FillboxStorage.store;
  let activeFolderId = null;
  let currentSearchQuery = '';

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
    const input = modalBody.querySelector('input, textarea');
    if (input) setTimeout(() => input.focus(), 50);
  }
  function closeModal() { modalBackdrop.classList.add('hidden'); onModalConfirm = null; }
  modalCloseX.addEventListener('click', closeModal);
  modalCancelBtn.addEventListener('click', closeModal);
  modalConfirmBtn.addEventListener('click', async () => {
    if (onModalConfirm) { const res = await onModalConfirm(); if (res !== false) closeModal(); }
    else closeModal();
  });

  const contextMenuEl = document.getElementById('context-menu');
  function showContextMenu(x, y, items) {
    if (!contextMenuEl) return;
    contextMenuEl.innerHTML = items.map((it, idx) => it.separator ? '<div class="context-menu-sep"></div>' : '<div class="context-menu-item ' + (it.danger ? 'danger' : '') + '" data-idx="' + idx + '">' + it.label + '</div>').join('');
    contextMenuEl.style.left = Math.min(x, window.innerWidth - 200) + 'px';
    contextMenuEl.style.top = Math.min(y, window.innerHeight - 200) + 'px';
    contextMenuEl.classList.remove('hidden');
    contextMenuEl.querySelectorAll('.context-menu-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        hideContextMenu();
        items[parseInt(el.getAttribute('data-idx'))]?.action?.();
      });
    });
  }
  function hideContextMenu() { if (contextMenuEl) contextMenuEl.classList.add('hidden'); }
  document.addEventListener('click', hideContextMenu);

  function showToast(msg, isErr) {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = 'toast';
    t.style.borderColor = isErr ? '#ef4444' : '#f59e0b';
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  function normalize(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, ''); }

  async function refreshFolders() {
    const folders = await store.getFolders();
    const bindings = await store.getBindings();
    totalBindingsCount.textContent = bindings.length;
    if (!folders.length) {
      foldersContainer.innerHTML = '<div style="color:#71717a;padding:12px;font-size:11px;">Nenhuma pasta cadastrada.</div>';
      activeFolderId = null;
      renderActiveFolder();
      return;
    }
    if (!activeFolderId || !folders.some(f => f.id === activeFolderId)) activeFolderId = folders[0].id;
    foldersContainer.innerHTML = folders.map(f => \`
      <div class="folder-item \${f.id === activeFolderId ? 'active' : ''}" data-id="\${f.id}">
        <span>📁 \${f.name}</span>
        <span class="badge">\${(f.fills || []).length}</span>
      </div>\`).join('');

    foldersContainer.querySelectorAll('.folder-item').forEach(el => {
      const fid = el.getAttribute('data-id');
      const item = folders.find(x => x.id === fid);
      el.addEventListener('click', () => { activeFolderId = fid; refreshFolders(); renderActiveFolder(); });
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault(); e.stopPropagation(); activeFolderId = fid; refreshFolders();
        showContextMenu(e.clientX, e.clientY, [
          { label: '🏷️➕ Novo Fill nesta pasta', action: triggerAddFill },
          { label: '✏ Renomear Pasta', action: () => triggerRenameFolder(item) },
          { separator: true },
          { label: '🗑 Excluir Pasta', danger: true, action: () => triggerDeleteFolder(item) }
        ]);
      });
    });

    foldersContainer.addEventListener('contextmenu', (e) => {
      if (e.target === foldersContainer || e.target.classList.contains('folders-tree')) {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY, [{ label: '📁➕ Nova Pasta', action: triggerAddFolder }]);
      }
    });

    renderActiveFolder();
  }

  async function renderActiveFolder() {
    if (!activeFolderId) {
      activeFolderName.textContent = 'Nenhuma pasta selecionada';
      activeFolderInfo.textContent = '';
      renameFolderBtn.style.display = 'none';
      deleteFolderBtn.style.display = 'none';
      addFillBtn.style.display = 'none';
      fillsList.innerHTML = '<div style="color:#71717a;padding:20px;">Crie ou selecione uma pasta para gerenciar os Fills.</div>';
      return;
    }
    const folder = await store.getFolder(activeFolderId);
    if (!folder) return;
    activeFolderName.textContent = folder.name;
    activeFolderInfo.textContent = 'Criada em ' + (folder.createdAt || 'N/A') + ' • ' + (folder.fills || []).length + ' Fills';
    renameFolderBtn.style.display = 'inline-flex';
    deleteFolderBtn.style.display = 'inline-flex';
    addFillBtn.style.display = 'inline-flex';

    let fills = folder.fills || [];
    if (currentSearchQuery.trim()) {
      const q = normalize(currentSearchQuery);
      fills = fills.filter(f => normalize(f.name).includes(q) || normalize(f.fill).includes(q));
    }

    if (!fills.length) {
      fillsList.innerHTML = '<div style="grid-column:1/-1;padding:40px;text-align:center;color:#71717a;"><p>' + (folder.fills?.length ? 'Nenhum Fill corresponde à busca.' : 'Esta pasta ainda não possui nenhum Fill.') + '</p></div>';
      return;
    }

    fillsList.innerHTML = fills.map(f => \`
      <div class="fill-card" data-id="\${f.id}">
        <div class="fill-card-title">
          <span>🏷 \${f.name}</span>
          <div style="display:flex;gap:4px;">
            <button class="btn-icon edit-btn">✏</button>
            <button class="btn-icon text-danger del-btn">🗑</button>
          </div>
        </div>
        <div class="fill-card-body">\${f.fill}</div>
        <div class="fill-card-footer"><span>\${f.createdAt || ''}</span><span>\${f.fill.length} caracteres</span></div>
      </div>\`).join('');

    fillsList.querySelectorAll('.fill-card').forEach(card => {
      const fillId = card.getAttribute('data-id');
      const item = folder.fills.find(i => i.id === fillId);
      card.querySelector('.edit-btn').addEventListener('click', () => triggerEditFill(item));
      card.querySelector('.del-btn').addEventListener('click', () => triggerDeleteFill(item));
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault(); e.stopPropagation();
        showContextMenu(e.clientX, e.clientY, [
          { label: '✏ Editar Fill', action: () => triggerEditFill(item) },
          { label: '📋 Copiar Conteúdo', action: () => { navigator.clipboard.writeText(item.fill); showToast('Copiado!'); } },
          { separator: true },
          { label: '🗑 Excluir Fill', danger: true, action: () => triggerDeleteFill(item) }
        ]);
      });
    });

    fillsList.addEventListener('contextmenu', (e) => {
      if (!e.target.closest('.fill-card')) {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY, [
          { label: '🏷️➕ Novo Fill nesta pasta', action: triggerAddFill },
          { label: '📁➕ Nova Pasta', action: triggerAddFolder }
        ]);
      }
    });
  }

  function triggerAddFolder() {
    openModal('Nova Pasta', '<div class="form-group"><label>Nome da Pasta:</label><input id="folder-name-inp" class="form-input" placeholder="Ex: Clientes" /></div>', async () => {
      const v = document.getElementById('folder-name-inp').value.trim();
      if (!v) return showToast('Nome obrigatório', true);
      const f = await store.createFolder(v);
      activeFolderId = f.id;
      showToast('Pasta "' + f.name + '" criada.');
      await refreshFolders();
    });
  }
  addFolderBtn.addEventListener('click', triggerAddFolder);

  function triggerRenameFolder(f) {
    openModal('Renomear Pasta', '<div class="form-group"><label>Novo Nome:</label><input id="folder-rename-inp" class="form-input" value="' + (f.name||'') + '" /></div>', async () => {
      const v = document.getElementById('folder-rename-inp').value.trim();
      if (!v) return showToast('Nome obrigatório', true);
      await store.renameFolder(f.id, v);
      showToast('Pasta renomeada.');
      await refreshFolders();
    });
  }
  renameFolderBtn.addEventListener('click', () => triggerRenameFolder(folders.find(x => x.id === activeFolderId)));

  function triggerDeleteFolder(f) {
    openModal('Excluir Pasta', '<p style="color:#ef4444;font-weight:600;margin-bottom:8px;">Atenção: Ação Irreversível</p><p style="color:#ccc;font-size:12px;">Excluir a pasta <strong>"' + f.name + '"</strong> apagará todos os seus Fills e desativará os vínculos desta pasta.</p>', async () => {
      await store.deleteFolder(f.id);
      showToast('Pasta excluída.');
      activeFolderId = null;
      await refreshFolders();
    }, 'Excluir Definitivamente');
  }
  deleteFolderBtn.addEventListener('click', () => triggerDeleteFolder(folders.find(x => x.id === activeFolderId)));

  function triggerAddFill() {
    if (!activeFolderId) return;
    openModal('Novo Fill', '<div class="form-group"><label>Nome do Fill:</label><input id="fill-name-inp" class="form-input" placeholder="Ex: Saudação" /></div><div class="form-group"><label>Texto do Fill:</label><textarea id="fill-content-inp" class="form-textarea" placeholder="Texto a ser preenchido..."></textarea></div>', async () => {
      const n = document.getElementById('fill-name-inp').value.trim();
      const c = document.getElementById('fill-content-inp').value;
      if (!n) return showToast('Nome obrigatório', true);
      await store.createFill(activeFolderId, n, c);
      showToast('Fill "' + n + '" criado.');
      await refreshFolders();
    });
  }
  addFillBtn.addEventListener('click', triggerAddFill);

  function triggerEditFill(item) {
    openModal('Editar Fill', '<div class="form-group"><label>Nome do Fill:</label><input id="fill-name-edit" class="form-input" value="' + item.name + '" /></div><div class="form-group"><label>Texto do Fill:</label><textarea id="fill-content-edit" class="form-textarea">' + item.fill + '</textarea></div>', async () => {
      const n = document.getElementById('fill-name-edit').value.trim();
      const c = document.getElementById('fill-content-edit').value;
      if (!n) return showToast('Nome obrigatório', true);
      await store.updateFill(activeFolderId, item.id, n, c);
      showToast('Fill atualizado.');
      await refreshFolders();
    });
  }

  function triggerDeleteFill(item) {
    if (confirm('Deseja excluir o Fill "' + item.name + '"?')) {
      store.deleteFill(activeFolderId, item.id).then(() => {
        showToast('Fill excluído.');
        refreshFolders();
      });
    }
  }

  searchInput.addEventListener('input', (e) => { currentSearchQuery = e.target.value; renderActiveFolder(); });

  viewBindingsBtn.addEventListener('click', async () => {
    const bindings = await store.getBindings();
    const folders = await store.getFolders();
    const rows = bindings.map(b => {
      const f = folders.find(x => x.id === b.folderId);
      return '<div style="background:#121215;padding:8px;border-radius:6px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;"><div><strong>📁 ' + (f?.name || 'Excluída') + '</strong><div style="font-size:10px;color:#aaa;">' + b.origin + b.path + '</div></div><button class="btn btn-secondary btn-sm" onclick="delBinding(\\'' + b.id + '\\')" style="color:#ef4444;">Remover</button></div>';
    }).join('') || '<p style="color:#888;text-align:center;">Nenhum campo vinculado.</p>';
    openModal('Vínculos Ativos', '<div style="max-height:260px;overflow-y:auto;">' + rows + '</div>', null, 'Fechar');
  });

  exportBtn.addEventListener('click', async () => {
    const json = await store.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fillbox_backup_' + window.FillboxStorage.formatDateBR().replace(/\\//g, '-') + '.json';
    a.click();
    showToast('Exportado com sucesso!');
  });

  importFile.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = async (evt) => {
      try {
        await store.importJSON(evt.target.result);
        showToast('Importado com sucesso!');
        await refreshFolders();
      } catch (err) { showToast(err.message, true); }
    };
    r.readAsText(f);
  });

  await refreshFolders();
});`;
  zip.file('manager/manager.js', managerJs);

  // 10. Ícones reais PNG em Base64
  const icon16 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAZElEQVR4nGP8z8BQDwAE/gP5/4EYB0j0H4kNE2P8j43Nhikg4n+sijFI0fwfkqMvGAqA/0RZhCwA438SBtG1mF3jF+j/f6Ji4gH+80024Q3A5D9M78Kwf8TFAm4W4Q2LhQhD1AIA39B+q1k06j0AAAAASUVORK5CYII=';
  zip.file('icons/icon-16.png', icon16, { base64: true });
  zip.file('icons/icon-48.png', icon16, { base64: true });
  zip.file('icons/icon-128.png', icon16, { base64: true });

  // 11. README
  zip.file(
    'README.md',
    `# Fillbox — Extensão de Autofill Minimalista (${target === 'chromium' ? 'Chromium / Chrome / Edge / Brave / Opera' : 'Firefox e Floorp'})

## Como Instalar:
${
  isChromium
    ? `1. Descompacte este arquivo ZIP em uma pasta.
2. No seu navegador (Chrome, Edge, Brave, Opera, Vivaldi), abra: chrome://extensions
3. Ative o "Modo do desenvolvedor" no canto superior direito.
4. Clique em "Carregar sem compactação" (Load unpacked) e selecione a pasta descompactada.
5. Pronto! A extensão estará ativa com o Gerenciador e suporte a clique direito.`
    : `1. No Firefox ou Floorp, abra: about:debugging#/runtime/this-firefox
2. Clique em "Carregar extensão temporária...".
3. Selecione o arquivo manifest.json dentro da pasta descompactada.
4. Pronto! O Gerenciador e o menu de contexto funcionarão imediatamente.`
}
`
  );

  return await zip.generateAsync({ type: 'blob' });
}
