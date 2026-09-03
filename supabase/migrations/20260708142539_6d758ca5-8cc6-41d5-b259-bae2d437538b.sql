
CREATE OR REPLACE FUNCTION public.get_campaign_prizes(p_campaign uuid)
RETURNS TABLE (
  id uuid,
  name text,
  emoji text,
  description text,
  image_url text,
  checkout_url text,
  redeem_instructions text,
  is_consolation boolean,
  color_token text,
  display_order int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, p.emoji, p.description, p.image_url, p.checkout_url,
         p.redeem_instructions, p.is_consolation, p.color_token, p.display_order
  FROM public.prizes p
  JOIN public.campaigns c ON c.id = p.campaign_id
  WHERE p.campaign_id = p_campaign
    AND p.active = true
    AND c.active = true
  ORDER BY p.display_order ASC, p.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.get_campaign_prizes(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_campaign_prizes(uuid) TO anon, authenticated;
