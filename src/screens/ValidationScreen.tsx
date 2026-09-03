import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import TermsCheckbox from '@/components/TermsCheckbox';
import { Loader2 } from 'lucide-react';

interface ValidationScreenProps {
  termsAccepted: boolean;
  lgpdAccepted: boolean;
  setTermsAccepted: (v: boolean) => void;
  setLgpdAccepted: (v: boolean) => void;
  onSubmit: (data: { name: string; email: string; whatsapp: string }) => Promise<{ success: boolean; error?: string }>;
  hasParticipantList?: boolean;
  validationError?: string;
  prefillData?: { name: string; email: string; phone: string };
  postWin?: boolean;
}

const ValidationScreen = ({
  termsAccepted,
  lgpdAccepted,
  setTermsAccepted,
  setLgpdAccepted,
  onSubmit,
  hasParticipantList = false,
  validationError,
  prefillData,
  postWin = false,
}: ValidationScreenProps) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; whatsapp?: string; terms?: string }>({});
  const [serverError, setServerError] = useState<string | undefined>(validationError);

  // Pre-fill fields for list campaigns
  useEffect(() => {
    if (prefillData) {
      setName(prefillData.name || '');
      setEmail(prefillData.email || '');
      setWhatsapp(prefillData.phone || '');
    }
  }, [prefillData]);

  const handleSubmit = async () => {
    const newErrors: typeof errors = {};
    if (!name.trim()) newErrors.name = 'Eita! Esqueceu de preencher. 😊';
    if (!email.trim()) newErrors.email = 'Eita! Esqueceu de preencher. 😊';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) newErrors.email = 'E-mail inválido 😊';
    if (!whatsapp.trim()) newErrors.whatsapp = 'Eita! Esqueceu de preencher. 😊';
    if (!termsAccepted || !lgpdAccepted) newErrors.terms = 'Precisamos que você aceite os termos 😊';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    setServerError(undefined);

    const result = await onSubmit({ name: name.trim(), email: email.trim(), whatsapp: whatsapp.trim() });

    if (!result.success && result.error && result.error !== 'already_played') {
      setServerError(result.error);
    }
    setLoading(false);
  };

  const bubbleMessage = postWin
    ? 'Falta pouco! Preencha seus dados para receber o prêmio 🎁'
    : hasParticipantList
      ? 'Confirme seus dados para participar 😄'
      : 'Oi! Antes de girar, vamos confirmar que é você 😄';

  // Simple pt-BR phone mask: (00) 00000-0000
  const formatPhone = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : '';
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };

  return (
    <div
      className="relative flex w-full flex-col items-center px-4 sm:px-6 lg:px-8 max-w-md lg:max-w-lg mx-auto"
      style={{
        paddingTop: 'clamp(8px, 1.5dvh, 20px)',
        paddingBottom: 'max(clamp(12px, 3dvh, 32px), env(safe-area-inset-bottom))',
        paddingLeft: 'max(16px, env(safe-area-inset-left))',
        paddingRight: 'max(16px, env(safe-area-inset-right))',
      }}
    >
      <div className="flex items-start gap-3 mb-3 sm:mb-6 w-full">
        <span className="text-2xl sm:text-5xl shrink-0 leading-none" aria-hidden="true">🦋</span>
        <div role="status" className="bg-muted rounded-xl rounded-tl-none px-3 py-2 sm:px-4 sm:py-3 text-sm sm:text-lg leading-snug break-words min-w-0">
          {bubbleMessage}
        </div>
      </div>


      <form
        className="w-full space-y-2.5 sm:space-y-5"
        noValidate
        onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }}
      >
        <div>
          <label htmlFor="name" className="text-sm sm:text-lg font-semibold mb-1 sm:mb-2 block">Nome</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })); }}
            placeholder="Seu nome completo"
            autoComplete="name"
            autoCapitalize="words"
            enterKeyHint="next"
            required
            aria-required="true"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'name-error' : undefined}
            className="w-full h-12 sm:h-16 px-4 rounded-xl border border-input bg-background text-base sm:text-lg text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring outline-none transition-all"
          />
          {errors.name && <p id="name-error" role="alert" className="text-sm sm:text-base text-red-700 mt-1">{errors.name}</p>}
        </div>

        <div>
          <label htmlFor="email" className="text-sm sm:text-lg font-semibold mb-1 sm:mb-2 block">E-mail</label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="next"
            required
            aria-required="true"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
            value={email}
            onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })); setServerError(undefined); }}
            placeholder="seu@email.com"
            className="w-full h-12 sm:h-16 px-4 rounded-xl border border-input bg-background text-base sm:text-lg text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring outline-none transition-all"
          />
          {errors.email && <p id="email-error" role="alert" className="text-sm sm:text-base text-red-700 mt-1">{errors.email}</p>}
        </div>

        <div>
          <label htmlFor="whatsapp" className="text-sm sm:text-lg font-semibold mb-1 sm:mb-2 block">WhatsApp</label>
          <input
            id="whatsapp"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            enterKeyHint="done"
            required
            aria-required="true"
            aria-invalid={!!errors.whatsapp}
            aria-describedby={errors.whatsapp ? 'whatsapp-error' : undefined}
            value={whatsapp}
            onChange={(e) => { setWhatsapp(formatPhone(e.target.value)); setErrors((p) => ({ ...p, whatsapp: undefined })); }}
            placeholder="(00) 00000-0000"
            className="w-full h-12 sm:h-16 px-4 rounded-xl border border-input bg-background text-base sm:text-lg text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring outline-none transition-all"
          />
          {errors.whatsapp && <p id="whatsapp-error" role="alert" className="text-sm sm:text-base text-red-700 mt-1">{errors.whatsapp}</p>}
        </div>

        <div className="space-y-1.5 sm:space-y-3 pt-0.5 sm:pt-2" role="group" aria-label="Termos e privacidade">
          <TermsCheckbox id="terms" checked={termsAccepted} onChange={setTermsAccepted}>
            Li e concordo com os{' '}
            <a
              href="https://kivid.com.br/termos"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
              onClick={(e) => e.stopPropagation()}
            >
              Termos de Uso
            </a>
          </TermsCheckbox>
          <TermsCheckbox id="lgpd" checked={lgpdAccepted} onChange={setLgpdAccepted}>
            Concordo com a{' '}
            <a
              href="https://kivid.com.br/privacidade"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
              onClick={(e) => e.stopPropagation()}
            >
              Política de Privacidade (LGPD)
            </a>
          </TermsCheckbox>
          {errors.terms && <p role="alert" className="text-sm sm:text-base text-red-700">{errors.terms}</p>}
        </div>


        <Button variant="hero" size="lg" type="submit" className="mt-2 sm:mt-3 min-h-12 sm:min-h-16 py-3 sm:py-5 whitespace-normal leading-tight scroll-mb-6" disabled={loading} aria-busy={loading}>
          {loading ? <Loader2 className="animate-spin mr-2 h-5 w-5" aria-hidden="true" /> : null}
          {loading ? 'Verificando...' : 'Tá bom, vamos lá! →'}
        </Button>

        {serverError && (
          <p role="alert" className="text-sm sm:text-base text-red-700 text-center mt-1 sm:mt-2">{serverError}</p>
        )}
      </form>

    </div>
  );
};

export default ValidationScreen;
