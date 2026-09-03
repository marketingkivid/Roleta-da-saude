import { ArrowDown, ArrowUp, AlertTriangle } from 'lucide-react';
import { FONT, inputStyle, labelStyle, helperStyle, focusHandler, blurHandler } from '@/lib/admin-styles';

export interface WheelPrize {
  id?: string;
  name: string;
  emoji: string;
  weight: number;
  color_token: string | null;
  display_order: number;
  quantity_available: string; // stock, '' = ilimitado
  _deleted?: boolean;
}

interface WheelConfigProps {
  prizes: WheelPrize[];
  onUpdate: (index: number, patch: Partial<WheelPrize>) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

// Curated slice palette — Kivid DS tokens (family-shade → hex)
export const SLICE_TOKENS: { token: string; hex: string; label: string }[] = [
  // Ordenados no círculo cromático para combinações harmônicas na roda
  { token: 'pitaya-500', hex: '#E645B0', label: 'Pitaya' },
  { token: 'pitaya-300', hex: '#F090D0', label: 'Pitaya suave' },
  { token: 'blackberry-500', hex: '#E65245', label: 'Blackberry' },
  { token: 'tangerine-500', hex: '#FF8B59', label: 'Tangerine' },
  { token: 'tangerine-300', hex: '#FFC1A6', label: 'Tangerine suave' },
  { token: 'mango-500', hex: '#FABE57', label: 'Mango' },
  { token: 'mango-300', hex: '#FCD89A', label: 'Mango suave' },
  { token: 'pear-500', hex: '#3DCC78', label: 'Pear' },
  { token: 'pear-700', hex: '#30A260', label: 'Pear escuro' },
  { token: 'pear-300', hex: '#90E0B1', label: 'Pear suave' },
  { token: 'java-500', hex: '#43C1E0', label: 'Java' },
  { token: 'java-700', hex: '#2595BA', label: 'Java escuro' },
  { token: 'java-300', hex: '#A6DFED', label: 'Java suave' },
  { token: 'grape-500', hex: '#7A50D9', label: 'Grape' },
  { token: 'grape-300', hex: '#B9A0F2', label: 'Grape suave' },
];

const tokenToHex = (token: string | null, fallbackIndex: number) => {
  const found = SLICE_TOKENS.find(t => t.token === token);
  if (found) return found.hex;
  return SLICE_TOKENS[fallbackIndex % SLICE_TOKENS.length].hex;
};

const polar = (cx: number, cy: number, r: number, angleRad: number) => ({
  x: cx + r * Math.cos(angleRad),
  y: cy + r * Math.sin(angleRad),
});

interface WheelPreviewProps {
  segments: { label: string; emoji: string; weight: number; color: string }[];
  size?: number;
}

export const WheelPreview = ({ segments, size = 260 }: WheelPreviewProps) => {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 6;
  const totalWeight = segments.reduce((s, seg) => s + Math.max(0, seg.weight), 0);

  if (segments.length < 2 || totalWeight <= 0) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          border: '2px dashed #E8E0EE',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#FFFFFF',
          ...FONT,
          color: '#9B8FAE',
          fontSize: 13,
          textAlign: 'center',
          padding: 20,
        }}
      >
        Adicione ao menos 2 prêmios com peso &gt; 0 para pré-visualizar a roda
      </div>
    );
  }

  let cursor = -Math.PI / 2; // start at top
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      <circle cx={cx} cy={cy} r={r + 4} fill="#FFFFFF" stroke="#E8E0EE" strokeWidth={1.5} />
      {segments.map((seg, i) => {
        const frac = Math.max(0, seg.weight) / totalWeight;
        const angle = frac * Math.PI * 2;
        const start = cursor;
        const end = cursor + angle;
        cursor = end;
        const p0 = polar(cx, cy, r, start);
        const p1 = polar(cx, cy, r, end);
        const largeArc = angle > Math.PI ? 1 : 0;
        const path =
          frac >= 0.999
            ? `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`
            : `M ${cx} ${cy} L ${p0.x} ${p0.y} A ${r} ${r} 0 ${largeArc} 1 ${p1.x} ${p1.y} Z`;
        const mid = start + angle / 2;
        const labelPos = polar(cx, cy, r * 0.62, mid);
        const showLabel = frac > 0.06;
        return (
          <g key={i}>
            <path d={path} fill={seg.color} stroke="#FFFFFF" strokeWidth={2} />
            {showLabel && (
              <text
                x={labelPos.x}
                y={labelPos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={frac > 0.15 ? 18 : 14}
                fontFamily="Nunito, sans-serif"
              >
                {seg.emoji}
              </text>
            )}
          </g>
        );
      })}
      {/* Center hub */}
      <circle cx={cx} cy={cy} r={16} fill="#FFFFFF" stroke="#E8E0EE" strokeWidth={2} />
      {/* Pointer */}
      <polygon
        points={`${cx - 8},4 ${cx + 8},4 ${cx},22`}
        fill="#E8357A"
        stroke="#FFFFFF"
        strokeWidth={1.5}
      />
    </svg>
  );
};

const WheelConfig = ({ prizes, onUpdate, onReorder }: WheelConfigProps) => {
  const activeIndices = prizes
    .map((p, i) => ({ p, i }))
    .filter(x => !x.p._deleted);

  // Ordered by display_order for preview + list
  const ordered = [...activeIndices].sort(
    (a, b) => (a.p.display_order ?? 0) - (b.p.display_order ?? 0),
  );

  const segments = ordered.map(({ p }, idx) => ({
    label: p.name || `Prêmio ${idx + 1}`,
    emoji: p.emoji,
    weight: Number(p.weight) || 0,
    color: tokenToHex(p.color_token, idx),
  }));

  const totalWeight = segments.reduce((s, x) => s + x.weight, 0);
  const errors: string[] = [];
  if (ordered.length < 2) errors.push('Adicione pelo menos 2 prêmios para formar a roda.');
  if (ordered.some(({ p }) => Number(p.weight) <= 0))
    errors.push('Todos os pesos devem ser maiores que 0.');

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-6">
      {/* List of segments */}
      <div className="space-y-3">
        {ordered.length === 0 && (
          <div
            style={{
              ...FONT,
              background: '#FFFFFF',
              border: '1.5px dashed #E8E0EE',
              borderRadius: 16,
              padding: 20,
              color: '#9B8FAE',
              fontSize: 14,
              textAlign: 'center',
            }}
          >
            Cadastre prêmios na etapa "Prêmios" para configurar a roda.
          </div>
        )}

        {ordered.map(({ p, i }, orderedIdx) => {
          const isFirst = orderedIdx === 0;
          const isLast = orderedIdx === ordered.length - 1;
          const swatchHex = tokenToHex(p.color_token, orderedIdx);
          const pct = totalWeight > 0 ? Math.round((Number(p.weight) / totalWeight) * 100) : 0;

          return (
            <div
              key={p.id ?? i}
              style={{
                background: '#FFFFFF',
                border: '1px solid #E8E0EE',
                borderRadius: 16,
                padding: 14,
                ...FONT,
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2" style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E' }}>
                  <span
                    aria-hidden
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      background: swatchHex,
                      border: '1.5px solid #FFFFFF',
                      boxShadow: '0 0 0 1px #E8E0EE',
                      display: 'inline-block',
                    }}
                  />
                  <span>{p.emoji} {p.name || `Prêmio ${orderedIdx + 1}`}</span>
                  <span style={{ fontSize: 12, color: '#9B8FAE', fontWeight: 400 }}>
                    · {pct}% da roda
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={isFirst}
                    onClick={() => onReorder(i, prizes.indexOf(ordered[orderedIdx - 1].p))}
                    aria-label="Mover para cima"
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #E8E0EE',
                      borderRadius: 8,
                      padding: 6,
                      cursor: isFirst ? 'not-allowed' : 'pointer',
                      opacity: isFirst ? 0.4 : 1,
                      color: '#5A5A7A',
                    }}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={isLast}
                    onClick={() => onReorder(i, prizes.indexOf(ordered[orderedIdx + 1].p))}
                    aria-label="Mover para baixo"
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #E8E0EE',
                      borderRadius: 8,
                      padding: 6,
                      cursor: isLast ? 'not-allowed' : 'pointer',
                      opacity: isLast ? 0.4 : 1,
                      color: '#5A5A7A',
                    }}
                  >
                    <ArrowDown size={14} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={labelStyle}>Peso (chance relativa)</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={p.weight}
                    onChange={e => onUpdate(i, { weight: Number(e.target.value) || 0 })}
                    style={inputStyle}
                    onFocus={focusHandler}
                    onBlur={blurHandler}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Estoque (vazio = ilimitado)</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={p.quantity_available}
                    onChange={e => onUpdate(i, { quantity_available: e.target.value })}
                    placeholder="Ilimitado"
                    style={inputStyle}
                    onFocus={focusHandler}
                    onBlur={blurHandler}
                  />
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <label style={labelStyle}>Cor da fatia</label>
                <div className="flex flex-wrap gap-2">
                  {SLICE_TOKENS.map(t => {
                    const selected = p.color_token === t.token;
                    return (
                      <button
                        key={t.token}
                        type="button"
                        onClick={() => onUpdate(i, { color_token: t.token })}
                        aria-label={t.label}
                        aria-pressed={selected}
                        title={`${t.label} (${t.token})`}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: t.hex,
                          border: selected ? '2.5px solid #1A1A2E' : '2px solid #FFFFFF',
                          boxShadow: '0 0 0 1px #E8E0EE',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      />
                    );
                  })}
                </div>
                <p style={helperStyle}>
                  Token: <b style={{ color: '#5A5A7A' }}>{p.color_token ?? 'auto'}</b>
                </p>
              </div>
            </div>
          );
        })}

        {errors.length > 0 && (
          <div
            style={{
              ...FONT,
              background: '#FEF2F2',
              border: '1px solid #FCA5A5',
              borderRadius: 12,
              padding: '10px 14px',
              color: '#B91C1C',
              fontSize: 13,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              {errors.map((e, i) => (
                <div key={i}>{e}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Live preview */}
      <div className="flex flex-col items-center gap-2" style={{ ...FONT, position: 'sticky', top: 12, alignSelf: 'start' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#9B8FAE', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Prévia ao vivo
        </span>
        <WheelPreview segments={segments} />
        <span style={{ fontSize: 12, color: '#9B8FAE' }}>
          {ordered.length} segmento{ordered.length === 1 ? '' : 's'} · peso total {totalWeight}
        </span>
      </div>
    </div>
  );
};

export default WheelConfig;
