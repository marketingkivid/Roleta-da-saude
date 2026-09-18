import { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCw, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fitWheelLabel } from '@/lib/wheel-label';
import { twemojiUrl, Emoji, EmojiText } from '@/lib/twemoji';
import { WHEEL, sliceColor } from '@/lib/wheel-theme';
import type { SpinResult } from '@/hooks/useCampaign';
import kividMark from '@/assets/kivid-mark.svg';


interface Segment {
  id: string;
  label: string;
  emoji: string | null;
  image_url: string | null;
  color_token: string | null;
  display_order: number;
  is_consolation?: boolean;
}

// Rótulo mostrado nas fatias de consolação da roleta (igual à prévia do admin).
const CONSOLATION_WHEEL_LABEL = 'Não foi dessa vez';

interface RouletteScreenProps {
  campaignId: string;
  onSpin: () => Promise<SpinResult | null>;
  /** Chamado quando a participação encerra (ganhou ou zerou as chances). */
  onFinish: (result: SpinResult) => Promise<void>;
  /** Chances desta pessoa na campanha (usadas / total / restantes). */
  attempts: { used: number; max: number; left: number };
}

// Kivid DS — família Pitaya sobre branco Kivid
const PITAYA_500 = '#DB4AA8';   // topo do gradiente do botão de girar
const PITAYA_600 = '#CF3A9D';   // primária
const PITAYA_700 = '#B8348C';
const PITAYA_800 = '#A82F7F';
const PITAYA_900 = '#942971';   // borda escura para contraste no branco
const PITAYA_400 = '#EB65BE';
const PITAYA_100 = '#FCDEF1';
const PURPLE_DEEP = '#72243E';   // Kivid — magenta escuro (títulos)
const PURPLE = '#993556';        // Kivid — rosa escuro (subtítulos)
const LAVENDER = '#ED93B1';      // Kivid — rosa claro
const CREAM = '#FFF7E1';
const WHITE = '#FFFFFF';
const BG = '#FFFFFF';            // fundo da tela — branco Kivid
// Aliases mantêm o restante do arquivo estável e agora respeitam a identidade Kivid
const GOLD = PITAYA_600;
const GOLD_DEEP = PITAYA_900;
const BG_DARK = BG;

// ── Roleta — design final Kivid ──────────────────────────────────────────────
// Paleta e regra de alternância vêm de src/lib/wheel-theme.ts (compartilhado
// com as prévias do admin, para garantir fidelidade total).
const RIM = WHEEL.rim;
const RIM_EDGE = WHEEL.rimEdge;
const RIM_BULB_MAGENTA = WHEEL.bulbMagenta;
const POINTER = WHEEL.pointer;

const polar = (cx: number, cy: number, r: number, angleRad: number) => ({
  x: cx + r * Math.cos(angleRad),
  y: cy + r * Math.sin(angleRad),
});

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Coin rain — CSS-based, honors reduced motion */
const CoinRain = () => {
  const reduced = prefersReducedMotion();
  const coins = useMemo(() => {
    const n = reduced ? 0 : 24;
    return Array.from({ length: n }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 1.2,
      duration: 2.4 + Math.random() * 1.6,
      size: 14 + Math.random() * 10,
      rotate: Math.random() * 360,
    }));
  }, [reduced]);
  if (reduced) return null;
  return (
    <div aria-hidden className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      {coins.map(c => (
        <div
          key={c.id}
          className="absolute animate-coin-fall"
          style={{
            left: `${c.left}%`,
            top: -30,
            width: c.size,
            height: c.size,
            borderRadius: '50%',
            background: `radial-gradient(circle at 35% 30%, #FFE79A, ${GOLD} 55%, ${GOLD_DEEP})`,
            boxShadow: `inset 0 0 0 1.5px ${GOLD_DEEP}, 0 2px 4px rgba(0,0,0,0.15)`,
            animationDelay: `${c.delay}s`,
            animationDuration: `${c.duration}s`,
            transform: `rotate(${c.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
};

const RouletteScreen = ({ campaignId, onSpin, onFinish, attempts }: RouletteScreenProps) => {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [rotation, setRotation] = useState(0);
  const [spinState, setSpinState] = useState<'idle' | 'requesting' | 'spinning' | 'landed'>('idle');
  const [revealPrize, setRevealPrize] = useState<SpinResult['prize'] | null>(null);
  // Resultado completo do último giro (traz o estado de tentativas).
  const [lastResult, setLastResult] = useState<SpinResult | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const tooltipTimerRef = useRef<number | null>(null);
  const wheelRef = useRef<SVGSVGElement | null>(null);
  const wheelWrapRef = useRef<HTMLDivElement | null>(null);
  // Medidos de verdade (não chutados): quanto espaço o cabeçalho da tela
  // (título + badge) e o rodapé (botão + legenda) realmente ocupam, e
  // quanto o container desta tela realmente tem de altura — esse já vem
  // descontado do Header/ProgressBar da página (são de fora, ficam acima
  // no layout), que antes não entravam na conta e faziam o botão sumir
  // embaixo em telas de desktop mais baixas.
  const screenRootRef = useRef<HTMLDivElement | null>(null);
  const titleBlockRef = useRef<HTMLDivElement | null>(null);
  const bottomBlockRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const hapticTimersRef = useRef<number[]>([]);
  // Chances restantes "congeladas" no instante em que o giro começa.
  const chancesBeforeSpinRef = useRef<number>(attempts.left);
  useEffect(() => {
    if (spinState === 'idle') chancesBeforeSpinRef.current = attempts.left;
  }, [attempts.left, spinState]);

  // ── Sensação tátil ────────────────────────────────────────────────────────
  // Android/Chrome: Vibration API real.
  // iOS/Safari:     Apple NÃO expõe a Vibration API na web — nada de vibração.
  //                 Compensamos com um "thump" de áudio grave (Web Audio) que
  //                 gera sensação corpórea semelhante quando ouvido com o
  //                 telefone na mão, especialmente no alto-falante do iPhone.
  const canVibrate = () =>
    typeof navigator !== 'undefined' &&
    typeof (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }).vibrate === 'function' &&
    !prefersReducedMotion();

  const haptic = (pattern: number | number[]) => {
    if (!canVibrate()) return;
    try { navigator.vibrate(pattern); } catch { /* noop */ }
  };

  // ── Camada de áudio-tátil (iOS-compatible) ────────────────────────────────
  const audioCtxRef = useRef<AudioContext | null>(null);
  const getAudioCtx = (): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    if (prefersReducedMotion()) return null;
    if (audioCtxRef.current) {
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => { /* noop */ });
      }
      return audioCtxRef.current;
    }
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      audioCtxRef.current = new Ctor();
      return audioCtxRef.current;
    } catch { return null; }
  };

  // Bump grave e curto — sensação de "clique" mecânico / batida.
  const thump = (opts: { freq?: number; duration?: number; gain?: number } = {}) => {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const { freq = 90, duration = 0.06, gain = 0.35 } = opts;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    // Pequeno "pitch drop" dá impressão de impacto físico.
    osc.frequency.setValueAtTime(freq * 1.6, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * 0.6), t0 + duration);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  };

  // Dispara os dois canais juntos — vibra onde puder, e ainda entrega o punch
  // sonoro que o iPhone sente como "batida".
  const feel = (vibratePattern: number | number[], audio?: { freq?: number; duration?: number; gain?: number }) => {
    haptic(vibratePattern);
    if (audio !== undefined) thump(audio);
  };

  const clearHapticTimers = () => {
    hapticTimersRef.current.forEach((id) => window.clearTimeout(id));
    hapticTimersRef.current = [];
  };
  useEffect(() => () => {
    clearHapticTimers();
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(0); } catch { /* noop */ }
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch { /* noop */ }
      audioCtxRef.current = null;
    }
  }, []);

  // Solve x -> y for a CSS cubic-bezier(p1x, p1y, p2x, p2y) curve. Used to map
  // linear time to eased progress so tick timings match the visual rotation.
  const makeBezier = (p1x: number, p1y: number, p2x: number, p2y: number) => {
    const cx = 3 * p1x, bx = 3 * (p2x - p1x) - cx, ax = 1 - cx - bx;
    const cy = 3 * p1y, by = 3 * (p2y - p1y) - cy, ay = 1 - cy - by;
    const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
    const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
    const sampleDx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
    return (x: number) => {
      let t = x;
      for (let i = 0; i < 8; i++) {
        const x2 = sampleX(t) - x;
        if (Math.abs(x2) < 1e-5) return sampleY(t);
        const d = sampleDx(t);
        if (Math.abs(d) < 1e-6) break;
        t -= x2 / d;
      }
      let lo = 0, hi = 1;
      t = x;
      for (let i = 0; i < 20; i++) {
        const x2 = sampleX(t);
        if (Math.abs(x2 - x) < 1e-4) break;
        if (x > x2) lo = t; else hi = t;
        t = (hi + lo) / 2;
      }
      return sampleY(t);
    };
  };

  // Programa "ticks" táteis + sonoros durante toda a animação da roda.
  // A força cresce conforme se aproxima do fim → cria expectativa/desejo.
  const scheduleTickHaptics = (deltaDeg: number, durationMs: number) => {
    if (prefersReducedMotion()) return;
    if (deltaDeg <= 0 || sliceAngle <= 0) return;
    const totalTicks = Math.floor(deltaDeg / sliceAngle);
    if (totalTicks <= 0) return;

    // Mesmo easing que a rotação visual — os ticks coincidem com os segmentos.
    const ease = makeBezier(0.09, 0.75, 0.16, 1);
    const samples = 720;
    let nextTick = 1;
    for (let i = 1; i <= samples && nextTick <= totalTicks; i++) {
      const t = i / samples;
      const traveled = ease(t) * deltaDeg;
      while (nextTick <= totalTicks && traveled >= nextTick * sliceAngle) {
        const when = t * durationMs;
        // Progresso 0..1 do tick: usado para intensificar no fim da desaceleração.
        const progress = nextTick / totalTicks;
        // Vibração: 12 ms no começo → 28 ms nos últimos ticks (mais perceptível).
        const vibMs = Math.round(12 + progress * 16);
        // Áudio: frequência sobe levemente e ganho cresce — sensação de tensão.
        const freq = 70 + progress * 60;      // 70 → 130 Hz
        const gain = 0.18 + progress * 0.22;  // 0.18 → 0.40
        const id = window.setTimeout(() => {
          feel(vibMs, { freq, duration: 0.045, gain });
        }, when);
        hapticTimersRef.current.push(id);
        nextTick++;
      }
    }
  };





  // Load wheel segments via SECURITY DEFINER function (no weights exposed)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('get_wheel_segments', { p_campaign: campaignId });
      if (cancelled) return;
      if (!error && data) {
        setSegments(data as Segment[]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [campaignId]);

  // Preload prize images (best-effort)
  useEffect(() => {
    if (!segments.length) return;
    // We only know labels/colors here — real images live behind spin call.
    // Best-effort: nothing to preload for the wheel itself.
  }, [segments]);

  // Bloqueia bounce/overscroll do iOS enquanto a tela da roleta está ativa.
  // Aplicado no <html> e <body> + touchmove handler que só permite gesto dentro
  // do diálogo de prêmio (o resto da tela não rola).
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverscroll: html.style.overscrollBehavior,
      bodyOverscroll: body.style.overscrollBehavior,
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
    };
    html.style.overscrollBehavior = 'none';
    body.style.overscrollBehavior = 'none';
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';

    const onTouchMove = (e: TouchEvent) => {
      const target = e.target as Node | null;
      // Permite scroll interno apenas dentro do modal de prêmio (se estiver aberto).
      if (target && dialogRef.current && dialogRef.current.contains(target)) return;
      e.preventDefault();
    };
    document.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      document.removeEventListener('touchmove', onTouchMove);
      html.style.overscrollBehavior = prev.htmlOverscroll;
      body.style.overscrollBehavior = prev.bodyOverscroll;
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
    };
  }, []);


  // Responsive wheel sizing — recompute on resize so mobile rotation/keyboard doesn't leave it stale
  const [viewportW, setViewportW] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 390
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setViewportW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  // Mobile-first: usa quase toda a largura da tela; em telas maiores mantém limite confortável.
  const horizontalPadding = viewportW < 400 ? 8 : viewportW < 640 ? 14 : 48;
  const sizeByWidth = Math.max(240, viewportW - horizontalPadding);
  const isMobile = viewportW < 640;
  // Botão de girar — squircle grande (não pill): a proporção quase 1:1 lê
  // como "botão de verdade" (tecla, ícone de app), diferente de um pill
  // largo que lê como rótulo de texto. Mantém a área de toque do pill
  // anterior (52/60px de altura) ou maior — só muda o formato, não encolhe.
  const spinBtnSize = isMobile ? 88 : 108;

  // Altura disponível de verdade (MEDIDA, não chutada): o quanto o
  // cabeçalho (título + badge de chances) e o rodapé (botão + legenda)
  // realmente ocupam, dentro do espaço que ESTA tela realmente recebe —
  // que já vem descontado do Header/ProgressBar da página (ficam fora,
  // acima). Um número fixo "chutado" ficava desatualizado toda vez que um
  // desses blocos mudava de tamanho (foi o que sumiu com o botão no
  // desktop quando ele cresceu) — medir elimina esse tipo de bug de vez.
  const [chrome, setChrome] = useState({ container: 780, title: 64, bottom: 150 });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Só mede quando os 3 elementos já estão montados (nada disso existe
    // durante a tela de carregamento) — nunca sobrescreve uma medida boa
    // com o valor de reserva só porque essa chamada pegou o componente
    // num instante sem os refs ainda presos.
    const measure = () => {
      if (!screenRootRef.current || !titleBlockRef.current || !bottomBlockRef.current) return;
      setChrome({
        container: screenRootRef.current.clientHeight,
        title: titleBlockRef.current.offsetHeight,
        bottom: bottomBlockRef.current.offsetHeight,
      });
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro && screenRootRef.current) ro.observe(screenRootRef.current);
    if (ro && titleBlockRef.current) ro.observe(titleBlockRef.current);
    if (ro && bottomBlockRef.current) ro.observe(bottomBlockRef.current);
    window.addEventListener('resize', measure);
    return () => { ro?.disconnect(); window.removeEventListener('resize', measure); };
  }, [viewportW, attempts.max, loading]);

  // O invólucro da roda (abaixo) é size+40 — 40px a mais que o SVG em si,
  // espaço do ponteiro — então isso entra na conta, não só o título/rodapé.
  // +16px de folga entre os blocos por cima disso.
  const sizeByHeight = Math.max(220, chrome.container - chrome.title - chrome.bottom - 40 - 16);
  const size = Math.min(560, sizeByWidth, sizeByHeight);

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 28; // leave room for gold rim + bulbs
  const n = segments.length;
  const sliceAngle = n > 0 ? 360 / n : 0;

  const bulbCount = Math.max(12, n * 2);

  const handleSpin = async () => {
    if (spinState !== 'idle' || n < 2) return;
    setSpinState('requesting');

    // "Destranca" o AudioContext em iOS/Safari — precisa ser dentro do gesto do usuário.
    // Sem isso o iPhone fica mudo até o primeiro toque.
    getAudioCtx();

    // Toque de largada — pulso mais grave e forte + thump sonoro contundente.
    feel([25, 20, 45], { freq: 55, duration: 0.09, gain: 0.5 });

    // "Impulso" — a roda já reage no instante do toque, antes de qualquer
    // resposta do servidor chegar. Puxa alguns graus pra trás (como um
    // pião sendo armado); quando o giro de verdade começar, a transição
    // continua dali mesmo — sem pulo, sem reset. É o que faz o toque
    // parecer instantâneo mesmo com uma ida à rede no meio do caminho.
    if (!prefersReducedMotion()) setRotation(prev => prev - 16);

    const result = await onSpin();
    if (!result) {
      setSpinState('idle');
      return;
    }

    // Deterministic landing: pointer is at top (angle -90 in svg terms).
    // Slice i occupies angles [i*slice, (i+1)*slice) starting from the top clockwise.
    // We rotate the wheel by -segmentCenter so its center aligns under the top pointer.
    const targetIdx = result.segmentIndex;
    const segmentCenter = targetIdx * sliceAngle + sliceAngle / 2;
    const extraTurns = prefersReducedMotion() ? 0 : 8; // full turns for drama
    const finalRotation = extraTurns * 360 - segmentCenter;
    const duration = prefersReducedMotion() ? 500 : 6000;

    setSpinState('spinning');
    // Chain from current visual position: ensure monotonic increase and land exactly on segment center
    clearHapticTimers();
    setRotation(prev => {
      const current = ((prev % 360) + 360) % 360;
      const base = prev - current; // last full-turn baseline
      const next = base + finalRotation;
      const delta = next - prev;
      // Programa um "tick" tátil-sonoro a cada centro de segmento cruzando o ponteiro.
      scheduleTickHaptics(delta, duration);
      return next;
    });

    const landId = window.setTimeout(() => {
      setSpinState('landed');
      setRevealPrize(result.prize);
      setLastResult(result);
      // Buzz de parada — crescendo comemorativo (prêmio) ou pulso duplo (consolação).
      if (result.prize.is_consolation) {
        feel([60, 60, 80], { freq: 70, duration: 0.14, gain: 0.35 });
      } else {
        // Padrão forte + graves em cascata dão a sensação de "impacto/prêmio".
        feel([80, 60, 120, 60, 200, 60, 260], { freq: 45, duration: 0.22, gain: 0.55 });
        // Segunda batida grave logo depois — reforça o "punch" do prêmio.
        const punchId = window.setTimeout(
          () => thump({ freq: 38, duration: 0.35, gain: 0.5 }),
          140
        );
        hapticTimersRef.current.push(punchId);
      }
    }, duration);
    hapticTimersRef.current.push(landId);
  };



  // O modal encerrou e a participação acabou (ganhou OU zerou as chances).
  const handleContinue = async () => {
    if (!lastResult) return;
    await onFinish(lastResult);
  };

  // "Girar de novo" — ainda tem chances e não ganhou. Reinicia o modal e gira.
  const handleSpinAgain = () => {
    setSpinState('idle');
    setRevealPrize(null);
    setLastResult(null);
    // pequeno atraso para o modal fechar antes do próximo giro
    window.setTimeout(() => { void handleSpin(); }, 60);
  };

  // O último giro encerrou a participação (ganhou OU zerou as chances)?
  const spinFinished = lastResult?.finished ?? true;
  // Consolação com chances sobrando → oferece girar de novo dentro do modal.
  const canRetry = !spinFinished && !!lastResult && !lastResult.won;
  const retryLeft = lastResult?.attemptsLeft ?? attempts.left;

  // Dispensar o modal (×, ESC, backdrop):
  //  - participação encerrada → segue para a tela de resultado;
  //  - ainda tem chance → volta para a roleta, pronta para o próximo giro
  //    (o giro em si é disparado pelo botão "Girar de novo", nunca por engano).
  const dismissModal = () => {
    if (spinFinished) {
      void handleContinue();
      return;
    }
    setSpinState('idle');
    setRevealPrize(null);
    setLastResult(null);
  };

  // Contador de chances mostrado no topo da roleta.
  // Enquanto a roda gira, mantém o número de antes do giro (o resultado ainda
  // não "consumiu" a chance visualmente); ao parar, mostra o que sobrou.
  const totalChances = Math.max(1, attempts.max);
  const chancesLeft =
    spinState === 'landed' && lastResult ? lastResult.attemptsLeft : chancesBeforeSpinRef.current;
  const multiChance = totalChances > 1;
  const showChanceDots = multiChance && totalChances <= 8;

  // Show the full prize name on tap/hover. Positioned relative to the wheel wrapper
  // so it never affects the SVG text layout inside the slice.
  const showTooltip = (e: React.PointerEvent<SVGPathElement>, text: string) => {
    if (!text) return;
    const wrap = wheelWrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, text });
    if (tooltipTimerRef.current) window.clearTimeout(tooltipTimerRef.current);
    // Auto-dismiss on touch so it doesn't linger after tapping.
    if (e.pointerType !== 'mouse') {
      tooltipTimerRef.current = window.setTimeout(() => setTooltip(null), 2200);
    }
  };
  const hideTooltip = () => {
    if (tooltipTimerRef.current) {
      window.clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }
    setTooltip(null);
  };
  useEffect(() => () => {
    if (tooltipTimerRef.current) window.clearTimeout(tooltipTimerRef.current);
  }, []);
  // Hide tooltip whenever the wheel is not idle (spinning/landed).
  useEffect(() => {
    if (spinState !== 'idle') hideTooltip();
  }, [spinState]);

  // Modal accessibility: focus trap, ESC to close, body scroll lock, restore focus.
  const modalOpen = spinState === 'landed' && !!revealPrize;
  useEffect(() => {
    if (!modalOpen) return;

    previouslyFocusedRef.current = (document.activeElement as HTMLElement) || null;

    // iOS Safari–safe scroll lock: fix <body> in place at current scroll offset.
    // Plain `overflow: hidden` on <body> does NOT stop touch scroll on iOS.
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const body = document.body;
    const html = document.documentElement;
    const prev = {
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      bodyOverflow: body.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
    };
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'contain';

    // Prevent touchmove on the backdrop from scrolling the page underneath while
    // still allowing internal scroll inside the dialog itself.
    const onTouchMove = (e: TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (dialogRef.current && dialogRef.current.contains(target)) return;
      e.preventDefault();
    };
    document.addEventListener('touchmove', onTouchMove, { passive: false });

    // Sem botão de fechar: foca o diálogo em si, pra leitor de tela/teclado
    // entrar no modal (o Tab de lá segue pro CTA principal).
    const focusTimer = window.setTimeout(() => {
      dialogRef.current?.focus({ preventScroll: true });
    }, 30);


    const getFocusable = (): HTMLElement[] => {
      const root = dialogRef.current;
      if (!root) return [];
      return Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute('aria-hidden'));
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        dismissModal();
        return;
      }
      if (e.key === 'Tab') {
        const focusables = getFocusable();
        if (focusables.length === 0) {
          e.preventDefault();
          dialogRef.current?.focus();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey) {
          if (active === first || !dialogRef.current?.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('touchmove', onTouchMove);

      // Restore body styles and scroll position exactly where the user was.
      body.style.position = prev.bodyPosition;
      body.style.top = prev.bodyTop;
      body.style.left = prev.bodyLeft;
      body.style.right = prev.bodyRight;
      body.style.width = prev.bodyWidth;
      body.style.overflow = prev.bodyOverflow;
      html.style.overscrollBehavior = prev.htmlOverscroll;
      window.scrollTo(0, scrollY);

      previouslyFocusedRef.current?.focus?.();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen]);





  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-10">
        <div className="animate-pulse h-56 w-56 rounded-full" style={{ background: LAVENDER }} />
      </div>
    );
  }

  if (n < 2) {
    return (
      <div className="flex-1 flex items-center justify-center py-10 px-6 text-center" style={{ fontFamily: 'Nunito, sans-serif' }}>
        <div style={{ background: '#FFFFFF', border: `1px solid ${LAVENDER}`, borderRadius: 20, padding: 32, maxWidth: 420 }}>
          <div style={{ marginBottom: 12 }}><Emoji emoji="🎡" label="" size={40} /></div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: PURPLE_DEEP, marginBottom: 6 }}>Roleta em preparação</h1>
          <p style={{ color: '#6B5B8A', fontSize: 14 }}>Esta campanha ainda não tem segmentos suficientes.</p>
        </div>
      </div>
    );
  }

  // Build slice paths (start at top, clockwise)
  let cursor = -Math.PI / 2;
  const slices = segments.map((seg, i) => {
    const angleRad = (sliceAngle * Math.PI) / 180;
    const start = cursor;
    const end = cursor + angleRad;
    cursor = end;
    const p0 = polar(cx, cy, r, start);
    const p1 = polar(cx, cy, r, end);
    const largeArc = angleRad > Math.PI ? 1 : 0;
    const path = `M ${cx} ${cy} L ${p0.x} ${p0.y} A ${r} ${r} 0 ${largeArc} 1 ${p1.x} ${p1.y} Z`;
    const midAngle = start + angleRad / 2;
    const labelPos = polar(cx, cy, r * 0.78, midAngle);
    // Design final: alterna sempre magenta × lavanda (ignora token do admin).
    const color = sliceColor(i);
    return { seg, path, labelPos, color, midDeg: (midAngle * 180) / Math.PI };
  });

  const bulbs = Array.from({ length: bulbCount }).map((_, i) => {
    const angle = (i / bulbCount) * Math.PI * 2 - Math.PI / 2;
    return polar(cx, cy, r + 10, angle);
  });

  return (
    <div
      ref={screenRootRef}
      className="relative flex-1 flex flex-col items-center justify-between px-3 sm:px-4 pt-2 w-full overflow-hidden"
      style={{
        fontFamily: 'Nunito, sans-serif',
        background: BG_DARK,
        minHeight: 0,
        // Safe-area: respeita a barra inferior do iPhone com notch/home indicator.
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(12px, env(safe-area-inset-left))',
        paddingRight: 'max(12px, env(safe-area-inset-right))',
        overscrollBehavior: 'none',
        touchAction: 'none',
      }}
    >

      {spinState === 'landed' && revealPrize && !revealPrize.is_consolation && <CoinRain />}

      <div ref={titleBlockRef} className="text-center mt-0 mb-1 sm:mb-3 shrink-0">
        <p className="text-[10px] sm:text-xs" style={{ color: PURPLE, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase' }}>
          Roleta da sorte
        </p>
        <h1 className="text-lg sm:text-3xl mt-0 sm:mt-1" style={{ color: PURPLE_DEEP, fontWeight: 900, lineHeight: 1.1 }}>
          Gire e ganhe seu prêmio
        </h1>

        {multiChance && (
          <div
            className="mt-1.5 sm:mt-2 inline-flex items-center gap-2 rounded-full"
            style={{
              background: PITAYA_100,
              color: PURPLE_DEEP,
              padding: '5px 12px',
              fontWeight: 900,
              fontSize: 12.5,
              letterSpacing: 0.2,
            }}
            aria-label={`Você tem ${chancesLeft} de ${totalChances} chances`}
          >
            <Emoji emoji="🍀" label="" size={15} />
            <span>
              {chancesLeft > 0
                ? <>{chancesLeft} {chancesLeft === 1 ? 'chance' : 'chances'} <span style={{ opacity: 0.6, fontWeight: 800 }}>de {totalChances}</span></>
                : <>chances esgotadas</>}
            </span>
            {showChanceDots && (
              <span className="flex items-center gap-1" aria-hidden="true">
                {Array.from({ length: totalChances }).map((_, i) => (
                  <span
                    key={i}
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 999,
                      display: 'inline-block',
                      background: i < chancesLeft ? PITAYA_600 : 'rgba(148, 41, 113, 0.22)',
                      transition: 'background-color 240ms ease',
                    }}
                  />
                ))}
              </span>
            )}
          </div>
        )}
      </div>




      <div
        ref={wheelWrapRef}
        className="relative"
        onClick={spinState === 'idle' ? handleSpin : undefined}
        style={{
          width: size + 40,
          height: size + 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: spinState === 'idle' ? 'pointer' : 'default',
        }}
      >
        {/* Pointer */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: -4,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 34,
            height: 44,
            zIndex: 3,
            filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.4))',
          }}
        >
          <svg width={34} height={44} viewBox="0 0 34 44">
            <polygon
              points="17,43 3,5 31,5"
              fill={POINTER}
              stroke={RIM}
              strokeWidth={2.5}
              strokeLinejoin="round"
            />
            <circle cx={17} cy={11} r={3.5} fill={WHITE} />
          </svg>
        </div>

        {/* Wheel + static hub container — exact wheel size guarantees perfect centering */}
        <div
          style={{
            position: 'relative',
            width: size,
            height: size,
          }}
        >
          {/* Wheel */}
          <svg
            ref={wheelRef}
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            style={{
              position: 'relative',
              zIndex: 1,
              transform: `rotate(${rotation}deg)`,
              transition:
                spinState === 'spinning'
                  ? `transform ${prefersReducedMotion() ? 0.5 : 6}s cubic-bezier(0.09, 0.75, 0.16, 1)`
                  : spinState === 'requesting'
                    ? 'transform 220ms cubic-bezier(0.34, 0, 0.64, 1)'
                    : 'none',
            }}
          >
          {/* Aro vinho — flat, sem gradiente (design final Kivid) */}
          <circle cx={cx} cy={cy} r={r + 16} fill={RIM_EDGE} />
          <circle cx={cx} cy={cy} r={r + 14} fill={RIM} />
          <circle cx={cx} cy={cy} r={r + 2} fill="none" stroke={RIM_EDGE} strokeWidth={2} />

          {/* Slices */}
          {slices.map(({ seg, path, labelPos, color, midDeg }, i) => {
            // Layout rules:
            //  - The prize name (text) ALWAYS appears on the slice — never truncated.
            //    It wraps up to 3 lines and the font shrinks to fit.
            //  - When an image is available (show_image on), the image occupies the
            //    inner half of the slice and the text sits on an outer band so both
            //    stay visible without overlapping.
            //  - When there is no image, emoji (if any) + text render stacked at
            //    the slice center.
            const arcAtLabel = (2 * Math.PI * (r * 0.78)) / n;
            const emoji = (seg.emoji || '').trim();
            const emojiHref = emoji ? twemojiUrl(emoji) : null;
            const imageUrl = (seg.image_url || '').trim();
            const hasImage = imageUrl.length > 0;
            const rawLabel = seg.is_consolation ? CONSOLATION_WHEEL_LABEL : (seg.label ?? '');
            const clipId = `slice-clip-${i}`;
            const sliceAngleRad = (sliceAngle * Math.PI) / 180;
            const midRad = (midDeg * Math.PI) / 180;

            if (hasImage) {
              // Image fills inner half; text rides the outer band.
              const imgCenterR = r * 0.38;
              const imgH = r * 0.55;
              const imgW = Math.max(20, 2 * imgCenterR * Math.tan(sliceAngleRad / 2) + 8);
              const imgCx = cx + imgCenterR * Math.cos(midRad);
              const imgCy = cy + imgCenterR * Math.sin(midRad);
              // Text band near the outer rim — larger arc → more room per line.
              const textR = r * 0.82;
              const textArc = Math.max(30, (2 * Math.PI * textR) / n * 0.9);
              const fitted = fitWheelLabel(rawLabel, textArc, { minFont: 10, maxFont: 15, maxLines: 2 });
              const textPos = polar(cx, cy, textR, midRad);
              return (
                <g key={`${seg.id}-${i}`}>
                  <path
                    d={path}
                    fill={color}
                    stroke={WHITE}
                    strokeWidth={2}
                    style={{ cursor: spinState === 'idle' ? 'pointer' : 'default' }}
                    onPointerDown={(e) => showTooltip(e, rawLabel)}
                    onPointerEnter={(e) => e.pointerType === 'mouse' && showTooltip(e, rawLabel)}
                    onPointerLeave={(e) => e.pointerType === 'mouse' && hideTooltip()}
                  >
                    <title>{rawLabel}</title>
                  </path>
                  <defs>
                    <clipPath id={clipId}>
                      <path d={path} />
                    </clipPath>
                  </defs>

                  <g clipPath={`url(#${clipId})`} style={{ pointerEvents: 'none' }}>
                    <g transform={`translate(${imgCx} ${imgCy}) rotate(${midDeg + 90})`}>
                      <image
                        href={imageUrl}
                        x={-imgW / 2}
                        y={-imgH / 2}
                        width={imgW}
                        height={imgH}
                        preserveAspectRatio="xMidYMid meet"
                      />
                    </g>
                    {fitted.lines.length > 0 && (
                      <g transform={`translate(${textPos.x} ${textPos.y}) rotate(${midDeg + 90})`}>
                        <text
                          x={0}
                          y={-((fitted.lines.length - 1) * fitted.lineHeight) / 2}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={fitted.fontSize}
                          fontWeight={800}
                          fill={WHITE}
                          stroke={PURPLE_DEEP}
                          strokeWidth={2.5}
                          strokeLinejoin="round"
                          paintOrder="stroke"
                          style={{ fontFamily: 'Nunito, sans-serif' }}
                        >
                          {fitted.lines.map((line, li) => (
                            <tspan key={li} x={0} dy={li === 0 ? 0 : fitted.lineHeight}>
                              {line}
                            </tspan>
                          ))}
                        </text>
                      </g>
                    )}
                  </g>
                </g>
              );
            }

            // No image — stack emoji + wrapped text centered on the slice.
            const arcWidth = Math.max(24, arcAtLabel * 0.92);
            const fitted = fitWheelLabel(rawLabel, arcWidth, { minFont: 8, maxFont: 15, maxLines: 3 });
            const textSize = fitted.fontSize;
            const lineH = fitted.lineHeight;
            const lineCount = fitted.lines.length;
            const emojiCap = lineCount >= 3 ? 22 : lineCount === 2 ? 28 : 36;
            const emojiSize = Math.max(18, Math.min(emojiCap, Math.floor(arcAtLabel / (2.6 + Math.max(0, lineCount - 1) * 0.6))));
            const gap = 2;
            const totalTextH = lineCount * lineH;
            const groupH = (emoji ? emojiSize : 0) + (emoji && lineCount ? gap : 0) + totalTextH;
            const startY = -groupH / 2;
            const emojiY = emoji ? startY + emojiSize / 2 : 0;
            const textStartY = startY + (emoji ? emojiSize + gap : 0) + lineH / 2;
            return (
              <g key={`${seg.id}-${i}`}>
                <path
                  d={path}
                  fill={color}
                  stroke={WHITE}
                  strokeWidth={2}
                  style={{ cursor: spinState === 'idle' ? 'pointer' : 'default' }}
                  onPointerDown={(e) => showTooltip(e, rawLabel)}
                  onPointerEnter={(e) => e.pointerType === 'mouse' && showTooltip(e, rawLabel)}
                  onPointerLeave={(e) => e.pointerType === 'mouse' && hideTooltip()}
                >
                  <title>{rawLabel}</title>
                </path>

                <g
                  transform={`translate(${labelPos.x} ${labelPos.y}) rotate(${midDeg + 90})`}
                  style={{ pointerEvents: 'none' }}
                >
                  {emoji && (
                    emojiHref ? (
                      <image
                        href={emojiHref}
                        x={-emojiSize / 2}
                        y={emojiY - emojiSize / 2}
                        width={emojiSize}
                        height={emojiSize}
                        preserveAspectRatio="xMidYMid meet"
                      />
                    ) : (
                      <text
                        x={0}
                        y={emojiY}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={emojiSize}
                      >
                        {emoji}
                      </text>
                    )
                  )}
                  {lineCount > 0 && (
                    <text
                      x={0}
                      y={textStartY}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={textSize}
                      fontWeight={800}
                      fill={WHITE}
                      stroke={RIM}
                      strokeWidth={2.4}
                      strokeLinejoin="round"
                      paintOrder="stroke"
                      style={{ fontFamily: 'Nunito, sans-serif' }}
                    >
                      {fitted.lines.map((line, li) => (
                        <tspan key={li} x={0} dy={li === 0 ? 0 : lineH}>
                          {line}
                        </tspan>
                      ))}
                    </text>
                  )}
                </g>
              </g>
            );
          })}




          {/* Lâmpadas do aro — creme × magenta (design final Kivid) */}
          {bulbs.map((b, i) => (
            <circle
              key={i}
              cx={b.x}
              cy={b.y}
              r={4.5}
              fill={i % 2 === 0 ? CREAM : RIM_BULB_MAGENTA}
              stroke={RIM}
              strokeWidth={0.75}
            />
          ))}

          {/* Hub estático é renderizado fora do SVG rotativo (ver overlay abaixo) */}
        </svg>

          {/* Hub estático — marca Kivid, não gira junto com a roleta */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: size * 0.235,
              height: size * 0.235,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={kividMark}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                filter: 'drop-shadow(0 1px 4px rgba(94, 15, 63, 0.28))',
              }}
            />
          </div>
        </div>

        {/* Tooltip with the full prize name — overlay, does not affect slice layout */}
        {tooltip && spinState === 'idle' && (
          <div
            role="tooltip"
            aria-live="polite"
            style={{
              position: 'absolute',
              left: tooltip.x,
              top: tooltip.y - 12,
              transform: 'translate(-50%, -100%)',
              background: PURPLE_DEEP,
              color: WHITE,
              padding: '6px 12px',
              borderRadius: 10,
              fontFamily: 'Nunito, sans-serif',
              fontSize: 13,
              fontWeight: 700,
              lineHeight: 1.2,
              maxWidth: 220,
              textAlign: 'center',
              whiteSpace: 'normal',
              wordBreak: 'break-word',
              pointerEvents: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
              zIndex: 5,
            }}
          >
            {tooltip.text}
          </div>
        )}
      </div>


      {/* Spin button / status */}
      <div
        ref={bottomBlockRef}
        className="mt-3 sm:mt-6 flex flex-col items-center gap-3 sm:gap-4 w-full max-w-sm px-2 shrink-0"
        style={{ marginBottom: 'max(20px, env(safe-area-inset-bottom))' }}
      >


        <button
          type="button"
          onClick={handleSpin}
          disabled={spinState !== 'idle'}
          aria-label={
            spinState === 'idle' ? 'Girar a roleta'
              : spinState === 'requesting' ? 'Sorteando'
                : spinState === 'spinning' ? 'Girando'
                  : 'Prêmio revelado'
          }
          className={`kv-btn kv-btn-spin ${spinState === 'idle' ? 'kv-btn-spin--idle' : 'kv-btn-spin--busy'}`}
          style={{
            border: 'none',
            borderRadius: spinBtnSize * 0.32,
            width: spinBtnSize,
            height: spinBtnSize,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: spinState === 'idle' ? 'pointer' : 'not-allowed',
            visibility: spinState === 'landed' ? 'hidden' : 'visible',
          }}
        >
          {spinState === 'idle' && <RotateCw size={spinBtnSize * 0.42} strokeWidth={2.6} color={WHITE} aria-hidden="true" />}
          {(spinState === 'requesting' || spinState === 'spinning') && (
            <Loader2 size={spinBtnSize * 0.42} strokeWidth={2.6} color={PITAYA_800} className="animate-spin" aria-hidden="true" />
          )}
        </button>
        {spinState !== 'landed' && (
          <p className="text-xs sm:text-base text-center" style={{ color: PURPLE, fontWeight: 600 }}>
            {spinState === 'requesting' && 'Sorteando…'}
            {spinState === 'spinning' && <EmojiText>Boa sorte! 🍀</EmojiText>}
            {spinState === 'idle' && (
              !multiChance
                ? 'Toque em girar. Você só tem uma chance!'
                : chancesLeft >= totalChances
                  ? <EmojiText>{`Toque em girar. São ${totalChances} chances até você levar um prêmio! 🍀`}</EmojiText>
                  : chancesLeft > 0
                    ? <EmojiText>{`Ainda dá! ${chancesLeft === 1 ? 'Falta 1 chance' : `Faltam ${chancesLeft} chances`}. Vai que é dessa vez! 🍀`}</EmojiText>
                    : 'Suas chances acabaram por aqui.'
            )}
          </p>
        )}
      </div>


      {/* Prize reveal overlay — flat solid card */}
      {spinState === 'landed' && revealPrize && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 animate-reveal-backdrop overflow-y-auto"
          style={{ background: 'rgba(94, 15, 63, 0.85)' }}
          onClick={(e) => {
            // Fechar pelo backdrop → segue para a tela de resultado.
            if (e.target === e.currentTarget) dismissModal();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="kv-reveal-title"
            aria-describedby="kv-reveal-desc"
            tabIndex={-1}
            className="relative animate-reveal-pop w-full"
            style={{
              maxWidth: 380,
              background: '#FFFFFF',
              borderRadius: 24,
              border: `2px solid ${PURPLE}`,
              padding: '32px 20px 24px',
              textAlign: 'center',
              fontFamily: 'Nunito, sans-serif',
              outline: 'none',
            }}
          >
            <p
              aria-live="polite"
              style={{
                color: PURPLE,
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: 3,
                textTransform: 'uppercase',
                marginBottom: 6,
                marginTop: 4,
              }}
            >
              {revealPrize.is_consolation ? 'Quase lá!' : 'Você ganhou!'}
            </p>

            <div
              className="animate-reveal-emoji inline-block"
              aria-hidden="true"
              style={{ lineHeight: 1, margin: '4px 0 12px' }}
            >
              <Emoji emoji={revealPrize.is_consolation ? '🍀' : (revealPrize.emoji || '🎁')} label="" size={76} />
            </div>

            <h2
              id="kv-reveal-title"
              className="text-2xl sm:text-[26px]"
              style={{
                fontWeight: 900,
                color: PURPLE_DEEP,
                lineHeight: 1.15,
                marginBottom: 8,
              }}
            >
              {revealPrize.is_consolation ? 'Não foi dessa vez!' : revealPrize.name}
            </h2>


            {revealPrize.is_consolation ? (
              <p id="kv-reveal-desc" className="text-[15px] sm:text-sm" style={{ color: '#6B4B7A', marginBottom: 20, lineHeight: 1.45 }}>
                {canRetry
                  ? <EmojiText>{`Essa não veio — mas você ainda tem ${retryLeft === 1 ? '1 chance' : `${retryLeft} chances`}. Bora de novo? 💜`}</EmojiText>
                  : <EmojiText>Não foi dessa vez — mas cada giro conta. Veja o que a gente preparou pra você. 💜</EmojiText>}
              </p>
            ) : (
              revealPrize.description ? (
                <p id="kv-reveal-desc" className="text-[15px] sm:text-sm" style={{ color: '#6B4B7A', marginBottom: 20, lineHeight: 1.4 }}>
                  {revealPrize.description}
                </p>
              ) : (
                <span id="kv-reveal-desc" className="sr-only">Prêmio revelado. Use o botão abaixo para continuar.</span>
              )
            )}


            <button
              type="button"
              onClick={canRetry ? handleSpinAgain : handleContinue}
              className="kv-btn kv-btn-continue w-full"
              style={{
                border: 'none',
                borderRadius: 999,
                padding: '20px 24px',
                fontSize: 17,
                fontWeight: 900,
                letterSpacing: 0.5,
                cursor: 'pointer',
                textTransform: 'uppercase',
                minHeight: 60,
              }}
            >
              {canRetry
                ? 'Girar de novo →'
                : revealPrize.is_consolation
                  ? 'Continuar →'
                  : 'Pegar meu prêmio →'}
            </button>
            <p className="text-[13px]" style={{ color: '#8A6BA0', marginTop: 10 }}>
              {canRetry
                ? <EmojiText>{`${retryLeft === 1 ? 'Última chance' : `Você ainda tem ${retryLeft} chances`} — cada giro pode ser o da sorte! ✨`}</EmojiText>
                : revealPrize.is_consolation
                  ? <EmojiText>A próxima roleta pode ter o prêmio que você quer. ✨</EmojiText>
                  : 'Falta só um passo para resgatar.'}
            </p>
          </div>
        </div>

      )}

      <style>{`
        /* ── Interações Kivid — hover / active / focus visíveis sobre branco ── */
        .kv-btn {
          transition: transform 120ms ease, background-color 160ms ease,
                      color 160ms ease, box-shadow 160ms ease, filter 160ms ease;
          outline: none;
        }
        .kv-btn:focus-visible {
          outline: 3px solid ${PITAYA_400};
          outline-offset: 3px;
          box-shadow: 0 0 0 6px ${PITAYA_100};
        }
        .kv-btn:disabled { cursor: not-allowed; }

        /* Botão principal — Girar. Squircle com gradiente sutil (topo mais
           claro → base mais escura) + linha fina e clara só na borda de
           cima: sugere uma superfície convexa ("isso empurra") sem sair do
           flat design — mesma técnica de fintech/gamificação, sem o gloss
           realista de caça-níquel. */
        .kv-btn-spin--idle {
          background: linear-gradient(180deg, ${PITAYA_500} 0%, ${PITAYA_700} 100%);
          box-shadow: inset 0 1.5px 0 rgba(255,255,255,0.45), 0 6px 14px rgba(148, 41, 113, 0.28);
        }
        .kv-btn-spin--idle:hover {
          background: linear-gradient(180deg, ${PITAYA_600} 0%, ${PITAYA_800} 100%);
        }
        .kv-btn-spin--idle:active {
          background: linear-gradient(180deg, ${PITAYA_700} 0%, ${PITAYA_900} 100%);
          box-shadow: inset 0 1.5px 0 rgba(255,255,255,0.3), 0 3px 8px rgba(148, 41, 113, 0.28);
          transform: scale(0.96);
        }
        .kv-btn-spin--busy {
          background: linear-gradient(180deg, ${WHITE} 0%, ${PITAYA_100} 100%);
          box-shadow: inset 0 1.5px 0 rgba(255,255,255,0.8), 0 4px 10px rgba(148, 41, 113, 0.14);
        }

        /* Botão do card de prêmio — Resgatar */
        .kv-btn-continue {
          background: ${PURPLE};
          color: ${WHITE};
        }
        .kv-btn-continue:hover {
          background: ${PURPLE_DEEP};
        }
        .kv-btn-continue:active {
          background: ${PITAYA_900};
          transform: scale(0.97);
        }
        .kv-btn-continue:focus-visible {
          outline-color: ${PITAYA_600};
          box-shadow: 0 0 0 6px rgba(207, 58, 157, 0.18);
        }

        @keyframes coin-fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translateY(120vh) rotate(720deg); opacity: 0.6; }
        }
        .animate-coin-fall { animation-name: coin-fall; animation-timing-function: linear; animation-iteration-count: 1; }


        @keyframes reveal-backdrop {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-reveal-backdrop { animation: reveal-backdrop 0.35s ease-out both; }

        @keyframes reveal-pop {
          0%   { opacity: 0; transform: scale(0.3) rotate(-8deg); }
          55%  { opacity: 1; transform: scale(1.08) rotate(2deg); }
          75%  { transform: scale(0.97) rotate(-1deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        .animate-reveal-pop { animation: reveal-pop 0.75s cubic-bezier(0.34, 1.56, 0.64, 1) both; }

        @keyframes reveal-emoji {
          0%   { transform: scale(0) rotate(-180deg); }
          60%  { transform: scale(1.25) rotate(15deg); }
          100% { transform: scale(1) rotate(0); }
        }
        .animate-reveal-emoji { animation: reveal-emoji 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both; }

        @keyframes reveal-glow {
          0%, 100% { opacity: 0.6; }
          50%      { opacity: 1; }
        }
        .animate-reveal-glow { animation: reveal-glow 2s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .animate-coin-fall { animation: none !important; display: none; }
          /* Substitui pop/rotate/glow por um fade curto e sutil */
          .animate-reveal-backdrop { animation: reveal-fade 0.2s ease-out both !important; }
          .animate-reveal-pop      { animation: reveal-fade 0.25s ease-out both !important; }
          .animate-reveal-emoji    { animation: reveal-fade 0.25s ease-out 0.05s both !important; }
          .animate-reveal-glow     { animation: none !important; }
        }
        @keyframes reveal-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default RouletteScreen;

