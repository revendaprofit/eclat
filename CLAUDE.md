# CLAUDE.md — Constituição do Projeto use.ÉCLAT
> Este arquivo é LEI. Leia no início de toda sessão e siga integralmente.
> (Fonte canônica. O gemini.md apenas redireciona para cá.)

## Identidade
use.ÉCLAT — marca premium e INDEPENDENTE de moda fitness (athleisure da "mulher inteira").
Nunca vincular a Éclat a nenhuma outra marca.

## Stack
- Vitrine: Next.js (PWA) consumindo a Store API do Medusa
- Core de loja: Medusa v2 (Node/TypeScript + Postgres)
- Relacionamento: Supabase (CRM, leads, conversas). WhatsApp via Evolution API (self-hosted).
- Cockpit: app Next.js SEPARADO (apps/cockpit) operando via APIs donas. Plano: architecture/cockpit.md.
- Pagamento: Mercado Pago (cartão + Pix), em fase futura

## Invariantes de arquitetura (inegociáveis)
1. A Éclat é UM sistema, internamente modular. Sem segundo sistema independente.
2. Fonte da verdade: Medusa = comércio (produto, estoque, pedido, pagamento);
   Supabase = relacionamento/financeiro próprio (cliente, lead, conversa, despesas, COGS).
   O Cockpit (app separado) lê e escreve SOMENTE pelas APIs donas (Medusa Admin API = comércio;
   Supabase = relacionamento/financeiro; Evolution = WhatsApp). Não duplica dado de comércio;
   Medusa é a fonte da verdade do comércio. Ver architecture/cockpit.md (plano canônico do Cockpit).
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
- Fundação (Parte 0): CONCLUÍDA. Repo: github.com/revendaprofit/eclat (conta revendaprofit fixada p/ push).
- Parte 1 — Catálogo: architecture/catalog.md. Região Brasil/BRL, vitrine pt-BR. 4 produtos-exemplo
  (seed: apps/backend/src/scripts/seed-eclat.ts). PENDENTE: produtos REAIS + imagens.
- Parte 2 — Vitrine: shell de marca pt-BR (nav, hero, home, footer). PENDENTE: busca, SEO por página, telas de conta.
- Parte 3 — Carrinho & Checkout: fluxo validado (pedido criado) + pt-BR. Pagamento = provider manual.
- Parte 4 — Pagamento (Mercado Pago): ADIADA (retomar com Access Token do MP).
- Parte 5 — CRM/Supabase: architecture/crm.md + supabase/migrations/0001_crm_init.sql aplicados.
  Tabelas lead/cliente_rel/conversa com RLS (anon negado, backend via service_role). SUPABASE_DB_URL no .env.
- Parte 6 — WhatsApp via Evolution API (instância eclat): integração montada (lib/evolution, lib/supabase,
  api/webhooks/whatsapp) + webhook configurado. FALTA conectar o WhatsApp (QR) e testar. SOP: architecture/whatsapp.md.
- Cockpit: REDEFINIDO como app Next.js separado (apps/cockpit), plano completo e faseado registrado em
  architecture/cockpit.md (Fases 0–6). A página read-only no admin do Medusa (antiga "Parte 7" v0) está superada.
  Build por fase, com Halt.
  - Fase 0 (Shell): CONCLUÍDA. apps/cockpit (Next 15.5), login Supabase Auth (operador@eclat.local),
    menu das 7 áreas (placeholders), /api/health (Medusa+Supabase+Evolution OK). Porta 7001.
- Próxima ação: Fase 1 do Cockpit (Conversas/Chat WhatsApp) quando o usuário aprovar.
