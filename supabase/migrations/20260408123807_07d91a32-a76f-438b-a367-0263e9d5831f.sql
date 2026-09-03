
CREATE OR REPLACE FUNCTION public.validate_list_participant(
  p_campaign_id UUID,
  p_email TEXT,
  p_phone TEXT DEFAULT ''
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_p campaign_participants%ROWTYPE;
BEGIN
  -- Try email first
  SELECT * INTO v_p FROM campaign_participants
  WHERE campaign_id = p_campaign_id AND lower(email) = lower(p_email)
  FOR UPDATE;

  -- Fallback to phone if not found and phone provided
  IF NOT FOUND AND p_phone <> '' THEN
    SELECT * INTO v_p FROM campaign_participants
    WHERE campaign_id = p_campaign_id AND lower(phone) = lower(p_phone)
    FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    RETURN json_build_object('status', 'not_found');
  END IF;

  IF v_p.played THEN
    RETURN json_build_object('status', 'already_played');
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

CREATE OR REPLACE FUNCTION public.mark_participant_played(p_participant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE campaign_participants SET played = TRUE WHERE id = p_participant_id AND played = FALSE;
END;
$$;
