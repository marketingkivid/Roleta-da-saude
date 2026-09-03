import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Participation {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  played_at: string;
  prizes: { name: string; emoji: string } | null;
}

const ParticipationList = () => {
  const [items, setItems] = useState<Participation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('participations')
        .select('id, name, email, whatsapp, played_at, prizes(name, emoji)')
        .order('played_at', { ascending: false })
        .limit(100);
      if (data) setItems(data as unknown as Participation[]);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-2xl kv-skeleton" />)}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-12 text-center" style={{ background: 'var(--kv-surface)', borderRadius: 16, border: '0.5px solid var(--kv-border)' }}>
        <p style={{ fontSize: 32 }}>🎮</p>
        <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--kv-text-dark)', marginTop: 8 }}>Nenhuma participação ainda</p>
        <p style={{ fontSize: 14, color: '#aaa', marginTop: 4 }}>As participações aparecerão aqui em tempo real</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" style={{ fontFamily: '"Red Hat Display", sans-serif' }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--kv-text-dark)' }}>Participações recentes</h2>
      <div style={{ background: 'var(--kv-surface)', borderRadius: 16, border: '0.5px solid var(--kv-border)', overflow: 'hidden' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '0.5px solid var(--kv-border)' }}>
                {['NOME', 'E-MAIL', 'WHATSAPP', 'PRÊMIO', 'DATA'].map((h) => (
                  <th key={h} className="text-left px-4 py-3" style={{ fontSize: 10, fontWeight: 700, color: '#ccc', letterSpacing: 0.5 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((p, i) => (
                <tr key={p.id} style={{ borderBottom: i < items.length - 1 ? '0.5px solid var(--kv-bg)' : 'none' }}>
                  <td className="px-4 py-2" style={{ fontSize: 13, fontWeight: 700, color: 'var(--kv-text-dark)' }}>{p.name}</td>
                  <td className="px-4 py-2" style={{ fontSize: 12, color: '#888' }}>{p.email}</td>
                  <td className="px-4 py-2" style={{ fontSize: 12, color: '#888' }}>{p.whatsapp}</td>
                  <td className="px-4 py-2" style={{ fontSize: 13, color: 'var(--kv-text-dark)' }}>
                    {p.prizes ? `${p.prizes.emoji} ${p.prizes.name}` : '—'}
                  </td>
                  <td className="px-4 py-2" style={{ fontSize: 12, color: '#888' }}>
                    {new Date(p.played_at).toLocaleString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ParticipationList;
