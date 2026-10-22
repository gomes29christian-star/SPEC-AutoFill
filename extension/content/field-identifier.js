/**
 * Fillbox — Identificador Robusto de Campos em Camadas
 * Prioriza atributos estáveis, evita seletores CSS frágeis, rejeita campos de senha
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FieldIdentifier = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Normalização de URL: Mantém apenas protocolo, host e caminho base sem hash ou query
  function normalizeUrl(urlString) {
    try {
      const parsed = new URL(urlString || window.location.href);
      return {
        origin: parsed.origin,
        path: parsed.pathname.replace(/\/+$/, '') || '/'
      };
    } catch (e) {
      return {
        origin: window.location.origin,
        path: window.location.pathname || '/'
      };
    }
  }

  // Verifica se o campo é suportado e seguro
  function isFieldSupported(element) {
    if (!element || !(element instanceof Element)) return false;

    // Regra de Segurança Estrita: Não suporta campos de senha
    if (element.tagName === 'INPUT' && element.type && element.type.toLowerCase() === 'password') {
      return false;
    }

    if (element.tagName === 'INPUT') {
      const type = (element.type || 'text').toLowerCase();
      const supportedInputTypes = [
        'text',
        'search',
        'email',
        'url',
        'tel',
        'number',
        'textarea'
      ];
      return supportedInputTypes.includes(type);
    }

    if (element.tagName === 'TEXTAREA') return true;

    if (element.isContentEditable) return true;

    return false;
  }

  // Detecção de IDs dinâmicos gerados automaticamente por frameworks (React, Angular, ASP.NET, etc.)
  function isDynamicId(id) {
    if (!id || typeof id !== 'string') return true;
    // Padrões comuns de geradores dinâmicos
    const dynamicPatterns = [
      /^:r[0-9a-z]+:$/i, // React useId
      /^ember\d+$/i,
      /^ext-gen\d+$/i,
      /^yui_\d+/i,
      /^a-\d+$/i,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i, // UUID
      /^[a-z0-9_-]{20,}$/i // Hashes longos aleatórios
    ];
    return dynamicPatterns.some((pattern) => pattern.test(id.trim()));
  }

  // Extrai label associado ao campo
  function getAssociatedLabelText(element) {
    try {
      // 1. Enclosing label
      const parentLabel = element.closest('label');
      if (parentLabel) {
        return (parentLabel.textContent || '').trim().replace(/\s+/g, ' ').substring(0, 50);
      }
      // 2. Label com atributo "for"
      if (element.id) {
        const doc = element.ownerDocument || document;
        const matchingLabel = doc.querySelector(`label[for="${CSS.escape(element.id)}"]`);
        if (matchingLabel) {
          return (matchingLabel.textContent || '').trim().replace(/\s+/g, ' ').substring(0, 50);
        }
      }
      // 3. aria-label ou placeholder
      return element.getAttribute('aria-label') || element.getAttribute('placeholder') || '';
    } catch (e) {
      return '';
    }
  }

  // Gera a assinatura de identificação em camadas do campo
  function createFieldSignature(element) {
    if (!element || !isFieldSupported(element)) {
      return null;
    }

    const doc = element.ownerDocument || document;
    const tagName = element.tagName.toLowerCase();
    const isContentEditable = element.isContentEditable;
    const inputType = element.getAttribute('type') || (tagName === 'textarea' ? 'textarea' : (isContentEditable ? 'contenteditable' : 'text'));

    const signature = {
      tagName,
      type: inputType,
      strategy: 'unknown',
      id: null,
      name: null,
      formId: null,
      formName: null,
      labelText: getAssociatedLabelText(element),
      placeholder: element.getAttribute('placeholder') || null,
      ariaLabel: element.getAttribute('aria-label') || null,
      dataTestId: element.getAttribute('data-testid') || element.getAttribute('data-test') || null,
      autocomplete: element.getAttribute('autocomplete') || null
    };

    const form = element.closest('form');
    if (form) {
      if (form.id && !isDynamicId(form.id)) signature.formId = form.id;
      if (form.name) signature.formName = form.name;
    }

    // Camada 1: ID estável e exclusivo
    if (element.id && !isDynamicId(element.id)) {
      try {
        const matches = doc.querySelectorAll(`#${CSS.escape(element.id)}`);
        if (matches.length === 1) {
          signature.id = element.id;
          signature.strategy = 'unique_id';
          return signature;
        }
      } catch (e) {}
    }

    // Camada 2: data-testid estável
    if (signature.dataTestId) {
      try {
        const matches = doc.querySelectorAll(`[data-testid="${CSS.escape(signature.dataTestId)}"]`);
        if (matches.length === 1) {
          signature.strategy = 'data_testid';
          return signature;
        }
      } catch (e) {}
    }

    // Camada 3: Name único dentro do formulário ou página
    const name = element.getAttribute('name');
    if (name) {
      signature.name = name;
      const formScope = form || doc;
      try {
        const matches = formScope.querySelectorAll(`[name="${CSS.escape(name)}"]`);
        if (matches.length === 1) {
          signature.strategy = form ? 'form_scoped_name' : 'unique_name';
          return signature;
        }
      } catch (e) {}
    }

    // Camada 4: Autocomplete semântico + Form ou Label
    if (signature.autocomplete && signature.autocomplete !== 'off' && signature.autocomplete !== 'on') {
      signature.strategy = 'semantic_autocomplete';
      return signature;
    }

    // Camada 5: Placeholder/Aria-label exclusivo
    if (signature.placeholder) {
      try {
        const matches = doc.querySelectorAll(`[placeholder="${CSS.escape(signature.placeholder)}"]`);
        if (matches.length === 1) {
          signature.strategy = 'unique_placeholder';
          return signature;
        }
      } catch (e) {}
    }

    // Fallback: Se não atingir confiança mínima, retorna null para não vincular campo errado
    return null;
  }

  // Resolve o elemento DOM a partir da assinatura salva
  function resolveElementFromSignature(signature, rootNode = document) {
    if (!signature) return null;

    // 1. Busca por ID
    if (signature.id) {
      try {
        const el = rootNode.getElementById ? rootNode.getElementById(signature.id) : rootNode.querySelector(`#${CSS.escape(signature.id)}`);
        if (el && isFieldSupported(el)) return el;
      } catch (e) {}
    }

    // 2. Busca por data-testid
    if (signature.dataTestId) {
      try {
        const matches = rootNode.querySelectorAll(`[data-testid="${CSS.escape(signature.dataTestId)}"]`);
        if (matches.length === 1 && isFieldSupported(matches[0])) return matches[0];
      } catch (e) {}
    }

    // 3. Busca por Form + Name
    if (signature.name) {
      try {
        if (signature.formId) {
          const form = rootNode.querySelector(`#${CSS.escape(signature.formId)}`);
          if (form) {
            const matches = form.querySelectorAll(`[name="${CSS.escape(signature.name)}"]`);
            if (matches.length === 1 && isFieldSupported(matches[0])) return matches[0];
          }
        }
        const matches = rootNode.querySelectorAll(`[name="${CSS.escape(signature.name)}"]`);
        if (matches.length === 1 && isFieldSupported(matches[0])) return matches[0];
      } catch (e) {}
    }

    // 4. Busca por Autocomplete
    if (signature.autocomplete) {
      try {
        const matches = rootNode.querySelectorAll(`[autocomplete="${CSS.escape(signature.autocomplete)}"]`);
        if (matches.length === 1 && isFieldSupported(matches[0])) return matches[0];
      } catch (e) {}
    }

    // 5. Busca por Placeholder
    if (signature.placeholder) {
      try {
        const matches = rootNode.querySelectorAll(`[placeholder="${CSS.escape(signature.placeholder)}"]`);
        if (matches.length === 1 && isFieldSupported(matches[0])) return matches[0];
      } catch (e) {}
    }

    // Ambiguidade ou elemento inexistente: retorna null seguro
    return null;
  }

  return {
    normalizeUrl,
    isFieldSupported,
    createFieldSignature,
    resolveElementFromSignature
  };
});
