// Impressão digital leve do dispositivo/navegador — usada para blindar o giro
// único: mesmo navegador não gira 2× na mesma campanha, nem limpando o
// localStorage, nem trocando de e-mail/conta.
//
// Não é rastreamento entre sites: o valor só é enviado para a nossa edge
// function `spin-roulette` e guardado em `campaign_spins.device_id`.
// Sem dependência externa (evita libras com licença restritiva).

let cached: string | null = null;
let pending: Promise<string> | null = null;

const STORAGE_KEY = 'kivid_device';

async function sha256Hex(input: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback simples (djb2) se WebCrypto não estiver disponível.
    let h = 5381;
    for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
    return h.toString(16);
  }
}

function canvasSignature(): string {
  try {
    const c = document.createElement('canvas');
    c.width = 240; c.height = 60;
    const ctx = c.getContext('2d');
    if (!ctx) return '';
    ctx.textBaseline = 'top';
    ctx.font = "16px 'Arial'";
    ctx.fillStyle = '#f60';
    ctx.fillRect(2, 2, 120, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Kivid roleta \u{1F340}', 4, 4);
    ctx.fillStyle = 'rgba(102,204,0,0.7)';
    ctx.fillText('Kivid roleta \u{1F340}', 6, 6);
    return c.toDataURL();
  } catch {
    return '';
  }
}

function webglSignature(): string {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl') || c.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return '';
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
    const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return `${vendor}~${renderer}`;
  } catch {
    return '';
  }
}

function rawSignals(): string {
  const n = navigator as Navigator & { deviceMemory?: number; hardwareConcurrency?: number };
  const s = window.screen;
  const parts = [
    n.userAgent,
    (n.languages || [n.language]).join(','),
    `${s.width}x${s.height}x${s.colorDepth}`,
    (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ''; } })(),
    String(n.hardwareConcurrency ?? ''),
    String(n.deviceMemory ?? ''),
    (n as unknown as { platform?: string }).platform ?? '',
    String(new Date().getTimezoneOffset()),
    canvasSignature(),
    webglSignature(),
  ];
  return parts.join('|');
}

/**
 * ID estável do dispositivo. Recalculável (não depende do localStorage para
 * existir — o localStorage é só cache). Limpar o navegador → recalcula o mesmo
 * valor → o servidor continua bloqueando.
 */
export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored.length === 64) { cached = stored; return stored; }
  } catch { /* noop */ }

  if (!pending) {
    pending = sha256Hex(rawSignals())
      .then((id) => {
        cached = id;
        try { localStorage.setItem(STORAGE_KEY, id); } catch { /* noop */ }
        return id;
      })
      .catch(() => {
        // Último recurso: uuid persistido (fraco, mas melhor que nada).
        let fb: string;
        try {
          fb = localStorage.getItem('kivid_device_fb') || crypto.randomUUID();
          localStorage.setItem('kivid_device_fb', fb);
        } catch {
          fb = crypto.randomUUID();
        }
        cached = fb;
        return fb;
      });
  }
  return pending;
}
