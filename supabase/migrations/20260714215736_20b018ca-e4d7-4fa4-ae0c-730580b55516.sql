
CREATE TABLE public.campaign_spins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  lead_ref text NOT NULL,
  prize_id uuid NOT NULL REFERENCES public.prizes(id) ON DELETE RESTRICT,
  spun_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, lead_ref)
);

CREATE INDEX idx_campaign_spins_campaign ON public.campaign_spins(campaign_id);

GRANT ALL ON public.campaign_spins TO service_role;

ALTER TABLE public.campaign_spins ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated: only service_role (edge function) reads/writes this table.
