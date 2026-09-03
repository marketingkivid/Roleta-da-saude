import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { X, Plus, Trash2, Copy, Check, ChevronRight, ChevronLeft, CalendarCheck, CalendarX, Zap, Gift, Link2, Loader2, Download } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import PrizeImageUpload from './PrizeImageUpload';
import RouletteWheelPreview from './RouletteWheelPreview';
import ProbabilityEditor from './ProbabilityEditor';
import CampaignParticipantImport, { type ParsedRow } from './CampaignParticipantImport';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Emoji, EmojiText } from '@/lib/twemoji';
import { Calendar } from '@/components/ui/calendar';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { FONT, inputStyle, labelStyle, helperStyle, focusHandler, blurHandler, generateSlug } from '@/lib/admin-styles';


interface CampaignModalProps {
  campaignId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

interface PrizeRow {
  id?: string;
  name: string;
  emoji: string;
  weight: number;
  quantity_available: string;
  checkout_url: string;
  image_url: string;
  show_image: boolean;
  description: string;
  redeem_instructions: string;
  active: boolean;
  color_token: string | null;
  display_order: number;
  is_consolation: boolean;
  probability: number;
  _deleted?: boolean;
}


// Fixed copy for the "no-win" slot. Only the image is editable in the admin.
const CONSOLATION_NAME = 'Não foi dessa vez';
const CONSOLATION_EMOJI = '😢';
const CONSOLATION_DESC = 'Obrigado por participar! Aproveite as ofertas do Kivid.';

const makeConsolationPrize = (order = 99): PrizeRow => ({
  name: CONSOLATION_NAME,
  emoji: CONSOLATION_EMOJI,
  weight: 3,
  quantity_available: '',
  checkout_url: '',
  image_url: '',
  show_image: true,
  description: CONSOLATION_DESC,
  redeem_instructions: '',
  active: true,
  color_token: 'grape-300',
  display_order: order,
  is_consolation: true,
  probability: 60,
});



type Step = 0 | 1 | 2 | 3;
const STEPS = [
  { label: 'Informações gerais' },
  { label: 'Prêmios' },
  { label: 'Salvar' },
  { label: 'Probabilidades' },
];

const CampaignModal = ({ campaignId, onClose, onSaved }: CampaignModalProps) => {
  const isEdit = !!campaignId;

  const [step, setStep] = useState<Step>(0);

  const [form, setForm] = useState({
    name: '',
    slug: '',
    start_date: new Date(),
    end_date: new Date(Date.now() + 30 * 86400000),
    campaign_type: 'gamificação',
    mechanic: 'roleta' as const,
    active: true,
    is_test: false,
  });


  const [slugError, setSlugError] = useState('');
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState(false);
  const originalSlugRef = useRef<string>('');

  const [prizes, setPrizes] = useState<PrizeRow[]>(() => campaignId ? [] : [makeConsolationPrize(0)]);
  const [importedParticipants, setImportedParticipants] = useState<ParsedRow[]>([]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedCampaignId, setSavedCampaignId] = useState<string | null>(campaignId);
  const [savedTokens, setSavedTokens] = useState<Record<string, string>>({});
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Probability state (real IDs from DB after save)
  const [probPrizes, setProbPrizes] = useState<{ id: string; name: string; emoji: string; probability: number }[]>([]);

  useEffect(() => {
    if (!campaignId) return;
    const load = async () => {
      const { data: c } = await supabase.from('campaigns').select('*').eq('id', campaignId).single();
      if (c) {
        const loadedSlug = c.slug || '';
        originalSlugRef.current = loadedSlug;
        setForm({
          name: c.name,
          slug: loadedSlug,
          start_date: new Date(c.start_date),
          end_date: new Date(c.end_date),
          campaign_type: c.campaign_type,
          mechanic: 'roleta',
          active: c.active,
          is_test: (c as any).is_test ?? false,
        });

        if (loadedSlug) {
          setSlugAvailable(true);
          setSlugChecking(false);
        }
      }
      // Load existing participants with tokens
      const { data: existingParts } = await supabase
        .from('campaign_participants')
        .select('name, email, phone, unique_token')
        .eq('campaign_id', campaignId);
      if (existingParts?.length) {
        setImportedParticipants(existingParts.map(p => ({
          name: p.name,
          email: p.email,
          phone: p.phone,
          status: 'valid' as const,
        })));
        const tokenMap: Record<string, string> = {};
        existingParts.forEach(p => { if (p.unique_token) tokenMap[p.email] = p.unique_token; });
        setSavedTokens(tokenMap);
      }
      const { data: pz } = await supabase.from('prizes').select('*').eq('campaign_id', campaignId).order('created_at');
      if (pz) {
        const mapped: PrizeRow[] = pz.map((p, idx) => ({
          id: p.id,
          name: p.name,
          emoji: p.emoji,
          weight: Number(p.weight),
          quantity_available: p.quantity_available?.toString() ?? '',
          checkout_url: p.checkout_url ?? '',
          image_url: p.image_url,
          show_image: (p as any).show_image ?? true,
          description: p.description,
          redeem_instructions: p.redeem_instructions,
          active: p.active,
          color_token: (p as any).color_token ?? null,
          display_order: (p as any).display_order ?? idx,
          is_consolation: (p as any).is_consolation ?? false,
          probability: Number((p as any).probability ?? 0),
        }));


        // Ensure a consolation slot exists — seed one if the campaign doesn't have it yet.
        if (!mapped.some(p => p.is_consolation)) {
          mapped.push(makeConsolationPrize(mapped.length));
        }
        setPrizes(mapped);
      }
    };
    load();
  }, [campaignId]);

  const update = (key: string, value: any) => {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'name' && typeof value === 'string') {
        const oldAutoSlug = generateSlug(prev.name);
        if (!prev.slug || prev.slug === oldAutoSlug) {
          next.slug = generateSlug(value);
          setSlugError('');
        }
      }
      return next;
    });
  };

  const validateSlug = useCallback(async (slug: string) => {
    if (slug.length < 3) { setSlugError('Mínimo de 3 caracteres'); setSlugAvailable(false); return false; }
    if (!/^[a-z0-9-]+$/.test(slug)) { setSlugError('Apenas letras minúsculas, números e hífens'); setSlugAvailable(false); return false; }
    setSlugChecking(true);
    const { data } = await supabase.from('campaigns').select('id').eq('slug', slug).maybeSingle();
    setSlugChecking(false);
    if (data && data.id !== campaignId) { setSlugError('Slug já está em uso'); setSlugAvailable(false); return false; }
    setSlugError('');
    setSlugAvailable(true);
    return true;
  }, [campaignId]);

  // Debounced slug validation
  useEffect(() => {
    if (!form.slug || form.slug.length < 3) {
      setSlugAvailable(false);
      return;
    }
    // If slug matches the original (edit mode), skip DB check
    if (isEdit && form.slug === originalSlugRef.current) {
      setSlugAvailable(true);
      setSlugChecking(false);
      setSlugError('');
      return;
    }
    const timer = setTimeout(() => {
      validateSlug(form.slug);
    }, 500);
    return () => clearTimeout(timer);
  }, [form.slug, validateSlug, isEdit]);

  const handleSlugChange = (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setForm(prev => ({ ...prev, slug: cleaned }));
    setSlugError('');
    setSlugAvailable(false);
    setSlugChecking(true);
  };

  const copySlugLink = () => {
    navigator.clipboard.writeText(`https://roletadsaude.lovable.app/${form.slug}`);
    toast.success('Link copiado!');
  };

  const addPrize = () => {
    setPrizes(prev => {
      const nextOrder = prev.filter(p => !p._deleted).length;
      const newPrize: PrizeRow = {
        name: '', emoji: '🎁', weight: 50, quantity_available: '',
        checkout_url: '', image_url: '', show_image: true, description: '', redeem_instructions: '', active: true,
        color_token: null, display_order: nextOrder, is_consolation: false, probability: 0,
      };

      return [...prev, newPrize];
    });
  };

  const updatePrize = (idx: number, key: keyof PrizeRow, value: any) => {
    setPrizes(prev => prev.map((p, i) => i === idx ? { ...p, [key]: value } : p));
  };

  const patchPrize = (idx: number, patch: Partial<PrizeRow>) => {
    setPrizes(prev => prev.map((p, i) => i === idx ? { ...p, ...patch } : p));
  };

  // Swap display_order between two indices (used by wheel reorder)
  const swapDisplayOrder = (idxA: number, idxB: number) => {
    setPrizes(prev => {
      const a = prev[idxA];
      const b = prev[idxB];
      if (!a || !b) return prev;
      const orderA = a.display_order;
      const orderB = b.display_order;
      return prev.map((p, i) => {
        if (i === idxA) return { ...p, display_order: orderB };
        if (i === idxB) return { ...p, display_order: orderA };
        return p;
      });
    });
  };

  const removePrize = (idx: number) => {
    setPrizes(prev => prev.map((p, i) => i === idx ? { ...p, _deleted: true } : p));
  };

  const activePrizes = prizes.filter(p => !p._deleted);

  const saveCampaignAndPrizes = async (): Promise<string | null> => {
    if (!form.name.trim()) return null;
    if (!form.slug || form.slug.length < 3) { toast.error('Slug deve ter pelo menos 3 caracteres'); return null; }
    setSaving(true);
    setSaveError('');

    const slug = form.slug;
    const payload: any = {
      name: form.name,
      start_date: form.start_date.toISOString(),
      end_date: form.end_date.toISOString(),
      campaign_type: form.campaign_type,
      mechanic: form.mechanic,
      participation_limit: 1,
      discount_percentage: 0,
      rules: '',
      active: form.active,
      is_test: form.is_test,
      slug,
      has_participant_list: importedParticipants.filter(r => r.status === 'valid').length > 0 || hasImportedParticipants,
    };


    let campId = savedCampaignId;

    if (campId) {
      const { error } = await supabase.from('campaigns').update(payload).eq('id', campId);
      if (error) { setSaving(false); setSaveError('Erro ao atualizar campanha'); return null; }
    } else {
      const { data, error } = await supabase.from('campaigns').insert(payload).select('id').single();
      if (error && error.code === '23505' && error.message.includes('slug')) {
        for (let i = 2; i <= 10; i++) {
          payload.slug = `${slug}-${i}`;
          const { data: d2, error: e2 } = await supabase.from('campaigns').insert(payload).select('id').single();
          if (!e2 && d2) { campId = d2.id; setSavedCampaignId(d2.id); break; }
          if (e2 && e2.code !== '23505') break;
        }
      } else if (error) {
        setSaving(false); setSaveError('Erro ao criar campanha'); return null;
      } else {
        campId = data?.id ?? null;
        if (campId) setSavedCampaignId(campId);
      }
    }

    if (!campId) { setSaving(false); setSaveError('Erro ao salvar campanha'); return null; }

    for (const p of prizes) {
      const prizePayload: any = {
        name: p.name,
        emoji: p.emoji,
        weight: Number(p.weight),
        quantity_available: p.quantity_available ? parseInt(p.quantity_available) : null,
        checkout_url: p.checkout_url || null,
        image_url: p.image_url,
        show_image: p.show_image,
        description: p.description,
        redeem_instructions: p.redeem_instructions,
        active: p.active,
        color_token: p.color_token,
        display_order: p.display_order ?? 0,
        is_consolation: p.is_consolation,
        campaign_id: campId,
      };

      // Salva a chance (%) apenas para a fatia de consolação (definida no passo 1).
      // Para os demais prêmios, a probabilidade é definida no passo 3 (ProbabilityEditor).
      if (p.is_consolation) {
        prizePayload.probability = Math.max(0, Math.min(100, Number(p.probability) || 0));
      }



      if (p._deleted && p.id) {
        await supabase.from('prizes').delete().eq('id', p.id);
      } else if (p.id) {
        await supabase.from('prizes').update(prizePayload).eq('id', p.id);
      } else if (!p._deleted && (p.name.trim() || p.is_consolation)) {
        await supabase.from('prizes').insert(prizePayload);
      }
    }

    // Insert valid imported participants (deduplicate by email)
    const validParticipants = importedParticipants.filter(r => r.status === 'valid');
    if (validParticipants.length > 0 && campId) {
      const { data: existing } = await supabase
        .from('campaign_participants')
        .select('email')
        .eq('campaign_id', campId);
      const existingEmails = new Set(existing?.map(r => r.email) ?? []);
      const newRows = validParticipants.filter(r => !existingEmails.has(r.email));
      if (newRows.length > 0) {
        await supabase.from('campaign_participants').insert(
          newRows.map(r => ({ campaign_id: campId, name: r.name, email: r.email, phone: r.phone, source: 'CSV Import' }))
        );
      }
    }

    // Reload prizes from DB to get real IDs
    const { data: dbPrizes } = await supabase
      .from('prizes')
      .select('id, name, emoji, probability')
      .eq('campaign_id', campId)
      .order('created_at');

    if (dbPrizes) {
      const hasProbabilities = dbPrizes.some(p => p.probability > 0);
      if (hasProbabilities) {
        setProbPrizes(dbPrizes.map(p => ({ id: p.id, name: p.name, emoji: p.emoji, probability: p.probability })));
      } else {
        // Initialize equally
        const n = dbPrizes.length;
        const base = Math.floor(100 / n);
        const rest = 100 - base * n;
        setProbPrizes(dbPrizes.map((p, i) => ({
          id: p.id, name: p.name, emoji: p.emoji,
          probability: base + (i === 0 ? rest : 0),
        })));
      }
    }

    // Reload participants with tokens
    if (campId) {
      const { data: parts } = await supabase
        .from('campaign_participants')
        .select('email, unique_token')
        .eq('campaign_id', campId);
      if (parts?.length) {
        const tokenMap: Record<string, string> = {};
        parts.forEach(p => { if (p.unique_token) tokenMap[p.email] = p.unique_token; });
        setSavedTokens(tokenMap);
      }
    }

    setSaving(false);
    return campId;
  };

  const handleSaveStep = async () => {
    const campId = await saveCampaignAndPrizes();
    if (campId) {
      toast.success('Campanha e prêmios salvos!');
      setStep(3);
    }
  };

  const handleFinishProbabilities = async () => {
    const totalProb = probPrizes.reduce((s, p) => s + p.probability, 0);
    if (totalProb !== 100) {
      toast.error('A soma das probabilidades deve ser exatamente 100%');
      return;
    }
    setSaving(true);
    for (const p of probPrizes) {
      await supabase.from('prizes').update({ probability: p.probability }).eq('id', p.id);
    }
    setSaving(false);
    toast.success('Campanha concluída com sucesso!');
    onSaved();
  };

  const handleProbChange = (updated: { id: string; probability: number }[]) => {
    setProbPrizes(prev => prev.map(p => {
      const u = updated.find(x => x.id === p.id);
      return u ? { ...p, probability: u.probability } : p;
    }));
  };

  const isSlugValid = slugAvailable && !slugError && !slugChecking;
  const canProceed = form.name.trim() && isSlugValid;
  const totalProb = probPrizes.reduce((s, p) => s + p.probability, 0);
  const hasImportedParticipants = importedParticipants.filter(r => r.status === 'valid').length > 0;

  const downloadParticipantLinks = async () => {
    if (!savedCampaignId) { toast.error('Salve a campanha primeiro'); return; }
    const { data, error } = await supabase
      .from('campaign_participants')
      .select('name, email, phone, unique_token')
      .eq('campaign_id', savedCampaignId);
    if (error || !data?.length) { toast.error('Nenhum participante encontrado'); return; }
    const slug = form.slug;
    const BOM = '\uFEFF';
    const header = 'EMAIL;LASTNAME;FIRSTNAME;WHATSAPP;UNIQUE_TOKEN;LINK';
    const rows = data.map(p => {
      const parts = (p.name || '').split(' ');
      const first = parts[0] || '';
      const last = parts.slice(1).join(' ') || '';
      const link = `https://roletadsaude.lovable.app/${slug}?token=${p.unique_token}`;
      return [p.email, last, first, p.phone, p.unique_token, link].join(';');
    });
    const csv = BOM + [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `participantes-${slug}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`${data.length} links exportados!`);
  };

  const DownloadLinksButton = () => (
    <button
      onClick={downloadParticipantLinks}
      className="flex items-center gap-2 transition-all hover:opacity-90 active:scale-[0.98]"
      style={{
        ...FONT, background: '#FFFFFF', color: '#E8357A', border: '1.5px solid #E8357A',
        borderRadius: 50, padding: '10px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer',
      }}
    >
      <Download size={16} /> Baixar lista com links
    </button>
  );

  const isMobileModal = useIsMobile();

  const handleRequestClose = () => {
    // If on final step (probabilities done) or no changes, close directly
    if (step === 3) {
      onClose();
      return;
    }
    setShowExitConfirm(true);
  };

  const handleSaveAndExit = async () => {
    const campId = await saveCampaignAndPrizes();
    if (campId) {
      toast.success('Campanha salva!');
      setShowExitConfirm(false);
      onSaved();
    }
  };

  const handleSaveAsDraft = async () => {
    setForm(prev => ({ ...prev, active: false }));
    // Need to save with active: false — update form inline for the save call
    const originalActive = form.active;
    form.active = false;
    const campId = await saveCampaignAndPrizes();
    form.active = originalActive; // restore in case save fails
    if (campId) {
      toast.success('Campanha salva como rascunho!');
      setShowExitConfirm(false);
      onSaved();
    }
  };

  const StepIndicator = () => {
    if (isMobileModal) {
      return (
        <div className="flex items-center justify-center shrink-0" style={{ padding: '12px 16px', borderBottom: '1px solid #E8E0EE' }}>
          <div className="flex items-center gap-2">
            <div style={{
              width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, background: '#E8357A', color: '#FFFFFF', ...FONT,
            }}>
              {step + 1}
            </div>
            <span style={{ ...FONT, fontSize: 14, fontWeight: 700, color: '#E8357A' }}>
              {step + 1}/{STEPS.length} — {STEPS[step].label}
            </span>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center gap-0 shrink-0" style={{ padding: '16px 24px', borderBottom: '1px solid #E8E0EE' }}>
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div style={{
                width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, background: i <= step ? '#E8357A' : '#E8E0EE', color: i <= step ? '#FFFFFF' : '#9B8FAE', ...FONT,
              }}>
                {i < step ? <Check size={14} /> : i + 1}
              </div>
              <span style={{ ...FONT, fontSize: 11, fontWeight: i === step ? 700 : 400, color: i <= step ? '#E8357A' : '#9B8FAE' }}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ width: 32, height: 2, background: i < step ? '#E8357A' : '#E8E0EE', marginBottom: 18, marginLeft: 4, marginRight: 4 }} />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <TooltipProvider>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center md:p-4"
        style={{ background: 'rgba(0,0,0,0.4)' }}
        onClick={handleRequestClose}
      >
        <div
          className="w-full h-full md:h-auto md:max-w-5xl md:max-h-[90vh] flex flex-col overflow-hidden md:rounded-[20px]"
          style={{ background: '#FFFFFF', ...FONT }}
          onClick={e => e.stopPropagation()}
        >
          {/* Exit confirmation dialog */}
          {showExitConfirm && (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.5)' }}
              onClick={() => setShowExitConfirm(false)}
            >
              <div
                className="w-[90%] max-w-md flex flex-col gap-4"
                style={{ background: '#FFFFFF', borderRadius: 20, border: '1px solid #E8E0EE', padding: '28px 24px', ...FONT }}
                onClick={e => e.stopPropagation()}
              >
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1A1A2E', textAlign: 'center' }}>
                  Sair sem salvar?
                </h3>
                <p style={{ fontSize: 14, color: '#9B8FAE', textAlign: 'center', lineHeight: 1.5 }}>
                  Você está no meio de um processo. Deseja salvar antes de sair?
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleSaveAndExit}
                    disabled={saving}
                    style={{
                      ...FONT, background: '#E8357A', color: '#FFFFFF', border: 'none',
                      borderRadius: 50, padding: '12px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                      opacity: saving ? 0.6 : 1,
                    }}
                  >
                    {saving ? 'Salvando...' : 'Salvar e sair'}
                  </button>
                  <button
                    onClick={handleSaveAsDraft}
                    disabled={saving}
                    style={{
                      ...FONT, background: '#FFFFFF', color: '#E8357A', border: '1.5px solid #E8357A',
                      borderRadius: 50, padding: '12px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                      opacity: saving ? 0.6 : 1,
                    }}
                  >
                    {saving ? 'Salvando...' : 'Salvar como rascunho'}
                  </button>
                  <button
                    onClick={() => { setShowExitConfirm(false); onClose(); }}
                    style={{
                      ...FONT, background: 'none', color: '#9B8FAE', border: '1.5px solid #E8E0EE',
                      borderRadius: 50, padding: '12px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                    }}
                  >
                    Sair sem salvar
                  </button>
                  <button
                    onClick={() => setShowExitConfirm(false)}
                    style={{
                      ...FONT, background: 'none', color: '#9B8FAE', border: 'none',
                      borderRadius: 50, padding: '8px 20px', fontWeight: 500, fontSize: 13, cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Continuar editando
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between shrink-0" style={{ padding: '20px 24px', borderBottom: '1px solid #E8E0EE' }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1A1A2E' }}>
              {isEdit ? 'Editar Campanha' : 'Nova Campanha'}
            </h2>
            <button onClick={handleRequestClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9B8FAE' }}>
              <X size={20} />
            </button>
          </div>

          <StepIndicator />

          {/* Body */}
          <div className="flex-1 overflow-y-auto" style={{ padding: 24 }}>

            {/* Step 0: Info */}
            {step === 0 && (
              <div className="space-y-4">
                <div>
                  <label style={labelStyle}>Nome da campanha</label>
                  <input value={form.name} onChange={e => update('name', e.target.value)} required placeholder="Ex: BLACK_FRIDAY_2026" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
                </div>

                <div>
                  <label style={labelStyle} className="flex items-center gap-1.5">
                    <Link2 size={14} style={{ color: '#9B8FAE' }} />
                    Link da campanha
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center flex-1" style={{ ...inputStyle, padding: 0, display: 'flex' }}>
                      <span style={{ padding: '13px 0 13px 16px', color: '#9B8FAE', fontSize: 14, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        roletadsaude.lovable.app/
                      </span>
                      <input
                        value={form.slug}
                        onChange={e => handleSlugChange(e.target.value)}
                        onBlur={() => { if (form.slug) validateSlug(form.slug); }}
                        placeholder="minha-campanha"
                        style={{
                          border: 'none', outline: 'none', flex: 1,
                          padding: '13px 16px 13px 0', fontSize: 16,
                          ...FONT, color: '#1A1A2E', background: 'transparent',
                        }}
                      />
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={copySlugLink}
                          disabled={!form.slug}
                          className="transition-all hover:opacity-80"
                          style={{
                            background: '#FFFFFF', border: '1.5px solid #E8E0EE',
                            borderRadius: 50, padding: '10px 12px', cursor: form.slug ? 'pointer' : 'not-allowed',
                            color: '#9B8FAE', flexShrink: 0,
                          }}
                        >
                          <Copy size={16} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Copiar link</TooltipContent>
                    </Tooltip>
                  </div>
                  {slugChecking && <p style={{ ...helperStyle, color: '#9B8FAE' }}>Verificando...</p>}
                  {slugError && !slugChecking && <p style={{ ...helperStyle, color: '#DC2626' }}>✗ {slugError}</p>}
                  {slugAvailable && !slugChecking && !slugError && (
                    <p style={{ ...helperStyle, color: '#16A34A' }}>✓ Slug disponível</p>
                  )}
                  <p style={helperStyle}>URL única da campanha. Apenas letras minúsculas, números e hífens (mín. 3 caracteres)</p>
                </div>

                <div>
                  <label style={labelStyle}>Tipo de campanha</label>
                  <input value={form.campaign_type} onChange={e => update('campaign_type', e.target.value)} placeholder="Ex: GAMIFICACAO, CUPOM, SORTEIO" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
                </div>

                {/* Campanha de teste — permite acesso repetido (ignora bloqueio local de "já girou") */}
                <div
                  style={{
                    background: '#FAF7FC',
                    border: '1px solid #E8E0EE',
                    borderRadius: 12,
                    padding: '12px 16px',
                    ...FONT,
                  }}
                >
                  <label className="flex items-center justify-between gap-3 cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E' }}>
                        Campanha de teste
                      </div>
                      <div style={{ fontSize: 12, color: '#9B8FAE', marginTop: 2 }}>
                        Permite repetir o acesso na mesma sessão (ignora o bloqueio de "já girou"). Use apenas para testes.
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.is_test}
                      onClick={() => update('is_test', !form.is_test)}
                      className="transition-all"
                      style={{
                        position: 'relative',
                        width: 44,
                        height: 24,
                        borderRadius: 999,
                        background: form.is_test ? '#E8357A' : '#E8E0EE',
                        border: 'none',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          top: 2,
                          left: form.is_test ? 22 : 2,
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: '#FFFFFF',
                          transition: 'left 0.2s',
                        }}
                      />
                    </button>
                  </label>
                </div>









                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label style={labelStyle} className="flex items-center gap-1.5">
                      <CalendarCheck size={14} style={{ color: '#9B8FAE' }} />
                      Data de início
                    </label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={cn("flex items-center gap-2 text-left w-full", !form.start_date && "text-muted-foreground")}
                          style={inputStyle}
                        >
                          <CalendarCheck size={16} style={{ color: '#9B8FAE', flexShrink: 0 }} />
                          {form.start_date ? format(form.start_date, "dd 'de' MMMM, yyyy", { locale: ptBR }) : 'Selecionar data'}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={form.start_date} onSelect={(d) => d && update('start_date', d)} initialFocus className={cn("p-3 pointer-events-auto")} />
                      </PopoverContent>
                    </Popover>
                    <p style={helperStyle}>Quando a campanha começa a aceitar participantes</p>
                  </div>
                  <div>
                    <label style={labelStyle} className="flex items-center gap-1.5">
                      <CalendarX size={14} style={{ color: '#9B8FAE' }} />
                      Data de fim
                    </label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={cn("flex items-center gap-2 text-left w-full", !form.end_date && "text-muted-foreground")}
                          style={inputStyle}
                        >
                          <CalendarX size={16} style={{ color: '#9B8FAE', flexShrink: 0 }} />
                          {form.end_date ? format(form.end_date, "dd 'de' MMMM, yyyy", { locale: ptBR }) : 'Selecionar data'}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={form.end_date} onSelect={(d) => d && update('end_date', d)} initialFocus className={cn("p-3 pointer-events-auto")} />
                      </PopoverContent>
                    </Popover>
                    <p style={helperStyle}>Após esta data, novos acessos serão bloqueados</p>
                  </div>
                </div>

                {/* Entry type indicator */}
                <div style={{
                  marginTop: 16,
                  background: '#F5F3F7',
                  borderRadius: 12,
                  padding: '12px 16px',
                  ...FONT,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E' }}>Tipo de entrada: </span>
                  <span style={{ fontSize: 13, color: '#9B8FAE' }}>
                    {hasImportedParticipants || importedParticipants.filter(r => r.status === 'valid').length > 0
                      ? 'Link exclusivo por participante (sem formulário)'
                      : 'Formulário de cadastro público'}
                  </span>
                </div>

                {/* Participant import */}
                <div style={{ marginTop: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E', ...FONT }}>Lista de participantes</h3>
                  <p style={{ fontSize: 13, color: '#9B8FAE', marginBottom: 12, ...FONT }}>Importe sua lista de contatos em formato CSV</p>
                  <CampaignParticipantImport onParsed={setImportedParticipants} initialRows={importedParticipants} savedTokens={Object.keys(savedTokens).length > 0 ? savedTokens : undefined} slug={form.slug} />
                </div>


              </div>
            )}

            {/* Step 1: Prêmios */}
            {step === 1 && (
              <div className="space-y-4">
                <p style={{ ...FONT, fontSize: 13, color: '#9B8FAE' }}>
                  <EmojiText>Adicione quantos prêmios quiser 🎁. As probabilidades serão configuradas após salvar.</EmojiText>
                </p>

                {/* Live wheel preview */}
                <div
                  className="flex flex-col items-center gap-2"
                  style={{
                    background: '#FAF7FC',
                    border: '1px solid #E8E0EE',
                    borderRadius: 20,
                    padding: 16,
                  }}
                >
                  <span style={{ ...FONT, fontSize: 12, fontWeight: 800, color: '#9B8FAE', letterSpacing: 1, textTransform: 'uppercase' }}>
                    Prévia da roleta
                  </span>
                  <RouletteWheelPreview
                    prizes={activePrizes.map(p => ({
                      name: p.name,
                      emoji: p.emoji,
                      image_url: p.image_url,
                      show_image: p.show_image,
                      color_token: p.color_token,
                      display_order: p.display_order,
                      is_consolation: p.is_consolation,
                      weight: p.weight,
                    }))}

                  />
                  <span style={{ ...FONT, fontSize: 12, color: '#9B8FAE', textAlign: 'center' }}>
                    As imagens carregadas aparecem em cada fatia. "Tente novamente" ocupa {(activePrizes.find(p => p.is_consolation)?.weight ?? 1)} fatia(s).
                  </span>
                </div>


                {activePrizes.filter(p => !p.is_consolation).map((p, realIdx) => {
                  const idx = prizes.indexOf(p);
                  return (
                    <div key={idx} style={{ background: '#FFFFFF', borderRadius: 20, border: '1px solid #E8E0EE', padding: 16 }}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="flex items-center gap-1.5" style={{ ...FONT, fontSize: 16, fontWeight: 700, color: '#1A1A2E' }}>
                          <Gift size={16} style={{ color: '#E8357A' }} />
                          {p.emoji} {p.name || `Prêmio ${realIdx + 1}`}
                        </span>
                        <button onClick={() => removePrize(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444' }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="space-y-3">
                        <div className="grid grid-cols-[3rem_1fr] gap-3">
                          <div>
                            <label style={labelStyle}>Emoji</label>
                            <input value={p.emoji} onChange={e => updatePrize(idx, 'emoji', e.target.value)} style={{ ...inputStyle, textAlign: 'center', fontSize: 20, padding: '10px 4px' }} onFocus={focusHandler} onBlur={blurHandler} />
                          </div>
                          <div>
                            <label style={labelStyle}>Nome</label>
                            <input value={p.name} onChange={e => updatePrize(idx, 'name', e.target.value)} style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label style={labelStyle}>Qtd disp.</label>
                            <input type="number" min="0" value={p.quantity_available} onChange={e => updatePrize(idx, 'quantity_available', e.target.value)} placeholder="∞" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
                            <p style={helperStyle}>Deixe vazio para estoque ilimitado</p>
                          </div>
                          <div>
                            <label style={labelStyle}>Checkout URL</label>
                            <input value={p.checkout_url} onChange={e => updatePrize(idx, 'checkout_url', e.target.value)} placeholder="https://..." style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
                          </div>
                        </div>
                        <div>
                          <label style={labelStyle}>Descrição</label>
                          <textarea
                            value={p.description}
                            onChange={e => updatePrize(idx, 'description', e.target.value)}
                            maxLength={300}
                            placeholder="Descreva o prêmio para o participante..."
                            rows={2}
                            style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
                            onFocus={focusHandler as any}
                            onBlur={blurHandler as any}
                          />
                          <p style={helperStyle}>{p.description.length} / 300</p>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label style={{ ...labelStyle, marginBottom: 0 }}>Imagem do prêmio (aparece na fatia da roleta)</label>
                            <label className="flex items-center gap-2 cursor-pointer" style={{ ...FONT, fontSize: 13, color: '#5A5A7A' }}>
                              <input
                                type="checkbox"
                                checked={p.show_image}
                                onChange={e => updatePrize(idx, 'show_image', e.target.checked)}
                                style={{ width: 18, height: 18, borderRadius: 6, accentColor: '#E8357A' }}
                              />
                              Exibir imagem
                            </label>
                          </div>
                          {p.show_image ? (
                            <PrizeImageUpload imageUrl={p.image_url} onImageChange={(url) => updatePrize(idx, 'image_url', url)} />
                          ) : (
                            <div style={{ ...FONT, background: '#FAF7FC', border: '1.5px dashed #C7B8DA', borderRadius: 16, padding: 16, textAlign: 'center' }}>
                              <div style={{ lineHeight: 1, marginBottom: 6 }}><Emoji emoji={p.emoji || '🎁'} label="" size={36} /></div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                                {p.name || 'Nome do prêmio'}
                              </div>
                              <p style={{ fontSize: 11, color: '#9B8FAE', marginTop: 8 }}>
                                A fatia mostrará o emoji e o nome. Textos longos quebram em várias linhas para caber (nunca são cortados).
                              </p>
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  );
                })}

                <button
                  onClick={addPrize}
                  className="flex items-center gap-2 transition-all hover:opacity-90"
                  style={{
                    ...FONT, background: '#FFFFFF', color: '#E8357A', border: '1.5px dashed #E8E0EE',
                    borderRadius: 20, padding: '14px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer', width: '100%', justifyContent: 'center',
                  }}
                >
                  <Plus size={16} /> Adicionar prêmio
                </button>

                {/* Fixed consolation slot — copy is locked; admin only edits its image. */}
                {(() => {
                  const cons = activePrizes.find(p => p.is_consolation);
                  if (!cons) return null;
                  const consIdx = prizes.indexOf(cons);
                  return (
                    <div style={{ background: '#FAF7FC', borderRadius: 20, border: '1.5px dashed #C7B8DA', padding: 16 }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span style={{ ...FONT, fontSize: 16, fontWeight: 700, color: '#1A1A2E' }}>
                          {CONSOLATION_EMOJI} {CONSOLATION_NAME}
                        </span>
                        <span style={{ ...FONT, fontSize: 11, fontWeight: 700, background: '#EDE4F5', color: '#7A50D9', padding: '2px 8px', borderRadius: 999 }}>
                          Fixo na roleta
                        </span>
                      </div>
                      <p style={{ ...FONT, fontSize: 13, color: '#9B8FAE', marginBottom: 12 }}>
                        Esta fatia é exibida quando o participante não é sorteado. O texto é fixo — você pode alterar a imagem e quantas fatias aparecem na roleta.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label style={{ ...labelStyle, marginBottom: 0 }}>Imagem exibida na fatia</label>
                            <label className="flex items-center gap-2 cursor-pointer" style={{ ...FONT, fontSize: 13, color: '#5A5A7A' }}>
                              <input
                                type="checkbox"
                                checked={cons.show_image}
                                onChange={e => updatePrize(consIdx, 'show_image', e.target.checked)}
                                style={{ width: 18, height: 18, borderRadius: 6, accentColor: '#E8357A' }}
                              />
                              Exibir imagem
                            </label>
                          </div>
                          {cons.show_image ? (
                            <PrizeImageUpload imageUrl={cons.image_url} onImageChange={(url) => updatePrize(consIdx, 'image_url', url)} />
                          ) : (
                            <div style={{ ...FONT, background: '#FFFFFF', border: '1.5px dashed #C7B8DA', borderRadius: 16, padding: 16, textAlign: 'center' }}>
                              <div style={{ fontSize: 36, lineHeight: 1, marginBottom: 6 }}>{CONSOLATION_EMOJI}</div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E' }}>Tente novamente</div>
                              <p style={{ fontSize: 11, color: '#9B8FAE', marginTop: 8 }}>
                                A fatia mostrará o emoji e "Tente novamente".
                              </p>
                            </div>
                          )}
                        </div>

                        <div>
                          <label style={labelStyle}>Quantas fatias na roleta</label>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={cons.weight ?? 1}
                            onChange={e => updatePrize(consIdx, 'weight', Math.max(1, Number(e.target.value) || 1))}
                            style={inputStyle}
                            onFocus={focusHandler}
                            onBlur={blurHandler}
                          />
                          <p style={helperStyle}>Ex.: 3 = três fatias "Tente novamente" na roda.</p>
                        </div>

                        <div className="md:col-span-2">
                          <label style={labelStyle}>Chance de sortear "Não foi dessa vez" (%)</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={cons.probability ?? 0}
                            onChange={e => updatePrize(consIdx, 'probability', Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                            style={inputStyle}
                            onFocus={focusHandler}
                            onBlur={blurHandler}
                          />
                          <p style={helperStyle}>
                            Porcentagem total de sorteios que caem em "Não foi dessa vez". Os demais {Math.max(0, 100 - (Number(cons.probability) || 0))}% serão distribuídos entre os prêmios no passo de probabilidades.
                          </p>
                        </div>
                      </div>


                    </div>
                  );
                })()}
              </div>
            )}


            {/* Step 2: Salvar campanha e prêmios */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="text-center" style={{ padding: '20px 0' }}>
                  <div style={{ marginBottom: 16 }}><Emoji emoji="🚀" label="" size={48} /></div>
                  <h3 style={{ ...FONT, fontSize: 20, fontWeight: 700, color: '#1A1A2E', marginBottom: 8 }}>
                    Tudo pronto para salvar
                  </h3>
                  <p style={{ ...FONT, fontSize: 14, color: '#9B8FAE' }}>
                    Revise os dados antes de salvar
                  </p>
                </div>

                <div style={{ background: '#FFFFFF', borderRadius: 20, border: '1px solid #E8E0EE', padding: 20 }}>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span style={{ ...FONT, fontSize: 14, color: '#9B8FAE' }}>Campanha</span>
                      <span style={{ ...FONT, fontSize: 14, fontWeight: 700, color: '#1A1A2E' }}>{form.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ ...FONT, fontSize: 14, color: '#9B8FAE' }}>Link</span>
                      <span style={{ ...FONT, fontSize: 13, color: '#E8357A', fontFamily: 'monospace' }}>
                        roletadsaude.lovable.app/{form.slug}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ ...FONT, fontSize: 14, color: '#9B8FAE' }}>Prêmios</span>
                      <span style={{ ...FONT, fontSize: 14, fontWeight: 700, color: '#1A1A2E' }}>
                        {activePrizes.length} prêmio{activePrizes.length !== 1 ? 's' : ''} criado{activePrizes.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ ...FONT, fontSize: 14, color: '#9B8FAE' }}>Participantes</span>
                      <span style={{ ...FONT, fontSize: 14, fontWeight: 700, color: '#1A1A2E' }}>
                        {importedParticipants.filter(r => r.status === 'valid').length > 0
                          ? `${importedParticipants.filter(r => r.status === 'valid').length} contatos válidos`
                          : 'Nenhum importado'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 justify-center" style={{ ...FONT, fontSize: 13, color: '#9B8FAE' }}>
                  <span>ℹ️</span>
                  <span>Após salvar, você configurará as probabilidades de cada prêmio na próxima etapa.</span>
                </div>

                {saveError && (
                  <div style={{ ...FONT, background: '#FEE2E2', borderRadius: 12, padding: '10px 16px', fontSize: 14, color: '#EF4444', fontWeight: 700, textAlign: 'center' }}>
                    {saveError}
                  </div>
                )}

                {savedCampaignId && hasImportedParticipants && (
                  <div className="flex justify-center">
                    <DownloadLinksButton />
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Probabilidades */}
            {step === 3 && (
              <div className="space-y-4">
                {hasImportedParticipants && (
                  <div className="flex justify-end">
                    <DownloadLinksButton />
                  </div>
                )}
                <ProbabilityEditor
                  prizes={probPrizes}
                  onChange={handleProbChange}
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-between shrink-0" style={{ padding: '16px 24px', borderTop: '1px solid #E8E0EE' }}>
            <div>
              {step === 0 && (
                <button
                  onClick={onClose}
                  className="transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{
                    ...FONT, background: '#FFFFFF', color: '#5A5A7A', border: '1.5px solid #E8E0EE',
                    borderRadius: 50, padding: '12px 24px', fontWeight: 700, fontSize: 16, cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
              )}
              {step > 0 && step < 3 && (
                <button
                  onClick={() => setStep((step - 1) as Step)}
                  className="flex items-center gap-2 transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{
                    ...FONT, background: '#FFFFFF', color: '#5A5A7A', border: '1.5px solid #E8E0EE',
                    borderRadius: 50, padding: '12px 24px', fontWeight: 700, fontSize: 16, cursor: 'pointer',
                  }}
                >
                  <ChevronLeft size={16} /> Voltar
                </button>
              )}
              {step === 3 && (
                <button
                  onClick={() => setStep(2)}
                  className="flex items-center gap-2 transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{
                    ...FONT, background: '#FFFFFF', color: '#5A5A7A', border: '1.5px solid #E8E0EE',
                    borderRadius: 50, padding: '12px 24px', fontWeight: 700, fontSize: 16, cursor: 'pointer',
                  }}
                >
                  <ChevronLeft size={16} /> Voltar
                </button>
              )}
            </div>
            <div>
              {step === 0 && (
                <button
                  onClick={() => setStep(1)}
                  disabled={!canProceed}
                  className="flex items-center gap-2 transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{
                    ...FONT, background: '#E8357A', color: '#fff', borderRadius: 50, padding: '12px 24px',
                    fontWeight: 700, fontSize: 16, border: 'none', cursor: 'pointer',
                    opacity: !canProceed ? 0.6 : 1,
                  }}
                >
                  Próximo <ChevronRight size={16} />
                </button>
              )}
              {step === 1 && (
                <button
                  onClick={() => setStep(2)}
                  disabled={activePrizes.length === 0}
                  className="flex items-center gap-2 transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{
                    ...FONT, background: '#E8357A', color: '#fff', borderRadius: 50, padding: '12px 24px',
                    fontWeight: 700, fontSize: 16, border: 'none', cursor: 'pointer',
                    opacity: activePrizes.length === 0 ? 0.6 : 1,
                  }}
                >
                  Próximo <ChevronRight size={16} />
                </button>
              )}
              {step === 2 && (
                <button
                  onClick={handleSaveStep}
                  disabled={saving}
                  className="flex items-center gap-2 transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{
                    ...FONT, background: '#E8357A', color: '#fff', borderRadius: 50, padding: '12px 24px',
                    fontWeight: 700, fontSize: 16, border: 'none', cursor: 'pointer',
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? (
                    <><Loader2 size={16} className="animate-spin" /> Salvando...</>
                  ) : (
                    <>{isMobileModal ? 'Salvar' : 'Salvar campanha e prêmios'} <ChevronRight size={16} /></>
                  )}
                </button>
              )}
              {step === 3 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleFinishProbabilities}
                      disabled={saving || totalProb !== 100}
                      className="flex items-center gap-2 transition-all hover:opacity-90 active:scale-[0.98]"
                      style={{
                        ...FONT, background: '#E8357A', color: '#fff', borderRadius: 50, padding: '12px 24px',
                        fontWeight: 700, fontSize: 16, border: 'none', cursor: 'pointer',
                        opacity: (saving || totalProb !== 100) ? 0.6 : 1,
                      }}
                    >
                      {saving ? (
                        <><Loader2 size={16} className="animate-spin" /> Salvando...</>
                      ) : (
                        <>Concluir campanha <Check size={16} /></>
                      )}
                    </button>
                  </TooltipTrigger>
                  {totalProb !== 100 && (
                    <TooltipContent>A soma das probabilidades deve ser 100%</TooltipContent>
                  )}
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default CampaignModal;
