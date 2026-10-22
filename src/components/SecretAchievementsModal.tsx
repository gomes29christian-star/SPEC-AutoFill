import React, { useState, useRef, useEffect } from 'react';
import { SecretAchievement } from '../types';
import { Trophy, Lock, CheckCircle2, Eye, Sparkles, X, ShieldAlert } from 'lucide-react';

interface SecretAchievementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  achievements: SecretAchievement[];
  themeColor: string;
}

export const SecretAchievementsModal: React.FC<SecretAchievementsModalProps> = ({
  isOpen,
  onClose,
  achievements,
  themeColor,
}) => {
  const [holdingCardId, setHoldingCardId] = useState<string | null>(null);
  const [holdProgress, setHoldProgress] = useState<number>(0); // 0 a 100%
  const [revealedDescriptions, setRevealedDescriptions] = useState<Record<string, boolean>>({});
  const holdIntervalRef = useRef<number | null>(null);
  const holdStartTimeRef = useRef<number>(0);

  const HOLD_DURATION_MS = 5000; // 5 segundos exatos

  const startHold = (id: string, isLocked: boolean) => {
    if (!isLocked) return;
    setHoldingCardId(id);
    setHoldProgress(0);
    holdStartTimeRef.current = Date.now();

    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);

    holdIntervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - holdStartTimeRef.current;
      const progress = Math.min(100, (elapsed / HOLD_DURATION_MS) * 100);
      setHoldProgress(progress);

      if (elapsed >= HOLD_DURATION_MS) {
        clearInterval(holdIntervalRef.current!);
        holdIntervalRef.current = null;
        setHoldingCardId(null);
        setRevealedDescriptions((prev) => ({ ...prev, [id]: true }));
      }
    }, 40);
  };

  const cancelHold = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setHoldingCardId(null);
    setHoldProgress(0);
  };

  useEffect(() => {
    return () => {
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-zinc-800/80 border-b border-zinc-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <Trophy className="w-5 h-5 theme-stroke-icon text-amber-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <span className="theme-stroke-text">Conquistas Secretas</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-300 font-mono">
                  {unlockedCount} / {achievements.length}
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Segure o card de uma conquista bloqueada por 5 segundos para dissipar a névoa.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {achievements.map((item) => {
            const isRevealed = item.unlocked || revealedDescriptions[item.id];
            const isBeingHeld = holdingCardId === item.id;

            return (
              <div
                key={item.id}
                onMouseDown={() => startHold(item.id, !item.unlocked)}
                onMouseUp={cancelHold}
                onMouseLeave={cancelHold}
                onTouchStart={() => startHold(item.id, !item.unlocked)}
                onTouchEnd={cancelHold}
                className={`relative select-none transition-all duration-300 rounded-xl p-4 border overflow-hidden ${
                  item.unlocked
                    ? 'bg-zinc-800/60 border-amber-500/40 shadow-lg shadow-amber-500/5'
                    : 'bg-zinc-950/70 border-zinc-800 hover:border-zinc-700 cursor-pointer'
                }`}
              >
                {/* Hold Progress Bar overlay */}
                {isBeingHeld && (
                  <div
                    className="absolute inset-x-0 bottom-0 h-1.5 bg-amber-500 transition-all duration-75"
                    style={{ width: `${holdProgress}%` }}
                  />
                )}

                <div className="flex items-start gap-4">
                  {/* Icon badge */}
                  <div
                    className={`p-3 rounded-xl border flex items-center justify-center text-xl shrink-0 ${
                      item.unlocked
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-600'
                    }`}
                  >
                    {item.unlocked ? item.icon : <Lock className="w-5 h-5 text-zinc-600" />}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3
                        className={`font-semibold text-sm truncate ${
                          item.unlocked ? 'text-zinc-100 theme-stroke-text' : 'text-zinc-300'
                        }`}
                      >
                        {item.title}
                      </h3>
                      {item.unlocked ? (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Desbloqueado em {item.unlockedAt}
                        </span>
                      ) : (
                        <span className="text-[11px] text-zinc-500 flex items-center gap-1 font-mono">
                          <Lock className="w-3 h-3" /> Bloqueado
                        </span>
                      )}
                    </div>

                    {/* Description Area: Foggy / Invisible when locked, revealed on 5s hold */}
                    <div className="relative min-h-[38px] flex items-center mt-1">
                      {isRevealed ? (
                        <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                          {item.description}
                        </p>
                      ) : (
                        <div className="relative w-full py-2 px-3 rounded-lg bg-zinc-900/90 border border-zinc-800/80 overflow-hidden">
                          {/* Mystical Fog layer */}
                          <div
                            className="fog-shroud absolute inset-0 flex items-center justify-center transition-opacity duration-300"
                            style={{
                              opacity: isBeingHeld ? Math.max(0.15, 1 - holdProgress / 100) : 0.95,
                            }}
                          >
                            <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5 tracking-wide">
                              <Eye className="w-3 h-3 text-zinc-500" />
                              {isBeingHeld
                                ? `Dissipando névoa... ${(5 - (holdProgress / 100) * 5).toFixed(1)}s`
                                : 'Pressione e segure por 5s para revelar'}
                            </span>
                          </div>

                          {/* Concealed text under the fog */}
                          <p className="text-xs text-transparent select-none blur-sm pointer-events-none">
                            {item.description}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
          <span>Todas as datas registradas em formato brasileiro (dd/mm/aaaa).</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium rounded-lg transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
