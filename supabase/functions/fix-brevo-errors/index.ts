import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const FN_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/sync-lead-brevo`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const cutoff = new Date(Date.now() - 60_000).toISOString();
    const { data: leads, error } = await supabase
      .from("leads")
      .select("id")
      .in("brevo_sync_status", ["error", "pending"])
      .lt("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) throw error;

    let synced = 0, errors = 0;
    for (const l of leads ?? []) {
      try {
        const r = await fetch(FN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ leadId: l.id }),
        });
        const body = await r.json().catch(() => null);
        if (r.ok && body?.ok) synced++; else errors++;
      } catch (e) {
        console.error("[fix] lead failed", l.id, e);
        errors++;
      }
    }

    return new Response(JSON.stringify({ processed: leads?.length ?? 0, synced, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[fix-brevo-errors] fatal", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
