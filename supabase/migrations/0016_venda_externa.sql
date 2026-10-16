-- Vendas fora do site (sócia, 2026-10-15): venda fechada no WhatsApp / presencial, lançada no Cockpit com os dados
-- da cliente, as peças, a forma de pagamento e, quando a prazo, a data combinada (lembrete automático no dia).
-- Desenho: docs/superpowers/specs/2026-10-15-vendas-fora-do-site-design.md. Dinheiro em CENTAVOS (invariante 3).
-- O estoque é baixado no Medusa pela Admin API na hora do lançamento (fonte da verdade do comércio continua lá);
-- a venda em si mora aqui porque não passa pelo checkout. RLS: anon negado (sem policies); service_role no servidor.

create table if not exists public.venda_externa (
  id                    uuid primary key default gen_random_uuid(),
  criado_em             timestamptz not null default now(),
  data                  date not null default current_date,            -- dia da venda
  canal                 text not null default 'whatsapp' check (canal in ('whatsapp','presencial','instagram','outro')),
  cliente_nome          text not null,
  cliente_whatsapp      text not null,                                  -- só dígitos, com 55
  cliente_email         text,
  medusa_customer_id    text,                                           -- vínculo com o cliente no Medusa (criado se não existia)
  itens                 jsonb not null,                                 -- [{variant_id, produto, variacao, sku, quantidade, preco_centavos, inventory_item_id}]
  subtotal_centavos     int not null check (subtotal_centavos >= 0),
  desconto_centavos     int not null default 0 check (desconto_centavos >= 0),
  total_centavos        int not null check (total_centavos >= 0),
  pagamento             text not null check (pagamento in ('pix','dinheiro','cartao','a_prazo')),
  pago                  boolean not null default false,
  pago_em               timestamptz,
  vencimento            date,                                           -- a_prazo: data combinada do pagamento
  lembrete_enviado_em   timestamptz,                                    -- job do backend, 9h do vencimento
  estoque_baixado       boolean not null default false,
  unboxing_enviado_em   timestamptz,                                    -- check da sócia: convite ao unboxing
  observacoes           text,
  cancelada_em          timestamptz
);

create index if not exists venda_externa_vencimento_idx on public.venda_externa (vencimento) where pago = false and cancelada_em is null;
create index if not exists venda_externa_data_idx on public.venda_externa (data);

alter table public.venda_externa enable row level security;
