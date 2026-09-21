# Avisos de entrega (webhook da SuperFrete) — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** receber os avisos de status da SuperFrete, preencher o código de rastreio que falta no pedido e avisar a cliente quando o pacote é postado e quando é entregue.

**Architecture:** uma rota no backend (`POST /webhooks/superfrete`), irmã da que já existe para o Brasil NFe: valida a assinatura sobre o corpo cru, acha o pedido pelo número que nós mesmos mandamos na etiqueta, grava o estado no pedido e dispara WhatsApp (Evolution) e e-mail (módulo Resend). A regra de negócio vive em funções puras testáveis; a rota só orquestra.

**Tech Stack:** Medusa 2.15.5 (TypeScript, Jest + `@medusajs/test-utils`), Evolution API (WhatsApp), Resend (e-mail), API de webhooks da SuperFrete.

**Spec:** `docs/superpowers/specs/2026-09-20-avisos-entrega-superfrete-design.md` — leia antes de qualquer task.

## Global Constraints

- Trabalhar só na worktree `eclat-wt-frete` (branch `feat/frete-superfrete`). Nunca push, nunca `git stash`.
- **Nunca chamar a API real da SuperFrete** em teste: tudo com `fetch` simulado ou dependências injetadas. Nunca ler nenhum arquivo `.env*`.
- O repositório é **público**: nenhum token, segredo, URL de produção, CEP, endereço ou documento. Só nomes de variável.
- Textos de cliente em pt-BR, na voz da Éclat: curtos, calorosos, sem exclamação em excesso, sem emoji além dos que o projeto já usa nas mensagens de despacho.
- Dinheiro em centavos inteiros (não há dinheiro nesta fase, mas a regra vale se aparecer).
- Nada nesta fase pode derrubar o backend: sem o segredo configurado, a rota responde 200 e não faz nada.
- Commits: assunto, LINHA EM BRANCO, trailer `Co-Authored-By` que as instruções da sessão do implementador derem. Um commit por task.

## Achados do levantamento (já verificados no código — não re-derivar)

1. **Corpo cru:** `src/api/middlewares.ts:88` já registra `{ methods: ["POST"], matcher: "/webhooks/brasilnfe", bodyParser: { preserveRawBody: true } }` e expõe `req.rawBody`. O comentário ao lado avisa: tem de ser `methods` (plural); com `method` funciona por acidente.
2. **Assinatura:** `src/lib/fiscal/fiscal-webhook.ts` tem `assinaturaValida(corpoBruto, header, segredo)` — HMAC-SHA256 hex com prefixo `sha256=`, comparação em tempo constante, e recusa tudo se não houver segredo. É o modelo, mas **a SuperFrete não documenta o formato** do header `X-ME-Signature` (hex? base64? com prefixo?), então a Task 1 aceita as formas plausíveis.
3. **E-mail:** o subscriber `src/subscribers/pedido-confirmado.ts` mostra o caminho: `container.resolve(Modules.NOTIFICATION).createNotifications({ to, channel: "email", template, trigger_type, resource_type, resource_id, ... })`, com uma chave de idempotência. Templates em `src/modules/resend/templates/` (`layout.ts` + `pedido-confirmado.ts`).
4. **WhatsApp:** `src/lib/evolution.ts` exporta `evolutionConfigured()` e `sendWhatsappText(number, text, delayMs)`.
5. **Buscar pedido:** `query.graph({ entity: "order", fields: [...], filters: {...} })`, como no subscriber.
6. **A etiqueta leva o número do pedido:** o Cockpit manda `options.tags: [{ tag: String(display_id) }]` ao criar o frete, e a SuperFrete devolve `data.tags[]` no aviso.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `apps/backend/src/lib/superfrete-webhook.ts` (novo) | Funções puras: assinatura, leitura do número do pedido, decisão por evento |
| `apps/backend/src/lib/superfrete-webhook.test.ts` → na verdade `src/lib/__tests__/superfrete-webhook.unit.spec.ts` (novo) | Unidade das funções puras |
| `apps/backend/src/lib/superfrete-avisos.ts` (novo) | Textos das mensagens (WhatsApp) num arquivo só, para o dono revisar |
| `apps/backend/src/api/webhooks/superfrete/route.ts` (novo) | A rota: valida, acha o pedido, grava, envia, responde |
| `apps/backend/src/api/middlewares.ts` (modificar) | Uma linha: corpo cru para `/webhooks/superfrete` |
| `apps/backend/src/modules/resend/templates/pedido-postado.ts` (novo) | E-mail de "pedido postado" |
| `apps/backend/src/modules/resend/templates/index.ts` ou service (modificar) | Registrar o template novo (seguir como `pedido-confirmado` é registrado) |
| `apps/backend/integration-tests/http/frete-webhook.spec.ts` (novo) | Integração da rota |
| `apps/backend/ativar-webhook-superfrete.mjs` (novo) | Cadastrar/remover o webhook na conta da SuperFrete |
| `architecture/envios.md`, `progress.md` (modificar) | SOP e roteiro |

---

### Task 1: Funções puras do webhook

**Files:**
- Create: `apps/backend/src/lib/superfrete-webhook.ts`
- Test: `apps/backend/src/lib/__tests__/superfrete-webhook.unit.spec.ts`

**Interfaces:**
- Produces:
  - `type EventoSuperfrete = "order.created" | "order.released" | "order.generated" | "order.posted" | "order.delivered" | "order.cancelled"`
  - `type AcaoDoEvento = { gravar: true; aviso: "generated" | "posted" | "delivered" | null; canais: ("whatsapp" | "email")[] }`
  - `assinaturaSuperfreteValida(corpoBruto: Buffer | string | undefined, header: string | undefined, segredo: string | undefined): boolean`
  - `numeroDoPedido(data: unknown): number | null`
  - `acaoDoEvento(evento: string): AcaoDoEvento | null`
  - `rastreioDoEvento(data: unknown): { tracking: string; tracking_url: string }`

**Notas de projeto (leia antes de escrever o teste):**
- A SuperFrete diz apenas "assinatura HMAC-SHA256 gerada usando o corpo da requisição e o secret_token", sem dizer a codificação. Para a integração não nascer morta, `assinaturaSuperfreteValida` aceita **qualquer uma** destas formas do mesmo HMAC: hex puro, hex com prefixo `sha256=`, base64 puro, base64 com prefixo `sha256=`. Isso não enfraquece nada: sem o segredo ninguém produz nenhuma delas. Cada candidato é comparado em **tempo constante** (`timingSafeEqual`, conferindo o tamanho antes). Sem segredo, sem header ou sem corpo → `false`.
- `numeroDoPedido` lê `data.tags[]` e devolve o **primeiro** `tag` que seja um inteiro positivo; qualquer outra coisa (ausente, vazio, texto, negativo) → `null`.
- `acaoDoEvento` é a tabela da spec §4.1. Evento desconhecido → `null`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { createHmac } from "node:crypto"
import { acaoDoEvento, assinaturaSuperfreteValida, numeroDoPedido, rastreioDoEvento } from "../superfrete-webhook"

const SEGREDO = "segredo-de-teste"
const CORPO = JSON.stringify({ event: "order.posted", data: { id: "abc" } })
const hmac = (cod: "hex" | "base64") => createHmac("sha256", SEGREDO).update(CORPO).digest(cod)

describe("assinatura do webhook da SuperFrete", () => {
  it("aceita as formas plausíveis do mesmo HMAC (a doc não diz qual é)", () => {
    for (const header of [hmac("hex"), `sha256=${hmac("hex")}`, hmac("base64"), `sha256=${hmac("base64")}`]) {
      expect(assinaturaSuperfreteValida(CORPO, header, SEGREDO)).toBe(true)
    }
  })

  it("recusa assinatura de outro segredo, corpo alterado e lixo", () => {
    expect(assinaturaSuperfreteValida(CORPO, createHmac("sha256", "outro").update(CORPO).digest("hex"), SEGREDO)).toBe(false)
    expect(assinaturaSuperfreteValida(CORPO + " ", hmac("hex"), SEGREDO)).toBe(false)
    expect(assinaturaSuperfreteValida(CORPO, "nao-e-assinatura", SEGREDO)).toBe(false)
  })

  it("sem segredo, sem header ou sem corpo nunca aceita", () => {
    expect(assinaturaSuperfreteValida(CORPO, hmac("hex"), undefined)).toBe(false)
    expect(assinaturaSuperfreteValida(CORPO, undefined, SEGREDO)).toBe(false)
    expect(assinaturaSuperfreteValida(undefined, hmac("hex"), SEGREDO)).toBe(false)
  })

  it("funciona com o corpo cru em Buffer (é o que a rota recebe)", () => {
    expect(assinaturaSuperfreteValida(Buffer.from(CORPO), hmac("hex"), SEGREDO)).toBe(true)
  })
})

describe("número do pedido nas tags", () => {
  it("lê a primeira tag que é um número", () => {
    expect(numeroDoPedido({ tags: [{ tag: "1042", url: "" }] })).toBe(1042)
    expect(numeroDoPedido({ tags: [{ tag: "eclat" }, { tag: "1042" }] })).toBe(1042)
  })

  it("devolve null quando não dá para saber", () => {
    for (const data of [{}, { tags: [] }, { tags: [{ tag: "" }] }, { tags: [{ tag: "abc" }] }, { tags: [{ tag: "-3" }] }, { tags: "x" }, null]) {
      expect(numeroDoPedido(data)).toBeNull()
    }
  })
})

describe("ação por evento", () => {
  it("postado avisa por WhatsApp e e-mail; entregue só por WhatsApp", () => {
    expect(acaoDoEvento("order.posted")).toEqual({ gravar: true, aviso: "posted", canais: ["whatsapp", "email"] })
    expect(acaoDoEvento("order.delivered")).toEqual({ gravar: true, aviso: "delivered", canais: ["whatsapp"] })
  })

  it("gerada grava e pode avisar o rastreio; criada, paga e cancelada só gravam", () => {
    expect(acaoDoEvento("order.generated")).toEqual({ gravar: true, aviso: "generated", canais: ["whatsapp"] })
    for (const e of ["order.created", "order.released", "order.cancelled"]) {
      expect(acaoDoEvento(e)).toEqual({ gravar: true, aviso: null, canais: [] })
    }
  })

  it("evento desconhecido não faz nada", () => {
    expect(acaoDoEvento("order.qualquer")).toBeNull()
    expect(acaoDoEvento("")).toBeNull()
  })
})

describe("rastreio do evento", () => {
  it("lê tracking e tracking_url, tolerando ausência", () => {
    expect(rastreioDoEvento({ tracking: "AA123BR", tracking_url: "https://x/y" })).toEqual({ tracking: "AA123BR", tracking_url: "https://x/y" })
    expect(rastreioDoEvento({})).toEqual({ tracking: "", tracking_url: "" })
    expect(rastreioDoEvento(null)).toEqual({ tracking: "", tracking_url: "" })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run (Git Bash, de `apps/backend`): `TEST_TYPE=unit NODE_OPTIONS=--experimental-vm-modules npx jest src/lib/__tests__/superfrete-webhook.unit.spec.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**, seguindo o estilo e os comentários de `src/lib/fiscal/fiscal-webhook.ts` (explicar o porquê, não o quê). O `jest.config.js` já casa `**/src/**/__tests__/**/*.unit.spec.[jt]s` no `TEST_TYPE=unit`.

- [ ] **Step 4: Rodar e ver passar.** Expected: PASS.

- [ ] **Step 5: Commit** — `feat(frete): funções puras do webhook de status da SuperFrete`

---

### Task 2: A rota do webhook

**Files:**
- Create: `apps/backend/src/api/webhooks/superfrete/route.ts`
- Modify: `apps/backend/src/api/middlewares.ts`
- Test: `apps/backend/integration-tests/http/frete-webhook.spec.ts`

**Interfaces:**
- Consumes: tudo da Task 1; `evolutionConfigured`/`sendWhatsappText` de `src/lib/evolution.ts`; `Modules.NOTIFICATION` para e-mail; `query.graph` para achar o pedido; o módulo de pedidos para gravar o metadata.
- Produces: `POST /webhooks/superfrete`.

**Comportamento (spec §4.2–4.4), na ordem:**

1. `SUPERFRETE_WEBHOOK_SECRET` ausente → log em nível `info` e **200** (`{ ignorado: "sem segredo" }`). Nunca 500: senão a SuperFrete reenvia 5 vezes por configuração nossa.
2. Assinatura inválida → **401**, nada gravado, nada enviado, log `warn`.
3. Evento desconhecido (`acaoDoEvento` → `null`) → log `info` + **200**.
4. `numeroDoPedido` → `null`, ou pedido não encontrado → log `warn` + **200** (pode ser etiqueta comprada fora do sistema).
5. Conferência cruzada: `data.id` diferente de `metadata.frete.superfrete_id` do pedido → log `warn` + **200**.
6. Já avisado (`metadata.frete.avisos[aviso]` existe) → **200** imediato, sem enviar nada.
7. Gravar no pedido (um único `updateOrders`, preservando o resto do `metadata.frete`):
   - sempre: `metadata.frete.status_transportadora` e `metadata.frete.eventos[<evento>] = <ISO de agora>`;
   - no `order.generated`, **só se o pedido ainda não tem rastreio**: `tracking_number`/`tracking_url` em `metadata.frete`. (O rastreio do fulfillment no Medusa não é reescrito aqui — o Cockpit é quem grava o `label` no envio; esta fase registra no `metadata` e o Cockpit passa a exibir de lá numa fase futura. **Deixe isso explícito num comentário.**)
8. Enviar, conforme `canais`:
   - `whatsapp`: telefone de `shipping_address.phone`, normalizado para E.164 com 55 (copie a normalização que a rota de despacho do Cockpit usa — procure `normalizaWhatsapp` e replique o comportamento; não invente outra regra). Sem telefone ou `evolutionConfigured()` falso → pular o canal, log `info`.
   - `email`: só se `RESEND_API_KEY` existir e o pedido tiver e-mail; `createNotifications` com `template: "pedido-postado"`, `resource_type: "order"`, `resource_id: pedido.id` e chave de idempotência `superfrete-<evento>-<id da etiqueta>`.
   - **`order.generated` só envia** se o despacho saiu sem rastreio — na prática: se o pedido **não** tinha `tracking_number` antes deste evento e agora tem. Senão, `aviso` vira nada (grava e responde 200).
9. Se **todos** os canais previstos falharem → **500** de propósito (a SuperFrete reenvia em 15 min). Se pelo menos um canal foi entregue → marcar o aviso como enviado e responder **200**.
10. Marcar: `metadata.frete.avisos[aviso] = <ISO>` — **só depois** do envio bem-sucedido.

- [ ] **Step 1: Registrar o corpo cru** em `src/api/middlewares.ts`, ao lado da linha do `brasilnfe`, no mesmo formato (`methods: ["POST"]`, nunca `method`), com um comentário curto dizendo por quê.

- [ ] **Step 2: Escrever o teste de integração que falha**

`integration-tests/http/frete-webhook.spec.ts`, no padrão de `integration-tests/http/frete-superfrete.spec.ts` (mesmo runner, mesmas opções `inApp`/`disableAutoTeardown`, helpers `criarAdmin` e `criarCatalogoBase`). Defina `process.env.SUPERFRETE_WEBHOOK_SECRET` **antes** de o runner subir o app, como aquele spec faz com as variáveis da SuperFrete. Simule Evolution e Resend: não configure `EVOLUTION_*` nem `RESEND_API_KEY` nos casos em que quer testar "canal indisponível", e para os casos de envio **injete um espião** — se não houver como injetar, teste o envio pela unidade da Task 3 e aqui verifique só o estado gravado e o código HTTP; **diga no relatório qual caminho você escolheu**.

Casos obrigatórios:
- assinatura errada → 401 e o pedido continua sem `metadata.frete.eventos`;
- sem `SUPERFRETE_WEBHOOK_SECRET` → 200 e nada gravado;
- evento desconhecido → 200 e nada gravado;
- tag ausente → 200, nada gravado;
- `data.id` que não bate com o do pedido → 200, nada gravado;
- `order.generated` com o pedido sem rastreio → grava `tracking_number` no `metadata.frete`;
- `order.generated` com o pedido **já** com rastreio → grava o evento mas não sobrescreve o rastreio;
- `order.posted` → grava o evento e marca `avisos.posted`;
- **reenvio** do mesmo `order.posted` → 200 e `avisos.posted` **não muda** (mesma data), sem segundo envio;
- `order.delivered` → marca `avisos.delivered`.

- [ ] **Step 3: Rodar e ver falhar**

Pré-requisito: Docker aberto e o contêiner `eclat-pg-test` de pé (porta 55432).
Run: `cd /e/Projetos/ECLAT/eclat-wt-frete/apps/backend && TEST_TYPE=integration:http NODE_OPTIONS=--experimental-vm-modules npx jest integration-tests/http/frete-webhook.spec.ts --runInBand --forceExit`

- [ ] **Step 4: Implementar a rota.** Comentário de cabeçalho no estilo da rota do Brasil NFe, dizendo o que é dado não confiável e por que cada código HTTP foi escolhido (em especial: por que 500 no envio falho e 200 em todo o resto).

- [ ] **Step 5: Rodar até passar**, e rodar também `integration-tests/http/saude.spec.ts` como regressão.

- [ ] **Step 6: Commit** — `feat(frete): rota do webhook de status da SuperFrete`

---

### Task 3: Mensagens (WhatsApp e e-mail)

**Files:**
- Create: `apps/backend/src/lib/superfrete-avisos.ts`
- Test: `apps/backend/src/lib/__tests__/superfrete-avisos.unit.spec.ts`
- Create: `apps/backend/src/modules/resend/templates/pedido-postado.ts`
- Modify: onde os templates são registrados (ache seguindo `pedido-confirmado`)
- Modify: `apps/backend/src/api/webhooks/superfrete/route.ts` (usar os textos daqui)

**Interfaces:**
- Produces: `textoPostado(p)`, `textoEntregue(p)`, `textoRastreioAtrasado(p)` — cada uma recebe `{ nome: string | null; display_id: number; tracking: string; tracking_url: string }` e devolve `string`.

**Regras dos textos:**
- Tratamento: primeiro nome quando existir, senão uma saudação neutra (veja como a mensagem de despacho do Cockpit faz e mantenha a mesma voz).
- Sempre citar o número do pedido.
- Só incluir o bloco de rastreio quando `tracking` não estiver vazio; nunca deixar "Acompanhe:" sem link.
- Sem promessa de prazo (não sabemos), sem link de loja.
- Um arquivo só, para o dono revisar sem mexer em código.

- [ ] **Step 1: Teste que falha** cobrindo: com e sem nome; com e sem rastreio (o texto não pode conter "undefined", "null" nem um "Acompanhe" órfão); o número do pedido aparece nos três; o texto de entregue não cita rastreio.

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar os textos e o template de e-mail**, reaproveitando `templates/layout.ts` e imitando `pedido-confirmado.ts` (assunto, pré-cabeçalho, corpo). Assunto sugerido: `Seu pedido #<n> foi postado`.

- [ ] **Step 4: Ligar na rota** (trocar qualquer texto provisório da Task 2 por estas funções).

- [ ] **Step 5: Rodar unidade + integração + `npx tsc --noEmit`.**

- [ ] **Step 6: Commit** — `feat(frete): mensagens de postado, entregue e rastreio atrasado`

---

### Task 4: Cadastro do webhook e documentação

**Files:**
- Create: `apps/backend/ativar-webhook-superfrete.mjs`
- Modify: `architecture/envios.md`, `progress.md`

**Interfaces:**
- Consumes: `SUPERFRETE_TOKEN`, `SUPERFRETE_CONTACT_EMAIL`, `SUPERFRETE_WEBHOOK_URL`, `SUPERFRETE_SANDBOX`.

**Regras do script** (copie a forma do `ativar-superfrete.mjs`, que já está aprovado):
- sem argumento: `GET /api/v0/webhook`, lista o que existe (nome, url, eventos, ativo) e diz o que faria. **Não grava nada.**
- `--aplicar`: se já existe um webhook com a nossa URL, atualiza (`PUT /api/v0/webhook/{id}`); senão cria (`POST /api/v0/webhook`) com `name: "use.ECLAT"`, a URL do ambiente e os seis eventos.
- `--aplicar --desfazer`: remove (`DELETE /api/v0/webhook/{id}`) só o que aponta para a nossa URL.
- Nunca `process.exit` (no Node 24/Windows derruba o processo depois de um `fetch`): `main()` + `process.exitCode`.
- Aborta com mensagem clara se faltar variável, se a URL não for `https`, ou se houver mais de um webhook com a nossa URL.
- Nunca imprime o token nem o segredo.

- [ ] **Step 1: Escrever o script.**
- [ ] **Step 2: Provar sem gravar:** rodar sem argumento com as variáveis do ambiente local e conferir que ele só lista. **Não rodar `--aplicar`** (isso é do dono, em produção).
- [ ] **Step 3: SOP** — seção nova em `architecture/envios.md`: o que cada evento faz, quais mensagens a cliente recebe, as duas variáveis novas, como cadastrar/remover, e os limites honestos (entrega não garantida; etiqueta sem a tag do pedido é ignorada; o rastreio gravado pelo webhook fica no `metadata` do pedido).
- [ ] **Step 4: `progress.md`** — acrescentar ao roteiro de go-live os passos do webhook, na ordem: variáveis → deploy do backend → rodar o script sem argumento → "pode aplicar" → acompanhar um pedido real.
- [ ] **Step 5: Commit** — `feat(frete): script de cadastro do webhook e SOP dos avisos de entrega`

---

## Self-review (feito ao escrever o plano)

- **Cobertura da spec:** §4.2 → Task 1 + Task 2 Step 1; §4.3 → Task 1 (`numeroDoPedido`) + Task 2 (itens 4–5); §4.4 → Task 2 (itens 6, 9, 10); §4.1 → Task 1 (`acaoDoEvento`) + Task 2 (item 7–8); §4.5 → Task 3; §4.6 → Task 4; §5 → Tasks 2 e 4; §6 → testes de cada task; §7 → as quatro tasks.
- **Decisão minha, não da spec:** aceitar quatro formatos de assinatura, porque a SuperFrete não documenta qual usa. Está justificado na Task 1 e não enfraquece a verificação.
- **Consistência:** `acaoDoEvento` é a única fonte da tabela de eventos; a rota não repete a regra. O `aviso` do `order.generated` é condicional e essa condição vive na rota (item 8), porque depende do estado do pedido, não do evento.
