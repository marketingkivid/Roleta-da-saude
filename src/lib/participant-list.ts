// Separa as DUAS populações que convivem em campaign_participants:
//
//  - LISTA DE CONVITE: contatos que o admin importou ao criar a campanha
//    (Arquivo, Colado, Manual, Brevo...). São eles que tornam a campanha
//    "com lista" (entrada por link individual com token).
//
//  - CONTATOS CAPTURADOS: participantes que entraram pelo formulário público
//    de uma campanha ABERTA (source 'Roleta', gravado em
//    useCampaign.submitValidation). São participação orgânica — NUNCA uma
//    lista de convite. Antes, editar+salvar uma campanha aberta depois que
//    alguém já tinha jogado virava has_participant_list=true sem querer, e a
//    campanha pública passava a exibir "Acesso exclusivo" (ver migração
//    20260915090000_fix_open_campaign_locked_as_list.sql).
export const CAPTURED_SOURCE = 'Roleta';

export const isInviteMember = (source?: string | null): boolean =>
  (source ?? '') !== CAPTURED_SOURCE;

// A campanha tem lista de convite se há QUALQUER participante de convite
// (ignora os capturados pelo formulário público).
export const hasInviteList = (
  rows: Array<{ source?: string | null; status?: string }>,
): boolean =>
  rows.some(
    r => (r.status === undefined || r.status === 'valid') && isInviteMember(r.source),
  );
