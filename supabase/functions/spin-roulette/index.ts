import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const BodySchema = z.object({
  campaign_id: z.string().uuid(),
  lead_ref: z.string().min(1).max(200),
  device_id: z.string().min(1).max(200).optional(),
  email: z.string().email().max(320).optional(),
});

/** IP do cliente a partir dos headers do edge runtime. */
function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  const raw = xff ? xff.split(",")[0].trim() : (req.headers.get("x-real-ip") ?? "").trim();
  return raw || null;
}

/**
 * Só usa o valor num filtro PostgREST `.or()` se for seguro (sem vírgula,
 * parênteses ou aspas que poderiam alterar a query). Nossos valores legítimos
 * (uuid, hash sha256, IP) passam; lixo de header é descartado.
 */
function safeForOr(v: string | null): string | null {
  return v && /^[A-Za-z0-9._:%-]{1,200}$/.test(v) ? v : null;
}

/** Resposta padrão "já girou": devolve o mesmo prêmio, sem sortear de novo. */
function alreadySpun(prev: PrizeRow, segments: WheelSegment[], corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({
      segmentIndex: pickSegmentIndex(segments, prev.id),
      totalSegments: segments.length,
      prize: prizePayload(prev),
      already_spun: true,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

type PrizeRow = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  image_url: string;
  checkout_url: string | null;
  redeem_instructions: string;
  is_consolation: boolean;
  color_token: string | null;
  display_order: number;
  weight: number;
  probability: number;
  quantity_available: number | null;
  quantity_distributed: number;
  active: boolean;
  created_at: string;
};

type WheelSegment = { id: string };

/**
 * Cryptographically-secure uniform float in [0, 1).
 * 53-bit mantissa built from two 32-bit ints for full double precision.
 */
function secureRandom(): number {
  const buf = new Uint32Array(2);
  crypto.getRandomValues(buf);
  const hi = buf[0] >>> 5;      // 27 bits
  const lo = buf[1] >>> 6;      // 26 bits
  return (hi * 2 ** 26 + lo) / 2 ** 53;
}

/**
 * Strict probability draw.
 * - If ANY prize has probability > 0 → probabilities are authoritative.
 *   Prizes with probability 0/undefined are EXCLUDED from the draw.
 *   Weights are ignored so admin percentages are honored precisely.
 * - Only if nobody set a probability we fall back to `weight`.
 * Out-of-stock prizes are always excluded.
 */
function drawWeighted(prizes: PrizeRow[]): PrizeRow | null {
  const available = prizes.filter(p =>
    p.quantity_available == null ||
    (p.quantity_distributed ?? 0) < p.quantity_available
  );
  if (available.length === 0) return null;

  const anyProb = available.some(p => Number(p.probability) > 0);

  const rawWeights = available.map(p => {
    if (anyProb) return Number(p.probability) > 0 ? Number(p.probability) : 0;
    return Number(p.weight) > 0 ? Number(p.weight) : 1;
  });

  // A chance da consolação ("Não foi dessa vez") é definida pelo admin no
  // passo 1 da criação da campanha (coluna `probability` na fatia de
  // consolação). Aqui apenas respeitamos as probabilidades salvas — sem
  // reescalonar. Se nenhuma probabilidade foi definida, caímos no peso.
  const weights = [...rawWeights];

  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) return null;


  const r = secureRandom() * total;
  let acc = 0;
  for (let i = 0; i < available.length; i++) {
    acc += weights[i];
    if (r < acc) return available[i];
  }
  return available[available.length - 1];
}


function prizePayload(p: PrizeRow) {
  return {
    id: p.id,
    name: p.name,
    emoji: p.emoji,
    description: p.description,
    image_url: p.image_url,
    checkout_url: p.checkout_url,
    redeem_instructions: p.redeem_instructions,
    is_consolation: p.is_consolation,
  };
}

/** Pick a random segment index matching the winning prize id. */
function pickSegmentIndex(segments: WheelSegment[], prizeId: string): number {
  const matches: number[] = [];
  segments.forEach((s, i) => { if (s.id === prizeId) matches.push(i); });
  if (matches.length === 0) return -1;
  const idx = Math.floor(secureRandom() * matches.length);
  return matches[idx];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { campaign_id, lead_ref } = parsed.data;
    const device_id = parsed.data.device_id ?? null;
    const email = parsed.data.email?.trim().toLowerCase() ?? null;
    const client_ip = clientIp(req);

    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .select("id, active, mechanic, has_participant_list, is_test")
      .eq("id", campaign_id)
      .maybeSingle();

    if (cErr || !campaign) {
      return new Response(JSON.stringify({ error: "campaign_not_found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!campaign.active) {
      return new Response(JSON.stringify({ error: "campaign_inactive" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (campaign.mechanic !== "roleta") {
      return new Response(JSON.stringify({ error: "wrong_mechanic" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: prizes, error: pErr } = await supabase
      .from("prizes")
      .select("*")
      .eq("campaign_id", campaign_id)
      .eq("active", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (pErr || !prizes || prizes.length === 0) {
      return new Response(JSON.stringify({ error: "no_prizes" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the exact segment layout the client renders so segmentIndex aligns
    // with the visible slice (including interleaved consolation copies).
    const { data: segmentsData, error: sErr } = await supabase.rpc("get_wheel_segments", {
      p_campaign: campaign_id,
    });
    if (sErr || !segmentsData || segmentsData.length === 0) {
      return new Response(JSON.stringify({ error: "no_segments" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const segments = segmentsData as WheelSegment[];

    // -- Token-based (list) campaign: enforce 1 spin per token, idempotent --
    let participantId: string | null = null;
    if (campaign.has_participant_list) {
      const { data: participant } = await supabase
        .from("campaign_participants")
        .select("id, spun_at, spun_prize_id")
        .eq("campaign_id", campaign_id)
        .eq("unique_token", lead_ref)
        .maybeSingle();

      if (!participant) {
        return new Response(JSON.stringify({ error: "invalid_token" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      participantId = participant.id;

      // Already spun → return the same prize (idempotent). Prevents reroll on refresh.
      if (participant.spun_at && participant.spun_prize_id) {
        const prev = (prizes as PrizeRow[]).find(p => p.id === participant.spun_prize_id);
        if (prev) {
          const segmentIndex = pickSegmentIndex(segments, prev.id);
          return new Response(
            JSON.stringify({
              segmentIndex,
              totalSegments: segments.length,
              prize: prizePayload(prev),
              already_spun: true,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    }

    // -- Blindagem do giro único (campanhas reais, não-teste) --
    //   lead_ref (sessão) · device_id (impressão digital) · client_ip
    //   Vale para campanha aberta E com lista: se qualquer sinal já girou nesta
    //   campanha, devolve o mesmo prêmio e não sorteia de novo.
    const isTest = !!(campaign as any).is_test;
    if (!isTest) {
      const safeLead = safeForOr(lead_ref);
      const safeDevice = safeForOr(device_id);
      const safeIp = safeForOr(client_ip);

      const orParts: string[] = [];
      if (safeLead) orParts.push(`lead_ref.eq.${safeLead}`);
      if (safeDevice) orParts.push(`device_id.eq.${safeDevice}`);
      if (safeIp) orParts.push(`client_ip.eq.${safeIp}`);

      const { data: priorSpins } = orParts.length
        ? await supabase
            .from("campaign_spins")
            .select("prize_id, lead_ref, device_id, client_ip")
            .eq("campaign_id", campaign_id)
            .or(orParts.join(","))
            .limit(10)
        : { data: [] as { prize_id: string; lead_ref: string; device_id: string | null; client_ip: string | null }[] };

      const rows = priorSpins ?? [];
      const blocker =
        rows.find((s) => s.lead_ref === lead_ref) ||
        (safeDevice ? rows.find((s) => s.device_id === device_id) : undefined) ||
        // IP só bloqueia quando não temos impressão digital (evita falso
        // positivo em redes compartilhadas / operadora móvel).
        (!device_id && client_ip ? rows.find((s) => s.client_ip === client_ip) : undefined);

      if (blocker?.prize_id) {
        const prev = (prizes as PrizeRow[]).find((p) => p.id === blocker.prize_id);
        if (prev) return alreadySpun(prev, segments, corsHeaders);
      }

      // Bloqueio por e-mail: mesmo e-mail não participa 2× nesta campanha
      // (mesmo de outro navegador/dispositivo).
      if (email) {
        const { data: priorByEmail } = await supabase
          .from("participations")
          .select("prize_id")
          .eq("campaign_id", campaign_id)
          .eq("email", email)
          .limit(1);
        const prizeId = priorByEmail?.[0]?.prize_id;
        if (prizeId) {
          const prev = (prizes as PrizeRow[]).find((p) => p.id === prizeId);
          if (prev) return alreadySpun(prev, segments, corsHeaders);
        }
      }
    }

    const winner = drawWeighted(prizes as PrizeRow[]);
    if (!winner) {
      return new Response(JSON.stringify({ error: "out_of_stock" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const segmentIndex = pickSegmentIndex(segments, winner.id);

    // Persist spin immediately so the token can never spin again.
    if (participantId) {
      await supabase
        .from("campaign_participants")
        .update({
          spun_at: new Date().toISOString(),
          spun_prize_id: winner.id,
          played: true,
          token_used_at: new Date().toISOString(),
        })
        .eq("id", participantId)
        .is("spun_at", null); // race-safe: only if not already spun
    }

    // Registra o giro (campanha aberta E com lista) com device_id + IP, para
    // que nem limpar o navegador nem trocar de e-mail permita girar de novo.
    if (!isTest) {
      await supabase
        .from("campaign_spins")
        .insert({ campaign_id, lead_ref, prize_id: winner.id, device_id, client_ip })
        .select()
        .maybeSingle();
    }

    console.log("[spin-roulette] draw", {
      campaign_id, lead_ref, prize_id: winner.id, segmentIndex, totalSegments: segments.length,
    });

    return new Response(
      JSON.stringify({
        segmentIndex,
        totalSegments: segments.length,
        prize: prizePayload(winner),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[spin-roulette] fatal", e);
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
