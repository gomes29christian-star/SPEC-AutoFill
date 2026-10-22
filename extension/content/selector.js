/**
 * Fillbox — Seletor Flutuante Contextual de Fills
 * Interação minimalista, filtragem imediata, navegação completa por teclado e controle de viewport
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FillboxSelector = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Normalização para busca insensível a maiúsculas/minúsculas e acentuação
  function normalizeSearchText(text) {
    if (!text) return '';
    return text
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  class ContextualSelector {
    constructor() {
      this.container = null;
      this.activeElement = null;
      this.currentFolder = null;
      this.allFills = [];
      this.filteredFills = [];
      this.selectedIndex = 0;
      this.isOpen = false;
      this.onSelectCallback = null;

      this._handleDocumentClick = this._handleDocumentClick.bind(this);
      this._handleKeyDown = this._handleKeyDown.bind(this);
      this._handleResize = this._handleResize.bind(this);
    }

    open(targetElement, folder, onSelect) {
      if (!targetElement || !folder) return;
      this.close(); // Fecha se já houver um aberto

      this.activeElement = targetElement;
      this.currentFolder = folder;
      this.allFills = Array.isArray(folder.fills) ? folder.fills : [];
      this.filteredFills = [...this.allFills];
      this.selectedIndex = 0;
      this.onSelectCallback = onSelect;
      this.isOpen = true;

      this.render();
      this.positionNearElement();

      // Listeners globais de fechamento e navegação
      document.addEventListener('mousedown', this._handleDocumentClick, true);
      window.addEventListener('resize', this._handleResize, { passive: true });
      window.addEventListener('scroll', this._handleResize, { passive: true });

      // Foco imediato no campo de busca para permitir digitação instantânea
      const searchInput = this.container.querySelector('.fillbox-search-input');
      if (searchInput) {
        setTimeout(() => searchInput.focus(), 10);
      }
    }

    close() {
      if (!this.isOpen) return;

      document.removeEventListener('mousedown', this._handleDocumentClick, true);
      window.removeEventListener('resize', this._handleResize);
      window.removeEventListener('scroll', this._handleResize);

      if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }

      this.container = null;
      this.isOpen = false;

      // Restaura o foco para o elemento original
      if (this.activeElement && typeof this.activeElement.focus === 'function') {
        try {
          this.activeElement.focus();
        } catch (e) {}
      }
    }

    positionNearElement() {
      if (!this.container || !this.activeElement) return;

      const rect = this.activeElement.getBoundingClientRect();
      const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;

      const card = this.container.querySelector('.fillbox-card');
      const cardWidth = card ? card.offsetWidth : 320;
      const cardHeight = card ? card.offsetHeight : 240;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Cálculo dos espaços vazios disponíveis ao redor do campo
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      let top;
      if (spaceBelow >= cardHeight + 8 || spaceBelow >= spaceAbove) {
        // Há mais espaço vazio abaixo do campo
        top = rect.bottom + scrollY + 6;
      } else {
        // Posiciona no espaço vazio acima do campo para não cobrir o elemento
        top = Math.max(10, rect.top + scrollY - cardHeight - 6);
      }

      // Alinhamento horizontal no espaço vazio disponível
      let left = rect.left + scrollX;
      if (rect.left + cardWidth > viewportWidth - 12) {
        left = Math.max(12, viewportWidth - cardWidth - 12 + scrollX);
      }

      this.container.style.left = `${Math.round(left)}px`;
      this.container.style.top = `${Math.round(top)}px`;
    }

    _handleResize() {
      if (this.isOpen) {
        this.positionNearElement();
      }
    }

    _handleDocumentClick(e) {
      if (!this.isOpen) return;
      // Se o clique foi fora do seletor e fora do elemento ativo, fecha
      if (
        this.container &&
        !this.container.contains(e.target) &&
        e.target !== this.activeElement
      ) {
        this.close();
      }
    }

    _handleKeyDown(e) {
      if (!this.isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.close();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (this.filteredFills.length > 0) {
          this.selectedIndex = (this.selectedIndex + 1) % this.filteredFills.length;
          this.updateListHighlight();
        }
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (this.filteredFills.length > 0) {
          this.selectedIndex = (this.selectedIndex - 1 + this.filteredFills.length) % this.filteredFills.length;
          this.updateListHighlight();
        }
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation(); // Previne submissão acidental de formulários da página!
        if (this.filteredFills.length > 0 && this.filteredFills[this.selectedIndex]) {
          this.selectFill(this.filteredFills[this.selectedIndex]);
        }
        return;
      }
    }

    filterFills(query) {
      const q = normalizeSearchText(query);
      if (!q) {
        this.filteredFills = [...this.allFills];
      } else {
        this.filteredFills = this.allFills.filter((f) => {
          return normalizeSearchText(f.name).includes(q) || normalizeSearchText(f.fill).includes(q);
        });
      }
      this.selectedIndex = 0;
      this.renderList();
    }

    selectFill(fillItem) {
      if (this.onSelectCallback && fillItem) {
        this.onSelectCallback(fillItem);
      }
      this.close();
    }

    updateListHighlight() {
      const listEl = this.container.querySelector('.fillbox-list');
      if (!listEl) return;
      const items = listEl.querySelectorAll('.fillbox-item');
      items.forEach((item, idx) => {
        if (idx === this.selectedIndex) {
          item.classList.add('is-selected');
          item.scrollIntoView({ block: 'nearest' });
        } else {
          item.classList.remove('is-selected');
        }
      });
    }

    renderList() {
      const listEl = this.container.querySelector('.fillbox-list');
      if (!listEl) return;

      if (this.filteredFills.length === 0) {
        listEl.innerHTML = `
          <div class="fillbox-empty">
            ${this.allFills.length === 0 ? 'Pasta vazia. Adicione Fills nas opções da extensão.' : 'Nenhum Fill encontrado para esta busca.'}
          </div>
        `;
        return;
      }

      listEl.innerHTML = '';
      this.filteredFills.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = `fillbox-item ${index === this.selectedIndex ? 'is-selected' : ''}`;
        li.innerHTML = `
          <div class="fillbox-item-name">${this.escapeHTML(item.name)}</div>
          <div class="fillbox-item-preview">${this.escapeHTML(item.fill.substring(0, 48))}${item.fill.length > 48 ? '...' : ''}</div>
        `;

        li.addEventListener('mousedown', (e) => {
          e.preventDefault(); // Impede perda prematura de foco
          this.selectFill(item);
        });

        li.addEventListener('mouseenter', () => {
          this.selectedIndex = index;
          this.updateListHighlight();
        });

        listEl.appendChild(li);
      });
    }

    escapeHTML(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    render() {
      const div = document.createElement('div');
      div.id = 'fillbox-floating-container';

      div.innerHTML = `
        <div class="fillbox-card" role="dialog" aria-label="Seletor de Fills">
          <div class="fillbox-header">
            <div class="fillbox-badge">
              <span>⚡ Fillbox</span>
              <span style="color:#71717a">›</span>
              <span class="fillbox-folder-name" title="${this.escapeHTML(this.currentFolder.name)}">${this.escapeHTML(this.currentFolder.name)}</span>
            </div>
            <button type="button" class="fillbox-close-btn" title="Fechar (Esc)">✕</button>
          </div>

          <div class="fillbox-search-wrap">
            <input
              type="text"
              class="fillbox-search-input"
              placeholder="Buscar pelo nome... (↑/↓ navega, Enter insere)"
              autocomplete="off"
              spellcheck="false"
            />
          </div>

          <ul class="fillbox-list" role="listbox"></ul>

          <div class="fillbox-footer">
            <span><span class="fillbox-kbd">↑</span> <span class="fillbox-kbd">↓</span> navegar</span>
            <span><span class="fillbox-kbd">Enter</span> selecionar</span>
            <span><span class="fillbox-kbd">Esc</span> fechar</span>
          </div>
        </div>
      `;

      // Eventos internos
      const closeBtn = div.querySelector('.fillbox-close-btn');
      closeBtn.addEventListener('click', () => this.close());

      const searchInput = div.querySelector('.fillbox-search-input');
      searchInput.addEventListener('input', (e) => {
        this.filterFills(e.target.value);
      });

      searchInput.addEventListener('keydown', this._handleKeyDown);

      document.body.appendChild(div);
      this.container = div;

      this.renderList();
    }
  }

  return {
    ContextualSelector,
    normalizeSearchText,
    selectorInstance: new ContextualSelector()
  };
});
