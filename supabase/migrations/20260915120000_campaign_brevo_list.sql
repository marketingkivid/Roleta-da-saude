-- Guarda qual lista do Brevo foi usada para importar os participantes da
-- campanha (aba "Lista do Brevo" na importação) — permite reimportar/
-- atualizar depois sem o admin precisar escolher a lista de novo.
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS brevo_list_id integer,
  ADD COLUMN IF NOT EXISTS brevo_list_name text;
