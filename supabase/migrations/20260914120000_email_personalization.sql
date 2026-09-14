-- Personalização (admin): configurações globais dos e-mails transacionais
-- (prêmio + convite) enviados via Brevo. Linha única (singleton) — os textos
-- valem para TODAS as campanhas; {nome}/{premio}/{campanha} são trocados
-- pelos dados reais na hora do envio.

CREATE TABLE public.email_settings (
  id boolean PRIMARY KEY DEFAULT true,
  CONSTRAINT email_settings_singleton CHECK (id),

  whatsapp_oficial text NOT NULL DEFAULT '',
  sender_name text NOT NULL DEFAULT 'Kivid',
  sender_email text NOT NULL DEFAULT '',

  prize_subject text NOT NULL DEFAULT '🎉 {nome}, seu prêmio do Kivid chegou',
  prize_title text NOT NULL DEFAULT '{nome}, você ganhou!',
  contact_block_title text NOT NULL DEFAULT 'Como você recebe seu prêmio',
  contact_block_text text NOT NULL DEFAULT 'Nossa equipe vai entrar em contato pelo WhatsApp, no mesmo número que você cadastrou para participar.',
  antifraud_notice text NOT NULL DEFAULT 'O Kivid nunca pede senha, código ou pagamento para entregar um prêmio. Se alguém pedir, não é a gente.',
  failure_alert_email text NOT NULL DEFAULT '',

  invite_subject text NOT NULL DEFAULT '🎉 {nome}, chegou seu convite da Kivid!',
  invite_title text NOT NULL DEFAULT '{nome}, você foi convidado!',
  invite_body text NOT NULL DEFAULT 'O Kivid preparou uma surpresa para você: gire a roleta e concorra a prêmios na campanha {campanha}. É rapidinho — toque no botão abaixo para participar.',
  invite_button_text text NOT NULL DEFAULT 'Quero girar 🎡',

  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.email_settings (id) VALUES (true);

CREATE OR REPLACE FUNCTION public.set_email_settings_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_email_settings_updated_at
BEFORE UPDATE ON public.email_settings
FOR EACH ROW EXECUTE FUNCTION public.set_email_settings_updated_at();

ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read email settings"
ON public.email_settings FOR SELECT
TO anon, authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update email settings"
ON public.email_settings FOR UPDATE
TO anon, authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

GRANT ALL ON public.email_settings TO service_role;

-- Convites (campanha com lista): marca quando o e-mail de convite foi
-- enviado, pra "Enviar convites" não duplicar envio pra quem já recebeu.
ALTER TABLE public.campaign_participants
  ADD COLUMN IF NOT EXISTS invited_at timestamptz;
