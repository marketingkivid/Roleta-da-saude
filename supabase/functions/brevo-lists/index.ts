// Lista as listas de contato do Brevo e importa os contatos de uma delas —
// usado pela aba "Lista do Brevo" da importação de participantes. Admin-only:
// isso expõe a base de marketing inteira da conta.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { requireAdmin } from "../_shared/require-admin.ts";

const BREVO_API = "https://api.brevo.com/v3";
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;
const MAX_CONTACTS = 5000;
const PAGE = 500;

const BodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("lists") }),
  z.object({ action: z.literal("contacts"), listId: z.number().int().positive() }),
]);

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function brevoFetch(path: string) {
  const res = await fetch(`${BREVO_API}${path}`, {
    headers: { accept: "application/json", "api-key": BREVO_API_KEY },
  });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!BREVO_API_KEY) return json(500, { error: "Brevo env not configured" });

    const admin = await requireAdmin(req);
    if (!admin.ok) return json(admin.status, { error: admin.error });

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json(400, { error: parsed.error.flatten() });

    if (parsed.data.action === "lists") {
      const all: { id: number; name: string; totalSubscribers: number }[] = [];
      for (let offset = 0; offset < 500; offset += 50) {
        const res = await brevoFetch(`/contacts/lists?limit=50&offset=${offset}&sort=desc`);
        if (!res.ok) return json(502, { error: `brevo_${res.status}` });
        const body = res.body as { lists?: Array<{ id: number; name: string; uniqueSubscribers?: number; totalSubscribers?: number }> } | null;
        const lists = body?.lists ?? [];
        all.push(...lists.map((l) => ({
          id: l.id, name: l.name, totalSubscribers: l.uniqueSubscribers ?? l.totalSubscribers ?? 0,
        })));
        if (lists.length < 50) break;
      }
      return json(200, { lists: all });
    }

    // action === "contacts": pagina de 500 em 500 até o teto de 5.000
    const contacts: { email: string; attributes: Record<string, unknown> }[] = [];
    let total = 0;
    for (let offset = 0; offset < MAX_CONTACTS; offset += PAGE) {
      const res = await brevoFetch(`/contacts/lists/${parsed.data.listId}/contacts?limit=${PAGE}&offset=${offset}`);
      if (!res.ok) return json(502, { error: `brevo_${res.status}` });
      const body = res.body as { count?: number; contacts?: Array<{ email?: string; attributes?: Record<string, unknown> }> } | null;
      total = body?.count ?? total;
      const page = body?.contacts ?? [];
      contacts.push(...page.map((c) => ({ email: c.email ?? "", attributes: c.attributes ?? {} })));
      if (page.length < PAGE) break;
    }
    return json(200, { contacts, total, truncated: total > contacts.length });
  } catch (e) {
    console.error("[brevo-lists] fatal", e);
    return json(500, { error: String((e as { message?: string })?.message || e) });
  }
});
