# Programa de aniversário das clientes (SOP)

Desenho: `docs/superpowers/specs/2026-10-14-aniversario-clientes-design.md`. Pedido da sócia em 14/10/2026.
"Aurora" = a mulher da comunidade ÉCLAT (a cliente), não uma peça.

## O que acontece sozinho
| quando (Brasília) | o quê | onde |
|---|---|---|
| todo dia 10h | pergunta a data a quem já comprou e nunca foi perguntada (até 20/dia) | `src/jobs/aniversario-pedir.ts` → `lib/aniversario-envios.ts` |
| na resposta | grava "MM-DD" na cliente e confirma; sem data, insiste uma vez | webhook `src/api/webhooks/whatsapp/route.ts` → `tratarRespostaDeAniversario` |
| todo dia 9h | aniversariante do dia: cria cupom `<NOME>ANIV<AA>` (10%, 1 uso, 30 dias) e manda os parabéns | `src/jobs/aniversario-parabens.ts` |
| no pedido | checkout com dia/mês → `order.metadata.aniversario` → ficha da cliente | `src/subscribers/aniversario-pedido.ts` |

Dados em `customer.metadata` (tabela no desenho). Textos em `src/lib/aniversario.ts` (um lugar só).
Depende de: Evolution conectada (`open`). Sem WhatsApp, os jobs só avisam no log e tentam no dia seguinte.

## O que a equipe faz
- **Presente da Aurora aniversariante**: o Cockpit avisa no "Despachar pedido" quando o pedido usou o cupom de
  aniversário. Colocar o presente na caixa é manual.
- **Data que chegou por áudio ou fora da janela**: gravar na ficha da cliente (Cockpit → Clientes → 🎂 Aniversário).
- **Conferir**: Cockpit → Aniversários (calendário) e "ÉCLAT hoje" (semana). Log do backend: `[aniversario]`.

## Clientes de teste
E-mails `@eclat.local` e `@useeclat.com.br` ficam de fora. Clientes de teste com outro e-mail (ex.: o próprio
dono/sócia) recebem a pergunta como qualquer cliente; responder ou ignorar não quebra nada.

## Se der errado
- Pergunta não saiu: ver `aniversario_pedido_status` na cliente (`sem_whatsapp` / `incerto`). Nunca reenvia sozinho;
  para perguntar de novo, apagar `aniversario_pedido_em` na metadata (Admin API) ou gravar a data direto.
- Parabéns "incerto": `aniversario_parabens.status`. O cupom pode ter sido criado; conferir em `/admin/promotions?code=`.
- Mensagem respondida com data mas não gravou: a janela de resposta é 30 dias depois da pergunta.
