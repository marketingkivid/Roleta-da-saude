
-- Create campaigns table
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  campaign_type text NOT NULL DEFAULT 'gamificação',
  participation_limit integer,
  rules text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active campaigns" ON public.campaigns
  FOR SELECT TO public USING (true);

CREATE POLICY "Admins can insert campaigns" ON public.campaigns
  FOR INSERT TO public WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update campaigns" ON public.campaigns
  FOR UPDATE TO public USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete campaigns" ON public.campaigns
  FOR DELETE TO public USING (has_role(auth.uid(), 'admin'));

-- Create campaign_participants table
CREATE TABLE public.campaign_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  cpf text NOT NULL DEFAULT '',
  unique_token text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  played boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage campaign_participants" ON public.campaign_participants
  FOR ALL TO public USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Public can read own token" ON public.campaign_participants
  FOR SELECT TO anon, authenticated USING (true);

-- Alter prizes: add campaign_id, quantity_available, quantity_distributed
ALTER TABLE public.prizes
  ADD COLUMN campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  ADD COLUMN quantity_available integer,
  ADD COLUMN quantity_distributed integer NOT NULL DEFAULT 0;

-- Alter participations: add campaign_id, cpf
ALTER TABLE public.participations
  ADD COLUMN campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  ADD COLUMN cpf text;
