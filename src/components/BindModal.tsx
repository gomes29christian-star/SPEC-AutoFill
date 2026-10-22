import React, { useState } from 'react';
import { FolderItem, BindingItem, FieldSignature } from '../types';
import { Link2, Trash2, X, AlertCircle } from 'lucide-react';

interface BindModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: FolderItem[];
  currentBinding: BindingItem | null;
  fieldSignature: FieldSignature | null;
  pagePath: string;
  onSaveBinding: (folderId: string) => void;
  onRemoveBinding: (bindingId: string) => void;
  themeColor: string;
}

export const BindModal: React.FC<BindModalProps> = ({
  isOpen,
  onClose,
  folders,
  currentBinding,
  fieldSignature,
  pagePath,
  onSaveBinding,
  onRemoveBinding,
  themeColor,
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string>(
    currentBinding?.folderId || (folders.length > 0 ? folders[0].id : '')
  );

  if (!isOpen || !fieldSignature) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFolderId) return;
    onSaveBinding(selectedFolderId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="px-5 py-3.5 bg-zinc-800 border-b border-zinc-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-amber-500 theme-stroke-icon" />
            <h3 className="font-semibold text-sm text-zinc-100 theme-stroke-text">
              Vincular Pasta Fill ao Campo
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 p-1 rounded-lg hover:bg-zinc-700 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Field info card */}
          <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-lg space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 font-medium">Caminho da Página:</span>
              <span className="text-zinc-300 font-mono text-[11px] bg-zinc-800 px-1.5 py-0.5 rounded">
                {pagePath}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 font-medium">Estratégia de Identificação:</span>
              <span className="text-amber-400 font-mono text-[11px] bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                {fieldSignature.strategy}
              </span>
            </div>
            {fieldSignature.id && (
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 font-medium">ID do Elemento:</span>
                <span className="text-zinc-300 font-mono text-[11px]">{fieldSignature.id}</span>
              </div>
            )}
            {fieldSignature.name && (
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 font-medium">Nome (name):</span>
                <span className="text-zinc-300 font-mono text-[11px]">{fieldSignature.name}</span>
              </div>
            )}
            {fieldSignature.labelText && (
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 font-medium">Rótulo (Label):</span>
                <span className="text-zinc-300 truncate max-w-[200px]">{fieldSignature.labelText}</span>
              </div>
            )}
          </div>

          {/* Folder selection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300">
              Escolha a Pasta a ser associada a este campo:
            </label>
            {folders.length === 0 ? (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Nenhuma pasta criada. Crie uma pasta primeiro no Gerenciador.</span>
              </div>
            ) : (
              <select
                value={selectedFolderId}
                onChange={(e) => setSelectedFolderId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 text-zinc-100 text-xs rounded-lg px-3 py-2 outline-none focus:border-amber-500"
              >
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    📁 {f.name} ({f.fills.length} Fills)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-between border-t border-zinc-800">
            {currentBinding ? (
              <button
                type="button"
                onClick={() => {
                  onRemoveBinding(currentBinding.id);
                  onClose();
                }}
                className="px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 text-xs rounded-lg font-medium flex items-center gap-1.5 transition"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remover Vínculo
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={folders.length === 0}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 text-xs font-bold rounded-lg transition"
              >
                {currentBinding ? 'Atualizar Vínculo' : 'Vincular Campo'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
