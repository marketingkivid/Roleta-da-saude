-- Rede de segurança contra participação duplicada em public.participations.
-- Contexto: o cliente já foi corrigido para não gravar uma nova participação
-- quando o servidor identifica que o e-mail/dispositivo já girou (already_spun),
-- mas a tabela em si não tinha nenhuma trava. Este índice garante isso mesmo
-- que um bug futuro (ou uma chamada direta à API, fora da interface) tente
-- inserir de novo — sem travar o fluxo: um insert duplicado simplesmente
-- falha silenciosamente (o cliente não verifica o retorno de erro deste insert).

create unique index if not exists participations_campaign_email_unique_idx
  on public.participations (campaign_id, lower(email))
  where email is not null and length(trim(email)) > 0;

-- Aperta a política de inserção pública: continua permitindo que qualquer
-- visitante registre sua própria participação (não exige autenticação), mas
-- deixa de aceitar linhas em branco/lixo ou vinculadas a prêmio/campanha
-- inexistentes — hoje a policy é "WITH CHECK (true)", sem nenhuma validação.
drop policy if exists "Anyone can insert participation" on public.participations;

create policy "Anyone can insert participation"
  on public.participations
  for insert
  with check (
    name is not null and length(trim(name)) > 0
    and email is not null and length(trim(email)) > 0
    and whatsapp is not null and length(trim(whatsapp)) > 0
    and exists (select 1 from public.prizes p where p.id = prize_id)
    and exists (select 1 from public.campaigns c where c.id = campaign_id)
  );
