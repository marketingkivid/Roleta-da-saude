# Campanha "Gira Kivid" — Roleta da Saúde

Briefing de campanha evergreen para a Roleta da Saúde, voltado ao segmento **Ativos** (clientes com plano Kivid vigente). Pronto para ser usado como base de preenchimento no Admin (`/admin`) e como referência de copy para o time de marketing.

---

## 1. Conceito

**Nome da campanha:** Gira Kivid
**Assinatura/tagline:** "A roleta de recompensas de quem já é da família."
**Slug sugerido:** `gira-kivid`

**Posicionamento:** diferente das campanhas sazonais (Kintou com Saúde, Convocação Kivid), a Gira Kivid não tem data de início/fim — ela roda continuamente como um mecanismo de agradecimento e retenção para quem já é cliente. Em vez de vender a entrada no Kivid, ela reforça a permanência: "você já decidiu bem, agora colhe os benefícios disso".

**Objetivos:**
- Aumentar percepção de valor contínuo do plano (reduzir churn)
- Estimular renovação antecipada e upgrade
- Gerar indicações (member-get-member) usando o giro como incentivo
- Coletar sinal de satisfação (quem gira e resgata tende a estar engajado)

**Tom de voz:** caloroso, de gratidão, sem urgência artificial. Evitar linguagem de "última chance" — o tom é "valeu por estar com a gente", não "não perca".

---

## 2. Público e gatilhos de disparo

Como a campanha é evergreen (sem data fixa), o link individual de participação é disparado por **eventos do ciclo de vida do cliente ativo**, não por um calendário de campanha:

| Gatilho | Quando disparar | Canal sugerido |
|---|---|---|
| Aniversário de plano | 6, 12, 24 meses de permanência | E-mail + WhatsApp |
| Aniversário do cliente | Mês de nascimento | E-mail |
| Indicação concluída | Amigo indicado assina um plano | WhatsApp |
| Pesquisa de satisfação respondida | Após resposta de NPS/CSAT | E-mail |
| Renovação antecipada | Cliente renova antes do vencimento | WhatsApp |

Cada disparo gera um **token individual único** (campanha oficial → 1 giro por link, conforme regra de `campaign_spins` unicidade por `campaign_id + lead_ref`). Isso permite manter a campanha sempre ativa sem precisar reimportar uma lista de participantes de uma vez só — o time de CRM importa em lotes conforme os gatilhos disparam.

**Campanha de teste espelho:** criar `gira-kivid-teste` (switch "Campanha de teste" ativado) para validar copy, prêmios e probabilidades internamente antes de cada lote de disparo, já que giros ilimitados nessa instância não afetam estoque real.

---

## 3. Configuração no Admin

| Campo | Valor sugerido |
|---|---|
| Nome da campanha | Gira Kivid |
| Slug | `gira-kivid` |
| Status | Ativa |
| Campanha de teste | Desligado (instância separada para testes) |
| Lista de participantes | Importação recorrente por gatilho (nome, e-mail, WhatsApp) |
| Giro único | Sim (regra padrão de campanha oficial) |

---

## 4. Prêmios

Mix de **desconto no plano** + **brindes/cupons**, como definido. Cores sugeridas seguem a paleta oficial de fatias do guia de estilo (círculo cromático, tons quentes e frios alternados). Ajuste estoques e probabilidades conforme orçamento e margem — os números abaixo são ponto de partida.

| # | Prêmio | Descrição (até 300 car.) | Emoji | Cor da fatia | Probabilidade |
|---|---|---|---|---|---|
| 1 | 15% de desconto na renovação | Desconto aplicado automaticamente na sua próxima renovação Kivid | 💳 | Pitaya 500 `#E645B0` | 20% |
| 2 | 10% de desconto na renovação | Desconto aplicado na sua próxima renovação Kivid | 🎟️ | Tangerine 500 `#FF8B59` | 20% |
| 3 | Kit bem-estar Kivid | Kit físico com itens de cuidado e saúde do dia a dia, entregue no seu endereço | 🎁 | Mango 500 `#FABE57` | 12% |
| 4 | Cupom parceiro de saúde | Desconto em farmácia ou academia parceira Kivid | 🏋️ | Pear 500 `#3DCC78` | 15% |
| 5 | 1 mês adicional no plano | Um mês extra de benefício, sem custo, somado ao seu ciclo atual | ➕ | Java 500 `#43C1E0` | 10% |
| 6 | Avaliação de saúde gratuita | Consulta ou avaliação gratuita com parceiro Kivid | 🩺 | Grape 500 `#7A50D9` | 10% |
| — | Consolação: "Não foi dessa vez" | — | 🍀 | Chia 300 `#EBF2F2` | 13% |

Soma dos prêmios: 87% · Consolação: 13% (configurar em "Etapa Consolação" com 1 fatia).

**Observação:** os percentuais de desconto (10–15%) são mais baixos que os da Kintou com Saúde/TBT do Passaporte (10–50%) porque aqui o público já é cliente ativo — o objetivo é reforço de vínculo, não conversão de entrada. Validar com financeiro antes de publicar.

---

## 5. Ajuste necessário na tela de consolação

O fluxo público hoje redireciona "Não foi dessa vez" para `kivid.com.br/simulador` (CTA "Ver mais ofertas →"), pensado para quem ainda não é cliente. Para o público Ativos isso não faz sentido — sugiro:

- **CTA alternativo:** "Conhecer outros benefícios Kivid →" apontando para a página de vantagens/benefícios do cliente ativo (ou `wa.me` do suporte, se essa página não existir ainda)
- Isso exige que o redirecionamento da tela de consolação seja configurável por campanha (hoje está fixo no componente `ConsolationScreen`) — repassar ao time de desenvolvimento como ajuste técnico necessário antes do disparo da Gira Kivid.

---

## 6. Copy das telas

**Landing (`LandingScreen`)**
- Headline: "Girou, ganhou. Assim é ser Kivid."
- Subheadline: "Um agradecimento por você continuar com a gente. Gire agora e resgate seu prêmio."
- CTA: "Girar a roleta"

**Formulário de resgate (`ValidationScreen`, pós-vitória)**
- Aviso de prêmio: "Você ganhou: [nome do prêmio]"
- Texto de apoio: "Confirme seus dados para a gente te enviar o resgate."

**Tela de prêmio (`RewardScreen`)**
- Título: "Prêmio garantido!"
- Corpo: "Seu resgate já está com a gente. Toque no botão abaixo para confirmar pelo WhatsApp."
- CTA: "Resgatar meu prêmio"

**Mensagem de WhatsApp (pós-resgate)**
> Oi, [nome]! 🍀 Aqui é da Kivid. Vimos que você girou a roleta Gira Kivid e ganhou: [prêmio]. Vamos confirmar seu resgate por aqui mesmo — pode ser?

**Tela de consolação (`ConsolationScreen`)**
- Título: "Não foi dessa vez"
- Corpo: "Mas o seu lugar na Kivid continua garantido — e com ele, muito mais benefícios."
- CTA: "Conhecer outros benefícios Kivid →"

**Já participou (`AlreadyPlayedScreen`)**
- Título: "Você já girou por aqui!"
- Corpo: "Guarda essa recompensa com carinho — a Kivid sempre tem novidade chegando pra você."

---

## 7. Convite de disparo (e-mail/WhatsApp para o cliente ativo)

**Assunto (e-mail):** Um giro de agradecimento por você estar com a Kivid 🍀

**Corpo:**
> [Nome], já faz [X meses/anos] que você está com a gente — e isso merece uma comemoração. Preparamos a Roleta Gira Kivid só para clientes como você. É rapidinho: um giro, um prêmio garantido.
> [Botão: Girar agora]

**WhatsApp (versão curta):**
> Oi, [nome]! 🎉 Preparamos uma roleta de agradecimento só pra quem já é Kivid. Gira aqui: [link] — tem prêmio garantido!

---

## 8. Métricas a acompanhar no Dashboard

- Taxa de abertura do link → giro (engajamento do convite)
- Taxa de giro → resgate concluído
- Distribuição de prêmios sorteados vs. configurado (conferir se os pesos estão sendo respeitados)
- Correlação entre participação na Gira Kivid e renovação/indicação nos 30–60 dias seguintes
- Volume de indicações geradas via gatilho "indicação concluída"

---

## 9. Checklist antes de publicar

- [ ] Instância de teste (`gira-kivid-teste`) validada internamente
- [ ] Ajuste de CTA de consolação implementado (não apontar para `/simulador`)
- [ ] Percentuais de desconto validados com financeiro
- [ ] Estoque de brindes físicos confirmado com fornecedor/logística
- [ ] Mensagens de WhatsApp aprovadas (tom e link de resgate)
- [ ] Exportação CSV (formato Brevo) testada para os primeiros lotes de participantes
- [ ] Cores das fatias conferidas contra a paleta institucional (nenhuma cor hardcoded fora dos tokens)
