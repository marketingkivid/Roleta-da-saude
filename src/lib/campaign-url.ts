// Base pública das campanhas — segue o domínio em que o app está sendo servido
// (Cloudflare Pages / Netlify / Vercel / domínio próprio). Nada de URL fixa.
//
// Se um dia o admin rodar num domínio diferente do público, dá para fixar a
// base com a env `VITE_PUBLIC_URL` (ex.: "https://pipoqueganhe.com.br").

export function publicBaseUrl(): string {
  const env = import.meta.env.VITE_PUBLIC_URL as string | undefined;
  if (env && env.trim()) return env.trim().replace(/\/+$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return '';
}

/** URL pública completa de uma campanha: `<base>/<slug>` (+ `?token=` se houver). */
export function campaignUrl(slug: string, token?: string | null): string {
  const url = `${publicBaseUrl()}/${slug}`;
  return token ? `${url}?token=${encodeURIComponent(token)}` : url;
}

/** Mesma URL, sem `https://`, para exibir na tela. */
export function campaignUrlLabel(slug: string, token?: string | null): string {
  return campaignUrl(slug, token).replace(/^https?:\/\//, '');
}

/** Só o host da base pública (ex.: "roleta-kivid.pages.dev"), para prefixos de input. */
export function publicHost(): string {
  return publicBaseUrl().replace(/^https?:\/\//, '');
}
