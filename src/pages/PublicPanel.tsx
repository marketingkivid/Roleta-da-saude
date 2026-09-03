import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import PeriodFilter, { type Period } from '@/components/admin/PeriodFilter';
import { FONT, CARD } from '@/lib/admin-styles';
import KividLogo from '@/assets/kivid-logo.svg';

const CODE_KEY = 'kivid_panel_code';

interface PanelData {
  generatedAt: string;
  campaigns: { id: string; name: string; slug: string; active: boolean; start_date: string; end_date: string; participants: number }[];
  kpis: {
    revenue: number; revenueChange: string;
    leads: number; leadsChange: string;
    spins: number; spinsChange: string;
    conversion: number; conversionChange: string;
  };
  daily: { date: string; count: number }[];
  hourly: { hour: string; count: number }[];
  distribution: { prize: string; consolation: boolean; count: number }[];
}

const fmt = (n: number) => n.toLocaleString('pt-BR');
const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const Badge = ({ value }: { value: string }) => {
  if (value === '—') return <span style={{ ...FONT, fontSize: 11, color: '#9B8FAE' }}>—</span>;
  const up = value.startsWith('+');
  return (
    <span style={{
      ...FONT, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 50,
      background: up ? '#DCFCE7' : '#FEE2E2', color: up ? '#22C55E' : '#EF4444',
    }}>{value}</span>
  );
};

const chartTooltip = { borderRadius: 20, border: '0.5px solid #E8E0EE', background: '#FFF', fontSize: 13, ...FONT };

const PublicPanel = () => {
  const isMobile = useIsMobile();
  const [code, setCode] = useState<string>(() => {
    try { return sessionStorage.getItem(CODE_KEY) || ''; } catch { return ''; }
  });
  const [codeInput, setCodeInput] = useState('');
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<Period>('week');
  const [campaign, setCampaign] = useState<string>('all');
  const [data, setData] = useState<PanelData | null>(null);

  const fetchPanel = useCallback(async (accessCode: string, p: Period, camp: string) => {
    setLoading(true);
    setError('');
    const { data: res, error: err } = await supabase.functions.invoke('public-dashboard', {
      body: { period: p, campaign_id: camp === 'all' ? null : camp },
      headers: { 'x-panel-code': accessCode },
    });
    setLoading(false);
    if (err || !res || (res as { error?: string }).error) {
      const code = (res as { error?: string })?.error;
      if (code === 'invalid_code') {
        setError('Código incorreto.');
        setAuthed(false);
        try { sessionStorage.removeItem(CODE_KEY); } catch { /* noop */ }
        return;
      }
      if (code === 'panel_not_configured') {
        setError('O painel ainda não foi configurado (falta definir o código de acesso).');
        return;
      }
      setError('Não foi possível carregar o painel. Tente de novo.');
      return;
    }
    setData(res as PanelData);
    setAuthed(true);
    try { sessionStorage.setItem(CODE_KEY, accessCode); } catch { /* noop */ }
  }, []);

  // Auto-login se já tem código salvo
  useEffect(() => {
    if (code) fetchPanel(code, period, campaign);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch ao trocar período/campanha (só depois de autenticado)
  useEffect(() => {
    if (authed && code) fetchPanel(code, period, campaign);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, campaign]);

  if (!authed) {
    return (
      <main className="min-h-dvh flex items-center justify-center px-4" style={{ background: '#f8f9f9', ...FONT }}>
        <form
          onSubmit={(e) => { e.preventDefault(); setCode(codeInput.trim()); fetchPanel(codeInput.trim(), period, campaign); }}
          className="w-full max-w-sm p-8 space-y-5"
          style={{ background: '#FFFFFF', border: '1px solid #E8E0EE', borderRadius: 20 }}
        >
          <div className="text-center space-y-2">
            <img src={KividLogo} alt="Kivid" className="h-9 mx-auto" />
            <p style={{ fontSize: 13, color: '#9B8FAE' }}>Painel de resultados</p>
          </div>
          <div>
            <label style={{ fontSize: 13, color: '#9B8FAE', display: 'block', marginBottom: 6 }}>Código de acesso</label>
            <input
              type="password"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              autoFocus
              className="w-full outline-none"
              style={{ border: '1.5px solid #E8E0EE', borderRadius: 20, padding: '13px 16px', fontSize: 16, ...FONT, color: '#1A1A2E' }}
              onFocus={(e) => (e.target.style.borderColor = '#E8357A')}
              onBlur={(e) => (e.target.style.borderColor = '#E8E0EE')}
            />
          </div>
          {error && <p style={{ fontSize: 14, color: '#c0392b' }}>{error}</p>}
          <button
            type="submit"
            disabled={loading || !codeInput.trim()}
            className="w-full transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
            style={{ background: '#E8357A', color: '#fff', borderRadius: 50, padding: '12px 20px', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', ...FONT }}
          >
            {loading ? 'Entrando…' : 'Ver o painel'}
          </button>
          <p style={{ fontSize: 12, color: '#9B8FAE', textAlign: 'center', lineHeight: 1.5 }}>
            Somente números agregados. Nenhum dado pessoal de participantes é exibido aqui.
          </p>
        </form>
      </main>
    );
  }

  const k = data?.kpis;
  const kpiCards = [
    { label: 'RECEITA', value: k ? fmtBRL(k.revenue) : '—', badge: k?.revenueChange ?? '—', dark: true },
    { label: 'LEADS', value: k ? fmt(k.leads) : '—', badge: k?.leadsChange ?? '—', color: '#F47F4B' },
    { label: 'GIROS', value: k ? fmt(k.spins) : '—', badge: k?.spinsChange ?? '—', color: '#40C5E8' },
    { label: 'CONVERSÃO', value: k ? `${k.conversion}%` : '—', badge: k?.conversionChange ?? '—', color: '#62BF7A' },
  ];
  const maxDist = Math.max(1, ...(data?.distribution ?? []).map((d) => d.count));

  return (
    <div className="min-h-dvh" style={{ background: '#f8f9f9', ...FONT }}>
      <header style={{ background: '#FFFFFF', borderBottom: '1px solid #E8E0EE', padding: '14px 16px' }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={KividLogo} alt="Kivid" className="h-6" />
            <span style={{ fontSize: 13, color: '#9B8FAE' }}>Painel de resultados</span>
          </div>
          <button
            onClick={() => { setAuthed(false); setCode(''); setCodeInput(''); try { sessionStorage.removeItem(CODE_KEY); } catch { /* noop */ } }}
            style={{ background: 'none', border: 'none', color: '#9B8FAE', fontSize: 13, cursor: 'pointer', ...FONT }}
          >
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-8" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Campanha */}
        <div className="flex gap-3 overflow-x-auto pb-1">
          <button
            onClick={() => setCampaign('all')}
            className="shrink-0 text-left"
            style={{
              ...FONT, borderRadius: 16, padding: '10px 14px', minWidth: 140, cursor: 'pointer',
              border: campaign === 'all' ? '2px solid #E8357A' : '0.5px solid #E8E0EE',
              background: campaign === 'all' ? '#FDF0F5' : '#FFFFFF',
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E' }}>Todas campanhas</p>
            <p style={{ fontSize: 11, color: '#9B8FAE', marginTop: 2 }}>
              {(data?.campaigns ?? []).reduce((s, c) => s + c.participants, 0)} participantes
            </p>
          </button>
          {(data?.campaigns ?? []).map((c) => (
            <button
              key={c.id}
              onClick={() => setCampaign(c.id)}
              className="shrink-0 text-left"
              style={{
                ...FONT, borderRadius: 16, padding: '10px 14px', minWidth: 160, cursor: 'pointer',
                border: campaign === c.id ? '2px solid #E8357A' : '0.5px solid #E8E0EE',
                background: campaign === c.id ? '#FDF0F5' : '#FFFFFF',
              }}
            >
              <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E' }}>{c.name}</p>
              <p style={{ fontSize: 11, color: '#9B8FAE', marginTop: 2 }}>{c.participants} participantes</p>
            </button>
          ))}
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 14 }}>
          {kpiCards.map((c) => (
            <div key={c.label} style={{ ...CARD, background: c.dark ? '#E5509C' : '#FFFFFF', border: c.dark ? 'none' : CARD.border }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ ...FONT, fontSize: 12, color: c.dark ? 'rgba(255,255,255,0.7)' : '#9B8FAE' }}>{c.label}</span>
                <Badge value={c.badge} />
              </div>
              <p style={{ ...FONT, fontSize: 24, fontWeight: 700, color: c.dark ? '#FFF' : (c.color ?? '#1A1A2E') }}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Acessos por dia */}
        <div style={CARD}>
          <div className="flex justify-between items-center flex-wrap gap-2" style={{ marginBottom: 14 }}>
            <h3 style={{ ...FONT, fontSize: 15, fontWeight: 700, color: '#1A1A2E' }}>Giros por dia</h3>
            <PeriodFilter value={period} onChange={setPeriod} />
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data?.daily ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E0EE" strokeWidth={0.5} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9B8FAE', fontFamily: 'Nunito' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9B8FAE', fontFamily: 'Nunito' }} axisLine={false} tickLine={false} />
              <Tooltip cursor={false} contentStyle={chartTooltip} />
              <Bar dataKey="count" name="Giros" radius={[50, 50, 0, 0]} fill="#E5509C">
                {(data?.daily ?? []).map((_, i, arr) => (
                  <Cell key={i} fill={i === arr.length - 1 ? '#E8357A' : '#E5509C'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Por horário */}
        <div style={CARD}>
          <h3 style={{ ...FONT, fontSize: 15, fontWeight: 700, color: '#1A1A2E', marginBottom: 14 }}>Giros por horário</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data?.hourly ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E0EE" strokeWidth={0.5} vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#9B8FAE', fontFamily: 'Nunito' }} axisLine={false} tickLine={false} interval={isMobile ? 3 : 1} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9B8FAE', fontFamily: 'Nunito' }} axisLine={false} tickLine={false} />
              <Tooltip cursor={false} contentStyle={chartTooltip} />
              <Bar dataKey="count" name="Giros" radius={[4, 4, 0, 0]} fill="#E5509C" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Distribuição de prêmios */}
        <div style={CARD}>
          <h3 style={{ ...FONT, fontSize: 15, fontWeight: 700, color: '#1A1A2E', marginBottom: 14 }}>Prêmios distribuídos</h3>
          {(data?.distribution ?? []).length === 0 ? (
            <p style={{ ...FONT, fontSize: 14, color: '#9B8FAE', padding: '16px 0', textAlign: 'center' }}>
              Nenhuma participação ainda.
            </p>
          ) : (
            <div className="space-y-2.5">
              {(data?.distribution ?? []).map((d, i) => (
                <div key={i}>
                  <div className="flex justify-between items-baseline" style={{ marginBottom: 4 }}>
                    <span style={{ ...FONT, fontSize: 13, fontWeight: 700, color: d.consolation ? '#9B8FAE' : '#1A1A2E' }}>{d.prize}</span>
                    <span style={{ ...FONT, fontSize: 13, color: '#5A5A7A' }}>{fmt(d.count)}</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 99, background: '#F2F7F7' }}>
                    <div style={{ height: '100%', borderRadius: 99, width: `${(d.count / maxDist) * 100}%`, background: d.consolation ? '#C9D4D4' : '#E8357A', transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p style={{ ...FONT, fontSize: 12, color: '#9B8FAE', textAlign: 'center' }}>
          Somente números agregados · sem dados pessoais · atualizado em{' '}
          {data ? new Date(data.generatedAt).toLocaleString('pt-BR') : '—'}
        </p>
      </main>
    </div>
  );
};

export default PublicPanel;
