import { FONT } from '@/lib/admin-styles';

export type Period = 'today' | 'week' | 'all';

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Hoje',
  week: 'Esta Semana',
  all: 'Todo o Período',
};

export function getSinceDate(period: Period): Date | null {
  if (period === 'today') {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === 'week') {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return null;
}

/**
 * Janela do período anterior, para comparação "vs. período anterior" nos KPIs.
 * Retorna [início, fim) do período imediatamente antes do atual.
 * `null` quando o período é "todo o período" (não há comparação).
 */
export function getPreviousRange(period: Period): { from: Date; to: Date } | null {
  const since = getSinceDate(period);
  if (!since) return null;
  const spanMs = Date.now() - since.getTime();
  return { from: new Date(since.getTime() - spanMs), to: since };
}

interface PeriodFilterProps {
  value: Period;
  onChange: (period: Period) => void;
}

const PeriodFilter = ({ value, onChange }: PeriodFilterProps) => {
  const periods: Period[] = ['today', 'week', 'all'];

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {periods.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          style={{
            ...FONT,
            fontSize: 12,
            fontWeight: 700,
            padding: '4px 14px',
            borderRadius: 50,
            cursor: 'pointer',
            border: value === p ? 'none' : '0.5px solid #E8E0EE',
            background: value === p ? '#E5509C' : '#FFFFFF',
            color: value === p ? '#FFFFFF' : '#5A5A7A',
            transition: 'all 0.2s ease',
          }}
        >
          {PERIOD_LABELS[p]}
        </button>
      ))}
    </div>
  );
};

export default PeriodFilter;
