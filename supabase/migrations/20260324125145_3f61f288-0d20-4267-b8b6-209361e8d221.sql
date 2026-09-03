-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS for user_roles
CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Create prizes table
CREATE TABLE public.prizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  emoji TEXT NOT NULL DEFAULT '🎁',
  image_url TEXT NOT NULL DEFAULT '',
  redeem_instructions TEXT NOT NULL DEFAULT '',
  checkout_url TEXT,
  weight NUMERIC NOT NULL DEFAULT 0.25,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.prizes ENABLE ROW LEVEL SECURITY;

-- Prizes: public read, admin write
CREATE POLICY "Anyone can read active prizes" ON public.prizes
  FOR SELECT USING (true);
CREATE POLICY "Admins can insert prizes" ON public.prizes
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update prizes" ON public.prizes
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete prizes" ON public.prizes
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Create participations table
CREATE TABLE public.participations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  prize_id UUID REFERENCES public.prizes(id) NOT NULL,
  played_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.participations ENABLE ROW LEVEL SECURITY;

-- Participations: anyone can insert, admin can read
CREATE POLICY "Anyone can insert participation" ON public.participations
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can read participations" ON public.participations
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Seed the 4 current prizes
INSERT INTO public.prizes (name, description, emoji, image_url, redeem_instructions, checkout_url, weight) VALUES
  ('Copo Kivid', 'Um copo exclusivo Kivid pra você levar pra todo lugar!', '🥤', '/assets/prizes/COPO_KIVID.png', 'Retire seu copo no ponto de entrega mais próximo. Enviaremos os detalhes por WhatsApp.', NULL, 0.4),
  ('Cupom RENOVE10', '10% de desconto na renovação do seu plano Kivid!', '🏷️', '/assets/prizes/CUPOM_10.png', 'Use o código RENOVE10 ao renovar seu plano no app Kivid.', 'https://kivid.com.br/checkout?cupom=RENOVE10', 0.3),
  ('Cupom RENOVE30', '30% de desconto na renovação do seu plano Kivid!', '🎫', '/assets/prizes/CUPOM_30.png', 'Use o código RENOVE30 ao renovar seu plano no app Kivid.', 'https://kivid.com.br/checkout?cupom=RENOVE30', 0.2),
  ('Passaporte Família', 'Um Passaporte Família Kivid completo para você e sua família!', '👨‍👩‍👧‍👦', '/assets/prizes/PASSAPORTE_FAMILIA.png', 'Entraremos em contato pelo WhatsApp para ativar seu Passaporte Família.', NULL, 0.1);