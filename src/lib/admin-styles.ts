import React from 'react';

export const FONT: React.CSSProperties = { fontFamily: 'Nunito, sans-serif' };

export const CARD: React.CSSProperties = {
  background: '#FFFFFF',
  borderRadius: 20,
  border: '0.5px solid #E8E0EE',
  padding: 20,
};

export const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1.5px solid #E8E0EE',
  borderRadius: 20,
  padding: '13px 16px',
  fontSize: 16,
  ...FONT,
  background: '#FFFFFF',
  color: '#1A1A2E',
  outline: 'none',
};

export const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 400,
  color: '#9B8FAE',
  marginBottom: 6,
  ...FONT,
};

export const helperStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#9B8FAE',
  marginTop: 4,
  ...FONT,
};

export const focusHandler = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
  (e.target.style.borderColor = '#E8357A');

export const blurHandler = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
  (e.target.style.borderColor = '#E8E0EE');

export const generateSlug = (name: string): string => {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
};
