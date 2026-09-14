// Envio de e-mail transacional via Brevo (/v3/smtp/email). Precisa da MESMA
// BREVO_API_KEY já usada em sync-lead-brevo, com a permissão "Transactional
// emails" habilitada na conta Brevo (é uma permissão separada de Contacts —
// confira em Brevo > Configurações > Chaves de API).

const BREVO_API = "https://api.brevo.com/v3";
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;

export interface SendEmailInput {
  to: { email: string; name?: string };
  sender: { email: string; name: string };
  subject: string;
  html: string;
}

export async function sendTransactionalEmail(input: SendEmailInput): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(`${BREVO_API}/smtp/email`, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "api-key": BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: input.sender,
      to: [input.to],
      subject: input.subject,
      htmlContent: input.html,
    }),
  });
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: res.ok, status: res.status, body };
}
