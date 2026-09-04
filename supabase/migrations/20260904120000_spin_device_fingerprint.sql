-- Blindagem do giro único: além do lead_ref/token, guarda a impressão digital
-- do dispositivo e o IP do cliente em cada giro, para bloquear a mesma pessoa
-- mesmo que ela limpe o navegador ou tente com outro e-mail/conta.

alter table public.campaign_spins
  add column if not exists device_id text,
  add column if not exists client_ip text;

create index if not exists campaign_spins_campaign_device_idx
  on public.campaign_spins (campaign_id, device_id)
  where device_id is not null;

create index if not exists campaign_spins_campaign_ip_idx
  on public.campaign_spins (campaign_id, client_ip)
  where client_ip is not null;
