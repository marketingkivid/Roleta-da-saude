import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Campaign {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  campaign_type: string;
  participation_limit: number | null;
  rules: string;
  active: boolean;
}

interface CampaignFormProps {
  campaign: Campaign | null;
  onSave: () => void;
  onCancel: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1.5px solid #E8E0EE',
  borderRadius: 20,
  padding: '13px 16px',
  fontSize: 16,
  fontFamily: 'Nunito, sans-serif',
  background: '#FFFFFF',
  color: '#1A1A2E',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 400,
  color: '#9B8FAE',
  marginBottom: 6,
  fontFamily: 'Nunito, sans-serif',
};

const CampaignForm = ({ campaign, onSave, onCancel }: CampaignFormProps) => {
  const [form, setForm] = useState({
    name: campaign?.name ?? '',
    start_date: campaign?.start_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    end_date: campaign?.end_date?.slice(0, 10) ?? new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    campaign_type: campaign?.campaign_type ?? 'gamificação',
    participation_limit: campaign?.participation_limit?.toString() ?? '',
    discount_percentage: (campaign as any)?.discount_percentage?.toString() ?? '0',
    rules: campaign?.rules ?? '',
    active: campaign?.active ?? true,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const slug = form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const payload = {
      name: form.name,
      slug,
      start_date: new Date(form.start_date).toISOString(),
      end_date: new Date(form.end_date).toISOString(),
      campaign_type: form.campaign_type,
      participation_limit: form.participation_limit ? parseInt(form.participation_limit) : null,
      discount_percentage: form.discount_percentage ? parseFloat(form.discount_percentage) : 0,
      rules: form.rules,
      active: form.active,
    };

    if (campaign) {
      await supabase.from('campaigns').update(payload).eq('id', campaign.id);
    } else {
      await supabase.from('campaigns').insert(payload);
    }
    setSaving(false);
    onSave();
  };

  const formatUpperSnake = (val: string) => val.toUpperCase().replace(/\s+/g, '_');

  const update = (key: string, value: string | boolean) =>
    setForm(prev => ({
      ...prev,
      [key]: (key === 'name' || key === 'campaign_type') && typeof value === 'string'
        ? formatUpperSnake(value)
        : value,
    }));

  const focusHandler = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    (e.target.style.borderColor = '#E8357A');
  const blurHandler = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    (e.target.style.borderColor = '#E8E0EE');

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      style={{
        background: '#FFFFFF',
        borderRadius: 20,
        border: '0.5px solid #E8E0EE',
        padding: 24,
        fontFamily: 'Nunito, sans-serif',
      }}
    >
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1A1A2E' }}>
        {campaign ? 'Editar campanha' : 'Nova campanha'}
      </h2>

      <div>
        <label style={labelStyle}>Nome</label>
        <input value={form.name} onChange={e => update('name', e.target.value)} required style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label style={labelStyle}>Data início</label>
          <input type="date" value={form.start_date} onChange={e => update('start_date', e.target.value)} required style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
        </div>
        <div>
          <label style={labelStyle}>Data fim</label>
          <input type="date" value={form.end_date} onChange={e => update('end_date', e.target.value)} required style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Tipo de campanha</label>
        <input value={form.campaign_type} onChange={e => update('campaign_type', e.target.value)} style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
      </div>

      <div>
        <label style={labelStyle}>Limite de participações (vazio = ilimitado)</label>
        <input type="number" min="0" value={form.participation_limit} onChange={e => update('participation_limit', e.target.value)} style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
      </div>

      <div>
        <label style={labelStyle}>Desconto do cupom (%)</label>
        <input type="number" min="0" max="100" step="1" value={form.discount_percentage} onChange={e => update('discount_percentage', e.target.value)} style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
      </div>

      <div>
        <label style={labelStyle}>Regras</label>
        <textarea value={form.rules} onChange={e => update('rules', e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} onFocus={focusHandler as any} onBlur={blurHandler as any} />
      </div>

      <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 16, color: '#5A5A7A', fontFamily: 'Nunito, sans-serif' }}>
        <input
          type="checkbox"
          checked={form.active}
          onChange={e => update('active', e.target.checked.toString() === 'true')}
          style={{
            width: 20,
            height: 20,
            borderRadius: 6,
            accentColor: '#E8357A',
          }}
        />
        Ativa
      </label>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="transition-all hover:opacity-90 active:scale-[0.98]"
          style={{
            background: '#E8357A',
            color: '#fff',
            borderRadius: 50,
            padding: '12px 24px',
            fontWeight: 700,
            fontSize: 16,
            border: 'none',
            cursor: 'pointer',
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
      </div>
    </form>
  );
};

export default CampaignForm;
