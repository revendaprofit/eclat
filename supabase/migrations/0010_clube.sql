-- Clube Éclat — automação do grupo do WhatsApp (architecture/clube.md)
-- Fila única de mensagens + regras de gatilho + snapshot de estoque + log.
-- RLS: anon negado (sem policies); backend e Cockpit usam service_role.

create table if not exists public.clube_config (
  id              int primary key default 1 check (id = 1),
  ativo           boolean not null default false,
  grupo_jid       text not null,
  aviso_jid       text,
  janela_inicio   time not null default '09:00',
  janela_fim      time not null default '21:00',
  max_por_dia     int not null default 3,
  atraso_max_min  int not null default 9,
  falhas_seguidas int not null default 0,
  updated_at      timestamptz not null default now()
);

create table if not exists public.clube_regras (
  tipo            text primary key
                    check (tipo in ('ultima_unidade','reposicao','novidade','esgotado','marco_reservas')),
  ativa           boolean not null default false,
  modo            text not null default 'aprovar' check (modo in ('automatico','aprovar')),
  template        text not null,
  limiar          int,
  cooldown_horas  int not null default 24,
  agrupar         boolean not null default true,
  anexar_foto     boolean not null default true,
  updated_at      timestamptz not null default now()
);

create table if not exists public.clube_mensagens (
  id              uuid primary key default gen_random_uuid(),
  origem          text not null check (origem in ('agenda','gatilho','manual')),
  tipo            text,
  status          text not null default 'rascunho'
                    check (status in ('rascunho','aprovada','enviada','falhou','descartada')),
  enviar_em       timestamptz,
  titulo          text,
  texto           text not null,
  texto_final     text,
  midia           text,
  midia_url_final text,
  dados           jsonb,
  chave_dedup     text,
  evolution_msg_id text,
  erro            text,
  criado_em       timestamptz not null default now(),
  aprovado_em     timestamptz,
  enviado_em      timestamptz
);
create index if not exists clube_mensagens_fila_idx on public.clube_mensagens (status, enviar_em);
create index if not exists clube_mensagens_dedup_idx on public.clube_mensagens (chave_dedup, criado_em desc);

create table if not exists public.clube_estoque_snapshot (
  variant_id      text primary key,
  product_id      text,
  product_handle  text,
  product_title   text,
  cor             text,
  tamanho         text,
  qty             int not null,
  publicado       boolean not null default true,
  visto_em        timestamptz not null default now()
);

create table if not exists public.clube_eventos_log (
  id              bigserial primary key,
  tipo            text not null,
  chave           text,
  dados           jsonb,
  resultado       text,
  criado_em       timestamptz not null default now()
);

alter table public.clube_config           enable row level security;
alter table public.clube_regras           enable row level security;
alter table public.clube_mensagens        enable row level security;
alter table public.clube_estoque_snapshot enable row level security;
alter table public.clube_eventos_log      enable row level security;

drop trigger if exists clube_config_updated on public.clube_config;
create trigger clube_config_updated before update on public.clube_config
  for each row execute function public.set_updated_at();
drop trigger if exists clube_regras_updated on public.clube_regras;
create trigger clube_regras_updated before update on public.clube_regras
  for each row execute function public.set_updated_at();
