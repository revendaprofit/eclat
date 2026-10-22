-- Visão geral do financeiro (sócia, 2026-10-22): o levantamento "INVESTIMENTOS ÉCLAT - LEVANTAMENTO.xlsx" (16/09)
-- vira a base única no Cockpit. Despesas ganham etapa/coleção, quantidade, custo unitário e observação; as fichas de
-- custo ganham o tamanho do lote produzido (para "investido no lote × vendas"). Reexecutável.

alter table public.finance_expense
  add column if not exists etapa                   text,       -- 'Lumière parte 01' | 'Lumière parte 02' | 'Athleisure' | 'Próxima coleção (Verde Exército e Licor)' | 'Acessórios' | 'Marca (geral)'
  add column if not exists quantidade              numeric,
  add column if not exists custo_unitario_centavos integer,
  add column if not exists observacao              text,
  add column if not exists origem                  text;       -- 'levantamento-2026-09' quando importada da planilha

create index if not exists idx_finance_expense_etapa on public.finance_expense (etapa);

alter table public.costing_piece
  add column if not exists lote_pecas integer not null default 0 check (lote_pecas >= 0);
