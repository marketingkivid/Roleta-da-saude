import type { Tables } from '@/integrations/supabase/types';

type Prize = Tables<'prizes'>;

interface WeightDistributionProps {
  prizes: Prize[];
}

const COLORS = ['#E8357A', '#F47F4B', '#40C5E8', '#62BF7A', '#F6B02E'];

const WeightDistribution = ({ prizes }: WeightDistributionProps) => {
  const totalWeight = prizes.reduce((sum, p) => sum + p.weight, 0);

  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: 20,
        border: '0.5px solid #E8E0EE',
        padding: 16,
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E', fontFamily: 'Nunito, sans-serif' }}>Distribuição de probabilidade</h3>
      </div>

      {/* Progress bar */}
      <div className="flex overflow-hidden" style={{ borderRadius: 99, height: 6, background: '#E8E0EE' }}>
        {prizes.map((p, i) => {
          const pct = totalWeight > 0 ? (p.weight / totalWeight) * 100 : 0;
          return (
            <div
              key={p.id}
              style={{
                width: `${pct}%`,
                backgroundColor: COLORS[i % COLORS.length],
                minWidth: pct > 0 ? 8 : 0,
                transition: 'width 0.3s ease',
              }}
              title={`${p.name}: ${pct.toFixed(1)}%`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4">
        {prizes.map((p, i) => {
          const pct = totalWeight > 0 ? (p.weight / totalWeight) * 100 : 0;
          return (
            <div key={p.id} className="flex items-center gap-2">
              <span
                className="flex items-center justify-center shrink-0"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 20,
                  background: '#FFFFFF',
                  border: '1px solid #E8E0EE',
                  fontSize: 16,
                }}
              >
                {p.emoji}
              </span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E', fontFamily: 'Nunito, sans-serif' }}>{p.name}</p>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 13, color: '#9B8FAE', fontWeight: 400, fontFamily: 'Nunito, sans-serif' }}>{pct.toFixed(1)}%</span>
                  {!p.active && <span style={{ fontSize: 13, color: '#c0392b', fontFamily: 'Nunito, sans-serif' }}>(inativo)</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WeightDistribution;
