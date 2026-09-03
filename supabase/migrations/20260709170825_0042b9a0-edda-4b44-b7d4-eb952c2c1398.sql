DROP FUNCTION IF EXISTS public.get_wheel_segments(uuid);

CREATE OR REPLACE FUNCTION public.get_wheel_segments(p_campaign uuid)
 RETURNS TABLE(id uuid, label text, emoji text, image_url text, color_token text, display_order integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH src AS (
    SELECT p.id, p.name AS label, p.emoji, p.image_url, p.color_token, p.display_order,
           p.is_consolation, GREATEST(COALESCE(p.weight,1),1) AS weight
    FROM public.prizes p
    JOIN public.campaigns c ON c.id = p.campaign_id
    WHERE p.campaign_id = p_campaign
      AND p.active = true
      AND c.active = true
  )
  SELECT src.id, src.label, src.emoji, src.image_url, src.color_token, src.display_order
  FROM src
  CROSS JOIN LATERAL generate_series(1, CASE WHEN src.is_consolation THEN src.weight ELSE 1 END) AS g
  ORDER BY src.display_order ASC, g ASC;
$function$;

REVOKE ALL ON FUNCTION public.get_wheel_segments(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_wheel_segments(uuid) TO anon, authenticated;