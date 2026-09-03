CREATE OR REPLACE FUNCTION public.get_wheel_segments(p_campaign uuid)
 RETURNS TABLE(id uuid, label text, emoji text, image_url text, color_token text, display_order integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
  WITH src AS (
    SELECT p.id, p.name AS label, p.emoji, p.image_url, p.color_token, p.display_order,
           p.is_consolation, GREATEST(COALESCE(p.weight,1),1) AS weight
    FROM public.prizes p
    JOIN public.campaigns c ON c.id = p.campaign_id
    WHERE p.campaign_id = p_campaign
      AND p.active = true
      AND c.active = true
  ),
  prizes_only AS (
    SELECT s.*, (ROW_NUMBER() OVER (ORDER BY s.display_order, s.id) - 1) AS rn
    FROM src s WHERE NOT s.is_consolation
  ),
  cons_expanded AS (
    SELECT s.*, g AS copy_i
    FROM src s CROSS JOIN generate_series(1, s.weight) g
    WHERE s.is_consolation
  ),
  cons AS (
    SELECT c.*, (ROW_NUMBER() OVER (ORDER BY c.display_order, c.id, c.copy_i) - 1) AS rn
    FROM cons_expanded c
  ),
  counts AS (
    SELECT (SELECT COUNT(*) FROM prizes_only)::int AS pc,
           (SELECT COUNT(*) FROM cons)::int AS cc
  ),
  prize_pos AS (
    SELECT p.id, p.label, p.emoji, p.image_url, p.color_token, p.display_order,
           CASE WHEN counts.pc = 0 THEN p.rn::int
                ELSE FLOOR(p.rn::numeric * (counts.pc + counts.cc) / counts.pc)::int
           END AS pos
    FROM prizes_only p CROSS JOIN counts
  ),
  all_pos AS (
    SELECT gs AS pos FROM counts, generate_series(0, GREATEST(counts.pc + counts.cc - 1, 0)) gs
    WHERE counts.pc + counts.cc > 0
  ),
  free_pos AS (
    SELECT pos FROM all_pos EXCEPT SELECT pos FROM prize_pos
  ),
  free_pos_num AS (
    SELECT pos, (ROW_NUMBER() OVER (ORDER BY pos) - 1) AS rn FROM free_pos
  ),
  cons_pos AS (
    SELECT c.id, c.label, c.emoji, c.image_url, c.color_token, c.display_order, f.pos
    FROM cons c JOIN free_pos_num f ON c.rn = f.rn
  )
  SELECT id, label, emoji, image_url, color_token, display_order
  FROM (
    SELECT id, label, emoji, image_url, color_token, display_order, pos FROM prize_pos
    UNION ALL
    SELECT id, label, emoji, image_url, color_token, display_order, pos FROM cons_pos
  ) x
  ORDER BY pos;
$function$;