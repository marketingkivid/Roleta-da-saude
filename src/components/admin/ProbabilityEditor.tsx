import { useState } from 'react';
import { Lock, Unlock, BarChart3 } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { FONT } from '@/lib/admin-styles';

const COLORS = ['#E8357A', '#F97316', '#06B6D4', '#22C55E', '#F6B02E'];

interface PrizeProb {
  id: string;
  name: string;
  emoji: string;
  probability: number;
}

interface ProbabilityEditorProps {
  prizes: PrizeProb[];
  onChange: (updated: { id: string; probability: number }[]) => void;
}

const sliderStyles = `
.prob-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 50px;
  outline: none;
  transition: all 0.2s ease;
}
.prob-slider::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 50px;
}
.prob-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--slider-color);
  cursor: pointer;
  margin-top: -6px;
  border: 2px solid #FFFFFF;
  box-shadow: 0 0 0 1px var(--slider-color);
  transition: all 0.2s ease;
}
.prob-slider::-moz-range-track {
  height: 6px;
  border-radius: 50px;
  background: #E8E0EE;
}
.prob-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--slider-color);
  cursor: pointer;
  border: 2px solid #FFFFFF;
  box-shadow: 0 0 0 1px var(--slider-color);
}
.prob-slider:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.prob-slider:disabled::-webkit-slider-thumb {
  cursor: not-allowed;
}
.prob-slider:disabled::-moz-range-thumb {
  cursor: not-allowed;
}
`;

const ProbabilityEditor = ({ prizes, onChange }: ProbabilityEditorProps) => {
  const [locked, setLocked] = useState<Record<string, boolean>>({});

  const total = prizes.reduce((s, p) => s + p.probability, 0);
  const isValid = total === 100;

  const toggleLock = (id: string) => {
    setLocked(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSlide = (id: string, newVal: number) => {
    const prize = prizes.find(p => p.id === id);
    if (!prize) return;

    const diff = newVal - prize.probability;
    if (diff === 0) return;

    const unlocked = prizes.filter(p => p.id !== id && !locked[p.id]);
    const sumUnlocked = unlocked.reduce((s, p) => s + p.probability, 0);

    let updated = prizes.map(p => {
      if (p.id === id) return { ...p, probability: newVal };
      if (locked[p.id]) return p;
      if (sumUnlocked === 0) return p;
      return {
        ...p,
        probability: Math.max(0, Math.round(p.probability - diff * (p.probability / sumUnlocked))),
      };
    });

    const currentSum = updated.reduce((s, p) => s + p.probability, 0);
    const delta = 100 - currentSum;
    if (delta !== 0) {
      const target = updated.find(p => !locked[p.id] && p.id !== id);
      if (target) target.probability = Math.max(0, target.probability + delta);
    }

    onChange(updated.map(p => ({ id: p.id, probability: p.probability })));
  };

  const distributeEqually = () => {
    const lockedPrizes = prizes.filter(p => locked[p.id]);
    const unlockedPrizes = prizes.filter(p => !locked[p.id]);
    if (unlockedPrizes.length === 0) return;

    const available = 100 - lockedPrizes.reduce((s, p) => s + p.probability, 0);
    const base = Math.floor(available / unlockedPrizes.length);
    const rest = available - base * unlockedPrizes.length;

    let unlockedIdx = 0;
    const updated = prizes.map(p => {
      if (locked[p.id]) return { id: p.id, probability: p.probability };
      const val = base + (unlockedIdx === 0 ? rest : 0);
      unlockedIdx++;
      return { id: p.id, probability: val };
    });

    onChange(updated);
  };

  const getSliderBackground = (value: number, color: string) => {
    return `linear-gradient(to right, ${color} 0%, ${color} ${value}%, #E8E0EE ${value}%, #E8E0EE 100%)`;
  };

  return (
    <div className="space-y-4">
      <style>{sliderStyles}</style>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3
            className="flex items-center gap-2"
            style={{ ...FONT, fontSize: 18, fontWeight: 700, color: '#1A1A2E' }}
          >
            <BarChart3 size={18} style={{ color: '#E8357A' }} />
            Probabilidade de sorteio
          </h3>
          <p style={{ ...FONT, fontSize: 13, color: '#9B8FAE', marginTop: 4 }}>
            ✓ {prizes.length} prêmios salvos — defina as chances de sorteio
          </p>
        </div>
        <button
          onClick={distributeEqually}
          className="transition-all hover:opacity-90 active:scale-[0.98]"
          style={{
            ...FONT,
            background: '#FFFFFF',
            color: '#5A5A7A',
            border: '1.5px solid #E8E0EE',
            borderRadius: 50,
            padding: '8px 20px',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Distribuir igualmente
        </button>
      </div>

      {/* Prize cards */}
      <div className="flex flex-col gap-3">
        {prizes.map((p, i) => {
          const color = COLORS[i % COLORS.length];
          const isLocked = !!locked[p.id];
          return (
            <div
              key={p.id}
              style={{
                background: '#FFFFFF',
                borderRadius: 20,
                border: '1px solid #E8E0EE',
                padding: '20px 24px',
                transition: 'all 0.2s ease',
              }}
            >
              <div className="flex items-center gap-3">
                <span style={{ fontSize: 20, flexShrink: 0 }}>{p.emoji}</span>
                <span
                  className="truncate"
                  style={{
                    ...FONT,
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#1A1A2E',
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {p.name}
                </span>
                <span
                  style={{
                    ...FONT,
                    fontSize: 16,
                    fontWeight: 700,
                    color,
                    fontVariantNumeric: 'tabular-nums',
                    minWidth: 48,
                    textAlign: 'right',
                    flexShrink: 0,
                  }}
                >
                  {p.probability}%
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => toggleLock(p.id)}
                      className="transition-all hover:opacity-80"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: isLocked ? '#E8357A' : '#9B8FAE',
                        padding: 4,
                        flexShrink: 0,
                      }}
                    >
                      {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isLocked ? 'Destravar valor' : 'Travar valor'}
                  </TooltipContent>
                </Tooltip>
              </div>

              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={p.probability}
                onChange={e => handleSlide(p.id, Number(e.target.value))}
                disabled={isLocked}
                className="prob-slider"
                style={{
                  '--slider-color': color,
                  marginTop: 12,
                  background: getSliderBackground(p.probability, color),
                } as React.CSSProperties}
              />
            </div>
          );
        })}
      </div>

      {/* Summary bar */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 20,
          border: '1px solid #E8E0EE',
          padding: 20,
        }}
      >
        <div
          className="flex overflow-hidden"
          style={{ borderRadius: 50, height: 10, background: '#E8E0EE' }}
        >
          {prizes.map((p, i) => (
            <div
              key={p.id}
              style={{
                width: `${p.probability}%`,
                backgroundColor: COLORS[i % COLORS.length],
                minWidth: p.probability > 0 ? 4 : 0,
                transition: 'width 0.2s ease',
              }}
              title={`${p.name}: ${p.probability}%`}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4">
          {prizes.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2">
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: COLORS[i % COLORS.length],
                  flexShrink: 0,
                }}
              />
              <span style={{ ...FONT, fontSize: 13, color: '#5A5A7A' }}>
                {p.emoji} {p.name}{' '}
                <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {p.probability}%
                </strong>
              </span>
            </div>
          ))}
        </div>

        {/* Total pill */}
        <div className="flex items-center justify-center mt-4">
          <span
            style={{
              ...FONT,
              fontSize: 14,
              fontWeight: 700,
              color: isValid ? '#16A34A' : total > 100 ? '#EF4444' : '#F59E0B',
              background: isValid ? '#DCFCE7' : total > 100 ? '#FEE2E2' : '#FFFBEB',
              borderRadius: 50,
              padding: '6px 20px',
              transition: 'all 0.2s ease',
            }}
          >
            Total: {total}% {isValid ? '✓' : total > 100 ? '↑' : '↓'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProbabilityEditor;
