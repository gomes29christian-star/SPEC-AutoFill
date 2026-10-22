/**
 * Fillbox — Módulo Compartilhado de Armazenamento e Modelo de Dados
 * Compatível com WebExtensions (browser.storage.local e chrome.storage.local)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FillboxStorage = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE_KEY = 'fillbox_data_v1';
  const CURRENT_SCHEMA_VERSION = 1;

  // Formatação de data brasileira estrita: "dd/mm/aaaa"
  function formatDateBR(date = new Date()) {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  // Geração de ID estável único sem dependências externas
  function generateId(prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // Estado padrão inicial limpo
  function getDefaultState() {
    const defaultFolderId = 'folder_default';
    return {
      version: CURRENT_SCHEMA_VERSION,
      createdAt: formatDateBR(),
      updatedAt: formatDateBR(),
      folders: [
        {
          id: defaultFolderId,
          name: 'Respostas Frequentes',
          createdAt: formatDateBR(),
          fills: [
            {
              id: 'fill_1',
              name: 'Saudação Padrão',
              fill: 'Olá! Agradeço pelo contato e estou à disposição para ajudar.',
              createdAt: formatDateBR()
            },
            {
              id: 'fill_2',
              name: 'Assinatura Comercial',
              fill: 'Atenciosamente,\nEquipe de Atendimento Fillbox',
              createdAt: formatDateBR()
            },
            {
              id: 'fill_3',
              name: 'Confirmação de Recebimento',
              fill: 'Confirmamos o recebimento da sua solicitação. Retornaremos em breve.',
              createdAt: formatDateBR()
            }
          ]
        },
        {
          id: 'folder_tech',
          name: 'Dev & Suporte Técnico',
          createdAt: formatDateBR(),
          fills: [
            {
              id: 'fill_4',
              name: 'Template de Bug',
              fill: 'Passos para reproduzir:\n1. Acessar tela\n2. Clicar no botão\nResultado esperado:\nResultado obtido:',
              createdAt: formatDateBR()
            },
            {
              id: 'fill_5',
              name: 'Comando de Log',
              fill: 'journalctl -u app.service -n 100 --no-pager',
              createdAt: formatDateBR()
            }
          ]
        }
      ],
      bindings: [] // Array de { id, folderId, origin, path, fieldSignature, createdAt }
    };
  }

  // Interface agnóstica para browser.storage.local ou localStorage
  const storageAdapter = {
    async get(key) {
      if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
        const res = await browser.storage.local.get(key);
        return res[key];
      }
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return new Promise((resolve) => {
          chrome.storage.local.get([key], (res) => resolve(res ? res[key] : null));
        });
      }
      if (typeof localStorage !== 'undefined') {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      }
      return null;
    },

    async set(key, value) {
      if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
        return browser.storage.local.set({ [key]: value });
      }
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return new Promise((resolve, reject) => {
          chrome.storage.local.set({ [key]: value }, () => {
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
            else resolve();
          });
        });
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(value));
        return Promise.resolve();
      }
      return Promise.resolve();
    }
  };

  class FillboxStore {
    constructor() {
      this._cache = null;
      this._listeners = new Set();
    }

    subscribe(listener) {
      this._listeners.add(listener);
      return () => this._listeners.delete(listener);
    }

    _notify() {
      for (const listener of this._listeners) {
        try {
          listener(this._cache);
        } catch (e) {
          console.error('[Fillbox] Erro no listener:', e);
        }
      }
    }

    async load() {
      try {
        const data = await storageAdapter.get(STORAGE_KEY);
        if (!data || !data.version) {
          const fresh = getDefaultState();
          await this.save(fresh);
          this._cache = fresh;
          return fresh;
        }
        // Migração se necessário
        const migrated = this.migrate(data);
        this._cache = migrated;
        return migrated;
      } catch (err) {
        console.error('[Fillbox] Falha ao carregar storage:', err);
        const fallback = getDefaultState();
        this._cache = fallback;
        return fallback;
      }
    }

    migrate(data) {
      let state = { ...data };
      if (!Array.isArray(state.folders)) state.folders = [];
      if (!Array.isArray(state.bindings)) state.bindings = [];
      if (!state.version) state.version = CURRENT_SCHEMA_VERSION;
      return state;
    }

    async save(data) {
      data.updatedAt = formatDateBR();
      await storageAdapter.set(STORAGE_KEY, data);
      this._cache = data;
      this._notify();
      return data;
    }

    // ================= PASTAS =================
    async getFolders() {
      const state = await this.load();
      return state.folders || [];
    }

    async getFolder(folderId) {
      const folders = await this.getFolders();
      return folders.find((f) => f.id === folderId) || null;
    }

    async createFolder(name) {
      const cleanName = (name || '').trim();
      if (!cleanName) throw new Error('O nome da pasta não pode estar vazio.');

      const state = await this.load();
      const newFolder = {
        id: generateId('folder'),
        name: cleanName,
        createdAt: formatDateBR(),
        fills: []
      };

      state.folders.push(newFolder);
      await this.save(state);
      return newFolder;
    }

    async renameFolder(folderId, newName) {
      const cleanName = (newName || '').trim();
      if (!cleanName) throw new Error('O novo nome da pasta não pode estar vazio.');

      const state = await this.load();
      const folder = state.folders.find((f) => f.id === folderId);
      if (!folder) throw new Error('Pasta não encontrada.');

      folder.name = cleanName;
      await this.save(state);
      return folder;
    }

    async deleteFolder(folderId) {
      const state = await this.load();
      const folderIndex = state.folders.findIndex((f) => f.id === folderId);
      if (folderIndex === -1) throw new Error('Pasta não encontrada.');

      // Remove pasta
      state.folders.splice(folderIndex, 1);

      // Limpa vínculos órfãos para evitar comportamento fantasma
      const initialBindingsCount = state.bindings.length;
      state.bindings = state.bindings.filter((b) => b.folderId !== folderId);
      const removedBindings = initialBindingsCount - state.bindings.length;

      await this.save(state);
      return { success: true, removedBindings };
    }

    // ================= FILLS =================
    async createFill(folderId, name, fill) {
      const cleanName = (name || '').trim();
      if (!cleanName) throw new Error('O nome do Fill não pode estar vazio.');
      if (typeof fill !== 'string') throw new Error('O conteúdo do Fill deve ser texto.');

      const state = await this.load();
      const folder = state.folders.find((f) => f.id === folderId);
      if (!folder) throw new Error('Pasta não encontrada.');

      const newFill = {
        id: generateId('fill'),
        name: cleanName,
        fill: fill,
        createdAt: formatDateBR()
      };

      folder.fills.push(newFill);
      await this.save(state);
      return newFill;
    }

    async updateFill(folderId, fillId, name, fill) {
      const cleanName = (name || '').trim();
      if (!cleanName) throw new Error('O nome do Fill não pode estar vazio.');

      const state = await this.load();
      const folder = state.folders.find((f) => f.id === folderId);
      if (!folder) throw new Error('Pasta não encontrada.');

      const fillItem = folder.fills.find((item) => item.id === fillId);
      if (!fillItem) throw new Error('Fill não encontrado.');

      fillItem.name = cleanName;
      fillItem.fill = fill;
      fillItem.updatedAt = formatDateBR();

      await this.save(state);
      return fillItem;
    }

    async deleteFill(folderId, fillId) {
      const state = await this.load();
      const folder = state.folders.find((f) => f.id === folderId);
      if (!folder) throw new Error('Pasta não encontrada.');

      const idx = folder.fills.findIndex((item) => item.id === fillId);
      if (idx === -1) throw new Error('Fill não encontrado.');

      folder.fills.splice(idx, 1);
      await this.save(state);
      return { success: true };
    }

    // ================= VÍNCULOS =================
    async getBindings() {
      const state = await this.load();
      return state.bindings || [];
    }

    async bindField(bindingData) {
      const { folderId, origin, path, fieldSignature } = bindingData;
      if (!folderId || !origin || !path || !fieldSignature) {
        throw new Error('Dados de vínculo incompletos.');
      }

      const state = await this.load();
      const folderExists = state.folders.some((f) => f.id === folderId);
      if (!folderExists) throw new Error('A pasta selecionada não existe.');

      // Remove vínculo prévio para o mesmo campo se já existir (atualização)
      state.bindings = state.bindings.filter((b) => {
        if (b.origin === origin && b.path === path) {
          // Compara assinatura do campo
          return !this.signaturesMatch(b.fieldSignature, fieldSignature);
        }
        return true;
      });

      const newBinding = {
        id: generateId('bind'),
        folderId,
        origin,
        path,
        fieldSignature,
        createdAt: formatDateBR()
      };

      state.bindings.push(newBinding);
      await this.save(state);
      return newBinding;
    }

    signaturesMatch(sigA, sigB) {
      if (!sigA || !sigB) return false;
      if (sigA.id && sigB.id && sigA.id === sigB.id) return true;
      if (sigA.name && sigB.name && sigA.name === sigB.name) {
        if (sigA.formId && sigB.formId) return sigA.formId === sigB.formId;
        return true;
      }
      // Comparação estrutural avançada
      if (sigA.selector && sigB.selector && sigA.selector === sigB.selector) return true;
      return false;
    }

    async removeBinding(bindingId) {
      const state = await this.load();
      state.bindings = state.bindings.filter((b) => b.id !== bindingId);
      await this.save(state);
      return { success: true };
    }

    async findBindingForField(origin, path, fieldSignature) {
      const state = await this.load();
      for (const b of state.bindings) {
        if (b.origin === origin && b.path === path) {
          if (this.signaturesMatch(b.fieldSignature, fieldSignature)) {
            // Verifica se a pasta ainda existe
            const folder = state.folders.find((f) => f.id === b.folderId);
            if (folder) {
              return { binding: b, folder };
            }
          }
        }
      }
      return null;
    }

    // ================= EXPORTAÇÃO E IMPORTAÇÃO =================
    async exportJSON() {
      const state = await this.load();
      return JSON.stringify(
        {
          app: 'Fillbox',
          version: CURRENT_SCHEMA_VERSION,
          exportedAt: formatDateBR(),
          folders: state.folders,
          bindings: state.bindings
        },
        null,
        2
      );
    }

    async importJSON(jsonString) {
      let parsed;
      try {
        parsed = JSON.parse(jsonString);
      } catch (e) {
        throw new Error('Arquivo JSON inválido ou corrompido.');
      }

      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Estrutura de dados inválida.');
      }

      if (!Array.isArray(parsed.folders)) {
        throw new Error('O arquivo não contém uma lista de pastas válida.');
      }

      // Validação rigorosa dos campos
      const validatedFolders = [];
      for (const folder of parsed.folders) {
        if (!folder || typeof folder.name !== 'string' || !folder.name.trim()) {
          throw new Error('Pasta inválida encontrada no arquivo de importação.');
        }

        const cleanFolder = {
          id: folder.id || generateId('folder'),
          name: folder.name.trim(),
          createdAt: folder.createdAt || formatDateBR(),
          fills: []
        };

        if (Array.isArray(folder.fills)) {
          for (const fill of folder.fills) {
            if (!fill || typeof fill.name !== 'string' || typeof fill.fill !== 'string') {
              continue; // Ignora fills malformados com segurança
            }
            cleanFolder.fills.push({
              id: fill.id || generateId('fill'),
              name: fill.name.trim() || 'Sem título',
              fill: fill.fill,
              createdAt: fill.createdAt || formatDateBR()
            });
          }
        }
        validatedFolders.push(cleanFolder);
      }

      const validatedBindings = [];
      if (Array.isArray(parsed.bindings)) {
        for (const b of parsed.bindings) {
          if (b && b.folderId && b.origin && b.path && b.fieldSignature) {
            validatedBindings.push({
              id: b.id || generateId('bind'),
              folderId: b.folderId,
              origin: b.origin,
              path: b.path,
              fieldSignature: b.fieldSignature,
              createdAt: b.createdAt || formatDateBR()
            });
          }
        }
      }

      const newState = {
        version: CURRENT_SCHEMA_VERSION,
        createdAt: parsed.createdAt || formatDateBR(),
        updatedAt: formatDateBR(),
        folders: validatedFolders,
        bindings: validatedBindings
      };

      await this.save(newState);
      return newState;
    }
  }

  return {
    FillboxStore,
    formatDateBR,
    generateId,
    getDefaultState,
    store: new FillboxStore()
  };
});
