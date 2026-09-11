-- Blindagem cross-device: a impressão digital do dispositivo (device_id) e o
-- lead_ref (sessão do navegador) só identificam a pessoa NO MESMO aparelho.
-- Se ela abrir o mesmo link em outro dispositivo (ex: computador -> celular)
-- com os mesmos dados, nada batia até a participação terminar — porque o
-- e-mail só era cruzado contra `participations`, que só ganha registro no
-- fim (ganhou ou zerou as chances). Agora o e-mail é gravado em CADA giro,
-- então o cruzamento vale desde a primeira tentativa, em qualquer aparelho.

alter table public.campaign_spins
  add column if not exists email text;

create index if not exists campaign_spins_campaign_email_idx
  on public.campaign_spins (campaign_id, email)
  where email is not null;
