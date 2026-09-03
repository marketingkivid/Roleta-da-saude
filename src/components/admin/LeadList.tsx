import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Search, Download } from 'lucide-react';
import { Emoji } from '@/lib/twemoji';

interface Lead {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  cpf: string | null;
  played_at: string;
  prizes: { name: string; emoji: string } | null;
  campaigns: { name: string } | null;
}

const exportToCSV = (leads: Lead[]) => {
  const header = 'Nome,Email,WhatsApp,CPF,Prêmio,Campanha,Data';
  const rows = leads.map((p) => {
    const prize = p.prizes ? `${p.prizes.emoji} ${p.prizes.name}` : '';
    const campaign = p.campaigns?.name ?? '';
    const date = new Date(p.played_at).toLocaleString('pt-BR');
    return [p.name, p.email, p.whatsapp, p.cpf ?? '', prize, campaign, date]
      .map((v) => `"${v.replace(/"/g, '""')}"`)
      .join(',');
  });
  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const LeadList = () => {
  const [items, setItems] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchLeads = async () => {
      const { data } = await supabase
        .from('participations')
        .select('id, name, email, whatsapp, cpf, played_at, prizes(name, emoji), campaigns(name)')
        .order('played_at', { ascending: false })
        .limit(500);
      if (data) setItems(data as unknown as Lead[]);
      setLoading(false);
    };
    fetchLeads();
  }, []);

  const filtered = items.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || p.whatsapp.includes(q);
  });

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-[20px] kv-skeleton" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1A1A2E', fontFamily: 'Nunito, sans-serif' }}>Leads</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" style={{ width: 16, height: 16, color: '#9B8FAE' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="outline-none transition-colors"
              style={{
                border: '1.5px solid #E8E0EE',
                borderRadius: 20,
                padding: '7px 12px 7px 36px',
                fontSize: 16,
                background: '#FFFFFF',
                fontFamily: 'Nunito, sans-serif',
                color: '#1A1A2E',
                width: 220,
              }}
              onFocus={e => e.target.style.borderColor = '#E8357A'}
              onBlur={e => e.target.style.borderColor = '#E8E0EE'}
            />
          </div>
          <button
            onClick={() => exportToCSV(filtered)}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 transition-all hover:opacity-90 active:scale-[0.98]"
            style={{
              background: '#FFFFFF',
              color: '#5A5A7A',
              border: '1.5px solid #E8E0EE',
              borderRadius: 50,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'Nunito, sans-serif',
            }}
          >
            <Download style={{ width: 14, height: 14 }} />
            Exportar CSV
          </button>
        </div>
      </div>

      <p style={{ fontSize: 13, color: '#9B8FAE', fontFamily: 'Nunito, sans-serif' }}>{filtered.length} resultado(s)</p>

      {filtered.length === 0 ? (
        <div className="py-12 text-center" style={{ background: '#FFFFFF', borderRadius: 20, border: '0.5px solid #E8E0EE' }}>
          <p><Emoji emoji="👥" label="" size={32} /></p>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E', marginTop: 8, fontFamily: 'Nunito, sans-serif' }}>Nenhum lead encontrado</p>
          <p style={{ fontSize: 16, color: '#5A5A7A', marginTop: 4, fontFamily: 'Nunito, sans-serif' }}>Os leads aparecerão aqui após as participações</p>
        </div>
      ) : (
        <div style={{ background: '#FFFFFF', borderRadius: 20, border: '0.5px solid #E8E0EE', overflow: 'hidden' }}>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontFamily: 'Nunito, sans-serif' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E8E0EE' }}>
                  {['NOME', 'E-MAIL', 'WHATSAPP', 'PRÊMIO', 'CAMPANHA', 'DATA'].map((h) => (
                    <th key={h} className="text-left px-4 py-3" style={{ fontSize: 13, fontWeight: 400, color: '#9B8FAE', letterSpacing: 0.5 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={p.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                    <td className="px-4 py-3" style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E' }}>{p.name}</td>
                    <td className="px-4 py-3" style={{ fontSize: 16, color: '#5A5A7A' }}>{p.email}</td>
                    <td className="px-4 py-3" style={{ fontSize: 16, color: '#5A5A7A' }}>{p.whatsapp}</td>
                    <td className="px-4 py-3" style={{ fontSize: 16, color: '#1A1A2E' }}>
                      {p.prizes ? `${p.prizes.emoji} ${p.prizes.name}` : '—'}
                    </td>
                    <td className="px-4 py-3" style={{ fontSize: 16, color: '#5A5A7A' }}>{p.campaigns?.name ?? '—'}</td>
                    <td className="px-4 py-3" style={{ fontSize: 16, color: '#5A5A7A' }}>
                      {new Date(p.played_at).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadList;
