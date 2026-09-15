import * as XLSX from 'xlsx';

export interface SheetResult {
  rows: Record<string, unknown>[];
  sheetCount: number;
  sheetName: string;
}

// Lê a PRIMEIRA aba de um .xlsx/.xls no navegador.
export async function readSpreadsheet(file: File): Promise<SheetResult> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], { defval: '' });
  return { rows, sheetCount: wb.SheetNames.length, sheetName };
}

export const isSpreadsheetFile = (name: string) => /\.(xlsx|xls)$/i.test(name);
