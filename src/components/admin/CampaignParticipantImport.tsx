import { useState, useRef, useCallback, useEffect } from 'react';
import Papa from 'papaparse';
import { CloudUpload, FileText, ChevronDown, ChevronUp, RefreshCw, Download, AlertTriangle, Copy, Plus, ClipboardPaste, Link2, Loader2, Pencil, Trash2, Check, X, Search } from 'lucide-react';
import { toast } from 'sonner';
import { FONT } from '@/lib/admin-styles';
import { supabase } from '@/integrations/supabase/client';
import { campaignUrl } from '@/lib/campaign-url';
import {
  type ParsedRow, buildRow, parsePastedText, mapSheetRows, mapBrevoContacts,
  mergeRows, checkSheetHeaders, matchesFilter,
} from '@/lib/participant-parsers';
import { readSpreadsheet, isSpreadsheetFile } from '@/lib/spreadsheet';

export type { ParsedRow };

interface BrevoListInfo { id: number; name: string; totalSubscribers?: number }

export interface SavedParticipantMeta { id: string; token: string; played: boolean }

interface Props {
  onParsed: (rows: ParsedRow[]) => void;
  initialRows?: ParsedRow[];
  savedMeta?: Record<string, SavedParticipantMeta>;
  slug?: string;
  brevoList?: { id: number; name: string } | null;
  onBrevoListChange?: (l: { id: number; name: string } | null) => void;
}

type Tab = 'file' | 'paste' | 'manual' | 'brevo';

const TABS: { key: Tab; label: string }[] = [
  { key: 'file', label: '📄 Arquivo' },
  { key: 'paste', label: '📋 Colar' },
  { key: 'manual', label: '✏️ Manual' },
  { key: 'brevo', label: '🔗 Lista do Brevo' },
];

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1.5px solid #E8E0EE',
  borderRadius: 16,
  padding: '11px 14px',
  fontSize: 15,
  background: '#FFFFFF',
  color: '#1A1A2E',
  outline: 'none',
  ...FONT,
};

const pinkButton: React.CSSProperties = {
  background: '#E8357A',
  color: '#fff',
  borderRadius: 50,
  padding: '10px 24px',
  fontWeight: 700,
  fontSize: 14,
  border: 'none',
  cursor: 'pointer',
  ...FONT,
};

const BREVO_OFFLINE = 'Não conseguimos falar com o Brevo agora. Tente de novo em instantes ou use as outras abas.';

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

const CampaignParticipantImport = ({ onParsed, initialRows, savedMeta, slug, brevoList, onBrevoListChange }: Props) => {
  const [tab, setTab] = useState<Tab>('file');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>(initialRows ?? []);
  const [showDetails, setShowDetails] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fromDb, setFromDb] = useState((initialRows?.length ?? 0) > 0);

  // aba Colar
  const [pasteText, setPasteText] = useState('');

  // aba Manual
  const [mNome, setMNome] = useState('');
  const [mEmail, setMEmail] = useState('');
  const [mFone, setMFone] = useState('');
  const nomeRef = useRef<HTMLInputElement>(null);

  // gestão da lista em montagem
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState({ name: '', email: '', phone: '' });
  const [filterText, setFilterText] = useState('');
  const [onlyPending, setOnlyPending] = useState(false);

  // aba Brevo
  const [brevoLists, setBrevoLists] = useState<BrevoListInfo[] | null>(null);
  const [brevoError, setBrevoError] = useState('');
  const [brevoLoading, setBrevoLoading] = useState(false);
  const [selectedList, setSelectedList] = useState<number | ''>(brevoList?.id ?? '');

  // Cópia local dos metadados dos salvos: a correção inline atualiza o banco
  // e precisa remapear a chave quando o e-mail muda.
  const [meta, setMeta] = useState<Record<string, SavedParticipantMeta>>(savedMeta ?? {});
  useEffect(() => {
    if (savedMeta && Object.keys(savedMeta).length !== Object.keys(meta).length) setMeta(savedMeta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedMeta]);

  const hasTokens = Object.keys(meta).length > 0;
  const validCount = parsedRows.filter(r => r.status === 'valid').length;
  const invalidCount = parsedRows.filter(r => r.status === 'invalid').length;
  const imported = parsedRows.length > 0;

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(campaignUrl(slug ?? '', token));
    toast.success('Link copiado!');
  };

  const addRows = useCallback((incoming: ParsedRow[]) => {
    if (incoming.length === 0) return;
    setParsedRows(prev => {
      const { rows, ignored } = mergeRows(prev, incoming);
      const added = rows.length - prev.length;
      onParsed(rows);
      if (ignored > 0) toast.info(`${ignored} ignorado${ignored > 1 ? 's' : ''} por já estar${ignored > 1 ? 'em' : ''} na lista`);
      if (added > 0) toast.success(`${added} contato${added > 1 ? 's' : ''} adicionado${added > 1 ? 's' : ''}`);
      return rows;
    });
  }, [onParsed]);

  const removeRow = (idx: number) => {
    const rows = parsedRows.filter((_, j) => j !== idx);
    setParsedRows(rows);
    onParsed(rows);
    if (editingIdx === idx) setEditingIdx(null);
  };

  const startEdit = (idx: number) => {
    const r = parsedRows[idx];
    setEditDraft({ name: r.name, email: r.email, phone: r.phone });
    setEditingIdx(idx);
  };

  const confirmEdit = async (idx: number) => {
    const original = parsedRows[idx];
    const fixed = buildRow(editDraft.name, editDraft.email, editDraft.phone, original.source ?? 'Manual');
    // colisão com OUTRA linha (e-mail ou telefone) mantém a edição aberta
    const others = parsedRows.filter((_, j) => j !== idx);
    const { ignored } = mergeRows(others, [fixed]);
    if (ignored > 0) {
      toast.error('Já existe outro contato com esse e-mail ou telefone na lista.');
      return;
    }
    // Linha já salva: corrige direto no banco, preservando o token (o link
    // distribuído continua valendo). Só permitido para quem não jogou.
    const m = meta[original.email];
    if (m) {
      if (fixed.status === 'invalid') { toast.error(fixed.reason); return; }
      const { error } = await supabase
        .from('campaign_participants')
        .update({ name: fixed.name, email: fixed.email, phone: fixed.phone })
        .eq('id', m.id);
      if (error) {
        toast.error((error as { code?: string }).code === '23505'
          ? 'Já existe participante com esse e-mail nesta campanha.'
          : 'Não foi possível corrigir agora. Tente de novo.');
        return;
      }
      setMeta(prev => {
        const next = { ...prev };
        delete next[original.email];
        next[fixed.email] = m;
        return next;
      });
      toast.success('Dados corrigidos — o link continua o mesmo.');
    }
    const rows = parsedRows.map((r, j) => (j === idx ? fixed : r));
    setParsedRows(rows);
    onParsed(rows);
    setEditingIdx(null);
  };

  const handleFile = useCallback(async (f: File) => {
    if (isSpreadsheetFile(f.name)) {
      try {
        const { rows: sheetRows, sheetCount } = await readSpreadsheet(f);
        const headers = checkSheetHeaders(sheetRows);
        if (!headers.ok) {
          toast.error(`Colunas não encontradas: ${headers.missing.join(', ')}. Encontramos: ${headers.found.join(', ') || 'nenhuma'}`);
          return;
        }
        if (sheetCount > 1) toast.info(`O arquivo tem ${sheetCount} abas — lemos só a primeira.`);
        addRows(mapSheetRows(sheetRows, 'Arquivo'));
      } catch {
        toast.error('Não conseguimos ler este arquivo. Ele está aberto em outro programa?');
      }
      return;
    }
    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      delimiter: ';',
      complete: (results) => {
        const firstRow = results.data[0] as Record<string, unknown> | undefined;
        if (firstRow && Object.keys(firstRow).length <= 1) {
          Papa.parse(f, {
            header: true,
            skipEmptyLines: true,
            complete: (r2) => addRows(mapSheetRows(r2.data as Record<string, unknown>[], 'Arquivo')),
          });
          return;
        }
        addRows(mapSheetRows(results.data as Record<string, unknown>[], 'Arquivo'));
      },
    });
  }, [addRows]);

  const reset = () => {
    setParsedRows([]);
    setShowDetails(false);
    setFromDb(false);
    onParsed([]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith('.csv') || isSpreadsheetFile(f.name))) handleFile(f);
  };

  // Sync initial rows (edição de campanha existente)
  useEffect(() => {
    if (initialRows?.length && parsedRows.length === 0) {
      setParsedRows(initialRows);
      setFromDb(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRows]);

  const addManual = () => {
    const row = buildRow(mNome, mEmail, mFone, 'Manual');
    if (row.status === 'invalid') {
      toast.error(row.reason);
      return;
    }
    addRows([row]);
    setMNome(''); setMEmail(''); setMFone('');
    nomeRef.current?.focus();
  };

  const loadLists = useCallback(async () => {
    setBrevoLoading(true); setBrevoError('');
    const { data, error } = await supabase.functions.invoke('brevo-lists', { body: { action: 'lists' } });
    setBrevoLoading(false);
    if (error || !data?.lists) { setBrevoError(BREVO_OFFLINE); return; }
    setBrevoLists(data.lists);
  }, []);

  const importFromBrevo = async (listId: number) => {
    const list = brevoLists?.find(l => l.id === listId) ?? (brevoList?.id === listId ? brevoList : null);
    if (!list) return;
    setBrevoLoading(true); setBrevoError('');
    const { data, error } = await supabase.functions.invoke('brevo-lists', { body: { action: 'contacts', listId } });
    setBrevoLoading(false);
    if (error || !data?.contacts) { setBrevoError(BREVO_OFFLINE); return; }
    if (data.contacts.length === 0) { toast.info('Esta lista não tem contatos.'); return; }
    addRows(mapBrevoContacts(data.contacts, list.name));
    onBrevoListChange?.({ id: list.id, name: list.name });
    if (data.truncated) toast.warning(`A lista tem ${data.total} contatos; importamos os primeiros ${data.contacts.length}.`);
  };

  // Carrega as listas na primeira visita à aba
  useEffect(() => {
    if (tab === 'brevo' && brevoLists === null && !brevoLoading && !brevoError) loadLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div className="space-y-3" style={FONT}>
      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

      {/* Abas — sempre visíveis: importar não esconde as portas */}
      <div className="flex items-center gap-2 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className="transition-all"
            style={{
              border: tab === t.key ? '1.5px solid #E8357A' : '1.5px solid #E8E0EE',
              background: tab === t.key ? '#E8357A' : '#FFFFFF',
              color: tab === t.key ? '#FFFFFF' : '#5A5A7A',
              borderRadius: 50,
              padding: '8px 18px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              ...FONT,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'file' && (
        <>
          <div style={{ background: '#FFFFFF', borderRadius: 20, border: '1px solid #E8E0EE', padding: 24 }}>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className="cursor-pointer transition-all"
              style={{
                border: `2px dashed ${dragOver ? '#E8357A' : '#E8E0EE'}`,
                borderRadius: 16,
                padding: '32px 24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                background: dragOver ? '#FDF2F8' : 'transparent',
              }}
            >
              <CloudUpload size={36} style={{ color: '#E8357A' }} />
              <span style={{ fontSize: 16, fontWeight: 500, color: '#1A1A2E' }}>
                Arraste seu arquivo Excel ou CSV aqui
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

          <div style={{ background: '#F5F3F7', borderRadius: 16, padding: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E', marginBottom: 8, ...FONT }}>
              Formato esperado
            </p>
            <p style={{ fontSize: 13, color: '#5A5A7A', lineHeight: 1.6, ...FONT }}>
              Excel (<strong>.xlsx</strong>) ou CSV, com as colunas <strong>NOME</strong> (ou FIRSTNAME/LASTNAME), <strong>EMAIL</strong> e <strong>WHATSAPP</strong>.<br />
              Planilha com várias abas? Lemos só a primeira.
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
      )}

      {tab === 'paste' && (
        <div style={{ background: '#FFFFFF', borderRadius: 20, border: '1px solid #E8E0EE', padding: 24 }} className="space-y-3">
          <p style={{ fontSize: 13, color: '#5A5A7A', ...FONT }}>
            Copie as linhas no Excel ou Google Sheets (nome, e-mail e WhatsApp) e cole aqui. A linha de cabeçalho, se vier junto, é descartada sozinha.
          </p>
          <textarea
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            rows={6}
            placeholder={'Maria Silva\tmaria@email.com\t5511999998888\nJoão Santos\tjoao@email.com\t5521988887777'}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }}
            onFocus={e => (e.target.style.borderColor = '#E8357A')}
            onBlur={e => (e.target.style.borderColor = '#E8E0EE')}
          />
          <button
            type="button"
            onClick={() => {
              const rows = parsePastedText(pasteText);
              if (rows.length === 0) { toast.error('Nada para adicionar — cole ao menos uma linha.'); return; }
              addRows(rows);
              setPasteText('');
            }}
            className="flex items-center gap-2 transition-all hover:opacity-90 active:scale-[0.98]"
            style={pinkButton}
          >
            <ClipboardPaste size={15} />
            Adicionar à lista
          </button>
        </div>
      )}

      {tab === 'manual' && (
        <div style={{ background: '#FFFFFF', borderRadius: 20, border: '1px solid #E8E0EE', padding: 24 }} className="space-y-3">
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <input
              ref={nomeRef}
              value={mNome}
              onChange={e => setMNome(e.target.value)}
              placeholder="Nome completo"
              style={{ ...inputStyle, gridColumn: '1 / -1' }}
              onFocus={e => (e.target.style.borderColor = '#E8357A')}
              onBlur={e => (e.target.style.borderColor = '#E8E0EE')}
            />
            <input
              value={mEmail}
              onChange={e => setMEmail(e.target.value)}
              placeholder="E-mail"
              type="email"
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#E8357A')}
              onBlur={e => (e.target.style.borderColor = '#E8E0EE')}
            />
            <input
              value={mFone}
              onChange={e => setMFone(e.target.value)}
              placeholder="WhatsApp (só números, com DDD)"
              style={inputStyle}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addManual(); } }}
              onFocus={e => (e.target.style.borderColor = '#E8357A')}
              onBlur={e => (e.target.style.borderColor = '#E8E0EE')}
            />
          </div>
          <button
            type="button"
            onClick={addManual}
            className="flex items-center gap-2 transition-all hover:opacity-90 active:scale-[0.98]"
            style={pinkButton}
          >
            <Plus size={15} />
            Adicionar
          </button>
        </div>
      )}

      {tab === 'brevo' && (
        <div style={{ background: '#FFFFFF', borderRadius: 20, border: '1px solid #E8E0EE', padding: 24 }} className="space-y-3">
          {brevoList && (
            <div className="flex items-center justify-between flex-wrap gap-2" style={{ background: '#F5F3F7', borderRadius: 12, padding: '12px 16px' }}>
              <span style={{ fontSize: 13, color: '#5A5A7A', ...FONT }}>
                Conectada à lista <strong style={{ color: '#1A1A2E' }}>{brevoList.name}</strong>
              </span>
              <button
                type="button"
                onClick={() => importFromBrevo(brevoList.id)}
                disabled={brevoLoading}
                className="flex items-center gap-1.5 transition-all hover:opacity-70"
                style={{ background: 'none', border: '1.5px solid #E8357A', borderRadius: 50, padding: '6px 16px', fontSize: 13, fontWeight: 700, color: '#E8357A', cursor: 'pointer', opacity: brevoLoading ? 0.6 : 1, ...FONT }}
              >
                <RefreshCw size={13} />
                Reimportar da lista
              </button>
            </div>
          )}

          {brevoError ? (
            <div className="flex items-start gap-3" style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, padding: '12px 16px' }}>
              <AlertTriangle size={16} style={{ color: '#92400E', flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ fontSize: 13, color: '#92400E', ...FONT }}>{brevoError}</p>
                <button
                  type="button"
                  onClick={loadLists}
                  style={{ background: 'none', border: 'none', color: '#E8357A', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0, marginTop: 4, ...FONT }}
                >
                  Tentar de novo
                </button>
              </div>
            </div>
          ) : brevoLoading && brevoLists === null ? (
            <div className="flex items-center gap-2" style={{ color: '#9B8FAE', fontSize: 14, ...FONT }}>
              <Loader2 size={16} className="animate-spin" />
              Buscando suas listas no Brevo...
            </div>
          ) : (
            <>
              <p style={{ fontSize: 13, color: '#5A5A7A', ...FONT }}>
                Escolha uma lista da conta Brevo. Os contatos entram na lista da campanha como qualquer outra origem — quem já está não duplica.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={selectedList}
                  onChange={e => setSelectedList(e.target.value ? Number(e.target.value) : '')}
                  style={{ ...inputStyle, maxWidth: 380 }}
                  onFocus={e => (e.target.style.borderColor = '#E8357A')}
                  onBlur={e => (e.target.style.borderColor = '#E8E0EE')}
                >
                  <option value="">Selecione uma lista</option>
                  {(brevoLists ?? []).map(l => (
                    <option key={l.id} value={l.id}>{l.name} ({l.totalSubscribers ?? 0} contatos)</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => selectedList !== '' && importFromBrevo(selectedList)}
                  disabled={selectedList === '' || brevoLoading}
                  className="flex items-center gap-2 transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ ...pinkButton, opacity: selectedList === '' || brevoLoading ? 0.6 : 1 }}
                >
                  {brevoLoading ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
                  Importar contatos
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {imported && (
        <>
          {/* Resumo da lista acumulada */}
          <div style={{ background: '#FFFFFF', borderRadius: 20, border: '1px solid #E8E0EE', padding: 24 }}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <FileText size={20} style={{ color: '#1A1A2E' }} />
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', ...FONT }}>Lista de participantes</p>
                  <p style={{ fontSize: 13, color: '#9B8FAE', ...FONT }}>{parsedRows.length} contatos{fromDb ? ' (inclui os já salvos)' : ''}</p>
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
                Limpar lista
              </button>
            </div>

            {showDetails && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-2" style={{ border: '1.5px solid #E8E0EE', borderRadius: 50, padding: '6px 14px', flex: 1, minWidth: 220, background: '#FFFFFF' }}>
                    <Search size={14} style={{ color: '#9B8FAE', flexShrink: 0 }} />
                    <input
                      value={filterText}
                      onChange={e => setFilterText(e.target.value)}
                      placeholder="Buscar nome, e-mail ou telefone"
                      style={{ border: 'none', outline: 'none', fontSize: 13, width: '100%', color: '#1A1A2E', background: 'transparent', ...FONT }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setOnlyPending(v => !v)}
                    style={{
                      border: onlyPending ? '1.5px solid #EA580C' : '1.5px solid #E8E0EE',
                      background: onlyPending ? '#FFF7ED' : '#FFFFFF',
                      color: onlyPending ? '#EA580C' : '#5A5A7A',
                      borderRadius: 50, padding: '6px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', ...FONT,
                    }}
                  >
                    ⚠ Só pendências
                  </button>
                </div>
                <div className="overflow-auto" style={{ maxHeight: 300, borderRadius: 12, border: '1px solid #E8E0EE' }}>
                <table className="w-full" style={{ fontSize: 13, ...FONT }}>
                  <thead className="sticky top-0" style={{ background: '#F5F3F7' }}>
                    <tr>
                      {['NOME', 'EMAIL', 'TELEFONE', 'ORIGEM', ...(hasTokens ? ['LINK'] : []), 'STATUS', ''].map((h, hi) => (
                        <th key={hi} className="text-left px-3 py-2" style={{ fontWeight: 600, color: '#9B8FAE', fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows
                      .map((r, i) => ({ r, i }))
                      .filter(({ r }) => matchesFilter(r, filterText) && (!onlyPending || r.status === 'invalid'))
                      .map(({ r, i }) => {
                      const rowMeta = meta[r.email];
                      const token = rowMeta?.token;
                      const editing = editingIdx === i;
                      const cellInput: React.CSSProperties = { width: '100%', border: '1.5px solid #E8357A', borderRadius: 8, padding: '4px 8px', fontSize: 13, outline: 'none', ...FONT };
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #F3F4F6', background: editing ? '#FDF2F8' : 'transparent' }}>
                          <td className="px-3 py-2" style={{ fontWeight: 600, color: '#1A1A2E' }}>
                            {editing ? <input value={editDraft.name} onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))} style={cellInput} /> : r.name}
                          </td>
                          <td className="px-3 py-2" style={{ color: '#5A5A7A' }}>
                            {editing ? <input value={editDraft.email} onChange={e => setEditDraft(d => ({ ...d, email: e.target.value }))} style={cellInput} /> : r.email}
                          </td>
                          <td className="px-3 py-2" style={{ color: '#5A5A7A' }}>
                            {editing ? <input value={editDraft.phone} onChange={e => setEditDraft(d => ({ ...d, phone: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') confirmEdit(i); }} style={cellInput} /> : r.phone}
                          </td>
                          <td className="px-3 py-2" style={{ color: '#9B8FAE', fontSize: 12 }}>{r.source ?? '—'}</td>
                          {hasTokens && (
                            <td className="px-3 py-2">
                              {token ? (
                                <button
                                  type="button"
                                  onClick={() => copyLink(token)}
                                  className="flex items-center gap-1 transition-all hover:opacity-70"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E8357A', fontSize: 12, maxWidth: 220, ...FONT }}
                                  title={campaignUrl(slug ?? '', token)}
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
                          <td className="px-3 py-2" style={{ whiteSpace: 'nowrap' }}>
                            {editing ? (
                              <span className="flex items-center gap-1">
                                <button type="button" onClick={() => confirmEdit(i)} title="Confirmar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16A34A', padding: 2 }}><Check size={15} /></button>
                                <button type="button" onClick={() => setEditingIdx(null)} title="Cancelar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9B8FAE', padding: 2 }}><X size={15} /></button>
                              </span>
                            ) : !rowMeta ? (
                              <span className="flex items-center gap-1">
                                <button type="button" onClick={() => startEdit(i)} title="Corrigir" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9B8FAE', padding: 2 }}><Pencil size={14} /></button>
                                <button type="button" onClick={() => removeRow(i)} title="Remover da lista" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9B8FAE', padding: 2 }}><Trash2 size={14} /></button>
                              </span>
                            ) : !rowMeta.played ? (
                              <button type="button" onClick={() => startEdit(i)} title="Corrigir dados (o link continua o mesmo)" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9B8FAE', padding: 2 }}><Pencil size={14} /></button>
                            ) : (
                              <span title="Já jogou — registro fechado" style={{ color: '#D8D0E0', fontSize: 13, cursor: 'default' }}>🔒</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </div>

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
