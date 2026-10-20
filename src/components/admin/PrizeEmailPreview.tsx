import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { FONT } from '@/lib/admin-styles';

// Prévia de e-mail renderizada pelo servidor (preview-email) com o MESMO
// código do envio real — reflete o rascunho na tela (sem precisar salvar).
// `request` é o corpo enviado ao preview-email ({ prize } | { kind, settings_override }).
const PrizeEmailPreview = ({ request, height = 560 }: { request: Record<string, unknown>; height?: number }) => {
  const [state, setState] = useState<{ subject: string; html: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const key = JSON.stringify(request);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = window.setTimeout(async () => {
      const { data, error: err } = await supabase.functions.invoke('preview-email', { body: request });
      if (cancelled) return;
      setLoading(false);
      if (err || !data?.html) {
        setError(
          data?.error === 'email_settings_not_configured'
            ? 'Configure e salve a aba "Geral" para ver a prévia do e-mail.'
            : 'Não foi possível gerar a prévia agora.',
        );
        return;
      }
      setError(null);
      setState({ subject: data.subject, html: data.html });
    }, 500);
    return () => { cancelled = true; window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div style={FONT}>
      <div className="flex items-center gap-2" style={{ marginBottom: 8, minHeight: 20 }}>
        <p className="truncate" style={{ fontSize: 12, color: '#9B8FAE', flex: 1 }}>
          {state ? <>Assunto: <strong style={{ color: '#5A5A7A' }}>{state.subject}</strong></> : ' '}
        </p>
        {loading && <Loader2 size={14} className="animate-spin" style={{ color: '#E8357A' }} />}
      </div>
      {error ? (
        <p style={{ fontSize: 13, color: '#E8357A', textAlign: 'center', padding: '32px 8px' }}>{error}</p>
      ) : (
        <iframe
          title="Prévia do e-mail"
          srcDoc={state?.html ?? ''}
          style={{ border: '1px solid #E8E0EE', borderRadius: 16, width: '100%', height, background: '#F5F3F7' }}
        />
      )}
      <p style={{ fontSize: 11, color: '#9B8FAE', marginTop: 6, textAlign: 'center' }}>
        Dados de exemplo. Remetente, WhatsApp e aviso antifraude vêm da aba Geral.
      </p>
    </div>
  );
};

export default PrizeEmailPreview;
