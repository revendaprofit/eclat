# Avisos de entrega — webhook da SuperFrete (Fase F5 do frete)

Data: 2026-09-20 · Status: **aprovada pelo dono em 2026-09-20** ("pode fazer a implementação de tudo conforme você sugeriu") · Branch `feat/frete-superfrete` · Depende de: F1–F3 do frete (spec `2026-09-18-frete-superfrete-design.md`) · SOP a atualizar: `architecture/envios.md`

## 1. Contexto e objetivo

Hoje a cliente recebe **uma** mensagem no WhatsApp, no momento em que o operador clica em "Despachar". Depois disso ela não sabe mais nada: se o pacote foi postado, se está a caminho, se chegou. Pior, a verificação com etiqueta real em 2026-09-19 mostrou que **o código de rastreio não existe no instante em que a etiqueta é paga** — ele nasce alguns segundos depois, quando a SuperFrete gera a etiqueta. O despacho tenta buscar o código por até ~12 s e, se não vier, avisa a cliente sem código.

A SuperFrete envia avisos de mudança de status (webhook). Esta fase liga esses avisos ao nosso sistema para:

1. **Preencher o rastreio que faltou** quando a etiqueta é gerada.
2. **Avisar a cliente** quando o pacote é postado e quando é entregue.

## 2. Decisões já tomadas (não reabrir)

1. **Quem recebe é o backend** (Medusa no Railway, que já é público). O Cockpit exige login e não serve para isso.
2. **Eventos que viram mensagem para a cliente: `order.posted` e `order.delivered`.** Os demais são registrados no pedido, sem mensagem.
3. **Exceção útil:** `order.generated` não gera mensagem própria, mas **grava o código de rastreio** no pedido quando ele está faltando — e, só nesse caso (a mensagem de despacho saiu sem código), manda uma mensagem curta com o código.
4. **Canais:** WhatsApp nos dois avisos; e-mail **só no postado**, com o código de rastreio.
5. **Segredos só em variável de ambiente**, colocados pelo dono. O repositório é público: nem URL de produção, nem token, nem segredo aqui.
6. **Nada de cancelar etiqueta nem re-consultar rastreio sob demanda** nesta fase (seguem como pendências conhecidas).

## 3. Escopo

**Entra:** rota `POST /webhooks/superfrete` no backend (validação de assinatura, mapeamento para o pedido, idempotência, registro no pedido); atualização do rastreio pelo evento `order.generated`; mensagens de WhatsApp (postado, entregue e a de rastreio atrasado); e-mail de "pedido postado" (template novo no Resend); script `ativar-webhook-superfrete.mjs` para cadastrar/remover o webhook na conta da SuperFrete; testes; SOP.

**Não entra:** cancelar etiqueta pelo Cockpit; tela de acompanhamento no Cockpit; avisos de `order.created` / `order.released` para a cliente; mudar o fluxo de compra da etiqueta; logística reversa.

## 4. Arquitetura

```
SuperFrete ──POST──▶ Backend (Medusa, Railway)
  X-ME-Signature      src/api/webhooks/superfrete/route.ts
  { event, data }       1. valida a assinatura (HMAC-SHA256 do corpo cru)
                        2. acha o pedido (data.tags[].tag = display_id; confere data.id)
                        3. já avisou este evento? (metadata.frete.avisos) → 200, fim
                        4. grava rastreio/estado no pedido
                        5. envia WhatsApp (lib/evolution) e/ou e-mail (módulo resend)
                        6. marca o aviso como enviado → 200
```

### 4.1 Eventos e o que cada um faz

| Evento | Grava no pedido | Mensagem para a cliente |
|---|---|---|
| `order.created` | estado, data | não |
| `order.released` | estado, data | não |
| `order.generated` | **código de rastreio e link**, se faltavam | só se o despacho saiu sem código |
| `order.posted` | estado, data | **WhatsApp + e-mail** |
| `order.delivered` | estado, data | **WhatsApp** |
| `order.cancelled` | estado, data | não (alerta no log) |

### 4.2 Autenticidade

A SuperFrete assina cada chamada: header `X-ME-Signature` com HMAC-SHA256 do **corpo exato** da requisição, usando um segredo que definimos ao cadastrar o webhook (`SUPERFRETE_WEBHOOK_SECRET`).

- A comparação é feita em tempo constante.
- O corpo precisa ser lido **cru** (sem o JSON já interpretado), como a rota do Brasil NFe faz.
- Assinatura inválida → HTTP 401, nada é gravado, nada é enviado.
- **Sem o segredo configurado** → a rota responde 200 e não faz nada. Deploy sem a variável não pode quebrar o backend nem gerar reenvio infinito.

### 4.3 Como achamos o pedido

Ao comprar a etiqueta, já mandamos o número do pedido da ÉCLAT em `options.tags`. Ele volta em `data.tags[].tag`.

1. `display_id` = primeira tag que é um número → busca o pedido.
2. Conferência cruzada: `data.id` (id da etiqueta) tem de bater com `metadata.frete.superfrete_id` do pedido. Não bate → registra no log e responde 200 (não é nosso, ou é de um teste).
3. Pedido não encontrado → log + 200 (nunca 500: senão a SuperFrete reenvia 5 vezes por nada).

### 4.4 Não repetir mensagem

A SuperFrete reenvia até 5 vezes, a cada 15 minutos, se não receber resposta em 30 s. Regra:

- `metadata.frete.avisos` guarda a data de cada aviso já enviado (`generated`, `posted`, `delivered`).
- Evento já avisado → 200 na hora, sem enviar nada.
- O aviso só é marcado como enviado **depois** que o envio dá certo.
- Falha no envio (WhatsApp fora do ar, por exemplo) → HTTP 500 **de propósito**, para a SuperFrete reenviar em 15 minutos.
- Tudo o que não é envio (gravar estado, evento ignorado, pedido não encontrado) responde 200.

### 4.5 Mensagens

WhatsApp, na voz da Éclat, curtas, com o nome da cliente:

- **postado:** que o pedido foi postado, o código de rastreio e o link de acompanhamento.
- **entregue:** que o pedido chegou, com um fecho de marca.
- **rastreio atrasado** (só quando o despacho saiu sem código): o código e o link.

E-mail **só no postado**, com o mesmo layout já usado no "pedido confirmado" (template novo `pedido-postado.ts`).

Os textos finais ficam em um arquivo só, para o dono revisar sem mexer em código.

### 4.6 Cadastro do webhook na conta da SuperFrete

Script `apps/backend/ativar-webhook-superfrete.mjs`, no mesmo padrão do `ativar-superfrete.mjs`:

- sem argumento: lista os webhooks da conta (`GET /api/v0/webhook`) e mostra o que faria. **Não grava nada.**
- `--aplicar`: cadastra (ou atualiza) o webhook apontando para a URL pública do backend, com os seis eventos.
- `--aplicar --desfazer`: remove o webhook.
- Em produção, só com o "pode aplicar" do dono.
- A URL e o segredo vêm do ambiente; nunca ficam no repositório.

## 5. Variáveis de ambiente (nomes; valores são do dono)

| Onde | Variável | Observação |
|---|---|---|
| Backend (Railway e local) | `SUPERFRETE_WEBHOOK_SECRET` | segredo da assinatura; o mesmo usado ao cadastrar o webhook |
| Backend | `SUPERFRETE_WEBHOOK_URL` | URL pública que a SuperFrete vai chamar (usada só pelo script de cadastro) |

O `SUPERFRETE_TOKEN` e o `SUPERFRETE_CONTACT_EMAIL` já existem.

## 6. Testes

**Unidade:** validação da assinatura (válida, inválida, sem segredo); leitura do `display_id` das tags (ausente, não numérica, várias); decisão do que fazer por evento; idempotência (já avisado → não envia); escolha de canal por evento.

**Integração (SuperFrete simulada):** a rota responde 401 com assinatura errada; 200 sem gravar quando o pedido não é encontrado; grava o rastreio no `order.generated`; envia e marca no `order.posted`; o reenvio do mesmo evento não manda a segunda mensagem; falha de envio devolve 500 e o reenvio seguinte funciona.

**Validação real (no go-live, com o dono):** com o backend já publicado e o webhook cadastrado, acompanhar uma etiqueta de verdade e conferir que o rastreio aparece no pedido e que as mensagens chegam.

## 7. Fases

- **F5.1 — Backend:** rota, assinatura, mapeamento, idempotência, registro no pedido, testes.
- **F5.2 — Mensagens:** WhatsApp (três textos) e e-mail de postado, com os textos em um arquivo só.
- **F5.3 — Cadastro e SOP:** script de ativação, `architecture/envios.md`, roteiro no `progress.md`.
- **F5.4 — Go-live (dono):** variáveis no Railway, `railway up`, "pode aplicar" no script, acompanhar um pedido real.

## 8. Riscos e pendências

1. **A cliente pode receber mensagens demais.** No mesmo dia ela pode receber a do despacho, a do rastreio atrasado e a de postado. A regra da §4.1 já evita a do rastreio quando o despacho saiu com código. Se ainda ficar repetitivo, o caminho é mover a mensagem de despacho para o `order.generated` — decisão do dono, depois de ver na prática.
2. **O backend precisa estar publicado** para receber os avisos. Em desenvolvimento local a rota é testada com a SuperFrete simulada.
3. **A entrega dos avisos não é garantida.** Se o backend ficar fora do ar por mais de ~1 h, a SuperFrete desiste depois de 5 tentativas e aquele aviso se perde. O pedido continua correto no Medusa; só a mensagem não sai.
4. **Depende do número do pedido ir na etiqueta.** Etiquetas compradas fora do sistema (ou antes desta fase) não têm a tag e não serão reconhecidas — o aviso é ignorado com registro no log.
