-- Mais opções por prêmio (assunto, título, título do bloco) + e-mail fixo de
-- "Não foi dessa vez" (consolação), enviado quando a participação termina
-- sem prêmio. Desligado por padrão até o admin revisar os textos.
alter table public.prizes
  add column if not exists email_subject text not null default '',
  add column if not exists email_title text not null default '',
  add column if not exists email_block_title text not null default '';

alter table public.email_settings
  add column if not exists consolation_enabled boolean not null default false,
  add column if not exists consolation_subject text not null default '{nome}, não foi dessa vez — mas a gente torce por você 🍀',
  add column if not exists consolation_title text not null default '{nome}, não foi dessa vez',
  add column if not exists consolation_body text not null default 'Obrigado por girar a roleta da campanha {campanha}! Desta vez não rolou prêmio, mas fique de olho: o Kivid sempre tem novidade por aí.',
  add column if not exists consolation_button_text text not null default '',
  add column if not exists consolation_button_url text not null default '';
