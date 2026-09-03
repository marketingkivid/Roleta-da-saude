// Tema visual da roleta — fonte única de verdade para a roleta ao vivo
// (RouletteScreen) e para as prévias do admin (RouletteWheelPreview / WheelConfig).
// Referência: imagem final aprovada da roleta.
//
// Regra: a roleta SEMPRE alterna magenta × lavanda, independente do token de cor
// escolhido por prêmio no admin.

export const WHEEL = {
  sliceMagenta: '#A72F86',
  sliceLavender: '#A98CDB',
  rim: '#6E1F3C',            // aro vinho escuro (flat — sem gradiente)
  rimEdge: '#8A2A50',        // linha do aro
  bulbCream: '#FFF7E1',
  bulbMagenta: '#C63C99',
  pointer: '#C0338F',
  divider: '#FFFFFF',        // separador entre fatias
  labelFill: '#FFFFFF',
  labelStroke: '#6E1F3C',    // contorno sutil p/ leitura sobre lavanda
} as const;

/** Cor da fatia i — alternância fixa magenta × lavanda. */
export const sliceColor = (i: number): string =>
  i % 2 === 0 ? WHEEL.sliceMagenta : WHEEL.sliceLavender;
