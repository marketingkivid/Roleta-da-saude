// Twemoji — renderização consistente de emojis em qualquer aparelho.
//
// Motivo: a fonte do projeto (Nunito) não tem glifos de emoji e alguns
// dispositivos/WebViews mostram "quadradinho" (tofu) no lugar. O Twemoji
// substitui cada emoji por um SVG colorido idêntico em iPhone, Android e desktop.
//
// Os SVGs são servidos localmente de `public/twemoji/svg/` (copiados de
// `@twemoji/svg` pelo script scripts/sync-twemoji.mjs — roda no predev/prebuild).
// Nada é buscado de CDN em runtime.

import type { CSSProperties, ReactNode } from 'react';
import twemoji from '@twemoji/api';
import emojiRegex from 'emoji-regex';

const BASE = '/twemoji/svg/';
const U200D = String.fromCharCode(0x200d);
const UFE0F = /️/g;

/**
 * Codepoint(s) do emoji no mesmo formato de arquivo do Twemoji
 * (ex.: "1f340", "1f1e7-1f1f7"). Réplica da lógica interna do twemoji:
 * remove o seletor de variação (FE0F) exceto quando há ZWJ (sequências).
 */
export function twemojiCodePoint(raw: string): string {
  return twemoji.convert.toCodePoint(
    raw.indexOf(U200D) < 0 ? raw.replace(UFE0F, '') : raw,
  );
}

/** URL local do SVG Twemoji para um emoji. `null` se `emoji` estiver vazio. */
export function twemojiUrl(emoji: string | null | undefined): string | null {
  const trimmed = (emoji ?? '').trim();
  if (!trimmed) return null;
  return `${BASE}${twemojiCodePoint(trimmed)}.svg`;
}

interface EmojiProps {
  /** O caractere emoji, ex.: "🍀". */
  emoji: string;
  /** Texto para leitores de tela. Use "" para puramente decorativo. */
  label?: string;
  className?: string;
  /** Tamanho (largura=altura). Número = px. Padrão: "1em" (acompanha a fonte). */
  size?: number | string;
  style?: CSSProperties;
}

/**
 * Um único emoji como imagem inline (contextos HTML). Alinha com o texto por
 * padrão. Se o emoji não resolver, cai no caractere original.
 */
export function Emoji({ emoji, label, className, size = '1em', style }: EmojiProps) {
  const url = twemojiUrl(emoji);
  const dim = typeof size === 'number' ? `${size}px` : size;
  if (!url) {
    return (
      <span role="img" aria-label={label || undefined} aria-hidden={label === '' ? true : undefined}>
        {emoji}
      </span>
    );
  }
  return (
    <img
      src={url}
      alt={label ?? emoji}
      aria-hidden={label === '' ? true : undefined}
      draggable={false}
      className={className}
      loading="lazy"
      decoding="async"
      style={{
        display: 'inline-block',
        height: dim,
        width: dim,
        verticalAlign: '-0.125em',
        objectFit: 'contain',
        ...style,
      }}
    />
  );
}

// ── Texto com emojis embutidos ────────────────────────────────────────────────

const RE = emojiRegex();

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

interface EmojiTextProps {
  children: string;
  className?: string;
  /** Tamanho dos emojis. Padrão "1.1em" (levemente maior que o texto). */
  emojiSize?: number | string;
  as?: 'span' | 'p' | 'div';
}

/**
 * Renderiza uma string trocando cada emoji por seu SVG Twemoji. Use quando o
 * texto mistura palavras e emojis.
 */
export function EmojiText({ children, className, emojiSize = '1.1em', as = 'span' }: EmojiTextProps) {
  const Tag = as;
  const dim = typeof emojiSize === 'number' ? `${emojiSize}px` : emojiSize;
  const text = children ?? '';
  const parts: ReactNode[] = [];
  let last = 0;
  let key = 0;
  const re = new RegExp(RE.source, RE.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const ch = m[0];
    const url = twemojiUrl(ch);
    parts.push(
      url ? (
        <img
          key={`e${key++}`}
          src={url}
          alt={ch}
          draggable={false}
          loading="lazy"
          decoding="async"
          style={{
            display: 'inline-block',
            height: dim,
            width: dim,
            verticalAlign: '-0.125em',
            objectFit: 'contain',
          }}
        />
      ) : (
        <span key={`e${key++}`}>{ch}</span>
      ),
    );
    last = m.index + ch.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <Tag className={className}>{parts}</Tag>;
}

/** Igual a EmojiText, mas para uso imperativo (dangerouslySetInnerHTML). */
export function emojiToHtml(text: string, opts: { size?: string } = {}): string {
  const size = opts.size ?? '1.1em';
  const re = new RegExp(RE.source, RE.flags);
  return escapeHtml(text ?? '').replace(re, (ch) => {
    const url = twemojiUrl(ch);
    if (!url) return ch;
    return `<img src="${url}" alt="${ch}" draggable="false" loading="lazy" decoding="async" style="display:inline-block;height:${size};width:${size};vertical-align:-0.125em;object-fit:contain" />`;
  });
}
