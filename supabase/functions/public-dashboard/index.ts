// Painel público (link interno) — devolve SOMENTE números agregados.
// Nenhum dado pessoal (nome, e-mail, telefone) sai daqui.
//
// Acesso: header `x-panel-code` deve bater com a env `PANEL_ACCESS_CODE`
// (configurar em Supabase → Project Settings → Edge Functions → Secrets).
// Sem code correto → 401. Sem env configurada → 503 (fail-closed).

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const PANEL_CODE = Deno.env.get("PANEL_ACCESS_CODE") ?? "";
const BASE_PRICE = 14.90;

const BodySchema = z.object({
  period: z.enum(["today", "week", "all"]).default("week"),
  campaign_id: z.string().uuid().nullable().optional(),
});

const HEADERS = {
  ...corsHeaders,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-panel-code",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...HEADERS, "Content-Type": "application/json" },
  });

function sinceDate(period: string): Date | null {
  const d = new Date();
  if (period === "today") { d.setHours(0, 0, 0, 0); return d; }
  if (period === "week") { d.setDate(d.getDate() - 7); d.setHours(0, 0, 0, 0); return d; }
  return null;
}

function pctChange(cur: number, prev: number): string {
  if (prev <= 0) return cur > 0 ? "+100%" : "—";
  const delta = ((cur - prev) / prev) * 100;
  if (Math.abs(delta) < 0.5) return "—";
  const r = Math.round(delta);
  return `${r > 0 ? "+" : ""}${r}%`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: HEADERS });

  if (!PANEL_CODE) return json({ error: "panel_not_configured" }, 503);

  const code = req.headers.get("x-panel-code") ?? "";
  // Comparação em tempo constante para não vazar o código por timing.
  if (code.length !== PANEL_CODE.length || !timingSafeEqual(code, PANEL_CODE)) {
    return json({ error: "invalid_code" }, 401);
  }

  try {
    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "bad_request" }, 400);
    const { period } = parsed.data;
    const campaignId = parsed.data.campaign_id ?? null;
    const cf = !!campaignId;

    const since = sinceDate(period);
    const sinceISO = since ? since.toISOString() : null;
    const prevRange = since ? { from: new Date(since.getTime() - (Date.now() - since.getTime())), to: since } : null;

    // Campanhas + contagem de participantes
    const { data: camps } = await supabase
      .from("campaigns")
      .select("id, name, slug, active, start_date, end_date, discount_percentage")
      .order("created_at", { ascending: false });

    const campaigns = await Promise.all((camps ?? []).map(async (c) => {
      const { count } = await supabase
        .from("campaign_participants")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", c.id);
      return {
        id: c.id, name: c.name, slug: c.slug, active: c.active,
        start_date: c.start_date, end_date: c.end_date,
        participants: count ?? 0,
      };
    }));

    // Leads (total + período + período anterior)
    let leadsTotalQ = supabase.from("campaign_participants").select("*", { count: "exact", head: true });
    if (cf) leadsTotalQ = leadsTotalQ.eq("campaign_id", campaignId!);
    let leadsPeriodQ = supabase.from("campaign_participants").select("*", { count: "exact", head: true });
    if (cf) leadsPeriodQ = leadsPeriodQ.eq("campaign_id", campaignId!);
    if (sinceISO) leadsPeriodQ = leadsPeriodQ.gte("created_at", sinceISO);
    let leadsPrevQ = supabase.from("campaign_participants").select("*", { count: "exact", head: true });
    if (cf) leadsPrevQ = leadsPrevQ.eq("campaign_id", campaignId!);
    const leadsPrevP = prevRange
      ? leadsPrevQ.gte("created_at", prevRange.from.toISOString()).lt("created_at", prevRange.to.toISOString())
      : Promise.resolve({ count: null });

    // Participações (giros) — datas para os gráficos + contagens
    let playsPeriodQ = supabase.from("participations").select("played_at, prize_id");
    if (cf) playsPeriodQ = playsPeriodQ.eq("campaign_id", campaignId!);
    if (sinceISO) playsPeriodQ = playsPeriodQ.gte("played_at", sinceISO);
    let playsPrevQ = supabase.from("participations").select("*", { count: "exact", head: true });
    if (cf) playsPrevQ = playsPrevQ.eq("campaign_id", campaignId!);
    const playsPrevP = prevRange
      ? playsPrevQ.gte("played_at", prevRange.from.toISOString()).lt("played_at", prevRange.to.toISOString())
      : Promise.resolve({ count: null });

    // Prêmios (nome + checkout) para distribuição e receita
    let prizesQ = supabase.from("prizes").select("id, name, checkout_url, campaign_id, is_consolation");
    if (cf) prizesQ = prizesQ.eq("campaign_id", campaignId!);

    // Distribuição por prêmio (todas as participações, sem filtro de data)
    let distQ = supabase.from("participations").select("prize_id");
    if (cf) distQ = distQ.eq("campaign_id", campaignId!);

    const [
      leadsTotalRes, leadsPeriodRes, leadsPrevRes,
      playsPeriodRes, playsPrevRes, prizesRes, distRes,
    ] = await Promise.all([
      leadsTotalQ, leadsPeriodQ, leadsPrevP,
      playsPeriodQ, playsPrevP, prizesQ, distQ,
    ]);

    const prizes = prizesRes.data ?? [];
    const prizeMap: Record<string, { name: string; checkout: boolean; consolation: boolean }> =
      Object.fromEntries(prizes.map((p) => [p.id, {
        name: p.name, checkout: !!p.checkout_url, consolation: !!p.is_consolation,
      }]));
    const checkoutPrizeIds = new Set(prizes.filter((p) => p.checkout_url).map((p) => p.id));

    const playRows = playsPeriodRes.data ?? [];
    const curPlays = playRows.length;
    const prevPlays = playsPrevRes.count ?? null;

    const leadsTotal = leadsTotalRes.count ?? 0;
    const curLeadsPeriod = leadsPeriodRes.count ?? 0;
    const prevLeadsPeriod = leadsPrevRes.count ?? null;

    // Distribuição por prêmio (todas as participações da campanha/tudo)
    const distMap: Record<string, number> = {};
    (distRes.data ?? []).forEach((r) => {
      distMap[r.prize_id] = (distMap[r.prize_id] ?? 0) + 1;
    });
    const distribution = Object.entries(distMap)
      .map(([id, count]) => ({
        prize: prizeMap[id]?.name ?? "—",
        consolation: prizeMap[id]?.consolation ?? false,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    // Receita / conversão (período)
    const discountRow = cf
      ? camps?.find((c) => c.id === campaignId)
      : camps?.find((c) => c.active);
    const discount = Number(discountRow?.discount_percentage ?? 0);
    const unitPrice = BASE_PRICE * (1 - discount / 100);
    const curCheckouts = playRows.filter((r) => checkoutPrizeIds.has(r.prize_id)).length;
    const revenue = curCheckouts * unitPrice;
    const conversion = curLeadsPeriod > 0 ? Math.round((curCheckouts / curLeadsPeriod) * 1000) / 10 : 0;

    // Séries diária e por hora
    const days = period === "today" ? 1 : period === "week" ? 7 : 30;
    const dailyMap: Record<string, number> = {};
    playRows.forEach((r) => {
      const k = new Date(r.played_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      dailyMap[k] = (dailyMap[k] ?? 0) + 1;
    });
    const daily: { date: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      daily.push({ date: k, count: dailyMap[k] ?? 0 });
    }
    const hourlyMap: Record<number, number> = {};
    playRows.forEach((r) => {
      const h = new Date(r.played_at).getHours();
      hourlyMap[h] = (hourlyMap[h] ?? 0) + 1;
    });
    const hourly = Array.from({ length: 24 }, (_, i) => ({
      hour: `${String(i).padStart(2, "0")}h`,
      count: hourlyMap[i] ?? 0,
    }));

    const hasPrev = prevRange !== null;
    const playsChange = hasPrev ? pctChange(curPlays, prevPlays ?? 0) : "—";
    const leadsChange = hasPrev ? pctChange(curLeadsPeriod, prevLeadsPeriod ?? 0) : "—";
    const curConv = curLeadsPeriod > 0 ? curPlays / curLeadsPeriod : 0;
    const prevConv = (prevLeadsPeriod ?? 0) > 0 ? (prevPlays ?? 0) / (prevLeadsPeriod ?? 1) : 0;
    const conversionChange = hasPrev ? pctChange(Math.round(curConv * 1000), Math.round(prevConv * 1000)) : "—";

    return json({
      generatedAt: new Date().toISOString(),
      period,
      campaigns,
      kpis: {
        revenue, revenueChange: playsChange,
        leads: leadsTotal, leadsChange,
        spins: curPlays, spinsChange: playsChange,
        conversion, conversionChange,
      },
      daily,
      hourly,
      distribution,
    });
  } catch (e) {
    console.error("[public-dashboard] error", e);
    return json({ error: "internal" }, 500);
  }
});

// Comparação de strings em tempo constante.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
