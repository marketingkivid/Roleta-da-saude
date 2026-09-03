// Responsive wrap-and-fit for wheel slice labels.
// Splits text into up to `maxLines` lines, shrinking the font size until every
// word fits inside `arcWidth` (approx horizontal space in the rotated slice).
// Never truncates with "…" — long labels wrap or shrink so nothing is hidden.
export interface FittedLabel {
  lines: string[];
  fontSize: number;
  lineHeight: number;
}

export function fitWheelLabel(
  text: string,
  arcWidth: number,
  opts: { minFont?: number; maxFont?: number; maxLines?: number } = {}
): FittedLabel {
  const minFont = opts.minFont ?? 8;
  const maxFont = opts.maxFont ?? 16;
  const maxLines = opts.maxLines ?? 3;
  const raw = (text || '').trim();
  if (!raw) return { lines: [], fontSize: maxFont, lineHeight: maxFont * 1.1 };

  const words = raw.split(/\s+/).filter(Boolean);

  const tryWrap = (fs: number): string[] | null => {
    // Bold Nunito is ~0.58× em wide per char; keep a small safety margin.
    const charW = fs * 0.58;
    const maxChars = Math.max(2, Math.floor(arcWidth / charW));
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      if (w.length > maxChars) return null; // word doesn't fit at this size
      const cand = cur ? cur + ' ' + w : w;
      if (cand.length <= maxChars) cur = cand;
      else {
        lines.push(cur);
        cur = w;
        if (lines.length >= maxLines) return null;
      }
    }
    if (cur) lines.push(cur);
    return lines.length <= maxLines ? lines : null;
  };

  for (let fs = maxFont; fs >= minFont; fs--) {
    const lines = tryWrap(fs);
    if (lines) return { lines, fontSize: fs, lineHeight: fs * 1.1 };
  }

  // Last resort — hard character-break at the smallest size.
  const fs = minFont;
  const charW = fs * 0.58;
  const maxChars = Math.max(2, Math.floor(arcWidth / charW));
  const lines: string[] = [];
  for (let i = 0; i < raw.length && lines.length < maxLines; i += maxChars) {
    lines.push(raw.slice(i, i + maxChars));
  }
  return { lines, fontSize: fs, lineHeight: fs * 1.1 };
}
