import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { FONT, inputStyle, labelStyle } from '@/lib/admin-styles';
import {
  MIN_PASSWORD_LENGTH,
  RATE_LIMIT_MSG,
  isRateLimited,
  updatePasswordError,
} from '@/lib/auth-errors';

interface ChangePasswordModalProps {
  email: string;
  onClose: () => void;
}

const ChangePasswordModal = ({ email, onClose }: ChangePasswordModalProps) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`A nova senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('A nova senha precisa ser diferente da atual.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      // Reautentica antes de trocar: sem isso, uma sessão esquecida aberta
      // permitiria trocar a senha sem conhecer a atual.
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (reauthError) {
        setError(isRateLimited(reauthError) ? RATE_LIMIT_MSG : 'Senha atual incorreta.');
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setError(updatePasswordError(updateError));
        return;
      }

      toast.success('Senha alterada com sucesso!');
      onClose();
    } catch {
      // Sem isso um erro de rede deixaria busy=true para sempre e travaria o modal.
      setError('Falha de conexão. Verifique sua internet e tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    autoComplete: string,
  ) => (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type="password"
        value={value}
        onChange={e => onChange(e.target.value)}
        required
        disabled={busy}
        autoComplete={autoComplete}
        className="transition-colors"
        style={inputStyle}
        onFocus={e => (e.target.style.borderColor = '#E8357A')}
        onBlur={e => (e.target.style.borderColor = '#E8E0EE')}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ ...FONT }}>
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.35)' }}
        onClick={() => { if (!busy) onClose(); }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Alterar senha"
        className="relative w-full max-w-sm p-8 space-y-6"
        style={{ background: '#FFFFFF', border: '1px solid #E8E0EE', borderRadius: 20 }}
      >
        <button
          type="button"
          onClick={() => { if (!busy) onClose(); }}
          aria-label="Fechar"
          className="absolute top-4 right-4"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9B8FAE' }}
        >
          <X size={20} />
        </button>

        <div className="space-y-1">
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1A1A2E', ...FONT }}>Alterar senha</h2>
          <p className="truncate" style={{ fontSize: 13, color: '#9B8FAE', ...FONT }}>{email}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Dica pro gerenciador de senhas associar as credenciais à conta certa. */}
          <input type="text" value={email} autoComplete="username" readOnly hidden />
          {field('Senha atual', currentPassword, setCurrentPassword, 'current-password')}
          {field('Nova senha', newPassword, setNewPassword, 'new-password')}
          {field('Confirmar nova senha', confirmPassword, setConfirmPassword, 'new-password')}
          <p style={{ fontSize: 12, color: '#9B8FAE', ...FONT }}>
            Mínimo de {MIN_PASSWORD_LENGTH} caracteres.
          </p>
          {error && <p style={{ fontSize: 16, color: '#c0392b', ...FONT }}>{error}</p>}
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
            {busy ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
