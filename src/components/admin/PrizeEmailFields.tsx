import { inputStyle, labelStyle, helperStyle, focusHandler, blurHandler } from '@/lib/admin-styles';

import type { PrizeEmailValues, PrizeEmailDefaults } from '@/lib/prize-email';
import { isValidEmailUrl } from '@/lib/prize-email';

interface Props {
  values: PrizeEmailValues;
  onChange: (key: keyof PrizeEmailValues, value: string) => void;
  /** Nome e URL de checkout do prêmio — viram placeholders ("em branco = isto"). */
  prizeName: string;
  checkoutUrl: string;
  /** Instruções da tela de resgate (atalho "Copiar"). */
  redeemInstructions?: string;
  defaults?: PrizeEmailDefaults;
}

// Campos do e-mail de UM prêmio. Tudo opcional: em branco = padrão da aba Geral.
const PrizeEmailFields = ({ values, onChange, prizeName, checkoutUrl, redeemInstructions, defaults }: Props) => {
  const urlInvalid = !isValidEmailUrl(values.email_button_url);
  const hasButtonUrl = !!(values.email_button_url.trim() || checkoutUrl.trim());
  const textarea = (extra: React.CSSProperties = {}) => ({ ...inputStyle, resize: 'vertical' as const, ...extra });
  const taFocus = focusHandler as unknown as React.FocusEventHandler<HTMLTextAreaElement>;
  const taBlur = blurHandler as unknown as React.FocusEventHandler<HTMLTextAreaElement>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label style={labelStyle}>Nome do prêmio no e-mail</label>
          <input value={values.email_prize_name} onChange={e => onChange('email_prize_name', e.target.value)}
            placeholder={prizeName || 'Igual ao nome do prêmio'} maxLength={200}
            style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
        </div>
        <div>
          <label style={labelStyle}>Assunto</label>
          <input value={values.email_subject} onChange={e => onChange('email_subject', e.target.value)}
            placeholder={defaults?.prize_subject || 'Padrão da aba Geral'} maxLength={300}
            style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Título dentro do e-mail</label>
        <input value={values.email_title} onChange={e => onChange('email_title', e.target.value)}
          placeholder={defaults?.prize_title || 'Padrão da aba Geral'} maxLength={300}
          style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
      </div>

      <div>
        <label style={labelStyle}>Título do bloco de instruções</label>
        <input value={values.email_block_title} onChange={e => onChange('email_block_title', e.target.value)}
          placeholder={values.email_instructions.trim() ? 'Sem título' : (defaults?.contact_block_title || 'Padrão da aba Geral')} maxLength={300}
          style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label style={{ ...labelStyle, marginBottom: 0 }}>Instruções para resgate</label>
          {!!redeemInstructions?.trim() && values.email_instructions !== redeemInstructions && (
            <button type="button" onClick={() => onChange('email_instructions', redeemInstructions)}
              style={{ fontSize: 12, fontWeight: 700, color: '#E8357A', background: 'none', border: 'none', cursor: 'pointer' }}>
              Copiar da tela de resgate
            </button>
          )}
        </div>
        <textarea value={values.email_instructions} onChange={e => onChange('email_instructions', e.target.value)}
          rows={5} maxLength={2000}
          placeholder={defaults?.contact_block_text || 'Em branco = texto padrão da aba Geral'}
          style={textarea()} onFocus={taFocus} onBlur={taBlur} />
        <p style={helperStyle}>Quebras de linha são mantidas. Use {'{nome}'}, {'{premio}'} e {'{campanha}'}.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label style={labelStyle}>Texto do botão</label>
          <input value={values.email_button_text} onChange={e => onChange('email_button_text', e.target.value)}
            placeholder="Resgatar meu prêmio" maxLength={80}
            style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
        </div>
        <div>
          <label style={labelStyle}>Link do botão</label>
          <input value={values.email_button_url} onChange={e => onChange('email_button_url', e.target.value)}
            placeholder={checkoutUrl || 'https://...'} inputMode="url"
            style={{ ...inputStyle, ...(urlInvalid ? { borderColor: '#E8357A' } : {}) }} onFocus={focusHandler} onBlur={blurHandler} />
          {urlInvalid ? (
            <p style={{ ...helperStyle, color: '#E8357A' }}>O link precisa começar com http:// ou https://</p>
          ) : (
            <p style={helperStyle}>
              {hasButtonUrl
                ? (values.email_button_url.trim() ? 'Este link será usado no botão.' : 'Em branco = usa a URL de checkout do prêmio.')
                : 'Sem link (nem URL de checkout), o e-mail sai sem botão.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrizeEmailFields;
