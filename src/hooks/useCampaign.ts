import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getDeviceId } from '@/lib/device-id';
import type { Tables } from '@/integrations/supabase/types';

export type CampaignStep =
  | 'loading'
  | 'no_campaign'
  | 'not_found'
  | 'inactive'
  | 'token_required'
  | 'token_error'
  | 'landing'
  | 'validation'
  | 'game'
  | 'reward'
  | 'consolation'
  | 'already_played';



export type Prize = Tables<'prizes'>;

interface ParticipantData {
  name: string;
  email: string;
  whatsapp: string;
}

export interface SpinResult {
  segmentIndex: number;
  totalSegments: number;
  prize: {
    id: string;
    name: string;
    emoji: string;
    description: string;
    image_url: string;
    checkout_url: string | null;
    redeem_instructions: string;
    is_consolation: boolean;
  };
  /** Qual tentativa é esta (1-based). */
  attempt: number;
  /** Total de chances configurado na campanha. */
  maxAttempts: number;
  /** Chances restantes DEPOIS desta. */
  attemptsLeft: number;
  /** Acabou (ganhou OU zerou as chances). */
  finished: boolean;
  /** Ganhou um prêmio real (não a consolação). */
  won: boolean;
}

/** Estado de chances do jogador nesta campanha. */
export interface AttemptsState {
  used: number;
  max: number;
  left: number;
}

export function useCampaign(slug?: string) {
  const [step, setStep] = useState<CampaignStep>('loading');
  const [participantData, setParticipantData] = useState<ParticipantData>({ name: '', email: '', whatsapp: '' });
  const [prize, setPrize] = useState<Prize | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [lgpdAccepted, setLgpdAccepted] = useState(false);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [campaignLoaded, setCampaignLoaded] = useState(false);
  const [hasParticipantList, setHasParticipantList] = useState(false);
  const [validationError, setValidationError] = useState<string | undefined>();
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [prefillData, setPrefillData] = useState<{ name: string; email: string; phone: string } | null>(null);
  // Chances por pessoa nesta campanha (participation_limit) e quantas já usou.
  const [attempts, setAttempts] = useState<AttemptsState>({ used: 0, max: 1, left: 1 });
  

  // lead_ref for roulette (token-based or session uuid)
  const leadRefRef = useRef<string | null>(null);

  // Chaves de estado local por campanha:
  //  kivid_lead_<id>  → dados do formulário já enviados (antes de girar)
  //  kivid_spun_<id>  → resultado da roleta (giro já usado — link "gasto")
  //  kivid_played_<id>→ compat: mantido junto de kivid_spun_
  const leadStorageKey = (id: string) => `kivid_lead_${id}`;
  const spunStorageKey = (id: string) => `kivid_spun_${id}`;
  const playedStorageKey = (id: string) => `kivid_played_${id}`;

  const restoreSpunPrize = (id: string): Prize | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(spunStorageKey(id));
      if (!raw) return null;
      return JSON.parse(raw) as Prize;
    } catch {
      return null;
    }
  };

  const restoreLead = (id: string): ParticipantData | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(leadStorageKey(id));
      if (!raw) return null;
      return JSON.parse(raw) as ParticipantData;
    } catch {
      return null;
    }
  };

  // Payload de prêmio do spin-roulette → objeto Prize completo.
  const buildPrize = (p: SpinResult['prize']): Prize => ({
    id: p.id,
    name: p.name,
    emoji: p.emoji,
    description: p.description,
    image_url: p.image_url,
    checkout_url: p.checkout_url,
    redeem_instructions: p.redeem_instructions,
    is_consolation: p.is_consolation,
    weight: 1,
    probability: 0,
    quantity_available: null,
    quantity_distributed: 0,
    active: true,
    campaign_id: campaignId ?? undefined,
    created_at: '',
    color_token: null,
    display_order: 0,
  } as unknown as Prize);


  // Resolve campaign from slug
  useEffect(() => {
    if (!slug) {
      setStep('no_campaign');
      setCampaignLoaded(true);
      return;
    }

    // Consulta o estado de chances do jogador no servidor (fonte da verdade).
    // Usado ao retomar a roleta depois de recarregar a página.
    const resumeState = async (campId: string, lead: ParticipantData | null) => {
      try {
        const device_id = await getDeviceId().catch(() => undefined);
        const { data } = await supabase.functions.invoke('spin-roulette', {
          body: {
            campaign_id: campId,
            lead_ref: leadRefRef.current,
            device_id,
            email: lead?.email || undefined,
            check_only: true,
          },
        });
        return data as {
          check_only?: boolean; already_spun?: boolean;
          finished?: boolean; won?: boolean;
          maxAttempts?: number; attemptsUsed?: number; attemptsLeft?: number;
          prize?: SpinResult['prize'];
        } | null;
      } catch {
        return null;
      }
    };

    const loadCampaign = async () => {
      const { data } = await supabase
        .from('campaigns')
        .select('id, active, end_date, has_participant_list, mechanic, is_test, participation_limit')
        .eq('slug', slug)
        .single() as { data: { id: string; active: boolean; end_date: string; has_participant_list: boolean; mechanic: string; is_test: boolean; participation_limit: number | null } | null; error: any };

      if (!data) {
        setStep('not_found');
        setCampaignLoaded(true);
        return;
      }

      const maxAttempts = Math.min(20, Math.max(1, Number(data.participation_limit) || 1));
      setAttempts({ used: 0, max: maxAttempts, left: maxAttempts });

      if (!data.active || (data.end_date && new Date(data.end_date) < new Date())) {
        setStep('inactive');
        setCampaignLoaded(true);
        return;
      }

      const isTest = !!data.is_test;

      // Campanha de teste: limpa todo o estado local para permitir repetir o
      // fluxo inteiro (formulário + giro) a cada acesso.
      if (isTest && typeof window !== 'undefined') {
        localStorage.removeItem(playedStorageKey(data.id));
        localStorage.removeItem(spunStorageKey(data.id));
        localStorage.removeItem(leadStorageKey(data.id));
      }

      setCampaignId(data.id);
      setHasParticipantList(data.has_participant_list);

      setCampaignLoaded(true);


      // --- Token-based access for list campaigns ---
      if (data.has_participant_list) {
        const token = new URLSearchParams(window.location.search).get('token');

        if (!token) {
          setStep('token_required');
          return;
        }

        setCurrentToken(token);
        leadRefRef.current = token; // for roulette

        const { data: result, error } = await supabase.rpc('consume_participation_token', { p_token: token });

        if (error || !result) {
          setStep('token_error');
          return;
        }

        const res = result as any;

        if (res.status === 'invalid') {
          setStep('token_error');
          return;
        }
        if (res.status === 'already_used') {
          setStep('already_played');
          return;
        }
        if (res.status === 'campaign_inactive') {
          setStep('inactive');
          return;
        }

        // Valid token — store prefill data for validation form
        setParticipantId(res.participant_id);
        setPrefillData({
          name: res.name || '',
          email: res.email || '',
          phone: res.phone || '',
        });

        // Já finalizou (localStorage) → "Você já veio por aqui".
        if (restoreSpunPrize(data.id)) {
          setStep('already_played');
          return;
        }
        // Já preencheu o formulário → confere o estado de chances no servidor.
        const lead = restoreLead(data.id);
        if (lead) {
          setParticipantData(lead);
          await routeResume(data.id, lead, maxAttempts, isTest);
          return;
        }

        setStep('landing');
        return;
      }

      // --- Open campaign (no list) ---
      // Generate or reuse session lead_ref
      const storageKey = `kivid_ref_${data.id}`;
      let ref = localStorage.getItem(storageKey);
      if (!ref) {
        ref = crypto.randomUUID();
        localStorage.setItem(storageKey, ref);
      }
      leadRefRef.current = ref;

      if (typeof window !== 'undefined' && (restoreSpunPrize(data.id) || localStorage.getItem(playedStorageKey(data.id)))) {
        // Já finalizou (localStorage) → "Você já veio por aqui".
        setStep('already_played');
      } else {
        const lead = restoreLead(data.id);
        if (lead) {
          setParticipantData(lead);
          // Confere no servidor quantas chances o jogador já usou.
          await routeResume(data.id, lead, maxAttempts, isTest);
        } else {
          setStep('landing');
        }
      }

    };

    // Retoma na roleta com o estado de chances correto (fonte: servidor).
    const routeResume = async (campId: string, lead: ParticipantData, maxAttempts: number, testCampaign: boolean) => {
      if (testCampaign) { setStep('game'); return; } // teste: sempre recomeça
      const s = await resumeState(campId, lead);
      if (s?.finished && s.prize) {
        setPrize(buildPrize(s.prize));
        setAttempts({ used: s.attemptsUsed ?? maxAttempts, max: s.maxAttempts ?? maxAttempts, left: 0 });
        try { localStorage.setItem(spunStorageKey(campId), JSON.stringify(buildPrize(s.prize))); } catch { /* noop */ }
        setStep(s.won ? 'reward' : 'consolation');
        return;
      }
      const used = s?.attemptsUsed ?? 0;
      const max = s?.maxAttempts ?? maxAttempts;
      setAttempts({ used, max, left: Math.max(0, max - used) });
      setStep('game');
    };

    loadCampaign();
  }, [slug]);

  // Fetch active prizes (via RPC for security — no direct table SELECT)
  useEffect(() => {
    if (!campaignLoaded || !campaignId) return;
    const fetchPrizes = async () => {
      // Use the security-definer RPC to get public prize data
      const { data, error } = await supabase.rpc('get_campaign_prizes', { p_campaign: campaignId });
      if (!error && data) {
        // Cast to Prize — weights/stock hidden from public RPC
        setPrizes(data.map((p: any) => ({
          ...p,
          weight: 1,
          probability: p.probability ?? 0,
          quantity_available: null,
          quantity_distributed: 0,
          active: true,
          campaign_id: campaignId,
          created_at: '',
        } as Prize)));
      }
    };
    fetchPrizes();
  }, [campaignId, campaignLoaded]);

  const goToValidation = useCallback(() => {
    setValidationError(undefined);
    // Fluxo: os dados vêm ANTES de girar a roleta.
    setStep('validation');
  }, []);

  const submitValidation = useCallback(async (raw: ParticipantData): Promise<{ success: boolean; error?: string }> => {
    setValidationError(undefined);
    // E-mail sempre em minúsculo — dedupe consistente no servidor.
    const data: ParticipantData = { ...raw, email: raw.email.trim().toLowerCase() };
    setParticipantData(data);

    // Registra o lead agora (antes de girar) — ganhe ou perca.
    if (hasParticipantList && participantId) {
      // Campanha com lista: atualiza contato via RPC SECURITY DEFINER.
      await supabase.rpc('update_participant_contact', {
        p_participant_id: participantId,
        p_name: data.name,
        p_email: data.email,
        p_phone: data.whatsapp,
      } as any);
    } else if (campaignId) {
      // Campanha aberta: cria o participante.
      await supabase.from('campaign_participants').insert({
        campaign_id: campaignId,
        name: data.name,
        email: data.email,
        phone: data.whatsapp,
        source: 'Roleta',
      } as any);
    }

    // Persiste os dados localmente para retomar direto na roleta se recarregar.
    if (campaignId && typeof window !== 'undefined') {
      try { localStorage.setItem(leadStorageKey(campaignId), JSON.stringify(data)); } catch { /* noop */ }
    }

    setStep('game');
    return { success: true };
  }, [campaignId, hasParticipantList, participantId]);





  // Roulette spin: calls edge function
  const spinRoulette = useCallback(async (): Promise<SpinResult | null> => {
    if (!campaignId || !leadRefRef.current) return null;
    // Impressão digital do dispositivo + e-mail — blinda o giro único no servidor.
    const device_id = await getDeviceId().catch(() => undefined);
    const { data, error } = await supabase.functions.invoke('spin-roulette', {
      body: {
        campaign_id: campaignId,
        lead_ref: leadRefRef.current,
        device_id,
        email: participantData.email || undefined,
        name: participantData.name || undefined,
      },
    });
    if (error || !data || data.error) {
      console.error('spin-roulette error', error || data?.error);
      return null;
    }
    const result = data as SpinResult;
    // Atualiza o contador de chances a cada giro.
    setAttempts({
      used: result.attempt,
      max: result.maxAttempts,
      left: result.attemptsLeft,
    });
    return result;
  }, [campaignId, participantData.email, participantData.name]);

  // Chamado quando a roleta PARA e a participação está encerrada (ganhou ou
  // zerou as chances). Registra a participação e leva à tela de resultado.
  const finalizeRouletteResult = useCallback(async (spinResult: SpinResult) => {
    const won = buildPrize(spinResult.prize);
    setPrize(won);

    // Marca como finalizado — reabrir a campanha cai em "já veio por aqui".
    if (campaignId && typeof window !== 'undefined') {
      try {
        localStorage.setItem(spunStorageKey(campaignId), JSON.stringify(won));
        localStorage.setItem(playedStorageKey(campaignId), 'true');
      } catch { /* noop */ }
    }

    // Uma única participação por pessoa (o prêmio final: vitória ou consolação).
    await supabase.from('participations').insert({
      name: participantData.name,
      email: participantData.email,
      whatsapp: participantData.whatsapp,
      prize_id: won.id,
      campaign_id: campaignId,
    });

    if (participantId) {
      await supabase.rpc('mark_participant_played', { p_participant_id: participantId });
    }

    setStep(spinResult.won ? 'reward' : 'consolation');
  }, [campaignId, participantData, participantId]);

  // Sem "resetar campanha": um giro por acesso é definitivo. Campanhas de teste
  // já limpam todo o estado local a cada carregamento (ver loadCampaign).

  return {
    step,
    participantData,
    prize,
    termsAccepted,
    lgpdAccepted,
    setTermsAccepted,
    setLgpdAccepted,
    goToValidation,
    submitValidation,
    hasParticipantList,
    validationError,
    prefillData,
    campaignId,
    spinRoulette,
    finalizeRouletteResult,
    attempts,
  };
}
