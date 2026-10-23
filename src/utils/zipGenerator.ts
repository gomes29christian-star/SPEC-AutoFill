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
      if (!sig) return null;
      const state = await this.load();
      for (const b of state.bindings) {
        if (b.origin === origin && b.path === path) {
          const bs = b.fieldSignature;
          if (bs?.id && sig.id && bs.id === sig.id) {
            const folder = state.folders.find(f => f.id === b.folderId);
            if (folder) return { binding: b, folder };
          }
          if (bs?.name && sig.name && bs.name === sig.name) {
            const folder = state.folders.find(f => f.id === b.folderId);
            if (folder) return { binding: b, folder };
          }
          if (bs?.selector && sig.selector && bs.selector === sig.selector) {
            const folder = state.folders.find(f => f.id === b.folderId);
            if (folder) return { binding: b, folder };
          }
          if (bs?.placeholder && sig.placeholder && bs.placeholder === sig.placeholder) {
            const folder = state.folders.find(f => f.id === b.folderId);
            if (folder) return { binding: b, folder };
          }
          if (bs?.ariaLabel && sig.ariaLabel && bs.ariaLabel === sig.ariaLabel) {
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
  const fieldIdCode = `/**
 * Fillbox — Identificador Robusto de Campos em Camadas
 * Prioriza atributos estáveis, suporte total a Shadow DOM / Web Components (YouTube, etc.),
 * evita seletores CSS frágeis e rejeita campos de senha
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FieldIdentifier = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function normalizeUrl(urlString) {
    try {
      const parsed = new URL(urlString || window.location.href);
      return {
        origin: parsed.origin,
        path: parsed.pathname.replace(/\\/+$/, '') || '/'
      };
    } catch (e) {
      return {
        origin: window.location.origin,
        path: window.location.pathname || '/'
      };
    }
  }

  function isFieldSupported(element) {
    if (!element || !(element instanceof Element)) return false;

    if (element.tagName === 'INPUT' && element.type && element.type.toLowerCase() === 'password') {
      return false;
    }

    if (element.tagName === 'INPUT') {
      const type = (element.type || 'text').toLowerCase();
      const unsupportedTypes = [
        'button',
        'submit',
        'reset',
        'checkbox',
        'radio',
        'file',
        'hidden',
        'image',
        'range',
        'color'
      ];
      return !unsupportedTypes.includes(type);
    }

    if (element.tagName === 'TEXTAREA') return true;

    if (element.isContentEditable) return true;
    const ce = element.getAttribute && element.getAttribute('contenteditable');
    if (ce === 'true' || ce === '') return true;
    if (element.getAttribute && element.getAttribute('role') === 'textbox') return true;

    return false;
  }

  function getDeepActiveElement(root = document) {
    let active = root.activeElement;
    while (active && active.shadowRoot && active.shadowRoot.activeElement) {
      active = active.shadowRoot.activeElement;
    }
    return active;
  }

  function resolveSupportedField(eventOrElement) {
    if (!eventOrElement) {
      const active = getDeepActiveElement();
      return (active && isFieldSupported(active)) ? active : null;
    }

    const candidates = [];

    if (eventOrElement.composedPath && typeof eventOrElement.composedPath === 'function') {
      try {
        const path = eventOrElement.composedPath();
        if (Array.isArray(path)) {
          for (let i = 0; i < path.length; i++) {
            if (path[i] instanceof Element) candidates.push(path[i]);
          }
        }
      } catch (e) {}
    }

    const directEl = eventOrElement instanceof Element
      ? eventOrElement
      : (eventOrElement.target instanceof Element ? eventOrElement.target : null);

    if (directEl && !candidates.includes(directEl)) {
      candidates.unshift(directEl);
    }

    for (const c of candidates) {
      if (isFieldSupported(c)) return c;
      const editableAncestor = c.closest && c.closest('input:not([type="password"]):not([type="hidden"]), textarea, [contenteditable="true"], [contenteditable=""], [role="textbox"]');
      if (editableAncestor && isFieldSupported(editableAncestor)) {
        return editableAncestor;
      }
    }

    for (const c of candidates) {
      try {
        const inner = c.querySelector && c.querySelector('input:not([type="password"]):not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, [contenteditable="true"], [contenteditable=""], [role="textbox"]');
        if (inner && isFieldSupported(inner)) return inner;
      } catch (e) {}

      if (c.shadowRoot) {
        try {
          const shadowInner = c.shadowRoot.querySelector('input:not([type="password"]):not([type="hidden"]), textarea, [contenteditable="true"], [contenteditable=""]');
          if (shadowInner && isFieldSupported(shadowInner)) return shadowInner;
        } catch (e) {}
      }

      if (c.parentElement) {
        try {
          const sibling = c.parentElement.querySelector('input:not([type="password"]):not([type="hidden"]), textarea, [contenteditable="true"]');
          if (sibling && isFieldSupported(sibling)) return sibling;
        } catch (e) {}
      }
    }

    const deepActive = getDeepActiveElement();
    if (deepActive && isFieldSupported(deepActive)) {
      return deepActive;
    }

    return null;
  }

  function isDynamicId(id) {
    if (!id || typeof id !== 'string') return true;
    const dynamicPatterns = [
      /^:r[0-9a-z]+:$/i,
      /^ember\\d+$/i,
      /^ext-gen\\d+$/i,
      /^yui_\\d+/i,
      /^a-\\d+$/i,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i,
      /^[a-z0-9_-]{24,}$/i
    ];
    return dynamicPatterns.some((pattern) => pattern.test(id.trim()));
  }

  function getAssociatedLabelText(element) {
    try {
      const parentLabel = element.closest && element.closest('label');
      if (parentLabel) {
        return (parentLabel.textContent || '').trim().replace(/\\s+/g, ' ').substring(0, 50);
      }
      if (element.id) {
        const doc = element.ownerDocument || document;
        const matchingLabel = doc.querySelector(\`label[for="\${CSS.escape(element.id)}"]\`);
        if (matchingLabel) {
          return (matchingLabel.textContent || '').trim().replace(/\\s+/g, ' ').substring(0, 50);
        }
      }
      return element.getAttribute('aria-label') || element.getAttribute('placeholder') || '';
    } catch (e) {
      return '';
    }
  }

  function createFieldSignature(element) {
    const field = resolveSupportedField(element);
    if (!field || !isFieldSupported(field)) {
      return null;
    }

    const doc = field.ownerDocument || document;
    const tagName = field.tagName.toLowerCase();
    const isContentEditable = field.isContentEditable || field.getAttribute('contenteditable') === 'true' || field.getAttribute('contenteditable') === '';
    const inputType = field.getAttribute('type') || (tagName === 'textarea' ? 'textarea' : (isContentEditable ? 'contenteditable' : 'text'));

    const signature = {
      tagName,
      type: inputType,
      strategy: 'unknown',
      id: null,
      name: null,
      formId: null,
      formName: null,
      labelText: getAssociatedLabelText(field),
      placeholder: field.getAttribute('placeholder') || null,
      ariaLabel: field.getAttribute('aria-label') || null,
      dataTestId: field.getAttribute('data-testid') || field.getAttribute('data-test') || null,
      autocomplete: field.getAttribute('autocomplete') || null,
      containerTag: null,
      selector: null
    };

    const form = field.closest && field.closest('form');
    if (form) {
      if (form.id && !isDynamicId(form.id)) signature.formId = form.id;
      if (form.getAttribute('name')) signature.formName = form.getAttribute('name');
    }

    const customContainer = field.closest && field.closest('ytd-searchbox, ytd-comments, ytd-commentbox, ytd-comment-simplebox-renderer, [role="search"], [role="form"]');
    if (customContainer) {
      signature.containerTag = customContainer.tagName.toLowerCase();
    }

    if (field.id && !isDynamicId(field.id)) {
      signature.id = field.id;
      try {
        const matches = doc.querySelectorAll(\`#\${CSS.escape(field.id)}\`);
        if (matches.length === 1) {
          signature.strategy = 'unique_id';
          return signature;
        } else if (matches.length > 1) {
          if (signature.containerTag) {
            signature.strategy = 'container_scoped_id';
            signature.selector = \`\${signature.containerTag} #\${CSS.escape(field.id)}\`;
            return signature;
          }
          if (signature.formId) {
            signature.strategy = 'form_scoped_id';
            signature.selector = \`#\${CSS.escape(signature.formId)} #\${CSS.escape(field.id)}\`;
            return signature;
          }
        }
      } catch (e) {}
    }

    if (signature.dataTestId) {
      try {
        const matches = doc.querySelectorAll(\`[data-testid="\${CSS.escape(signature.dataTestId)}"]\`);
        if (matches.length === 1) {
          signature.strategy = 'data_testid';
          return signature;
        }
      } catch (e) {}
    }

    const name = field.getAttribute('name');
    if (name) {
      signature.name = name;
      const formScope = form || doc;
      try {
        const matches = formScope.querySelectorAll(\`[name="\${CSS.escape(name)}"]\`);
        if (matches.length === 1) {
          signature.strategy = form ? 'form_scoped_name' : 'unique_name';
          return signature;
        }
      } catch (e) {}
    }

    if (signature.autocomplete && signature.autocomplete !== 'off' && signature.autocomplete !== 'on') {
      signature.strategy = 'semantic_autocomplete';
      return signature;
    }

    if (signature.placeholder) {
      try {
        const matches = doc.querySelectorAll(\`[placeholder="\${CSS.escape(signature.placeholder)}"]\`);
        if (matches.length === 1) {
          signature.strategy = 'unique_placeholder';
          return signature;
        }
      } catch (e) {}
    }

    if (signature.ariaLabel) {
      try {
        const matches = doc.querySelectorAll(\`[aria-label="\${CSS.escape(signature.ariaLabel)}"]\`);
        if (matches.length === 1) {
          signature.strategy = 'unique_aria_label';
          return signature;
        }
      } catch (e) {}
    }

    if (signature.containerTag) {
      signature.strategy = 'container_scoped';
      signature.selector = \`\${signature.containerTag} \${tagName}\`;
      return signature;
    }

    signature.strategy = 'fallback_selector';
    let sel = tagName;
    if (field.id) sel += \`#\${CSS.escape(field.id)}\`;
    if (signature.name) sel += \`[name="\${CSS.escape(signature.name)}"]\`;
    if (signature.placeholder) sel += \`[placeholder="\${CSS.escape(signature.placeholder)}"]\`;
    if (signature.ariaLabel) sel += \`[aria-label="\${CSS.escape(signature.ariaLabel)}"]\`;
    signature.selector = sel;

    return signature;
  }

  function querySelectorDeep(selector, rootNode = document) {
    if (!selector) return null;
    try {
      const match = rootNode.querySelector(selector);
      if (match) return match;
    } catch (e) {}

    try {
      const all = rootNode.querySelectorAll ? rootNode.querySelectorAll('*') : [];
      for (let i = 0; i < all.length; i++) {
        if (all[i].shadowRoot) {
          try {
            const shadowMatch = all[i].shadowRoot.querySelector(selector);
            if (shadowMatch) return shadowMatch;
          } catch (e) {}
        }
      }
    } catch (e) {}

    return null;
  }

  function resolveElementFromSignature(signature, rootNode = document) {
    if (!signature) return null;

    function pickVisible(elements) {
      if (!elements || elements.length === 0) return null;
      if (elements.length === 1) return isFieldSupported(elements[0]) ? elements[0] : null;
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (isFieldSupported(el)) {
          if (el.offsetParent !== null || (el.getClientRects && el.getClientRects().length > 0)) {
            return el;
          }
        }
      }
      return isFieldSupported(elements[0]) ? elements[0] : null;
    }

    if (signature.selector) {
      try {
        const match = querySelectorDeep(signature.selector, rootNode);
        if (match && isFieldSupported(match)) return match;
      } catch (e) {}
    }

    if (signature.id) {
      try {
        const matches = rootNode.querySelectorAll ? rootNode.querySelectorAll(\`#\${CSS.escape(signature.id)}\`) : [];
        const found = pickVisible(Array.from(matches));
        if (found) return found;
      } catch (e) {}
    }

    if (signature.dataTestId) {
      try {
        const matches = rootNode.querySelectorAll ? rootNode.querySelectorAll(\`[data-testid="\${CSS.escape(signature.dataTestId)}"]\`) : [];
        const found = pickVisible(Array.from(matches));
        if (found) return found;
      } catch (e) {}
    }

    if (signature.name) {
      try {
        if (signature.formId) {
          const form = rootNode.querySelector(\`#\${CSS.escape(signature.formId)}\`);
          if (form) {
            const matches = form.querySelectorAll(\`[name="\${CSS.escape(signature.name)}"]\`);
            const found = pickVisible(Array.from(matches));
            if (found) return found;
          }
        }
        const matches = rootNode.querySelectorAll ? rootNode.querySelectorAll(\`[name="\${CSS.escape(signature.name)}"]\`) : [];
        const found = pickVisible(Array.from(matches));
        if (found) return found;
      } catch (e) {}
    }

    if (signature.placeholder) {
      try {
        const matches = rootNode.querySelectorAll ? rootNode.querySelectorAll(\`[placeholder="\${CSS.escape(signature.placeholder)}"]\`) : [];
        const found = pickVisible(Array.from(matches));
        if (found) return found;
      } catch (e) {}
    }

    if (signature.ariaLabel) {
      try {
        const matches = rootNode.querySelectorAll ? rootNode.querySelectorAll(\`[aria-label="\${CSS.escape(signature.ariaLabel)}"]\`) : [];
        const found = pickVisible(Array.from(matches));
        if (found) return found;
      } catch (e) {}
    }

    return null;
  }

  return {
    normalizeUrl,
    isFieldSupported,
    resolveSupportedField,
    getDeepActiveElement,
    createFieldSignature,
    resolveElementFromSignature
  };
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

  // 7. Content Script Principal
  const contentJsCode = `(function () {
  'use strict';

  let lastContextTarget = null;
  const store = window.FillboxStorage ? window.FillboxStorage.store : null;
  const selector = window.FillboxSelector ? window.FillboxSelector.selectorInstance : null;
  const identifier = window.FieldIdentifier;
  const filler = window.FillboxFiller;

  document.addEventListener(
    'contextmenu',
    (e) => {
      const field = identifier && identifier.resolveSupportedField
        ? identifier.resolveSupportedField(e)
        : (identifier && identifier.isFieldSupported(e.target) ? e.target : null);
      if (field) {
        lastContextTarget = field;
      }
    },
    true
  );

  document.addEventListener(
    'click',
    async (e) => {
      if (e.target && (e.target.closest('#fillbox-floating-container') || e.target.closest('#fillbox-bind-modal'))) {
        return;
      }

      const target = identifier && identifier.resolveSupportedField
        ? identifier.resolveSupportedField(e)
        : e.target;

      if (!target || !identifier || !identifier.isFieldSupported(target)) {
        return;
      }

      const currentVal = (target.isContentEditable ? target.textContent : target.value) || '';
      if (currentVal.trim().length > 0) {
        return;
      }

      const signature = identifier.createFieldSignature(target);
      if (!signature) return;

      const norm = identifier.normalizeUrl(window.location.href);

      try {
        const found = await store.findBindingForField(norm.origin, norm.path, signature);
        if (found && found.folder) {
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

  async function handleOpenBindDialog(rawTarget) {
    const target = (identifier && identifier.resolveSupportedField ? identifier.resolveSupportedField(rawTarget) : rawTarget)
      || (identifier && identifier.getDeepActiveElement ? identifier.getDeepActiveElement() : null);

    if (!target || !identifier || !identifier.isFieldSupported(target)) {
      showToast('Fillbox: Clique com o botão direito diretamente sobre um campo de texto editável para vincular.', 'error');
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
    const oldModal = document.getElementById('fillbox-bind-modal');
    if (oldModal) oldModal.remove();

    const overlay = document.createElement('div');
    overlay.id = 'fillbox-bind-modal';
    overlay.style.cssText = \`
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
    \`;

    const folderOptions = folders.map((f) => {
      const isSelected = existing && existing.folder && existing.folder.id === f.id;
      return \`<option value="\${f.id}" \${isSelected ? 'selected' : ''}>📁 \${escapeHTML(f.name)} (\${(f.fills || []).length} Fills)</option>\`;
    }).join('');

    overlay.innerHTML = \`
      <div style="background:#18181b; border:1px solid #3f3f46; border-radius:10px; width:380px; max-width:92vw; box-shadow:0 20px 40px rgba(0,0,0,0.8); overflow:hidden;">
        <div style="padding:12px 16px; background:#27272a; border-bottom:1px solid #3f3f46; display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:#f59e0b; font-size:13px; display:flex; align-items:center; gap:6px;">
            <span>⚡ Vincular Pasta Fill</span>
          </strong>
          <button type="button" id="fillbox-modal-close" style="background:transparent; border:none; color:#a1a1aa; cursor:pointer; font-size:16px;">✕</button>
        </div>

        <div style="padding:16px;">
          <div style="font-size:11px; color:#a1a1aa; margin-bottom:12px; background:#27272a; padding:8px 10px; border-radius:6px; line-height:1.5;">
            <div><strong>Página:</strong> \${escapeHTML(norm.path)}</div>
            <div><strong>Estratégia:</strong> \${escapeHTML(signature.strategy)}</div>
            \${signature.name ? \`<div><strong>Nome do campo:</strong> \${escapeHTML(signature.name)}</div>\` : ''}
            \${signature.labelText ? \`<div><strong>Rótulo:</strong> \${escapeHTML(signature.labelText)}</div>\` : ''}
          </div>

          <label style="display:block; font-weight:600; margin-bottom:6px; color:#f4f4f5;">
            Selecione a Pasta para este campo:
          </label>
          <select id="fillbox-folder-select" style="width:100%; background:#27272a; border:1px solid #3f3f46; border-radius:6px; color:#f4f4f5; padding:8px; font-size:12px; outline:none; margin-bottom:16px;">
            \${folders.length === 0 ? '<option value="" disabled>Nenhuma pasta encontrada</option>' : folderOptions}
          </select>

          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <div>
              \${
                existing
                  ? \`<button type="button" id="fillbox-unbind-btn" style="background:#ef4444; color:#fff; border:none; padding:7px 12px; border-radius:6px; font-size:11px; cursor:pointer; font-weight:600;">Remover Vínculo</button>\`
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
    \`;

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

  async function handleOpenAddFolderDialog() {
    const old = document.getElementById('fillbox-action-modal');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'fillbox-action-modal';
    overlay.style.cssText = \`all:initial; position:fixed; inset:0; background:rgba(0,0,0,0.75); backdrop-filter:blur(2px); z-index:2147483647; display:flex; align-items:center; justify-content:center; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; font-size:13px; color:#e4e4e7;\`;

    overlay.innerHTML = \`
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
    \`;

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
        showToast(\`Pasta "\${val}" criada com sucesso!\`, 'success');
        close();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

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
    overlay.style.cssText = \`all:initial; position:fixed; inset:0; background:rgba(0,0,0,0.75); backdrop-filter:blur(2px); z-index:2147483647; display:flex; align-items:center; justify-content:center; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; font-size:13px; color:#e4e4e7;\`;

    const folderOpts = folders.map(f => \`<option value="\${f.id}">📁 \${escapeHTML(f.name)}</option>\`).join('');

    overlay.innerHTML = \`
      <div style="background:#18181b; border:1px solid #3f3f46; border-radius:10px; width:420px; max-width:92vw; box-shadow:0 20px 40px rgba(0,0,0,0.8); overflow:hidden;">
        <div style="padding:12px 16px; background:#27272a; border-bottom:1px solid #3f3f46; display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:#f59e0b; font-size:13px;">🏷️ Novo Fill (Texto Reutilizável)</strong>
          <button type="button" id="fillbox-action-close" style="background:transparent; border:none; color:#a1a1aa; cursor:pointer; font-size:16px;">✕</button>
        </div>
        <div style="padding:16px;">
          <label style="display:block; font-size:11px; font-weight:600; color:#a1a1aa; margin-bottom:4px;">Pasta de Destino:</label>
          <select id="fillbox-fill-folder-select" style="width:100%; box-sizing:border-box; background:#27272a; border:1px solid #3f3f46; border-radius:6px; color:#f4f4f5; padding:7px; font-size:12px; outline:none; margin-bottom:12px;">
            \${folderOpts}
          </select>

          <label style="display:block; font-size:11px; font-weight:600; color:#a1a1aa; margin-bottom:4px;">Nome do Fill:</label>
          <input type="text" id="fillbox-fill-name-input" placeholder="Ex: Assinatura, Saudação, Template" style="width:100%; box-sizing:border-box; background:#27272a; border:1px solid #3f3f46; border-radius:6px; color:#f4f4f5; padding:8px 10px; font-size:12px; outline:none; margin-bottom:12px;" />

          <label style="display:block; font-size:11px; font-weight:600; color:#a1a1aa; margin-bottom:4px;">Conteúdo do Fill:</label>
          <textarea id="fillbox-fill-content-input" rows="4" placeholder="Digite ou cole o texto..." style="width:100%; box-sizing:border-box; background:#27272a; border:1px solid #3f3f46; border-radius:6px; color:#f4f4f5; padding:8px 10px; font-size:12px; outline:none; margin-bottom:16px; font-family:monospace; resize:vertical;">\${escapeHTML(prefillContent)}</textarea>

          <div style="display:flex; justify-content:flex-end; gap:8px;">
            <button type="button" id="fillbox-action-cancel" style="background:#3f3f46; color:#d4d4d8; border:none; padding:7px 12px; border-radius:6px; font-size:11px; cursor:pointer;">Cancelar</button>
            <button type="button" id="fillbox-action-save" style="background:#f59e0b; color:#18181b; border:none; padding:7px 14px; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;">Salvar Fill</button>
          </div>
        </div>
      </div>
    \`;

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
        showToast(\`Fill "\${name}" salvo com sucesso!\`, 'success');
        close();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

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
    overlay.style.cssText = \`all:initial; position:fixed; inset:0; background:rgba(0,0,0,0.75); backdrop-filter:blur(2px); z-index:2147483647; display:flex; align-items:center; justify-content:center; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; font-size:13px; color:#e4e4e7;\`;

    let activeFolder = folders[0];

    function renderModalContent() {
      const folderOpts = folders.map(f => \`<option value="\${f.id}" \${f.id === activeFolder.id ? 'selected' : ''}>📁 \${escapeHTML(f.name)} (\${(f.fills || []).length} Fills)</option>\`).join('');
      const fillsList = (activeFolder.fills || []).map(item => \`
        <div style="background:#27272a; border:1px solid #3f3f46; border-radius:6px; padding:6px 10px; display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <div>
            <div style="font-weight:600; font-size:12px; color:#f4f4f5;">🏷️ \${escapeHTML(item.name)}</div>
            <div style="font-size:10px; color:#a1a1aa; font-family:monospace; max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">\${escapeHTML(item.fill)}</div>
          </div>
          <button type="button" class="del-fill-btn" data-fill-id="\${item.id}" style="background:#ef4444; color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:10px; cursor:pointer; font-weight:600;">Excluir</button>
        </div>
      \`).join('');

      overlay.innerHTML = \`
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
              \${folderOpts}
            </select>

            <label style="display:block; font-size:11px; font-weight:600; color:#a1a1aa; margin-bottom:6px;">Fills desta Pasta (\${(activeFolder.fills || []).length}):</label>
            <div style="max-height:180px; overflow-y:auto; margin-bottom:16px;">
              \${(activeFolder.fills || []).length === 0 ? '<div style="color:#71717a; font-size:11px; padding:10px; text-align:center;">Pasta sem Fills.</div>' : fillsList}
            </div>

            <div style="display:flex; justify-content:flex-end;">
              <button type="button" id="fillbox-action-done" style="background:#3f3f46; color:#d4d4d8; border:none; padding:7px 14px; border-radius:6px; font-size:11px; cursor:pointer;">Concluído</button>
            </div>
          </div>
        </div>
      \`;

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
        if (!confirm(\`Atenção: Excluir a pasta "\${activeFolder.name}" apagará todos os seus Fills e desativará os vínculos associados. Confirmar?\`)) return;
        await store.deleteFolder(activeFolder.id);
        showToast(\`Pasta "\${activeFolder.name}" excluída.\`, 'info');
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
    toast.style.cssText = \`
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #18181b;
      border: 1px solid \${color};
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
    \`;
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
  --text-main: #f4f4f5; --text-muted: #a1a1aa; --color-primary: #f59e0b; --color-primary-hover: #d97706; --color-danger: #ef4444;
}
* { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
body { background: var(--bg-main); color: var(--text-main); font-size: 13px; height: 100vh; display: flex; flex-direction: column; }
.manager-layout { display: flex; flex-direction: column; height: 100%; width: 100%; }
.topbar { display: flex; justify-content: space-between; align-items: center; padding: 12px 24px; background: var(--bg-surface); border-bottom: 1px solid var(--border-color); flex-wrap: wrap; gap: 12px; }
.topbar-brand { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.topbar-logo { font-size: 20px; color: var(--color-primary); flex-shrink: 0; }
.topbar-title { font-size: 16px; font-weight: 700; letter-spacing: -0.3px; }
.topbar-sub { font-size: 11px; color: var(--text-muted); }
.topbar-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.manager-main { display: flex; flex: 1; overflow: hidden; width: 100%; }
.sidebar { width: 280px; background: #121215; border-right: 1px solid var(--border-color); display: flex; flex-direction: column; flex-shrink: 0; }
.sidebar-header { padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #27272a; }
.sidebar-header h2 { font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
.folders-tree { flex: 1; overflow-y: auto; padding: 10px 8px; display: flex; flex-direction: column; gap: 4px; }
.folder-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-radius: 6px; cursor: pointer; transition: 0.12s; }
.folder-item:hover { background: var(--bg-subtle); }
.folder-item.active { background: rgba(245, 158, 11, 0.15); border-left: 3px solid var(--color-primary); font-weight: 600; color: #f59e0b; }
.badge { background: #27272a; color: var(--text-muted); font-size: 10px; padding: 2px 6px; border-radius: 10px; }
.sidebar-footer { padding: 12px; border-top: 1px solid #27272a; }
.content-panel { flex: 1; display: flex; flex-direction: column; overflow-y: auto; padding: 24px 32px; min-width: 0; }
.panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--border-color); flex-wrap: wrap; gap: 16px; }
.folder-title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.folder-title-row h2 { font-size: 18px; font-weight: 700; }
.text-muted { color: var(--text-muted); font-size: 11px; }
.panel-header-actions { display: flex; gap: 12px; align-items: center; flex-shrink: 0; }
.search-box { background: var(--bg-surface); border: 1px solid var(--border-color); color: #fff; padding: 7px 12px; border-radius: 6px; font-size: 12px; width: 240px; outline: none; flex-shrink: 0; }
.search-box:focus { border-color: var(--color-primary); }
.fills-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; width: 100%; }
.fill-card { background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.fill-card:hover { border-color: #52525b; }
.fill-card-title { font-size: 13px; font-weight: 600; display: flex; justify-content: space-between; align-items: center; }
.fill-card-body { background: #121215; border: 1px solid #27272a; border-radius: 6px; padding: 8px 10px; font-size: 11px; color: #d4d4d8; max-height: 90px; overflow-y: auto; white-space: pre-wrap; font-family: monospace; }
.fill-card-footer { display: flex; justify-content: space-between; font-size: 10px; color: var(--text-muted); }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border-radius: 6px; padding: 7px 14px; font-size: 12px; cursor: pointer; border: 1px solid transparent; font-weight: 500; white-space: nowrap; flex-shrink: 0; transition: all 0.15s ease; user-select: none; }
.btn-primary { background: var(--color-primary); color: #121215; font-weight: 700; }
.btn-primary:hover { background: #d97706; }
.btn-secondary { background: var(--bg-surface); border-color: var(--border-color); color: #fff; }
.btn-secondary:hover { background: var(--bg-subtle); border-color: #52525b; }
.btn-ghost { background: transparent; color: var(--text-muted); }
.btn-ghost:hover { color: #fff; background: var(--bg-subtle); }
.btn-sm { padding: 5px 10px; font-size: 11px; }
.btn-icon { background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: 6px; border-radius: 4px; font-size: 13px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.btn-icon:hover { background: var(--bg-subtle); color: #fff; }
.text-danger { color: var(--color-danger); }
.modal-backdrop { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px; }
.modal-backdrop.hidden, .context-menu.hidden { display: none; }
.modal-card { background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 10px; width: 480px; max-width: 95vw; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.8); }
.modal-header { padding: 14px 18px; background: var(--bg-subtle); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; font-weight: 600; }
.modal-body { padding: 18px; }
.modal-footer { padding: 14px 18px; border-top: 1px solid #27272a; display: flex; justify-content: flex-end; gap: 10px; }
.form-group { margin-bottom: 14px; }
.form-group label { display: block; font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; }
.form-input, .form-textarea { width: 100%; background: #121215; border: 1px solid var(--border-color); border-radius: 6px; color: #fff; padding: 9px 12px; font-size: 13px; outline: none; }
.form-input:focus, .form-textarea:focus { border-color: var(--color-primary); }
.form-textarea { min-height: 90px; resize: vertical; font-family: inherit; }
.context-menu { position: fixed; z-index: 3000; background: #18181b; border: 1px solid #3f3f46; border-radius: 8px; box-shadow: 0 12px 30px rgba(0,0,0,0.8); padding: 4px; min-width: 200px; }
.context-menu-item { display: flex; align-items: center; gap: 8px; padding: 8px 12px; font-size: 12px; color: #f4f4f5; cursor: pointer; border-radius: 5px; }
.context-menu-item:hover { background: #27272a; }
.context-menu-item.danger { color: #ef4444; }
.context-menu-item.danger:hover { background: rgba(239, 68, 68, 0.15); }
.context-menu-sep { height: 1px; background: #27272a; margin: 4px 0; }
.toast-container { position: fixed; bottom: 24px; right: 24px; display: flex; flex-direction: column; gap: 8px; z-index: 2000; }
.toast { background: var(--bg-surface); border: 1px solid var(--border-color); padding: 12px 16px; border-radius: 8px; font-size: 13px; box-shadow: 0 4px 16px rgba(0,0,0,0.6); }

/* Adaptação Telas Pequenas */
@media (max-width: 860px) {
  .manager-main { flex-direction: column; overflow-y: auto; }
  .sidebar { width: 100%; max-height: 240px; border-right: none; border-bottom: 1px solid var(--border-color); }
  .content-panel { padding: 16px; }
  .fills-grid { grid-template-columns: 1fr; }
}
@media (max-width: 600px) {
  .topbar { flex-direction: column; align-items: flex-start; gap: 12px; padding: 12px 16px; }
  .topbar-actions { width: 100%; justify-content: flex-start; flex-wrap: wrap; gap: 8px; }
  .panel-header { flex-direction: column; align-items: stretch; gap: 14px; }
  .panel-header-actions { flex-direction: column; align-items: stretch; width: 100%; gap: 8px; }
  .search-box { width: 100%; }
  .modal-card { width: 95vw; }
}

/* Otimização 2K e 4K Ultra HD */
@media (min-width: 1400px) {
  .sidebar { width: clamp(280px, 18vw, 360px); }
  .fills-grid { grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 18px; }
  .content-panel { padding: 28px 40px; }
}
@media (min-width: 2000px) {
  body { font-size: 15px; }
  .topbar { padding: 16px 36px; }
  .topbar-logo { font-size: 26px; }
  .topbar-title { font-size: 19px; }
  .topbar-sub { font-size: 13px; }
  .sidebar { width: clamp(320px, 16vw, 440px); }
  .sidebar-header { padding: 18px 20px; }
  .sidebar-header h2 { font-size: 14px; }
  .folder-item { padding: 10px 16px; font-size: 14px; }
  .badge { font-size: 11px; padding: 3px 8px; }
  .content-panel { padding: 32px 48px; }
  .folder-title-row h2 { font-size: 24px; }
  .text-muted { font-size: 13px; }
  .search-box { width: 320px; font-size: 14px; padding: 9px 16px; }
  .btn { padding: 9px 18px; font-size: 14px; border-radius: 8px; }
  .btn-sm { padding: 6px 12px; font-size: 12px; }
  .fills-grid { grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 22px; }
  .fill-card { padding: 18px; gap: 14px; }
  .fill-card-title { font-size: 15px; }
  .fill-card-body { font-size: 13px; padding: 12px 14px; max-height: 120px; }
  .fill-card-footer { font-size: 12px; }
}
@media (min-width: 3000px) {
  body { font-size: 17px; }
  .topbar { padding: 20px 48px; }
  .topbar-logo { font-size: 32px; }
  .topbar-title { font-size: 22px; }
  .topbar-sub { font-size: 14px; }
  .sidebar { width: clamp(380px, 15vw, 520px); }
  .sidebar-header { padding: 22px 24px; }
  .sidebar-header h2 { font-size: 16px; }
  .folder-item { padding: 14px 20px; font-size: 16px; }
  .badge { font-size: 13px; padding: 4px 10px; }
  .content-panel { padding: 40px 60px; }
  .folder-title-row h2 { font-size: 28px; }
  .text-muted { font-size: 15px; }
  .search-box { width: 420px; font-size: 16px; padding: 12px 20px; border-radius: 8px; }
  .btn { padding: 12px 22px; font-size: 16px; border-radius: 10px; }
  .btn-sm { padding: 8px 14px; font-size: 14px; }
  .fills-grid { grid-template-columns: repeat(auto-fill, minmax(440px, 1fr)); gap: 28px; }
  .fill-card { padding: 24px; border-radius: 12px; gap: 16px; }
  .fill-card-title { font-size: 18px; }
  .fill-card-body { font-size: 15px; padding: 14px 16px; max-height: 160px; }
  .fill-card-footer { font-size: 14px; }
  .modal-card { width: 620px; border-radius: 14px; }
  .modal-header h3 { font-size: 18px; }
  .form-group label { font-size: 14px; }
  .form-input, .form-textarea { font-size: 16px; padding: 12px 16px; }
}`;
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
