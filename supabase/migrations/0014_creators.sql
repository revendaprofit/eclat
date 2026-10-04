-- Programa de creators — ciclo de conteúdo, aviso de venda e link por vídeo
-- (docs/superpowers/specs/2026-09-29-programa-creators-design.md §5 e §9; schema aprovado pelo dono em 2026-10-04).
-- A venda mora no Medusa; aqui ficam a creator, o que ela publicou, as peças enviadas e o aviso de cada venda.
-- RLS: anon negado (sem policies); backend e Cockpit usam service_role. Pode rodar mais de uma vez.

-- Parceria: apelido do link /p/<apelido>, aceite de receber aviso de venda e data de desativação.
alter table public.parceria add column if not exists apelido_link  text;
alter table public.parceria add column if not exists aceite_avisos boolean not null default false;  -- C5
alter table public.parceria add column if not exists aceite_em     timestamptz;
alter table public.parceria add column if not exists desativada_em timestamptz;
create unique index if not exists parceria_apelido_link on public.parceria (apelido_link) where apelido_link is not null;

create table if not exists public.creator (
  id               uuid primary key default gen_random_uuid(),
  instagram        text not null unique,           -- handle sem o @, minúsculo
  nome             text,
  whatsapp         text,                           -- dígitos com DDI 55
  cidade           text,
  nicho            text,                           -- fitness, corrida, pilates, lifestyle...
  status           text not null default 'encontrada'
                   check (status in ('encontrada','abordada','negociando','aprovada','recusou','encerrada')),
  nota             int check (nota between 1 and 5),
  origem           text,                           -- busca, indicação, se inscreveu
  parceria_codigo  text references public.parceria(codigo),
  aprovada_em      timestamptz,                    -- começo da contagem das vendas para a 2ª peça (C14)
  termo_versao     text,
  termo_aceito_em  timestamptz,
  notas            text,
  criado_em        timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index if not exists creator_parceria on public.creator (parceria_codigo) where parceria_codigo is not null;

-- Leitura do Instagram (histórico, uma linha por leitura)
create table if not exists public.creator_snapshot (
  id                uuid primary key default gen_random_uuid(),
  creator_id        uuid not null references public.creator(id) on delete cascade,
  seguidores        int,
  posts             int,
  media_curtidas    numeric,
  media_comentarios numeric,
  engajamento_pct   numeric,
  lido_em           timestamptz not null default now()
);

-- Peça enviada: a da aprovação e a 2ª, liberada com 5 vendas (C14)
create table if not exists public.creator_envio (
  id                   uuid primary key default gen_random_uuid(),
  creator_id           uuid not null references public.creator(id),
  medusa_order_id      text,
  itens                jsonb not null default '[]'::jsonb,   -- [{variant_id, titulo, custo_centavos}]
  custo_pecas_centavos bigint not null default 0,
  frete_centavos       bigint not null default 0,
  motivo               text not null default 'aprovacao' check (motivo in ('aprovacao','meta_vendas')),
  status               text not null default 'separando' check (status in ('separando','enviado','entregue')),
  criado_em            timestamptz not null default now()
);

-- Campanha = uma ação com briefing e datas. Sem cachê.
create table if not exists public.campanha (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  briefing   text not null,
  inicio     date,
  fim        date,
  status     text not null default 'rascunho' check (status in ('rascunho','ativa','encerrada')),
  criado_em  timestamptz not null default now()
);

-- Conteúdo da creator. `numero` é o do link /p/<apelido>/<numero> (C11); `vencedor_em` grava uma vez (C12).
create table if not exists public.creator_entrega (
  id             uuid primary key default gen_random_uuid(),
  creator_id     uuid not null references public.creator(id),
  campanha_id    uuid references public.campanha(id),
  numero         int not null,
  formato        text not null default 'reels' check (formato in ('reels','stories','post','ugc')),
  titulo         text,                              -- "Reels do Solaris no treino"
  prazo          date,
  status         text not null default 'publicada'
                 check (status in ('combinada','em_aprovacao','ajuste','aprovada','publicada')),
  arquivo_path   text,                              -- Storage privado: creators/<creator_id>/<arquivo>
  link_post      text,
  publicado_em   timestamptz,
  vencedor_em    timestamptz,
  em_anuncio     boolean not null default false,    -- C7
  comentario     text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (creator_id, numero)
);

-- Aviso de venda (C1–C5): uma linha por pedido com cupom de parceria; a chave garante no máximo um aviso.
-- É também daqui que saem a contagem do vídeo vencedor e a das 5 vendas.
create table if not exists public.parceria_aviso (
  order_id          text primary key,
  codigo            text not null references public.parceria(codigo),
  display_id        int not null,
  base_centavos     bigint not null check (base_centavos >= 0),
  comissao_centavos bigint not null check (comissao_centavos >= 0),
  entrega_id        uuid references public.creator_entrega(id),   -- de qual vídeo veio (null = cupom digitado)
  veio_pelo_link    boolean not null default false,
  status            text not null default 'pendente'
                    check (status in ('pendente','enviando','enviado','sem_whatsapp','dispensado','incerto')),
  texto             text,                                          -- o que foi enviado
  pedido_em         timestamptz not null,                          -- data do pedido (janela de 14 dias do C12)
  desde             timestamptz not null default now(),
  enviado_em        timestamptz
);
create index if not exists parceria_aviso_codigo_idx  on public.parceria_aviso (codigo, pedido_em desc);
create index if not exists parceria_aviso_entrega_idx on public.parceria_aviso (entrega_id, pedido_em);
create index if not exists parceria_aviso_status_idx  on public.parceria_aviso (status, desde);

alter table public.creator          enable row level security;
alter table public.creator_snapshot enable row level security;
alter table public.creator_envio    enable row level security;
alter table public.campanha         enable row level security;
alter table public.creator_entrega  enable row level security;
alter table public.parceria_aviso   enable row level security;

drop trigger if exists creator_updated on public.creator;
create trigger creator_updated before update on public.creator
  for each row execute function public.set_updated_at();

-- As duas creators que já publicam (dono, 2026-10-04): apelido do link e aceite do aviso de venda.
update public.parceria set apelido_link = 'paty',   aceite_avisos = true, aceite_em = now() where codigo = 'PATY10'   and apelido_link is null;
update public.parceria set apelido_link = 'nabels', aceite_avisos = true, aceite_em = now() where codigo = 'NABELS10' and apelido_link is null;
insert into public.creator (instagram, nome, whatsapp, status, origem, parceria_codigo, aprovada_em)
  select p.instagram, p.nome, p.whatsapp, 'aprovada', 'já parceira', p.codigo, p.criado_em
  from public.parceria p
  where p.codigo in ('PATY10','NABELS10') and p.instagram is not null
  on conflict (instagram) do nothing;
