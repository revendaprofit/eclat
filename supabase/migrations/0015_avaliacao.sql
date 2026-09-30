-- Pedido de avaliação pelo WhatsApp (docs/superpowers/specs/2026-09-30-avaliacoes-whatsapp-design.md,
-- architecture/avaliacao.md) — decisões do dono em 2026-09-30: 3 dias depois de entregue (10 dias depois
-- do despacho sem dado de entrega), autorização por 2ª mensagem automática, nada em troca.
-- Os freios do número (janela 9h–19h, teto diário, intervalo sorteado, próximo envio) são os da
-- recuperação (recuperacao_config) e o teto de mensagens por dia é COMPARTILHADO entre as duas.
-- RLS: anon negado (sem policies); backend e Cockpit usam service_role.

create table if not exists public.avaliacao_config (
  id                  int primary key default 1 check (id = 1),
  ativo               boolean not null default false,          -- interruptor: nasce DESLIGADO
  dias_apos_entrega   int not null default 3,
  dias_apos_despacho  int not null default 10,                 -- substituto sem dado de entrega
  marco_zero          timestamptz not null default now(),      -- pedidos anteriores não entram
  texto_pedido        text,                                    -- null = variações padrão do código
  texto_autorizacao   text,
  updated_at          timestamptz not null default now()
);

insert into public.avaliacao_config (id) values (1) on conflict (id) do nothing;

create table if not exists public.avaliacao (
  id                uuid primary key default gen_random_uuid(),
  order_id          text unique,                               -- null quando criada pelo botão manual
  display_id        int,
  origem            text not null check (origem in ('pedido','manual')),
  contato           text,                                      -- WhatsApp com DDI (55…)
  contato_chave     text,                                      -- 55+DDD+8 últimos (mesma regra da recuperação)
  nome              text,                                      -- primeiro nome
  pecas             text,                                      -- "o Conjunto Aurora", "o Macaquinho Solaris"
  conversation_id   uuid,
  etapa             text not null default 'agendada'
                      check (etapa in ('agendada','pedida','respondeu','autorizacao_pedida','autorizada','publicada','encerrada')),
  motivo_fim        text,
  elegivel_em       timestamptz not null,                      -- entrega + 3 dias (ou despacho + 10)
  pedido_texto      text,
  pedido_em         timestamptz,
  resposta_texto    text,                                      -- fala EXATA dela (o que pode ir para o site)
  resposta_em       timestamptz,
  tem_foto          boolean not null default false,
  autorizacao_apos  timestamptz,                               -- quando a 2ª mensagem pode sair (1–3 min)
  autorizacao_texto text,
  autorizacao_em    timestamptz,
  autorizou_texto   text,                                      -- o "sim" dela, literal (prova do consentimento)
  autorizou_em      timestamptz,
  publicado_em      timestamptz,
  publicado_por     text,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

create index if not exists avaliacao_fila_idx on public.avaliacao (etapa, elegivel_em);
create index if not exists avaliacao_contato_idx on public.avaliacao (contato_chave, criado_em desc);
create index if not exists avaliacao_pedido_em_idx on public.avaliacao (pedido_em);

alter table public.avaliacao_config enable row level security;
alter table public.avaliacao enable row level security;
