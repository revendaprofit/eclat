-- Recuperação automática de vendas (architecture/recuperacao.md) — decisão do dono em 2026-09-29.
-- Quem deixou contato e não comprou recebe: WhatsApp em tom de pessoa (1ª mensagem só abordagem,
-- oferta só depois que a pessoa responde) e e-mail. Uma linha por pessoa/ocasião, com a etapa.
-- RLS: anon negado (sem policies); backend e Cockpit usam service_role.
-- Numerada 0014 porque a 0013 é da branch de parcerias.

create table if not exists public.recuperacao_config (
  id                  int primary key default 1 check (id = 1),
  whatsapp_ativo      boolean not null default false,
  email_ativo         boolean not null default false,
  persona             text not null default 'Camila',
  cupom               text not null default 'BEMVINDA10',
  janela_inicio       time not null default '09:00',
  janela_fim          time not null default '19:00',
  max_abordagens_dia  int not null default 15,
  intervalo_min_min   int not null default 15,
  intervalo_max_min   int not null default 60,
  proximo_envio_em    timestamptz,
  falhas_seguidas     int not null default 0,
  updated_at          timestamptz not null default now()
);

insert into public.recuperacao_config (id) values (1) on conflict (id) do nothing;

create table if not exists public.recuperacao (
  id               uuid primary key default gen_random_uuid(),
  gatilho          text not null check (gatilho in ('lead_site','carrinho','pix','anuncio')),
  chave            text not null unique,             -- 'carrinho:<cart_id>' | 'lead:<lead_id>'
  contato          text,                             -- WhatsApp com DDI (55…)
  contato_chave    text,                             -- 55+DDD+8 últimos: casa com o JID do WhatsApp
  email            text,
  nome             text,
  cart_id          text,
  lead_id          uuid,
  conversation_id  uuid,
  dados            jsonb not null default '{}'::jsonb, -- itens, valor, link
  etapa            text not null default 'aguardando'
                     check (etapa in ('aguardando','abordada','respondeu','oferta_enviada','encerrada')),
  motivo_fim       text,
  elegivel_em      timestamptz not null default now(),
  abordagem_texto  text,
  abordagem_em     timestamptz,
  resposta_em      timestamptz,
  oferta_apos      timestamptz,
  oferta_texto     text,
  oferta_em        timestamptz,
  email_em         timestamptz,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

create index if not exists recuperacao_fila_idx on public.recuperacao (etapa, elegivel_em);
create index if not exists recuperacao_contato_idx on public.recuperacao (contato_chave, criado_em desc);
create index if not exists recuperacao_email_idx on public.recuperacao (lower(email), criado_em desc);

alter table public.recuperacao_config enable row level security;
alter table public.recuperacao enable row level security;
