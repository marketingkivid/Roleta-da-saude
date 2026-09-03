ALTER TABLE public.campaign_participants
  ADD COLUMN IF NOT EXISTS spun_at timestamptz,
  ADD COLUMN IF NOT EXISTS spun_prize_id uuid REFERENCES public.prizes(id);

CREATE INDEX IF NOT EXISTS idx_campaign_participants_token_spin
  ON public.campaign_participants(unique_token) WHERE unique_token IS NOT NULL;