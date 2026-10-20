export interface PrizeEmailValues {
  email_prize_name: string;
  email_subject: string;
  email_title: string;
  email_block_title: string;
  email_instructions: string;
  email_button_text: string;
  email_button_url: string;
}

export const EMPTY_PRIZE_EMAIL: PrizeEmailValues = {
  email_prize_name: '',
  email_subject: '',
  email_title: '',
  email_block_title: '',
  email_instructions: '',
  email_button_text: '',
  email_button_url: '',
};

export const PRIZE_EMAIL_KEYS = Object.keys(EMPTY_PRIZE_EMAIL) as (keyof PrizeEmailValues)[];

export const pickPrizeEmail = (src: Partial<PrizeEmailValues> | null | undefined): PrizeEmailValues => ({
  email_prize_name: src?.email_prize_name ?? '',
  email_subject: src?.email_subject ?? '',
  email_title: src?.email_title ?? '',
  email_block_title: src?.email_block_title ?? '',
  email_instructions: src?.email_instructions ?? '',
  email_button_text: src?.email_button_text ?? '',
  email_button_url: src?.email_button_url ?? '',
});

export const isPrizeEmailCustomized = (v: Partial<PrizeEmailValues> | null | undefined) =>
  PRIZE_EMAIL_KEYS.some(k => !!(v?.[k] ?? '').trim());

export const isValidEmailUrl = (url: string) => !url.trim() || /^https?:\/\//i.test(url.trim());

export interface PrizeEmailDefaults {
  prize_subject?: string;
  prize_title?: string;
  contact_block_title?: string;
  contact_block_text?: string;
}
