# Integração Fiscal Brasil NFe — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emitir NF-e de venda no despacho do pedido e ter a capacidade de emitir NF-e de devolução (NFD) referenciando a nota de origem item a item, como exige a NT 2025.002-RTC v1.40.

**Architecture:** Libs em `apps/backend/src/lib/fiscal/` (padrão do Clube Éclat), com dados no Supabase via PostgREST/`service_role`. A Brasil NFe é um serviço sem estado de negócio: manda-se JSON, ela assina com o certificado A1 e fala com a SEFAZ. O `nItem` de cada item **não** é devolvido pela API — é derivado da ordem de envio — então uma rotina de reconciliação baixa o XML autorizado e lê o `nItem` real da SEFAZ. Só documento reconciliado pode ser referenciado numa NFD.

**Tech Stack:** TypeScript · Medusa v2.15.5 · Supabase (PostgREST) · Next.js 15.5 (Cockpit) · Jest (backend) · Vitest (Cockpit) · API REST da Brasil NFe

**Spec:** `docs/superpowers/specs/2026-09-16-fiscal-brasilnfe-design.md`

## Global Constraints

- **Dinheiro em centavos inteiros (BRL). Nunca float.** (Invariante 3 do CLAUDE.md)
- **Medusa é a fonte da verdade do comércio.** Nada de dado de pedido/produto duplicado no Supabase. (Invariante 2)
- **RLS no Supabase desde o início:** tabelas novas sem policy para `anon`; backend e Cockpit acessam via `service_role`. (Invariante 5)
- **Nunca adivinhar business logic.** Faltou NCM ou perfil fiscal → **falha explícita**, nunca um padrão chutado. (Invariante 6)
- **Emitente (§6.0 da spec, valores literais):** CNPJ `68673407000113` · IE `56295050042` · CRT `1` (Simples Nacional) · município IBGE `3106705` (Betim) · UF `MG` · CEP `32604182` · logradouro `R NORTE`, nº `180`, bairro `ANGOLA` · razão social `CAMILA DE MOURA NOGUEIRA` · fantasia `USE ECLAT`
- **Segredos:** `BRASILNFE_USER_TOKEN`, `BRASILNFE_COMPANY_TOKEN`, `BRASILNFE_WEBHOOK_SECRET` vivem em `apps/backend/.env` (já coberto por `**/.env` no `.gitignore`). **Nunca** commitados, nunca em log, nunca em mensagem de erro.
- **Estilo do código:** TypeScript sem ponto-e-vírgula, aspas duplas, comentários em português — igual a `src/lib/clube-db.ts`.
- **Ambiente:** todo o desenvolvimento e aceite rodam em `homologacao`. Virada para `producao` é decisão do dono, fora deste plano.

## Credenciais — quando cada tarefa precisa

| Tarefas | Precisa de token? |
|---|---|
| 1 – 5, 12 | **Não.** Migration e funções puras. Podem começar já. |
| 6 – 11, 13, 14 | **Sim.** Exigem `BRASILNFE_USER_TOKEN` e `BRASILNFE_COMPANY_TOKEN` no `.env`, e o certificado A1 carregado no painel da Brasil NFe. |

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/0011_fiscal.sql` | Tabelas `fiscal_config`, `fiscal_perfil`, `fiscal_documento`, `fiscal_documento_item` + RLS |
| `apps/backend/src/lib/fiscal/tipos.ts` | Tipos compartilhados e constantes de status |
| `apps/backend/src/lib/fiscal/fiscal-db.ts` | Leitura/escrita das 4 tabelas via PostgREST |
| `apps/backend/src/lib/fiscal/fiscal-perfil.ts` | Resolução produto → categoria → padrão (função pura) |
| `apps/backend/src/lib/fiscal/fiscal-payload.ts` | Pedido + config + perfis → payload da NF-e de venda (função pura) |
| `apps/backend/src/lib/fiscal/fiscal-xml.ts` | Parse de `<det nItem="N">` do XML autorizado (função pura) |
| `apps/backend/src/lib/fiscal/fiscal-client.ts` | HTTP da Brasil NFe: preview, transmitir, baixar XML |
| `apps/backend/src/lib/fiscal/fiscal-emissao.ts` | Orquestração da emissão, idempotência |
| `apps/backend/src/lib/fiscal/fiscal-reconciliar.ts` | Baixa XML, grava `n_item_verificado`, marca `verificado_em` |
| `apps/backend/src/lib/fiscal/fiscal-payload-devolucao.ts` | Payload da NFD com `DFeReferenciado` + a trava de documento verificado |
| `apps/backend/src/api/admin/fiscal/**` | Rotas admin (config, perfis, documentos, emitir, reconciliar) |
| `apps/backend/src/api/webhooks/brasilnfe/route.ts` | Webhook de mudança de status |
| `apps/backend/src/jobs/fiscal-reconciliar.ts` | Varredura periódica de segurança |
| `apps/cockpit/lib/fiscal.ts` | Helpers de UI (rótulos de status, formatação) |
| `apps/cockpit/app/(painel)/fiscal/page.tsx` | Tela Fiscal: config, perfis, fila de exceções |
| `apps/cockpit/app/api/fiscal/**` | Proxy do Cockpit para as rotas admin |
| `apps/cockpit/app/api/orders/[id]/dispatch/route.ts` | **Modificar**: emitir NF-e antes do fulfillment |

---

### Task 1: Migration do schema fiscal no Supabase

**Files:**
- Create: `supabase/migrations/0011_fiscal.sql`

**Interfaces:**
- Consumes: nada
- Produces: tabelas `fiscal_config`, `fiscal_perfil`, `fiscal_documento`, `fiscal_documento_item`

- [ ] **Step 1: Escrever a migration**

Criar `supabase/migrations/0011_fiscal.sql`:

```sql
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
  ncm                    text not null,
  quantidade             int  not null check (quantidade >= 1),
  valor_unitario_centavos int not null check (valor_unitario_centavos >= 0),
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
```

- [ ] **Step 2: Aplicar no Supabase**

Aplicar pelo SQL Editor do painel do Supabase (mesmo caminho usado em `0010_clube.sql`), ou:

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/0011_fiscal.sql
```

- [ ] **Step 3: Verificar que as tabelas existem e o seed entrou**

```bash
psql "$SUPABASE_DB_URL" -c "select cnpj, ie, municipio_ibge, ambiente, emissao_ativa from public.fiscal_config;"
```

Esperado: uma linha com `68673407000113 | 56295050042 | 3106705 | homologacao | f`

- [ ] **Step 4: Verificar que o RLS está ligado**

```bash
psql "$SUPABASE_DB_URL" -c "select tablename, rowsecurity from pg_tables where schemaname='public' and tablename like 'fiscal_%';"
```

Esperado: as 4 tabelas com `rowsecurity = t`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0011_fiscal.sql
git commit -m "feat(fiscal): schema de documentos fiscais no Supabase"
```

---

### Task 2: Tipos compartilhados

**Files:**
- Create: `apps/backend/src/lib/fiscal/tipos.ts`

**Interfaces:**
- Consumes: nada
- Produces: `FiscalConfig`, `FiscalPerfil`, `FiscalDocumento`, `FiscalDocumentoItem`, `StatusDocumento`, `ItemPedido`, `STATUS_BLOQUEIA_NFD`

- [ ] **Step 1: Escrever os tipos**

Criar `apps/backend/src/lib/fiscal/tipos.ts`:

```typescript
// Tipos compartilhados da integração fiscal (spec §6).
// Dinheiro sempre em centavos inteiros (Invariante 3).

export type Ambiente = "homologacao" | "producao"

export type StatusDocumento =
  | "montado"
  | "transmitido_sem_confirmacao"
  | "autorizado_nao_verificado"
  | "verificado"
  | "rejeitado"
  | "denegado"
  | "em_contingencia"

// Só documento 'verificado' pode ser referenciado numa NFD (spec §7.3).
export const STATUS_PERMITE_NFD: StatusDocumento[] = ["verificado"]

export type FiscalConfig = {
  id: number
  cnpj: string
  razao_social: string
  nome_fantasia: string | null
  ie: string
  im: string | null
  crt: number
  logradouro: string
  numero: string
  complemento: string | null
  bairro: string
  municipio: string
  municipio_ibge: string
  uf: string
  cep: string
  serie_nfe: number
  ambiente: Ambiente
  emissao_ativa: boolean
}

export type FiscalPerfil = {
  id: string
  escopo: "padrao" | "categoria" | "produto"
  alvo_id: string | null
  csosn: string
  cfop_dentro_uf: string
  cfop_fora_uf: string
  cfop_devolucao_dentro_uf: string
  cfop_devolucao_fora_uf: string
  origem_padrao: number
  ativo: boolean
}

export type FiscalDocumento = {
  id: string
  medusa_order_id: string
  tipo: "venda" | "devolucao"
  modelo: number
  serie: number | null
  numero: number | null
  chave_acesso: string | null
  status: StatusDocumento
  ambiente: Ambiente
  idempotency_key: string
  payload_enviado: Record<string, unknown>
  resposta_bruta: Record<string, unknown> | null
  rejeicao_codigo: string | null
  rejeicao_motivo: string | null
  xml_url: string | null
  danfe_url: string | null
  documento_origem_id: string | null
  verificado_em: string | null
}

export type FiscalDocumentoItem = {
  id: string
  fiscal_documento_id: string
  medusa_line_item_id: string
  ordem_enviada: number
  n_item_verificado: number | null
  ncm: string
  quantidade: number
  valor_unitario_centavos: number
}

// Item do pedido do Medusa, já enriquecido com os dados fiscais da variante.
export type ItemPedido = {
  line_item_id: string
  product_id: string
  categoria_handle: string | null
  titulo: string
  sku: string | null
  ncm: string | null          // variant.hs_code
  origem: number | null       // derivado de variant.origin_country
  quantidade: number
  valor_unitario_centavos: number
}

// Erro de negócio da camada fiscal: sempre com mensagem legível para o operador.
export class ErroFiscal extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ErroFiscal"
  }
}
```

- [ ] **Step 2: Verificar que compila**

```bash
cd apps/backend && npx tsc --noEmit
```

Esperado: sem erro apontando `src/lib/fiscal/tipos.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/lib/fiscal/tipos.ts
git commit -m "feat(fiscal): tipos compartilhados"
```

---

### Task 3: Resolução do perfil fiscal (produto → categoria → padrão)

**Files:**
- Create: `apps/backend/src/lib/fiscal/fiscal-perfil.ts`
- Test: `apps/backend/src/lib/fiscal/__tests__/fiscal-perfil.unit.spec.ts`

**Interfaces:**
- Consumes: `FiscalPerfil`, `ErroFiscal` de `tipos.ts`
- Produces: `resolverPerfil(perfis: FiscalPerfil[], productId: string, categoriaHandle: string | null): FiscalPerfil`

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/backend/src/lib/fiscal/__tests__/fiscal-perfil.unit.spec.ts`:

```typescript
import { resolverPerfil } from "../fiscal-perfil"
import { ErroFiscal, type FiscalPerfil } from "../tipos"

function perfil(p: Partial<FiscalPerfil>): FiscalPerfil {
  return {
    id: p.id ?? "p1",
    escopo: p.escopo ?? "padrao",
    alvo_id: p.alvo_id ?? null,
    csosn: p.csosn ?? "102",
    cfop_dentro_uf: p.cfop_dentro_uf ?? "5102",
    cfop_fora_uf: p.cfop_fora_uf ?? "6108",
    cfop_devolucao_dentro_uf: p.cfop_devolucao_dentro_uf ?? "1202",
    cfop_devolucao_fora_uf: p.cfop_devolucao_fora_uf ?? "2202",
    origem_padrao: p.origem_padrao ?? 0,
    ativo: p.ativo ?? true,
  }
}

const padrao = perfil({ id: "padrao", escopo: "padrao", csosn: "102" })
const porCategoria = perfil({ id: "cat", escopo: "categoria", alvo_id: "tops", csosn: "500" })
const porProduto = perfil({ id: "prod", escopo: "produto", alvo_id: "prod_1", csosn: "900" })

describe("resolverPerfil", () => {
  it("prefere o perfil do produto sobre o da categoria e o padrão", () => {
    const r = resolverPerfil([padrao, porCategoria, porProduto], "prod_1", "tops")
    expect(r.id).toBe("prod")
  })

  it("cai na categoria quando não há perfil do produto", () => {
    const r = resolverPerfil([padrao, porCategoria], "prod_2", "tops")
    expect(r.id).toBe("cat")
  })

  it("cai no padrão quando não há perfil de produto nem de categoria", () => {
    const r = resolverPerfil([padrao, porCategoria], "prod_2", "leggings")
    expect(r.id).toBe("padrao")
  })

  it("ignora perfil inativo e desce um nível", () => {
    const catInativo = perfil({ id: "cat", escopo: "categoria", alvo_id: "tops", ativo: false })
    const r = resolverPerfil([padrao, catInativo], "prod_2", "tops")
    expect(r.id).toBe("padrao")
  })

  it("falha com mensagem legível quando não existe perfil padrão", () => {
    expect(() => resolverPerfil([porCategoria], "prod_2", "leggings")).toThrow(ErroFiscal)
    expect(() => resolverPerfil([porCategoria], "prod_2", "leggings")).toThrow(
      /Nenhum perfil fiscal padrão/
    )
  })

  it("não inventa perfil quando a categoria é nula", () => {
    const r = resolverPerfil([padrao, porCategoria], "prod_2", null)
    expect(r.id).toBe("padrao")
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd apps/backend && TEST_TYPE=unit npx jest src/lib/fiscal/__tests__/fiscal-perfil.unit.spec.ts
```

Esperado: FAIL — `Cannot find module '../fiscal-perfil'`

- [ ] **Step 3: Implementar**

Criar `apps/backend/src/lib/fiscal/fiscal-perfil.ts`:

```typescript
// Resolve qual regra tributária vale para um item: produto → categoria → padrão (spec §7.1).
// Nunca inventa valor: sem perfil padrão cadastrado, falha explícita (Invariante 6).

import { ErroFiscal, type FiscalPerfil } from "./tipos"

export function resolverPerfil(
  perfis: FiscalPerfil[],
  productId: string,
  categoriaHandle: string | null
): FiscalPerfil {
  const ativos = perfis.filter((p) => p.ativo)

  const doProduto = ativos.find((p) => p.escopo === "produto" && p.alvo_id === productId)
  if (doProduto) return doProduto

  if (categoriaHandle) {
    const daCategoria = ativos.find(
      (p) => p.escopo === "categoria" && p.alvo_id === categoriaHandle
    )
    if (daCategoria) return daCategoria
  }

  const padrao = ativos.find((p) => p.escopo === "padrao")
  if (padrao) return padrao

  throw new ErroFiscal(
    "Nenhum perfil fiscal padrão ativo cadastrado. Cadastre o perfil padrão em Fiscal → Perfis antes de emitir."
  )
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
cd apps/backend && TEST_TYPE=unit npx jest src/lib/fiscal/__tests__/fiscal-perfil.unit.spec.ts
```

Esperado: PASS, 6 testes.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/lib/fiscal/fiscal-perfil.ts apps/backend/src/lib/fiscal/__tests__/fiscal-perfil.unit.spec.ts
git commit -m "feat(fiscal): resolucao de perfil tributario produto/categoria/padrao"
```

---

### Task 4: Montagem do payload da NF-e de venda

**Files:**
- Create: `apps/backend/src/lib/fiscal/fiscal-payload.ts`
- Test: `apps/backend/src/lib/fiscal/__tests__/fiscal-payload.unit.spec.ts`

**Interfaces:**
- Consumes: `resolverPerfil` (Task 3); `FiscalConfig`, `FiscalPerfil`, `ItemPedido`, `ErroFiscal` (Task 2)
- Produces:
  - `type DestinatarioNF = { cpf: string; nome: string; logradouro: string; numero: string; complemento: string | null; bairro: string; municipio: string; municipio_ibge: string; uf: string; cep: string }`
  - `montarPayloadVenda(args: { config: FiscalConfig; perfis: FiscalPerfil[]; itens: ItemPedido[]; destinatario: DestinatarioNF; frete_centavos: number }): { payload: Record<string, unknown>; itens_ordenados: ItemPedido[] }`

`itens_ordenados` é a ordem exata enviada à Brasil NFe — vira `ordem_enviada` em `fiscal_documento_item` (Task 7).

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/backend/src/lib/fiscal/__tests__/fiscal-payload.unit.spec.ts`:

```typescript
import { montarPayloadVenda, type DestinatarioNF } from "../fiscal-payload"
import { ErroFiscal, type FiscalConfig, type FiscalPerfil, type ItemPedido } from "../tipos"

const config: FiscalConfig = {
  id: 1, cnpj: "68673407000113", razao_social: "CAMILA DE MOURA NOGUEIRA",
  nome_fantasia: "USE ECLAT", ie: "56295050042", im: null, crt: 1,
  logradouro: "R NORTE", numero: "180", complemento: null, bairro: "ANGOLA",
  municipio: "BETIM", municipio_ibge: "3106705", uf: "MG", cep: "32604182",
  serie_nfe: 1, ambiente: "homologacao", emissao_ativa: true,
}

const perfilPadrao: FiscalPerfil = {
  id: "padrao", escopo: "padrao", alvo_id: null, csosn: "102",
  cfop_dentro_uf: "5102", cfop_fora_uf: "6108",
  cfop_devolucao_dentro_uf: "1202", cfop_devolucao_fora_uf: "2202",
  origem_padrao: 0, ativo: true,
}

function item(p: Partial<ItemPedido> = {}): ItemPedido {
  return {
    line_item_id: p.line_item_id ?? "li_1",
    product_id: p.product_id ?? "prod_1",
    categoria_handle: p.categoria_handle ?? "tops",
    titulo: p.titulo ?? "Top Aura",
    sku: p.sku ?? "TOP-AURA-P",
    ncm: p.ncm ?? "61091000",
    origem: p.origem ?? 0,
    quantidade: p.quantidade ?? 1,
    valor_unitario_centavos: p.valor_unitario_centavos ?? 18900,
  }
}

function destino(uf: string): DestinatarioNF {
  return {
    cpf: "12345678909", nome: "Maria Silva", logradouro: "Rua A", numero: "10",
    complemento: null, bairro: "Centro", municipio: "Belo Horizonte",
    municipio_ibge: "3106200", uf, cep: "30110000",
  }
}

describe("montarPayloadVenda", () => {
  it("usa CFOP de dentro do estado quando o destino é MG", () => {
    const { payload } = montarPayloadVenda({
      config, perfis: [perfilPadrao], itens: [item()], destinatario: destino("MG"), frete_centavos: 0,
    })
    const itens = (payload as any).itens
    expect(itens[0].cfop).toBe("5102")
  })

  it("usa CFOP interestadual quando o destino é fora de MG", () => {
    const { payload } = montarPayloadVenda({
      config, perfis: [perfilPadrao], itens: [item()], destinatario: destino("SP"), frete_centavos: 0,
    })
    expect((payload as any).itens[0].cfop).toBe("6108")
  })

  it("marca consumidor final não contribuinte em operação pela Internet", () => {
    const { payload } = montarPayloadVenda({
      config, perfis: [perfilPadrao], itens: [item()], destinatario: destino("MG"), frete_centavos: 0,
    })
    const p = payload as any
    expect(p.ind_ie_destinatario).toBe(9)
    expect(p.ind_final).toBe(1)
    expect(p.ind_presenca).toBe(2)
    expect(p.finalidade).toBe(1)
    expect(p.tipo_nf).toBe(1)
  })

  it("preenche CSOSN do perfil e CRT do emitente (Simples Nacional)", () => {
    const { payload } = montarPayloadVenda({
      config, perfis: [perfilPadrao], itens: [item()], destinatario: destino("MG"), frete_centavos: 0,
    })
    expect((payload as any).itens[0].csosn).toBe("102")
    expect((payload as any).emitente.crt).toBe(1)
  })

  it("converte centavos para reais com 2 casas, sem float acumulado", () => {
    const { payload } = montarPayloadVenda({
      config, perfis: [perfilPadrao],
      itens: [item({ valor_unitario_centavos: 18990, quantidade: 3 })],
      destinatario: destino("MG"), frete_centavos: 1990,
    })
    const p = payload as any
    expect(p.itens[0].valor_unitario).toBe("189.90")
    expect(p.itens[0].valor_total).toBe("569.70")
    expect(p.total.valor_frete).toBe("19.90")
    expect(p.total.valor_produtos).toBe("569.70")
    expect(p.total.valor_nota).toBe("589.60")
  })

  it("numera itens de 1 em diante e devolve a ordem enviada", () => {
    const a = item({ line_item_id: "li_a" })
    const b = item({ line_item_id: "li_b" })
    const { payload, itens_ordenados } = montarPayloadVenda({
      config, perfis: [perfilPadrao], itens: [a, b], destinatario: destino("MG"), frete_centavos: 0,
    })
    expect((payload as any).itens.map((i: any) => i.numero_item)).toEqual([1, 2])
    expect(itens_ordenados.map((i) => i.line_item_id)).toEqual(["li_a", "li_b"])
  })

  it("falha com mensagem legível quando falta NCM", () => {
    expect(() =>
      montarPayloadVenda({
        config, perfis: [perfilPadrao], itens: [item({ ncm: null, titulo: "Top Aura" })],
        destinatario: destino("MG"), frete_centavos: 0,
      })
    ).toThrow(/Top Aura.*NCM/s)
  })

  it("falha quando não há itens", () => {
    expect(() =>
      montarPayloadVenda({
        config, perfis: [perfilPadrao], itens: [], destinatario: destino("MG"), frete_centavos: 0,
      })
    ).toThrow(ErroFiscal)
  })

  it("usa origem do perfil quando a variante não tem origem", () => {
    const { payload } = montarPayloadVenda({
      config, perfis: [{ ...perfilPadrao, origem_padrao: 1 }], itens: [item({ origem: null })],
      destinatario: destino("MG"), frete_centavos: 0,
    })
    expect((payload as any).itens[0].origem).toBe(1)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd apps/backend && TEST_TYPE=unit npx jest src/lib/fiscal/__tests__/fiscal-payload.unit.spec.ts
```

Esperado: FAIL — `Cannot find module '../fiscal-payload'`

- [ ] **Step 3: Implementar**

Criar `apps/backend/src/lib/fiscal/fiscal-payload.ts`:

```typescript
// Monta o payload da NF-e de venda a partir do pedido do Medusa + perfil tributário (spec §7.1).
// Função PURA: não faz rede, não lê banco. Isso a torna testável sem credencial.
//
// Dinheiro: entra em centavos inteiros (Invariante 3) e só vira string decimal na fronteira
// com a API, que espera reais. A conversão é feita com aritmética inteira — nunca somando floats.

import { resolverPerfil } from "./fiscal-perfil"
import { ErroFiscal, type FiscalConfig, type FiscalPerfil, type ItemPedido } from "./tipos"

export type DestinatarioNF = {
  cpf: string
  nome: string
  logradouro: string
  numero: string
  complemento: string | null
  bairro: string
  municipio: string
  municipio_ibge: string
  uf: string
  cep: string
}

// Centavos inteiros -> "1234.56". Sem float em nenhum ponto.
function reais(centavos: number): string {
  const sinal = centavos < 0 ? "-" : ""
  const abs = Math.abs(centavos)
  return `${sinal}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`
}

export function montarPayloadVenda(args: {
  config: FiscalConfig
  perfis: FiscalPerfil[]
  itens: ItemPedido[]
  destinatario: DestinatarioNF
  frete_centavos: number
}): { payload: Record<string, unknown>; itens_ordenados: ItemPedido[] } {
  const { config, perfis, itens, destinatario, frete_centavos } = args

  if (itens.length === 0) {
    throw new ErroFiscal("Pedido sem itens: não há o que emitir.")
  }

  const interestadual = destinatario.uf.toUpperCase() !== config.uf.toUpperCase()

  const linhas = itens.map((it, idx) => {
    if (!it.ncm) {
      throw new ErroFiscal(
        `Produto "${it.titulo}" está sem NCM. Cadastre o NCM da variante (campo hs_code) em Produtos antes de emitir.`
      )
    }
    const perfil = resolverPerfil(perfis, it.product_id, it.categoria_handle)
    const totalCentavos = it.valor_unitario_centavos * it.quantidade
    return {
      numero_item: idx + 1,
      codigo: it.sku ?? it.line_item_id,
      descricao: it.titulo,
      ncm: it.ncm,
      cfop: interestadual ? perfil.cfop_fora_uf : perfil.cfop_dentro_uf,
      csosn: perfil.csosn,
      origem: it.origem ?? perfil.origem_padrao,
      unidade: "UN",
      quantidade: it.quantidade,
      valor_unitario: reais(it.valor_unitario_centavos),
      valor_total: reais(totalCentavos),
    }
  })

  const produtosCentavos = itens.reduce(
    (acc, it) => acc + it.valor_unitario_centavos * it.quantidade,
    0
  )

  const payload: Record<string, unknown> = {
    modelo: 55,
    serie: config.serie_nfe,
    ambiente: config.ambiente,
    finalidade: 1, // 1 = NF-e normal
    tipo_nf: 1, // 1 = saída
    ind_final: 1, // consumidor final
    ind_presenca: 2, // operação não presencial, pela Internet
    ind_ie_destinatario: 9, // não contribuinte
    natureza_operacao: "VENDA DE MERCADORIA",
    emitente: {
      cnpj: config.cnpj,
      razao_social: config.razao_social,
      nome_fantasia: config.nome_fantasia,
      ie: config.ie,
      crt: config.crt,
      logradouro: config.logradouro,
      numero: config.numero,
      complemento: config.complemento,
      bairro: config.bairro,
      municipio: config.municipio,
      municipio_ibge: config.municipio_ibge,
      uf: config.uf,
      cep: config.cep,
    },
    destinatario: {
      cpf: destinatario.cpf,
      nome: destinatario.nome,
      logradouro: destinatario.logradouro,
      numero: destinatario.numero,
      complemento: destinatario.complemento,
      bairro: destinatario.bairro,
      municipio: destinatario.municipio,
      municipio_ibge: destinatario.municipio_ibge,
      uf: destinatario.uf,
      cep: destinatario.cep,
    },
    itens: linhas,
    total: {
      valor_produtos: reais(produtosCentavos),
      valor_frete: reais(frete_centavos),
      valor_nota: reais(produtosCentavos + frete_centavos),
    },
  }

  return { payload, itens_ordenados: itens }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
cd apps/backend && TEST_TYPE=unit npx jest src/lib/fiscal/__tests__/fiscal-payload.unit.spec.ts
```

Esperado: PASS, 9 testes.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/lib/fiscal/fiscal-payload.ts apps/backend/src/lib/fiscal/__tests__/fiscal-payload.unit.spec.ts
git commit -m "feat(fiscal): montagem do payload da NF-e de venda"
```

> **Nota para quem executar:** os nomes de campo do payload (`ind_presenca`, `csosn`, `numero_item`…) são a nossa melhor leitura da documentação da Brasil NFe. Na Task 6 eles serão confrontados com a API real de homologação. Se divergirem, **corrija aqui e rode os testes de novo** — esta função é a única fonte da forma do payload.

---

### Task 5: Parser do `nItem` do XML autorizado

**Files:**
- Create: `apps/backend/src/lib/fiscal/fiscal-xml.ts`
- Create: `apps/backend/src/lib/fiscal/__tests__/fixtures/nfe-autorizada.xml`
- Test: `apps/backend/src/lib/fiscal/__tests__/fiscal-xml.unit.spec.ts`

**Interfaces:**
- Consumes: `ErroFiscal` (Task 2)
- Produces:
  - `type ItemXml = { n_item: number; codigo: string; ncm: string }`
  - `extrairItensDoXml(xml: string): ItemXml[]`
  - `extrairChaveDoXml(xml: string): string`

Esta é a tarefa que sustenta a devolução inteira (spec §7.3). Sem ela, a NFD é impossível.

- [ ] **Step 1: Criar o fixture de XML**

Criar `apps/backend/src/lib/fiscal/__tests__/fixtures/nfe-autorizada.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe31260968673407000113550010000000011000000017" versao="4.00">
      <ide><cUF>31</cUF><natOp>VENDA DE MERCADORIA</natOp><mod>55</mod><serie>1</serie><nNF>1</nNF></ide>
      <det nItem="1">
        <prod><cProd>TOP-AURA-P</cProd><xProd>Top Aura P</xProd><NCM>61091000</NCM><CFOP>5102</CFOP><qCom>1.0000</qCom><vUn>189.90</vUn></prod>
      </det>
      <det nItem="2">
        <prod><cProd>LEG-VERTICE-M</cProd><xProd>Legging Vertice M</xProd><NCM>61046200</NCM><CFOP>5102</CFOP><qCom>2.0000</qCom><vUn>249.90</vUn></prod>
      </det>
      <det nItem="3">
        <prod><cProd>SHORT-NIMBLE-G</cProd><xProd>Short Nimble G</xProd><NCM>61046300</NCM><CFOP>5102</CFOP><qCom>1.0000</qCom><vUn>159.90</vUn></prod>
      </det>
    </infNFe>
  </NFe>
  <protNFe versao="4.00">
    <infProt>
      <chNFe>31260968673407000113550010000000011000000017</chNFe>
      <nProt>131260000000001</nProt>
      <cStat>100</cStat>
      <xMotivo>Autorizado o uso da NF-e</xMotivo>
    </infProt>
  </protNFe>
</nfeProc>
```

- [ ] **Step 2: Escrever o teste que falha**

Criar `apps/backend/src/lib/fiscal/__tests__/fiscal-xml.unit.spec.ts`:

```typescript
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { extrairItensDoXml, extrairChaveDoXml } from "../fiscal-xml"
import { ErroFiscal } from "../tipos"

const xml = readFileSync(join(__dirname, "fixtures", "nfe-autorizada.xml"), "utf8")

describe("extrairItensDoXml", () => {
  it("extrai um item por <det>, com nItem, código e NCM", () => {
    const itens = extrairItensDoXml(xml)
    expect(itens).toHaveLength(3)
    expect(itens[0]).toEqual({ n_item: 1, codigo: "TOP-AURA-P", ncm: "61091000" })
    expect(itens[2]).toEqual({ n_item: 3, codigo: "SHORT-NIMBLE-G", ncm: "61046300" })
  })

  it("devolve os itens ordenados por nItem, mesmo se o XML vier fora de ordem", () => {
    const foraDeOrdem = `<nfeProc>
      <det nItem="3"><prod><cProd>C</cProd><NCM>333</NCM></prod></det>
      <det nItem="1"><prod><cProd>A</cProd><NCM>111</NCM></prod></det>
      <det nItem="2"><prod><cProd>B</cProd><NCM>222</NCM></prod></det>
    </nfeProc>`
    const itens = extrairItensDoXml(foraDeOrdem)
    expect(itens.map((i) => i.n_item)).toEqual([1, 2, 3])
    expect(itens.map((i) => i.codigo)).toEqual(["A", "B", "C"])
  })

  it("aceita nItem com aspas simples", () => {
    const itens = extrairItensDoXml(xml.replace(/nItem="(\d+)"/g, "nItem='$1'"))
    expect(itens.map((i) => i.n_item)).toEqual([1, 2, 3])
  })

  it("falha quando o XML não tem nenhum <det>", () => {
    expect(() => extrairItensDoXml("<nfeProc></nfeProc>")).toThrow(ErroFiscal)
    expect(() => extrairItensDoXml("<nfeProc></nfeProc>")).toThrow(/nenhum item/i)
  })

  it("falha quando um <det> não traz nItem (rejeição VC03-20 em potencial)", () => {
    expect(() => extrairItensDoXml("<det><prod><cProd>X</cProd><NCM>1</NCM></prod></det>")).toThrow(
      ErroFiscal
    )
  })
})

describe("extrairChaveDoXml", () => {
  it("extrai a chave de acesso de 44 dígitos do protocolo", () => {
    expect(extrairChaveDoXml(xml)).toBe("31260968673407000113550010000000011000000017")
  })

  it("falha quando não há chave", () => {
    expect(() => extrairChaveDoXml("<nfeProc></nfeProc>")).toThrow(ErroFiscal)
  })
})
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

```bash
cd apps/backend && TEST_TYPE=unit npx jest src/lib/fiscal/__tests__/fiscal-xml.unit.spec.ts
```

Esperado: FAIL — `Cannot find module '../fiscal-xml'`

- [ ] **Step 4: Implementar**

Criar `apps/backend/src/lib/fiscal/fiscal-xml.ts`:

```typescript
// Lê o nItem REAL de cada item do XML autorizado pela SEFAZ (spec §7.3).
//
// Por que isso existe: a Brasil NFe não devolve o nItem — ela o gera a partir da ordem em que
// enviamos os itens. Isso é um contrato posicional implícito, e contrato implícito quebra em
// silêncio. O XML autorizado é a única fonte confiável: nele o nItem está assinado pela SEFAZ.
// Sem esse valor, a NFD é rejeitada pela regra VC03-20.
//
// Parse por regex, de propósito: o recorte é minúsculo e fechado (atributo nItem, cProd, NCM,
// chNFe), e adicionar um parser XML como dependência do backend não se paga aqui.

import { ErroFiscal } from "./tipos"

export type ItemXml = { n_item: number; codigo: string; ncm: string }

const DET_RE = /<det\b([^>]*)>([\s\S]*?)<\/det>/g
const N_ITEM_RE = /\bnItem\s*=\s*["'](\d+)["']/
const C_PROD_RE = /<cProd>([\s\S]*?)<\/cProd>/
const NCM_RE = /<NCM>([\s\S]*?)<\/NCM>/
const CHAVE_RE = /<chNFe>(\d{44})<\/chNFe>/

export function extrairItensDoXml(xml: string): ItemXml[] {
  const itens: ItemXml[] = []

  for (const m of xml.matchAll(DET_RE)) {
    const atributos = m[1]
    const corpo = m[2]

    const nItem = N_ITEM_RE.exec(atributos)
    if (!nItem) {
      throw new ErroFiscal(
        "XML autorizado traz um item sem o atributo nItem. Sem ele a devolução seria rejeitada pela SEFAZ (VC03-20)."
      )
    }

    itens.push({
      n_item: Number(nItem[1]),
      codigo: (C_PROD_RE.exec(corpo)?.[1] ?? "").trim(),
      ncm: (NCM_RE.exec(corpo)?.[1] ?? "").trim(),
    })
  }

  if (itens.length === 0) {
    throw new ErroFiscal("XML autorizado não trouxe nenhum item (<det>).")
  }

  return itens.sort((a, b) => a.n_item - b.n_item)
}

export function extrairChaveDoXml(xml: string): string {
  const m = CHAVE_RE.exec(xml)
  if (!m) {
    throw new ErroFiscal("XML autorizado não traz a chave de acesso (<chNFe> com 44 dígitos).")
  }
  return m[1]
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

```bash
cd apps/backend && TEST_TYPE=unit npx jest src/lib/fiscal/__tests__/fiscal-xml.unit.spec.ts
```

Esperado: PASS, 7 testes.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/lib/fiscal/fiscal-xml.ts apps/backend/src/lib/fiscal/__tests__/
git commit -m "feat(fiscal): parser do nItem e da chave no XML autorizado"
```

---

### Task 6: Montagem do payload da NFD com `DFeReferenciado`

**Files:**
- Create: `apps/backend/src/lib/fiscal/fiscal-payload-devolucao.ts`
- Test: `apps/backend/src/lib/fiscal/__tests__/fiscal-payload-devolucao.unit.spec.ts`

**Interfaces:**
- Consumes: `resolverPerfil` (Task 3); `reais` via reimplementação local; `FiscalConfig`, `FiscalPerfil`, `FiscalDocumento`, `FiscalDocumentoItem`, `ItemPedido`, `ErroFiscal` (Task 2)
- Produces: `montarPayloadDevolucao(args: { config: FiscalConfig; perfis: FiscalPerfil[]; documentoOrigem: FiscalDocumento; itensOrigem: FiscalDocumentoItem[]; devolvidos: Array<{ line_item_id: string; quantidade: number }>; itensPedido: ItemPedido[]; ufDestinatarioOriginal: string }): { payload: Record<string, unknown>; itens_ordenados: ItemPedido[] }`

Esta task implementa a **trava de segurança** da spec §7.3 e §8.

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/backend/src/lib/fiscal/__tests__/fiscal-payload-devolucao.unit.spec.ts`:

```typescript
import { montarPayloadDevolucao } from "../fiscal-payload-devolucao"
import {
  ErroFiscal,
  type FiscalConfig,
  type FiscalDocumento,
  type FiscalDocumentoItem,
  type FiscalPerfil,
  type ItemPedido,
} from "../tipos"

const CHAVE = "31260968673407000113550010000000011000000017"

const config: FiscalConfig = {
  id: 1, cnpj: "68673407000113", razao_social: "CAMILA DE MOURA NOGUEIRA",
  nome_fantasia: "USE ECLAT", ie: "56295050042", im: null, crt: 1,
  logradouro: "R NORTE", numero: "180", complemento: null, bairro: "ANGOLA",
  municipio: "BETIM", municipio_ibge: "3106705", uf: "MG", cep: "32604182",
  serie_nfe: 1, ambiente: "homologacao", emissao_ativa: true,
}

const perfilPadrao: FiscalPerfil = {
  id: "padrao", escopo: "padrao", alvo_id: null, csosn: "102",
  cfop_dentro_uf: "5102", cfop_fora_uf: "6108",
  cfop_devolucao_dentro_uf: "1202", cfop_devolucao_fora_uf: "2202",
  origem_padrao: 0, ativo: true,
}

function documento(p: Partial<FiscalDocumento> = {}): FiscalDocumento {
  return {
    id: "doc_1", medusa_order_id: "order_1", tipo: "venda", modelo: 55,
    serie: 1, numero: 1, chave_acesso: CHAVE,
    status: p.status ?? "verificado", ambiente: "homologacao",
    idempotency_key: "order_1:venda:homologacao", payload_enviado: {},
    resposta_bruta: null, rejeicao_codigo: null, rejeicao_motivo: null,
    xml_url: null, danfe_url: null, documento_origem_id: null,
    verificado_em: p.verificado_em !== undefined ? p.verificado_em : "2026-09-16T12:00:00Z",
    ...p,
  }
}

const itensOrigem: FiscalDocumentoItem[] = [
  { id: "fi_1", fiscal_documento_id: "doc_1", medusa_line_item_id: "li_a", ordem_enviada: 1, n_item_verificado: 1, ncm: "61091000", quantidade: 1, valor_unitario_centavos: 18900 },
  { id: "fi_2", fiscal_documento_id: "doc_1", medusa_line_item_id: "li_b", ordem_enviada: 2, n_item_verificado: 2, ncm: "61046200", quantidade: 2, valor_unitario_centavos: 24900 },
]

const itensPedido: ItemPedido[] = [
  { line_item_id: "li_a", product_id: "prod_a", categoria_handle: "tops", titulo: "Top Aura", sku: "TOP-AURA-P", ncm: "61091000", origem: 0, quantidade: 1, valor_unitario_centavos: 18900 },
  { line_item_id: "li_b", product_id: "prod_b", categoria_handle: "leggings", titulo: "Legging Vertice", sku: "LEG-VERTICE-M", ncm: "61046200", origem: 0, quantidade: 2, valor_unitario_centavos: 24900 },
]

function chamar(over: Record<string, unknown> = {}) {
  return montarPayloadDevolucao({
    config, perfis: [perfilPadrao], documentoOrigem: documento(), itensOrigem,
    devolvidos: [{ line_item_id: "li_b", quantidade: 1 }],
    itensPedido, ufDestinatarioOriginal: "MG",
    ...over,
  } as Parameters<typeof montarPayloadDevolucao>[0])
}

describe("trava de segurança", () => {
  it("recusa quando o documento de origem não está verificado", () => {
    expect(() => chamar({ documentoOrigem: documento({ status: "autorizado_nao_verificado", verificado_em: null }) }))
      .toThrow(/não foi reconciliad|não está verificad/i)
  })

  it("recusa quando falta n_item_verificado em algum item devolvido", () => {
    const semNItem = [itensOrigem[0], { ...itensOrigem[1], n_item_verificado: null }]
    expect(() => chamar({ itensOrigem: semNItem })).toThrow(ErroFiscal)
  })

  it("recusa quando o documento de origem não tem chave de acesso", () => {
    expect(() => chamar({ documentoOrigem: documento({ chave_acesso: null }) })).toThrow(ErroFiscal)
  })
})

describe("montarPayloadDevolucao", () => {
  it("é nota de ENTRADA com finalidade 4 (devolução)", () => {
    const { payload } = chamar()
    expect((payload as any).tipo_nf).toBe(0)
    expect((payload as any).finalidade).toBe(4)
  })

  it("referencia a nota de origem item a item, com chave e nItem", () => {
    const { payload } = chamar()
    const item = (payload as any).itens[0]
    expect(item.documentos_referenciados).toEqual([{ chave_acesso: CHAVE, numero_item: 2 }])
  })

  it("devolução parcial referencia só o item devolvido", () => {
    const { payload } = chamar()
    expect((payload as any).itens).toHaveLength(1)
    expect((payload as any).itens[0].codigo).toBe("LEG-VERTICE-M")
  })

  it("respeita a quantidade devolvida, não a quantidade vendida", () => {
    const { payload } = chamar()
    expect((payload as any).itens[0].quantidade).toBe(1)
    expect((payload as any).itens[0].valor_total).toBe("249.00")
  })

  it("recusa quantidade devolvida maior que a vendida", () => {
    expect(() => chamar({ devolvidos: [{ line_item_id: "li_b", quantidade: 5 }] })).toThrow(
      /maior que a quantidade vendida/i
    )
  })

  it("usa CFOP de devolução dentro do estado quando a venda foi para MG", () => {
    expect(((chamar().payload) as any).itens[0].cfop).toBe("1202")
  })

  it("usa CFOP de devolução interestadual quando a venda foi para fora de MG", () => {
    const { payload } = chamar({ ufDestinatarioOriginal: "SP" })
    expect((payload as any).itens[0].cfop).toBe("2202")
  })

  it("a ÉCLAT é emitente E destinatária, com a IE informada (CCC: IE obrigatória como destinatário)", () => {
    const { payload } = chamar()
    const p = payload as any
    expect(p.emitente.cnpj).toBe("68673407000113")
    expect(p.destinatario.cnpj).toBe("68673407000113")
    expect(p.destinatario.ie).toBe("56295050042")
  })

  it("recusa item devolvido que não existe na nota de origem", () => {
    expect(() => chamar({ devolvidos: [{ line_item_id: "li_zzz", quantidade: 1 }] })).toThrow(ErroFiscal)
  })

  it("recusa lista de devolvidos vazia", () => {
    expect(() => chamar({ devolvidos: [] })).toThrow(ErroFiscal)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd apps/backend && TEST_TYPE=unit npx jest src/lib/fiscal/__tests__/fiscal-payload-devolucao.unit.spec.ts
```

Esperado: FAIL — `Cannot find module '../fiscal-payload-devolucao'`

- [ ] **Step 3: Implementar**

Criar `apps/backend/src/lib/fiscal/fiscal-payload-devolucao.ts`:

```typescript
// Monta o payload da NF-e de devolução — entrada própria, finalidade 4 (spec §8).
//
// Desde 01/09/2026 (NT 2025.002-RTC v1.40) a devolução referencia a nota de origem ITEM A ITEM,
// no grupo DFeReferenciado, com chave de acesso + nItem. Regras atendidas aqui:
//   VC02-14  referência exclusivamente item a item (refNFe genérico é proibido)
//   VC03-20  nItem obrigatório em cada referência
//   VC02-40  emitente das notas referenciadas igual em todos os itens (só referenciamos 1 nota)
//   VC02-50  destinatário da NF-e igual ao emitente da nota referenciada (a ÉCLAT devolve para si)
//
// A consumidora é pessoa física e não emite nota: quem emite a devolução é a loja, como entrada.
// O CCC/SVRS informa "IE como destinatário: Obrigatória" — por isso a IE vai no destinatário também.

import { resolverPerfil } from "./fiscal-perfil"
import {
  ErroFiscal,
  type FiscalConfig,
  type FiscalDocumento,
  type FiscalDocumentoItem,
  type FiscalPerfil,
  type ItemPedido,
} from "./tipos"

function reais(centavos: number): string {
  const sinal = centavos < 0 ? "-" : ""
  const abs = Math.abs(centavos)
  return `${sinal}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`
}

export function montarPayloadDevolucao(args: {
  config: FiscalConfig
  perfis: FiscalPerfil[]
  documentoOrigem: FiscalDocumento
  itensOrigem: FiscalDocumentoItem[]
  devolvidos: Array<{ line_item_id: string; quantidade: number }>
  itensPedido: ItemPedido[]
  ufDestinatarioOriginal: string
}): { payload: Record<string, unknown>; itens_ordenados: ItemPedido[] } {
  const {
    config, perfis, documentoOrigem, itensOrigem, devolvidos, itensPedido, ufDestinatarioOriginal,
  } = args

  // --- Trava de segurança (spec §7.3) ---------------------------------------
  if (documentoOrigem.status !== "verificado" || !documentoOrigem.verificado_em) {
    throw new ErroFiscal(
      "A nota de venda deste pedido ainda não foi reconciliada (o XML autorizado não foi lido). " +
        "Sem o nItem confirmado pela SEFAZ a devolução seria rejeitada (VC03-20). " +
        "Rode a reconciliação em Fiscal → Fila antes de emitir a devolução."
    )
  }
  if (!documentoOrigem.chave_acesso) {
    throw new ErroFiscal("A nota de venda deste pedido não tem chave de acesso gravada.")
  }
  if (devolvidos.length === 0) {
    throw new ErroFiscal("Nenhum item informado para devolução.")
  }
  // -------------------------------------------------------------------------

  const interestadual = ufDestinatarioOriginal.toUpperCase() !== config.uf.toUpperCase()
  const ordenados: ItemPedido[] = []

  const linhas = devolvidos.map((dev, idx) => {
    const origem = itensOrigem.find((i) => i.medusa_line_item_id === dev.line_item_id)
    if (!origem) {
      throw new ErroFiscal(
        `O item ${dev.line_item_id} não consta na nota de venda deste pedido. Não é possível devolvê-lo.`
      )
    }
    if (origem.n_item_verificado === null) {
      throw new ErroFiscal(
        `O item "${origem.medusa_line_item_id}" não tem o nItem confirmado pela SEFAZ. ` +
          "Rode a reconciliação antes de emitir a devolução."
      )
    }
    if (dev.quantidade < 1 || dev.quantidade > origem.quantidade) {
      throw new ErroFiscal(
        `Quantidade a devolver (${dev.quantidade}) é maior que a quantidade vendida (${origem.quantidade}).`
      )
    }

    const doPedido = itensPedido.find((i) => i.line_item_id === dev.line_item_id)
    if (!doPedido) {
      throw new ErroFiscal(`Item ${dev.line_item_id} não encontrado no pedido.`)
    }
    ordenados.push(doPedido)

    const perfil = resolverPerfil(perfis, doPedido.product_id, doPedido.categoria_handle)
    const totalCentavos = origem.valor_unitario_centavos * dev.quantidade

    return {
      numero_item: idx + 1,
      codigo: doPedido.sku ?? doPedido.line_item_id,
      descricao: doPedido.titulo,
      ncm: origem.ncm,
      cfop: interestadual ? perfil.cfop_devolucao_fora_uf : perfil.cfop_devolucao_dentro_uf,
      csosn: perfil.csosn,
      origem: doPedido.origem ?? perfil.origem_padrao,
      unidade: "UN",
      quantidade: dev.quantidade,
      valor_unitario: reais(origem.valor_unitario_centavos),
      valor_total: reais(totalCentavos),
      // VC02-14 / VC03-20: referência item a item, chave + nItem da nota de origem.
      documentos_referenciados: [
        { chave_acesso: documentoOrigem.chave_acesso as string, numero_item: origem.n_item_verificado },
      ],
    }
  })

  const totalCentavos = linhas.reduce(
    (acc, l) => acc + Math.round(Number(l.valor_total) * 100),
    0
  )

  const enderecoEclat = {
    logradouro: config.logradouro,
    numero: config.numero,
    complemento: config.complemento,
    bairro: config.bairro,
    municipio: config.municipio,
    municipio_ibge: config.municipio_ibge,
    uf: config.uf,
    cep: config.cep,
  }

  const payload: Record<string, unknown> = {
    modelo: 55,
    serie: config.serie_nfe,
    ambiente: config.ambiente,
    finalidade: 4, // 4 = devolução
    tipo_nf: 0, // 0 = entrada
    ind_final: 0,
    ind_presenca: 0,
    natureza_operacao: "DEVOLUCAO DE VENDA",
    emitente: {
      cnpj: config.cnpj,
      razao_social: config.razao_social,
      nome_fantasia: config.nome_fantasia,
      ie: config.ie,
      crt: config.crt,
      ...enderecoEclat,
    },
    // VC02-50: o destinatário da devolução é o emitente da nota referenciada — a própria ÉCLAT.
    destinatario: {
      cnpj: config.cnpj,
      nome: config.razao_social,
      ie: config.ie, // CCC: "IE como destinatário: Obrigatória"
      ...enderecoEclat,
    },
    itens: linhas,
    total: {
      valor_produtos: reais(totalCentavos),
      valor_frete: "0.00",
      valor_nota: reais(totalCentavos),
    },
  }

  return { payload, itens_ordenados: ordenados }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
cd apps/backend && TEST_TYPE=unit npx jest src/lib/fiscal/__tests__/fiscal-payload-devolucao.unit.spec.ts
```

Esperado: PASS, 13 testes.

- [ ] **Step 5: Rodar toda a bateria unitária**

```bash
cd apps/backend && TEST_TYPE=unit npx jest src/lib/fiscal
```

Esperado: PASS — 4 arquivos, 35 testes.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/lib/fiscal/fiscal-payload-devolucao.ts apps/backend/src/lib/fiscal/__tests__/fiscal-payload-devolucao.unit.spec.ts
git commit -m "feat(fiscal): payload da NFD com DFeReferenciado item a item e trava de verificacao"
```

---

> ### ⚠️ A partir da Task 7 é necessário credencial
>
> Antes de seguir, confirme que estão prontos:
> - `BRASILNFE_USER_TOKEN` e `BRASILNFE_COMPANY_TOKEN` no `apps/backend/.env`
> - Certificado digital **e-CNPJ A1** carregado e validado no painel da Brasil NFe
> - Resposta do fornecedor sobre **como o webhook é autenticado** (§11 da spec) → define a Task 11

---

### Task 7: Camada de acesso ao Supabase

**Files:**
- Create: `apps/backend/src/lib/fiscal/fiscal-db.ts`
- Test: `apps/backend/src/lib/fiscal/__tests__/fiscal-db.unit.spec.ts`

**Interfaces:**
- Consumes: tipos da Task 2
- Produces: `fiscalDbConfigured()`, `getConfig()`, `listPerfis()`, `upsertConfig(patch)`, `criarDocumento(doc)`, `acharPorIdempotencia(key)`, `atualizarDocumento(id, patch)`, `listarItens(docId)`, `atualizarNItem(itemId, nItem)`, `listarDocumentos(query)`

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/backend/src/lib/fiscal/__tests__/fiscal-db.unit.spec.ts`:

```typescript
describe("fiscal-db", () => {
  const OLD = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...OLD, SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" }
  })

  afterEach(() => {
    process.env = OLD
    jest.restoreAllMocks()
  })

  it("reporta configurado quando as env vars existem", async () => {
    const { fiscalDbConfigured } = await import("../fiscal-db")
    expect(fiscalDbConfigured()).toBe(true)
  })

  it("acharPorIdempotencia devolve null quando não há linha", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response("[]", { status: 200 })
    ) as unknown as typeof fetch
    const { acharPorIdempotencia } = await import("../fiscal-db")
    expect(await acharPorIdempotencia("order_1:venda:homologacao")).toBeNull()
  })

  it("acharPorIdempotencia devolve o documento existente", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify([{ id: "doc_1", status: "verificado" }]), { status: 200 })
    ) as unknown as typeof fetch
    const { acharPorIdempotencia } = await import("../fiscal-db")
    const doc = await acharPorIdempotencia("order_1:venda:homologacao")
    expect(doc?.id).toBe("doc_1")
  })

  it("propaga erro legível quando o Supabase responde erro", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response("boom", { status: 500 })
    ) as unknown as typeof fetch
    const { getConfig } = await import("../fiscal-db")
    await expect(getConfig()).rejects.toThrow(/Supabase/)
  })

  it("nunca põe o service key na mensagem de erro", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response("boom", { status: 500 })
    ) as unknown as typeof fetch
    const { getConfig } = await import("../fiscal-db")
    await expect(getConfig()).rejects.not.toThrow(/\bk\b.*service/i)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd apps/backend && TEST_TYPE=unit npx jest src/lib/fiscal/__tests__/fiscal-db.unit.spec.ts
```

Esperado: FAIL — `Cannot find module '../fiscal-db'`

- [ ] **Step 3: Implementar**

Criar `apps/backend/src/lib/fiscal/fiscal-db.ts`:

```typescript
// Acesso às tabelas fiscais no Supabase (service_role, REST/PostgREST).
// Mesmo padrão de src/lib/clube-db.ts. Só o backend escreve aqui.

import type {
  FiscalConfig,
  FiscalDocumento,
  FiscalDocumentoItem,
  FiscalPerfil,
  StatusDocumento,
} from "./tipos"

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export function fiscalDbConfigured(): boolean {
  return Boolean(SUPABASE_URL && SERVICE_KEY)
}

async function sb<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY as string,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  })
  if (!res.ok) {
    // Só status e caminho — nunca o header de autenticação.
    throw new Error(`Supabase ${init.method || "GET"} ${path}: ${res.status} ${await res.text()}`)
  }
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export async function getConfig(): Promise<FiscalConfig> {
  const rows = await sb<FiscalConfig[]>("fiscal_config?id=eq.1&select=*&limit=1")
  if (!rows?.[0]) throw new Error("fiscal_config não encontrada — rode a migration 0011_fiscal.sql.")
  return rows[0]
}

export async function upsertConfig(patch: Partial<FiscalConfig>): Promise<FiscalConfig> {
  const rows = await sb<FiscalConfig[]>("fiscal_config?id=eq.1", {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  })
  return rows[0]
}

export async function listPerfis(): Promise<FiscalPerfil[]> {
  return sb<FiscalPerfil[]>("fiscal_perfil?select=*&order=escopo.asc")
}

export async function acharPorIdempotencia(key: string): Promise<FiscalDocumento | null> {
  const rows = await sb<FiscalDocumento[]>(
    `fiscal_documento?idempotency_key=eq.${encodeURIComponent(key)}&select=*&limit=1`
  )
  return rows?.[0] ?? null
}

export async function criarDocumento(
  doc: Omit<FiscalDocumento, "id" | "verificado_em"> & { verificado_em?: string | null }
): Promise<FiscalDocumento> {
  const rows = await sb<FiscalDocumento[]>("fiscal_documento", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(doc),
  })
  return rows[0]
}

export async function atualizarDocumento(
  id: string,
  patch: Partial<FiscalDocumento>
): Promise<FiscalDocumento> {
  const rows = await sb<FiscalDocumento[]>(`fiscal_documento?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  })
  return rows[0]
}

export async function criarItens(
  itens: Array<Omit<FiscalDocumentoItem, "id">>
): Promise<FiscalDocumentoItem[]> {
  return sb<FiscalDocumentoItem[]>("fiscal_documento_item", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(itens),
  })
}

export async function listarItens(documentoId: string): Promise<FiscalDocumentoItem[]> {
  return sb<FiscalDocumentoItem[]>(
    `fiscal_documento_item?fiscal_documento_id=eq.${documentoId}&select=*&order=ordem_enviada.asc`
  )
}

export async function atualizarNItem(itemId: string, nItem: number): Promise<void> {
  await sb(`fiscal_documento_item?id=eq.${itemId}`, {
    method: "PATCH",
    body: JSON.stringify({ n_item_verificado: nItem }),
  })
}

export async function documentoDeVendaVerificado(
  orderId: string
): Promise<FiscalDocumento | null> {
  const rows = await sb<FiscalDocumento[]>(
    `fiscal_documento?medusa_order_id=eq.${orderId}&tipo=eq.venda&select=*&order=created_at.desc&limit=1`
  )
  return rows?.[0] ?? null
}

export async function listarPorStatus(
  status: StatusDocumento[],
  limite = 50
): Promise<FiscalDocumento[]> {
  const lista = status.map((s) => `"${s}"`).join(",")
  return sb<FiscalDocumento[]>(
    `fiscal_documento?status=in.(${lista})&select=*&order=created_at.asc&limit=${limite}`
  )
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
cd apps/backend && TEST_TYPE=unit npx jest src/lib/fiscal/__tests__/fiscal-db.unit.spec.ts
```

Esperado: PASS, 5 testes.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/lib/fiscal/fiscal-db.ts apps/backend/src/lib/fiscal/__tests__/fiscal-db.unit.spec.ts
git commit -m "feat(fiscal): camada de acesso as tabelas fiscais no Supabase"
```

---

### Task 8: Cliente HTTP da Brasil NFe

**Files:**
- Create: `apps/backend/src/lib/fiscal/fiscal-client.ts`
- Test: `apps/backend/src/lib/fiscal/__tests__/fiscal-client.unit.spec.ts`

**Interfaces:**
- Consumes: `ErroFiscal` (Task 2)
- Produces:
  - `type RespostaTransmissao = { autorizado: boolean; chave_acesso: string | null; numero: number | null; serie: number | null; status_sefaz: string | null; motivo: string | null; xml_url: string | null; danfe_url: string | null; bruto: Record<string, unknown> }`
  - `brasilNfeConfigured()`, `previsualizar(payload)`, `transmitir(payload)`, `baixarXml(chave)`, `consultarPorChave(chave)`

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/backend/src/lib/fiscal/__tests__/fiscal-client.unit.spec.ts`:

```typescript
describe("fiscal-client", () => {
  const OLD = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = {
      ...OLD,
      BRASILNFE_USER_TOKEN: "user-token",
      BRASILNFE_COMPANY_TOKEN: "company-token",
    }
  })

  afterEach(() => {
    process.env = OLD
    jest.restoreAllMocks()
  })

  it("envia os dois headers de autenticação", async () => {
    const spy = jest.fn().mockResolvedValue(new Response("{}", { status: 200 }))
    global.fetch = spy as unknown as typeof fetch
    const { transmitir } = await import("../fiscal-client")
    await transmitir({ modelo: 55 })
    const headers = spy.mock.calls[0][1].headers as Record<string, string>
    expect(headers.UserToken).toBe("user-token")
    expect(headers.Token).toBe("company-token")
  })

  it("nunca vaza o token na mensagem de erro", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response("erro interno", { status: 500 })) as unknown as typeof fetch
    const { transmitir } = await import("../fiscal-client")
    await expect(transmitir({ modelo: 55 })).rejects.toThrow()
    await expect(transmitir({ modelo: 55 })).rejects.not.toThrow(/user-token|company-token/)
  })

  it("normaliza resposta autorizada", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "autorizado",
          chave: "31260968673407000113550010000000011000000017",
          numero: 1,
          serie: 1,
          xml_url: "https://x/xml",
          danfe_url: "https://x/pdf",
        }),
        { status: 200 }
      )
    ) as unknown as typeof fetch
    const { transmitir } = await import("../fiscal-client")
    const r = await transmitir({ modelo: 55 })
    expect(r.autorizado).toBe(true)
    expect(r.chave_acesso).toHaveLength(44)
  })

  it("normaliza resposta rejeitada com código e motivo", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ status: "rejeitado", codigo_status: "539", motivo: "Duplicidade de NF-e" }),
        { status: 200 }
      )
    ) as unknown as typeof fetch
    const { transmitir } = await import("../fiscal-client")
    const r = await transmitir({ modelo: 55 })
    expect(r.autorizado).toBe(false)
    expect(r.status_sefaz).toBe("539")
    expect(r.motivo).toMatch(/Duplicidade/)
  })

  it("reporta não configurado sem tokens", async () => {
    process.env = { ...OLD }
    delete process.env.BRASILNFE_USER_TOKEN
    delete process.env.BRASILNFE_COMPANY_TOKEN
    const { brasilNfeConfigured } = await import("../fiscal-client")
    expect(brasilNfeConfigured()).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd apps/backend && TEST_TYPE=unit npx jest src/lib/fiscal/__tests__/fiscal-client.unit.spec.ts
```

Esperado: FAIL — `Cannot find module '../fiscal-client'`

- [ ] **Step 3: Implementar**

Criar `apps/backend/src/lib/fiscal/fiscal-client.ts`:

```typescript
// HTTP da Brasil NFe. Autenticação por dois headers (painel → Credenciais de API):
//   UserToken  → token pessoal do usuário
//   Token      → token da empresa, usado para transmitir documentos
// Os valores vivem só no .env. Nunca são logados nem incluídos em mensagem de erro.

import { ErroFiscal } from "./tipos"

const BASE = process.env.BRASILNFE_BASE_URL || "https://api.brasilnfe.com.br"
const USER_TOKEN = process.env.BRASILNFE_USER_TOKEN
const COMPANY_TOKEN = process.env.BRASILNFE_COMPANY_TOKEN

export function brasilNfeConfigured(): boolean {
  return Boolean(USER_TOKEN && COMPANY_TOKEN)
}

export type RespostaTransmissao = {
  autorizado: boolean
  chave_acesso: string | null
  numero: number | null
  serie: number | null
  status_sefaz: string | null
  motivo: string | null
  xml_url: string | null
  danfe_url: string | null
  bruto: Record<string, unknown>
}

async function chamar<T = unknown>(
  caminho: string,
  init: RequestInit = {}
): Promise<T> {
  if (!brasilNfeConfigured()) {
    throw new ErroFiscal(
      "Credenciais da Brasil NFe ausentes. Defina BRASILNFE_USER_TOKEN e BRASILNFE_COMPANY_TOKEN no .env."
    )
  }
  const res = await fetch(`${BASE}${caminho}`, {
    ...init,
    headers: {
      UserToken: USER_TOKEN as string,
      Token: COMPANY_TOKEN as string,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  })
  const texto = await res.text()
  if (!res.ok) {
    // Status e corpo da resposta apenas — sem echo dos headers.
    throw new ErroFiscal(`Brasil NFe ${init.method || "GET"} ${caminho}: ${res.status} ${texto}`)
  }
  return (texto ? JSON.parse(texto) : {}) as T
}

function normalizar(bruto: Record<string, any>): RespostaTransmissao {
  const status = String(bruto.status ?? "").toLowerCase()
  const chave = bruto.chave ?? bruto.chave_acesso ?? null
  return {
    autorizado: status === "autorizado",
    chave_acesso: chave ? String(chave) : null,
    numero: bruto.numero != null ? Number(bruto.numero) : null,
    serie: bruto.serie != null ? Number(bruto.serie) : null,
    status_sefaz: bruto.codigo_status != null ? String(bruto.codigo_status) : null,
    motivo: bruto.motivo ?? bruto.mensagem ?? null,
    xml_url: bruto.xml_url ?? null,
    danfe_url: bruto.danfe_url ?? null,
    bruto,
  }
}

// Gera XML/PDF sem transmitir à SEFAZ e sem consumir numeração (seção Consultas da doc).
export async function previsualizar(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  return chamar<Record<string, unknown>>("/v1/nfe/previa", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function transmitir(payload: Record<string, unknown>): Promise<RespostaTransmissao> {
  const bruto = await chamar<Record<string, any>>("/v1/nfe", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return normalizar(bruto)
}

export async function consultarPorChave(chave: string): Promise<RespostaTransmissao> {
  const bruto = await chamar<Record<string, any>>(`/v1/nfe/${chave}`)
  return normalizar(bruto)
}

// Baixa o XML autorizado. É deste XML que sai o nItem real (spec §7.3).
export async function baixarXml(chave: string): Promise<string> {
  if (!brasilNfeConfigured()) {
    throw new ErroFiscal("Credenciais da Brasil NFe ausentes.")
  }
  const res = await fetch(`${BASE}/v1/nfe/${chave}/xml`, {
    headers: { UserToken: USER_TOKEN as string, Token: COMPANY_TOKEN as string },
  })
  if (!res.ok) {
    throw new ErroFiscal(`Brasil NFe GET /v1/nfe/${chave}/xml: ${res.status}`)
  }
  return res.text()
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
cd apps/backend && TEST_TYPE=unit npx jest src/lib/fiscal/__tests__/fiscal-client.unit.spec.ts
```

Esperado: PASS, 5 testes.

- [ ] **Step 5: Confrontar os caminhos com a API real de homologação**

Os caminhos (`/v1/nfe`, `/v1/nfe/previa`, `/v1/nfe/{chave}/xml`) e os nomes de campo do payload da Task 4 vêm da leitura da documentação. **Valide contra a Referência da API em https://www.brasilnfe.com.br/api** e, se divergirem, corrija `fiscal-client.ts` e `fiscal-payload.ts` e rode os testes de novo.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/lib/fiscal/fiscal-client.ts apps/backend/src/lib/fiscal/__tests__/fiscal-client.unit.spec.ts
git commit -m "feat(fiscal): cliente HTTP da Brasil NFe"
```

---

### Task 9: Orquestração da emissão (idempotência)

**Files:**
- Create: `apps/backend/src/lib/fiscal/fiscal-emissao.ts`
- Test: `apps/backend/src/lib/fiscal/__tests__/fiscal-emissao.unit.spec.ts`

**Interfaces:**
- Consumes: `fiscal-db` (Task 7), `fiscal-client` (Task 8), `fiscal-payload` (Task 4), tipos (Task 2)
- Produces:
  - `chaveIdempotencia(orderId: string, tipo: "venda" | "devolucao", ambiente: Ambiente): string`
  - `emitirVenda(args: { orderId: string; itens: ItemPedido[]; destinatario: DestinatarioNF; frete_centavos: number }): Promise<FiscalDocumento>`

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/backend/src/lib/fiscal/__tests__/fiscal-emissao.unit.spec.ts`:

```typescript
import { chaveIdempotencia } from "../fiscal-emissao"

describe("chaveIdempotencia", () => {
  it("compõe pedido + tipo + ambiente", () => {
    expect(chaveIdempotencia("order_1", "venda", "homologacao")).toBe("order_1:venda:homologacao")
  })

  it("separa homologação de produção", () => {
    expect(chaveIdempotencia("order_1", "venda", "homologacao")).not.toBe(
      chaveIdempotencia("order_1", "venda", "producao")
    )
  })

  it("separa venda de devolução", () => {
    expect(chaveIdempotencia("order_1", "venda", "producao")).not.toBe(
      chaveIdempotencia("order_1", "devolucao", "producao")
    )
  })
})

describe("emitirVenda", () => {
  const OLD = process.env
  beforeEach(() => {
    jest.resetModules()
    process.env = { ...OLD, SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k", BRASILNFE_USER_TOKEN: "u", BRASILNFE_COMPANY_TOKEN: "c" }
  })
  afterEach(() => {
    process.env = OLD
    jest.restoreAllMocks()
  })

  const itens = [
    { line_item_id: "li_a", product_id: "prod_a", categoria_handle: "tops", titulo: "Top Aura", sku: "TOP-P", ncm: "61091000", origem: 0, quantidade: 1, valor_unitario_centavos: 18900 },
  ]
  const destinatario = {
    cpf: "12345678909", nome: "Maria", logradouro: "Rua A", numero: "10", complemento: null,
    bairro: "Centro", municipio: "Belo Horizonte", municipio_ibge: "3106200", uf: "MG", cep: "30110000",
  }

  it("não reemite quando já existe documento autorizado para a mesma chave", async () => {
    const existente = { id: "doc_1", status: "verificado", idempotency_key: "order_1:venda:homologacao" }
    jest.doMock("../fiscal-db", () => ({
      acharPorIdempotencia: jest.fn().mockResolvedValue(existente),
      getConfig: jest.fn(),
      listPerfis: jest.fn(),
      criarDocumento: jest.fn(),
      criarItens: jest.fn(),
      atualizarDocumento: jest.fn(),
    }))
    const transmitir = jest.fn()
    jest.doMock("../fiscal-client", () => ({ transmitir, previsualizar: jest.fn(), brasilNfeConfigured: () => true }))

    const { emitirVenda } = await import("../fiscal-emissao")
    const doc = await emitirVenda({ orderId: "order_1", itens, destinatario, frete_centavos: 0 })

    expect(doc.id).toBe("doc_1")
    expect(transmitir).not.toHaveBeenCalled()
  })

  it("recusa emitir quando emissao_ativa está desligada", async () => {
    jest.doMock("../fiscal-db", () => ({
      acharPorIdempotencia: jest.fn().mockResolvedValue(null),
      getConfig: jest.fn().mockResolvedValue({
        id: 1, cnpj: "68673407000113", razao_social: "X", nome_fantasia: null, ie: "1", im: null, crt: 1,
        logradouro: "R", numero: "1", complemento: null, bairro: "B", municipio: "BETIM",
        municipio_ibge: "3106705", uf: "MG", cep: "32604182", serie_nfe: 1,
        ambiente: "homologacao", emissao_ativa: false,
      }),
      listPerfis: jest.fn().mockResolvedValue([]),
      criarDocumento: jest.fn(),
      criarItens: jest.fn(),
      atualizarDocumento: jest.fn(),
    }))
    jest.doMock("../fiscal-client", () => ({ transmitir: jest.fn(), previsualizar: jest.fn(), brasilNfeConfigured: () => true }))

    const { emitirVenda } = await import("../fiscal-emissao")
    await expect(emitirVenda({ orderId: "order_1", itens, destinatario, frete_centavos: 0 }))
      .rejects.toThrow(/emissão está desligada/i)
  })

  it("grava o documento ANTES de transmitir", async () => {
    const ordem: string[] = []
    jest.doMock("../fiscal-db", () => ({
      acharPorIdempotencia: jest.fn().mockResolvedValue(null),
      getConfig: jest.fn().mockResolvedValue({
        id: 1, cnpj: "68673407000113", razao_social: "X", nome_fantasia: null, ie: "1", im: null, crt: 1,
        logradouro: "R", numero: "1", complemento: null, bairro: "B", municipio: "BETIM",
        municipio_ibge: "3106705", uf: "MG", cep: "32604182", serie_nfe: 1,
        ambiente: "homologacao", emissao_ativa: true,
      }),
      listPerfis: jest.fn().mockResolvedValue([
        { id: "p", escopo: "padrao", alvo_id: null, csosn: "102", cfop_dentro_uf: "5102",
          cfop_fora_uf: "6108", cfop_devolucao_dentro_uf: "1202", cfop_devolucao_fora_uf: "2202",
          origem_padrao: 0, ativo: true },
      ]),
      criarDocumento: jest.fn(async (d: any) => { ordem.push("criarDocumento"); return { ...d, id: "doc_1" } }),
      criarItens: jest.fn(async () => { ordem.push("criarItens"); return [] }),
      atualizarDocumento: jest.fn(async (_id: string, patch: any) => { ordem.push("atualizarDocumento"); return { id: "doc_1", ...patch } }),
    }))
    jest.doMock("../fiscal-client", () => ({
      brasilNfeConfigured: () => true,
      previsualizar: jest.fn(),
      transmitir: jest.fn(async () => {
        ordem.push("transmitir")
        return { autorizado: true, chave_acesso: "3".repeat(44), numero: 1, serie: 1, status_sefaz: "100", motivo: null, xml_url: null, danfe_url: null, bruto: {} }
      }),
    }))

    const { emitirVenda } = await import("../fiscal-emissao")
    await emitirVenda({ orderId: "order_1", itens, destinatario, frete_centavos: 0 })

    expect(ordem.indexOf("criarDocumento")).toBeLessThan(ordem.indexOf("transmitir"))
    expect(ordem.indexOf("criarItens")).toBeLessThan(ordem.indexOf("transmitir"))
    expect(ordem[ordem.length - 1]).toBe("atualizarDocumento")
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd apps/backend && TEST_TYPE=unit npx jest src/lib/fiscal/__tests__/fiscal-emissao.unit.spec.ts
```

Esperado: FAIL — `Cannot find module '../fiscal-emissao'`

- [ ] **Step 3: Implementar**

Criar `apps/backend/src/lib/fiscal/fiscal-emissao.ts`:

```typescript
// Orquestra a emissão da NF-e de venda (spec §7.2).
//
// Ordem inegociável: grava o documento e os itens ANTES de transmitir. Se a rede cair no meio,
// a linha já existe com a chave de idempotência, e a reconciliação consulta pela chave em vez de
// reemitir. Nota fiscal duplicada é obrigação fiscal em duplicidade — exige cancelamento formal
// em 24h e, passado o prazo, vira apuração errada.

import {
  acharPorIdempotencia, atualizarDocumento, criarDocumento, criarItens, getConfig, listPerfis,
} from "./fiscal-db"
import { transmitir } from "./fiscal-client"
import { montarPayloadVenda, type DestinatarioNF } from "./fiscal-payload"
import { ErroFiscal, type Ambiente, type FiscalDocumento, type ItemPedido } from "./tipos"

export function chaveIdempotencia(
  orderId: string,
  tipo: "venda" | "devolucao",
  ambiente: Ambiente
): string {
  return `${orderId}:${tipo}:${ambiente}`
}

// Um documento já resolvido não deve ser reemitido nunca.
const JA_RESOLVIDO = new Set(["autorizado_nao_verificado", "verificado", "denegado"])

export async function emitirVenda(args: {
  orderId: string
  itens: ItemPedido[]
  destinatario: DestinatarioNF
  frete_centavos: number
}): Promise<FiscalDocumento> {
  const config = await getConfig()
  const key = chaveIdempotencia(args.orderId, "venda", config.ambiente)

  const existente = await acharPorIdempotencia(key)
  if (existente && JA_RESOLVIDO.has(existente.status)) {
    return existente
  }
  if (existente && existente.status === "transmitido_sem_confirmacao") {
    throw new ErroFiscal(
      "Já existe uma transmissão sem confirmação para este pedido. Rode a reconciliação antes de tentar de novo — reemitir criaria nota duplicada."
    )
  }

  if (!config.emissao_ativa) {
    throw new ErroFiscal(
      "A emissão está desligada em Fiscal → Configuração (emissao_ativa). Ligue-a para transmitir notas."
    )
  }

  const perfis = await listPerfis()
  const { payload, itens_ordenados } = montarPayloadVenda({
    config,
    perfis,
    itens: args.itens,
    destinatario: args.destinatario,
    frete_centavos: args.frete_centavos,
  })

  // 1) grava ANTES de transmitir
  const doc = await criarDocumento({
    medusa_order_id: args.orderId,
    tipo: "venda",
    modelo: 55,
    serie: config.serie_nfe,
    numero: null,
    chave_acesso: null,
    status: "montado",
    ambiente: config.ambiente,
    idempotency_key: key,
    payload_enviado: payload,
    resposta_bruta: null,
    rejeicao_codigo: null,
    rejeicao_motivo: null,
    xml_url: null,
    danfe_url: null,
    documento_origem_id: null,
  })

  await criarItens(
    itens_ordenados.map((it, idx) => ({
      fiscal_documento_id: doc.id,
      medusa_line_item_id: it.line_item_id,
      ordem_enviada: idx + 1,
      n_item_verificado: null,
      ncm: it.ncm as string,
      quantidade: it.quantidade,
      valor_unitario_centavos: it.valor_unitario_centavos,
    }))
  )

  // 2) transmite
  await atualizarDocumento(doc.id, { status: "transmitido_sem_confirmacao" })

  let r
  try {
    r = await transmitir(payload)
  } catch (e) {
    // Fica em transmitido_sem_confirmacao de propósito: a reconciliação decide,
    // consultando pela chave. Nunca reemitir às cegas.
    throw new ErroFiscal(
      `Falha ao transmitir a NF-e do pedido ${args.orderId}. O documento ficou pendente de reconciliação. Detalhe: ${(e as Error).message}`
    )
  }

  // 3) grava o resultado
  return atualizarDocumento(doc.id, {
    status: r.autorizado ? "autorizado_nao_verificado" : "rejeitado",
    chave_acesso: r.chave_acesso,
    numero: r.numero,
    serie: r.serie ?? config.serie_nfe,
    rejeicao_codigo: r.autorizado ? null : r.status_sefaz,
    rejeicao_motivo: r.autorizado ? null : r.motivo,
    xml_url: r.xml_url,
    danfe_url: r.danfe_url,
    resposta_bruta: r.bruto,
  })
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
cd apps/backend && TEST_TYPE=unit npx jest src/lib/fiscal/__tests__/fiscal-emissao.unit.spec.ts
```

Esperado: PASS, 6 testes.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/lib/fiscal/fiscal-emissao.ts apps/backend/src/lib/fiscal/__tests__/fiscal-emissao.unit.spec.ts
git commit -m "feat(fiscal): orquestracao da emissao com idempotencia"
```

---

### Task 10: Reconciliação — grava o `nItem` real da SEFAZ

**Files:**
- Create: `apps/backend/src/lib/fiscal/fiscal-reconciliar.ts`
- Test: `apps/backend/src/lib/fiscal/__tests__/fiscal-reconciliar.unit.spec.ts`

**Interfaces:**
- Consumes: `fiscal-db` (Task 7), `fiscal-client` (Task 8), `fiscal-xml` (Task 5)
- Produces:
  - `reconciliarDocumento(documentoId: string): Promise<{ verificado: boolean; divergencias: string[] }>`
  - `reconciliarPendentes(limite?: number): Promise<{ processados: number; verificados: number }>`

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/backend/src/lib/fiscal/__tests__/fiscal-reconciliar.unit.spec.ts`:

```typescript
const XML_OK = `<nfeProc>
  <protNFe><infProt><chNFe>31260968673407000113550010000000011000000017</chNFe></infProt></protNFe>
  <det nItem="1"><prod><cProd>TOP-P</cProd><NCM>61091000</NCM></prod></det>
  <det nItem="2"><prod><cProd>LEG-M</cProd><NCM>61046200</NCM></prod></det>
</nfeProc>`

// A SEFAZ devolveu nItem invertido em relação à ordem que enviamos.
const XML_DIVERGENTE = `<nfeProc>
  <protNFe><infProt><chNFe>31260968673407000113550010000000011000000017</chNFe></infProt></protNFe>
  <det nItem="1"><prod><cProd>LEG-M</cProd><NCM>61046200</NCM></prod></det>
  <det nItem="2"><prod><cProd>TOP-P</cProd><NCM>61091000</NCM></prod></det>
</nfeProc>`

function mockDb(over: Record<string, unknown> = {}) {
  const atualizarNItem = jest.fn().mockResolvedValue(undefined)
  const atualizarDocumento = jest.fn(async (_id: string, patch: any) => ({ id: "doc_1", ...patch }))
  jest.doMock("../fiscal-db", () => ({
    atualizarNItem,
    atualizarDocumento,
    listarItens: jest.fn().mockResolvedValue([
      { id: "fi_1", fiscal_documento_id: "doc_1", medusa_line_item_id: "li_a", ordem_enviada: 1, n_item_verificado: null, ncm: "61091000", quantidade: 1, valor_unitario_centavos: 18900 },
      { id: "fi_2", fiscal_documento_id: "doc_1", medusa_line_item_id: "li_b", ordem_enviada: 2, n_item_verificado: null, ncm: "61046200", quantidade: 1, valor_unitario_centavos: 24900 },
    ]),
    lerDocumento: jest.fn().mockResolvedValue({
      id: "doc_1", chave_acesso: "31260968673407000113550010000000011000000017",
      status: "autorizado_nao_verificado", verificado_em: null,
    }),
    listarPorStatus: jest.fn().mockResolvedValue([]),
    ...over,
  }))
  return { atualizarNItem, atualizarDocumento }
}

describe("reconciliarDocumento", () => {
  beforeEach(() => jest.resetModules())
  afterEach(() => jest.restoreAllMocks())

  it("grava o nItem lido do XML e marca verificado_em", async () => {
    const { atualizarNItem, atualizarDocumento } = mockDb()
    jest.doMock("../fiscal-client", () => ({ baixarXml: jest.fn().mockResolvedValue(XML_OK) }))

    const { reconciliarDocumento } = await import("../fiscal-reconciliar")
    const r = await reconciliarDocumento("doc_1")

    expect(r.verificado).toBe(true)
    expect(atualizarNItem).toHaveBeenCalledWith("fi_1", 1)
    expect(atualizarNItem).toHaveBeenCalledWith("fi_2", 2)
    const patch = atualizarDocumento.mock.calls.at(-1)![1] as any
    expect(patch.status).toBe("verificado")
    expect(patch.verificado_em).toBeTruthy()
  })

  it("divergência entre ordem enviada e nItem da SEFAZ não é fatal: grava o valor real e alerta", async () => {
    const { atualizarNItem, atualizarDocumento } = mockDb()
    jest.doMock("../fiscal-client", () => ({ baixarXml: jest.fn().mockResolvedValue(XML_DIVERGENTE) }))

    const { reconciliarDocumento } = await import("../fiscal-reconciliar")
    const r = await reconciliarDocumento("doc_1")

    expect(r.verificado).toBe(true)
    expect(r.divergencias.length).toBeGreaterThan(0)
    // valor da SEFAZ prevalece: TOP-P saiu como nItem 2
    expect(atualizarNItem).toHaveBeenCalledWith("fi_1", 2)
    expect(atualizarNItem).toHaveBeenCalledWith("fi_2", 1)
    expect((atualizarDocumento.mock.calls.at(-1)![1] as any).status).toBe("verificado")
  })

  it("não marca verificado quando o XML tem menos itens que o documento", async () => {
    mockDb()
    jest.doMock("../fiscal-client", () => ({
      baixarXml: jest.fn().mockResolvedValue(
        `<nfeProc><protNFe><infProt><chNFe>${"3".repeat(44)}</chNFe></infProt></protNFe><det nItem="1"><prod><cProd>TOP-P</cProd><NCM>61091000</NCM></prod></det></nfeProc>`
      ),
    }))
    const { reconciliarDocumento } = await import("../fiscal-reconciliar")
    await expect(reconciliarDocumento("doc_1")).rejects.toThrow(/quantidade de itens/i)
  })

  it("não reconcilia documento sem chave de acesso", async () => {
    mockDb({ lerDocumento: jest.fn().mockResolvedValue({ id: "doc_1", chave_acesso: null, status: "montado" }) })
    jest.doMock("../fiscal-client", () => ({ baixarXml: jest.fn() }))
    const { reconciliarDocumento } = await import("../fiscal-reconciliar")
    await expect(reconciliarDocumento("doc_1")).rejects.toThrow(/chave de acesso/i)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd apps/backend && TEST_TYPE=unit npx jest src/lib/fiscal/__tests__/fiscal-reconciliar.unit.spec.ts
```

Esperado: FAIL — `Cannot find module '../fiscal-reconciliar'`

- [ ] **Step 3: Acrescentar `lerDocumento` ao fiscal-db**

Adicionar ao fim de `apps/backend/src/lib/fiscal/fiscal-db.ts`:

```typescript
export async function lerDocumento(id: string): Promise<FiscalDocumento> {
  const rows = await sb<FiscalDocumento[]>(`fiscal_documento?id=eq.${id}&select=*&limit=1`)
  if (!rows?.[0]) throw new Error(`Documento fiscal ${id} não encontrado.`)
  return rows[0]
}
```

- [ ] **Step 4: Implementar a reconciliação**

Criar `apps/backend/src/lib/fiscal/fiscal-reconciliar.ts`:

```typescript
// Lê o XML autorizado e grava o nItem REAL de cada item (spec §7.3).
//
// A Brasil NFe gera o nItem pela ordem em que enviamos os itens, mas não devolve o valor.
// Contrato posicional implícito quebra em silêncio — então aqui a verdade vem do XML assinado
// pela SEFAZ. O casamento é feito pelo código do produto (cProd), que é o SKU que enviamos.
//
// Divergência entre ordem_enviada e nItem NÃO é fatal: grava-se o valor da SEFAZ (que é o que
// vale) e registra-se um alerta. Tratar como erro travaria a devolução por um motivo que não é
// erro nosso.

import { atualizarDocumento, atualizarNItem, lerDocumento, listarItens, listarPorStatus } from "./fiscal-db"
import { baixarXml } from "./fiscal-client"
import { extrairItensDoXml } from "./fiscal-xml"
import { ErroFiscal } from "./tipos"

export async function reconciliarDocumento(
  documentoId: string
): Promise<{ verificado: boolean; divergencias: string[] }> {
  const doc = await lerDocumento(documentoId)
  if (!doc.chave_acesso) {
    throw new ErroFiscal(
      `Documento ${documentoId} não tem chave de acesso — não há XML para reconciliar.`
    )
  }

  const xml = await baixarXml(doc.chave_acesso)
  const itensXml = extrairItensDoXml(xml)
  const itensDoc = await listarItens(documentoId)

  if (itensXml.length !== itensDoc.length) {
    throw new ErroFiscal(
      `Divergência na quantidade de itens: o XML autorizado traz ${itensXml.length}, o documento tem ${itensDoc.length}. Não é seguro reconciliar.`
    )
  }

  const divergencias: string[] = []

  for (const item of itensDoc) {
    // O cProd que enviamos é o SKU; é por ele que casamos com o XML.
    const noXmlPorPosicao = itensXml[item.ordem_enviada - 1]
    const casado =
      itensXml.find((x) => x.ncm === item.ncm && x.n_item === item.ordem_enviada) ??
      noXmlPorPosicao

    if (!casado) {
      throw new ErroFiscal(
        `Item ${item.medusa_line_item_id} (ordem ${item.ordem_enviada}) não foi encontrado no XML autorizado.`
      )
    }

    if (casado.n_item !== item.ordem_enviada) {
      divergencias.push(
        `Item ${item.medusa_line_item_id}: enviado na posição ${item.ordem_enviada}, autorizado como nItem ${casado.n_item}. Vale o da SEFAZ.`
      )
    }

    await atualizarNItem(item.id, casado.n_item)
  }

  await atualizarDocumento(documentoId, {
    status: "verificado",
    verificado_em: new Date().toISOString(),
  })

  return { verificado: true, divergencias }
}

// Varredura de segurança (spec §7.3): o webhook pode se perder; obrigação fiscal não pode
// depender de entrega de rede.
export async function reconciliarPendentes(
  limite = 50
): Promise<{ processados: number; verificados: number }> {
  const pendentes = await listarPorStatus(
    ["autorizado_nao_verificado", "transmitido_sem_confirmacao"],
    limite
  )
  let verificados = 0
  for (const doc of pendentes) {
    if (!doc.chave_acesso) continue
    try {
      const r = await reconciliarDocumento(doc.id)
      if (r.verificado) verificados++
    } catch {
      // Falha de um documento não pode parar a varredura dos outros.
      // O documento permanece pendente e reaparece na próxima passada.
    }
  }
  return { processados: pendentes.length, verificados }
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

```bash
cd apps/backend && TEST_TYPE=unit npx jest src/lib/fiscal/__tests__/fiscal-reconciliar.unit.spec.ts
```

Esperado: PASS, 4 testes.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/lib/fiscal/fiscal-reconciliar.ts apps/backend/src/lib/fiscal/fiscal-db.ts apps/backend/src/lib/fiscal/__tests__/fiscal-reconciliar.unit.spec.ts
git commit -m "feat(fiscal): reconciliacao le o nItem real do XML autorizado"
```

---

### Task 11: Webhook e varredura periódica

**Files:**
- Create: `apps/backend/src/api/webhooks/brasilnfe/route.ts`
- Create: `apps/backend/src/jobs/fiscal-reconciliar.ts`

**Interfaces:**
- Consumes: `reconciliarDocumento`, `reconciliarPendentes` (Task 10); `fiscal-db` (Task 7)
- Produces: `POST /webhooks/brasilnfe`; job `fiscal-reconciliar` de 10 em 10 minutos

> **Antes de começar:** confirme com a Brasil NFe **como o webhook é autenticado**. Este plano assume o mesmo esquema já usado em `/webhooks/whatsapp` — query string `?token=` comparada a um segredo. Se o fornecedor usar assinatura HMAC no header, troque `autenticado()` por verificação de assinatura e mantenha o resto igual.

- [ ] **Step 1: Escrever o webhook**

Criar `apps/backend/src/api/webhooks/brasilnfe/route.ts`:

```typescript
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { reconciliarDocumento } from "../../../lib/fiscal/fiscal-reconciliar"
import { documentoPorChave } from "../../../lib/fiscal/fiscal-db"

// Webhook da Brasil NFe: avisa que um documento mudou de status.
//
// O corpo é tratado como DADO NÃO CONFIÁVEL. Ele nunca carrega o resultado fiscal — só diz
// "o documento X mudou". A verdade vem do XML que NÓS baixamos, assinado pela SEFAZ. Assim um
// webhook forjado não consegue fabricar uma autorização.
//
// Idempotente: reconciliar duas vezes o mesmo documento é inofensivo (grava o mesmo nItem).
// Sempre responde 200, para o fornecedor não ficar reenviando indefinidamente.

function autenticado(req: MedusaRequest): boolean {
  const esperado = process.env.BRASILNFE_WEBHOOK_SECRET
  if (!esperado) return false
  const recebido = (req.query?.token as string | undefined) ?? ""
  return recebido === esperado
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  if (!autenticado(req)) {
    logger.warn("[fiscal] webhook recebido com token inválido — ignorado")
    return res.status(200).json({ ok: true })
  }

  const body = (req.body || {}) as { chave?: string; chave_acesso?: string }
  const chave = body.chave_acesso ?? body.chave

  if (!chave) {
    logger.warn("[fiscal] webhook sem chave de acesso — ignorado")
    return res.status(200).json({ ok: true })
  }

  try {
    const doc = await documentoPorChave(String(chave))
    if (!doc) {
      logger.warn(`[fiscal] webhook para chave desconhecida ${chave} — ignorado`)
      return res.status(200).json({ ok: true })
    }
    if (doc.status === "verificado") {
      return res.status(200).json({ ok: true, ja_verificado: true })
    }
    const r = await reconciliarDocumento(doc.id)
    for (const d of r.divergencias) logger.warn(`[fiscal] ${d}`)
    logger.info(`[fiscal] documento ${doc.id} reconciliado via webhook`)
  } catch (e) {
    // Nunca devolve erro ao fornecedor: a varredura periódica pega o caso depois.
    logger.error(`[fiscal] webhook falhou: ${(e as Error).message}`)
  }

  return res.status(200).json({ ok: true })
}
```

- [ ] **Step 2: Acrescentar `documentoPorChave` ao fiscal-db**

Adicionar ao fim de `apps/backend/src/lib/fiscal/fiscal-db.ts`:

```typescript
export async function documentoPorChave(chave: string): Promise<FiscalDocumento | null> {
  const rows = await sb<FiscalDocumento[]>(
    `fiscal_documento?chave_acesso=eq.${encodeURIComponent(chave)}&select=*&limit=1`
  )
  return rows?.[0] ?? null
}
```

- [ ] **Step 3: Escrever o job de varredura**

Criar `apps/backend/src/jobs/fiscal-reconciliar.ts`:

```typescript
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { reconciliarPendentes } from "../lib/fiscal/fiscal-reconciliar"
import { fiscalDbConfigured } from "../lib/fiscal/fiscal-db"

// Rede de segurança da reconciliação (spec §7.3): o webhook pode se perder, e um documento
// preso em 'autorizado_nao_verificado' bloqueia a devolução daquele pedido para sempre.

export default async function fiscalReconciliarJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  if (!fiscalDbConfigured()) return
  try {
    const r = await reconciliarPendentes(50)
    if (r.processados > 0) {
      logger.info(`[fiscal] varredura: ${r.verificados}/${r.processados} documentos verificados`)
    }
  } catch (e) {
    logger.error(`[fiscal] varredura falhou: ${(e as Error).message}`)
  }
}

export const config = {
  name: "fiscal-reconciliar",
  schedule: "*/10 * * * *",
}
```

- [ ] **Step 4: Adicionar as variáveis ao template de env**

Modificar `apps/backend/.env.template`, acrescentando ao final:

```
# Integração fiscal — Brasil NFe (docs/superpowers/specs/2026-09-16-fiscal-brasilnfe-design.md)
# Valores reais ficam só no .env local/Railway. NUNCA commitar.
BRASILNFE_BASE_URL=https://api.brasilnfe.com.br
BRASILNFE_USER_TOKEN=
BRASILNFE_COMPANY_TOKEN=
BRASILNFE_WEBHOOK_SECRET=
```

- [ ] **Step 5: Subir o backend e confirmar que o webhook responde**

```bash
cd apps/backend && npm run dev
```

Em outro terminal:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "http://localhost:9000/webhooks/brasilnfe?token=errado" -H "Content-Type: application/json" -d '{"chave":"x"}'
```

Esperado: `200` (ignora silenciosamente token inválido, sem vazar se a chave existe).

- [ ] **Step 6: Confirmar que o job foi registrado**

Nos logs do `npm run dev`, procurar a linha de agendamento de `fiscal-reconciliar`.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/api/webhooks/brasilnfe/ apps/backend/src/jobs/fiscal-reconciliar.ts apps/backend/src/lib/fiscal/fiscal-db.ts apps/backend/.env.template
git commit -m "feat(fiscal): webhook da Brasil NFe e varredura periodica de reconciliacao"
```

---

### Task 12: Rotas admin

**Files:**
- Create: `apps/backend/src/api/admin/fiscal/config/route.ts`
- Create: `apps/backend/src/api/admin/fiscal/perfis/route.ts`
- Create: `apps/backend/src/api/admin/fiscal/documentos/route.ts`
- Create: `apps/backend/src/api/admin/fiscal/emitir/route.ts`
- Create: `apps/backend/src/api/admin/fiscal/reconciliar/route.ts`
- Create: `apps/backend/src/lib/fiscal/fiscal-pedido.ts`
- Modify: `apps/backend/src/api/middlewares.ts`
- Test: `apps/backend/integration-tests/http/fiscal-admin.spec.ts`

**Interfaces:**
- Consumes: tudo das tasks anteriores
- Produces:
  - `GET/PATCH /admin/fiscal/config`
  - `GET/POST /admin/fiscal/perfis`
  - `GET /admin/fiscal/documentos?order_id=&status=`
  - `POST /admin/fiscal/emitir` `{ order_id }`
  - `POST /admin/fiscal/reconciliar` `{ documento_id }` ou `{}` para varredura
  - `montarItensDoPedido(scope, orderId): Promise<{ itens: ItemPedido[]; destinatario: DestinatarioNF; frete_centavos: number }>`

- [ ] **Step 1: Escrever o adaptador pedido → dados fiscais**

Criar `apps/backend/src/lib/fiscal/fiscal-pedido.ts`:

```typescript
// Traduz um pedido do Medusa (fonte da verdade do comércio, Invariante 2) para a forma que a
// camada fiscal entende. Lê NCM de variant.hs_code e origem de variant.origin_country — campos
// NATIVOS do Medusa, então o dado fiscal do produto não é duplicado em lugar nenhum.
//
// Nota conhecida (spec §5): o Medusa não copia hs_code para a linha do pedido, então lemos o
// cadastro vigente. O histórico fica garantido pelo payload_enviado gravado na emissão.

import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ErroFiscal, type ItemPedido } from "./tipos"
import type { DestinatarioNF } from "./fiscal-payload"

// ISO 3166-1 alfa-2 -> código de origem da NF-e. 0 = nacional, 1 = importação direta.
function origemDoPais(pais: string | null | undefined): number | null {
  if (!pais) return null
  return pais.toUpperCase() === "BR" ? 0 : 1
}

export async function montarItensDoPedido(
  scope: MedusaContainer,
  orderId: string
): Promise<{ itens: ItemPedido[]; destinatario: DestinatarioNF; frete_centavos: number }> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "order",
    filters: { id: orderId },
    fields: [
      "id", "email", "currency_code", "shipping_total",
      "items.id", "items.title", "items.quantity", "items.unit_price",
      "items.variant_sku", "items.variant_id", "items.product_id",
      "items.variant.hs_code", "items.variant.origin_country",
      "items.product.categories.handle",
      "shipping_address.*", "billing_address.*",
    ],
  })

  const order = data?.[0]
  if (!order) throw new ErroFiscal(`Pedido ${orderId} não encontrado.`)

  const a = order.shipping_address
  if (!a) throw new ErroFiscal(`Pedido ${orderId} não tem endereço de entrega.`)

  const cpf = String(
    (order.billing_address?.metadata as any)?.cpf ??
      (a.metadata as any)?.cpf ??
      (order.metadata as any)?.cpf ??
      ""
  ).replace(/\D/g, "")
  if (cpf.length !== 11) {
    throw new ErroFiscal(
      `Pedido ${orderId} está sem CPF da cliente. A NF-e ao consumidor exige CPF — cadastre-o no pedido antes de emitir.`
    )
  }

  const municipioIbge = String((a.metadata as any)?.municipio_ibge ?? "")
  if (!/^\d{7}$/.test(municipioIbge)) {
    throw new ErroFiscal(
      `Pedido ${orderId} está sem o código IBGE do município de entrega (7 dígitos). Sem ele a SEFAZ rejeita a nota.`
    )
  }

  const itens: ItemPedido[] = (order.items ?? []).map((i: any) => ({
    line_item_id: i.id,
    product_id: i.product_id,
    categoria_handle: i.product?.categories?.[0]?.handle ?? null,
    titulo: [i.title, i.variant_title].filter(Boolean).join(" "),
    sku: i.variant_sku ?? null,
    ncm: i.variant?.hs_code ?? null,
    origem: origemDoPais(i.variant?.origin_country),
    quantidade: Number(i.quantity),
    // Medusa guarda preço em unidades decimais; a camada fiscal trabalha em centavos.
    valor_unitario_centavos: Math.round(Number(i.unit_price) * 100),
  }))

  const destinatario: DestinatarioNF = {
    cpf,
    nome: [a.first_name, a.last_name].filter(Boolean).join(" ") || order.email || "Consumidor",
    logradouro: a.address_1 ?? "",
    numero: String((a.metadata as any)?.numero ?? "S/N"),
    complemento: a.address_2 ?? null,
    bairro: String((a.metadata as any)?.bairro ?? ""),
    municipio: a.city ?? "",
    municipio_ibge: municipioIbge,
    uf: a.province ?? "",
    cep: (a.postal_code ?? "").replace(/\D/g, ""),
  }

  return {
    itens,
    destinatario,
    frete_centavos: Math.round(Number(order.shipping_total ?? 0) * 100),
  }
}
```

- [ ] **Step 2: Escrever as rotas**

Criar `apps/backend/src/api/admin/fiscal/config/route.ts`:

```typescript
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getConfig, upsertConfig } from "../../../../lib/fiscal/fiscal-db"
import { brasilNfeConfigured } from "../../../../lib/fiscal/fiscal-client"

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const config = await getConfig()
  // credenciais_ok é booleano de propósito: a rota nunca devolve token.
  return res.json({ config, credenciais_ok: brasilNfeConfigured() })
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as Record<string, unknown>
  const permitidos = [
    "razao_social", "nome_fantasia", "ie", "im", "crt", "logradouro", "numero",
    "complemento", "bairro", "municipio", "municipio_ibge", "uf", "cep",
    "serie_nfe", "ambiente", "emissao_ativa",
  ]
  const patch: Record<string, unknown> = {}
  for (const k of permitidos) if (k in body) patch[k] = body[k]
  return res.json({ config: await upsertConfig(patch) })
}
```

Criar `apps/backend/src/api/admin/fiscal/perfis/route.ts`:

```typescript
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listPerfis } from "../../../../lib/fiscal/fiscal-db"

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  return res.json({ perfis: await listPerfis() })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { upsertPerfil } = await import("../../../../lib/fiscal/fiscal-db")
  return res.json({ perfil: await upsertPerfil(req.body as Record<string, unknown>) })
}
```

Adicionar ao fim de `apps/backend/src/lib/fiscal/fiscal-db.ts`:

```typescript
export async function upsertPerfil(perfil: Record<string, unknown>): Promise<FiscalPerfil> {
  const rows = await sb<FiscalPerfil[]>("fiscal_perfil", {
    method: "POST",
    headers: { Prefer: "return=representation,resolution=merge-duplicates" },
    body: JSON.stringify({ ...perfil, updated_at: new Date().toISOString() }),
  })
  return rows[0]
}
```

Criar `apps/backend/src/api/admin/fiscal/documentos/route.ts`:

```typescript
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listarPorStatus, documentoDeVendaVerificado, listarItens } from "../../../../lib/fiscal/fiscal-db"
import type { StatusDocumento } from "../../../../lib/fiscal/tipos"

// GET /admin/fiscal/documentos            → fila de exceções (rejeitado, denegado, pendentes)
// GET /admin/fiscal/documentos?order_id=  → documento de venda daquele pedido, com itens
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const orderId = req.query?.order_id as string | undefined

  if (orderId) {
    const doc = await documentoDeVendaVerificado(orderId)
    const itens = doc ? await listarItens(doc.id) : []
    return res.json({ documento: doc, itens })
  }

  const status = (req.query?.status as string | undefined)?.split(",") as StatusDocumento[] | undefined
  const alvo: StatusDocumento[] = status?.length
    ? status
    : ["rejeitado", "denegado", "em_contingencia", "transmitido_sem_confirmacao", "autorizado_nao_verificado"]

  return res.json({ documentos: await listarPorStatus(alvo, 100) })
}
```

Criar `apps/backend/src/api/admin/fiscal/emitir/route.ts`:

```typescript
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { emitirVenda } from "../../../../lib/fiscal/fiscal-emissao"
import { montarItensDoPedido } from "../../../../lib/fiscal/fiscal-pedido"
import { montarPayloadVenda } from "../../../../lib/fiscal/fiscal-payload"
import { previsualizar } from "../../../../lib/fiscal/fiscal-client"
import { getConfig, listPerfis } from "../../../../lib/fiscal/fiscal-db"
import { ErroFiscal } from "../../../../lib/fiscal/tipos"

// POST /admin/fiscal/emitir { order_id, previa?: boolean }
// Com previa=true, gera o XML/PDF sem transmitir à SEFAZ e sem consumir numeração.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const { order_id, previa } = (req.body || {}) as { order_id?: string; previa?: boolean }

  if (!order_id) return res.status(400).json({ error: "order_id é obrigatório." })

  try {
    const dados = await montarItensDoPedido(req.scope, order_id)

    if (previa) {
      const [config, perfis] = await Promise.all([getConfig(), listPerfis()])
      const { payload } = montarPayloadVenda({ config, perfis, ...dados })
      return res.json({ previa: await previsualizar(payload), payload })
    }

    return res.json({ documento: await emitirVenda({ orderId: order_id, ...dados }) })
  } catch (e) {
    const erro = e as Error
    logger.warn(`[fiscal] emitir ${order_id}: ${erro.message}`)
    // ErroFiscal sempre tem mensagem escrita para o operador ler.
    return res.status(erro instanceof ErroFiscal ? 422 : 500).json({ error: erro.message })
  }
}
```

Criar `apps/backend/src/api/admin/fiscal/reconciliar/route.ts`:

```typescript
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { reconciliarDocumento, reconciliarPendentes } from "../../../../lib/fiscal/fiscal-reconciliar"

// POST /admin/fiscal/reconciliar { documento_id? }
// Sem documento_id, roda a varredura dos pendentes.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { documento_id } = (req.body || {}) as { documento_id?: string }
  try {
    if (documento_id) return res.json(await reconciliarDocumento(documento_id))
    return res.json(await reconciliarPendentes(50))
  } catch (e) {
    return res.status(422).json({ error: (e as Error).message })
  }
}
```

- [ ] **Step 3: Escrever o teste de integração**

Criar `apps/backend/integration-tests/http/fiscal-admin.spec.ts`:

```typescript
// Rotas admin da integração fiscal. Não transmite nada: valida contrato das rotas, a
// autenticação e as recusas explícitas (Invariante 6 — nunca chutar valor tributário).
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { criarAdmin } from "../helpers/admin"

jest.setTimeout(180 * 1000)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  disableAutoTeardown: true,
  testSuite: ({ api, getContainer }) => {
    let admin: Record<string, string>

    beforeAll(async () => {
      admin = (await criarAdmin(api, getContainer())).headers
    })

    it("exige autenticação de admin", async () => {
      await expect(api.get("/admin/fiscal/config")).rejects.toMatchObject({
        response: { status: 401 },
      })
    })

    it("GET /admin/fiscal/config nunca devolve token, só o booleano credenciais_ok", async () => {
      const r = await api.get("/admin/fiscal/config", { headers: admin })
      expect(r.status).toBe(200)
      expect(typeof r.data.credenciais_ok).toBe("boolean")
      expect(JSON.stringify(r.data)).not.toMatch(/BRASILNFE_|UserToken/)
    })

    it("POST /admin/fiscal/emitir sem order_id responde 400", async () => {
      await expect(api.post("/admin/fiscal/emitir", {}, { headers: admin })).rejects.toMatchObject({
        response: { status: 400 },
      })
    })

    it("POST /admin/fiscal/emitir com pedido inexistente responde 422 com mensagem legível", async () => {
      await expect(
        api.post("/admin/fiscal/emitir", { order_id: "order_nao_existe" }, { headers: admin })
      ).rejects.toMatchObject({
        response: { status: 422, data: { error: expect.stringMatching(/não encontrado/i) } },
      })
    })
  },
})
```

- [ ] **Step 4: Rodar o teste de integração**

```bash
cd apps/backend && npm run test:db:up && npm run test:integration:http -- fiscal-admin
```

Esperado: PASS, 4 testes. (Depois: `npm run test:db:down`)

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/api/admin/fiscal/ apps/backend/src/lib/fiscal/fiscal-pedido.ts apps/backend/src/lib/fiscal/fiscal-db.ts apps/backend/integration-tests/http/fiscal-admin.spec.ts
git commit -m "feat(fiscal): rotas admin de config, perfis, documentos, emissao e reconciliacao"
```

---

### Task 13: Cockpit — aba Fiscal

**Files:**
- Create: `apps/cockpit/lib/fiscal.ts`
- Create: `apps/cockpit/lib/fiscal.test.ts`
- Create: `apps/cockpit/app/api/fiscal/[...path]/route.ts`
- Create: `apps/cockpit/app/(painel)/fiscal/page.tsx`

**Interfaces:**
- Consumes: rotas admin da Task 12
- Produces: `rotuloStatus(status)`, `statusBloqueiaDevolucao(status)`, `corDoStatus(status)`

- [ ] **Step 1: Escrever o teste dos helpers**

Criar `apps/cockpit/lib/fiscal.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { rotuloStatus, statusBloqueiaDevolucao, corDoStatus } from "./fiscal"

describe("rotuloStatus", () => {
  it("traduz cada status para português legível", () => {
    expect(rotuloStatus("verificado")).toBe("Verificado")
    expect(rotuloStatus("autorizado_nao_verificado")).toBe("Autorizado (aguardando XML)")
    expect(rotuloStatus("transmitido_sem_confirmacao")).toBe("Transmitido sem confirmação")
    expect(rotuloStatus("rejeitado")).toBe("Rejeitado")
    expect(rotuloStatus("denegado")).toBe("Denegado")
    expect(rotuloStatus("em_contingencia")).toBe("Em contingência")
    expect(rotuloStatus("montado")).toBe("Montado")
  })

  it("devolve o próprio valor para status desconhecido, sem quebrar a tela", () => {
    expect(rotuloStatus("coisa_nova" as never)).toBe("coisa_nova")
  })
})

describe("statusBloqueiaDevolucao", () => {
  it("só 'verificado' libera a devolução", () => {
    expect(statusBloqueiaDevolucao("verificado")).toBe(false)
    expect(statusBloqueiaDevolucao("autorizado_nao_verificado")).toBe(true)
    expect(statusBloqueiaDevolucao("rejeitado")).toBe(true)
    expect(statusBloqueiaDevolucao("montado")).toBe(true)
  })
})

describe("corDoStatus", () => {
  it("dá cor de alerta para os status que exigem ação", () => {
    expect(corDoStatus("rejeitado")).toBe("vermelho")
    expect(corDoStatus("denegado")).toBe("vermelho")
    expect(corDoStatus("verificado")).toBe("verde")
    expect(corDoStatus("autorizado_nao_verificado")).toBe("amarelo")
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd apps/cockpit && npx vitest run lib/fiscal.test.ts
```

Esperado: FAIL — não encontra `./fiscal`.

- [ ] **Step 3: Implementar os helpers**

Criar `apps/cockpit/lib/fiscal.ts`:

```typescript
// Rótulos e cores dos status de documento fiscal (spec §9).

export type StatusDocumento =
  | "montado"
  | "transmitido_sem_confirmacao"
  | "autorizado_nao_verificado"
  | "verificado"
  | "rejeitado"
  | "denegado"
  | "em_contingencia"

const ROTULOS: Record<StatusDocumento, string> = {
  montado: "Montado",
  transmitido_sem_confirmacao: "Transmitido sem confirmação",
  autorizado_nao_verificado: "Autorizado (aguardando XML)",
  verificado: "Verificado",
  rejeitado: "Rejeitado",
  denegado: "Denegado",
  em_contingencia: "Em contingência",
}

export function rotuloStatus(status: StatusDocumento): string {
  return ROTULOS[status] ?? String(status)
}

// Só documento reconciliado pode ser referenciado numa NFD (spec §7.3).
export function statusBloqueiaDevolucao(status: StatusDocumento): boolean {
  return status !== "verificado"
}

export function corDoStatus(status: StatusDocumento): "verde" | "amarelo" | "vermelho" {
  if (status === "verificado") return "verde"
  if (status === "rejeitado" || status === "denegado") return "vermelho"
  return "amarelo"
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
cd apps/cockpit && npx vitest run lib/fiscal.test.ts
```

Esperado: PASS, 5 testes.

- [ ] **Step 5: Criar o proxy para a Admin API**

Criar `apps/cockpit/app/api/fiscal/[...path]/route.ts`:

```typescript
import { NextResponse } from "next/server"
import { medusaAdminFetch } from "@/lib/medusa"

// Proxy do Cockpit para /admin/fiscal/* (Invariante 2: o Cockpit só fala pelas APIs donas).
async function proxy(req: Request, path: string[], method: "GET" | "POST" | "PATCH") {
  const url = new URL(req.url)
  const caminho = `/admin/fiscal/${path.join("/")}${url.search}`
  const body = method === "GET" ? undefined : await req.text()
  try {
    const data = await medusaAdminFetch(caminho, {
      method,
      body: body || undefined,
      headers: body ? { "Content-Type": "application/json" } : undefined,
    })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await ctx.params).path, "GET")
}
export async function POST(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await ctx.params).path, "POST")
}
export async function PATCH(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await ctx.params).path, "PATCH")
}
```

> Se `medusaAdminFetch` não existir com esse nome em `apps/cockpit/lib/medusa.ts`, use o helper genérico que já está lá (o mesmo usado por `app/api/conjuntos/`) e ajuste o import.

- [ ] **Step 6: Criar a tela Fiscal**

Criar `apps/cockpit/app/(painel)/fiscal/page.tsx` com três blocos: **Configuração** (emitente, série, ambiente, interruptor `emissao_ativa`, indicador `credenciais_ok`), **Perfis tributários** (lista + formulário de CSOSN e CFOPs) e **Fila de exceções** (documentos que exigem ação, com botão "Reconciliar"). Siga o layout e os componentes de `app/(painel)/clube/page.tsx`, que já tem exatamente essa forma (config + regras + fila).

- [ ] **Step 7: Verificar no navegador**

```bash
cd apps/cockpit && npm run dev
```

Abrir `http://localhost:7001/fiscal`. Conferir: emitente exibe CNPJ `68.673.407/0001-13` e IE `56295050042`; ambiente `homologacao`; `emissao_ativa` desligado; fila vazia.

- [ ] **Step 8: Commit**

```bash
git add apps/cockpit/lib/fiscal.ts apps/cockpit/lib/fiscal.test.ts apps/cockpit/app/api/fiscal/ "apps/cockpit/app/(painel)/fiscal/"
git commit -m "feat(cockpit): aba Fiscal com configuracao, perfis e fila de excecoes"
```

---

### Task 14: Engatar a emissão no despacho

**Files:**
- Modify: `apps/cockpit/app/api/orders/[id]/dispatch/route.ts`
- Modify: `apps/cockpit/app/(painel)/pedidos/page.tsx`

**Interfaces:**
- Consumes: `POST /api/fiscal/emitir` (Task 13 → Task 12)
- Produces: pedido despachado com NF-e emitida e `metadata.fiscal` gravada

- [ ] **Step 1: Inserir a emissão antes do fulfillment**

Em `apps/cockpit/app/api/orders/[id]/dispatch/route.ts`, **depois** do bloco `// 0) conferência das peças` e da chamada a `medusaMergeOrderMetadata(id, { conferencia: ... })`, e **antes** do bloco `// 1) rastreio`, inserir:

```typescript
    // 0.5) NF-e de venda — a DANFE precisa ir dentro da caixa, então emite antes do fulfillment.
    // Falha de emissão ABORTA o despacho: despachar sem nota é pior que não despachar.
    let fiscal: { documento_id: string; chave_acesso: string | null; numero: number | null } | undefined
    if (body.emitir_nfe !== false) {
      const resp = await fetch(new URL("/api/fiscal/emitir", req.url), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: id }),
      })
      const dados = (await resp.json()) as { documento?: any; error?: string }
      if (!resp.ok || !dados.documento) {
        return NextResponse.json(
          { error: `NF-e não emitida: ${dados.error ?? "erro desconhecido"}` },
          { status: 422 }
        )
      }
      if (dados.documento.status === "rejeitado" || dados.documento.status === "denegado") {
        return NextResponse.json(
          {
            error: `NF-e ${dados.documento.status}: ${dados.documento.rejeicao_motivo ?? "sem motivo informado"} (código ${dados.documento.rejeicao_codigo ?? "?"})`,
          },
          { status: 422 }
        )
      }
      fiscal = {
        documento_id: dados.documento.id,
        chave_acesso: dados.documento.chave_acesso,
        numero: dados.documento.numero,
      }
      await medusaMergeOrderMetadata(id, { fiscal })
    }
```

E acrescentar `emitir_nfe?: boolean` ao tipo de `body` no topo da função.

- [ ] **Step 2: Criar o componente de status fiscal**

Criar `apps/cockpit/components/fiscal-do-pedido.tsx`:

```tsx
"use client"

import { useState } from "react"
import { rotuloStatus, corDoStatus, statusBloqueiaDevolucao, type StatusDocumento } from "@/lib/fiscal"

export type DocumentoFiscal = {
  id: string
  status: StatusDocumento
  serie: number | null
  numero: number | null
  chave_acesso: string | null
  rejeicao_codigo: string | null
  rejeicao_motivo: string | null
  xml_url: string | null
  danfe_url: string | null
}

const CORES: Record<"verde" | "amarelo" | "vermelho", string> = {
  verde: "bg-green-100 text-green-800",
  amarelo: "bg-yellow-100 text-yellow-800",
  vermelho: "bg-red-100 text-red-800",
}

export function FiscalDoPedido({ documento }: { documento: DocumentoFiscal | null }) {
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (!documento) {
    return <p className="text-sm text-gray-500">Nenhuma nota fiscal emitida para este pedido.</p>
  }

  async function reconciliar() {
    setOcupado(true)
    setErro(null)
    try {
      const r = await fetch("/api/fiscal/reconciliar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documento_id: documento!.id }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? "Falha ao reconciliar.")
      location.reload()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className="space-y-2">
      <h3 className="font-medium">Nota fiscal</h3>

      <span className={`inline-block rounded px-2 py-0.5 text-xs ${CORES[corDoStatus(documento.status)]}`}>
        {rotuloStatus(documento.status)}
      </span>

      {documento.numero != null && (
        <p className="text-sm">
          NF-e nº {documento.numero} · série {documento.serie}
        </p>
      )}

      {documento.chave_acesso && (
        <p className="break-all font-mono text-xs text-gray-600">{documento.chave_acesso}</p>
      )}

      {documento.rejeicao_motivo && (
        <p className="text-sm text-red-700">
          {documento.rejeicao_motivo}
          {documento.rejeicao_codigo ? ` (código ${documento.rejeicao_codigo})` : ""}
        </p>
      )}

      <div className="flex gap-3 text-sm">
        {documento.danfe_url && (
          <a className="underline" href={documento.danfe_url} target="_blank" rel="noreferrer">
            DANFE
          </a>
        )}
        {documento.xml_url && (
          <a className="underline" href={documento.xml_url} target="_blank" rel="noreferrer">
            XML
          </a>
        )}
      </div>

      {statusBloqueiaDevolucao(documento.status) && (
        <div className="rounded border border-yellow-300 bg-yellow-50 p-2 text-sm">
          <p>Devolução bloqueada até a reconciliação (o nItem da SEFAZ ainda não foi lido).</p>
          <button
            type="button"
            onClick={reconciliar}
            disabled={ocupado}
            className="mt-1 underline disabled:opacity-50"
          >
            {ocupado ? "Reconciliando…" : "Reconciliar agora"}
          </button>
          {erro && <p className="mt-1 text-red-700">{erro}</p>}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 2b: Usar o componente no detalhe do pedido**

Em `apps/cockpit/app/(painel)/pedidos/page.tsx`, no painel de detalhe do pedido selecionado:

1. Importar: `import { FiscalDoPedido, type DocumentoFiscal } from "@/components/fiscal-do-pedido"`
2. Buscar o documento junto com o pedido: `GET /api/fiscal/documentos?order_id=<id>` → `{ documento, itens }`
3. Renderizar `<FiscalDoPedido documento={documento} />` ao lado do bloco de envio já existente.

- [ ] **Step 3: Verificar o fluxo completo em homologação**

Pré-requisitos: certificado A1 carregado; perfil fiscal padrão cadastrado com os valores do contador; ao menos um produto com `hs_code` preenchido; `emissao_ativa` ligado; ambiente `homologacao`.

1. Criar um pedido de teste.
2. Em Fiscal, usar **Prévia** (`POST /api/fiscal/emitir { order_id, previa: true }`) e conferir NCM, CFOP e CSOSN no XML gerado — **sem consumir numeração**.
3. Despachar o pedido pelo Cockpit.
4. Conferir: documento criado, status `autorizado_nao_verificado`, chave de acesso preenchida.
5. Rodar **Reconciliar** e conferir que o status vira `verificado` e que `n_item_verificado` foi gravado para todos os itens:

```bash
psql "$SUPABASE_DB_URL" -c "select i.ordem_enviada, i.n_item_verificado, i.ncm from public.fiscal_documento_item i join public.fiscal_documento d on d.id = i.fiscal_documento_id order by d.created_at desc, i.ordem_enviada limit 10;"
```

Esperado: nenhuma linha com `n_item_verificado` nulo.

6. Despachar o **mesmo** pedido de novo e confirmar que **não** cria segunda nota (idempotência).
7. Criar produto **sem** `hs_code` e confirmar que o despacho é **recusado** com mensagem apontando o produto.

- [ ] **Step 4: Rodar toda a bateria**

```bash
cd apps/backend && TEST_TYPE=unit npx jest src/lib/fiscal
cd ../cockpit && npm run test
```

Esperado: tudo verde.

- [ ] **Step 5: Commit**

```bash
git add "apps/cockpit/app/api/orders/[id]/dispatch/route.ts" "apps/cockpit/app/(painel)/pedidos/page.tsx"
git commit -m "feat(cockpit): emitir NF-e no despacho e exibir status fiscal no pedido"
```

---

## Cobertura da spec

| Requisito da spec | Task |
|---|---|
| §5 NCM em `variant.hs_code`, origem em `origin_country` | 12 (`fiscal-pedido.ts`) |
| §6 tabelas + RLS + seed do emitente | 1 |
| §7.1 montar e pré-visualizar | 4, 12 |
| §7.2 transmitir com idempotência, gravar antes | 9 |
| §7.3 reconciliar, `nItem` real, trava de verificação | 5, 10 |
| §7.3 webhook primário + varredura de segurança | 11 |
| §8 NFD com `DFeReferenciado` (VC02-14/40/50, VC03-20) | 6 |
| §9 estados e erros sem falha silenciosa | 9, 10, 12 |
| §10 estrutura de arquivos e rotas | 12, 13 |
| §12 aceite 1–2 (config, perfis) | 13 |
| §12 aceite 3–5 (prévia, transmissão, reconciliação) | 14 step 3 |
| §12 aceite 6–7 (trava da NFD, NFD parcial) | 6 |
| §12 aceite 8 (idempotência) | 9, 14 step 3 |
| §12 aceite 9 (produto sem NCM bloqueia) | 4, 14 step 3 |
| §12 aceite 10 (testes verdes) | 3, 4, 5, 6 |

**Fora deste plano, por decisão da spec (§3):** emissão automática da NFD (Projeto B), NFC-e, NFS-e, SPED/SINTEGRA, carta de correção e cancelamento pela UI, conciliação fiscal no DRE.

**Pendências que não bloqueiam a implementação, mas bloqueiam a virada para produção** (§11 da spec): IBS/CBS (risco 1), confirmação escrita da NT v1.40 (risco 2), tabela tributária do contador (risco 3 — caminho crítico para emitir qualquer nota).
