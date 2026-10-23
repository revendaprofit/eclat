# Vendas fora do site (SOP)

Desenho: `docs/superpowers/specs/2026-10-15-vendas-fora-do-site-design.md`. Sócia, 15/10/2026.

| peça | onde |
|---|---|
| tabela | `supabase/migrations/0016_venda_externa.sql` (`venda_externa`, RLS sem policies: só service_role) |
| regras puras + textos | `apps/cockpit/lib/venda-externa.ts` (teste `venda-externa.test.ts`) |
| tela | `apps/cockpit/app/(painel)/vendas-externas/page.tsx` (menu Vender) |
| API | `app/api/vendas-externas/route.ts` (GET, POST) e `[id]/route.ts` (PATCH: pago, lembrar, unboxing, cancelar) |
| envio + registro na conversa | `apps/cockpit/lib/whatsapp-registro.ts` |
| lembrete automático 9h | `apps/backend/src/jobs/venda-externa-lembretes.ts` → `lib/venda-externa.ts` (texto igual ao do Cockpit) |
| DRE | `app/api/finance/dre/route.ts` (vendas pagas pela data; `receita_fora_site`, `vendas_fora_site`; peças de **creator** saem do COGS e viram `marketing_creators` + lista `creators` com nome e peças — sócia, 22/10: só o custo da peça, o resto é direto no WhatsApp) |

## Parte 2 (16/10): desconto, perfil e cartão
- Desconto em **R$ ou %** (botão R$ / %). Perfil: **Cliente** (livre), **Embaixadora** (20% travado), **Creator** (100% =
  custo zero → vira "Cortesia", paga, sem cobrança; ou um % menor que ela paga a diferença).
- **Cartão**: pede débito ou 1x..12x; a taxa vem da tabela "💳 Taxas da maquininha" (site_content
  `cockpit.taxas_cartao`, em %); grava `taxa_centavos` e `liquido_centavos`. Sem a taxa daquela parcela, a venda
  não fecha. No DRE a taxa entra em "(−) Taxas de pagamento" (sublinha "maquininha").
- Migration `0017_venda_externa_desconto_cartao.sql`.

## Operação
- Lançar: nome, WhatsApp, peças, pagamento. A prazo pede a data combinada (não aceita data passada).
- O estoque baixa no Medusa ao salvar (check ligado). Peça sem controle de estoque não baixa e a tela avisa.
- "✓ Recebi" marca paga. "💬 Lembrar agora" manda o lembrete na hora. "🎥 Convite ao unboxing" manda o roteiro.
- Cancelar DEVOLVE o estoque ao Medusa (22/10) quando a venda tinha baixado; se a devolução falhar, a venda não cancela.

## Se der errado
- `estoque não baixado` na lista: a Admin API falhou na hora; ajustar à mão em Produtos.
- Cliente sem vínculo (`medusa_customer_id` nulo): a criação falhou (ex.: e-mail já usado por outra conta); a venda
  vale igual, só não aparece na ficha 360°.
- Lembrete não saiu às 9h: ver o log `[venda-externa]`; WhatsApp desconectado espera o dia seguinte. Tabela
  inexistente (migration não aplicada) só gera aviso no log.

## Almoxarifado (22–23/10/2026)
Cockpit → Catálogo → Almoxarifado. Estoque de insumos em `site_content` chave `cockpit.almoxarifado` (`lib/almoxarifado.ts`,
API `app/api/almoxarifado`). Cada item tem `chave` (trecho do nome do insumo na ficha de custo); a simulação "tenho insumo
para a próxima produção?" soma `consumption × peças planejadas` das fichas (`costing_item`) e compara com o estoque útil
(contado − `reserva_pct`). A Visão geral (`/api/investimentos`) lê o mesmo estoque no quadro Insumos.

