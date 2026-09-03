DROP FUNCTION IF EXISTS public.get_wheel_segments(uuid);

CREATE OR REPLACE FUNCTION public.get_wheel_segments(p_campaign uuid)
 RETURNS TABLE(id uuid, label text, emoji text, image_url text, color_token text, display_order integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.name AS label, p.emoji, p.image_url, p.color_token, p.display_order
  FROM public.prizes p
  JOIN public.campaigns c ON c.id = p.campaign_id
  WHERE p.campaign_id = p_campaign
    AND p.active = true
    AND c.active = true
  ORDER BY p.display_order ASC, p.created_at ASC;
$function$;