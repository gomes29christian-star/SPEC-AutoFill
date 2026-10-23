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

  // Extrai label associado ao campo
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
      return element.getAttribute('aria-label') || element.getAttribute('placeholder') || '';
    } catch (e) {
      return '';
    }
  }

  // Gera a assinatura de identificação em camadas do campo
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

    // Detecta container de Web Component (ex: ytd-searchbox, ytd-commentbox, etc.)
    const customContainer = field.closest && field.closest('ytd-searchbox, ytd-comments, ytd-commentbox, ytd-comment-simplebox-renderer, [role="search"], [role="form"]');
    if (customContainer) {
      signature.containerTag = customContainer.tagName.toLowerCase();
    }

    // Camada 1: ID exclusivo ou estável
    if (field.id && !isDynamicId(field.id)) {
      signature.id = field.id;
      try {
        const matches = doc.querySelectorAll(`#${CSS.escape(field.id)}`);
        if (matches.length === 1) {
          signature.strategy = 'unique_id';
          return signature;
        } else if (matches.length > 1) {
          // ID duplicado (comum em YouTube desktop vs mobile header): escopa com container
          if (signature.containerTag) {
            signature.strategy = 'container_scoped_id';
            signature.selector = `${signature.containerTag} #${CSS.escape(field.id)}`;
            return signature;
          }
          if (signature.formId) {
            signature.strategy = 'form_scoped_id';
            signature.selector = `#${CSS.escape(signature.formId)} #${CSS.escape(field.id)}`;
            return signature;
          }
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
    const name = field.getAttribute('name');
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

    // Camada 4: Autocomplete semântico
    if (signature.autocomplete && signature.autocomplete !== 'off' && signature.autocomplete !== 'on') {
      signature.strategy = 'semantic_autocomplete';
      return signature;
    }

    // Camada 5: Placeholder exclusivo
    if (signature.placeholder) {
      try {
        const matches = doc.querySelectorAll(`[placeholder="${CSS.escape(signature.placeholder)}"]`);
        if (matches.length === 1) {
          signature.strategy = 'unique_placeholder';
          return signature;
        }
      } catch (e) {}
    }

    // Camada 6: Aria-label exclusivo
    if (signature.ariaLabel) {
      try {
        const matches = doc.querySelectorAll(`[aria-label="${CSS.escape(signature.ariaLabel)}"]`);
        if (matches.length === 1) {
          signature.strategy = 'unique_aria_label';
          return signature;
        }
      } catch (e) {}
    }

    // Camada 7: Seletor composto contextual (YouTube comments, Notion, Twitter, etc.)
    if (signature.containerTag) {
      signature.strategy = 'container_scoped';
      signature.selector = `${signature.containerTag} ${tagName}`;
      return signature;
    }

    // Fallback garantido: Seletor estruturado baseado nas propriedades existentes
    signature.strategy = 'fallback_selector';
    let sel = tagName;
    if (field.id) sel += `#${CSS.escape(field.id)}`;
    if (signature.name) sel += `[name="${CSS.escape(signature.name)}"]`;
    if (signature.placeholder) sel += `[placeholder="${CSS.escape(signature.placeholder)}"]`;
    if (signature.ariaLabel) sel += `[aria-label="${CSS.escape(signature.ariaLabel)}"]`;
    signature.selector = sel;

    return signature;
  }

  // Executa busca por querySelector mesmo através de Shadow Roots abertas
  function querySelectorDeep(selector, rootNode = document) {
    if (!selector) return null;
    try {
      const match = rootNode.querySelector(selector);
      if (match) return match;
    } catch (e) {}

    // Vasculha elementos com Shadow Root
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

  // Resolve o elemento DOM a partir da assinatura salva
  function resolveElementFromSignature(signature, rootNode = document) {
    if (!signature) return null;

    // Função auxiliar que escolhe preferencialmente elementos visíveis na tela
    function pickVisible(elements) {
      if (!elements || elements.length === 0) return null;
      if (elements.length === 1) return isFieldSupported(elements[0]) ? elements[0] : null;
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (isFieldSupported(el)) {
          // Elemento visível (tem dimensões e não está display:none)
          if (el.offsetParent !== null || (el.getClientRects && el.getClientRects().length > 0)) {
            return el;
          }
        }
      }
      return isFieldSupported(elements[0]) ? elements[0] : null;
    }

    // 1. Busca por seletor customizado (container_scoped_id ou fallback_selector)
    if (signature.selector) {
      try {
        const match = querySelectorDeep(signature.selector, rootNode);
        if (match && isFieldSupported(match)) return match;
      } catch (e) {}
    }

    // 2. Busca por ID
    if (signature.id) {
      try {
        const matches = rootNode.querySelectorAll ? rootNode.querySelectorAll(`#${CSS.escape(signature.id)}`) : [];
        const found = pickVisible(Array.from(matches));
        if (found) return found;
      } catch (e) {}
    }

    // 3. Busca por data-testid
    if (signature.dataTestId) {
      try {
        const matches = rootNode.querySelectorAll ? rootNode.querySelectorAll(`[data-testid="${CSS.escape(signature.dataTestId)}"]`) : [];
        const found = pickVisible(Array.from(matches));
        if (found) return found;
      } catch (e) {}
    }

    // 4. Busca por Form + Name ou Name direto
    if (signature.name) {
      try {
        if (signature.formId) {
          const form = rootNode.querySelector(`#${CSS.escape(signature.formId)}`);
          if (form) {
            const matches = form.querySelectorAll(`[name="${CSS.escape(signature.name)}"]`);
            const found = pickVisible(Array.from(matches));
            if (found) return found;
          }
        }
        const matches = rootNode.querySelectorAll ? rootNode.querySelectorAll(`[name="${CSS.escape(signature.name)}"]`) : [];
        const found = pickVisible(Array.from(matches));
        if (found) return found;
      } catch (e) {}
    }

    // 5. Busca por Placeholder
    if (signature.placeholder) {
      try {
        const matches = rootNode.querySelectorAll ? rootNode.querySelectorAll(`[placeholder="${CSS.escape(signature.placeholder)}"]`) : [];
        const found = pickVisible(Array.from(matches));
        if (found) return found;
      } catch (e) {}
    }

    // 6. Busca por Aria-label
    if (signature.ariaLabel) {
      try {
        const matches = rootNode.querySelectorAll ? rootNode.querySelectorAll(`[aria-label="${CSS.escape(signature.ariaLabel)}"]`) : [];
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
});
