# CLAUDE.md — Constituição do Projeto use.ÉCLAT
> Este arquivo é LEI. Leia no início de toda sessão e siga integralmente.
> (Fonte canônica. O gemini.md apenas redireciona para cá.)

## Identidade
use.ÉCLAT — marca premium e INDEPENDENTE de moda fitness (athleisure da "mulher inteira").
Nunca vincular a Éclat a nenhuma outra marca.

## Stack
- Vitrine: Next.js (PWA) consumindo a Store API do Medusa
- Core de loja: Medusa v2 (Node/TypeScript + Postgres)
- Relacionamento: Supabase (CRM, leads, WhatsApp/BotConversa)
- Pagamento: Mercado Pago (cartão + Pix), em fase futura

## Invariantes de arquitetura (inegociáveis)
1. A Éclat é UM sistema, internamente modular. Sem segundo sistema independente.
2. Fonte da verdade: Medusa = comércio (produto, estoque, pedido, pagamento);
   Supabase = relacionamento (cliente, lead, conversa, ciclo do consumível).
   O Cockpit (módulo) apenas lê os dois e orquestra. Nenhum terceiro escritor.
3. Dinheiro sempre em centavos inteiros (BRL). Nunca float.
4. Pagamento sempre via SDK do gateway (Mercado Pago). Nunca processar cartão na mão.
5. RLS (Row Level Security) no Supabase desde o início.
6. Nunca adivinhar business logic. Se houver ambiguidade, PERGUNTAR.

## Método de trabalho (B.L.A.S.T.)
- Data-First: schema aprovado ANTES de qualquer código.
- Halt entre partes: cada parte só avança após o critério de aceite aprovado.
- Auto-reparo: em erro -> ler o stack trace -> corrigir -> testar ->
  atualizar o SOP em architecture/ para o erro nunca repetir.

## Memória do projeto
- CLAUDE.md   -> esta constituição (lei)
- gemini.md   -> redireciona para CLAUDE.md
- task_plan.md -> as 11 partes do build e checklists
- findings.md  -> pesquisa, descobertas, constraints
- progress.md  -> feito, erros, testes, resultados
- architecture/ -> SOPs técnicos (ex.: catalog.md)

## Estado atual
- Fundação (Parte 0): CONCLUÍDA. Repo: github.com/revendaprofit/eclat.
- Parte 1 — Catálogo: schema registrado em architecture/catalog.md. Região Brasil/BRL, vitrine pt-BR.
  Estrutura + 4 produtos-exemplo on-brand prontos (seed: apps/backend/src/scripts/seed-eclat.ts).
  PENDENTE: substituir exemplos pelos produtos REAIS + imagens (aguardando material da marca).
- Próxima decisão: receber catálogo real OU avançar para a Parte 2 (Vitrine/Storefront).
