# findings.md — Pesquisa, descobertas e constraints

## Ambiente da máquina (2026-06-13)
- OS: Windows 10 Pro (19045)
- Node: v24.15.0
- npm: 11.12.1
- git: 2.53.0 (windows)
- PostgreSQL: **ausente** (psql não encontrado)
- Docker: **ausente**
- Pasta do projeto: c:\Users\Team WOD Brasil\Desktop\ECLAT (vazia no início)

## Constraints / pontos de atenção
- **Postgres obrigatório:** Medusa v2 exige PostgreSQL. Sem psql nem Docker local — decidir como provisionar:
  (a) instalar PostgreSQL nativo no Windows, (b) instalar Docker Desktop e subir Postgres em container,
  ou (c) usar um Postgres gerenciado (ex.: o próprio Supabase como banco do Medusa — avaliar implicação de manter
  Medusa e Supabase no mesmo cluster vs. separados). **PENDENTE de decisão do usuário.**
- **Node 24:** mais novo que o oficialmente recomendado pelo Medusa v2 (Node 20/22 LTS). Risco de incompatibilidade
  em dependências nativas. Mitigação: usar nvm-windows para fixar Node 22 LTS se o scaffold falhar.
- **Supabase:** projeto a provisionar no painel supabase.com (precisa login do usuário). Variáveis: SUPABASE_URL,
  SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL. Conexão testável sem criar tabelas na Fundação.
- **Mercado Pago:** apenas fase futura (Parte 4). Não implementar na Fundação.

## Decisões tomadas (2026-06-13)
1. PostgreSQL: **nativo no Windows** (instalar via winget/EDB). Não usar Docker nem Supabase como DB do Medusa.
2. Node: **tentar primeiro com Node 24**; plano B = Node 22 LTS via nvm-windows se houver falha em dependência nativa.
3. Supabase: projeto a ser criado manualmente pelo usuário (requer login). Pendente quando chegar no passo 6 da Fundação.

## Ferramentas de instalação disponíveis
- winget v1.28.240 e choco v2.7.1 presentes — usar winget para instalar o PostgreSQL.

## Marca — tokens visuais (referência para Tailwind)
- Paleta "luz/resplendor": neutros sofisticados (off-white, areia, grafite) + dourado suave (accent).
- Tipografia: serif editorial para títulos, sans limpa para texto.
- A definir valores hex exatos na aplicação dos tokens.

## 2026-07-26 — Pesquisa: IA para criação própria de peças (design → piloto)
Stack recomendado p/ ÉCLAT (barato, leigo-friendly):
- Tendências: Pinterest Predicts (grátis, ~88% acerto) + TikTok/IG; Heuritech/WGSN = caro, pular.
- Design/render: The New Black (packs $5-10, Pro $50/mês — design+try-on+tech pack+vídeo) OU NewArc.ai (sketch→foto).
- Estampas seamless: PatternedAI / Pattern Weaver (export 8K print-ready).
- Modelagem/simulação 3D: CLO 3D ($50/mês ou $225/ano, padrão da indústria, curva média) OU Tailornova ($49/mês, browser, iniciante, gera molde+gradação) OU Seamly2D (GRÁTIS, open-source, molde paramétrico multi-tamanho, sem simulação de caimento).
- Ficha técnica: geradores IA ($3-7/tech pack: aitechpacks.com, techpackgenerator.org) — SEMPRE revisar medidas antes da facção.
- Fotos/campanha: Botika ($22/mês Lite) ou Higgsfield (MCP já conectado no Claude!). 
- Peça piloto: facção local precisa de MOLDE (impresso/plotter) + FICHA TÉCNICA + tecido definido; ref. private label fitness: R2PB. IA não substitui pilotista — 1ª peça sempre ajusta em prova real.

## 2026-07-27 — DESIGN APROVADO: Conjunto 01 ÉCLAT (Flare Atelier)
- Conjunto off-white: blusa canelada manga longa costuras terracota COSTAS FECHADAS + calça flare cós alto off-white com vivos na cor RAMATEX LICOR 8316 (amostrada #D5823E) + nó ÉCLAT bordado no cós e etiqueta lettering terracota.
- Arquivos: docs/design/aprovados/CONJUNTO-01-*.png (frente/costas) + CALCA-01-*.png. Fotos geradas via Higgsfield (nano banana pro), modelo/estúdio consistentes p/ catálogo.
- Tecido a cotar: Ramatex Lightness ou Málaga; vivos em Licor 8316. Próximo: ficha técnica p/ facção.

## 2026-09-08 — F0 Benefício Conjunto
Spec: `docs/superpowers/specs/2026-09-08-beneficio-conjunto-design.md` (§6.3/§6.4) · Plano:
`docs/superpowers/plans/2026-09-08-conjunto-f0-prova-de-conceito.md` · Testes: `apps/backend/integration-tests/http/conjunto-poc.spec.ts`.

**Os quatro resultados (mais dois observacionais), todos com HTTP real contra Medusa 2.15.5:**
- **A** (1 top + 1 legging, sem divisão de linha): PASSOU. Desconto R$ 18,90 (10% do top, o mais barato), legging sem ajuste.
- **B** (Top ×2, 1 marcada, K=1 de N=2 — §6.3): PASSOU. Desconto R$ 18,90 (não R$ 37,80).
- **B2** (Top ×3, 2 marcadas, K=2 de N=3): PASSOU. Desconto R$ 37,80 (não R$ 56,70 nem R$ 18,90) — confirma que a divisão de contexto generaliza para K intermediário.
- **C** (cupom de itens `CUPOM10` com regra de exclusão `items.conjunto_desconto eq "nenhum"` — §6.4): PASSOU. `CONJUNTO-POC` = R$ 18,90 no top, `CUPOM10` = R$ 25,90 na legging, `discount_total` = R$ 44,80.
- **D** (cupom de pedido inteiro `PEDIDO10`, sem `target_rules`, sobre carrinho com `CONJUNTO-POC` já aplicado): observacional, R$ 42,91 — alcança a unidade em conjunto, mas incide sobre o subtotal já líquido (compounding), não duplica sobre o preço cheio.
- **D2** (tentativa de cupom de pedido `PEDIDO10X` **com** `target_rules`): REJEITADO pela Admin API nas duas tentativas de payload (sem `allocation`; com `allocation: across` + `max_quantity`) — `400 invalid_data`: `"Target rules for application method with target type (order) is not allowed"`.
- **Bônus** (empilhar `CUPOM10` sobre `PEDIDO10` já aplicado no mesmo carrinho — `POST /store/carts/{id}/promotions` é aditivo): `discount_total` combinado = R$ 85,12.
- **D3** (revisão final — payload que a F1 vai usar para CONVERTER cupom de pedido em cupom de itens, §6.4 "Decisão para a F1"): `PEDIDO10C` criado com `target_type: items`, `allocation: across`, **sem `max_quantity`**, `target_rules: [{attribute: "items.conjunto_desconto", operator: "eq", values: ["nenhum"]}]` — aceito pela Admin API de primeira (sem precisar do fallback `allocation: each` + `max_quantity: 1000`). Aplicado no carrinho top+legging: `PEDIDO10C` = R$ 25,90 (só na legging, fora do conjunto), `CONJUNTO-POC` = R$ 18,90 (intacto no top), `discount_total` = R$ 44,80 — igual ao caso C, confirmando que `across` sem `max_quantity` reparte o valor corretamente sobre a única unidade elegível.

**Achado da revisão final:** o brief original do §6.4 "Decisão para a F1" recomendava `allocation: across` + `max_quantity: 1000`, mas essa combinação é **inválida** — o motor rejeita `allocation: across` sempre que `max_quantity` está presente (`400 invalid_data`: "application_method.max_quantity is not allowed to be set for allocation (across)", `@medusajs/promotion/dist/utils/validations/application-method.js:51-54`). O payload correto (testado no caso D3) é `allocation: across` **sem** `max_quantity`. Regra geral registrada em §6.2 da spec: `allocation: across` nunca leva `max_quantity`; `allocation: each`/`once` sempre exige (§6.3).

**Achados do motor de promoções (Medusa 2.15.5), não documentados oficialmente:**
- `target_rules[].attribute` de uma promoção **automática** precisa do prefixo `"items."` (ex.: `"items.conjunto_desconto"`). Sem o prefixo, o pré-filtro SQL de promoções automáticas (`build-promotion-rule-query-filter-from-context.js`) descarta a promoção antes da avaliação de regra — desconto fica 0, sem qualquer erro. A avaliação de regra em si aceita os dois formatos (remove o prefixo antes de ler a propriedade do item), o que mascara o problema até alguém comparar contra o pré-filtro.
- `application_method.max_quantity` é obrigatório quando `allocation: "each"` (senão `400`) e precisa ser um valor ALTO (usamos `1000`) — com `max_quantity: 1` o próprio motor capa o desconto em 1 unidade (`maximumPromotionAmount = unitPrice * (max_quantity ?? 1)`), escondendo se a divisão de contexto do gancho está de fato funcionando.
- `disableAutoTeardown: true` é obrigatório no `medusaIntegrationTestRunner` sempre que um `describe`/spec cria catálogo/admin/promoção uma única vez em `beforeAll` e reusa em múltiplos `it()` — o `afterEach` padrão faz `TRUNCATE` em todas as tabelas após cada `it()`, e o segundo teste em diante falha com um 400 enganoso de "chave publicável inválida" (na verdade, tudo foi truncado).
- Admin: em 2.15.5 o fluxo `register` → `POST /admin/users` sempre responde 401 (Medusa Cloud/self-host não expõe mais essa rota pública). O único caminho viável para criar o primeiro admin em teste é direto pelos módulos: `container.resolve(Modules.USER).createUsers(...)` + `container.resolve(Modules.AUTH).createAuthIdentities(...)` + assinar o JWT com as mesmas claims que o middleware `authenticate` lê. Não foi preciso testar se a Admin API aceita `attribute` customizado fora de módulo — as promoções (que são o caso real de `attribute` customizado) foram criadas via Admin API pública (`POST /admin/promotions`) com sucesso, sem precisar do `promotionModuleService` diretamente.
- Store API: `POST /store/carts` aceita `metadata` direto no payload de criação (usado para `conjunto_poc_k` no caso B2) — não foi preciso o fallback `PATCH /store/carts/:id`.

**Comando completo para rodar a suíte de integração no Windows** (Postgres em Docker + `.env.test`):
```bash
# 1. Subir o Postgres de teste (uma vez; container fica no ar entre execuções)
cd apps/backend
npm_config_script_shell="C:\Program Files\Git\usr\bin\bash.exe" npm run test:db:up

# 2. Rodar a suíte HTTP (a partir de apps/backend; .env.test já aponta pra localhost:55432)
npm_config_script_shell="C:\Program Files\Git\usr\bin\bash.exe" npm run test:integration:http -- --verbose

# 3. (opcional) Derrubar o container ao terminar
npm_config_script_shell="C:\Program Files\Git\usr\bin\bash.exe" npm run test:db:down
```
O prefixo `npm_config_script_shell` é necessário porque os scripts `test:db:up`/`test:db:down`/
`test:integration:http` usam sintaxe `VAR=valor comando`, que o `cmd.exe` (shell padrão do npm no
Windows) não interpreta — aponta a chamada do `npm run` para o Git Bash só para essa execução,
sem alterar `.npmrc`/config global do npm.

## Pagamento — Mercado Pago no Medusa 2.15.5 (2026-09-17, F0 da Parte 4)
Lido no código instalado (`@medusajs/payment/dist/services/payment-module.js`, `@medusajs/core-flows/dist/payment/workflows/process-payment.js`):
- **O webhook reautoriza a sessão.** Com ação `captured` e sem `payment` ainda criado (caso do Pix: o pedido não existe), o `processPaymentWorkflow` roda `authorizePaymentSessionStep` → chama o `authorizePayment` do provider de novo → captura → conclui o carrinho. **Constraint:** `authorizePayment` tem que ser idempotente: se `data.mp_payment_id` existe, só consulta `GET /v1/payments/{id}` e mapeia o status; criar pagamento só quando não há id (cartão no "Finalizar pedido"). Sem isso, cobra duas vezes.
- **Pagamento não autorizado no `cart.complete`:** o módulo grava `status`/`data` na sessão e lança `Session: … was not authorized with the provider`. Se a gravação rodar dentro da transação que o erro desfaz, o `mp_payment_id` pode se perder → a proteção é a **chave de idempotência = id da sessão** (o Medusa já entrega em `context.idempotency_key`): repetir a criação devolve o mesmo pagamento no MP. Confirmar no sandbox (script `apps/backend/f0-mercadopago.mjs`, passo "idempotência").
- **A conclusão do carrinho pós-pagamento falha em silêncio:** `completeCartAfterPaymentStep` roda com `continueOnPermanentFailure: true`. Pagamento capturado + carrinho que não conclui (estoque esgotado, promoção vencida) = dinheiro recebido sem pedido e sem erro. **Constraint (D1):** o estorno automático não pode depender de exceção; é uma rotina de reconciliação que procura sessão capturada cujo carrinho não virou pedido → estorna no MP → alerta no Cockpit.
- Rota de webhook nativa: `POST /hooks/payment/{identifier}_{id}` → `pp_mercadopago_mercadopago` ⇒ `/hooks/payment/mercadopago_mercadopago`. O corpo bruto e os headers chegam em `getWebhookActionAndData({ data, rawData, headers })`.
- Valores: Medusa v2 e a API de Payments do MP usam reais decimais; centavos inteiros só na nossa borda (tarifa/DRE).

## Pagamento — Mercado Pago migrou o Checkout Transparente para a Orders API (2026-09-17)
Ao criar a aplicação no painel do MP em 17/09 ("eclat-checkout", solução Checkout Transparente), o campo "Tipo de API"
veio com **API de Orders** pré-selecionado — a API de Payments (`/v1/payments`) está marcada como **"legacy"** na doc
oficial (`developers/pt/docs/checkout-api-orders/*`). A spec (`2026-09-17-pagamento-mercadopago-design.md`) foi
reescrita para Orders API. Achados que não estavam na doc que eu conhecia:

- **Prefixo de teste é `APP_USR`, não `TEST-`.** Confirmado 2x na doc: "Para integrações com Checkout Transparente via
  Orders, a conta de teste vendedor é criada automaticamente após a criação da aplicação e suas credenciais passam a
  ser suas credenciais de teste. É por isso que seu Access Token de teste começa com o prefixo APP_USR." Isso vale só
  para apps criadas com "Tipo de API: Orders" — não confundir com uma credencial de produção de verdade.
- **Endpoint único cria e processa:** `POST /v1/orders` com `type:"online"`, `processing_mode:"automatic"|"manual"`,
  `external_reference`, `total_amount` (string decimal, ex. `"199.90"`), `payer:{email,first_name,identification}`,
  `transactions.payments[]:{amount, payment_method:{id,type,token?,installments?}}`. Cartão: `type:"credit_card"`,
  `id` = bandeira (`master`), `token` do Card Form/Brick. Pix: `type:"bank_transfer"`, `id:"pix"`, sem `token`.
- **Resposta da order** tem status geral (`status`/`status_detail`) e por transação (`transactions.payments[].status`).
  Tabela oficial completa de combinações em `checkout-api-orders/payment-management/status/order-status` — os que
  importam pro nosso mapa: `processed/accredited` (sucesso), `action_required/waiting_transfer` (Pix aguardando),
  `action_required/waiting_capture`, `canceled/canceled`, `expired/expired`, `failed/failed`, `refunded/refunded`,
  `charged_back/*`. **Não existe mais `pending`/`in_process` simples como na API de Payments** — vira `processing` ou
  `action_required` conforme o caso.
- **Pix na Orders API não devolve** `date_of_expiration` no request nem no response — o QR vem em
  `transactions.payments[0].payment_method.{qr_code, qr_code_base64, ticket_url}`, e a expiração parece ser a
  configurada na conta (painel "Taxas e parcelas"), não um parâmetro por chamada como era em `/v1/payments`.
  **Confirmar isso e o valor do prazo padrão na F0** — se não der pra fixar em 30 min por request, ajustar a copy da
  tela de Pix e a decisão D1 (o pedido só nasce quando paga, então o prazo real da conta é o que vale).
- **Webhook do evento "Order"** (não "Payment"): corpo `{action:"order.processed", type:"order", data:{id:"ORD...",
  status, status_detail, transactions:{payments:[...]}}}`. **A fórmula de assinatura (`x-signature`) é a mesma da API
  de Payments** — manifesto `id:{data.id em minúsculas};request-id:{x-request-id};ts:{ts};` + HMAC-SHA256. Confirmado
  literalmente na doc, inclusive o detalhe de forçar minúsculas no id (que é alfanumérico tipo `ORD01M28...`, não só
  dígitos como o id de payment clássico). O `assinaturaValida()` de `apps/backend/f0-mercadopago.mjs` já implementa
  isso certo — só reescrevi as chamadas HTTP do script, a assinatura não mudou.
- **Reembolso:** `POST /v1/orders/{order_id}/refund` — corpo vazio = total; `{amount, transaction_id}` = parcial. Uma
  order só fica `refunded` quando **todas** as transações estiverem 100% estornadas (não achei ainda se isso importa
  pro nosso caso de 1 transação por order — provavelmente não).
- **Em aberto para a F0 confirmar empiricamente:** (1) se `GET /v1/orders/{id}` traz a tarifa (`fee_details` não
  aparece nos exemplos da doc — pode exigir `GET /v1/payments/{payment_id}` complementar com o id `PAY...` de dentro
  da order); (2) o prazo de expiração padrão do Pix sandbox; (3) idempotência de `POST /v1/orders` com o mesmo
  `X-Idempotency-Key` (a doc de Orders não repete esse detalhe explicitamente como a de Payments).

## Pagamento — F0 rodada no sandbox real (2026-09-17, mesma tarde)
Script `apps/backend/f0-mercadopago.mjs` executado contra a conta de teste (site MLB) com credenciais `APP_USR-...`
da aplicação eclat-checkout. Corrige/confirma os pontos que ficaram em aberto na primeira leitura da doc:

- **`qr_code_base64` vem preenchido** no sandbox real (o exemplo da doc mostrava vazio — era só exemplo ilustrativo).
  Não precisa de fallback para gerar o QR a partir do `qr_code` manualmente.
- **`GET /v1/payments/{id}` não trouxe tarifa para o Pix pendente** (`fee_details` ausente) — esperado, a tarifa só é
  calculada quando o pagamento é liquidado. **Falta confirmar com um Pix/cartão realmente pago** (a F0 só testou
  cartão aprovado sem reconsultar `/v1/payments/{id}` depois — fazer isso na F1 antes de fechar o desenho da tarifa).
- **Idempotência confirmada:** a mesma `X-Idempotency-Key` em `POST /v1/orders` devolve a mesma order (mesmo `id`),
  cartão e Pix. Protege a reautorização que o Medusa faz quando o webhook chega (risco 1 da spec, §13).
- **`POST /v1/orders/{id}/cancel` exige `X-Idempotency-Key`** (400 sem o header) **e devolve 422 numa order
  `processing_mode: automatic` com transação Pix já embutida** — não é cancelável, porque nasce com a cobrança em
  andamento do lado do banco. Spec §6 ajustada: não cancelamos mais orders Pix "trocadas"; deixamos expirar.
- **Recusa de cartão não é um `status` normal — é HTTP 402** com corpo
  `{"errors":[{"code":"failed","message":"The following transactions failed","details":["PAY_ID: <status_detail>"]}],"data":{...order completa, status:"failed"...}}`.
  O `status_detail` da recusa fica dentro da string de `details[0]`, no formato `"PAY_ID: motivo"` — nosso parser de
  recusas (`recusas.ts`, §8) precisa extrair esse motivo daí, não de `dados.status_detail` direto (que só existe
  quando a resposta é 2xx). Confirmados nesta rodada: `rejected_by_issuer` (OTHE), `required_call_for_authorize`
  (CALL), `insufficient_amount` (FUND), `bad_filled_card_data` (SECU — nome ligeiramente diferente do documentado
  `cc_rejected_bad_filled_security_code`; usar o texto real observado no motivo genérico de "dados do formulário").
- **CONT (pendente) não dá erro:** volta 2xx normal com `status:"processing"`, `status_detail:"in_process"` — cai
  certinho no mapa de status da spec (§7).
- **Estorno total confirmado:** `POST /v1/orders/{id}/refund` com corpo vazio (mas idempotency key) devolveu
  `status:"refunded"` na order de um cartão aprovado.
- IDs de order em sandbox vêm com prefixo `ORDTST` (não só `ORD`) — não depender do prefixo exato em nenhuma
  validação, só tratar como string opaca.

## Pagamento — Como pegar a tarifa real com a Orders API (fechamento da F0, 2026-09-17)
`GET /v1/payments/{PAY_id}` com o id que vem dentro de `transactions.payments[].id` da order (formato `PAY01M2...`)
devolve **404** — é um espaço de IDs diferente do da API clássica de Payments, não é consultável por ali.

O caminho que funciona, testado no sandbox: **`GET /v1/payments/search?external_reference={valor}`**, usando o mesmo
`external_reference` que mandamos ao criar a order (nós vamos usar `cart.id`). Devolve um `results[]` com o pagamento
no formato clássico, **incluindo `fee_details`**:
```json
[{"amount":9.96,"fee_payer":"collector","type":"mercadopago_fee"},
 {"amount":22.71,"fee_payer":"collector","type":"financing_fee"}]
```
(exemplo de uma compra de R$ 199,90 em 4x: `total_paid_amount` da order veio R$ 222,61 — o valor com juros que a
cliente pagou — e a `financing_fee` de R$ 22,71 aparece cobrada do lojista (`fee_payer: "collector"`), quase o mesmo
valor do acréscimo. **Isso sugere que, nesta conta de teste, o parcelamento default está "com juros para a cliente E
com taxa de financiamento pro lojista" ao mesmo tempo — não necessariamente vai ser assim na conta real.** Quem
decide isso é a configuração "Taxas e parcelas" no painel do MP (D2 na spec) — o dono precisa olhar essa tela antes
do go-live pra confirmar quanto realmente sobra líquido por parcela; o código só lê e grava o que a API devolver,
nunca calcula/adivinha.

**Consequência para o F1:** o provider, depois que a order for aprovada (webhook ou resposta síncrona), faz um
`GET /v1/payments/search?external_reference={cart.id}` pra achar o registro com `fee_details` e gravar a tarifa real
em `payment.data`. Sem esse passo extra não tem como preencher a linha "Taxas de pagamento" do DRE.

## Pagamento — F1: o Medusa não reage sozinho a estorno/chargeback (2026-09-17, mesma tarde)
Lendo `@medusajs/medusa/dist/subscribers/payment-webhook.js` (v2.15.5): o assinante nativo do
webhook só chama o `processPaymentWorkflow` quando a ação devolvida por `getWebhookActionAndData`
é `"authorized"`, `"captured"` ou `"pending"` — para `"not_supported"`, `"canceled"`, `"failed"`
e `"requires_more"` ele **retorna sem fazer nada**. Ou seja: **não existe reação automática do
Medusa a um reembolso ou chargeback que chegue via webhook** — é sempre um efeito manual.
Consequência pro `service.ts`: quando a order vem `refunded`/`charged_back`, o provider grava um
`logger.warn(...)` como o único rastro até existir uma tela de alerta de verdade no Cockpit
(Fase F3). Isso também confirma que a decisão D1 (Pix pendente não faz nada até ser pago) já é o
comportamento natural do Medusa — não precisamos de nenhum código extra pra "segurar" um Pix
pendente, o próprio core já ignora a ação `pending` sem efeito colateral.

Outro achado da leitura de `@medusajs/payment/dist/services/payment-module.js`
(`createPaymentSession_`/`createPaymentSession`): o Medusa cria a linha do `PaymentSession` no
banco **antes** de chamar `initiatePayment`, e injeta o id dela em `input.data.session_id` —
não é algo que o provider tem que inventar. Por isso o `external_reference` da order do Mercado
Pago é esse `session_id` (não o `cart.id`, que era a suposição original da spec) — é assim que
`getWebhookActionAndData` acha de volta a sessão certa a partir de qualquer webhook.

## Pagamento — F1: módulo `mercadopago` escrito e testado (2026-09-17)
`apps/backend/src/modules/mercadopago/` (`dinheiro.ts`, `assinatura.ts`, `status.ts`,
`recusas.ts`, `cliente.ts`, `service.ts`, `index.ts`, `__tests__/`). Decisões técnicas tomadas
durante a escrita, não previstas na spec original:

- **Fetch cru em vez do SDK `mercadopago`** — documentado no topo de `cliente.ts`: a Orders API
  é recente, não confirmamos que o SDK npm cobre `/v1/orders`, e a F0 já validou fetch cru contra
  o sandbox real. Reavaliar se o SDK anunciar suporte explícito.
- **`capturePayment` é um no-op** — a Orders API já vem com `capture_mode: "automatic_async"`
  (visto na F0); não existe chamada de captura pra fazer.
- **`initiatePayment` exige `data.metodo` já definido** — decisão registrada como comentário no
  topo de `service.ts`: diferente do Stripe (cria intent vazia, confirma depois no navegador), a
  Orders API cria E processa a order na mesma chamada, então a vitrine (F2) só pode chamar
  `initiatePaymentSession` pro provider `mercadopago` depois que a cliente já escolheu Pix ou já
  tokenizou o cartão — nunca no simples clique do rádio.
- **`updatePayment` de cartão com valor mudado lança erro** (`NOT_ALLOWED`) em vez de tentar
  recobrar — recriar automaticamente cobraria a cliente sem o consentimento dela num valor
  diferente do que ela autorizou pelo Brick.
- Typecheck limpo (`npx tsc --noEmit`, zero erros no módulo) e 74 testes unitários novos (225 no
  total do backend, todos passando) via `npm run test:unit`.

**Pendente pra próxima Halt (F2 — vitrine):** nenhuma UI ainda; o contrato que a vitrine precisa
respeitar está documentado nos comentários de `service.ts` e no §5/§6 da spec.

