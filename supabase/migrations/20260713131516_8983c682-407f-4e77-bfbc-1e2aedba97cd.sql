-- ── campaign_participants: remove políticas permissivas demais ─────────────
DROP POLICY IF EXISTS "Anyone can read campaign_participants" ON public.campaign_participants;
DROP POLICY IF EXISTS "Anon can mark as played" ON public.campaign_participants;
DROP POLICY IF EXISTS "Anon can insert organic participants" ON public.campaign_participants;

-- INSERT restrito: cadastros abertos só podem criar registros "limpos".
-- Resultados do sorteio (spun_*, token_used_at, played=true) só são gravados
-- pela edge function `spin-roulette` que usa service_role e ignora RLS.
CREATE POLICY "Public insert with safe defaults"
  ON public.campaign_participants
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    spun_at IS NULL
    AND spun_prize_id IS NULL
    AND token_used_at IS NULL
    AND played = false
  );

-- Função para o participante atualizar apenas seus dados de contato após girar.
-- Substitui o UPDATE aberto anterior sem expor a tabela ao PostgREST.
CREATE OR REPLACE FUNCTION public.update_participant_contact(
  p_participant_id uuid,
  p_name text,
  p_email text,
  p_phone text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.campaign_participants
     SET name  = COALESCE(NULLIF(trim(p_name),  ''), name),
         email = COALESCE(NULLIF(trim(p_email), ''), email),
         phone = COALESCE(NULLIF(trim(p_phone), ''), phone)
   WHERE id = p_participant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_participant_contact(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_participant_contact(uuid, text, text, text)
  TO anon, authenticated;

-- ── Storage: remove política pública de LISTAGEM do bucket prize-images ──
-- Objetos continuam acessíveis pela URL pública (bucket permanece público);
-- apenas a listagem via API deixa de ser possível para clientes.
DROP POLICY IF EXISTS "Anyone can read prize images" ON storage.objects;

-- ── SECURITY DEFINER: revogar EXECUTE de funções internas (triggers) ─────
REVOKE ALL ON FUNCTION public.set_leads_updated_at()      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_leads_updated_at()      FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_prize_probability() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_prize_probability() FROM anon, authenticated;