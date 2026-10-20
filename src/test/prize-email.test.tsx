import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PrizeEmailFields from '@/components/admin/PrizeEmailFields';
import { EMPTY_PRIZE_EMAIL, isPrizeEmailCustomized, isValidEmailUrl, pickPrizeEmail } from '@/lib/prize-email';

describe('prize-email helpers', () => {
  it('detecta personalização só com texto real', () => {
    expect(isPrizeEmailCustomized(EMPTY_PRIZE_EMAIL)).toBe(false);
    expect(isPrizeEmailCustomized({ ...EMPTY_PRIZE_EMAIL, email_title: '   ' })).toBe(false);
    expect(isPrizeEmailCustomized({ ...EMPTY_PRIZE_EMAIL, email_title: 'Olá' })).toBe(true);
    expect(isPrizeEmailCustomized(null)).toBe(false);
  });

  it('só aceita links http(s) ou vazio', () => {
    expect(isValidEmailUrl('')).toBe(true);
    expect(isValidEmailUrl('https://kivid.com.br/x')).toBe(true);
    expect(isValidEmailUrl('javascript:alert(1)')).toBe(false);
    expect(isValidEmailUrl('kivid.com.br')).toBe(false);
  });

  it('pickPrizeEmail preenche vazios', () => {
    expect(pickPrizeEmail(undefined)).toEqual(EMPTY_PRIZE_EMAIL);
  });
});

describe('PrizeEmailFields', () => {
  const setup = (over: Partial<typeof EMPTY_PRIZE_EMAIL> = {}, checkoutUrl = '') => {
    const onChange = vi.fn();
    render(<PrizeEmailFields values={{ ...EMPTY_PRIZE_EMAIL, ...over }} onChange={onChange} prizeName="Passaporte" checkoutUrl={checkoutUrl} redeemInstructions="Mostre na recepção" />);
    return onChange;
  };

  it('usa o nome do prêmio como placeholder e propaga mudanças', () => {
    const onChange = setup();
    const input = screen.getByPlaceholderText('Passaporte');
    fireEvent.change(input, { target: { value: 'Passaporte VIP' } });
    expect(onChange).toHaveBeenCalledWith('email_prize_name', 'Passaporte VIP');
  });

  it('avisa link inválido e informa quando não há botão', () => {
    setup({ email_button_url: 'javascript:x' });
    expect(screen.getByText(/precisa começar com http/i)).toBeTruthy();
  });

  it('sem link nem checkout, informa que sai sem botão', () => {
    setup();
    expect(screen.getByText(/sai sem botão/i)).toBeTruthy();
  });

  it('copia instruções da tela de resgate', () => {
    const onChange = setup();
    fireEvent.click(screen.getByText(/Copiar da tela de resgate/i));
    expect(onChange).toHaveBeenCalledWith('email_instructions', 'Mostre na recepção');
  });
});
