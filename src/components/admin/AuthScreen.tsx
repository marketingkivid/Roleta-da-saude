import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import KividLogo from '@/assets/kivid-logo.svg';
import { FONT, inputStyle, labelStyle } from '@/lib/admin-styles';
import {
  MIN_PASSWORD_LENGTH,
  NETWORK_MSG,
  isRateLimited,
  RATE_LIMIT_MSG,
  signInError,
  sendCodeError,
  verifyCodeError,
  updatePasswordError,
} from '@/lib/auth-errors';

import { isRecoveryPending, setRecoveryPending } from '@/lib/admin-recovery';

type AuthMode = 'login' | 'forgot' | 'reset';

interface AuthScreenProps {
  isAuthenticated: boolean;
  isAdmin: boolean;
  onRecoveryActiveChange: (active: boolean) => void;
}

const AuthScreen = ({ isAuthenticated, isAdmin, onRecoveryActiveChange }: AuthScreenProps) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // O código só pode ser consumido uma vez: se o updateUser falhar depois do
  // verifyOtp, a retentativa não pode revalidar o código.
  const [codeVerified, setCodeVerified] = useState(false);

  // Recuperação interrompida (reload, aba nova, navegador fechado): existe sessão
  // viva com a senha ANTIGA. Encerra e devolve o usuário ao login.
  useEffect(() => {
    if (!isRecoveryPending()) return;
    let cancelled = false;
    (async () => {
      try {
        await supabase.auth.signOut();
      } catch {
        /* mesmo se o signOut falhar, o flag precisa sair para não travar a tela */
      }
      setRecoveryPending(false);
      if (cancelled) return;
      onRecoveryActiveChange(false);
      setNotice('A troca de senha anterior não foi concluída. Entre com a senha atual ou peça um novo código.');
    })();
    return () => { cancelled = true; };
  }, [onRecoveryActiveChange]);

  const goTo = (next: AuthMode) => {
    setError('');
    setNotice('');
    setMode(next);
    onRecoveryActiveChange(next === 'reset');
  };

  const clearResetFields = () => {
    setCode('');
    setNewPassword('');
    setConfirmPassword('');
    setCodeVerified(false);
  };

  const backToLogin = async () => {
    // verifyOtp pode ter criado sessão sem a senha nova ter sido gravada.
    if (codeVerified) {
      try { await supabase.auth.signOut(); } catch { /* segue para o login mesmo assim */ }
    }
    setRecoveryPending(false);
    clearResetFields();
    goTo('login');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (loginError) setError(signInError(loginError));
    } catch {
      setError(NETWORK_MSG);
    } finally {
      setBusy(false);
    }
  };

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (resetError) {
        setError(sendCodeError(resetError));
        return;
      }
      goTo('reset');
      setNotice(`Se existir conta para ${email.trim()}, o código de 6 dígitos chegou por e-mail.`);
    } catch {
      setError(NETWORK_MSG);
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');

    try {
      if (!codeVerified) {
        // Marca ANTES: se o verifyOtp criar sessão e o processo morrer em seguida,
        // o flag persistido garante que a próxima carga encerre essa sessão.
        setRecoveryPending(true);
        const { error: otpError } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: code.trim(),
          type: 'recovery',
        });
        if (otpError) {
          setRecoveryPending(false);
          setError(verifyCodeError(otpError));
          return;
        }
        setCodeVerified(true);
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setError(updatePasswordError(updateError));
        return;
      }

      setRecoveryPending(false);
      clearResetFields();
      setPassword('');
      toast.success('Senha alterada com sucesso!');
      // Volta o modo para 'login': se a conta não for admin, o AuthScreen segue
      // montado e um formulário de reset vazio não diria nada ao usuário.
      setMode('login');
      onRecoveryActiveChange(false);
    } catch {
      setError(NETWORK_MSG);
    } finally {
      setBusy(false);
    }
  };

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    type: string,
    extra?: React.InputHTMLAttributes<HTMLInputElement>,
  ) => (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        required
        disabled={busy}
        className="transition-colors"
        style={inputStyle}
        onFocus={e => (e.target.style.borderColor = '#E8357A')}
        onBlur={e => (e.target.style.borderColor = '#E8E0EE')}
        {...extra}
      />
    </div>
  );

  const submitButton = (label: string, pendingLabel: string) => (
    <button
      type="submit"
      disabled={busy}
      className="w-full transition-all hover:opacity-90 active:scale-[0.98]"
      style={{
        background: '#E8357A', color: '#fff', borderRadius: 50, padding: '12px 20px',
        fontWeight: 700, fontSize: 16, ...FONT, border: 'none',
        cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
      }}
    >
      {busy ? pendingLabel : label}
    </button>
  );

  const linkButton = (label: string, onClick: () => void, icon?: boolean) => (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex items-center justify-center gap-1.5 w-full"
      style={{
        background: 'none', border: 'none', cursor: busy ? 'not-allowed' : 'pointer',
        color: '#9B8FAE', fontSize: 13, ...FONT, padding: 0,
      }}
    >
      {icon && <ArrowLeft size={14} />}
      {label}
    </button>
  );

  const messages = (
    <>
      {notice && <p style={{ fontSize: 14, color: '#5A5A7A', ...FONT }}>{notice}</p>}
      {error && <p style={{ fontSize: 16, color: '#c0392b', ...FONT }}>{error}</p>}
    </>
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#f8f9f9', ...FONT }}>
      <div className="w-full max-w-sm">
        <div className="p-8 space-y-6" style={{ background: '#FFFFFF', border: '1px solid #E8E0EE', borderRadius: 20 }}>
          <div className="text-center space-y-2">
            <img src={KividLogo} alt="Kivid" className="h-10 mx-auto" />
            <p style={{ fontSize: 13, color: '#9B8FAE', ...FONT }}>
              {mode === 'login' ? 'Backoffice' : mode === 'forgot' ? 'Recuperar senha' : 'Definir nova senha'}
            </p>
          </div>

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              {field('E-mail', email, setEmail, 'email', { autoComplete: 'username' })}
              {field('Senha', password, setPassword, 'password', { autoComplete: 'current-password' })}
              {messages}
              {isAuthenticated && !isAdmin && (
                <p style={{ fontSize: 16, color: '#c0392b', ...FONT }}>
                  Sua conta não possui permissão de administrador.
                </p>
              )}
              {submitButton('Entrar', 'Entrando...')}
              {isAuthenticated && !isAdmin
                ? linkButton('Sair desta conta', () => { void supabase.auth.signOut(); })
                : linkButton('Esqueci minha senha', () => goTo('forgot'))}
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleRequestCode} className="space-y-4">
              <p style={{ fontSize: 14, color: '#5A5A7A', ...FONT }}>
                Informe seu e-mail e enviaremos um código de 6 dígitos para criar uma nova senha.
              </p>
              {field('E-mail', email, setEmail, 'email', { autoComplete: 'username' })}
              {messages}
              {submitButton('Enviar código', 'Enviando...')}
              {linkButton('Voltar para o login', () => { void backToLogin(); }, true)}
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              {field('Código de 6 dígitos', code, v => setCode(v.replace(/\D/g, '').slice(0, 6)), 'text', {
                inputMode: 'numeric',
                autoComplete: 'one-time-code',
                placeholder: '000000',
                disabled: busy || codeVerified,
              })}
              {codeVerified && (
                <p style={{ fontSize: 12, color: '#9B8FAE', ...FONT }}>
                  Código já validado — só falta salvar a nova senha.
                </p>
              )}
              {field('Nova senha', newPassword, setNewPassword, 'password', { autoComplete: 'new-password' })}
              {field('Confirmar nova senha', confirmPassword, setConfirmPassword, 'password', { autoComplete: 'new-password' })}
              <p style={{ fontSize: 12, color: '#9B8FAE', ...FONT }}>
                Mínimo de {MIN_PASSWORD_LENGTH} caracteres.
              </p>
              {messages}
              {submitButton('Salvar nova senha', 'Salvando...')}
              {linkButton('Voltar para o login', () => { void backToLogin(); }, true)}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
