import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Check, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { FONT, CARD, inputStyle } from '@/lib/admin-styles';
import { Emoji } from '@/lib/twemoji';
import PrizeEmailFields from './PrizeEmailFields';
import {
  pickPrizeEmail, isPrizeEmailCustomized, isValidEmailUrl, EMPTY_PRIZE_EMAIL, PRIZE_EMAIL_KEYS,
  type PrizeEmailValues, type PrizeEmailDefaults,
} from '@/lib/prize-email';
import PrizeEmailPreview from './PrizeEmailPreview';

interface PrizeRow extends PrizeEmailValues {
  id: string;
  name: string;
  emoji: string;
  image_url: string;
  checkout_url: string | null;
  redeem_instructions: string;
  active: boolean;
  campaign_id: string | null;
  campaigns: { name: string } | null;
}

const same = (a: PrizeEmailValues, b: PrizeEmailValues) => PRIZE_EMAIL_KEYS.every(k => a[k].trim() === b[k].trim());

const Badge = ({ custom }: { custom: boolean }) => (
  <span style={{
    fontSize: 11, fontWeight: 700, borderRadius: 50, padding: '2px 8px', whiteSpace: 'nowrap',
    background: custom ? '#FCE4EE' : '#F3EEF7', color: custom ? '#E8357A' : '#7A6E8E',
  }}>
    {custom ? 'Personalizado' : 'Padrão'}
  </span>
);

const PrizeEmails = () => {
  const [prizes, setPrizes] = useState<PrizeRow[]>([]);
  const [defaults, setDefaults] = useState<PrizeEmailDefaults>({});
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PrizeEmailValues>(EMPTY_PRIZE_EMAIL);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [onlyCustom, setOnlyCustom] = useState(false);

  const load = useCallback(async () => {
    const [{ data: rows }, { data: settings }] = await Promise.all([
      supabase.from('prizes').select('*, campaigns(name)').eq('is_consolation', false).order('created_at', { ascending: false }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('email_settings').select('prize_subject, prize_title, contact_block_title, contact_block_text').eq('id', true).maybeSingle(),
    ]);
    setPrizes((rows ?? []) as unknown as PrizeRow[]);
    if (settings) setDefaults(settings as PrizeEmailDefaults);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const selected = prizes.find(p => p.id === selectedId) ?? null;
  const saved = useMemo(() => pickPrizeEmail(selected), [selected]);
  const dirty = !!selected && !same(draft, saved);
  const invalid = !isValidEmailUrl(draft.email_button_url);

  const select = (p: PrizeRow) => {
    if (p.id === selectedId) return;
    if (dirty && !window.confirm('Você tem alterações não salvas neste prêmio. Descartar?')) return;
    setSelectedId(p.id);
    setDraft(pickPrizeEmail(p));
  };

  const save = async () => {
    if (!selected || invalid) return;
    setSaving(true);
    const payload = Object.fromEntries(PRIZE_EMAIL_KEYS.map(k => [k, draft[k].trim()])) as unknown as PrizeEmailValues;
    const { error } = await supabase.from('prizes').update(payload).eq('id', selected.id);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar. Tente novamente.'); return; }
    setPrizes(prev => prev.map(p => (p.id === selected.id ? { ...p, ...payload } : p)));
    toast.success('E-mail do prêmio salvo!');
  };

  const copyFrom = (id: string) => {
    const src = prizes.find(p => p.id === id);
    if (src) { setDraft(pickPrizeEmail(src)); toast.success(`Copiado de "${src.name}" — revise e salve.`); }
  };

  const filtered = prizes.filter(p =>
    (!onlyCustom || isPrizeEmailCustomized(p)) &&
    (!query.trim() || `${p.name} ${p.campaigns?.name ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())),
  );
  const groups = useMemo(() => {
    const m = new Map<string, PrizeRow[]>();
    filtered.forEach(p => {
      const k = p.campaigns?.name ?? 'Sem campanha (global)';
      m.set(k, [...(m.get(k) ?? []), p]);
    });
    return [...m.entries()];
  }, [filtered]);
  const customCount = prizes.filter(isPrizeEmailCustomized).length;
  const copyOptions = prizes.filter(p => p.id !== selectedId && isPrizeEmailCustomized(p));

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-14 rounded-[20px] animate-pulse" style={{ background: '#E8E0EE' }} />)}</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 items-start" style={FONT}>
      {/* Visão geral */}
      <div style={{ ...CARD, padding: 14 }} className="lg:sticky lg:top-4">
        <div className="flex items-baseline justify-between" style={{ marginBottom: 10 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E' }}>Prêmios</p>
          <p style={{ fontSize: 12, color: '#9B8FAE' }}>{customCount} de {prizes.length} personalizados</p>
        </div>
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: 12, color: '#9B8FAE' }} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar prêmio ou campanha"
            style={{ ...inputStyle, fontSize: 14, padding: '9px 12px 9px 34px' }} />
        </div>
        <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 13, color: '#5A5A7A', marginBottom: 10 }}>
          <input type="checkbox" checked={onlyCustom} onChange={e => setOnlyCustom(e.target.checked)} style={{ accentColor: '#E8357A' }} />
          Só personalizados
        </label>
        <div style={{ maxHeight: 420, overflowY: 'auto' }} className="space-y-3">
          {groups.length === 0 && <p style={{ fontSize: 13, color: '#9B8FAE', textAlign: 'center', padding: 16 }}>Nenhum prêmio encontrado.</p>}
          {groups.map(([campaign, items]) => (
            <div key={campaign}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#9B8FAE', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 4px 4px' }}>{campaign}</p>
              {items.map(p => {
                const active = p.id === selectedId;
                return (
                  <button key={p.id} type="button" onClick={() => select(p)}
                    className="w-full flex items-center gap-2 text-left transition-colors"
                    style={{
                      border: `1.5px solid ${active ? '#E8357A' : 'transparent'}`, background: active ? '#FDF0F5' : 'transparent',
                      borderRadius: 14, padding: '8px 10px', cursor: 'pointer', ...FONT,
                    }}>
                    <Emoji emoji={p.emoji || '🎁'} label="" size={22} />
                    <span className="flex-1 min-w-0 truncate" style={{ fontSize: 14, fontWeight: 600, color: '#1A1A2E', opacity: p.active ? 1 : 0.5 }}>{p.name}</span>
                    <Badge custom={isPrizeEmailCustomized(p)} />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Editor */}
      {!selected ? (
        <div style={{ ...CARD, textAlign: 'center', padding: '56px 24px' }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E' }}>Escolha um prêmio</p>
          <p style={{ fontSize: 13, color: '#9B8FAE', marginTop: 6 }}>
            Selecione um prêmio na lista para personalizar o e-mail que o ganhador recebe — nome, instruções, botão e link. Em branco, vale o padrão da aba Geral.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
          <div style={CARD} className="space-y-5">
            <div className="flex items-start gap-3">
              <Emoji emoji={selected.emoji || '🎁'} label="" size={32} />
              <div className="flex-1 min-w-0">
                <h3 className="truncate" style={{ fontSize: 18, fontWeight: 700, color: '#1A1A2E' }}>{selected.name}</h3>
                <p style={{ fontSize: 12, color: '#9B8FAE' }}>{selected.campaigns?.name ?? 'Sem campanha (global)'}</p>
              </div>
              {copyOptions.length > 0 && (
                <select value="" onChange={e => e.target.value && copyFrom(e.target.value)}
                  style={{ ...inputStyle, width: 'auto', maxWidth: 190, fontSize: 12, padding: '8px 12px' }}>
                  <option value="">Copiar de outro…</option>
                  {copyOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
            </div>

            <PrizeEmailFields
              values={draft}
              onChange={(k, v) => setDraft(prev => ({ ...prev, [k]: v }))}
              prizeName={selected.name}
              checkoutUrl={selected.checkout_url ?? ''}
              redeemInstructions={selected.redeem_instructions}
              defaults={defaults}
            />

            <div className="flex flex-wrap items-center gap-3" style={{ position: 'sticky', bottom: 0, background: '#FFFFFF', paddingTop: 8 }}>
              <button type="button" onClick={save} disabled={!dirty || saving || invalid}
                className="transition-all hover:opacity-90 active:scale-[0.98]"
                style={{
                  ...FONT, background: !dirty || invalid ? '#C5BDD0' : '#E8357A', color: '#FFFFFF', border: 'none', borderRadius: 50,
                  padding: '12px 26px', fontWeight: 700, fontSize: 14, cursor: !dirty || invalid ? 'not-allowed' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : !dirty && <Check size={14} />}
                {saving ? 'Salvando…' : dirty ? 'Salvar e-mail do prêmio' : 'Salvo'}
              </button>
              <button type="button" onClick={() => setDraft(EMPTY_PRIZE_EMAIL)} disabled={!isPrizeEmailCustomized(draft)}
                style={{
                  ...FONT, background: 'none', border: 'none', color: '#7A6E8E', fontWeight: 700, fontSize: 13,
                  cursor: isPrizeEmailCustomized(draft) ? 'pointer' : 'default', opacity: isPrizeEmailCustomized(draft) ? 1 : 0.4,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                <RotateCcw size={13} /> Restaurar padrão
              </button>
              {dirty && <span style={{ fontSize: 12, color: '#E8357A' }}>Alterações não salvas</span>}
            </div>
          </div>

          <div style={{ ...CARD, padding: 16 }} className="xl:sticky xl:top-4">
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E', marginBottom: 10, textAlign: 'center' }}>Prévia ao vivo</p>
            <PrizeEmailPreview
              request={{
                prize: {
                  name: selected.name,
                  ...Object.fromEntries(PRIZE_EMAIL_KEYS.map(k => [k, draft[k]])),
                  checkout_url: selected.checkout_url ?? '',
                  image_url: selected.image_url,
                },
              }}
              height={520}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PrizeEmails;
