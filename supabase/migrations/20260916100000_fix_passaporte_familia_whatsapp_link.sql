-- Corrige o link de resgate (WhatsApp) dos prêmios "Passaporte Família" da
-- campanha "Dia do cliente comunidade": removendo o emoji 🏆 do início da
-- mensagem, que o WhatsApp às vezes não decodifica bem em links wa.me
-- (mostra o losango de interrogação no lugar dele no campo de mensagem).
-- A URL em si já estava corretamente codificada — só o emoji causava o
-- problema nesse contexto específico.
UPDATE public.prizes
SET checkout_url = 'https://wa.me/557133458210?text=Vim%20ativar%20meu%20Passaporte%20Fam%C3%ADlia%20gr%C3%A1tis%20da%20promo%C3%A7%C3%A3o%20Dia%20do%20Cliente%20do%20Kivid'
WHERE checkout_url = 'https://wa.me/557133458210?text=%F0%9F%8F%86%20Vim%20ativar%20meu%20Passaporte%20Fam%C3%ADlia%20gr%C3%A1tis%20da%20promo%C3%A7%C3%A3o%20Dia%20do%20Cliente%20do%20Kivid';
