export function digitsOnly(s: string): string {
  return (s || "").replace(/\D+/g, "");
}

/** Brazilian mobile: accepts 10–11 digits (with DDD). Rejects all-equal sequences. */
export function isValidBRMobile(raw: string): boolean {
  const d = digitsOnly(raw);
  if (d.length < 10 || d.length > 11) return false;
  if (/^(\d)\1+$/.test(d)) return false;
  // DDD 11-99
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  return true;
}

/** Returns +55DDDNUMBER. Strips a leading 55 if present and length matches. */
export function toE164BR(raw: string): string {
  let d = digitsOnly(raw);
  if (d.length === 12 || d.length === 13) {
    if (d.startsWith("55")) d = d.slice(2);
  }
  return `+55${d}`;
}
