import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import PrizeImageUpload from './PrizeImageUpload';
import RewardPreview from './RewardPreview';
import PrizeEmailPreview from './PrizeEmailPreview';
import ConsolationPreview from './ConsolationPreview';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { inputStyle, labelStyle, focusHandler, blurHandler } from '@/lib/admin-styles';
import { Emoji } from '@/lib/twemoji';

type Prize = Tables<'prizes'>;

interface Campaign { id: string; name: string; }

interface PrizeFormProps {
  prize: Prize | null;
  onSave: () => void;
  onCancel: () => void;
}

const PrizeForm = ({ prize, onSave, onCancel }: PrizeFormProps) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [existingConsolation, setExistingConsolation] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState({
    name: prize?.name ?? '',
    description: prize?.description ?? '',
    emoji: prize?.emoji ?? '🎁',
    image_url: prize?.image_url ?? '',
    show_image: (prize as any)?.show_image ?? true,
    redeem_instructions: prize?.redeem_instructions ?? '',
    checkout_url: prize?.checkout_url ?? '',
    weight: prize?.weight ?? 0.25,
    active: prize?.active ?? true,
    campaign_id: prize?.campaign_id ?? '',
    quantity_available: prize?.quantity_available?.toString() ?? '',
    is_consolation: (prize as any)?.is_consolation ?? false,
    email_prize_name: prize?.email_prize_name ?? '',
    email_instructions: prize?.email_instructions ?? '',
    email_button_text: prize?.email_button_text ?? '',
    email_button_url: prize?.email_button_url ?? '',
  });
  const [previewTab, setPreviewTab] = useState<'result' | 'email'>('result');
  const emailUrlInvalid = !!form.email_button_url.trim() && !/^https?:\/\//i.test(form.email_button_url.trim());

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('campaigns').select('id, name').order('created_at', { ascending: false }).then(({ data }) => {
      if (data) setCampaigns(data);
    });

    // Check for existing active consolation prize
    supabase.from('prizes').select('id, name').eq('is_consolation', true as any).eq('active', true).then(({ data }) => {
      if (data && data.length > 0) {
        const existing = data[0];
        if (!prize || existing.id !== prize.id) {
          setExistingConsolation(existing);
        }
      }
    });
  }, [prize]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Image is only required when show_image is enabled. If disabled, emoji+name suffice.
    if (emailUrlInvalid) return;
    if (form.show_image && !form.image_url) return;
    if (!form.show_image && (!form.emoji.trim() || !form.name.trim())) return;
    setSaving(true);
    const payload: any = {
      name: form.name,
      description: form.description,
      emoji: form.emoji,
      image_url: form.image_url,
      show_image: form.show_image,
      redeem_instructions: form.is_consolation ? '' : form.redeem_instructions,
      checkout_url: form.is_consolation ? null : (form.checkout_url || null),
      weight: Number(form.weight),
      active: form.active,
      campaign_id: form.campaign_id || null,
      quantity_available: form.quantity_available ? parseInt(form.quantity_available) : null,
      is_consolation: form.is_consolation,
      email_prize_name: form.is_consolation ? '' : form.email_prize_name.trim(),
      email_instructions: form.is_consolation ? '' : form.email_instructions.trim(),
      email_button_text: form.is_consolation ? '' : form.email_button_text.trim(),
      email_button_url: form.is_consolation ? '' : form.email_button_url.trim(),
    };


    // If activating a new consolation, deactivate existing one
    if (form.is_consolation && form.active && existingConsolation) {
      await supabase.from('prizes').update({ is_consolation: false } as any).eq('id', existingConsolation.id);
    }

    if (prize) {
      await supabase.from('prizes').update(payload).eq('id', prize.id);
    } else {
      await supabase.from('prizes').insert(payload);
    }
    setSaving(false);
    onSave();
  };

  const update = (key: string, value: string | number | boolean) =>
    setForm(prev => ({ ...prev, [key]: value }));

  // focusHandler and blurHandler imported from admin-styles

  const resultPreview = form.is_consolation ? (
    <ConsolationPreview
      name={form.name}
      description={form.description}
      imageUrl={form.image_url}
    />
  ) : (
    <RewardPreview
      name={form.name}
      description={form.description}
      redeem_instructions={form.redeem_instructions}
      imageUrl={form.image_url}
      checkoutUrl={form.checkout_url}
    />
  );

  const previewContent = form.is_consolation ? resultPreview : (
    <div>
      <div className="flex gap-1" style={{ background: '#F3EEF7', borderRadius: 50, padding: 4, marginBottom: 16 }}>
        {([['result', 'Tela de resultado'], ['email', 'E-mail']] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPreviewTab(id)}
            style={{
              flex: 1, border: 'none', borderRadius: 50, padding: '8px 12px', cursor: 'pointer',
              fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13,
              background: previewTab === id ? '#FFFFFF' : 'transparent',
              color: previewTab === id ? '#E8357A' : '#7A6E8E',
              boxShadow: previewTab === id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {previewTab === 'result' ? resultPreview : (
        <PrizeEmailPreview
          draft={{
            name: form.name,
            email_prize_name: form.email_prize_name,
            email_instructions: form.email_instructions,
            email_button_text: form.email_button_text,
            email_button_url: form.email_button_url,
            checkout_url: form.checkout_url,
            image_url: form.image_url,
          }}
        />
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="space-y-5"
        style={{
          background: '#FFFFFF',
          borderRadius: 20,
          border: '0.5px solid #E8E0EE',
          padding: 24,
          fontFamily: 'Nunito, sans-serif',
        }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1A1A2E' }}>
          {prize ? 'Editar prêmio' : 'Novo prêmio'}
        </h2>

        {/* Consolation toggle */}
        <div style={{ background: '#F8F9F9', borderRadius: 16, padding: '12px 16px' }}>
          <label className="flex items-center gap-3 cursor-pointer" style={{ fontSize: 16, color: '#1A1A2E' }}>
            <input
              type="checkbox"
              checked={form.is_consolation}
              onChange={e => update('is_consolation', e.target.checked)}
              style={{ width: 20, height: 20, borderRadius: 6, accentColor: '#E8357A' }}
            />
            <span style={{ fontWeight: 700 }}>Prêmio de consolação</span>
            <span style={{ fontSize: 12, color: '#9B8FAE', fontWeight: 400 }}>(exibido quando o participante não ganha)</span>
          </label>
          {form.is_consolation && existingConsolation && (
            <p style={{ fontSize: 13, color: '#E8357A', marginTop: 8, paddingLeft: 32 }}>
              <Emoji emoji="⚠️" label="Atenção" /> O prêmio "{existingConsolation.name}" será desmarcado como consolação
            </p>
          )}
        </div>

        <div className="grid grid-cols-[3rem_1fr] gap-3">
          <div>
            <label style={labelStyle}>Emoji</label>
            <input value={form.emoji} onChange={e => update('emoji', e.target.value)} style={{ ...inputStyle, textAlign: 'center', fontSize: 20, padding: '10px 4px' }} onFocus={focusHandler} onBlur={blurHandler} />
          </div>
          <div>
            <label style={labelStyle}>Nome</label>
            <input value={form.name} onChange={e => update('name', e.target.value)} required style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label style={labelStyle}>Descrição</label>
            <textarea value={form.description} onChange={e => update('description', e.target.value)} rows={3} maxLength={300} placeholder="Descreva o prêmio para o participante..." style={{ ...inputStyle, resize: 'vertical' }} onFocus={focusHandler as any} onBlur={blurHandler as any} />
            <p style={{ fontSize: 11, color: '#9B8FAE', marginTop: 4, textAlign: 'right' }}>{form.description.length} / 300</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label style={{ ...labelStyle, marginBottom: 0 }}>Imagem do prêmio</label>
              <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 13, color: '#5A5A7A' }}>
                <input
                  type="checkbox"
                  checked={form.show_image}
                  onChange={e => update('show_image', e.target.checked)}
                  style={{ width: 18, height: 18, borderRadius: 6, accentColor: '#E8357A' }}
                />
                Exibir na roleta
              </label>
            </div>
            {form.show_image ? (
              <>
                <PrizeImageUpload
                  imageUrl={form.image_url}
                  onImageChange={(url) => update('image_url', url)}
                />
                {!form.image_url && (
                  <p style={{ fontSize: 12, color: '#E8357A', marginTop: 4 }}>Imagem obrigatória quando exibida na roleta</p>
                )}
              </>
            ) : (
              <div
                style={{
                  background: '#FAF7FC',
                  border: '1.5px dashed #C7B8DA',
                  borderRadius: 16,
                  padding: 16,
                  textAlign: 'center',
                  fontFamily: 'Nunito, sans-serif',
                }}
              >
                <div style={{ lineHeight: 1, marginBottom: 6 }}><Emoji emoji={form.emoji || '🎁'} label="" size={36} /></div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                  {form.name || 'Nome do prêmio'}
                </div>
                <p style={{ fontSize: 11, color: '#9B8FAE', marginTop: 8 }}>
                  A fatia mostrará o emoji e o nome. Textos longos quebram em várias linhas para caber (nunca são cortados).
                </p>
              </div>
            )}
          </div>
        </div>




        {!form.is_consolation && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label style={labelStyle}>Instruções de resgate</label>
              <textarea value={form.redeem_instructions} onChange={e => update('redeem_instructions', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} onFocus={focusHandler as any} onBlur={blurHandler as any} />
            </div>

            <div>
              <label style={labelStyle}>URL de checkout (opcional)</label>
              <input value={form.checkout_url} onChange={e => update('checkout_url', e.target.value)} placeholder="https://..." style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
            </div>
          </div>
        )}

        {!form.is_consolation && (
          <div style={{ background: '#FAF7FC', border: '1px solid #E8E0EE', borderRadius: 16, padding: 16 }} className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E' }}>E-mail enviado ao ganhador</p>
                <p style={{ fontSize: 12, color: '#9B8FAE', marginTop: 2 }}>
                  Tudo opcional: o que ficar em branco usa o padrão. Use <code>{'{nome}'}</code> e <code>{'{premio}'}</code> nos textos. Veja o resultado na aba "E-mail" da prévia.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewTab('email')}
                className="lg:hidden"
                style={{ fontSize: 12, fontWeight: 700, color: '#E8357A', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                Ver e-mail
              </button>
            </div>

            <div>
              <label style={labelStyle}>Nome do prêmio no e-mail</label>
              <input
                value={form.email_prize_name}
                onChange={e => update('email_prize_name', e.target.value)}
                placeholder={form.name || 'Igual ao nome do prêmio'}
                maxLength={200}
                style={inputStyle} onFocus={focusHandler} onBlur={blurHandler}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label style={{ ...labelStyle, marginBottom: 0 }}>Instruções de resgate no e-mail</label>
                {form.redeem_instructions.trim() && form.email_instructions !== form.redeem_instructions && (
                  <button
                    type="button"
                    onClick={() => update('email_instructions', form.redeem_instructions)}
                    style={{ fontSize: 12, fontWeight: 700, color: '#E8357A', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Copiar da tela de resgate
                  </button>
                )}
              </div>
              <textarea
                value={form.email_instructions}
                onChange={e => update('email_instructions', e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Em branco = texto padrão da aba Personalização"
                style={{ ...inputStyle, resize: 'vertical' }}
                onFocus={focusHandler as unknown as React.FocusEventHandler<HTMLTextAreaElement>}
                onBlur={blurHandler as unknown as React.FocusEventHandler<HTMLTextAreaElement>}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label style={labelStyle}>Texto do botão</label>
                <input
                  value={form.email_button_text}
                  onChange={e => update('email_button_text', e.target.value)}
                  placeholder="Resgatar meu prêmio"
                  maxLength={80}
                  style={inputStyle} onFocus={focusHandler} onBlur={blurHandler}
                />
              </div>
              <div>
                <label style={labelStyle}>Link do botão</label>
                <input
                  value={form.email_button_url}
                  onChange={e => update('email_button_url', e.target.value)}
                  placeholder={form.checkout_url || 'https://...'}
                  inputMode="url"
                  style={{ ...inputStyle, ...(emailUrlInvalid ? { borderColor: '#E8357A' } : {}) }} onFocus={focusHandler} onBlur={blurHandler}
                />
                {emailUrlInvalid ? (
                  <p style={{ fontSize: 11, color: '#E8357A', marginTop: 4 }}>O link precisa começar com http:// ou https://</p>
                ) : (
                  <p style={{ fontSize: 11, color: '#9B8FAE', marginTop: 4 }}>
                    {form.email_button_url.trim() || form.checkout_url.trim()
                      ? 'Em branco = usa a URL de checkout do prêmio.'
                      : 'Sem link (nem URL de checkout), o e-mail sai sem botão.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label style={labelStyle}>Campanha (opcional)</label>
            <select
              value={form.campaign_id}
              onChange={e => update('campaign_id', e.target.value)}
              style={inputStyle}
              onFocus={focusHandler as any}
              onBlur={blurHandler as any}
            >
              <option value="">Nenhuma (global)</option>
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label style={labelStyle}>Probabilidade</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="10"
                  value={Number(form.weight)}
                  onChange={e => update('weight', Number(e.target.value))}
                  style={{ flex: 1, accentColor: '#E8357A', cursor: 'pointer' }}
                />
                <span style={{ fontSize: 18, fontWeight: 700, color: '#E8357A', minWidth: 44, textAlign: 'center', fontFamily: 'Nunito, sans-serif' }}>
                  {Number(form.weight)}%
                </span>
              </div>
              <p style={{ fontSize: 11, color: '#9B8FAE', marginTop: 4 }}>10% = raro · 100% = muito frequente</p>
            </div>
            <div>
              <label style={labelStyle}>Qtd disp.</label>
              <input type="number" min="0" value={form.quantity_available} onChange={e => update('quantity_available', e.target.value)} placeholder="∞" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 16, color: '#5A5A7A' }}>
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={e => update('active', e.target.checked)}
                  style={{ width: 20, height: 20, borderRadius: 6, accentColor: '#E8357A' }}
                />
                Ativo
              </label>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2 items-center">
          <button
            type="submit"
            disabled={saving || emailUrlInvalid || (form.show_image && !form.image_url) || (!form.show_image && (!form.emoji.trim() || !form.name.trim()))}
            className="transition-all hover:opacity-90 active:scale-[0.98]"
            style={{
              background: (form.show_image && !form.image_url) || (!form.show_image && (!form.emoji.trim() || !form.name.trim())) ? '#C5BDD0' : '#E8357A',
              color: '#fff',
              borderRadius: 50,
              padding: '12px 24px',
              fontWeight: 700,
              fontSize: 16,
              border: 'none',
              cursor: (form.show_image && !form.image_url) || (!form.show_image && (!form.emoji.trim() || !form.name.trim())) ? 'not-allowed' : 'pointer',
              fontFamily: 'Nunito, sans-serif',
            }}
          >

            {saving ? 'Salvando...' : 'Salvar'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="transition-all hover:opacity-90 active:scale-[0.98]"
            style={{
              background: '#FFFFFF',
              color: '#5A5A7A',
              border: '1.5px solid #E8E0EE',
              borderRadius: 50,
              padding: '12px 24px',
              fontWeight: 700,
              fontSize: 16,
              cursor: 'pointer',
              fontFamily: 'Nunito, sans-serif',
            }}
          >
            Cancelar
          </button>

          {/* Mobile preview button */}
          <div className="lg:hidden ml-auto">
            <Sheet>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="transition-all hover:opacity-90"
                  style={{
                    background: '#F8F9F9',
                    color: '#5A5A7A',
                    border: '1.5px solid #E8E0EE',
                    borderRadius: 50,
                    padding: '10px 18px',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: 'pointer',
                    fontFamily: 'Nunito, sans-serif',
                  }}
                >
                  Ver preview
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[70vh] overflow-y-auto">
                <div className="pt-4">
                  <p style={{ fontSize: 13, color: '#9B8FAE', fontFamily: 'Nunito, sans-serif', marginBottom: 12, textAlign: 'center' }}>
                    Pré-visualização ao vivo
                  </p>
                  {previewContent}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </form>

      {/* Desktop preview */}
      <div
        className="hidden lg:block sticky top-4 self-start"
        style={{
          background: '#FFFFFF',
          borderRadius: 20,
          border: '0.5px solid #E8E0EE',
          padding: 24,
          fontFamily: 'Nunito, sans-serif',
        }}
      >
        <p style={{ fontSize: 13, color: '#9B8FAE', marginBottom: 16, textAlign: 'center' }}>
          Pré-visualização ao vivo
        </p>
        {previewContent}
      </div>
    </div>
  );
};

export default PrizeForm;
