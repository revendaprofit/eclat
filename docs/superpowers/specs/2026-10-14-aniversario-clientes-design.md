# Programa de aniversário das clientes — desenho (2026-10-14)

Pedido da sócia em 14/10/2026: captar a data de aniversário de quem já comprou, pedir no cadastro de quem vai
comprar, ter um calendário no Cockpit com aviso no "ÉCLAT hoje", e no dia a cliente ganhar **10% off e um presente
especial** para a *Aurora* aniversariante ("Aurora" é como a marca chama a mulher da comunidade ÉCLAT — a cliente,
não uma peça). Decisões dela: a captação de quem já comprou é por mensagem automática no WhatsApp; os parabéns saem
sozinhos às 9h.

## Dados

A data mora em `customer.metadata` no Medusa. É um atributo da cliente, como o telefone: a vitrine grava pela Store
API (cadastro, perfil, checkout), o Cockpit edita pela Admin API, os jobs leem pelo `query.graph`. Um lugar só.

| chave                      | valor                                                        | quem grava                         |
|----------------------------|--------------------------------------------------------------|------------------------------------|
| `aniversario`              | `"MM-DD"` (dia e mês; ano nunca é pedido)                     | cadastro, perfil, checkout (via pedido), WhatsApp, Cockpit |
| `aniversario_origem`       | `cadastro` / `checkout` / `whatsapp` / `cockpit`              | idem                               |
| `aniversario_ano`          | número, só se a cliente escreveu (ex.: "14/10/1990")          | WhatsApp                           |
| `aniversario_pedido_em`    | ISO da pergunta pelo WhatsApp (uma por cliente, para sempre)  | job `aniversario-pedir-data`       |
| `aniversario_pedido_status`| `sem_whatsapp` / `incerto` quando o envio falhou              | job                                |
| `aniversario_nao_entendi`  | ISO: já insistiu uma vez ("me manda só dia/mês")              | webhook                            |
| `aniversario_parabens`     | `{ ano, cupom, em, status: enviando/enviado/incerto }`        | job `aniversario-parabens`         |

No checkout o campo opcional vai em `cart.metadata.aniversario`; vira `order.metadata` e o subscriber
`aniversario-pedido` (order.placed) copia para a cliente se ela ainda não tem a data.

## Fluxos

1. **Captar de quem já comprou** — job diário 10h (Brasília): clientes com pedido não cancelado, sem data e nunca
   perguntadas recebem a pergunta ("qual o dia e o mês?"), até 20 por dia. Telefone: cadastro, senão o último
   pedido. Marca `aniversario_pedido_em` ANTES de enviar (nunca repete).
2. **Resposta** — webhook do WhatsApp: se o número é de uma cliente perguntada há menos de 30 dias e sem data, e a
   mensagem tem uma data ("14/10", "14 de outubro", "1410"...), grava e responde "Anotado!". Se não tem data,
   insiste UMA vez; depois a mensagem segue como conversa normal (a equipe grava na ficha, se for o caso). A
   mensagem tratada aqui não passa pelas outras automações (avaliação, recuperação).
3. **Cadastro e checkout** — campo "Aniversário — dia/mês" opcional no cadastro, no perfil da conta e no 1º passo do
   checkout, com a frase "No seu dia você ganha 10% off e um presente da ÉCLAT".
4. **Parabéns** — job diário 9h (Brasília): quem aniversaria hoje (29/02 comemora 28/02 em ano comum) e ainda não
   ganhou este ano recebe: cupom `<PRIMEIRONOME>ANIV<AA>` (10% nas peças, 1 uso, 30 dias, criado via
   `createCampaignsWorkflow` + `createPromotionsWorkflow` — o gancho `conjunto-cupom` aplica a regra geral: por peça
   vale o maior desconto) e a mensagem de parabéns. Uma vez por ano.
5. **Presente** — o cupom de aniversário no pedido faz o Cockpit mostrar, no "Despachar pedido", o aviso para
   colocar na caixa o presente especial da Aurora aniversariante. Qual é o presente: decisão da sócia, fora do
   código.
6. **Cockpit** — "ÉCLAT hoje": métrica "Aniversariantes" + lista da semana com botão de WhatsApp; página
   **Aniversários**: resumo, esta semana e calendário por mês; ficha da cliente: campo dia/mês editável
   (`PATCH /api/customers/:id {aniversario}`) e aviso "perguntado no WhatsApp em …".

## Fora deste desenho
- Qual é o presente físico e quem embala (operação).
- Texto das mensagens pode ser ajustado em `apps/backend/src/lib/aniversario.ts` (um lugar só).
- Horários: 12h UTC (9h BRT) para os parabéns, 13h UTC (10h BRT) para a pergunta; sem horário de verão no Brasil.
