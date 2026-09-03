
-- 1) campaigns.mechanic
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS mechanic text NOT NULL DEFAULT 'pipoque';

ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_mechanic_check;
ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_mechanic_check CHECK (mechanic IN ('pipoque','roleta'));

-- 2) prizes: color_token + display_order (weight e quantity_available já existem)
ALTER TABLE public.prizes
  ADD COLUMN IF NOT EXISTS color_token text,
  ADD COLUMN IF NOT EXISTS display_order int NOT NULL DEFAULT 0;

-- 3) Segurança
-- 3a) campaigns: restringir SELECT anon apenas a campanhas ativas
DROP POLICY IF EXISTS "Anyone can read active campaigns" ON public.campaigns;
CREATE POLICY "Anyone can read active campaigns"
  ON public.campaigns
  FOR SELECT
  TO anon, authenticated
  USING (active = true);

-- 3b) prizes: remover SELECT público; manter admin com acesso total
DROP POLICY IF EXISTS "Anyone can read active prizes" ON public.prizes;
CREATE POLICY "Admins can read prizes"
  ON public.prizes
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- 3c) Função pública para a roleta (sem expor peso/estoque)
CREATE OR REPLACE FUNCTION public.get_wheel_segments(p_campaign uuid)
RETURNS TABLE (
  id uuid,
  label text,
  color_token text,
  display_order int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name AS label, p.color_token, p.display_order
  FROM public.prizes p
  JOIN public.campaigns c ON c.id = p.campaign_id
  WHERE p.campaign_id = p_campaign
    AND p.active = true
    AND c.active = true
  ORDER BY p.display_order ASC, p.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.get_wheel_segments(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_wheel_segments(uuid) TO anon, authenticated;
