// Envia o e-mail de convite (via Brevo) para os participantes de uma
// campanha com lista que ainda não foram convidados. Ação de admin —
// chamada pelo botão "Enviar convites" no CampaignModal.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { requireAdmin } from "../_shared/require-admin.ts";
import { emailSubject, renderEmailHtml, type EmailSettings } from "../_shared/email-template.ts";
import { sendTransactionalEmail } from "../_shared/brevo-send.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const SITE_URL = (Deno.env.get("PUBLIC_SITE_URL") || "https://roleta-kivid.pages.dev").replace(/\/+$/, "");
const LOGO_URL = `${SITE_URL}/kivid-logo.svg`;

// Um lote por chamada — evita estourar o tempo da function em listas grandes.
// O admin pode clicar de novo pra continuar (a resposta informa quantos faltam).
const BATCH_SIZE = 150;

const BodySchema = z.object({ campaign_id: z.string().uuid() });

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
    const { campaign_id } = parsed.data;

    const { data: campaign } = await supabase
      .from("campaigns")
      .select("id, name, slug, has_participant_list")
      .eq("id", campaign_id)
      .maybeSingle();
    if (!campaign) {
      return new Response(JSON.stringify({ error: "campaign_not_found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!campaign.has_participant_list) {
      return new Response(JSON.stringify({ error: "not_a_list_campaign" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settingsRow } = await supabase.from("email_settings").select("*").eq("id", true).maybeSingle();
    const settings = settingsRow as unknown as EmailSettings | null;
    if (!settings || !settings.sender_email) {
      return new Response(JSON.stringify({ error: "email_settings_not_configured" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sender = { name: settings.sender_name || "Kivid", email: settings.sender_email };

    const { data: pending, count } = await supabase
      .from("campaign_participants")
      .select("id, name, email, unique_token", { count: "exact" })
      .eq("campaign_id", campaign_id)
      .is("invited_at", null)
      .eq("played", false) // quem já jogou não precisa de convite
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    const rows = pending ?? [];
    let sent = 0, errors = 0;

    for (const p of rows) {
      if (!p.email || !p.unique_token) { errors++; continue; }
      const inviteUrl = `${SITE_URL}/${campaign.slug}?token=${encodeURIComponent(p.unique_token)}`;
      const vars = { nome: p.name || "", campanha: campaign.name, email: p.email, inviteUrl };
      const subject = emailSubject("invite", settings, vars);
      const html = renderEmailHtml("invite", settings, vars, { logoUrl: LOGO_URL });
      const result = await sendTransactionalEmail({ to: { email: p.email, name: p.name || undefined }, sender, subject, html });
      if (result.ok) {
        sent++;
        await supabase.from("campaign_participants").update({ invited_at: new Date().toISOString() }).eq("id", p.id);
      } else {
        errors++;
        console.error("[send-invite-emails] failed", { participant_id: p.id, status: result.status, body: result.body });
      }
    }

    const remaining = Math.max(0, (count ?? rows.length) - rows.length);
    return new Response(JSON.stringify({ ok: true, sent, errors, remaining }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[send-invite-emails] fatal", e);
    return new Response(JSON.stringify({ error: String((e as { message?: string })?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
