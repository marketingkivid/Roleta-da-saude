import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { emailSubject, renderEmailHtml, type EmailSettings } from "../_shared/email-template.ts";
import { sendTransactionalEmail } from "../_shared/brevo-send.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const SITE_URL = (Deno.env.get("PUBLIC_SITE_URL") || "https://roleta-kivid.pages.dev").replace(/\/+$/, "");
const LOGO_URL = `${SITE_URL}/kivid-logo.svg`;

// Runtime das Edge Functions do Supabase (Deno Deploy) expõe este global pra
// terminar trabalho DEPOIS de já ter respondido ao cliente — usado pra não
// fazer a pessoa esperar o e-mail do Brevo pra ver o resultado do giro.
declare const EdgeRuntime: { waitUntil?: (promise: Promise<unknown>) => void } | undefined;

function runInBackground(promise: Promise<unknown>): void {
  if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
    EdgeRuntime.waitUntil(promise);
  } else {
    promise.catch(() => { /* noop */ });
  }
}

const BodySchema = z.object({
  campaign_id: z.string().uuid(),
  lead_ref: z.string().min(1).max(200),
  device_id: z.string().min(1).max(200).optional(),
  email: z.string().email().max(320).optional(),
  name: z.string().max(200).optional(),
  // Só consulta o estado de tentativas — não sorteia.
  check_only: z.boolean().optional(),
});

/**
 * Dispara o e-mail de "você ganhou" (best-effort — nunca derruba o giro se
 * o Brevo falhar ou as configurações ainda não tiverem sido salvas em
 * Personalização). "Cupom" (tem checkout_url) ou "prêmio físico" (sem).
 */
async function sendPrizeEmailBestEffort(campaignName: string, prize: PrizeRow, toEmail: string, toName: string) {
  try {
    if (!toEmail) return;
    const { data: settingsRow } = await supabase
      .from("email_settings")
      .select("*")
      .eq("id", true)
      .maybeSingle();
    if (!settingsRow) return;
    const settings = settingsRow as unknown as EmailSettings;
    if (!settings.sender_email) return; // Personalização ainda não configurada

    const kind = prize.checkout_url ? "prize_coupon" : "prize_physical";
    const vars = {
      nome: toName || "",
      campanha: campaignName,
      premio: prize.name,
      checkoutUrl: prize.checkout_url ?? undefined,
      premioImagem: prize.image_url || undefined,
    };
    const subject = emailSubject(kind, settings, vars);
    const html = renderEmailHtml(kind, settings, vars, { logoUrl: LOGO_URL });
    const sender = { name: settings.sender_name || "Kivid", email: settings.sender_email };

    const result = await sendTransactionalEmail({ to: { email: toEmail, name: toName || undefined }, sender, subject, html });
    if (!result.ok) {
      console.error("[spin-roulette] prize email failed", { status: result.status, body: result.body });
      if (settings.failure_alert_email) {
        await sendTransactionalEmail({
          to: { email: settings.failure_alert_email },
          sender,
          subject: `⚠️ Falha ao enviar e-mail de prêmio — ${campaignName}`,
          html: `<p>Não foi possível enviar o e-mail de prêmio para ${toEmail} (campanha ${campaignName}, prêmio ${prize.name}). Status ${result.status}.</p>`,
        }).catch(() => { /* noop */ });
      }
    }
  } catch (e) {
    console.error("[spin-roulette] prize email fatal", e);
  }
}

/** IP do cliente a partir dos headers do edge runtime. */
function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  const raw = xff ? xff.split(",")[0].trim() : (req.headers.get("x-real-ip") ?? "").trim();
  return raw || null;
}

/**
 * Só usa o valor num filtro PostgREST `.or()` se for seguro (sem vírgula,
 * parênteses ou aspas que poderiam alterar a query). Nossos valores legítimos
 * (uuid, hash sha256, IP, e-mail) passam; lixo de header é descartado.
 */
function safeForOr(v: string | null): string | null {
  return v && /^[A-Za-z0-9._:%+@-]{1,200}$/.test(v) ? v : null;
}

interface AttemptInfo {
  attempt: number;        // qual tentativa é esta (1-based)
  maxAttempts: number;    // total de chances configurado na campanha
  attemptsLeft: number;   // chances restantes DEPOIS desta
  finished: boolean;      // acabou (ganhou OU zerou as chances)
  won: boolean;           // ganhou um prêmio real (não a consolação)
}

function spinResponse(
  prize: PrizeRow,
  segments: WheelSegment[],
  info: AttemptInfo,
  corsHeaders: Record<string, string>,
  extra: Record<string, unknown> = {},
) {
  return new Response(
    JSON.stringify({
      segmentIndex: pickSegmentIndex(segments, prize.id),
      totalSegments: segments.length,
      prize: prizePayload(prize),
      ...info,
      ...extra,
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
    const name = parsed.data.name?.trim() ?? "";
    const checkOnly = parsed.data.check_only === true;
    const client_ip = clientIp(req);

    // As três buscas abaixo não dependem uma da outra (todas só precisam do
    // campaign_id, que já veio no corpo da requisição) — rodar em paralelo
    // troca 3 idas-e-voltas sequenciais por só 1, o maior ganho de latência
    // do giro. Se a campanha acabar sendo inválida, o trabalho extra de
    // prêmios/segmentos é só descartado — barato perto do tempo economizado.
    const [campaignRes, prizesRes, segmentsRes] = await Promise.all([
      supabase
        .from("campaigns")
        .select("id, name, active, mechanic, has_participant_list, is_test, participation_limit")
        .eq("id", campaign_id)
        .maybeSingle(),
      supabase
        .from("prizes")
        .select("*")
        .eq("campaign_id", campaign_id)
        .eq("active", true)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true }),
      // Fetch the exact segment layout the client renders so segmentIndex
      // aligns with the visible slice (including interleaved consolation copies).
      supabase.rpc("get_wheel_segments", { p_campaign: campaign_id }),
    ]);

    const campaign = campaignRes.data as {
      id: string; name: string; active: boolean; mechanic: string;
      has_participant_list: boolean; is_test: boolean; participation_limit: number | null;
    } | null;

    if (campaignRes.error || !campaign) {
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

    const prizes = prizesRes.data;
    if (prizesRes.error || !prizes || prizes.length === 0) {
      return new Response(JSON.stringify({ error: "no_prizes" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const segmentsData = segmentsRes.data;
    if (segmentsRes.error || !segmentsData || segmentsData.length === 0) {
      return new Response(JSON.stringify({ error: "no_segments" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const segments = segmentsData as WheelSegment[];
    const prizeById = (id: string) => (prizes as PrizeRow[]).find((p) => p.id === id);

    // Chances por pessoa (participation_limit). null/0 → 1.
    const maxAttempts = Math.min(20, Math.max(1, Number(campaign.participation_limit) || 1));
    const isTest = !!campaign.is_test;

    // -- Token (campanha com lista): valida o token --
    let participantId: string | null = null;
    if (campaign.has_participant_list) {
      const { data: participant } = await supabase
        .from("campaign_participants")
        .select("id")
        .eq("campaign_id", campaign_id)
        .eq("unique_token", lead_ref)
        .maybeSingle();
      if (!participant) {
        return new Response(JSON.stringify({ error: "invalid_token" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      participantId = participant.id;
    }

    // -- Estado das tentativas deste usuário (campanhas reais) --
    //   Conta os giros já feitos por lead_ref / device_id / e-mail / IP e
    //   detecta se algum foi vitória. Vale para campanha aberta E com lista.
    //   O e-mail é o que garante a regra entre APARELHOS DIFERENTES: se a
    //   mesma pessoa abre o link no computador e depois no celular com o
    //   mesmo e-mail, lead_ref e device_id não batem (são por aparelho) —
    //   só o e-mail identifica que é a mesma pessoa, então ele conta desde
    //   o primeiro giro, não só quando a participação termina.
    let attemptsUsed = 0;
    let priorWin: PrizeRow | null = null;
    let lastPrize: PrizeRow | null = null;

    if (!isTest) {
      const safeLead = safeForOr(lead_ref);
      const safeDevice = safeForOr(device_id);
      const safeIp = safeForOr(client_ip);
      const safeEmail = safeForOr(email);
      const orParts: string[] = [];
      if (safeLead) orParts.push(`lead_ref.eq.${safeLead}`);
      if (safeDevice) orParts.push(`device_id.eq.${safeDevice}`);
      if (safeEmail) orParts.push(`email.eq.${safeEmail}`);
      if (safeIp) orParts.push(`client_ip.eq.${safeIp}`);

      const { data: priorSpins } = orParts.length
        ? await supabase
            .from("campaign_spins")
            .select("prize_id, lead_ref, device_id, client_ip, email, spun_at")
            .eq("campaign_id", campaign_id)
            .or(orParts.join(","))
            .order("spun_at", { ascending: true })
            .limit(50)
        : {
            data: [] as {
              prize_id: string; lead_ref: string; device_id: string | null;
              client_ip: string | null; email: string | null; spun_at: string;
            }[],
          };

      const rows = priorSpins ?? [];
      // "Meus" giros: bate device_id OU lead_ref (mesmo aparelho) OU e-mail
      // (mesma pessoa, qualquer aparelho). IP só entra quando não há
      // device_id — sozinho é frouxo demais (rede compartilhada).
      const mine = rows.filter((s) =>
        (!!device_id && s.device_id === device_id) ||
        s.lead_ref === lead_ref ||
        (!!email && s.email === email) ||
        (!device_id && !!client_ip && s.client_ip === client_ip)
      );

      attemptsUsed = mine.length;
      for (const s of mine) {
        const pr = prizeById(s.prize_id);
        if (pr) {
          lastPrize = pr;
          if (!pr.is_consolation) priorWin = pr;
        }
      }

      // Segunda camada (defesa extra) — só entra quando não achou NENHUM
      // giro reconhecido (mine vazio): cobre dados antigos sem device_id/
      // email gravado no giro. Se já achou giros por device/lead/e-mail,
      // qualquer vitória já apareceria neles — não precisa desta consulta
      // extra a cada tentativa (2ª, 3ª... chance), só na primeira.
      if (mine.length === 0 && email) {
        const { data: byEmail } = await supabase
          .from("participations")
          .select("prize_id")
          .eq("campaign_id", campaign_id)
          .eq("email", email)
          .limit(1);
        const pid = byEmail?.[0]?.prize_id;
        const pr = pid ? prizeById(pid) : undefined;
        if (pr) {
          lastPrize = pr;
          if (!pr.is_consolation) priorWin = pr;
          attemptsUsed = Math.max(attemptsUsed, maxAttempts); // trava
        }
      }
    }

    // -- Já terminou? (ganhou antes OU zerou as chances) --
    const alreadyFinished = !!priorWin || (!isTest && attemptsUsed >= maxAttempts);
    if (alreadyFinished && lastPrize) {
      return spinResponse(lastPrize, segments, {
        attempt: attemptsUsed,
        maxAttempts,
        attemptsLeft: 0,
        finished: true,
        won: !!priorWin,
      }, corsHeaders, { already_spun: true });
    }

    // -- check_only: só reporta o estado, sem sortear --
    if (checkOnly) {
      return new Response(JSON.stringify({
        check_only: true,
        maxAttempts,
        attemptsUsed,
        attemptsLeft: Math.max(0, maxAttempts - attemptsUsed),
        finished: false,
        won: false,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // -- Sorteia esta tentativa --
    const winner = drawWeighted(prizes as PrizeRow[]);
    if (!winner) {
      return new Response(JSON.stringify({ error: "out_of_stock" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const attempt = attemptsUsed + 1;
    const won = !winner.is_consolation;
    // Ganhou → para. Perdeu → resta (max - attempt).
    const attemptsLeft = won ? 0 : Math.max(0, maxAttempts - attempt);
    const finished = won || attemptsLeft === 0;

    // Registra o giro (device_id + e-mail + IP) — em campanha real de
    // qualquer tipo. O e-mail vai em TODO giro (não só no final) para a
    // regra valer desde a primeira tentativa em qualquer aparelho.
    if (!isTest) {
      await supabase
        .from("campaign_spins")
        .insert({ campaign_id, lead_ref, prize_id: winner.id, device_id, client_ip, email });
    }

    // Campanha com lista: marca o participante ao TERMINAR (ganhou ou zerou).
    if (participantId && finished) {
      await supabase
        .from("campaign_participants")
        .update({
          spun_at: new Date().toISOString(),
          spun_prize_id: winner.id,
          played: true,
          token_used_at: new Date().toISOString(),
        })
        .eq("id", participantId);
    }

    console.log("[spin-roulette] draw", {
      campaign_id, prize_id: winner.id, attempt, maxAttempts, won, finished,
    });

    // Ganhou de verdade (não consolação) → dispara o e-mail de prêmio, em
    // segundo plano — não faz a pessoa esperar o Brevo pra ver a tela do
    // prêmio. O giro já está registrado; a falha de e-mail nunca derruba a
    // experiência (é best-effort dentro de sendPrizeEmailBestEffort).
    if (won && !isTest && email) {
      runInBackground(sendPrizeEmailBestEffort(campaign.name, winner, email, name));
    }

    return spinResponse(winner, segments, { attempt, maxAttempts, attemptsLeft, finished, won }, corsHeaders);
  } catch (e) {
    console.error("[spin-roulette] fatal", e);
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
