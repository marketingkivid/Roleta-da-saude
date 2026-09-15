import { describe, it, expect } from 'vitest';
import {
  validateRow, parsePastedText, mapSheetRows, mapBrevoContacts,
  mergeRows, checkSheetHeaders, normalizePhone, matchesFilter, type ParsedRow,
} from '@/lib/participant-parsers';

describe('normalizePhone', () => {
  it('remove o 55 do Brasil quando sobra número plausível', () => {
    expect(normalizePhone('5571991265102')).toBe('71991265102');
    expect(normalizePhone('+55 (71) 99126-5102')).toBe('71991265102');
  });
  it('não remove 55 de número que ficaria curto demais (fixo com DDD 55...)', () => {
    expect(normalizePhone('5533334444')).toBe('5533334444');
  });
  it('sem 55, só limpa', () => {
    expect(normalizePhone('(71) 99126-5102')).toBe('71991265102');
  });
});

describe('mergeRows por telefone', () => {
  it('ignora quem repete telefone mesmo com e-mail diferente', () => {
    const base: ParsedRow[] = [{ name: 'Igor', email: 'a@x.com', phone: '71991265102', status: 'valid' }];
    const { rows, ignored } = mergeRows(base, [
      { name: 'Igor de Oliveira', email: 'b@x.com', phone: '5571991265102', status: 'valid' },
    ]);
    expect(rows).toHaveLength(1);
    expect(ignored).toBe(1);
  });
  it('telefone vazio não deduplica', () => {
    const base: ParsedRow[] = [{ name: 'A', email: 'a@x.com', phone: '', status: 'invalid', reason: 'Telefone inválido (10-13 dígitos)' }];
    const { rows } = mergeRows(base, [{ name: 'B', email: 'b@x.com', phone: '', status: 'invalid', reason: 'Telefone inválido (10-13 dígitos)' }]);
    expect(rows).toHaveLength(2);
  });
});

describe('matchesFilter', () => {
  const row: ParsedRow = { name: 'Katherine Maltez', email: 'ketty@gmail.com', phone: '5571996251403', status: 'valid' };
  it('acha por nome, e-mail e telefone, caso-insensível', () => {
    expect(matchesFilter(row, 'kather')).toBe(true);
    expect(matchesFilter(row, 'KETTY')).toBe(true);
    expect(matchesFilter(row, '99625')).toBe(true);
    expect(matchesFilter(row, 'zzz')).toBe(false);
  });
  it('query vazia passa tudo', () => { expect(matchesFilter(row, '')).toBe(true); });
});

describe('validateRow', () => {
  it('aceita linha completa', () => {
    expect(validateRow('Maria', 'maria@email.com', '5511999998888').status).toBe('valid');
  });
  it('rejeita nome vazio, email e telefone inválidos', () => {
    expect(validateRow('', 'a@b.com', '5511999998888').reason).toBe('Nome vazio');
    expect(validateRow('Ana', 'sem-arroba', '5511999998888').reason).toBe('Email inválido');
    expect(validateRow('Ana', 'a@b.com', '123').reason).toContain('Telefone inválido');
  });
});

describe('parsePastedText', () => {
  it('parseia TSV de 3 colunas (nome, email, telefone)', () => {
    const rows = parsePastedText('Maria Silva\tmaria@email.com\t5511999998888');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'Maria Silva', email: 'maria@email.com', phone: '5511999998888', status: 'valid', source: 'Colado' });
  });
  it('parseia 4 colunas (nome, sobrenome, email, telefone) detectando o email pela posição', () => {
    const rows = parsePastedText('Maria\tSilva\tmaria@email.com\t5511999998888');
    expect(rows[0].name).toBe('Maria Silva');
    expect(rows[0].email).toBe('maria@email.com');
  });
  it('descarta linha de cabeçalho automaticamente', () => {
    const rows = parsePastedText('Nome\tEmail\tTelefone\nMaria\tmaria@email.com\t5511999998888');
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Maria');
  });
  it('aceita ponto-e-vírgula e vírgula como reserva', () => {
    expect(parsePastedText('Maria;maria@email.com;5511999998888')[0].status).toBe('valid');
    expect(parsePastedText('Maria,maria@email.com,5511999998888')[0].status).toBe('valid');
  });
  it('linha que não parseia vira pendência, sem derrubar as demais', () => {
    const rows = parsePastedText('lixo sem separador\nMaria\tmaria@email.com\t5511999998888');
    expect(rows).toHaveLength(2);
    expect(rows.filter(r => r.status === 'valid')).toHaveLength(1);
  });
  it('ignora linhas vazias', () => {
    expect(parsePastedText('\n\nMaria\tmaria@email.com\t5511999998888\n\n')).toHaveLength(1);
  });
});

describe('mapSheetRows', () => {
  it('mapeia FIRSTNAME/LASTNAME/EMAIL/WHATSAPP', () => {
    const rows = mapSheetRows([{ FIRSTNAME: 'Maria', LASTNAME: 'Silva', EMAIL: 'maria@email.com', WHATSAPP: 5511999998888 }]);
    expect(rows[0]).toMatchObject({ name: 'Maria Silva', email: 'maria@email.com', phone: '5511999998888', status: 'valid' });
  });
  it('mapeia NOME/Email/Telefone e números do Excel viram string sem notação científica', () => {
    const rows = mapSheetRows([{ NOME: 'João', Email: 'joao@email.com', Telefone: 5521988887777 }]);
    expect(rows[0].phone).toBe('5521988887777');
  });
});

describe('checkSheetHeaders', () => {
  it('aponta colunas faltando', () => {
    const r = checkSheetHeaders([{ FIRSTNAME: 'a', LASTNAME: 'b' }]);
    expect(r.ok).toBe(false);
    expect(r.missing).toContain('EMAIL');
  });
  it('ok com colunas em português', () => {
    expect(checkSheetHeaders([{ NOME: 'a', EMAIL: 'b', TELEFONE: 'c' }]).ok).toBe(true);
  });
});

describe('mapBrevoContacts', () => {
  it('monta nome de FIRSTNAME+LASTNAME e telefone de WHATSAPP/SMS', () => {
    const rows = mapBrevoContacts([
      { email: 'maria@email.com', attributes: { FIRSTNAME: 'Maria', LASTNAME: 'Silva', WHATSAPP: '+5511999998888' } },
      { email: 'joao@email.com', attributes: { NOME: 'João', SMS: '+5521988887777' } },
    ], 'Clientes VIP');
    expect(rows[0]).toMatchObject({ name: 'Maria Silva', phone: '5511999998888', status: 'valid', source: 'Brevo: Clientes VIP' });
    expect(rows[1].name).toBe('João');
  });
  it('contato sem email ou telefone vira pendência, não some', () => {
    const rows = mapBrevoContacts([{ email: '', attributes: { FIRSTNAME: 'X' } }], 'L');
    expect(rows[0].status).toBe('invalid');
  });
});

describe('mergeRows', () => {
  const base: ParsedRow[] = [{ name: 'Maria', email: 'maria@email.com', phone: '5511999998888', status: 'valid', source: 'Manual' }];
  it('soma novos e ignora e-mail repetido (case-insensitive)', () => {
    const { rows, ignored } = mergeRows(base, [
      { name: 'Maria 2', email: 'MARIA@email.com', phone: '5511999998888', status: 'valid', source: 'Colado' },
      { name: 'Ana', email: 'ana@email.com', phone: '5511999997777', status: 'valid', source: 'Colado' },
    ]);
    expect(rows).toHaveLength(2);
    expect(ignored).toBe(1);
  });
  it('pendência sem e-mail entra sem deduplicar', () => {
    const { rows } = mergeRows(base, [{ name: 'X', email: '', phone: '', status: 'invalid', reason: 'Email inválido' }]);
    expect(rows).toHaveLength(2);
  });
});
