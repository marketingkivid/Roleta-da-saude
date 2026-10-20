import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { X, Loader2 } from 'lucide-react';
import { FONT, CARD, inputStyle, labelStyle, helperStyle, focusHandler, blurHandler } from '@/lib/admin-styles';

// `email_settings` é uma tabela nova (Personalização) ainda não coberta pelo
// gerador de tipos do Supabase — mesmo padrão de cast usado em outras
// colunas recentes deste projeto (ver CampaignModal `is_test`).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (supabase as any).from('email_settings');

export interface EmailSettingsRow {
  whatsapp_oficial: string;
  sender_name: string;
  sender_email: string;
  prize_subject: string;
  prize_title: string;
  contact_block_title: string;
  contact_block_text: string;
  antifraud_notice: string;
  failure_alert_email: string;
  invite_subject: string;
  invite_title: string;
  invite_body: string;
  invite_button_text: string;
}

type EmailKind = 'prize_coupon' | 'prize_physical' | 'invite';

const EMPTY: EmailSettingsRow = {
  whatsapp_oficial: '',
  sender_name: 'Kivid',
  sender_email: '',
  prize_subject: '🎉 {nome}, seu prêmio do Kivid chegou',
  prize_title: '{nome}, você ganhou!',
  contact_block_title: 'Como você recebe seu prêmio',
  contact_block_text: 'Nossa equipe vai entrar em contato pelo WhatsApp, no mesmo número que você cadastrou para participar.',
  antifraud_notice: 'O Kivid nunca pede senha, código ou pagamento para entregar um prêmio. Se alguém pedir, não é a gente.',
  failure_alert_email: '',
  invite_subject: '🎉 {nome}, chegou seu convite da Kivid!',
  invite_title: '{nome}, você foi convidado!',
  invite_body: 'O Kivid preparou uma surpresa para você: gire a roleta e concorra a prêmios na campanha {campanha}. É rapidinho — toque no botão abaixo para participar.',
  invite_button_text: 'Quero girar 🎡',
};

const FIELDS: { key: keyof EmailSettingsRow; label: string; helper?: string; area?: boolean }[] = [
  { key: 'whatsapp_oficial', label: 'WhatsApp oficial', helper: 'Aparece no e-mail de prêmio físico como o único número que entra em contato.' },
  { key: 'sender_name', label: 'Nome do remetente' },
  { key: 'sender_email', label: 'E-mail do remetente', helper: 'Precisa ser um e-mail autenticado no Brevo (domínio verificado).' },
  { key: 'prize_subject', label: 'Assunto do e-mail' },
  { key: 'prize_title', label: 'Título dentro do e-mail' },
  { key: 'contact_block_title', label: 'Título do bloco de contato' },
  { key: 'contact_block_text', label: 'Texto do bloco de contato', area: true },
  { key: 'antifraud_notice', label: 'Aviso antifraude', area: true },
  { key: 'failure_alert_email', label: 'E-mail que recebe alertas de falha' },
  { key: 'invite_subject', label: 'Convite: assunto do e-mail' },
  { key: 'invite_title', label: 'Convite: título dentro do e-mail' },
  { key: 'invite_body', label: 'Convite: texto principal', area: true },
  { key: 'invite_button_text', label: 'Convite: texto do botão' },
];

const EmailSettings = () => {
  const [form, setForm] = useState<EmailSettingsRow>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState<EmailKind | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await table().select('*').eq('id', true).maybeSingle();
      if (data) setForm({ ...EMPTY, ...(data as unknown as EmailSettingsRow) });
      setLoading(false);
    };
    load();
  }, []);

  const update = (key: keyof EmailSettingsRow, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    const payload = Object.fromEntries(FIELDS.map(f => [f.key, form[f.key]]));
    const { error } = await table().update(payload).eq('id', true);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar. Tente novamente.'); return; }
    toast.success('Personalização salva!');
  };

  // Prévia renderizada pelo servidor (preview-email) — o MESMO código que
  // monta o e-mail de verdade, então o que aparece aqui é exatamente o que
  // é enviado. Por isso só reflete o que já está salvo, não o rascunho na tela.
  const openPreview = async (kind: EmailKind) => {
    setPreviewLoading(kind);
    const { data, error } = await supabase.functions.invoke('preview-email', { body: { kind } });
    setPreviewLoading(null);
    if (error || !data?.html) {
      if (data?.error === 'email_settings_not_configured') {
        toast.error('Salve as configurações antes de ver a prévia.');
      } else {
        toast.error('Não foi possível gerar a prévia agora.');
      }
      return;
    }
    setPreview({ subject: data.subject, html: data.html });
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-14 rounded-[20px] animate-pulse" style={{ background: '#E8E0EE' }} />)}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <p style={{ ...helperStyle, marginBottom: 20, fontSize: 13 }}>
        Textos padrão e remetente, valem para todos os e-mails. Chaves disponíveis nos textos: <code style={{ background: '#F5F3F7', borderRadius: 4, padding: '1px 6px' }}>{'{nome}'}</code>,{' '}
        <code style={{ background: '#F5F3F7', borderRadius: 4, padding: '1px 6px' }}>{'{premio}'}</code> e{' '}
        <code style={{ background: '#F5F3F7', borderRadius: 4, padding: '1px 6px' }}>{'{campanha}'}</code> — são trocadas pelos dados reais na hora do envio.
        Cada prêmio pode ter e-mail próprio na aba "Por prêmio".
      </p>

      <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {FIELDS.map(f => (
          <div key={f.key}>
            <label style={labelStyle}>{f.label}</label>
            {f.area ? (
              <textarea
                value={form[f.key]}
                onChange={e => update(f.key, e.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
                onFocus={focusHandler}
                onBlur={blurHandler}
              />
            ) : (
              <input
                value={form[f.key]}
                onChange={e => update(f.key, e.target.value)}
                style={inputStyle}
                onFocus={focusHandler}
                onBlur={blurHandler}
              />
            )}
            {f.helper && <p style={helperStyle}>{f.helper}</p>}
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-3" style={{ marginTop: 4 }}>
          <button
            onClick={save}
            disabled={saving}
            className="transition-all hover:opacity-90 active:scale-[0.98]"
            style={{
              ...FONT, background: '#E8357A', color: '#FFFFFF', border: 'none', borderRadius: 50,
              padding: '12px 28px', fontWeight: 700, fontSize: 14, cursor: saving ? 'wait' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Salvando…' : 'Salvar'}
          </button>

          {([
            ['prize_coupon', 'Ver prévia (cupom)'],
            ['prize_physical', 'Ver prévia (prêmio físico)'],
            ['invite', 'Ver prévia (convite)'],
          ] as [EmailKind, string][]).map(([kind, label]) => (
            <button
              key={kind}
              onClick={() => openPreview(kind)}
              disabled={previewLoading === kind}
              className="transition-all hover:bg-[#E8357A] hover:text-white"
              style={{
                ...FONT, background: '#FFFFFF', color: '#E8357A', border: '1.5px solid #E8357A',
                borderRadius: 50, padding: '10px 20px', fontWeight: 700, fontSize: 13,
                cursor: previewLoading === kind ? 'wait' : 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              {previewLoading === kind && <Loader2 size={12} className="animate-spin" />}
              {label}
            </button>
          ))}
        </div>
        <p style={helperStyle}>A prévia usa dados de exemplo e mostra o que está salvo — salve antes de conferir.</p>
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(26, 26, 46, 0.6)' }}
          onClick={e => e.target === e.currentTarget && setPreview(null)}
        >
          <div style={{ background: '#FFFFFF', borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="flex items-center justify-between" style={{ padding: '14px 20px', borderBottom: '1px solid #E8E0EE' }}>
              <div className="min-w-0">
                <p style={{ ...FONT, fontSize: 13, fontWeight: 700, color: '#1A1A2E' }}>Prévia do e-mail</p>
                <p className="truncate" style={{ ...FONT, fontSize: 12, color: '#9B8FAE' }}>{preview.subject}</p>
              </div>
              <button onClick={() => setPreview(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9B8FAE', flexShrink: 0 }}>
                <X size={20} />
              </button>
            </div>
            <iframe title="Prévia do e-mail" srcDoc={preview.html} style={{ border: 'none', flex: 1, width: '100%', minHeight: 480 }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailSettings;
