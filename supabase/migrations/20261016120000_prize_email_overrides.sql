-- E-mail de prêmio personalizável por prêmio. Vazio = usa o padrão da tela
-- Personalização (e o link de checkout do prêmio no botão).
alter table public.prizes
  add column if not exists email_prize_name text not null default '',
  add column if not exists email_instructions text not null default '',
  add column if not exists email_button_text text not null default '',
  add column if not exists email_button_url text not null default '';
