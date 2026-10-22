import JSZip from 'jszip';

export async function generateExtensionZipBlob(): Promise<Blob> {
  const zip = new JSZip();

  // Manifest V3
  const manifestContent = JSON.stringify(
    {
      manifest_version: 3,
      name: 'Fillbox — Autofill Minimalista',
      version: '1.0.0',
      description: 'Ferramenta rápida e minimalista de preenchimento contextual de campos com textos reutilizáveis organizados em pastas.',
      icons: {
        '16': 'icons/icon-16.png',
        '48': 'icons/icon-48.png',
        '128': 'icons/icon-128.png'
      },
      permissions: ['storage', 'contextMenus', 'activeTab'],
      background: {
        scripts: ['shared/storage.js', 'background/background.js']
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
      browser_specific_settings: {
        gecko: {
          id: 'fillbox@local.extension',
          strict_min_version: '109.0'
        }
      }
    },
    null,
    2
  );

  zip.file('manifest.json', manifestContent);

  // Background
  const bgCode = `/**
 * Fillbox — Background Service Worker / Script
 */
const isFirefox = typeof browser !== 'undefined';
const ext = isFirefox ? browser : chrome;

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

ext.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'fillbox-bind-field' && tab && tab.id) {
    ext.tabs.sendMessage(tab.id, { action: 'OPEN_BIND_DIALOG' });
  }
});
`;
  zip.file('background/background.js', bgCode);

  // Content files
  const sharedStorageCode = `(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FillboxStorage = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const STORAGE_KEY = 'fillbox_data_v1';
  function formatDateBR(date = new Date()) {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return [String(d.getDate()).padStart(2, '0'), String(d.getMonth() + 1).padStart(2, '0'), d.getFullYear()].join('/');
  }
  function generateId(prefix = 'id') {
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
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
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    },
    async set(key, value) {
      if (typeof browser !== 'undefined' && browser.storage?.local) return browser.storage.local.set({ [key]: value });
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        return new Promise((r, j) => chrome.storage.local.set({ [key]: value }, () => chrome.runtime.lastError ? j(chrome.runtime.lastError) : r()));
      }
      localStorage.setItem(key, JSON.stringify(value));
    }
  };
  class FillboxStore {
    async load() {
      const data = await storageAdapter.get(STORAGE_KEY);
      if (!data) {
        const def = { version: 1, createdAt: formatDateBR(), folders: [{ id: 'f_default', name: 'Respostas Rápidas', fills: [{ id: 'fill_1', name: 'Saudação', fill: 'Olá! Como posso ajudar?' }] }], bindings: [] };
        await this.save(def);
        return def;
      }
      return data;
    }
    async save(data) {
      data.updatedAt = formatDateBR();
      await storageAdapter.set(STORAGE_KEY, data);
      return data;
    }
    async getFolders() { return (await this.load()).folders || []; }
    async getBindings() { return (await this.load()).bindings || []; }
    async createFolder(name) {
      const state = await this.load();
      const f = { id: generateId('folder'), name: name.trim(), createdAt: formatDateBR(), fills: [] };
      state.folders.push(f);
      await this.save(state);
      return f;
    }
    async deleteFolder(folderId) {
      const state = await this.load();
      state.folders = state.folders.filter(f => f.id !== folderId);
      state.bindings = state.bindings.filter(b => b.folderId !== folderId);
      await this.save(state);
      return { success: true };
    }
    async createFill(folderId, name, fill) {
      const state = await this.load();
      const f = state.folders.find(x => x.id === folderId);
      if (!f) throw new Error('Pasta não encontrada');
      const item = { id: generateId('fill'), name: name.trim(), fill, createdAt: formatDateBR() };
      f.fills.push(item);
      await this.save(state);
      return item;
    }
    async deleteFill(folderId, fillId) {
      const state = await this.load();
      const f = state.folders.find(x => x.id === folderId);
      if (f) f.fills = f.fills.filter(x => x.id !== fillId);
      await this.save(state);
    }
    async bindField(b) {
      const state = await this.load();
      state.bindings = state.bindings.filter(x => !(x.origin === b.origin && x.path === b.path && x.fieldSignature?.id === b.fieldSignature?.id));
      const newB = { id: generateId('bind'), ...b, createdAt: formatDateBR() };
      state.bindings.push(newB);
      await this.save(state);
      return newB;
    }
    async removeBinding(id) {
      const state = await this.load();
      state.bindings = state.bindings.filter(b => b.id !== id);
      await this.save(state);
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
  }
  return { formatDateBR, generateId, store: new FillboxStore() };
});`;
  zip.file('shared/storage.js', sharedStorageCode);

  // Field identifier
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
    if (el.tagName === 'INPUT' && el.type?.toLowerCase() === 'password') return false;
    if (el.tagName === 'INPUT') return ['text','search','email','url','tel','number'].includes((el.type || 'text').toLowerCase());
    return el.tagName === 'TEXTAREA' || el.isContentEditable;
  }
  function createFieldSignature(el) {
    if (!isFieldSupported(el)) return null;
    return {
      tagName: el.tagName.toLowerCase(),
      type: el.getAttribute('type') || (el.tagName === 'TEXTAREA' ? 'textarea' : 'text'),
      id: el.id || null,
      name: el.getAttribute('name') || null,
      strategy: el.id ? 'unique_id' : (el.name ? 'unique_name' : 'attribute_match')
    };
  }
  return { normalizeUrl, isFieldSupported, createFieldSignature };
});`;
  zip.file('content/field-identifier.js', fieldIdCode);

  // Filler
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
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return { success: true };
    }
    const proto = el.tagName === 'INPUT' ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, text);
    else el.value = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { success: true };
  }
  return { insertTextIntoElement };
});`;
  zip.file('content/filler.js', fillerCode);

  // Selector JS & CSS
  zip.file('content/selector.css', `#fillbox-floating-container { position: absolute; z-index: 2147483647; font-family: sans-serif; font-size: 13px; color: #f4f4f5; }
.fillbox-card { background: #18181b; border: 1px solid #3f3f46; border-radius: 8px; width: 320px; box-shadow: 0 10px 30px rgba(0,0,0,0.6); padding: 8px; }
.fillbox-search-input { width: 100%; background: #27272a; border: 1px solid #3f3f46; color: #fff; padding: 6px; border-radius: 4px; outline: none; margin-bottom: 6px; }
.fillbox-item { padding: 6px; border-radius: 4px; cursor: pointer; }
.fillbox-item.is-selected { background: rgba(245, 158, 11, 0.2); border-left: 2px solid #f59e0b; }
`);

  // Content script
  zip.file('content/content.js', `// Content script entry point: apenas em espaços vazios
document.addEventListener('click', async (e) => {
  const target = e.target;
  if (!window.FieldIdentifier?.isFieldSupported(target)) return;
  if (e.target.closest('#fillbox-floating-container') || e.target.closest('#fillbox-bind-modal')) return;

  // A interface de fills só aparece em espaços vazios (campo sem texto prévio)
  const val = (target.isContentEditable ? target.textContent : target.value) || '';
  if (val.trim().length > 0) return;

  const sig = window.FieldIdentifier.createFieldSignature(target);
  const norm = window.FieldIdentifier.normalizeUrl();
  const match = await window.FillboxStorage.store.findBindingForField(norm.origin, norm.path, sig);
  if (match) {
    window.FillboxSelector?.selectorInstance?.open(target, match.folder, (fillItem) => {
      window.FillboxFiller?.insertTextIntoElement(target, fillItem.fill);
    });
  }
});
`);

  // Popup & Manager
  zip.file('popup/popup.html', `<!DOCTYPE html><html><body style="width:280px;background:#18181b;color:#fff;padding:12px;font-family:sans-serif;"><h3>⚡ Fillbox</h3><p style="font-size:12px;color:#a1a1aa;">Autofill Minimalista Ativo</p></body></html>`);
  zip.file('manager/manager.html', `<!DOCTYPE html><html><head><title>Fillbox Gerenciador</title></head><body style="background:#121215;color:#fff;padding:24px;font-family:sans-serif;"><h2>Gerenciador de Pastas Fillbox</h2></body></html>`);

  // Icones base64
  const icon16 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAZElEQVR4nGP8z8BQDwAE/gP5/4EYB0j0H4kNE2P8j43Nhikg4n+sijFI0fwfkqMvGAqA/0RZhCwA438SBtG1mF3jF+j/f6Ji4gH+80024Q3A5D9M78Kwf8TFAm4W4Q2LhQhD1AIA39B+q1k06j0AAAAASUVORK5CYII=';
  zip.file('icons/icon-16.png', icon16, { base64: true });
  zip.file('icons/icon-48.png', icon16, { base64: true });
  zip.file('icons/icon-128.png', icon16, { base64: true });

  // README
  zip.file('README.md', `# Fillbox — Extensão de Autofill para Mozilla Firefox e Floorp\n\nCarregue em about:debugging#/runtime/this-firefox selecionando manifest.json.`);

  return await zip.generateAsync({ type: 'blob' });
}
