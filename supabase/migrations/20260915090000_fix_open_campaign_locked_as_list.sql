-- Corrige campanhas ABERTAS (sem lista) que ficaram travadas atrás de
-- "Acesso exclusivo" por engano.
--
-- Causa: o modal de edição de campanha carregava TODO mundo de
-- campaign_participants como se fosse gente importada via CSV — inclusive
-- quem entrou organicamente numa campanha aberta (source = 'Roleta',
-- gravado a cada preenchimento do formulário público). Reabrir e salvar
-- essa campanha depois que alguém já tinha jogado ligava
-- has_participant_list sem ninguém pedir, travando o acesso público.
--
-- Uma campanha só é "de lista" de verdade se tiver pelo menos um
-- participante importado via CSV (source = 'CSV Import'). Se não tem
-- nenhum, o has_participant_list = true só pode ter vindo desse bug.
UPDATE public.campaigns c
SET has_participant_list = false
WHERE c.has_participant_list = true
  AND NOT EXISTS (
    SELECT 1 FROM public.campaign_participants cp
    WHERE cp.campaign_id = c.id AND cp.source = 'CSV Import'
  );
