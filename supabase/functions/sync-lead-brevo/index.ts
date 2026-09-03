import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const BREVO_API = "https://api.brevo.com/v3";
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;
const BREVO_LIST_ID = Number(Deno.env.get("BREVO_LIST_ID") || "0");

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const BodySchema = z.object({ leadId: z.string().uuid() });

type Lead = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  whatsapp_e164: string;
  whatsapp_raw: string;
  origem: string | null;
  campanha: string | null;
  pagina: string | null;
};

async function brevoFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BREVO_API}${path}`, {
    ...init,
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "api-key": BREVO_API_KEY,
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* keep text */ }
  return { ok: res.ok, status: res.status, body: json ?? text };
}

function attributesFor(lead: Lead) {
  return {
    NOME: lead.first_name,
    SOBRENOME: lead.last_name,
    SMS: lead.whatsapp_e164,
    WHATSAPP: lead.whatsapp_e164,
    ORIGEM: lead.origem || "site",
    CAMPANHA: lead.campanha || "",
    PAGINA: lead.pagina || "",
  };
}

export async function syncLead(leadId: string) {
  const { data: lead, error } = await supabase
    .from("leads").select("*").eq("id", leadId).maybeSingle();
  if (error || !lead) throw new Error(`lead not found: ${leadId}`);

  const payload = {
    email: lead.email,
    attributes: attributesFor(lead as Lead),
    listIds: BREVO_LIST_ID ? [BREVO_LIST_ID] : [],
    updateEnabled: true,
  };
  console.log("[brevo] create/update", { leadId, email: lead.email });

  let merged_by_phone = false;
  let contactId: string | number | null = null;

  let res = await brevoFetch("/contacts", { method: "POST", body: JSON.stringify(payload) });
  console.log("[brevo] response", { status: res.status, body: res.body });

  // duplicate phone -> try merge by phone
  if (!res.ok && res.status === 400 && typeof res.body === "object" && res.body?.code === "duplicate_parameter") {
    const phone = encodeURIComponent(lead.whatsapp_e164);
    const lookup = await brevoFetch(`/contacts/${phone}?identifierType=phone_id`);
    console.log("[brevo] phone lookup", { status: lookup.status });
    if (lookup.ok && typeof lookup.body === "object" && lookup.body?.id) {
      contactId = lookup.body.id;
      const putRes = await brevoFetch(`/contacts/${contactId}`, {
        method: "PUT",
        body: JSON.stringify({
          attributes: { ...attributesFor(lead as Lead), EMAIL: lead.email },
          listIds: BREVO_LIST_ID ? [BREVO_LIST_ID] : [],
        }),
      });
      console.log("[brevo] merge put", { status: putRes.status, body: putRes.body });
      if (!putRes.ok) {
        await markError(leadId, `merge_failed:${putRes.status}:${JSON.stringify(putRes.body)}`);
        return { ok: false, error: "merge_failed" };
      }
      merged_by_phone = true;
      res = putRes;
    } else {
      await markError(leadId, `duplicate_no_lookup:${JSON.stringify(res.body)}`);
      return { ok: false, error: "duplicate_no_lookup" };
    }
  } else if (!res.ok) {
    await markError(leadId, `brevo_${res.status}:${typeof res.body === "string" ? res.body : JSON.stringify(res.body)}`);
    return { ok: false, error: `brevo_${res.status}` };
  } else if (typeof res.body === "object" && res.body?.id) {
    contactId = res.body.id;
  }

  const { error: upErr } = await supabase.from("leads").update({
    brevo_sync_status: "synced",
    brevo_contact_id: contactId ? String(contactId) : null,
    brevo_last_sync_at: new Date().toISOString(),
    brevo_error: null,
    merged_by_phone,
  }).eq("id", leadId);
  if (upErr) console.error("[brevo] update lead failed", upErr);

  return { ok: true, contactId, merged_by_phone };
}

async function markError(leadId: string, msg: string) {
  await supabase.from("leads").update({
    brevo_sync_status: "error",
    brevo_error: msg.slice(0, 1000),
  }).eq("id", leadId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!BREVO_API_KEY || !BREVO_LIST_ID) {
      return new Response(JSON.stringify({ error: "Brevo env not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const result = await syncLead(parsed.data.leadId);
    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 422,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[sync-lead-brevo] fatal", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
