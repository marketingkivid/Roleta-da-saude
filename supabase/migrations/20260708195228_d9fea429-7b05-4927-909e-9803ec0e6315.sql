CREATE OR REPLACE FUNCTION public.consume_participation_token(p_token text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Consider the token consumed if the participant already played OR already spun the wheel
  IF v_p.played OR v_p.spun_at IS NOT NULL THEN
    RETURN json_build_object('status', 'already_used');
  END IF;

  RETURN json_build_object(
    'status', 'valid',
    'participant_id', v_p.id,
    'campaign_id', v_p.campaign_id,
    'name', v_p.name,
    'email', v_p.email,
    'phone', v_p.phone
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_token_preview(p_token text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF v_p.played OR v_p.spun_at IS NOT NULL THEN
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
$function$;