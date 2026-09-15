export interface ParsedRow {
  name: string;
  email: string;
  phone: string;
  status: 'valid' | 'invalid';
  reason?: string;
  source?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\d{10,13}$/;

export function validateRow(name: string, email: string, phone: string): { status: 'valid' | 'invalid'; reason?: string } {
  if (!name.trim()) return { status: 'invalid', reason: 'Nome vazio' };
  if (!EMAIL_RE.test(email)) return { status: 'invalid', reason: 'Email inválido' };
  if (!PHONE_RE.test(phone.replace(/\D/g, ''))) return { status: 'invalid', reason: 'Telefone inválido (10-13 dígitos)' };
  return { status: 'valid' };
}

export function buildRow(name: string, email: string, phone: string, source: string): ParsedRow {
  const cleanPhone = phone.replace(/\D/g, '');
  return { name: name.trim(), email: email.trim(), phone: cleanPhone, source, ...validateRow(name, email.trim(), cleanPhone) };
}

// célula de planilha → string (número grande do Excel não pode virar "5.51e12")
function cellToString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'number') return Number.isInteger(v) ? v.toFixed(0) : String(v);
  return String(v).trim();
}

const HEADER_WORDS = ['nome', 'name', 'email', 'e-mail', 'telefone', 'phone', 'whatsapp', 'firstname', 'lastname', 'sobrenome'];

function looksLikeHeader(cols: string[]): boolean {
  return cols.some(c => HEADER_WORDS.includes(c.trim().toLowerCase()));
}

export function parsePastedText(text: string, source = 'Colado'): ParsedRow[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const delimiter = text.includes('\t') ? '\t' : text.includes(';') ? ';' : ',';
  const rows: ParsedRow[] = [];
  lines.forEach((line, i) => {
    const cols = line.split(delimiter).map(c => c.trim());
    if (i === 0 && looksLikeHeader(cols)) return;
    const emailIdx = cols.findIndex(c => c.includes('@'));
    if (emailIdx === -1 || cols.length < 3) {
      rows.push({ name: line.slice(0, 60), email: '', phone: '', status: 'invalid', reason: 'Linha não reconhecida', source });
      return;
    }
    const name = cols.slice(0, emailIdx).join(' ').trim();
    const phone = cols[emailIdx + 1] ?? '';
    rows.push(buildRow(name, cols[emailIdx], phone, source));
  });
  return rows;
}

function pickField(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const hit = Object.keys(row).find(rk => rk.trim().toLowerCase() === k);
    if (hit && cellToString(row[hit])) return cellToString(row[hit]);
  }
  return '';
}

export function mapSheetRows(sheetRows: Record<string, unknown>[], source = 'Arquivo'): ParsedRow[] {
  return sheetRows.map(row => {
    const first = pickField(row, ['firstname']);
    const last = pickField(row, ['lastname', 'sobrenome']);
    const nome = pickField(row, ['nome', 'name']);
    const name = first ? `${first} ${last}`.trim() : nome;
    const email = pickField(row, ['email', 'e-mail']);
    const phone = pickField(row, ['whatsapp', 'telefone', 'phone', 'celular']);
    return buildRow(name, email, phone, source);
  });
}

export function checkSheetHeaders(sheetRows: Record<string, unknown>[]): { ok: boolean; found: string[]; missing: string[] } {
  const keys = (sheetRows[0] ? Object.keys(sheetRows[0]) : []).map(k => k.trim().toUpperCase());
  const hasName = keys.some(k => ['FIRSTNAME', 'NOME', 'NAME'].includes(k));
  const hasEmail = keys.some(k => ['EMAIL', 'E-MAIL'].includes(k));
  const hasPhone = keys.some(k => ['WHATSAPP', 'TELEFONE', 'PHONE', 'CELULAR'].includes(k));
  const missing: string[] = [];
  if (!hasName) missing.push('NOME (ou FIRSTNAME)');
  if (!hasEmail) missing.push('EMAIL');
  if (!hasPhone) missing.push('WHATSAPP (ou TELEFONE)');
  return { ok: missing.length === 0, found: keys, missing };
}

export interface BrevoContact {
  email?: string;
  attributes?: Record<string, unknown>;
}

export function mapBrevoContacts(contacts: BrevoContact[], listName: string): ParsedRow[] {
  const source = `Brevo: ${listName}`;
  return contacts.map(c => {
    const a = c.attributes ?? {};
    const first = cellToString(a['FIRSTNAME'] ?? a['NOME']);
    const last = cellToString(a['LASTNAME'] ?? a['SOBRENOME']);
    const name = `${first} ${last}`.trim();
    const phone = cellToString(a['WHATSAPP'] ?? a['SMS']);
    return buildRow(name, c.email ?? '', phone, source);
  });
}

// Normaliza telefone para comparação: só dígitos; remove o 55 do país
// quando o restante ainda é um número BR plausível (10-11 dígitos).
export function normalizePhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('55') && d.length - 2 >= 10) return d.slice(2);
  return d;
}

export function matchesFilter(row: ParsedRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const qDigits = q.replace(/\D/g, '');
  return row.name.toLowerCase().includes(q)
    || row.email.toLowerCase().includes(q)
    || (qDigits.length > 0 && row.phone.includes(qDigits));
}

export function mergeRows(current: ParsedRow[], incoming: ParsedRow[]): { rows: ParsedRow[]; ignored: number } {
  const seen = new Set(current.filter(r => r.email).map(r => r.email.toLowerCase()));
  const seenPhones = new Set(current.map(r => normalizePhone(r.phone)).filter(Boolean));
  const rows = [...current];
  let ignored = 0;
  for (const r of incoming) {
    const key = r.email.toLowerCase();
    const phoneKey = normalizePhone(r.phone);
    if ((r.email && seen.has(key)) || (phoneKey && seenPhones.has(phoneKey))) { ignored++; continue; }
    if (r.email) seen.add(key);
    if (phoneKey) seenPhones.add(phoneKey);
    rows.push(r);
  }
  return { rows, ignored };
}
