import { useState } from 'react';
import { Mail } from 'lucide-react';
import { FONT } from '@/lib/admin-styles';
import EmailSettings from './EmailSettings';
import PrizeEmails from './PrizeEmails';
import ConsolationEmail from './ConsolationEmail';

const TABS = [
  { id: 'general', label: 'Geral', hint: 'Remetente e textos padrão' },
  { id: 'prizes', label: 'Por prêmio', hint: 'E-mail próprio de cada prêmio' },
  { id: 'consolation', label: 'Não foi dessa vez', hint: 'E-mail fixo de consolação' },
] as const;
type TabId = typeof TABS[number]['id'];

const EmailCenter = () => {
  const [tab, setTab] = useState<TabId>('prizes');
  return (
    <div style={{ maxWidth: 1180, ...FONT }}>
      <div className="flex items-center gap-2 mb-4">
        <Mail size={20} style={{ color: '#E8357A' }} />
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1A1A2E' }}>Personalização dos e-mails</h2>
      </div>

      <div role="tablist" className="flex gap-1 overflow-x-auto" style={{ background: '#F3EEF7', borderRadius: 50, padding: 4, marginBottom: 20, width: 'fit-content', maxWidth: '100%' }}>
        {TABS.map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} title={t.hint} onClick={() => setTab(t.id)}
            style={{
              border: 'none', borderRadius: 50, padding: '9px 20px', cursor: 'pointer', whiteSpace: 'nowrap', ...FONT,
              fontWeight: 700, fontSize: 14,
              background: tab === t.id ? '#FFFFFF' : 'transparent', color: tab === t.id ? '#E8357A' : '#7A6E8E',
              boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && <EmailSettings />}
      {tab === 'prizes' && <PrizeEmails />}
      {tab === 'consolation' && <ConsolationEmail />}
    </div>
  );
};

export default EmailCenter;
