/**
 * Tradução dos erros do Supabase Auth para pt-BR.
 *
 * As mensagens são mapeadas POR CHAMADA, não por um mapeador único: as strings
 * do Supabase se sobrepõem entre operações ("invalid" aparece tanto em código
 * OTP quanto em credenciais), e um mapeador genérico acaba mandando o usuário
 * corrigir o campo errado.
 */

export const MIN_PASSWORD_LENGTH = 8;

export type AuthErrorLike = { message?: string; status?: number } | null;

export const RATE_LIMIT_MSG = 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.';
export const NETWORK_MSG = 'Falha de conexão. Verifique sua internet e tente de novo.';

export const isRateLimited = (error: AuthErrorLike) =>
  error?.status === 429 ||
  /rate limit|too many|security purposes/.test(error?.message?.toLowerCase() ?? '');

export const signInError = (error: AuthErrorLike) =>
  isRateLimited(error) ? RATE_LIMIT_MSG : 'E-mail ou senha incorretos. Tente novamente.';

export const sendCodeError = (error: AuthErrorLike) =>
  isRateLimited(error) ? RATE_LIMIT_MSG : 'Não foi possível enviar o código. Tente novamente.';

export const verifyCodeError = (error: AuthErrorLike) => {
  if (isRateLimited(error)) return RATE_LIMIT_MSG;
  const raw = error?.message?.toLowerCase() ?? '';
  if (raw.includes('expired')) return 'Código expirado. Volte e peça um novo código.';
  return 'Código inválido. Confira os 6 dígitos do e-mail.';
};

export const updatePasswordError = (error: AuthErrorLike) => {
  if (isRateLimited(error)) return RATE_LIMIT_MSG;
  const raw = error?.message?.toLowerCase() ?? '';
  if (raw.includes('should be different') || raw.includes('different from the old'))
    return 'A nova senha precisa ser diferente da atual.';
  if (raw.includes('at least') || raw.includes('length') || raw.includes('weak') || raw.includes('short'))
    return `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  if (raw.includes('pwned') || raw.includes('compromised'))
    return 'Essa senha aparece em vazamentos conhecidos. Escolha outra.';
  return 'Não foi possível salvar a nova senha. Tente novamente.';
};
