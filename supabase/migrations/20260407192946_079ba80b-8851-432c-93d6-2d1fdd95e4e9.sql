
-- 1. Constraint de unicidade email por campanha
ALTER TABLE public.campaign_participants
ADD CONSTRAINT unique_email_per_campaign UNIQUE (campaign_id, email);

-- 2. Permitir anon inserir em campaign_participants (para fluxo orgânico)
CREATE POLICY "Anon can insert organic participants"
ON public.campaign_participants
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 3. RPC de preview (leitura sem consumir token)
CREATE OR REPLACE FUNCTION public.get_token_preview(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p campaign_participants%ROWTYPE;
  v_campaign campaigns%ROWTYPE;
BEGIN
  SELECT * INTO v_p FROM campaign_participants
  WHERE unique_token = p_token;

  IF NOT FOUND THEN
    RETURN json_build_object('status', 'invalid');
  END IF;

  SELECT * INTO v_campaign FROM campaigns WHERE id = v_p.campaign_id;
  IF NOT FOUND OR NOT v_campaign.active THEN
    RETURN json_build_object('status', 'campaign_inactive');
  END IF;

  IF v_p.played THEN
    RETURN json_build_object('status', 'already_used');
  END IF;

  RETURN json_build_object(
    'status', 'valid',
    'participant_id', v_p.id,
    'campaign_id', v_p.campaign_id,
    'campaign_slug', v_campaign.slug,
    'name', split_part(v_p.name, ' ', 1),
    'email_masked', regexp_replace(v_p.email, '(^.{4})(.*)(@.*)', '\1***\3'),
    'phone_masked', '●●●●●●' || right(v_p.phone, 4)
  );
END;
$$;

-- 4. RPC de consumo atômico
CREATE OR REPLACE FUNCTION public.consume_participation_token(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p campaign_participants%ROWTYPE;
  v_campaign campaigns%ROWTYPE;
BEGIN
  SELECT * INTO v_p FROM campaign_participants
  WHERE unique_token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('status', 'invalid');
  END IF;

  SELECT * INTO v_campaign FROM campaigns WHERE id = v_p.campaign_id;
  IF NOT FOUND OR NOT v_campaign.active THEN
    RETURN json_build_object('status', 'campaign_inactive');
  END IF;

  IF v_p.played THEN
    RETURN json_build_object('status', 'already_used');
  END IF;

  UPDATE campaign_participants
  SET played = TRUE
  WHERE id = v_p.id;

  RETURN json_build_object(
    'status', 'valid',
    'participant_id', v_p.id,
    'campaign_id', v_p.campaign_id,
    'name', v_p.name,
    'email', v_p.email,
    'phone', v_p.phone
  );
END;
$$;
