import { describe, it, expect } from 'vitest';
import { getPreviousRange, getSinceDate } from '@/components/admin/PeriodFilter';
import { campaignUrl, campaignUrlLabel } from '@/lib/campaign-url';

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
  it('usa o domínio em que o app está servido (jsdom = localhost)', () => {
    expect(campaignUrl('minha-campanha')).toBe('http://localhost:3000/minha-campanha');
  });
  it('anexa o token quando há lista', () => {
    expect(campaignUrl('camp', 'abc123')).toBe('http://localhost:3000/camp?token=abc123');
  });
  it('label sem protocolo', () => {
    expect(campaignUrlLabel('promo')).toBe('localhost:3000/promo');
  });
});
