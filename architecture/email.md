# E-mail transacional (Resend)

## O que existe
- **Provider** `apps/backend/src/modules/resend/` — Notification Module Provider do Medusa, canal `email`.
  Fala com `POST https://api.resend.com/emails` por `fetch` (sem SDK, sem dependência nova).
- **Templates** em `src/modules/resend/templates/` — funções puras `(dados) => { subject, html, text }`.
  HTML de e-mail: tabelas, estilo inline, 600 px, cores da marca. Logo vem de `<vitrine>/brand/logo-terracota.png`.
- **Dados do pedido** `src/modules/resend/dados-pedido.ts` — traduz o pedido do Medusa em texto já formatado
  (reais, CEP, endereço, aviso de pré-venda). Aceita dinheiro como número ou BigNumber.
- **Subscriber** `src/subscribers/pedido-confirmado.ts` — `order.placed` → template `pedido-confirmado`.
  Como o pedido só nasce com o pagamento aprovado (D1 de architecture/pagamento.md), este e-mail também
  é o "pagamento recebido".
- **Rota de teste** `POST /admin/email/enviar-exemplo { to, pedido_id? }` — envia o e-mail pelo caminho real, com um
  pedido de exemplo ou um pedido de verdade. Exige sessão admin.

## E-mails que saem hoje
| Evento | Template | Para quem |
|---|---|---|
| `order.placed` | `pedido-confirmado` | e-mail do pedido |

Ainda NÃO existem: pedido enviado (rastreio), redefinição de senha, pedido cancelado/estornado.

## Variáveis (Railway, serviço do backend)
| Variável | Obrigatória | Para quê |
|---|---|---|
| `RESEND_API_KEY` | sim | liga tudo; sem ela o módulo não é registrado e nada é enviado |
| `RESEND_FROM` | não | remetente; padrão `use.ÉCLAT <pedidos@useeclat.com.br>`; o domínio precisa estar verificado no Resend |
| `RESEND_REPLY_TO` | não | caixa que recebe a resposta da cliente |
| `STOREFRONT_URL` | não | base dos links e do logo; padrão `https://www.useeclat.com.br` |

## Regras
1. Falha de e-mail nunca afeta o pedido: o subscriber é `try/catch` + log (`[email] ...`).
2. Envio repetido é barrado duas vezes: `idempotency_key` no Notification Module e header
   `Idempotency-Key` no Resend (`pedido-confirmado-<order.id>`).
3. Todo valor que entra no HTML passa por `esc()`.
4. Template novo = arquivo em `templates/` + entrada no mapa `TEMPLATES` de `service.ts` + teste unitário.
5. Nenhum arquivo de produção pode ter "test" no caminho, nem como parte de palavra ("teste"): o `medusa build`
   descarta esses arquivos em silêncio (filtro `relativeFileName.includes("test")`). Em 2026-09-18 a rota
   `admin/email/teste` compilou local, passou no build e deu 404 em produção por isso.
6. Imports relativos SEM extensão `.js` (o Jest esconde o erro, o Medusa real quebra — ver architecture/pagamento.md).

## Ordem segura de ativação
1. Deploy do código SEM `RESEND_API_KEY`: o backend sobe igual a antes (prova que nada quebrou).
2. Domínio verificado no Resend (registros DNS de DKIM, SPF e MX do subdomínio de envio).
3. Criar `RESEND_API_KEY` no Railway (redeploy automático). Se o backend não subir, apagar a variável volta ao estado anterior.
4. `POST /admin/email/enviar-exemplo` para uma caixa real; conferir aparência e se caiu na entrada.
5. Compra de teste de ponta a ponta.

## Testes
`npm run test:unit --workspace=apps/backend` — `src/modules/resend/__tests__/` (dados, template, provider com `fetch` simulado).
