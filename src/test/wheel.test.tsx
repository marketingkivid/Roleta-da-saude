import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { fitWheelLabel } from '@/lib/wheel-label';
import { sliceColor, WHEEL } from '@/lib/wheel-theme';
import { twemojiUrl } from '@/lib/twemoji';
import RouletteWheelPreview, { type PreviewPrize } from '@/components/admin/RouletteWheelPreview';

describe('wheel-theme', () => {
  it('alterna magenta × lavanda por índice', () => {
    expect(sliceColor(0)).toBe(WHEEL.sliceMagenta);
    expect(sliceColor(1)).toBe(WHEEL.sliceLavender);
    expect(sliceColor(2)).toBe(WHEEL.sliceMagenta);
  });
});

describe('fitWheelLabel', () => {
  it('nunca trunca com reticências', () => {
    const fitted = fitWheelLabel('PASSAPORTE FAMÍLIA INDIVIDUAL PREMIUM', 40, { minFont: 8, maxFont: 15, maxLines: 3 });
    expect(fitted.lines.join(' ')).not.toContain('…');
  });

  it('nunca corta uma palavra no meio', () => {
    const fitted = fitWheelLabel('PASSAPORTE FAMÍLIA', 30, { minFont: 8, maxFont: 15, maxLines: 3 });
    // toda linha é uma sequência de palavras inteiras do rótulo original
    const original = 'PASSAPORTE FAMÍLIA'.split(/\s+/);
    for (const line of fitted.lines) {
      for (const word of line.split(/\s+/)) {
        expect(original).toContain(word);
      }
    }
  });

  it('preserva o texto completo (nenhuma palavra some)', () => {
    const label = 'Copo térmico Kivid edição limitada';
    const fitted = fitWheelLabel(label, 44, { minFont: 8, maxFont: 15, maxLines: 3 });
    expect(fitted.lines.join(' ').replace(/\s+/g, ' ').trim()).toBe(label);
  });
});

describe('twemojiUrl', () => {
  it('resolve o SVG local do trevo', () => {
    expect(twemojiUrl('🍀')).toBe('/twemoji/svg/1f340.svg');
  });
  it('ignora o seletor de variação (🎟️ → 1f39f)', () => {
    expect(twemojiUrl('🎟️')).toBe('/twemoji/svg/1f39f.svg');
  });
  it('retorna null para vazio', () => {
    expect(twemojiUrl('')).toBeNull();
  });
});

describe('RouletteWheelPreview', () => {
  const prizes: PreviewPrize[] = [
    { name: '10% OFF', emoji: '🎟️', image_url: '', color_token: null, display_order: 0, is_consolation: false, weight: 1, show_image: false },
    { name: 'Camisa', emoji: '👕', image_url: '', color_token: null, display_order: 1, is_consolation: false, weight: 1, show_image: false },
    { name: 'Não foi dessa vez', emoji: '🍀', image_url: '', color_token: null, display_order: 2, is_consolation: true, weight: 3, show_image: false },
  ];

  it('renderiza emojis das fatias como SVG Twemoji (sem <text> de emoji)', () => {
    const { container } = render(<RouletteWheelPreview prizes={prizes} />);
    const images = [...container.querySelectorAll('image')].map((i) => i.getAttribute('href') || '');
    expect(images.some((h) => h.includes('/twemoji/svg/1f39f.svg'))).toBe(true); // 🎟️
    expect(images.some((h) => h.includes('/twemoji/svg/1f340.svg'))).toBe(true); // 🍀
    expect(images.some((h) => h.includes('kivid-mark'))).toBe(true);             // hub
  });

  it('usa a paleta magenta × lavanda nas fatias', () => {
    const { container } = render(<RouletteWheelPreview prizes={prizes} />);
    const fills = new Set([...container.querySelectorAll('path')].map((p) => p.getAttribute('fill')));
    expect(fills.has(WHEEL.sliceMagenta)).toBe(true);
    expect(fills.has(WHEEL.sliceLavender)).toBe(true);
  });
});
