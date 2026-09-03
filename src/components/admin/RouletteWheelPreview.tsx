import { SLICE_TOKENS } from './WheelConfig';
import { fitWheelLabel } from '@/lib/wheel-label';


export interface PreviewPrize {
  name: string;
  emoji: string;
  image_url: string;
  color_token: string | null;
  display_order: number;
  is_consolation: boolean;
  weight: number;
  show_image?: boolean;
}


interface Props {
  prizes: PreviewPrize[];
  size?: number;
}

// Kivid — Pitaya sobre branco
const PITAYA_600 = '#CF3A9D';
const PITAYA_800 = '#A82F7F';
const PITAYA_900 = '#942971';
const WHITE = '#FFFFFF';
const GOLD = PITAYA_600;       // aliases mantidos para reduzir mudanças
const GOLD_DEEP = PITAYA_900;
const PURPLE_DEEP = PITAYA_900;
const CREAM = WHITE;
const DEFAULT_COLORS = [PITAYA_600, PITAYA_800];

const tokenToHex = (token: string | null, i: number) => {
  const f = SLICE_TOKENS.find(t => t.token === token);
  return f ? f.hex : DEFAULT_COLORS[i % DEFAULT_COLORS.length];
};

const polar = (cx: number, cy: number, r: number, a: number) => ({
  x: cx + r * Math.cos(a),
  y: cy + r * Math.sin(a),
});

// Consolation-specific copy for the wheel preview slice label
const CONSOLATION_SLICE_LABEL = 'Não foi dessa vez';

const RouletteWheelPreview = ({ prizes, size = 300 }: Props) => {
  // Build interleaved segments: prize slices spread evenly, consolation copies fill the gaps.
  const ordered = [...prizes].sort((a, b) => a.display_order - b.display_order);
  const prizesOnly = ordered.filter(p => !p.is_consolation);
  const consExpanded: PreviewPrize[] = [];
  ordered
    .filter(p => p.is_consolation)
    .forEach(p => {
      const copies = Math.max(1, p.weight || 1);
      for (let i = 0; i < copies; i++) consExpanded.push(p);
    });

  const pc = prizesOnly.length;
  const cc = consExpanded.length;
  const total = pc + cc;
  const segments: PreviewPrize[] = new Array(total);
  if (pc === 0) {
    consExpanded.forEach((c, i) => { segments[i] = c; });
  } else {
    // Deterministic positions for prizes: pos_i = floor(i * total / pc)
    const takenPositions = new Set<number>();
    prizesOnly.forEach((p, i) => {
      const pos = Math.floor((i * total) / pc);
      segments[pos] = p;
      takenPositions.add(pos);
    });
    // Consolations fill remaining positions in order
    let cIdx = 0;
    for (let pos = 0; pos < total; pos++) {
      if (takenPositions.has(pos)) continue;
      segments[pos] = consExpanded[cIdx++];
    }
  }


  const n = segments.length;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 22;

  if (n < 2) {
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
          fontFamily: 'Nunito, sans-serif',
          color: '#9B8FAE',
          fontSize: 13,
          textAlign: 'center',
          padding: 20,
        }}
      >
        Adicione ao menos 2 fatias para ver a prévia
      </div>
    );
  }

  const sliceAngle = (Math.PI * 2) / n;
  let cursor = -Math.PI / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      <defs>
        <radialGradient id="prevRim" cx="50%" cy="50%" r="50%">
          <stop offset="90%" stopColor={GOLD} />
          <stop offset="100%" stopColor={GOLD_DEEP} />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r + 12} fill="url(#prevRim)" />
      <circle cx={cx} cy={cy} r={r + 4} fill={PURPLE_DEEP} />

      {segments.map((seg, i) => {
        const start = cursor;
        const end = cursor + sliceAngle;
        cursor = end;
        const p0 = polar(cx, cy, r, start);
        const p1 = polar(cx, cy, r, end);
        const largeArc = sliceAngle > Math.PI ? 1 : 0;
        const path = `M ${cx} ${cy} L ${p0.x} ${p0.y} A ${r} ${r} 0 ${largeArc} 1 ${p1.x} ${p1.y} Z`;
        const mid = start + sliceAngle / 2;
        const lp = polar(cx, cy, r * 0.78, mid);
        const color = tokenToHex(seg.color_token, seg.display_order ?? i);
        const arcAtLabel = (2 * Math.PI * (r * 0.78)) / n;
        const arcWidth = Math.max(20, arcAtLabel * 0.9);
        const showImage = seg.show_image !== false;
        const hasImage = showImage && !!seg.image_url;
        const emoji = (seg.emoji || '').trim();
        const rawLabel = seg.is_consolation ? CONSOLATION_SLICE_LABEL : (seg.name || '');
        const midDeg = (mid * 180) / Math.PI;
        const clipId = `prev-clip-${i}`;

        if (hasImage) {
          // Image inner half, name text on outer band — same layout rules as the live wheel.
          const imgCenterR = r * 0.38;
          const imgH = r * 0.55;
          const imgW = Math.max(16, 2 * imgCenterR * Math.tan(sliceAngle / 2) + 6);
          const imgCx = cx + imgCenterR * Math.cos(mid);
          const imgCy = cy + imgCenterR * Math.sin(mid);
          const textR = r * 0.82;
          const textArc = Math.max(24, (2 * Math.PI * textR) / n * 0.9);
          const fitted = fitWheelLabel(rawLabel, textArc, { minFont: 8, maxFont: 12, maxLines: 2 });
          const textPos = polar(cx, cy, textR, mid);
          return (
            <g key={i}>
              <path d={path} fill={color} stroke={WHITE} strokeWidth={1.5} />
              <defs>
                <clipPath id={clipId}>
                  <path d={path} />
                </clipPath>
              </defs>
              <g clipPath={`url(#${clipId})`}>
                <g transform={`translate(${imgCx} ${imgCy}) rotate(${midDeg + 90})`}>
                  <image
                    href={seg.image_url}
                    x={-imgW / 2}
                    y={-imgH / 2}
                    width={imgW}
                    height={imgH}
                    preserveAspectRatio="xMidYMid meet"
                  />
                </g>
                {fitted.lines.length > 0 && (
                  <g transform={`translate(${textPos.x} ${textPos.y}) rotate(${midDeg + 90})`}>
                    <text
                      x={0}
                      y={-((fitted.lines.length - 1) * fitted.lineHeight) / 2}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={fitted.fontSize}
                      fontWeight={800}
                      fill={CREAM}
                      stroke={PURPLE_DEEP}
                      strokeWidth={2}
                      strokeLinejoin="round"
                      paintOrder="stroke"
                      style={{ fontFamily: 'Nunito, sans-serif' }}
                    >
                      {fitted.lines.map((line, li) => (
                        <tspan key={li} x={0} dy={li === 0 ? 0 : fitted.lineHeight}>
                          {line}
                        </tspan>
                      ))}
                    </text>
                  </g>
                )}
              </g>
            </g>
          );
        }

        // No image — emoji + wrapped text stacked.
        const fitted = fitWheelLabel(rawLabel, arcWidth, { minFont: 7, maxFont: 12, maxLines: 3 });
        const textSize = fitted.fontSize;
        const lineH = fitted.lineHeight;
        const lineCount = fitted.lines.length;
        const iconCap = lineCount >= 3 ? 18 : lineCount === 2 ? 22 : 26;
        const iconR = Math.max(12, Math.min(iconCap, Math.floor(arcAtLabel / (3 + Math.max(0, lineCount - 1) * 0.6))));
        const gap = 1;
        const totalTextH = lineCount * lineH;
        const groupH = (emoji ? iconR : 0) + (emoji && lineCount ? gap : 0) + totalTextH;
        const startY = -groupH / 2;
        const emojiY = emoji ? startY + iconR / 2 : 0;
        const textStartY = startY + (emoji ? iconR + gap : 0) + lineH / 2;
        return (
          <g key={i}>
            <path d={path} fill={color} stroke={WHITE} strokeWidth={1.5} />
            <g transform={`translate(${lp.x} ${lp.y}) rotate(${midDeg + 90})`}>
              {emoji && (
                <text
                  x={0}
                  y={emojiY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={iconR}
                >
                  {emoji}
                </text>
              )}
              {lineCount > 0 && (
                <text
                  x={0}
                  y={textStartY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={textSize}
                  fontWeight={800}
                  fill={CREAM}
                  style={{ fontFamily: 'Nunito, sans-serif' }}
                >
                  {fitted.lines.map((line, li) => (
                    <tspan key={li} x={0} dy={li === 0 ? 0 : lineH}>
                      {line}
                    </tspan>
                  ))}
                </text>
              )}
            </g>
          </g>
        );
      })}




      {/* Pointer */}
      <polygon points={`${cx - 8},2 ${cx + 8},2 ${cx},20`} fill={GOLD} stroke={GOLD_DEEP} strokeWidth={1.5} />

      {/* Hub */}
      <circle cx={cx} cy={cy} r={22} fill={GOLD} stroke={GOLD_DEEP} strokeWidth={1.5} />
      <circle cx={cx} cy={cy} r={16} fill={PURPLE_DEEP} stroke={GOLD} strokeWidth={1} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={14} fill={GOLD} fontWeight={900}>★</text>
    </svg>
  );
};

export default RouletteWheelPreview;
