
-- Tabela leads
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL CHECK (char_length(first_name) BETWEEN 1 AND 80),
  last_name text NOT NULL CHECK (char_length(last_name) BETWEEN 1 AND 80),
  email text NOT NULL CHECK (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$' AND char_length(email) <= 255),
  whatsapp_raw text NOT NULL CHECK (whatsapp_raw ~ '^[0-9]{10,11}$'),
  whatsapp_e164 text NOT NULL CHECK (whatsapp_e164 ~ '^\+55[0-9]{10,11}$'),
  origem text NOT NULL DEFAULT 'site' CHECK (char_length(origem) <= 60),
  campanha text CHECK (campanha IS NULL OR char_length(campanha) <= 120),
  pagina text CHECK (pagina IS NULL OR char_length(pagina) <= 255),
  brevo_sync_status text NOT NULL DEFAULT 'pending' CHECK (brevo_sync_status IN ('pending','synced','error')),
  brevo_contact_id text,
  brevo_last_sync_at timestamptz,
  brevo_error text,
  merged_by_phone boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX leads_email_unique ON public.leads (lower(email));
CREATE INDEX leads_sync_status_idx ON public.leads (brevo_sync_status);
CREATE INDEX leads_created_at_idx ON public.leads (created_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_leads_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.set_leads_updated_at();

-- RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert leads"
ON public.leads FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can read leads"
ON public.leads FOR SELECT
TO anon, authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update leads"
ON public.leads FOR UPDATE
TO anon, authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete leads"
ON public.leads FOR DELETE
TO anon, authenticated
USING (has_role(auth.uid(), 'admin'));
