-- Corrige índice: era global (só uma consolação no sistema inteiro).
-- Agora é uma consolação ativa por campanha.
DROP INDEX IF EXISTS public.one_active_consolation;
CREATE UNIQUE INDEX one_active_consolation_per_campaign
  ON public.prizes (campaign_id)
  WHERE (is_consolation = true AND active = true);

-- Backfill: garantir que toda campanha tenha uma fatia de consolação.
INSERT INTO public.prizes (
  campaign_id, name, emoji, description, image_url, checkout_url, redeem_instructions,
  is_consolation, color_token, display_order, weight, probability, active, show_image
)
SELECT c.id, 'Não foi dessa vez', '🍀', '', '', NULL, '',
       true, NULL, 99, 1, 40, true, false
FROM public.campaigns c
WHERE NOT EXISTS (
  SELECT 1 FROM public.prizes p
  WHERE p.campaign_id = c.id AND p.is_consolation = true AND p.active = true
);
