// Template dos e-mails transacionais (prêmio + convite) enviados via Brevo.
// Usado por send-prize-email (dentro de spin-roulette), send-invite-emails
// e a prévia do admin — a prévia chama o MESMO renderizador, então o que se
// vê na prévia é exatamente o que é enviado.
//
// As duas variantes (prêmio e convite) compartilham a MESMA estrutura visual:
// logo → emoji → título → subtítulo → parágrafo → botão (opcional) → linha
// pequena (opcional) → divisor → parágrafo de rodapé → "Kivid".

export interface EmailSettings {
  whatsapp_oficial: string;
  sender_name: string;
  sender_email: string;
  prize_subject: string;
  prize_title: string;
  contact_block_title: string;
  contact_block_text: string;
  antifraud_notice: string;
  failure_alert_email: string;
  invite_subject: string;
  invite_title: string;
  invite_body: string;
  invite_button_text: string;
}

export type EmailKind = "prize_coupon" | "prize_physical" | "invite";

export interface EmailVars {
  nome: string;
  campanha: string;
  premio?: string;
  email?: string;
  checkoutUrl?: string;
  inviteUrl?: string;
}

function fill(text: string, vars: EmailVars): string {
  return (text || "")
    .split("{nome}").join(vars.nome || "")
    .split("{premio}").join(vars.premio || "")
    .split("{campanha}").join(vars.campanha || "");
}

function esc(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function shell(opts: {
  logoUrl: string; emoji: string; title: string; subtitle: string;
  bodyHtml: string; buttonHtml: string; smallLineHtml: string; footerHtml: string;
}): string {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kivid</title></head>
<body style="margin:0;padding:0;background:#F5F3F7;">
<div style="background:#F5F3F7;padding:40px 16px;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#FFFFFF;border-radius:24px;padding:40px 32px;text-align:center;">
    <img src="${esc(opts.logoUrl)}" alt="Kivid" width="120" style="display:block;margin:0 auto 20px;border:0;" />
    <div style="font-size:40px;line-height:1;margin-bottom:10px;">${opts.emoji}</div>
    <h1 style="font-size:22px;font-weight:800;color:#1A1A2E;margin:0 0 6px;">${esc(opts.title)}</h1>
    <p style="font-size:14px;color:#9B8FAE;margin:0 0 22px;">${esc(opts.subtitle)}</p>
    <p style="font-size:15px;color:#3A3A4A;line-height:1.5;margin:0 0 24px;">${opts.bodyHtml}</p>
    ${opts.buttonHtml}
    ${opts.smallLineHtml}
    <hr style="border:none;border-top:1px solid #F0EAF5;margin:28px 0 18px;" />
    <p style="font-size:12px;color:#9B8FAE;line-height:1.5;margin:0;">${opts.footerHtml}</p>
    <p style="font-size:12px;color:#C9BFE0;margin:10px 0 0;">Kivid</p>
  </div>
</div>
</body></html>`;
}

const BTN = (href: string, label: string) =>
  `<a href="${esc(href)}" style="display:inline-block;background:#E8357A;color:#FFFFFF;font-weight:800;font-size:15px;text-decoration:none;border-radius:999px;padding:14px 32px;margin-bottom:18px;">${esc(label)}</a>`;

export function emailSubject(kind: EmailKind, settings: EmailSettings, vars: EmailVars): string {
  const raw = kind === "invite" ? settings.invite_subject : settings.prize_subject;
  return fill(raw, vars);
}

export function renderEmailHtml(
  kind: EmailKind,
  settings: EmailSettings,
  vars: EmailVars,
  opts: { logoUrl: string },
): string {
  if (kind === "invite") {
    const title = fill(settings.invite_title, vars);
    const subtitle = `Campanha ${vars.campanha}`;
    const bodyHtml = esc(fill(settings.invite_body, vars));
    const buttonHtml = vars.inviteUrl ? BTN(vars.inviteUrl, settings.invite_button_text) : "";
    const smallLineHtml = vars.email
      ? `<p style="font-size:12px;color:#9B8FAE;margin:0 0 4px;">Na página, digite este e-mail para entrar: <a href="mailto:${esc(vars.email)}" style="color:#E8357A;">${esc(vars.email)}</a></p>`
      : "";
    const footerHtml = `Você recebeu este e-mail porque está na lista de convidados da campanha <strong>${esc(vars.campanha)}</strong>. Se não esperava este e-mail, pode ignorá-lo.`;
    return shell({ logoUrl: opts.logoUrl, emoji: "🎉", title, subtitle, bodyHtml, buttonHtml, smallLineHtml, footerHtml });
  }

  // prize_coupon | prize_physical
  const title = fill(settings.prize_title, vars);
  const subtitle = vars.premio ? `Você ganhou: ${vars.premio}` : `Campanha ${vars.campanha}`;
  const contactTitle = fill(settings.contact_block_title, vars);
  const contactText = fill(settings.contact_block_text, vars);
  const bodyHtml = contactTitle
    ? `<strong style="color:#1A1A2E;">${esc(contactTitle)}</strong><br/>${esc(contactText)}`
    : esc(contactText);
  const buttonHtml = kind === "prize_coupon" && vars.checkoutUrl ? BTN(vars.checkoutUrl, "Resgatar meu prêmio") : "";
  const smallLineHtml = settings.whatsapp_oficial
    ? `<p style="font-size:12px;color:#9B8FAE;margin:0 0 4px;">WhatsApp oficial: <strong>${esc(settings.whatsapp_oficial)}</strong></p>`
    : "";
  const footerHtml = esc(fill(settings.antifraud_notice, vars));
  return shell({ logoUrl: opts.logoUrl, emoji: "🎁", title, subtitle, bodyHtml, buttonHtml, smallLineHtml, footerHtml });
}
