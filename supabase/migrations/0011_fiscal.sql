-- Integração Fiscal — Brasil NFe (docs/superpowers/specs/2026-09-16-fiscal-brasilnfe-design.md)
-- Emitente, perfis tributários e documentos fiscais emitidos.
-- RLS: anon negado (sem policies); backend e Cockpit usam service_role.

create table if not exists public.fiscal_config (
  id                int primary key default 1 check (id = 1),
  cnpj              text not null,
  razao_social      text not null,
  nome_fantasia     text,
  ie                text not null,
  im                text,
  crt               int  not null default 1 check (crt in (1,2,3)),
  logradouro        text not null,
  numero            text not null,
  complemento       text,
  bairro            text not null,
  municipio         text not null,
  municipio_ibge    text not null,
  uf                text not null check (char_length(uf) = 2),
  cep               text not null,
  serie_nfe         int  not null default 1,
  ambiente          text not null default 'homologacao'
                      check (ambiente in ('homologacao','producao')),
  emissao_ativa     boolean not null default false,
  updated_at        timestamptz not null default now()
);

create table if not exists public.fiscal_perfil (
  id                        uuid primary key default gen_random_uuid(),
  escopo                    text not null check (escopo in ('padrao','categoria','produto')),
  alvo_id                   text,
  csosn                     text not null,
  cfop_dentro_uf            text not null,
  cfop_fora_uf              text not null,
  cfop_devolucao_dentro_uf  text not null,
  cfop_devolucao_fora_uf    text not null,
  origem_padrao             int  not null default 0 check (origem_padrao between 0 and 8),
  ativo                     boolean not null default true,
  updated_at                timestamptz not null default now(),
  -- 'padrao' não tem alvo; 'categoria'/'produto' exigem alvo
  check ((escopo = 'padrao' and alvo_id is null) or (escopo <> 'padrao' and alvo_id is not null))
);

-- Garante no máximo UMA linha de escopo 'padrao' e um perfil por alvo.
create unique index if not exists fiscal_perfil_padrao_unico
  on public.fiscal_perfil ((true)) where escopo = 'padrao';
create unique index if not exists fiscal_perfil_alvo_unico
  on public.fiscal_perfil (escopo, alvo_id) where alvo_id is not null;

create table if not exists public.fiscal_documento (
  id                 uuid primary key default gen_random_uuid(),
  medusa_order_id    text not null,
  tipo               text not null check (tipo in ('venda','devolucao')),
  modelo             int  not null default 55,
  serie              int,
  numero             int,
  chave_acesso       text unique,
  status             text not null default 'montado'
                       check (status in ('montado','transmitido_sem_confirmacao',
                                         'autorizado_nao_verificado','verificado',
                                         'rejeitado','denegado','em_contingencia')),
  ambiente           text not null check (ambiente in ('homologacao','producao')),
  idempotency_key    text not null unique,
  payload_enviado    jsonb not null,
  resposta_bruta     jsonb,
  rejeicao_codigo    text,
  rejeicao_motivo    text,
  xml_url            text,
  danfe_url          text,
  documento_origem_id uuid references public.fiscal_documento(id),
  verificado_em      timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists fiscal_documento_order_idx on public.fiscal_documento (medusa_order_id);
create index if not exists fiscal_documento_status_idx on public.fiscal_documento (status);

create table if not exists public.fiscal_documento_item (
  id                     uuid primary key default gen_random_uuid(),
  fiscal_documento_id    uuid not null references public.fiscal_documento(id) on delete cascade,
  medusa_line_item_id    text not null,
  ordem_enviada          int  not null check (ordem_enviada >= 1),
  n_item_verificado      int  check (n_item_verificado >= 1),
  codigo_enviado         text not null,
  ncm                    text not null,
  quantidade             int  not null check (quantidade >= 1),
  valor_unitario_centavos int not null check (valor_unitario_centavos >= 0),
  desconto_centavos      int  not null default 0 check (desconto_centavos >= 0),
  unique (fiscal_documento_id, ordem_enviada)
);

create index if not exists fiscal_documento_item_doc_idx
  on public.fiscal_documento_item (fiscal_documento_id);

-- RLS: liga sem policy nenhuma => anon e authenticated não leem nem escrevem.
alter table public.fiscal_config          enable row level security;
alter table public.fiscal_perfil          enable row level security;
alter table public.fiscal_documento       enable row level security;
alter table public.fiscal_documento_item  enable row level security;

-- Emitente da use.ÉCLAT (spec §6.0). emissao_ativa = false: nada é transmitido até o dono ligar.
insert into public.fiscal_config (
  id, cnpj, razao_social, nome_fantasia, ie, crt,
  logradouro, numero, bairro, municipio, municipio_ibge, uf, cep,
  serie_nfe, ambiente, emissao_ativa
) values (
  1, '68673407000113', 'CAMILA DE MOURA NOGUEIRA', 'USE ECLAT', '56295050042', 1,
  'R NORTE', '180', 'ANGOLA', 'BETIM', '3106705', 'MG', '32604182',
  1, 'homologacao', false
) on conflict (id) do nothing;
