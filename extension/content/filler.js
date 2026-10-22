/**
 * Fillbox — Módulo de Inserção de Valores Reativo e Seguro
 * Compatível com HTMLInputElement, HTMLTextAreaElement e contenteditable
 * Dispara eventos de reatividade (React, Vue, Svelte, Angular) sem submeter formulários
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FillboxFiller = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function insertTextIntoElement(element, text) {
    if (!element || typeof text !== 'string') {
      return { success: false, error: 'Elemento ou texto inválido.' };
    }

    // Validações de segurança e estado
    if (element.disabled) {
      return { success: false, error: 'O campo está desabilitado.' };
    }
    if (element.readOnly) {
      return { success: false, error: 'O campo é somente leitura.' };
    }

    try {
      element.focus();

      // Caso 1: contenteditable
      if (element.isContentEditable) {
        let inserted = false;
        try {
          inserted = document.execCommand('insertText', false, text);
        } catch (e) {
          inserted = false;
        }

        if (!inserted) {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            const textNode = document.createTextNode(text);
            range.insertNode(textNode);
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
            sel.removeAllRanges();
            sel.addRange(range);
          } else {
            element.textContent = text;
          }
        }

        // Evento de input para editores reativos
        element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        return { success: true };
      }

      // Caso 2: INPUT ou TEXTAREA
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        const isSupportedInput = !element.type || ['text', 'search', 'email', 'url', 'tel', 'number', 'textarea'].includes(element.type.toLowerCase());
        if (!isSupportedInput) {
          return { success: false, error: 'Tipo de campo não suportado.' };
        }

        // Tenta execCommand para preservar histórico nativo de Desfazer (Ctrl+Z)
        let inserted = false;
        try {
          // Seleciona o texto atual para substituição direta ou posiciona cursor
          if (element.setSelectionRange) {
            element.setSelectionRange(0, element.value.length);
          }
          inserted = document.execCommand('insertText', false, text);
        } catch (e) {
          inserted = false;
        }

        // Se execCommand falhou ou não alterou o valor, aplica o setter com bypass de propriedades reativas
        if (!inserted || element.value !== text) {
          const proto = element.tagName === 'INPUT' ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(element, text);
          } else {
            element.value = text;
          }

          // Posiciona cursor no final
          if (element.setSelectionRange) {
            element.setSelectionRange(text.length, text.length);
          }
        }

        // Dispara eventos com bubbles para sincronização de frameworks (React SyntheticEvent, Vue v-model, etc.)
        element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

        return { success: true };
      }

      return { success: false, error: 'Elemento não editável.' };
    } catch (err) {
      console.error('[Fillbox] Erro na inserção:', err);
      return { success: false, error: err.message };
    }
  }

  return {
    insertTextIntoElement
  };
});
