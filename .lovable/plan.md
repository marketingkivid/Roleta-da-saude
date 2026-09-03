## Objetivo

Adicionar feedback tátil (vibração) durante o giro da roleta para reforçar a sensação de "clique" a cada pipoca passando pelo ponteiro e marcar o momento em que a roleta para.

## Onde acontece

Tudo em `src/screens/RouletteScreen.tsx`, dentro da função `handleSpin` e da animação de rotação já existente. Nenhuma mudança visual, nenhum novo componente.

## Comportamento proposto

1. **Toque de largada** — ao pressionar "Girar", um pulso curto (~15 ms) para confirmar o comando.
2. **Tick por segmento** — durante o giro, disparar uma vibração muito curta (~8 ms) cada vez que o centro de uma pipoca cruza o ponteiro superior. Como a roleta desacelera, os ticks ficam naturalmente mais espaçados no fim — igual a uma roleta real de feira.
3. **Buzz de parada** — quando a roleta trava no prêmio:
  - Prêmio normal: padrão comemorativo `[20, 30, 40, 50, 60]` (vibra-pausa-vibra…).
  - "Não foi dessa vez": pulso único mais suave `[30]`.
4. **Respeito a preferências** — se `prefers-reduced-motion: reduce` estiver ativo, nenhuma vibração é emitida (mesma regra que já pula as 8 voltas dramáticas hoje).

## Detalhes técnicos

- Usar `navigator.vibrate(...)` com guarda `typeof navigator !== 'undefined' && 'vibrate' in navigator`.
- Criar helper local `haptic(pattern)` que checa suporte + reduced-motion antes de vibrar, para manter o código limpo.
- Ticks por segmento: calcular via `requestAnimationFrame` durante os ~6 s de animação, comparando o ângulo atual da roda (interpolado com a mesma curva de easing usada no CSS `transition: transform`) contra os centros dos segmentos. Alternativa mais simples e igualmente convincente: agendar os ticks com `setTimeout` seguindo uma curva de desaceleração pré-calculada — decidir na implementação por qual for mais estável.
- Cancelar qualquer vibração pendente (`navigator.vibrate(0)`) e limpar timers no `useEffect` de cleanup e ao desmontar, para não deixar o telefone vibrando se o usuário sair da tela.

## Escopo e limites

- **Android/Chrome**: funciona nativamente.
- **iOS/Safari**: a Vibration API **não é suportada** pela Apple. Não há workaround puro em web — nada será perceptível no iPhone. O código simplesmente ignora sem erro.
- Sem novas dependências, sem mudança de UI, sem toggle de configuração (pode ser adicionado depois se você quiser um botão "silenciar vibração").

## Arquivo afetado

- `src/screens/RouletteScreen.tsx`