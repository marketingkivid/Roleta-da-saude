// Template dos e-mails transacionais (prêmio + convite) enviados via Brevo.
// Usado por send-prize-email (dentro de spin-roulette), send-invite-emails
// e preview-email (prévia do admin) — TODOS usam este MESMO renderizador,
// então o que o admin vê na prévia é exatamente o que é enviado.
//
// Layout em <table> (não <div>) de propósito: é o padrão que os clientes de
// e-mail (Outlook em especial) renderizam de forma confiável.
//
// As duas variantes (prêmio e convite) compartilham a MESMA estrutura visual:
// logo → emoji → título → subtítulo → (imagem do prêmio, se tiver) →
// parágrafo → botão (opcional) → linha pequena (opcional) → divisor →
// parágrafo de rodapé → "Kivid".

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
  consolation_enabled?: boolean;
  consolation_subject?: string;
  consolation_title?: string;
  consolation_body?: string;
  consolation_button_text?: string;
  consolation_button_url?: string;
}

export type EmailKind = "prize_coupon" | "prize_physical" | "invite" | "consolation";

export interface EmailVars {
  nome: string;
  campanha: string;
  premio?: string;
  email?: string;
  checkoutUrl?: string;
  inviteUrl?: string;
  premioImagem?: string;
  /** Instruções de resgate deste prêmio (substitui o texto padrão de Personalização). */
  instrucoes?: string;
  /** Texto do botão deste prêmio (padrão: "Resgatar meu prêmio"). */
  botaoTexto?: string;
  /** Overrides por prêmio (vazio = padrão de Personalização). */
  assunto?: string;
  titulo?: string;
  tituloBloco?: string;
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
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function multiline(escaped: string): string {
  return escaped.replace(/\r?\n/g, "<br/>");
}

function shell(opts: {
  logoUrl: string; emoji: string; title: string; subtitle: string;
  imageBlock: string; bodyHtml: string; buttonHtml: string; smallLineHtml: string; footerHtml: string;
}): string {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kivid</title></head>
<body style="margin:0;padding:0;background-color:#F5F3F7;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F3F7;padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;width:100%;background-color:#FFFFFF;border-radius:24px;overflow:hidden;">
  <tr><td align="center" style="padding:40px 32px 0;">
    <img src="${esc(opts.logoUrl)}" alt="Kivid" width="120" style="display:block;width:120px;max-width:120px;height:auto;border:0;margin:0 auto;" />
  </td></tr>
  <tr><td align="center" style="padding:16px 32px 0;">
    <div style="font-size:40px;line-height:1;">${opts.emoji}</div>
  </td></tr>
  <tr><td align="center" style="padding:10px 32px 0;">
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:800;color:#1A1A2E;line-height:1.25;">${esc(opts.title)}</h1>
    <p style="margin:0;font-size:14px;color:#9B8FAE;">${esc(opts.subtitle)}</p>
  </td></tr>
  ${opts.imageBlock}
  <tr><td align="center" style="padding:22px 32px 0;">
    <p style="margin:0;font-size:15px;line-height:1.5;color:#3A3A4A;">${opts.bodyHtml}</p>
  </td></tr>
  ${opts.buttonHtml}
  ${opts.smallLineHtml}
  <tr><td style="padding:28px 32px 0;"><div style="height:1px;background-color:#F0EAF5;line-height:1px;">&nbsp;</div></td></tr>
  <tr><td align="center" style="padding:18px 32px 36px;">
    <p style="margin:0;font-size:12px;line-height:1.5;color:#9B8FAE;">${opts.footerHtml}</p>
    <p style="margin:10px 0 0;font-size:12px;color:#C9BFE0;">Kivid</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

const BTN = (href: string, label: string) => `<tr><td align="center" style="padding:22px 32px 0;">
    <a href="${esc(href)}" style="display:inline-block;background-color:#E8357A;color:#FFFFFF;text-decoration:none;font-weight:800;font-size:15px;border-radius:999px;padding:14px 32px;">${esc(label)}</a>
  </td></tr>`;

export function emailSubject(kind: EmailKind, settings: EmailSettings, vars: EmailVars): string {
  const raw = kind === "invite"
    ? settings.invite_subject
    : kind === "consolation"
      ? (settings.consolation_subject || "")
      : (vars.assunto || "").trim() || settings.prize_subject;
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
      ? `<tr><td align="center" style="padding:14px 32px 0;"><p style="margin:0;font-size:12px;color:#9B8FAE;">Na página, digite este e-mail para entrar: <a href="mailto:${esc(vars.email)}" style="color:#E8357A;">${esc(vars.email)}</a></p></td></tr>`
      : "";
    const footerHtml = `Você recebeu este e-mail porque está na lista de convidados da campanha <strong>${esc(vars.campanha)}</strong>. Se não esperava este e-mail, pode ignorá-lo.`;
    return shell({ logoUrl: opts.logoUrl, emoji: "🎉", title, subtitle, imageBlock: "", bodyHtml, buttonHtml, smallLineHtml, footerHtml });
  }

  if (kind === "consolation") {
    const title = fill(settings.consolation_title || "", vars);
    const bodyHtml = multiline(esc(fill(settings.consolation_body || "", vars)));
    const url = (settings.consolation_button_url || "").trim();
    const buttonHtml = url ? BTN(url, (settings.consolation_button_text || "").trim() || "Saiba mais") : "";
    const footerHtml = `Você recebeu este e-mail por participar da campanha <strong>${esc(vars.campanha)}</strong>.`;
    return shell({ logoUrl: opts.logoUrl, emoji: "🍀", title, subtitle: `Campanha ${vars.campanha}`, imageBlock: "", bodyHtml, buttonHtml, smallLineHtml: "", footerHtml });
  }

  // prize_coupon | prize_physical
  const title = fill((vars.titulo || "").trim() || settings.prize_title, vars);
  const subtitle = vars.premio ? `Você ganhou: ${vars.premio}` : `Campanha ${vars.campanha}`;
  const customInstructions = (vars.instrucoes || "").trim();
  const customBlockTitle = (vars.tituloBloco || "").trim();
  const contactTitle = fill(customBlockTitle || (customInstructions ? "" : settings.contact_block_title), vars);
  const contactText = fill(customInstructions || settings.contact_block_text, vars);
  const bodyHtml = contactTitle
    ? `<strong style="color:#1A1A2E;">${esc(contactTitle)}</strong><br/>${multiline(esc(contactText))}`
    : multiline(esc(contactText));
  const buttonHtml = kind === "prize_coupon" && vars.checkoutUrl
    ? BTN(vars.checkoutUrl, (vars.botaoTexto || "").trim() || "Resgatar meu prêmio")
    : "";
  const smallLineHtml = settings.whatsapp_oficial
    ? `<tr><td align="center" style="padding:14px 32px 0;"><p style="margin:0;font-size:12px;color:#9B8FAE;">WhatsApp oficial: <strong>${esc(settings.whatsapp_oficial)}</strong></p></td></tr>`
    : "";
  const footerHtml = esc(fill(settings.antifraud_notice, vars));
  const imageBlock = vars.premioImagem
    ? `<tr><td align="center" style="padding:20px 32px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background-color:#FDF0F5;border-radius:16px;">
          <tr><td style="padding:18px;">
            <img src="${esc(vars.premioImagem)}" alt="${esc(vars.premio || "")}" width="180" style="display:block;max-width:180px;width:100%;height:auto;border:0;margin:0 auto;" />
          </td></tr>
        </table>
      </td></tr>`
    : "";
  return shell({ logoUrl: opts.logoUrl, emoji: "🎁", title, subtitle, imageBlock, bodyHtml, buttonHtml, smallLineHtml, footerHtml });
}
