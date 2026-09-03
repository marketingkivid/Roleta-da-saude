import { describe, it, expect } from 'vitest';
import { getPreviousRange, getSinceDate } from '@/components/admin/PeriodFilter';

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
