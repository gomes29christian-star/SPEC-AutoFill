/**
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

  // Verifica se o campo é suportado e seguro para preenchimento
  function isFieldSupported(element) {
    if (!element || !(element instanceof Element)) return false;

    // Regra de Segurança Estrita: Não suporta campos de senha
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

    // Suporte nativo a contenteditable ou role="textbox" (editores ricos, YouTube comments, Discord, Notion, etc.)
    if (element.isContentEditable) return true;
    const ce = element.getAttribute && element.getAttribute('contenteditable');
    if (ce === 'true' || ce === '') return true;
    if (element.getAttribute && element.getAttribute('role') === 'textbox') return true;

    return false;
  }

  // Localiza o elemento ativo mesmo se estiver aninhado dentro de Shadow DOM (Web Components)
  function getDeepActiveElement(root = document) {
    let active = root.activeElement;
    while (active && active.shadowRoot && active.shadowRoot.activeElement) {
      active = active.shadowRoot.activeElement;
    }
    return active;
  }

  // Resolve o campo editável suportado real a partir de qualquer evento ou elemento clicado
  function resolveSupportedField(eventOrElement) {
    if (!eventOrElement) {
      const active = getDeepActiveElement();
      return (active && isFieldSupported(active)) ? active : null;
    }

    const candidates = [];

    // Se for um evento, composedPath() atravessa as fronteiras do Shadow DOM (vital para YouTube!)
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

    // 1. Testa candidatos diretos e ancestrais editáveis imediatos
    for (const c of candidates) {
      if (isFieldSupported(c)) return c;
      const editableAncestor = c.closest && c.closest('input:not([type="password"]):not([type="hidden"]), textarea, [contenteditable="true"], [contenteditable=""], [role="textbox"]');
      if (editableAncestor && isFieldSupported(editableAncestor)) {
        return editableAncestor;
      }
    }

    // 2. Se o usuário clicou no container envolvente (ex: <ytd-searchbox>, <div id="search-input">, label, wrapper)
    for (const c of candidates) {
      try {
        const inner = c.querySelector && c.querySelector('input:not([type="password"]):not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, [contenteditable="true"], [contenteditable=""], [role="textbox"]');
        if (inner && isFieldSupported(inner)) return inner;
      } catch (e) {}

      // Procura dentro da shadowRoot do componente se existir
      if (c.shadowRoot) {
        try {
          const shadowInner = c.shadowRoot.querySelector('input:not([type="password"]):not([type="hidden"]), textarea, [contenteditable="true"], [contenteditable=""]');
          if (shadowInner && isFieldSupported(shadowInner)) return shadowInner;
        } catch (e) {}
      }

      // Procura em irmãos próximos (ex: clicou em ícone de lupa ou botão próximo)
      if (c.parentElement) {
        try {
          const sibling = c.parentElement.querySelector('input:not([type="password"]):not([type="hidden"]), textarea, [contenteditable="true"]');
          if (sibling && isFieldSupported(sibling)) return sibling;
        } catch (e) {}
      }
    }

    // 3. Fallback para activeElement profundo
    const deepActive = getDeepActiveElement();
    if (deepActive && isFieldSupported(deepActive)) {
      return deepActive;
    }

    return null;
  }

  // Detecção de IDs dinâmicos gerados automaticamente por frameworks (React, Angular, etc.)
  function isDynamicId(id) {
    if (!id || typeof id !== 'string') return true;
    const dynamicPatterns = [
      /^:r[0-9a-z]+:$/i, // React useId
      /^ember\d+$/i,
      /^ext-gen\d+$/i,
      /^yui_\d+/i,
      /^a-\d+$/i,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i, // UUID
      /^[a-z0-9_-]{24,}$/i // Hashes longos aleatórios
    ];
    return dynamicPatterns.some((pattern) => pattern.test(id.trim()));
  }

  // Extrai label associado ao campo de forma robusta
  function getAssociatedLabelText(element) {
    try {
      const parentLabel = element.closest && element.closest('label');
      if (parentLabel) {
        return (parentLabel.textContent || '').trim().replace(/\s+/g, ' ').substring(0, 50);
      }
      if (element.id) {
        const doc = element.ownerDocument || document;
        const matchingLabel = doc.querySelector(`label[for="${CSS.escape(element.id)}"]`);
        if (matchingLabel) {
          return (matchingLabel.textContent || '').trim().replace(/\s+/g, ' ').substring(0, 50);
        }
      }
      const directAttr = element.getAttribute('aria-label') || element.getAttribute('placeholder') || element.getAttribute('title') || element.getAttribute('name');
      if (directAttr) return directAttr;

      const prev = element.previousElementSibling;
      if (prev && prev.textContent && prev.textContent.trim().length > 0 && prev.textContent.trim().length < 60) {
        return prev.textContent.trim().replace(/\s+/g, ' ');
      }

      const parent = element.parentElement;
      if (parent) {
        const labelEl = parent.querySelector('label, .label, title, header, strong, span, legend, th, td');
        if (labelEl && labelEl !== element && labelEl.textContent) {
          return labelEl.textContent.trim().replace(/\s+/g, ' ').substring(0, 50);
        }
      }

      return element.tagName.toLowerCase() + (element.id ? `#${element.id}` : '');
    } catch (e) {
      return '';
    }
  }

  // Localiza todos os campos editáveis suportados presentes na página (incluindo Shadow DOM)
  function findAllEditableFields(rootNode = document) {
    const results = [];

    function scan(node) {
      if (!node) return;
      try {
        const query = 'input:not([type="password"]):not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="image"]):not([type="reset"]):not([type="range"]):not([type="color"]), textarea, [contenteditable="true"], [contenteditable=""], [role="textbox"]';
        const list = node.querySelectorAll ? node.querySelectorAll(query) : [];
        for (let i = 0; i < list.length; i++) {
          const el = list[i];
          if (isFieldSupported(el) && !results.includes(el)) {
            results.push(el);
          }
        }
      } catch (e) {}

      try {
        const all = node.querySelectorAll ? node.querySelectorAll('*') : [];
        for (let i = 0; i < all.length; i++) {
          if (all[i].shadowRoot) {
            scan(all[i].shadowRoot);
          }
        }
      } catch (e) {}
    }

    scan(rootNode);
    return results;
  }

  return {
    normalizeUrl,
    isFieldSupported,
    resolveSupportedField,
    getDeepActiveElement,
    getAssociatedLabelText,
    createFieldSignature,
    resolveElementFromSignature,
    findAllEditableFields
  };
});
