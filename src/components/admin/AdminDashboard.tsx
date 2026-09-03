import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { Zap, PauseCircle, Download } from 'lucide-react';
import PeriodFilter, { type Period, getSinceDate, getPreviousRange } from './PeriodFilter';
import { FONT, CARD } from '@/lib/admin-styles';

/* ── Types ──────────────────────────────────────────── */
interface DailyAccess { date: string; count: number }
interface HourlyAccess { hour: string; count: number }
interface Sorteado { name: string; email: string; whatsapp: string; prize: string; date: string; uniqueToken?: string; link?: string }

interface DashboardData {
  revenue: number; revenueChange: string;
  leads: number; leadsChange: string;
  checkouts: number; checkoutsChange: string;
  conversionRate: number; conversionChange: string;
  dailyAccess: DailyAccess[];
  hourlyAccess: HourlyAccess[];
  sorteados: Sorteado[];
}

/* ── Helpers ────────────────────────────────────────── */
const fmt = (n: number) => n.toLocaleString('pt-BR');
const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const BASE_PRICE = 14.90;

/** Variação percentual entre período atual e anterior, formatada para o badge. */
const pctChange = (current: number, previous: number): string => {
  if (previous <= 0) return current > 0 ? '+100%' : '—';
  const delta = ((current - previous) / previous) * 100;
  if (Math.abs(delta) < 0.5) return '—';
  const rounded = Math.round(delta);
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
};

const VariationBadge = ({ value }: { value: string }) => {
  if (value === '—') return <span style={{ ...FONT, fontSize: 11, color: '#9B8FAE' }}>—</span>;
  const isUp = value.startsWith('+');
  return (
    <span style={{
      ...FONT, display: 'inline-flex', alignItems: 'center',
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 50,
      background: isUp ? '#DCFCE7' : '#FEE2E2',
      color: isUp ? '#22C55E' : '#EF4444',
    }}>
      {value}
    </span>
  );
};

/* ── Skeleton components ────────────────────────────── */
const SkeletonCard = () => (
  <div style={{ ...CARD, minHeight: 140 }}>
    <div className="animate-pulse space-y-3">
      <div className="h-3 w-24 rounded-full" style={{ background: '#E8E0EE' }} />
      <div className="h-8 w-20 rounded-full" style={{ background: '#E8E0EE' }} />
      <div className="h-2 w-full rounded-full" style={{ background: '#E8E0EE' }} />
    </div>
  </div>
);

const SkeletonChart = ({ height = 280 }: { height?: number }) => (
  <div style={{ ...CARD }}>
    <div className="animate-pulse space-y-4">
      <div className="flex justify-between items-center">
        <div className="h-4 w-32 rounded-full" style={{ background: '#E8E0EE' }} />
        <div className="h-6 w-40 rounded-full" style={{ background: '#E8E0EE' }} />
      </div>
      <div className="rounded-xl" style={{ height, background: '#F8F9F9' }} />
    </div>
  </div>
);

/* ── Component ──────────────────────────────────────── */
interface CampaignCard {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  start_date: string;
  end_date: string;
  participantCount: number;
}

const AdminDashboard = () => {
  const isMobile = useIsMobile();
  const [activePeriod, setActivePeriod] = useState<Period>('week');
  const [activeBarIdx, setActiveBarIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [campaignCards, setCampaignCards] = useState<CampaignCard[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');

  const [data, setData] = useState<DashboardData>({
    revenue: 0, revenueChange: '—',
    leads: 0, leadsChange: '—',
    checkouts: 0, checkoutsChange: '—',
    conversionRate: 0, conversionChange: '—',
    dailyAccess: [],
    hourlyAccess: [],
    sorteados: [],
  });

  // Fetch campaigns with participant counts
  useEffect(() => {
    const fetchCampaigns = async () => {
      const { data: camps } = await supabase.from('campaigns').select('id, name, slug, active, start_date, end_date').order('created_at', { ascending: false });
      if (!camps) return;

      const cards: CampaignCard[] = await Promise.all(camps.map(async (c) => {
        const { count } = await supabase.from('campaign_participants').select('*', { count: 'exact', head: true }).eq('campaign_id', c.id);
        return { ...c, participantCount: count || 0 };
      }));
      setCampaignCards(cards);
    };
    fetchCampaigns();
  }, []);

  const handlePeriodChange = useCallback((p: Period) => setActivePeriod(p), []);
  const handleCampaignSelect = useCallback((id: string) => setSelectedCampaign(id), []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const cf = selectedCampaign !== 'all';
      const since = getSinceDate(activePeriod);
      const sinceISO = since ? since.toISOString() : null;
      const prevRange = getPreviousRange(activePeriod);
      const prevFromISO = prevRange ? prevRange.from.toISOString() : null;
      const prevToISO = prevRange ? prevRange.to.toISOString() : null;

      try {
        // ── BATCH 1: All independent queries in parallel ──
        let leadsQ = supabase.from('campaign_participants').select('*', { count: 'exact', head: true });
        if (cf) leadsQ = leadsQ.eq('campaign_id', selectedCampaign);

        let prizesQ = supabase.from('prizes').select('id, name, checkout_url, campaign_id');
        if (cf) prizesQ = prizesQ.eq('campaign_id', selectedCampaign);

        let accessQ = supabase.from('participations').select('played_at').order('played_at', { ascending: true });
        if (sinceISO) accessQ = accessQ.gte('played_at', sinceISO);
        if (cf) accessQ = accessQ.eq('campaign_id', selectedCampaign);

        let hourlyQ = supabase.from('participations').select('played_at');
        if (cf) hourlyQ = hourlyQ.eq('campaign_id', selectedCampaign);
        if (sinceISO) hourlyQ = hourlyQ.gte('played_at', sinceISO);

        let sorteadosQ = supabase.from('participations').select('name, email, whatsapp, prize_id, played_at, campaign_id').order('played_at', { ascending: false }).limit(50);
        if (cf) sorteadosQ = sorteadosQ.eq('campaign_id', selectedCampaign);

        let totalQ = supabase.from('participations').select('*', { count: 'exact', head: true });
        if (cf) totalQ = totalQ.eq('campaign_id', selectedCampaign);

        let discountQ = cf
          ? supabase.from('campaigns').select('discount_percentage').eq('id', selectedCampaign).maybeSingle()
          : supabase.from('campaigns').select('discount_percentage').eq('active', true).limit(1).maybeSingle();

        const allCampaignsQ = supabase.from('campaigns').select('id, slug');

        // Comparação "vs. período anterior" (badges de variação dos KPIs).
        let curLeadsPeriodQ = supabase.from('campaign_participants').select('*', { count: 'exact', head: true });
        if (cf) curLeadsPeriodQ = curLeadsPeriodQ.eq('campaign_id', selectedCampaign);
        if (sinceISO) curLeadsPeriodQ = curLeadsPeriodQ.gte('created_at', sinceISO);

        let prevLeadsBuilder = supabase.from('campaign_participants').select('*', { count: 'exact', head: true });
        if (cf) prevLeadsBuilder = prevLeadsBuilder.eq('campaign_id', selectedCampaign);
        const prevLeadsQ: PromiseLike<{ count: number | null }> = prevFromISO
          ? prevLeadsBuilder.gte('created_at', prevFromISO).lt('created_at', prevToISO!)
          : Promise.resolve({ count: null });

        let prevPlaysBuilder = supabase.from('participations').select('*', { count: 'exact', head: true });
        if (cf) prevPlaysBuilder = prevPlaysBuilder.eq('campaign_id', selectedCampaign);
        const prevPlaysQ: PromiseLike<{ count: number | null }> = prevFromISO
          ? prevPlaysBuilder.gte('played_at', prevFromISO).lt('played_at', prevToISO!)
          : Promise.resolve({ count: null });

        const [
          leadsRes, prizesRes, accessRes, hourlyRes, sorteadosRes,
          totalRes, discountRes, allCampaignsRes,
          curLeadsPeriodRes, prevLeadsRes, prevPlaysRes,
        ] = await Promise.all([
          leadsQ, prizesQ, accessQ, hourlyQ, sorteadosQ,
          totalQ, discountQ, allCampaignsQ,
          curLeadsPeriodQ, prevLeadsQ, prevPlaysQ,
        ]);

        const leads = leadsRes.count || 0;
        const allPrizes = prizesRes.data || [];
        const prizeIds = allPrizes.filter(p => p.checkout_url).map(p => p.id);
        const prizeMap = Object.fromEntries(allPrizes.map(p => [p.id, p.name]));

        // ── BATCH 2: Checkout count (depends on prizeIds) + token lookup ──
        const sorteadosRows = sorteadosRes.data || [];
        const sorteadoEmails = [...new Set(sorteadosRows.map(s => s.email))];

        const batch2: PromiseLike<any>[] = [];

        // Checkouts
        if (prizeIds.length > 0) {
          let cQ = supabase.from('participations').select('*', { count: 'exact', head: true }).in('prize_id', prizeIds);
          if (cf) cQ = cQ.eq('campaign_id', selectedCampaign);
          batch2.push(cQ.then(r => r));
        } else {
          batch2.push(Promise.resolve({ count: 0 }));
        }

        // Tokens
        if (sorteadoEmails.length > 0) {
          batch2.push(
            supabase.from('campaign_participants').select('email, unique_token, campaign_id').in('email', sorteadoEmails).then(r => r)
          );
        } else {
          batch2.push(Promise.resolve({ data: [] }));
        }

        const [checkoutRes, tokenRes] = await Promise.all(batch2);

        const checkoutsCount = checkoutRes.count || 0;
        const discount = Number(discountRes.data?.discount_percentage ?? 0);
        const unitPrice = BASE_PRICE * (1 - discount / 100);
        const totalParticipations = totalRes.count || 0;
        const checkouts = checkoutsCount || totalParticipations;
        const revenue = checkouts * unitPrice;
        const conversionRate = leads > 0 ? Math.round((checkouts / leads) * 1000) / 10 : 0;

        // ── Variação vs. período anterior ──
        const curPlays = (accessRes.data || []).length;
        const prevPlays = prevPlaysRes.count;
        const curLeadsPeriod = curLeadsPeriodRes.count || 0;
        const prevLeadsPeriod = prevLeadsRes.count;
        const hasPrev = prevRange !== null;
        const leadsChange = hasPrev ? pctChange(curLeadsPeriod, prevLeadsPeriod ?? 0) : '—';
        // Receita e checkouts acompanham o volume de giros do período.
        const playsChange = hasPrev ? pctChange(curPlays, prevPlays ?? 0) : '—';
        // Conversão: giros por lead — sobe se mais gente que se cadastra também gira.
        const curConv = curLeadsPeriod > 0 ? curPlays / curLeadsPeriod : 0;
        const prevConv = (prevLeadsPeriod ?? 0) > 0 ? (prevPlays ?? 0) / (prevLeadsPeriod ?? 1) : 0;
        const conversionChange = hasPrev ? pctChange(Math.round(curConv * 1000), Math.round(prevConv * 1000)) : '—';

        // Daily access
        const dailyMap: Record<string, number> = {};
        (accessRes.data || []).forEach(row => {
          const day = new Date(row.played_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          dailyMap[day] = (dailyMap[day] || 0) + 1;
        });
        const days = activePeriod === 'today' ? 1 : activePeriod === 'week' ? 7 : 30;
        const dailyAccess: DailyAccess[] = [];
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          dailyAccess.push({ date: key, count: dailyMap[key] || 0 });
        }

        // Hourly access
        const hourlyMap: Record<number, number> = {};
        (hourlyRes.data || []).forEach(row => {
          const h = new Date(row.played_at).getHours();
          hourlyMap[h] = (hourlyMap[h] || 0) + 1;
        });
        const hourlyAccess: HourlyAccess[] = Array.from({ length: 24 }, (_, i) => ({
          hour: `${String(i).padStart(2, '0')}h`,
          count: hourlyMap[i] || 0,
        }));

        // Sorteados
        const tokenMap: Record<string, string> = {};
        ((tokenRes as any).data || []).forEach((t: any) => {
          tokenMap[`${t.email}_${t.campaign_id}`] = t.unique_token;
        });
        const slugMap = Object.fromEntries((allCampaignsRes.data || []).map(c => [c.id, c.slug]));

        const sorteados: Sorteado[] = sorteadosRows.map(s => {
          const token = tokenMap[`${s.email}_${s.campaign_id}`] || '';
          const campSlug = s.campaign_id ? slugMap[s.campaign_id] || '' : '';
          return {
            name: s.name, email: s.email, whatsapp: s.whatsapp,
            prize: prizeMap[s.prize_id] || '—',
            date: new Date(s.played_at).toLocaleDateString('pt-BR'),
            uniqueToken: token,
            link: token && campSlug ? `https://roletadsaude.lovable.app/${campSlug}?token=${token}` : '',
          };
        });

        setData({
          revenue, revenueChange: playsChange,
          leads, leadsChange,
          checkouts, checkoutsChange: playsChange,
          conversionRate, conversionChange,
          dailyAccess, hourlyAccess, sorteados,
        });
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activePeriod, selectedCampaign]);

  const selectedName = selectedCampaign === 'all'
    ? 'Todas campanhas'
    : campaignCards.find(c => c.id === selectedCampaign)?.name || '';

  const selectedSlug = selectedCampaign === 'all'
    ? 'todas'
    : campaignCards.find(c => c.id === selectedCampaign)?.slug || 'campanha';

  const kpiCards = useMemo(() => [
    { label: 'RECEITA DA CAMPANHA', value: fmtBRL(data.revenue), badge: data.revenueChange, pct: 78, dark: true },
    { label: 'LEADS CAPTURADOS', value: fmt(data.leads), badge: data.leadsChange, pct: 65, color: '#F47F4B' },
    { label: 'CHECKOUTS INICIADOS', value: fmt(data.checkouts), badge: data.checkoutsChange, pct: 55, color: '#40C5E8' },
    { label: 'TAXA DE CONVERSÃO', value: `${data.conversionRate}%`, badge: data.conversionChange, pct: data.conversionRate, color: '#62BF7A' },
  ], [data]);

  const downloadCSV = () => {
    if (data.sorteados.length === 0) return;
    const headers = ['EMAIL', 'LASTNAME', 'FIRSTNAME', 'WHATSAPP', 'UNIQUE_TOKEN', 'LINK'];
    const rows = data.sorteados.map(p => {
      const parts = p.name.trim().split(' ');
      const firstname = parts[0];
      const lastname = parts.slice(1).join(' ');
      return [p.email, lastname, firstname, p.whatsapp, p.uniqueToken || '', p.link || ''].join(';');
    });
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sorteados-${selectedSlug}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Campaign cards selector ───────────────── */}
      <div>
        <p style={{ ...FONT, fontSize: 14, color: '#9B8FAE', marginBottom: 8 }}>
          Visualizando dados de: <strong style={{ color: '#1A1A2E' }}>{selectedName}</strong>
        </p>
        <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
          <button
            onClick={() => handleCampaignSelect('all')}
            className="shrink-0 text-left transition-all"
            style={{
              ...FONT, borderRadius: 20, padding: '14px 18px',
              border: selectedCampaign === 'all' ? '2px solid #E8357A' : '0.5px solid #E8E0EE',
              background: selectedCampaign === 'all' ? '#FDF0F5' : '#FFFFFF',
              cursor: 'pointer', minWidth: 160,
            }}
          >
            <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E' }}>Todas campanhas</p>
            <p style={{ fontSize: 12, color: '#9B8FAE', marginTop: 4 }}>
              {campaignCards.reduce((sum, c) => sum + c.participantCount, 0)} participantes
            </p>
          </button>

          {campaignCards.map(c => {
            const selected = selectedCampaign === c.id;
            return (
              <button
                key={c.id}
                onClick={() => handleCampaignSelect(c.id)}
                className="shrink-0 text-left transition-all"
                style={{
                  ...FONT, borderRadius: 20, padding: '14px 18px',
                  border: selected ? '2px solid #E8357A' : '0.5px solid #E8E0EE',
                  background: selected ? '#FDF0F5' : '#FFFFFF',
                  cursor: 'pointer', minWidth: isMobile ? 140 : 200,
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E' }}>{c.name}</p>
                  <span className="flex items-center gap-1 shrink-0" style={{
                    fontSize: 11, fontWeight: 700, borderRadius: 50, padding: '2px 8px',
                    background: c.active ? '#E8FAF0' : '#F3F4F6',
                    color: c.active ? '#1a7a47' : '#9B8FAE',
                  }}>
                    {c.active ? <Zap size={10} /> : <PauseCircle size={10} />}
                    {c.active ? 'Ativa' : 'Pausada'}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: '#9B8FAE' }}>
                  {new Date(c.start_date).toLocaleDateString('pt-BR')} — {new Date(c.end_date).toLocaleDateString('pt-BR')}
                </p>
                <p style={{ fontSize: 12, color: '#5A5A7A', marginTop: 2 }}>
                  {c.participantCount} participantes
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── BLOCO 1 — KPIs ──────────────────────────── */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 16 }}>
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 16 }}>
          {kpiCards.map((c) => (
            <div key={c.label} style={{
              ...CARD,
              background: c.dark ? '#E5509C' : '#FFFFFF',
              border: c.dark ? 'none' : CARD.border,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ ...FONT, fontSize: 13, fontWeight: 400, color: c.dark ? 'rgba(255,255,255,0.6)' : '#9B8FAE', letterSpacing: 0.5 }}>
                  {c.label}
                </span>
                <VariationBadge value={c.badge} />
              </div>
              <p style={{ ...FONT, fontSize: 28, fontWeight: 700, color: c.dark ? '#FFF' : (c.color ?? '#1A1A2E'), margin: '4px 0 12px' }}>
                {c.value}
              </p>
              <div style={{ height: 3, borderRadius: 99, background: c.dark ? 'rgba(255,255,255,0.25)' : '#E8E0EE' }}>
                <div style={{ height: '100%', borderRadius: 99, width: `${c.pct}%`, background: c.dark ? '#E8357A' : (c.color ?? '#E8357A'), transition: 'width 0.5s ease' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── BLOCO 2 — Acessos por dia ───────────────── */}
      {loading ? <SkeletonChart /> : (
        <div style={CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ ...FONT, fontSize: 16, fontWeight: 700, color: '#1A1A2E' }}>Acessos por dia</h3>
            <PeriodFilter value={activePeriod} onChange={handlePeriodChange} />
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.dailyAccess} onMouseLeave={() => setActiveBarIdx(null)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E0EE" strokeWidth={0.5} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9B8FAE', fontFamily: 'Nunito' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9B8FAE', fontFamily: 'Nunito' }} axisLine={false} tickLine={false} />
              <Tooltip cursor={false} contentStyle={{ borderRadius: 20, border: '0.5px solid #E8E0EE', background: '#FFF', fontSize: 13, ...FONT }} />
              <Bar dataKey="count" name="Acessos" radius={[50, 50, 0, 0]} onMouseEnter={(_, idx) => setActiveBarIdx(idx)}>
                {data.dailyAccess.map((_, idx) => {
                  const isLast = idx === data.dailyAccess.length - 1;
                  const isHover = activeBarIdx === idx;
                  return <Cell key={idx} fill={isLast || isHover ? '#E8357A' : '#E5509C'} style={{ transition: 'fill 0.2s ease' }} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── BLOCO 2.5 — Participações por horário ───── */}
      {loading ? <SkeletonChart height={250} /> : (
        <div style={CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ ...FONT, fontSize: 16, fontWeight: 700, color: '#1A1A2E' }}>Participações por horário</h3>
            <PeriodFilter value={activePeriod} onChange={handlePeriodChange} />
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.hourlyAccess}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E0EE" strokeWidth={0.5} vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#9B8FAE', fontFamily: 'Nunito' }} axisLine={false} tickLine={false} interval={isMobile ? 3 : 1} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9B8FAE', fontFamily: 'Nunito' }} axisLine={false} tickLine={false} />
              <Tooltip cursor={false} contentStyle={{ borderRadius: 20, border: '0.5px solid #E8E0EE', background: '#FFF', fontSize: 13, ...FONT }} />
              <Bar dataKey="count" name="Participações" radius={[4, 4, 0, 0]}>
                {data.hourlyAccess.map((entry, idx) => {
                  const maxCount = Math.max(...data.hourlyAccess.map(h => h.count));
                  return <Cell key={idx} fill={entry.count === maxCount && maxCount > 0 ? '#E8357A' : '#E5509C'} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── BLOCO 3 — Sorteados ─────────────────────── */}
      <div style={CARD}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ ...FONT, fontSize: 16, fontWeight: 700, color: '#1A1A2E' }}>
            {selectedCampaign !== 'all' ? `Sorteados — ${selectedName}` : 'Sorteados'}
          </h3>
          {data.sorteados.length > 0 && (
            <button
              onClick={downloadCSV}
              className="flex items-center gap-2 transition-all hover:bg-[#E8357A] hover:text-white"
              style={{
                ...FONT, fontSize: 14, fontWeight: 700, color: '#E8357A',
                border: '1.5px solid #E8357A', borderRadius: 50, padding: '8px 20px',
                background: 'transparent', cursor: 'pointer',
              }}
            >
              <Download size={14} />
              Baixar lista
            </button>
          )}
        </div>
        {isMobile ? (
          /* ── Mobile: Card layout for sorteados ── */
          <div>
            {data.sorteados.length === 0 ? (
              <p style={{ ...FONT, fontSize: 14, color: '#9B8FAE', padding: '24px 0', textAlign: 'center' }}>
                Nenhum sorteado ainda para esta campanha.
              </p>
            ) : (
              <div className="space-y-2">
                {data.sorteados.map((s, i) => (
                  <div key={i} style={{ background: '#F8F9F9', borderRadius: 14, padding: '12px 14px' }}>
                    <div className="flex items-center justify-between mb-1">
                      <span style={{ ...FONT, fontSize: 14, fontWeight: 700, color: '#1A1A2E' }}>{s.name}</span>
                      <span style={{ ...FONT, fontSize: 11, color: '#9B8FAE' }}>{s.date}</span>
                    </div>
                    <p style={{ ...FONT, fontSize: 13, color: '#E8357A', fontWeight: 700, marginBottom: 2 }}>{s.prize}</p>
                    <p style={{ ...FONT, fontSize: 11, color: '#5A5A7A' }}>{s.email}</p>
                    <p style={{ ...FONT, fontSize: 11, color: '#5A5A7A' }}>{s.whatsapp}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ── Desktop: Table layout ── */
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr>
                  {['NOME', 'EMAIL', 'TELEFONE', 'PRÊMIO', 'DATA'].map((h) => (
                    <th key={h} style={{ ...FONT, fontSize: 12, fontWeight: 400, color: '#9B8FAE', textAlign: 'left', paddingBottom: 12, borderBottom: '0.5px solid #E8E0EE' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.sorteados.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ ...FONT, fontSize: 14, color: '#9B8FAE', padding: '24px 0', textAlign: 'center' }}>
                      Nenhum sorteado ainda para esta campanha.
                    </td>
                  </tr>
                )}
                {data.sorteados.map((s, i) => (
                  <tr key={i}>
                    <td style={{ ...FONT, fontSize: 14, fontWeight: 700, color: '#1A1A2E', padding: '12px 8px 12px 0', borderBottom: '0.5px solid #E8E0EE' }}>{s.name}</td>
                    <td style={{ ...FONT, fontSize: 13, color: '#5A5A7A', padding: '12px 8px', borderBottom: '0.5px solid #E8E0EE' }}>{s.email}</td>
                    <td style={{ ...FONT, fontSize: 13, color: '#5A5A7A', padding: '12px 8px', borderBottom: '0.5px solid #E8E0EE' }}>{s.whatsapp}</td>
                    <td style={{ ...FONT, fontSize: 13, color: '#5A5A7A', padding: '12px 8px', borderBottom: '0.5px solid #E8E0EE' }}>{s.prize}</td>
                    <td style={{ ...FONT, fontSize: 13, color: '#5A5A7A', padding: '12px 8px', borderBottom: '0.5px solid #E8E0EE' }}>{s.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
