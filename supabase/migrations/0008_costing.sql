-- 0008_costing.sql
-- Ficha de pré-custo de coleção (painel Custos no Cockpit).
-- Prática de mercado: BOM (materiais) + mão de obra + perdas => custo industrial;
-- precificação com impostos/taxas/CAC em % do preço + markup.
-- Dinheiro em CENTAVOS INTEIROS (invariante 3). Percentuais/consumos em numeric.
-- RLS: anon negado (sem policies); escrita/leitura via service_role (cockpit).

create table if not exists costing_piece (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,                 -- ex.: Calça Flare Licor
  collection             text,                          -- ex.: Coleção 01
  reference_image_url    text,
  status                 text not null default 'rascunho'
                         check (status in ('rascunho','cotacao','aprovada')),
  -- mão de obra / diluição
  faccao_centavos        integer not null default 0 check (faccao_centavos >= 0),
  estampa_centavos       integer not null default 0 check (estampa_centavos >= 0),
  modelagem_total_centavos integer not null default 0 check (modelagem_total_centavos >= 0),
  modelagem_pecas        integer not null default 100 check (modelagem_pecas > 0),
  perda_pct              numeric not null default 8,    -- % perda sobre materiais
  -- precificação
  imposto_pct            numeric not null default 8,    -- % sobre preço (Simples)
  taxa_pagamento_pct     numeric not null default 5,    -- gateway/parcelamento
  marketing_pct          numeric not null default 10,   -- CAC alvo
  frete_embalagem_centavos integer not null default 0,  -- envio + caixa por pedido
  markup                 numeric not null default 3,    -- multiplicador sobre custo industrial
  preco_venda_centavos   integer,                       -- null = usar preço sugerido
  medusa_variant_ids     text[] not null default '{}',  -- p/ aplicar como COGS (produto_custo)
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- BOM: materiais e aviamentos da peça
create table if not exists costing_item (
  id                 uuid primary key default gen_random_uuid(),
  piece_id           uuid not null references costing_piece (id) on delete cascade,
  kind               text not null default 'material'
                     check (kind in ('material','aviamento','servico')),
  name               text not null,        -- ex.: Ramatex Lightness cor Licor 8316
  unit               text not null default 'kg' check (unit in ('kg','m','un')),
  consumption        numeric not null default 0,   -- consumo por peça
  unit_price_centavos integer not null default 0 check (unit_price_centavos >= 0),
  position           integer not null default 0
);

create index if not exists idx_costing_item_piece on costing_item (piece_id, position);

alter table costing_piece enable row level security;
alter table costing_item  enable row level security;
-- Sem policies: anon/authenticated negados; service_role (cockpit) faz bypass.
