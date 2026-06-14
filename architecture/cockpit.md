# architecture/cockpit.md — SOP do Cockpit (Parte 7)

> Painel de orquestração que CONSOLIDA comércio + relacionamento. **Somente leitura** (invariante 2:
> o Cockpit lê os dois e orquestra; nunca escreve nas fontes da verdade).

## Onde vive
- **Página no Admin do Medusa**: `apps/backend/src/admin/routes/cockpit/page.tsx`
  (aparece no menu lateral via `defineRouteConfig`, ícone ChartBar).
- **Rota agregadora**: `apps/backend/src/api/admin/cockpit/route.ts` (GET, protegida por sessão de admin).

## O que lê
- **Comércio (Medusa)** via `query.graph` (read-only): contagem de produtos, clientes, pedidos;
  pedidos por status; receita dos pedidos recentes; últimos pedidos.
- **Relacionamento (Supabase)** via `lib/supabase.ts` (service_role, read-only): total de leads/clientes_rel/
  conversas; funil de leads (por status); conversas recentes.

## Contrato
- A rota NÃO escreve em Medusa nem em Supabase. Apenas agrega e devolve JSON.
- A página consome `/admin/cockpit` com `credentials: "include"` (sessão do admin).
- Erros por seção são isolados (comércio/relacionamento) — uma falha não derruba a outra.

## Limitações atuais / futuro
- Receita soma os pedidos recentes (take 100), não o histórico completo — rotular como "recentes".
  Para métricas históricas, usar agregação dedicada quando o volume crescer.
- "Orquestrar" hoje = consolidar visão. Ações (ex.: disparar WhatsApp a partir de um pedido) podem ser
  adicionadas como botões que chamam serviços existentes — sempre respeitando quem é dono de cada dado.
