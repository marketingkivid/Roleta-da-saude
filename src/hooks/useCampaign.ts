import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
  

  // lead_ref for roulette (token-based or session uuid)
  const leadRefRef = useRef<string | null>(null);

  // URL do simulador Kivid — destino em caso de derrota na roleta.
  const SIMULADOR_URL = 'https://kivid.com.br/simulador';

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


  // Resolve campaign from slug
  useEffect(() => {
    if (!slug) {
      setStep('no_campaign');
      setCampaignLoaded(true);
      return;
    }

    const loadCampaign = async () => {
      const { data } = await supabase
        .from('campaigns')
        .select('id, active, end_date, has_participant_list, mechanic, is_test')
        .eq('slug', slug)
        .single() as { data: { id: string; active: boolean; end_date: string; has_participant_list: boolean; mechanic: string; is_test: boolean } | null; error: any };

      if (!data) {
        setStep('not_found');
        setCampaignLoaded(true);
        return;
      }

      if (!data.active || (data.end_date && new Date(data.end_date) < new Date())) {
        setStep('inactive');
        setCampaignLoaded(true);
        return;
      }

      const isTest = !!data.is_test;

      // Campanha de teste: limpa bloqueios locais para permitir novo acesso.
      if (isTest && typeof window !== 'undefined') {
        localStorage.removeItem(playedStorageKey(data.id));
        localStorage.removeItem(spunStorageKey(data.id));
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

        // Se o usuário já girou (persistido localmente) mas ainda não enviou o
        // formulário, decide o próximo passo com base no resultado:
        // - Prêmio real → volta ao formulário de validação (1 giro por sessão).
        // - Consolação  → não há cadastro; marca como já jogado.
        const restored = restoreSpunPrize(data.id);
        if (restored && !localStorage.getItem(playedStorageKey(data.id))) {
          setPrize(restored);
          setStep(restored.is_consolation ? 'consolation' : 'validation');
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

      if (typeof window !== 'undefined' && localStorage.getItem(playedStorageKey(data.id))) {
        setStep('already_played');
      } else {
        // Já girou nesta sessão: se ganhou, retoma o formulário; se perdeu,
        // marca como já jogado (fluxo de derrota termina no simulador).
        const restored = restoreSpunPrize(data.id);
        if (restored) {
          setPrize(restored);
          setStep(restored.is_consolation ? 'consolation' : 'validation');
        } else {
          setStep('landing');
        }
      }

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
    // Roleta flow: usuário gira primeiro, formulário aparece após o prêmio.
    setStep('game');
  }, []);

  const submitValidation = useCallback(async (data: ParticipantData): Promise<{ success: boolean; error?: string }> => {
    setValidationError(undefined);

    if (!prize) {
      const msg = 'Gire a roleta antes de enviar seus dados.';
      setValidationError(msg);
      return { success: false, error: msg };
    }

    setParticipantData(data);

    // Token campaign: update contact fields via SECURITY DEFINER RPC (no open UPDATE policy).
    if (hasParticipantList && participantId) {
      await supabase.rpc('update_participant_contact', {
        p_participant_id: participantId,
        p_name: data.name,
        p_email: data.email,
        p_phone: data.whatsapp,
      } as any);
    } else if (campaignId) {
      // Open campaign: create the participant record now
      await supabase.from('campaign_participants').insert({
        campaign_id: campaignId,
        name: data.name,
        email: data.email,
        phone: data.whatsapp,
        source: 'Roleta',
      } as any);
    }

    // Record the participation with the drawn prize
    await supabase.from('participations').insert({
      name: data.name,
      email: data.email,
      whatsapp: data.whatsapp,
      prize_id: prize.id,
      campaign_id: campaignId,
    });

    if (participantId) {
      await supabase.rpc('mark_participant_played', { p_participant_id: participantId });
    }

    const storageKey = campaignId ? `kivid_played_${campaignId}` : 'kivid_played';
    localStorage.setItem(storageKey, 'true');

    setStep(prize.is_consolation ? 'consolation' : 'reward');
    return { success: true };
  }, [campaignId, hasParticipantList, prize, participantId]);





  // Roulette spin: calls edge function
  const spinRoulette = useCallback(async (): Promise<SpinResult | null> => {
    if (!campaignId || !leadRefRef.current) return null;
    const { data, error } = await supabase.functions.invoke('spin-roulette', {
      body: { campaign_id: campaignId, lead_ref: leadRefRef.current },
    });
    if (error || !data || data.error) {
      console.error('spin-roulette error', error || data?.error);
      return null;
    }
    return data as SpinResult;
  }, [campaignId]);

  // Called after roulette animation lands + reveal — collects prize and routes to post-win form
  const finalizeRouletteWin = useCallback(async (spinResult: SpinResult) => {
    const { prize: p } = spinResult;
    const won: Prize = {
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
    } as unknown as Prize;

    setPrize(won);

    // Persiste "já girou" para que, ao retornar à roleta, o usuário caia
    // direto no formulário em vez de poder girar de novo (regra existente
    // de 1 giro por sessão, agora persistida também no client).
    if (campaignId && typeof window !== 'undefined') {
      try {
        localStorage.setItem(spunStorageKey(campaignId), JSON.stringify(won));
      } catch { /* noop */ }
    }

    if (p.is_consolation) {
      // Derrota: ao fechar o modal de "Não foi dessa vez", vai para a tela
      // de consolação (com "Voltar ao início"), em vez da tela "já jogou".
      setStep('consolation');
      return;
    }

    // Vitória: seguir para o formulário de cadastro.
    setStep('validation');

  }, [campaignId]);

  // Fechar modal de resultado (× / backdrop / ESC) → tela "já participou".
  const closeRouletteModal = useCallback(() => {
    if (campaignId && typeof window !== 'undefined') {
      try { localStorage.setItem(playedStorageKey(campaignId), 'true'); } catch { /* noop */ }
    }
    setStep('already_played');
  }, [campaignId]);


  const resetCampaign = useCallback(() => {
    if (campaignId && typeof window !== 'undefined') {
      localStorage.removeItem(playedStorageKey(campaignId));
      localStorage.removeItem(spunStorageKey(campaignId));
    } else if (typeof window !== 'undefined') {
      localStorage.removeItem('kivid_played');
    }
    setPrize(null);
    setParticipantData({ name: '', email: '', whatsapp: '' });
    setTermsAccepted(false);
    setLgpdAccepted(false);
    setValidationError(undefined);
    setParticipantId(null);
    setCurrentToken(null);
    setPrefillData(null);
    setStep('landing');
  }, [campaignId]);


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
    resetCampaign,
    hasParticipantList,
    validationError,
    prefillData,
    campaignId,
    spinRoulette,
    finalizeRouletteWin,
    closeRouletteModal,
  };
}
