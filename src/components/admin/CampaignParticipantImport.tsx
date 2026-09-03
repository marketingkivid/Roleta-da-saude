import { useState, useRef, useCallback, useEffect } from 'react';
import Papa from 'papaparse';
import { CloudUpload, FileText, ChevronDown, ChevronUp, RefreshCw, Download, AlertTriangle, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { FONT } from '@/lib/admin-styles';

export interface ParsedRow {
  name: string;
  email: string;
  phone: string;
  status: 'valid' | 'invalid';
  reason?: string;
}

interface Props {
  onParsed: (rows: ParsedRow[]) => void;
  initialRows?: ParsedRow[];
  savedTokens?: Record<string, string>;
  slug?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\d{10,13}$/;

function validateRow(name: string, email: string, phone: string): { status: 'valid' | 'invalid'; reason?: string } {
  if (!name.trim()) return { status: 'invalid', reason: 'Nome vazio' };
  if (!EMAIL_RE.test(email)) return { status: 'invalid', reason: 'Email inválido' };
  if (!PHONE_RE.test(phone.replace(/\D/g, ''))) return { status: 'invalid', reason: 'Telefone inválido (10-13 dígitos)' };
  return { status: 'valid' };
}

function parseCSVRows(results: Papa.ParseResult<any>): ParsedRow[] {
  return results.data.map((row: any) => {
    const firstName = (row['FIRSTNAME'] || '').trim();
    const lastName = (row['LASTNAME'] || '').trim();
    const nome = (row['NOME'] || row['Nome'] || row['name'] || '').trim();
    const name = firstName ? `${firstName} ${lastName}`.trim() : nome;
    const email = (row['EMAIL'] || row['Email'] || row['email'] || '').trim();
    const phone = (row['WHATSAPP'] || row['TELEFONE'] || row['Telefone'] || row['Phone'] || row['phone'] || row['telefone'] || '').toString().trim();
    const v = validateRow(name, email, phone);
    return { name, email, phone: phone.replace(/\D/g, ''), ...v };
  });
}

const downloadTemplate = () => {
  const csv = 'FIRSTNAME;LASTNAME;EMAIL;WHATSAPP\nMaria;Silva;maria@email.com;5511999998888\nJoão;Santos;joao@email.com;5521988887777\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modelo_participantes.csv';
  a.click();
  URL.revokeObjectURL(url);
};

const CampaignParticipantImport = ({ onParsed, initialRows, savedTokens, slug }: Props) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>(initialRows ?? []);
  const [showDetails, setShowDetails] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fromDb, setFromDb] = useState((initialRows?.length ?? 0) > 0);

  const hasTokens = !!savedTokens && Object.keys(savedTokens).length > 0;

  const validCount = parsedRows.filter(r => r.status === 'valid').length;
  const invalidCount = parsedRows.filter(r => r.status === 'invalid').length;

  const copyLink = (token: string) => {
    const link = `https://roletadsaude.lovable.app/${slug}?token=${token}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copiado!');
  };

  const handleFile = useCallback((f: File) => {
    setFile(f);
    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      delimiter: ';',
      complete: (results) => {
        // If semicolon didn't produce enough columns, retry with comma
        const firstRow = results.data[0] as any;
        if (firstRow && Object.keys(firstRow).length <= 1) {
          Papa.parse(f, {
            header: true,
            skipEmptyLines: true,
            complete: (r2) => {
              const rows = parseCSVRows(r2);
              setParsedRows(rows);
              onParsed(rows);
            },
          });
          return;
        }
        const rows = parseCSVRows(results);
        setParsedRows(rows);
        onParsed(rows);
      },
    });
  }, [onParsed]);

  const reset = () => {
    setFile(null);
    setParsedRows([]);
    setShowDetails(false);
    onParsed([]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith('.csv')) handleFile(f);
  };

  // Sync initial rows
  useEffect(() => {
    if (initialRows?.length && parsedRows.length === 0 && !file) {
      setParsedRows(initialRows);
      setFromDb(true);
    }
  }, [initialRows]);

  const imported = parsedRows.length > 0;

  return (
    <div className="space-y-3" style={FONT}>
      <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

      {!imported ? (
        <>
          {/* Upload area */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 20,
              border: '1px solid #E8E0EE',
              padding: 32,
            }}
          >
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className="cursor-pointer transition-all"
              style={{
                border: `2px dashed ${dragOver ? '#E8357A' : '#E8E0EE'}`,
                borderRadius: 16,
                padding: '40px 24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                background: dragOver ? '#FDF2F8' : 'transparent',
              }}
            >
              <CloudUpload size={40} style={{ color: '#E8357A' }} />
              <span style={{ fontSize: 16, fontWeight: 500, color: '#1A1A2E' }}>
                Arraste seu arquivo CSV aqui
              </span>
              <span style={{ fontSize: 14, color: '#9B8FAE' }}>ou</span>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
                className="transition-all hover:bg-[#E8357A] hover:text-white"
                style={{
                  border: '1.5px solid #E8357A',
                  color: '#E8357A',
                  borderRadius: 50,
                  background: 'white',
                  padding: '10px 24px',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  ...FONT,
                }}
              >
                Selecionar arquivo
              </button>
            </div>
          </div>

          {/* CSV format reference */}
          <div style={{ background: '#F5F3F7', borderRadius: 16, padding: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E', marginBottom: 8, ...FONT }}>
              Formato esperado do arquivo
            </p>
            <p style={{ fontSize: 13, color: '#5A5A7A', lineHeight: 1.6, ...FONT }}>
              Separador: <code style={{ background: '#E8E0EE', borderRadius: 4, padding: '1px 6px' }}>;</code> (ponto e vírgula)<br />
              Colunas: <strong>FIRSTNAME</strong>, <strong>LASTNAME</strong>, <strong>EMAIL</strong>, <strong>WHATSAPP</strong>
            </p>
            <button
              type="button"
              onClick={downloadTemplate}
              className="flex items-center gap-1.5 mt-2 transition-all hover:opacity-70"
              style={{ background: 'none', border: 'none', color: '#E8357A', fontSize: 13, fontWeight: 700, cursor: 'pointer', ...FONT }}
            >
              <Download size={14} />
              Baixar modelo CSV
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Post-import summary */}
          <div style={{ background: '#FFFFFF', borderRadius: 20, border: '1px solid #E8E0EE', padding: 24 }}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <FileText size={20} style={{ color: '#1A1A2E' }} />
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', ...FONT }}>{fromDb && !file ? 'Lista salva anteriormente' : file?.name}</p>
                  <p style={{ fontSize: 13, color: '#9B8FAE', ...FONT }}>{parsedRows.length} contatos {fromDb && !file ? 'salvos' : 'importados'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span style={{ background: '#DCFCE7', color: '#16A34A', borderRadius: 50, padding: '4px 14px', fontSize: 13, fontWeight: 700, ...FONT }}>
                  {validCount} válidos
                </span>
                {invalidCount > 0 && (
                  <span style={{ background: '#FFF7ED', color: '#EA580C', borderRadius: 50, padding: '4px 14px', fontSize: 13, fontWeight: 700, ...FONT }}>
                    {invalidCount} com pendências
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-1.5 transition-all hover:opacity-70"
                style={{ background: 'none', border: '1.5px solid #E8E0EE', borderRadius: 50, padding: '6px 16px', fontSize: 13, fontWeight: 700, color: '#5A5A7A', cursor: 'pointer', ...FONT }}
              >
                {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                Ver detalhes
              </button>
              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-1.5 transition-all hover:opacity-70"
                style={{ background: 'none', border: '1.5px solid #E8E0EE', borderRadius: 50, padding: '6px 16px', fontSize: 13, fontWeight: 700, color: '#5A5A7A', cursor: 'pointer', ...FONT }}
              >
                <RefreshCw size={14} />
                Substituir arquivo
              </button>
            </div>

            {showDetails && (
              <div className="mt-4 overflow-auto" style={{ maxHeight: 300, borderRadius: 12, border: '1px solid #E8E0EE' }}>
                <table className="w-full" style={{ fontSize: 13, ...FONT }}>
                  <thead className="sticky top-0" style={{ background: '#F5F3F7' }}>
                    <tr>
                      {['NOME', 'EMAIL', 'TELEFONE', ...(hasTokens ? ['LINK'] : []), 'STATUS'].map(h => (
                        <th key={h} className="text-left px-3 py-2" style={{ fontWeight: 600, color: '#9B8FAE', fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((r, i) => {
                      const token = savedTokens?.[r.email];
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                          <td className="px-3 py-2" style={{ fontWeight: 600, color: '#1A1A2E' }}>{r.name}</td>
                          <td className="px-3 py-2" style={{ color: '#5A5A7A' }}>{r.email}</td>
                          <td className="px-3 py-2" style={{ color: '#5A5A7A' }}>{r.phone}</td>
                          {hasTokens && (
                            <td className="px-3 py-2">
                              {token ? (
                                <button
                                  type="button"
                                  onClick={() => copyLink(token)}
                                  className="flex items-center gap-1 transition-all hover:opacity-70"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E8357A', fontSize: 12, fontFamily: 'monospace', maxWidth: 220, ...FONT }}
                                  title={`https://roletadsaude.lovable.app/${slug}?token=${token}`}
                                >
                                  <Copy size={12} style={{ flexShrink: 0 }} />
                                  <span className="truncate">...{token.slice(-8)}</span>
                                </button>
                              ) : (
                                <span style={{ color: '#9B8FAE', fontSize: 12 }}>—</span>
                              )}
                            </td>
                          )}
                          <td className="px-3 py-2">
                            {r.status === 'valid' ? (
                              <span style={{ color: '#16A34A', fontWeight: 700 }}>✓ válido</span>
                            ) : (
                              <span style={{ color: '#EA580C', fontWeight: 700 }}>⚠ {r.reason}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Warning banner */}
          {invalidCount > 0 && (
            <div className="flex items-start gap-3" style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 16, padding: '14px 20px' }}>
              <AlertTriangle size={18} style={{ color: '#92400E', flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 14, color: '#92400E', ...FONT }}>
                {invalidCount} contato{invalidCount > 1 ? 's' : ''} não ser{invalidCount > 1 ? 'ão incluídos' : 'á incluído'} no sorteio por dados incompletos ou inválidos.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CampaignParticipantImport;
