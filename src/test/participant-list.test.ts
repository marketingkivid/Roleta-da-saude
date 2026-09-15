import { describe, it, expect } from 'vitest';
import { isInviteMember, hasInviteList, CAPTURED_SOURCE } from '@/lib/participant-list';

describe('isInviteMember', () => {
  it('trata sources de import do admin como membros de convite', () => {
    for (const s of ['Manual', 'Colado', 'Arquivo', 'Brevo: Lista X']) {
      expect(isInviteMember(s)).toBe(true);
    }
  });

  it('NÃO trata contato capturado pelo formulário público (roleta aberta) como convite', () => {
    expect(isInviteMember(CAPTURED_SOURCE)).toBe(false);
    expect(isInviteMember('Roleta')).toBe(false);
  });

  it('source vazio/nulo não é convite (seguro por padrão)', () => {
    expect(isInviteMember(undefined)).toBe(true); // sem source conhecido, assume convite
    expect(isInviteMember(null)).toBe(true);
  });
});

describe('hasInviteList', () => {
  it('campanha aberta só com participantes orgânicos NÃO tem lista de convite', () => {
    const rows = Array.from({ length: 43 }, () => ({ source: 'Roleta', status: 'valid' }));
    expect(hasInviteList(rows)).toBe(false);
  });

  it('campanha com lista importada TEM lista de convite', () => {
    const rows = [
      { source: 'Colado', status: 'valid' },
      { source: 'Arquivo', status: 'valid' },
    ];
    expect(hasInviteList(rows)).toBe(true);
  });

  it('mistura: convite importado + participantes orgânicos => tem lista de convite', () => {
    const rows = [
      { source: 'Roleta', status: 'valid' },
      { source: 'Manual', status: 'valid' },
    ];
    expect(hasInviteList(rows)).toBe(true);
  });

  it('linhas inválidas de import não contam', () => {
    const rows = [{ source: 'Colado', status: 'invalid' }];
    expect(hasInviteList(rows)).toBe(false);
  });

  it('lista vazia => sem lista de convite', () => {
    expect(hasInviteList([])).toBe(false);
  });
});
