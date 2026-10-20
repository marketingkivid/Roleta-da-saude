import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { FONT, CARD, inputStyle, labelStyle, helperStyle, focusHandler, blurHandler } from '@/lib/admin-styles';
import { isValidEmailUrl } from '@/lib/prize-email';
import PrizeEmailPreview from './PrizeEmailPreview';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (supabase as any).from('email_settings');

interface Values {
  consolation_enabled: boolean;
  consolation_subject: string;
  consolation_title: string;
  consolation_body: string;
  consolation_button_text: string;
  consolation_button_url: string;
}
const KEYS = ['consolation_enabled', 'consolation_subject', 'consolation_title', 'consolation_body', 'consolation_button_text', 'consolation_button_url'] as const;

const EMPTY: Values = {
  consolation_enabled: false,
  consolation_subject: '',
  consolation_title: '',
  consolation_body: '',
  consolation_button_text: '',
  consolation_button_url: '',
};

const ConsolationEmail = () => {
  const [form, setForm] = useState<Values>(EMPTY);
  const [saved, setSaved] = useState<Values>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    table().select(KEYS.join(',')).eq('id', true).maybeSingle().then(({ data }: { data: Values | null }) => {
      if (data) { setForm(data); setSaved(data); }
      setLoading(false);
    });
  }, []);

  const update = <K extends keyof Values>(k: K, v: Values[K]) => setForm(prev => ({ ...prev, [k]: v }));
  const dirty = KEYS.some(k => form[k] !== saved[k]);
  const urlInvalid = !isValidEmailUrl(form.consolation_button_url);

  const save = async () => {
    if (urlInvalid) return;
    setSaving(true);
    const { error } = await table().update(form).eq('id', true);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar. Tente novamente.'); return; }
    setSaved(form);
    toast.success(form.consolation_enabled ? 'E-mail ativado e salvo!' : 'Salvo (envio desligado).');
  };

  if (loading) return <div className="h-40 rounded-[20px] animate-pulse" style={{ background: '#E8E0EE' }} />;

  const textarea = { ...inputStyle, resize: 'vertical' as const };
  const taFocus = focusHandler as unknown as React.FocusEventHandler<HTMLTextAreaElement>;
  const taBlur = blurHandler as unknown as React.FocusEventHandler<HTMLTextAreaElement>;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start" style={FONT}>
      <div style={CARD} className="space-y-5">
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1A1A2E' }}>E-mail "Não foi dessa vez"</h3>
          <p style={{ fontSize: 13, color: '#9B8FAE', marginTop: 4 }}>
            Um e-mail fixo, enviado a quem termina a participação sem prêmio (sem chances sobrando) — uma vez só, não a cada giro.
          </p>
        </div>

        <label className="flex items-center gap-3 cursor-pointer" style={{ background: form.consolation_enabled ? '#FDF0F5' : '#F8F9F9', borderRadius: 16, padding: '12px 16px' }}>
          <input type="checkbox" checked={form.consolation_enabled} onChange={e => update('consolation_enabled', e.target.checked)}
            style={{ width: 20, height: 20, accentColor: '#E8357A' }} />
          <span>
            <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: '#1A1A2E' }}>
              {form.consolation_enabled ? 'Envio ligado' : 'Envio desligado'}
            </span>
            <span style={{ fontSize: 12, color: '#9B8FAE' }}>Só é enviado se o remetente estiver configurado na aba Geral.</span>
          </span>
        </label>

        <div>
          <label style={labelStyle}>Assunto</label>
          <input value={form.consolation_subject} onChange={e => update('consolation_subject', e.target.value)} maxLength={300}
            style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
        </div>
        <div>
          <label style={labelStyle}>Título dentro do e-mail</label>
          <input value={form.consolation_title} onChange={e => update('consolation_title', e.target.value)} maxLength={300}
            style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
        </div>
        <div>
          <label style={labelStyle}>Mensagem</label>
          <textarea value={form.consolation_body} onChange={e => update('consolation_body', e.target.value)} rows={5} maxLength={2000}
            style={textarea} onFocus={taFocus} onBlur={taBlur} />
          <p style={helperStyle}>Use {'{nome}'} e {'{campanha}'}. Quebras de linha são mantidas.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label style={labelStyle}>Texto do botão (opcional)</label>
            <input value={form.consolation_button_text} onChange={e => update('consolation_button_text', e.target.value)} maxLength={80}
              placeholder="Saiba mais" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
          </div>
          <div>
            <label style={labelStyle}>Link do botão (opcional)</label>
            <input value={form.consolation_button_url} onChange={e => update('consolation_button_url', e.target.value)} inputMode="url"
              placeholder="https://..." style={{ ...inputStyle, ...(urlInvalid ? { borderColor: '#E8357A' } : {}) }} onFocus={focusHandler} onBlur={blurHandler} />
            <p style={{ ...helperStyle, ...(urlInvalid ? { color: '#E8357A' } : {}) }}>
              {urlInvalid ? 'O link precisa começar com http:// ou https://' : 'Sem link, o e-mail sai sem botão.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="button" onClick={save} disabled={!dirty || saving || urlInvalid}
            className="transition-all hover:opacity-90 active:scale-[0.98]"
            style={{
              ...FONT, background: !dirty || urlInvalid ? '#C5BDD0' : '#E8357A', color: '#FFFFFF', border: 'none', borderRadius: 50,
              padding: '12px 28px', fontWeight: 700, fontSize: 14, cursor: !dirty || urlInvalid ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Salvando…' : dirty ? 'Salvar' : 'Salvo'}
          </button>
          {dirty && <span style={{ fontSize: 12, color: '#E8357A' }}>Alterações não salvas</span>}
        </div>
      </div>

      <div style={{ ...CARD, padding: 16 }} className="xl:sticky xl:top-4">
        <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E', marginBottom: 10, textAlign: 'center' }}>Prévia ao vivo</p>
        <PrizeEmailPreview
          request={{ kind: 'consolation', settings_override: { ...form } }}
          height={520}
        />
      </div>
    </div>
  );
};

export default ConsolationEmail;
