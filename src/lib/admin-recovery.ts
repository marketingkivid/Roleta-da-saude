/**
 * Marca que um verifyOtp de recuperação criou sessão mas a senha nova ainda não
 * foi gravada.
 *
 * Precisa ser persistente, não estado de React: a sessão do Supabase mora em
 * localStorage e sobrevive a reload e a abas novas. Um flag só em memória deixaria
 * o dashboard abrir com a senha ANTIGA ainda valendo caso o updateUser falhasse
 * e o usuário recarregasse a página.
 */
const RECOVERY_PENDING_KEY = 'kivid_admin_recovery_pending';

export const isRecoveryPending = (): boolean => {
  try {
    return localStorage.getItem(RECOVERY_PENDING_KEY) === '1';
  } catch {
    return false;
  }
};

export const setRecoveryPending = (pending: boolean): void => {
  try {
    if (pending) localStorage.setItem(RECOVERY_PENDING_KEY, '1');
    else localStorage.removeItem(RECOVERY_PENDING_KEY);
  } catch {
    /* localStorage indisponível (modo privado): o estado em memória ainda protege a sessão atual */
  }
};
