// Prévia dos e-mails de prêmio/convite para o admin (tela Personalização).
// Renderiza com o MESMO código que envia de verdade (_shared/email-template.ts)
// e dados de exemplo — nunca envia nada, só devolve { subject, html }.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { requireAdmin } from "../_shared/require-admin.ts";
import { emailSubject, renderEmailHtml, type EmailSettings, type EmailKind } from "../_shared/email-template.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const SITE_URL = (Deno.env.get("PUBLIC_SITE_URL") || "https://roleta-kivid.pages.dev").replace(/\/+$/, "");
const LOGO_URL = `${SITE_URL}/kivid-logo.svg`;

const BodySchema = z.object({ kind: z.enum(["prize_coupon", "prize_physical", "invite"]) });

const SAMPLE_VARS = {
  nome: "Igor",
  campanha: "Campanha de Exemplo",
  premio: "Passaporte Kivid",
  email: "igor.exemplo@kivid.com.br",
  checkoutUrl: "#",
  inviteUrl: "#",
  premioImagem: "",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = await requireAdmin(req);
    if (!admin.ok) {
      return new Response(JSON.stringify({ error: admin.error }), {
        status: admin.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const kind = parsed.data.kind as EmailKind;

    const { data: settingsRow } = await supabase.from("email_settings").select("*").eq("id", true).maybeSingle();
    if (!settingsRow) {
      return new Response(JSON.stringify({ error: "email_settings_not_configured" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const settings = settingsRow as unknown as EmailSettings;

    const subject = emailSubject(kind, settings, SAMPLE_VARS);
    const html = renderEmailHtml(kind, settings, SAMPLE_VARS, { logoUrl: LOGO_URL });

    return new Response(JSON.stringify({ subject, html }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[preview-email] fatal", e);
    return new Response(JSON.stringify({ error: String((e as { message?: string })?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
