import React, { useState, useEffect, useRef } from 'react';
import { FolderItem, FillItem } from '../types';
import { CornerDownLeft, Search, X, Folder, Zap } from 'lucide-react';

interface FloatingSelectorProps {
  folder: FolderItem;
  targetRect: DOMRect | null;
  onSelect: (fill: FillItem) => void;
  onClose: () => void;
  onOpenManager?: () => void;
  themeColor: string;
}

export const FloatingSelector: React.FC<FloatingSelectorProps> = ({
  folder,
  targetRect,
  onSelect,
  onClose,
  onOpenManager,
  themeColor,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Normalização sem acentos
  const normalize = (txt: string) =>
    (txt || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const fills = folder.fills || [];
  const filteredFills = fills.filter((item) => {
    if (!query.trim()) return true;
    const q = normalize(query.trim());
    return normalize(item.name).includes(q) || normalize(item.fill).includes(q);
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Foco imediato no campo de busca
  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 20);
  }, []);

  // Fechar ao clicar fora
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [onClose]);

  // Navegação por teclado
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredFills.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % filteredFills.length);
      }
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredFills.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + filteredFills.length) % filteredFills.length);
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (filteredFills.length > 0 && filteredFills[selectedIndex]) {
        onSelect(filteredFills[selectedIndex]);
      }
      return;
    }
  };

  // Cálculo de posicionamento com prevenção de overflow de tela
  let style: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
  };

  if (targetRect) {
    const cardWidth = 320;
    const cardHeight = 260;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = targetRect.left;
    if (left + cardWidth > viewportWidth - 16) {
      left = Math.max(16, viewportWidth - cardWidth - 16);
    }

    let top = targetRect.bottom + 6;
    if (targetRect.bottom + cardHeight > viewportHeight - 16 && targetRect.top > cardHeight + 16) {
      top = targetRect.top - cardHeight - 6;
    }

    style = {
      ...style,
      left: `${Math.round(left)}px`,
      top: `${Math.round(top)}px`,
    };
  }

  return (
    <div
      ref={containerRef}
      style={style}
      className="w-80 bg-zinc-900 border border-zinc-700/90 rounded-xl shadow-2xl shadow-black/80 overflow-hidden text-zinc-100 flex flex-col font-sans animate-scaleIn select-none"
    >
      {/* Header */}
      <div className="px-3 py-2 bg-zinc-800/90 border-b border-zinc-700/80 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold overflow-hidden">
          <Zap className="w-3.5 h-3.5 text-amber-500 theme-stroke-icon shrink-0" />
          <span className="text-amber-500 theme-stroke-text font-bold">Fillbox</span>
          <span className="text-zinc-500">›</span>
          <span className="text-zinc-300 truncate font-medium max-w-[150px]" title={folder.name}>
            {folder.name}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-100 p-0.5 rounded hover:bg-zinc-700 transition"
          title="Fechar (Esc)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search Input */}
      <div className="p-2 border-b border-zinc-800 bg-zinc-950/50">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar Fills por nome..."
            className="w-full bg-zinc-800/80 border border-zinc-700 text-zinc-100 text-xs rounded-lg pl-8 pr-3 py-1.5 outline-none focus:border-amber-500 transition placeholder:text-zinc-500 font-sans"
          />
        </div>
      </div>

      {/* List */}
      <div className="max-h-48 overflow-y-auto p-1.5 space-y-1">
        {filteredFills.length === 0 ? (
          <div className="py-6 px-3 text-center text-zinc-400 text-xs">
            {fills.length === 0 ? (
              <div>
                <p className="mb-2">Pasta sem Fills cadastrados.</p>
                {onOpenManager && (
                  <button
                    onClick={onOpenManager}
                    className="text-amber-400 hover:underline text-[11px] font-medium"
                  >
                    Abrir gerenciador para cadastrar
                  </button>
                )}
              </div>
            ) : (
              <p>Nenhum Fill corresponde a "{query}"</p>
            )}
          </div>
        ) : (
          filteredFills.map((fill, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <div
                key={fill.id}
                onClick={() => onSelect(fill)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`px-2.5 py-1.5 rounded-lg cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-amber-500/15 border-l-2 border-amber-500 text-zinc-100'
                    : 'hover:bg-zinc-800/60 text-zinc-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold truncate ${isSelected ? 'text-amber-400 font-bold' : ''}`}>
                    {fill.name}
                  </span>
                  {isSelected && (
                    <span className="text-[10px] text-amber-500/80 font-mono flex items-center gap-0.5">
                      <CornerDownLeft className="w-2.5 h-2.5" /> Enter
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-zinc-400 truncate mt-0.5 font-mono">
                  {fill.fill}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 bg-zinc-950 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-500">
        <div className="flex items-center gap-2">
          <span>
            <kbd className="px-1 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[9px] text-zinc-400">↑</kbd>{' '}
            <kbd className="px-1 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[9px] text-zinc-400">↓</kbd> navegar
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[9px] text-zinc-400">Enter</kbd> inserir
          </span>
        </div>
        <span>
          <kbd className="px-1 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[9px] text-zinc-400">Esc</kbd>
        </span>
      </div>
    </div>
  );
};
