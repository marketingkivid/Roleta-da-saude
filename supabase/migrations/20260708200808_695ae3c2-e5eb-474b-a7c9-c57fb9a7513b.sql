DROP FUNCTION IF EXISTS public.get_wheel_segments(uuid);

CREATE OR REPLACE FUNCTION public.get_wheel_segments(p_campaign uuid)
RETURNS TABLE (
  id uuid,
  label text,
  emoji text,
  color_token text,
  display_order int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name AS label, p.emoji, p.color_token, p.display_order
  FROM public.prizes p
  JOIN public.campaigns c ON c.id = p.campaign_id
  WHERE p.campaign_id = p_campaign
    AND p.active = true
    AND c.active = true
  ORDER BY p.display_order ASC, p.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.get_wheel_segments(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_wheel_segments(uuid) TO anon, authenticated;