
ALTER TABLE public.campaign_participants
  ADD COLUMN IF NOT EXISTS token_used_at TIMESTAMPTZ DEFAULT NULL;

CREATE OR REPLACE FUNCTION public.validate_token_and_participant(
  p_token TEXT,
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_p campaign_participants%ROWTYPE;
  v_phone_input TEXT;
  v_phone_stored TEXT;
BEGIN
  SELECT * INTO v_p FROM campaign_participants
  WHERE unique_token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('status', 'invalid_token');
  END IF;

  IF v_p.played THEN
    RETURN json_build_object('status', 'already_played');
  END IF;

  v_phone_input  := regexp_replace(regexp_replace(p_phone, '[^0-9]', '', 'g'), '^55', '');
  v_phone_stored := regexp_replace(regexp_replace(v_p.phone, '[^0-9]', '', 'g'), '^55', '');

  IF lower(trim(v_p.name))  != lower(trim(p_name))
  OR lower(trim(v_p.email)) != lower(trim(p_email))
  OR v_phone_stored          != v_phone_input
  THEN
    RETURN json_build_object('status', 'data_mismatch');
  END IF;

  IF v_p.token_used_at IS NULL THEN
    UPDATE campaign_participants SET token_used_at = now() WHERE id = v_p.id;
  END IF;

  RETURN json_build_object(
    'status', 'valid',
    'participant_id', v_p.id,
    'name', v_p.name,
    'email', v_p.email,
    'phone', v_p.phone
  );
END;
$$;
