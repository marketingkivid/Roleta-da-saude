import { describe, it, expect } from 'vitest';
import { getPreviousRange, getSinceDate } from '@/components/admin/PeriodFilter';
import { campaignUrl, campaignUrlLabel, publicBaseUrl } from '@/lib/campaign-url';

describe('getPreviousRange', () => {
  it('devolve a janela imediatamente anterior à semana atual', () => {
    const since = getSinceDate('week')!;
    const prev = getPreviousRange('week')!;
    // termina exatamente onde o período atual começa
    expect(prev.to.getTime()).toBe(since.getTime());
    // tem a mesma duração do período atual decorrido (7 dias + tempo desde a meia-noite)
    const currentSpan = Date.now() - since.getTime();
    const prevSpan = prev.to.getTime() - prev.from.getTime();
    expect(Math.abs(prevSpan - currentSpan)).toBeLessThan(1000);
  });

  it('é null para "todo o período"', () => {
    expect(getPreviousRange('all')).toBeNull();
  });
});

describe('campaign-url', () => {
  const base = publicBaseUrl(); // VITE_PUBLIC_URL ou window.location.origin

  it('monta <base>/<slug>', () => {
    expect(campaignUrl('minha-campanha')).toBe(`${base}/minha-campanha`);
  });
  it('anexa o token quando há lista', () => {
    expect(campaignUrl('camp', 'abc123')).toBe(`${base}/camp?token=abc123`);
  });
  it('label é a URL sem protocolo', () => {
    expect(campaignUrlLabel('promo')).toBe(`${base}/promo`.replace(/^https?:\/\//, ''));
  });
  it('não deixa barra dupla nem protocolo faltando', () => {
    expect(campaignUrl('x')).toMatch(/^https?:\/\/[^/]+\/x$/);
  });
});
