-- Parcerias com influencers — cupom da parceira e comissão
-- (docs/superpowers/specs/2026-09-25-parcerias-influencer-design.md; SOP futuro: architecture/parcerias.md)
-- A venda mora no Medusa (order.promotions[].code); aqui fica quem é a parceira, os percentuais e os repasses.
-- RLS: anon negado (sem policies); backend e Cockpit usam service_role.

create table if not exists public.parceria (
  codigo               text primary key,            -- = code da promoção no Medusa (ex.: PATY10)
  nome                 text not null,               -- nome da parceira
  instagram            text,                        -- handle sem o @
  whatsapp             text,                        -- dígitos com DDI 55, mesmo formato do CRM
  desconto_percentual  int  not null default 10 check (desconto_percentual between 1 and 100),
  comissao_percentual  int  not null default 5  check (comissao_percentual between 0 and 100),
  medusa_promotion_id  text not null,               -- promo_...
  medusa_campaign_id   text,                        -- procamp_... quando há teto de usos; null = sem teto
  ativa                boolean not null default true,
  notas                text,
  criado_em            timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Repasse fechado por período (um por parceria por período). Os pedidos que entraram ficam gravados
-- para o valor nunca mudar depois de pago, mesmo que um pedido seja cancelado mais tarde.
create table if not exists public.parceria_repasse (
  id               uuid primary key default gen_random_uuid(),
  codigo           text not null references public.parceria(codigo),
  periodo_inicio   date not null,
  periodo_fim      date not null,
  base_centavos    bigint not null check (base_centavos >= 0),   -- soma das peças pagas nos pedidos do período
  valor_centavos   bigint not null check (valor_centavos >= 0),  -- comissão devida
  pedidos          jsonb not null default '[]'::jsonb,           -- [{order_id, display_id, base_centavos, comissao_centavos}]
  status           text not null default 'aberto' check (status in ('aberto','pago')),
  pago_em          timestamptz,
  comprovante      text,                                          -- texto livre: id do Pix, observação
  criado_em        timestamptz not null default now(),
  unique (codigo, periodo_inicio, periodo_fim),
  check (periodo_fim >= periodo_inicio)
);
create index if not exists parceria_repasse_codigo_idx on public.parceria_repasse (codigo, periodo_inicio desc);

alter table public.parceria         enable row level security;
alter table public.parceria_repasse enable row level security;

drop trigger if exists parceria_updated on public.parceria;
create trigger parceria_updated before update on public.parceria
  for each row execute function public.set_updated_at();
