import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export interface PrizeEmailDraft {
  name: string;
  email_prize_name: string;
  email_instructions: string;
  email_button_text: string;
  email_button_url: string;
  checkout_url: string;
  image_url: string;
}

const FONT = { fontFamily: 'Nunito, sans-serif' } as const;

// Prévia do e-mail do prêmio renderizada pelo servidor (preview-email) com o
// MESMO código do envio real — reflete o rascunho na tela (sem precisar salvar).
const PrizeEmailPreview = ({ draft }: { draft: PrizeEmailDraft }) => {
  const [state, setState] = useState<{ subject: string; html: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const key = JSON.stringify(draft);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = window.setTimeout(async () => {
      const { data, error: err } = await supabase.functions.invoke('preview-email', { body: { prize: draft } });
      if (cancelled) return;
      setLoading(false);
      if (err || !data?.html) {
        setError(
          data?.error === 'email_settings_not_configured'
            ? 'Configure e salve a aba Personalização para ver a prévia do e-mail.'
            : 'Não foi possível gerar a prévia agora.',
        );
        return;
      }
      setError(null);
      setState({ subject: data.subject, html: data.html });
    }, 600);
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
          title="Prévia do e-mail do prêmio"
          srcDoc={state?.html ?? ''}
          style={{ border: '1px solid #E8E0EE', borderRadius: 16, width: '100%', height: 560, background: '#F5F3F7' }}
        />
      )}
      <p style={{ fontSize: 11, color: '#9B8FAE', marginTop: 6, textAlign: 'center' }}>
        Dados de exemplo. Cabeçalho, rodapé e remetente vêm da aba Personalização.
      </p>
    </div>
  );
};

export default PrizeEmailPreview;
