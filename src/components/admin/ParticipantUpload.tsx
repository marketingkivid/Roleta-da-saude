import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Papa from 'papaparse';
import { Upload, Copy, Check } from 'lucide-react';

interface Campaign { id: string; name: string; }

interface ParsedRow {
  name: string;
  email: string;
  phone: string;
  cpf: string;
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

const ParticipantUpload = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [generatedLinks, setGeneratedLinks] = useState<string[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [source, setSource] = useState('Instagram');
  const fileRef = useRef<HTMLInputElement>(null);

  const SOURCE_OPTIONS = ['Instagram', 'Suporte', 'App Kivid', 'Outros'];

  useEffect(() => {
    supabase.from('campaigns').select('id, name').eq('active', true).then(({ data }) => {
      if (data) setCampaigns(data);
    });
  }, []);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const parsed = result.data.map((row: any) => ({
          name: row['Nome'] || row['name'] || '',
          email: row['Email'] || row['email'] || '',
          phone: row['Telefone'] || row['Phone'] || row['phone'] || row['telefone'] || '',
          cpf: row['CPF'] || row['cpf'] || '',
        }));
        setRows(parsed);
        setGeneratedLinks([]);
      },
    });
  };

  const handleUpload = async () => {
    if (!selectedCampaign || rows.length === 0) return;
    setUploading(true);

    const toInsert = rows.map((r) => ({
      campaign_id: selectedCampaign,
      name: r.name,
      email: r.email,
      phone: r.phone,
      cpf: r.cpf,
      source,
    }));

    const { data, error } = await supabase.from('campaign_participants').insert(toInsert).select('unique_token');

    if (!error && data) {
      const origin = window.location.origin;
      setGeneratedLinks(data.map((d) => `${origin}/?token=${d.unique_token}`));
    }
    setUploading(false);
  };

  const copyLink = (link: string, idx: number) => {
    navigator.clipboard.writeText(link);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const copyAll = () => {
    navigator.clipboard.writeText(generatedLinks.join('\n'));
    setCopiedIdx(-1);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="space-y-6" style={{ fontFamily: 'Nunito, sans-serif' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1A1A2E' }}>Upload de Participantes</h2>

      <div className="space-y-4">
        <div>
          <label style={labelStyle}>Campanha</label>
          <select
            value={selectedCampaign}
            onChange={(e) => setSelectedCampaign(e.target.value)}
            style={inputStyle}
            onFocus={e => e.target.style.borderColor = '#E8357A'}
            onBlur={e => e.target.style.borderColor = '#E8E0EE'}
          >
            <option value="">Selecione uma campanha</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Origem dos leads</label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            style={inputStyle}
            onFocus={e => e.target.style.borderColor = '#E8357A'}
            onBlur={e => e.target.style.borderColor = '#E8E0EE'}
          >
            {SOURCE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Arquivo CSV</label>
          <p style={{ fontSize: 13, color: '#9B8FAE', marginBottom: 8 }}>Colunas esperadas: Nome, Email, Telefone, CPF</p>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{ fontSize: 16, color: '#5A5A7A' }} />
        </div>
      </div>

      {rows.length > 0 && (
        <div className="space-y-4">
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E' }}>
            Preview ({rows.length} registros)
          </h3>
          <div style={{ background: '#FFFFFF', borderRadius: 20, border: '0.5px solid #E8E0EE', overflow: 'hidden', maxHeight: 260 }} className="overflow-auto">
            <table className="w-full">
              <thead className="sticky top-0" style={{ background: '#FFFFFF' }}>
                <tr style={{ borderBottom: '1px solid #E8E0EE' }}>
                  {['NOME', 'EMAIL', 'TELEFONE', 'CPF'].map(h => (
                    <th key={h} className="text-left px-4 py-2" style={{ fontSize: 13, fontWeight: 400, color: '#9B8FAE', letterSpacing: 0.5 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 20).map((r, i) => (
                  <tr key={i} style={{ borderBottom: i < Math.min(rows.length, 20) - 1 ? '1px solid #F3F4F6' : 'none' }}>
                    <td className="px-4 py-2" style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E' }}>{r.name}</td>
                    <td className="px-4 py-2" style={{ fontSize: 13, color: '#5A5A7A' }}>{r.email}</td>
                    <td className="px-4 py-2" style={{ fontSize: 13, color: '#5A5A7A' }}>{r.phone}</td>
                    <td className="px-4 py-2" style={{ fontSize: 13, color: '#5A5A7A' }}>{r.cpf}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 20 && <p style={{ fontSize: 13, color: '#9B8FAE', padding: '8px 16px' }}>...e mais {rows.length - 20} registros</p>}
          </div>

          <button
            onClick={handleUpload}
            disabled={!selectedCampaign || uploading}
            className="flex items-center gap-2 transition-all hover:opacity-90 active:scale-[0.98]"
            style={{
              background: '#E8357A',
              color: '#fff',
              borderRadius: 50,
              padding: '12px 24px',
              fontWeight: 700,
              fontSize: 16,
              border: 'none',
              cursor: 'pointer',
              opacity: (!selectedCampaign || uploading) ? 0.6 : 1,
            }}
          >
            <Upload style={{ width: 16, height: 16 }} />
            {uploading ? 'Enviando...' : `Importar ${rows.length} participantes`}
          </button>
        </div>
      )}

      {generatedLinks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E' }}>
              Links gerados ({generatedLinks.length})
            </h3>
            <button
              onClick={copyAll}
              className="flex items-center gap-1.5 transition-all hover:opacity-90"
              style={{
                background: '#FFFFFF',
                color: '#5A5A7A',
                border: '1.5px solid #E8E0EE',
                borderRadius: 50,
                padding: '6px 14px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {copiedIdx === -1 ? <Check style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
              Copiar todos
            </button>
          </div>
          <div
            className="overflow-auto space-y-1"
            style={{
              background: '#FFFFFF',
              borderRadius: 20,
              border: '0.5px solid #E8E0EE',
              padding: 12,
              maxHeight: 260,
            }}
          >
            {generatedLinks.map((link, i) => (
              <div key={i} className="flex items-center gap-2" style={{ fontSize: 13 }}>
                <span className="truncate flex-1" style={{ fontFamily: 'monospace', color: '#5A5A7A' }}>{link}</span>
                <button
                  onClick={() => copyLink(link, i)}
                  style={{ color: '#E8357A', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'Nunito, sans-serif' }}
                >
                  {copiedIdx === i ? 'copiado' : 'copiar'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ParticipantUpload;
