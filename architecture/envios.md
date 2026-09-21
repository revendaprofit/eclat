# SOP — Envios / Despacho (Fase 4, Bloco 3)

O cockpit despacha pedidos pela **Medusa Admin API** (comércio = fonte da verdade) e avisa o
cliente por **WhatsApp** (Evolution). A integração com transportadora é a **SuperFrete**; sem
credenciais, opera-se no **modo manual**.

## Fluxo de despacho (no cockpit → Pedidos → abrir pedido → "Despachar")
1. Cria o **fulfillment** de todos os itens: `POST /admin/orders/{id}/fulfillments`
   `{ items:[{id,quantity}], location_id }` (location = CD Brasil).
2. Marca o **envio** (shipment): `POST /admin/orders/{id}/fulfillments/{fid}/shipments`
   `{ items:[{id,quantity}], labels?:[{tracking_number, tracking_url, label_url}] }`.
   - Os 3 campos do label são obrigatórios quando há label (envie "" quando não tiver).
3. **Aviso WhatsApp** (se "avisar cliente" + telefone no endereço do pedido): texto na voz da Éclat
   com o código de rastreio. Telefone normalizado p/ E.164 (prefixo 55).

Estados (fulfillment_status): `not_fulfilled` → `fulfilled`/`shipped` → `delivered`.
Endpoints auxiliares: cancelar `.../fulfillments/{fid}/cancel`; entregue `.../fulfillments/{fid}/mark-as-delivered`.

## Modo manual (ativo agora, sem dependências)
Operador digita o código de rastreio (e URL, opcional) e clica **Despachar**. Sem código → despacha sem rastreio.

## Frete calculado no checkout (SuperFrete)
Spec: `docs/superpowers/specs/2026-09-18-frete-superfrete-design.md`. Provider `superfrete_superfrete`
(`apps/backend/src/modules/superfrete`), só registrado se `SUPERFRETE_TOKEN` existir no ambiente
(o provider manual continua registrado sempre — pedido antigo e o modo manual dependem dele).
- Três opções `calculated`: Econômica (Mini Envios, `mini`), PAC (`pac`), SEDEX (`sedex`).
- Peso da peça = `variant.weight`, senão `product.weight`, senão 300 g (em produção o peso está
  cadastrado no produto, não na variante).
- Preço = cotação + margem, arredondado para cima até o próximo `,90`. Frete grátis por piso (MG × Brasil)
  sobre o valor das peças já com desconto (cupom e Benefício Conjunto), sem o frete: a mais barata zera,
  as outras cobram a diferença.
- Opção DOMINADA (mais cara E mais lenta que outra) não aparece (`semDominadas`/`precosDeVitrine` em
  `preco.ts`; compara o preço de vitrine, antes do frete grátis). Dentro de MG o SEDEX costuma ser o mais
  barato e o único exibido.
- Embalagem por quantidade de peças (`embalagem.ts`); Mini Envios só quando o pacote cabe no limite dos
  Correios.
- Sem conta sandbox (decisão do dono): a cotação é testada direto na API real da SuperFrete;
  `SUPERFRETE_SANDBOX=true` continua suportado.
- SuperFrete fora do ar, timeout ou token inválido: só PAC, pelo valor de reserva. O erro vai para o log
  com `[superfrete]` (nunca token nem CPF).
- Rotas `GET /store/frete/regras` (pisos, para a barra do carrinho) e `GET /store/frete/prazos?cart_id=`
  (prazo por opção, lido do mesmo cache da cotação). A rota de prazos nunca derruba o checkout: sem CEP,
  sem token ou com a API fora do ar devolve `{ prazos: {} }`, logando `[superfrete] prazos indisponíveis: …`.
- O pedido guarda em `shipping_methods.data`: `servico`, `pacote`, `prazo_min`, `prazo_max` — sempre
  recalculado e gravado no servidor (`validateFulfillmentData`); o que vem do navegador não é confiável.
- Vitrine: passo Entrega mostra o prazo por opção e "Grátis" quando o frete é 0; opção recusada pelo
  provider fica escondida (nunca aparece como erro). Barra no carrinho ("Faltam R$ X para o frete
  grátis." / "Você ganhou frete grátis.") usa preço × quantidade menos os descontos de cada peça — nunca
  `discount_total` do carrinho, que também inclui desconto de método de frete.
- Variáveis do backend: `SUPERFRETE_TOKEN`, `SUPERFRETE_SANDBOX`, `SUPERFRETE_FROM_POSTAL_CODE`,
  `SUPERFRETE_CONTACT_EMAIL`; opcionais `FRETE_MARGEM_CENTAVOS`, `FRETE_GRATIS_MG_CENTAVOS`,
  `FRETE_GRATIS_BRASIL_CENTAVOS`, `FRETE_RESERVA_PAC_CENTAVOS`.
- Ligar/desligar na região: `node apps/backend/ativar-superfrete.mjs` (simula) · `--aplicar` ·
  `--aplicar --desfazer`. Preserva as regras que a opção já tinha e aborta sem gravar nada se houver mais
  de um candidato (local, zona ou opção fixa "Entrega Padrão" — o script nunca adivinha). Em produção, só
  com o "pode aplicar" do dono, depois do `railway up` com o módulo novo. O script NUNCA usa
  `process.exit` (lacuna da Task 15): num ambiente com Node 24 no Windows, `process.exit` matava o
  processo com código de saída 127 logo depois de um `fetch`, sem deixar o script terminar sozinho.
- Teste de integração: `apps/backend/integration-tests/http/frete-superfrete.spec.ts` (13 casos, SuperFrete
  simulada por um servidor HTTP local; precisa do contêiner `eclat-pg-test`, `npm run test:db:up`).

## Etiqueta pelo Cockpit (SuperFrete)
Botão **"Gerar etiqueta (SuperFrete)"** no despacho: `POST /api/v0/cart` (cria o frete, não gasta saldo) →
`POST /api/v0/checkout` (paga com o saldo da carteira) → grava rastreio + PDF no Medusa → aviso WhatsApp.
Código: `apps/cockpit/lib/shipping.ts` (`carrierCriarFrete`/`carrierPagarFrete`/`carrierConsultarFrete`,
timeout de 20 s cobrindo a leitura do corpo da resposta; "sem saldo" só quando a SuperFrete devolve HTTP
402 ou o texto "saldo insuficiente") e `lib/superfrete-etiqueta.ts` (monta o corpo e valida CPF/CEP/UF
antes de qualquer chamada — erro de dado não gasta saldo).
- Usa o serviço e o pacote gravados no pedido; pedido antigo ("Entrega Padrão", sem serviço) sai como PAC.
  Pedido sem `data.pacote` ou com contagem de peças divergente usa uma cópia mínima da tabela de
  embalagem (peso padrão 300 g/peça).
- Regras da API da SuperFrete conferidas na doc oficial: telefone do destinatário com 10/11 dígitos
  NACIONAIS, sem o "55"; limites de tamanho por corte, nunca por rejeição — nome/endereço/bairro/cidade
  50, complemento 20, número 10; número vazio (não "S/N") quando o pedido não tem número; bairro vazio
  vira "NA"; UF com 2 letras; `options.tags` leva o número do pedido (`display_id`); CEP de origem com 8
  dígitos. `SUPERFRETE_FROM_NAME` precisa de nome E sobrenome (só o remetente — a SuperFrete recusa
  etiqueta de remetente com uma palavra só, já com o saldo debitado); `SUPERFRETE_FROM_PHONE` é opcional.
- Com NFe emitida no despacho, a chave vai na etiqueta (`invoice.number`); sem ela, vai como declaração
  de conteúdo (`non_commercial: true`).
- Exige CPF/CNPJ no pedido. Sem CPF, sem saldo, endereço inválido ou erro da SuperFrete, o despacho NÃO
  acontece (o fulfillment não chega a ser criado) e o modo manual segue disponível.
- A compra é uma máquina de estados gravada em `order.metadata.frete` (`lib/etiqueta-segura.ts`,
  `garantirEtiqueta`): `iniciando` → `pendente` (com `superfrete_id`) → `paga` (com rastreio e/ou PDF).
  Três fatos aprendidos com a etiqueta real comprada e cancelada pelo dono em 2026-09-19:
  - **O status da SuperFrete atrasa alguns segundos em relação ao pagamento** (`GET .../order/info/{id}`
    respondeu `pending` por alguns segundos logo depois de um `/checkout` que já tinha sido aceito). Por
    isso um pedido `pendente` que a consulta diz `pending` espera 8s e confere de novo antes de decidir
    pagar — um único `pending` não prova que não foi pago. Honestidade sobre o residual: duas consultas
    "pending" com 8s de intervalo é um sinal forte, não uma prova — se a resposta do `/checkout` se
    perder E o atraso do status passar dos 8s, isso paga uma segunda vez. Na prática já se passaram
    20-30s ou mais (o timeout de 20s de cada chamada, mais o tempo até o operador clicar de novo) contra
    um atraso observado de poucos segundos; as constantes (`ESPERA_STATUS_MS` etc.) estão centralizadas
    em `lib/etiqueta-segura.ts` pra recalibrar se a SuperFrete se mostrar mais lenta em produção.
  - **Uma etiqueta já registrada como `paga` nunca volta a pagar nem a criar outra**, não importa o que a
    consulta diga depois (inclusive `pending`) — só `canceled` é motivo pra parar e pedir conferência
    manual; qualquer outro status vira só uma tentativa a mais de achar o rastreio.
  - **O rastreio pode estar vazio na hora do pagamento** (a resposta do `/checkout` trouxe o PDF mas
    `tracking` vazio). Por isso toda compra bem-sucedida busca o rastreio logo em seguida (até 3
    consultas, ~12 s no total) — e pode continuar vazio: nesse caso o despacho segue registrado só com o
    PDF, e a mensagem de WhatsApp ao cliente sai sem código de rastreio.
  Trava de duplo pagamento: já paga com rastreio → reaproveita sem chamar a API (zero chamadas); id
  gravado sem confirmação → consulta (com a espera de 8s acima) antes de decidir pagar; `canceled` →
  libera uma compra nova; `iniciando` com menos de 2 minutos → recusa nova tentativa; se `criar` falhou, a
  tentativa seguinte não fica presa nos 2 minutos.
- Trava de despacho em memória por pedido (`lib/trava-despacho.ts`), no TOPO da rota de despacho: um
  segundo clique no mesmo pedido recebe HTTP 409 sem nenhum efeito, nem NFe. Limite conhecido: vale para
  UMA instância do Cockpit; entre instâncias, quem protege a etiqueta é a releitura do pedido feita antes
  de comprar (janela de uma gravação no Medusa), e a emissão de NFe não tem guarda nenhuma entre
  instâncias — se o Cockpit ganhar uma segunda réplica, isso precisa de trava no banco.
- `lib/medusa.ts` (`corpoDoEnvio`): grava o rótulo (`labels`, os 3 campos sempre) sempre que houver
  rastreio OU PDF — uma etiqueta paga pode ainda não ter rastreio da SuperFrete, mas já ter o PDF.
- Variáveis do Cockpit: `SUPERFRETE_TOKEN`, `SUPERFRETE_SANDBOX`, `SUPERFRETE_CONTACT_EMAIL` e o remetente em
  `SUPERFRETE_FROM_NAME`, `_DOCUMENT` (CNPJ), `_PHONE`, `_ADDRESS`, `_NUMBER`, `_COMPLEMENT`, `_DISTRICT`, `_CITY`, `_STATE`, `_POSTAL_CODE`.
  Valores só no ambiente — este repositório é público.
- Pendências conhecidas: não há botão de cancelar etiqueta no Cockpit (o id da SuperFrete fica só em
  `metadata.frete.superfrete_id`; cancelar hoje é pelo painel da SuperFrete ou por `POST
  /api/v0/order/cancel`, só antes de postar, com estorno na carteira). A busca de rastreio só acontece
  durante a compra (até ~12s). Com o interruptor `SUPERFRETE_AVISO_PELO_BACKEND` DESLIGADO, se ainda faltar
  depois disso não há re-consulta automática — o operador confere no painel da SuperFrete e atualiza o
  pedido, se precisar. Com ele LIGADO, o job de 5 min do backend (`frete-avisos-pendentes`) re-consulta a
  etiqueta (`GET /api/v0/order/info/{id}`) de todo aviso de despacho pendente, grava o código em
  `metadata.frete.tracking_number` e manda a mensagem (ver "Avisos de entrega" abaixo). O código não é
  copiado para o rótulo do envio no Medusa: fica no `metadata.frete`.
  A mensagem de erro de etiqueta cancelada (`garantirEtiqueta`, regra A) pede pra "limpar o frete do
  pedido" antes de gerar outra — hoje isso é um passo MANUAL, sem botão no Cockpit: apagar/zerar
  `metadata.frete` do pedido pelo admin do Medusa ou por um script.

## Avisos de entrega (SuperFrete)
Spec: `docs/superpowers/specs/2026-09-20-avisos-entrega-superfrete-design.md`. A SuperFrete chama o backend
(`POST /webhooks/superfrete`) quando a etiqueta muda de estado; o backend avisa a cliente.

**O que a cliente recebe:**
| Momento | Canal | Quem manda |
|---|---|---|
| Despacho (etiqueta com código de rastreio) | WhatsApp: número do pedido + código + link | remetente único do backend |
| Postado (`order.posted`) | WhatsApp + e-mail "pedido postado" (Resend; sem `RESEND_API_KEY` o e-mail é pulado) | rota do webhook |
| Entregue (`order.delivered`) | WhatsApp | rota do webhook |
| `order.created`/`released`/`cancelled` | nada (só registro no pedido / log). O `cancelled` dispensa um aviso de despacho ainda pendente | — |

**Quantas vezes cada aviso sai.** A marca fica em `metadata.frete.aviso_despacho` (despacho) e em
`metadata.frete.avisos` (postado/entregue); reenvio da SuperFrete cai em "já avisado".
- **Despacho: nunca duplica.** A trava no Postgres garante uma mensagem só; na dúvida o aviso vira `incerto`
  e ninguém reenvia.
- **Postado/entregue: pode repetir, raramente.** Se o WhatsApp estoura o tempo (15 s) a mensagem pode ter
  saído mesmo assim; a rota responde 500 e a SuperFrete reenvia em 15 min — a cliente pode receber duas vezes.
  **Decisão do dono em 2026-09-21:** fica assim. Uma repetição rara é aceita; um aviso perdido não é.
- **Despacho, Evolution 5xx:** volta para `pendente` e o job tenta de novo em 5 min (**confirmado pelo dono em
  2026-09-21**). Um proxy que responda 5xx depois de a Evolution entregar poderia duplicar — risco aceito.

**Aviso de despacho — remetente único.** Só `tentarAvisoDeDespacho` (`apps/backend/src/lib/aviso-despacho.ts`)
manda a mensagem de despacho da etiqueta. É chamado de três lugares: o Cockpit logo depois do despacho (rota
admin `POST /admin/frete/aviso-despacho/:order_id`), o webhook `order.generated` e o job
`frete-avisos-pendentes` (a cada 5 min, os 50 mais antigos em `pendente`/`enviando`). Uma trava no Postgres
garante uma mensagem só, mesmo com os três ao mesmo tempo. Se a Evolution não responde, a rodada do job para e
os outros pedidos ficam para a próxima.

Estados (`metadata.frete.aviso_despacho.status`, mostrados no pedido do Cockpit) e o que o operador faz:
| Estado | Significa | Operador |
|---|---|---|
| `pendente` | etiqueta ainda sem código; o job tenta a cada 5 min | nada — até 24 h |
| `enviando` | mensagem saindo agora | nada; se passar de 10 min vira `incerto` |
| `enviado` | saiu (hora em `em`) | nada |
| `expirado` | 24 h sem código de rastreio | conferir o código no painel da SuperFrete e **avisar a cliente à mão** |
| `sem_whatsapp` | a Evolution disse que o número não tem WhatsApp | avisar por outro canal (e-mail/telefone) |
| `sem_telefone` | pedido sem telefone | avisar por e-mail |
| `incerto` | não dá para saber se saiu (timeout, resposta estranha) | **abrir a conversa da cliente**: se a mensagem não está lá, mandar à mão. O sistema nunca reenvia sozinho |
| `dispensado` | não vai sair. Sem `motivo`: o operador desligou o aviso no despacho | nada |
| `dispensado` + `motivo: "etiqueta cancelada"` | a etiqueta foi cancelada (webhook `order.cancelled`, ou a consulta da SuperFrete diz `canceled`) antes de o aviso sair | nada — se houver etiqueta nova, avisar a cliente à mão |
| `dispensado` + `motivo: "coberto pelo aviso de postado"` | o `order.posted` chegou com o despacho ainda pendente e a mensagem de postado (que já leva código e link) SAIU por pelo menos um canal; só então o despacho atrasado é dispensado. Se o postado falha em todos os canais, o despacho segue `pendente` e o job ainda pode mandá-lo | nada |

Só um aviso `pendente` é dispensado (transição condicional no banco): `enviando` e os estados finais nunca
são tocados pelo cancelamento nem pelo postado. O link nas mensagens é sempre o do rastreamento dos Correios
montado a partir do código (`linkDeRastreio`); o `tracking_url` que vem no corpo do webhook é ignorado.

**Interruptor do Cockpit: `SUPERFRETE_AVISO_PELO_BACKEND`** (Vercel, ambiente do Cockpit). Desligado (padrão) =
como antes: o Cockpit manda o WhatsApp na hora do despacho, com o código que houver. Ligado (`true`) = na
etiqueta da SuperFrete o Cockpit só grava `aviso_despacho` e pede ao backend; a mensagem sai quando o código
existir. Despacho manual (código digitado) não muda. Ligar só depois do backend no ar (ordem no `progress.md`,
2026-09-21).

**Onde editar os textos:** `apps/backend/src/lib/superfrete-avisos.ts` (despacho, postado, entregue; `*` vira
negrito). O texto de despacho tem uma cópia no Cockpit (`apps/cockpit/app/api/orders/[id]/dispatch/route.ts`),
usada no despacho manual e com o interruptor desligado — mudou um, mude o outro. O e-mail fica em
`apps/backend/src/modules/resend/templates/pedido-postado.ts`.

**Webhook na conta da SuperFrete — ligar/desligar:** `apps/backend/ativar-webhook-superfrete.mjs`, rodado de
`apps/backend` com o `.env` local: `cd apps/backend` e `node --env-file=.env ativar-webhook-superfrete.mjs …`.
- Ambiente: `SUPERFRETE_TOKEN`, `SUPERFRETE_CONTACT_EMAIL`, `SUPERFRETE_WEBHOOK_URL` (URL pública do backend +
  `/webhooks/superfrete`, https). `SUPERFRETE_SANDBOX=true` usa o sandbox. Argumento desconhecido → recusa.
- Sem argumento → lista os webhooks da conta e diz o que faria (não grava). De webhooks de outros sistemas
  mostra só a origem.
- `--aplicar` (só o dono, no terminal dele, com "pode aplicar") → cria com os seis eventos; se já existe um
  com a mesma URL, atualiza. Dois com a mesma URL → para sem gravar.
- `--aplicar --desfazer` → remove só o(s) webhook(s) dessa URL. O despacho continua saindo pelo job de 5 min;
  postado e entregue param.
- **O segredo da assinatura é gerado pela SuperFrete** (a API não aceita segredo nosso): vem uma vez só, na
  resposta da criação. O script mostra na tela, ou grava num arquivo NOVO com `--salvar-segredo=<arquivo>`
  (aberto antes da criação; caminho dentro de repositório git é recusado; sem quebra de linha no fim). Sem
  terminal (agente, saída redirecionada) o `--aplicar` sem `--salvar-segredo` é recusado, para o segredo não
  parar num log. Se a gravação do arquivo falhar depois da criação, o segredo sai na tela para não se perder — inclusive
  sem terminal (num log ou no chat de um agente); nesse caso o dono trata o segredo como EXPOSTO e troca:
  `--aplicar --desfazer` e depois `--aplicar`. O script sempre mostra a base da API e avisa quando ela não é a
  de produção (sandbox ou teste): webhook cadastrado assim não é o que a loja usa.
  No Windows o modo 0600 não protege o arquivo: copiar para `SUPERFRETE_WEBHOOK_SECRET` no Railway e apagar.
  Perdeu o segredo? `--aplicar --desfazer` e `--aplicar` de novo.
- O backend apara espaços e quebras de linha do `SUPERFRETE_WEBHOOK_SECRET`. A variável só vale depois que o
  serviço reinicia: no Railway, aplicar a mudança de variável faz o redeploy do serviço.
- Sem `SUPERFRETE_WEBHOOK_SECRET` no backend a rota responde 200 e ignora tudo (não quebra, não gera
  reenvio). Com o segredo, chamada sem assinatura válida → 401.
- A SuperFrete reenvia até 5 vezes, a cada 15 min, quando não recebe resposta boa em 30 s. Backend fora do
  ar por mais de ~1 h perde o aviso de postado/entregue (o pedido continua certo).
- Etiqueta comprada fora do Cockpit (sem o número do pedido em `tags`) é ignorada, com registro no log.
