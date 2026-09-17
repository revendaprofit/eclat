# Fiscal — Contrato Real da Brasil NFe (Revisão 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer a camada fiscal já existente em `main` falar o contrato **real** da Brasil NFe (endpoints, payload, resposta, webhook), sem transmitir nenhuma nota.

**Architecture:** A revisão 1 foi escrita contra um contrato suposto. Esta revisão troca a fronteira com o fornecedor — payloads em `PascalCase`, resposta em `ReturnNF`, endpoints `/services/fiscal/*` — e aproveita que a resposta síncrona já traz o XML autorizado para reconciliar o `nItem` na própria emissão. O que a revisão 1 acertou (gravar antes de transmitir, casar XML por código, desconto explícito, idempotência) permanece intacto.

**Tech Stack:** Medusa v2.15.5 (Node/TypeScript), Jest + SWC (`TEST_TYPE=unit`), Supabase via PostgREST, Next.js 15 + Vitest no Cockpit.

**Spec:** `docs/superpowers/specs/2026-09-16-fiscal-brasilnfe-design.md` — **Revisão 2**, §7 a §14. Leia o §7.0 (contrato da API) e o §14 (o que a revisão 1 assumiu errado) antes de qualquer tarefa.

## Global Constraints

- **Dinheiro em centavos inteiros** até a fronteira com a API (Invariante 3). A conversão para número em reais acontece **só** por `numeroReais()` de `fiscal-dinheiro.ts`. Nunca somar, multiplicar ou arredondar floats.
- **Nunca inferir valor tributário** (Invariante 6). Falta NCM, perfil, CFOP válido, ou o CSOSN não é suportado → `ErroFiscal` com mensagem legível. Nunca um default.
- **Nenhum teste faz chamada de rede nem toca o Supabase real.** `global.fetch` é sempre mock; `fiscal-db` é sempre `jest.doMock`. Um teste que leva centenas de ms enquanto os vizinhos levam 1 ms está falando com a rede — pare e corrija.
- **Toda fixture de resposta do fornecedor usa o formato real** (`ReturnNF`, `Base64Xml`, envelope `{event, deliveryId, timestamp, data}`) e cita a fonte num comentário: "formato: SDK brasilnfe@3.1.3, NotaFiscalRetorno" ou "formato: brasilnfe.com.br/webhooks".
- **Cada `new Response(...)` de mock é usado uma vez só.** `mockResolvedValue(new Response(...))` reaproveita o corpo já consumido na segunda chamada; use `mockResolvedValueOnce` por chamada ou `mockImplementation(() => new Response(...))`.
- **Segredos:** nunca ler, imprimir ou colar `BRASILNFE_USER_TOKEN`, `BRASILNFE_COMPANY_TOKEN`, `BRASILNFE_WEBHOOK_SECRET`. Nos testes use valores falsos (`"user-token"`). Nunca montar proxy para produção, nunca editar `.env`.
- **Nada é transmitido à SEFAZ neste plano.** `fiscal_config.emissao_ativa` fica `false`. Não rodar a migration — o dono aplica.
- **Testes do backend:** `cd apps/backend && TEST_TYPE=unit NODE_OPTIONS=--experimental-vm-modules npx jest <arquivo> --runInBand --forceExit`. Imports dinâmicos nos testes usam sufixo `.js` (`await import("../fiscal-client.js")`); imports estáticos não.
- **Testes do Cockpit:** `cd apps/cockpit && npx vitest run <arquivo>`. Só funções puras.
- **Commits** terminam com `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Branch: `feat/fiscal-contrato-real`. Não fazer push.

## File Structure

Backend — `apps/backend/src/lib/fiscal/`:

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `fiscal-dinheiro.ts` | criar | `reais`, `numeroReais`, `ratearFrete` — puras |
| `fiscal-pagamento.ts` | criar | provedor de pagamento → `FormaPagamento` — pura |
| `fiscal-pedido.ts` | modificar | passa a devolver `pagamento` |
| `tipos.ts` | modificar | campos novos opcionais |
| `fiscal-payload.ts` | reescrever | payload de venda no contrato real + helpers compartilhados |
| `fiscal-payload-devolucao.ts` | reescrever a montagem | payload da NFD no contrato real |
| `fiscal-client.ts` | reescrever | endpoints reais, `interpretarResposta`, localizar, baixar arquivo |
| `fiscal-reconciliar.ts` | modificar | reconcilia com XML em mãos; `localizarNoFornecedor`; varredura |
| `fiscal-emissao.ts` | modificar | `prepararTentativa`, `transmitirEGravar`, reconciliação inline |
| `fiscal-webhook.ts` | criar | verificação HMAC — pura |

Rotas — `apps/backend/src/api/`: `admin/fiscal/emitir/route.ts`, `admin/fiscal/emitir-devolucao/route.ts`, `admin/fiscal/perfis/route.ts`, `webhooks/brasilnfe/route.ts`, `middlewares.ts` (modificar); `admin/fiscal/documentos/[id]/danfe/route.ts` (criar).

Banco: `supabase/migrations/0012_fiscal_contrato.sql` (criar; o dono aplica).

Cockpit — `apps/cockpit/`: `lib/fiscal.ts`, `components/fiscal-do-pedido.tsx`, `app/(painel)/fiscal/page.tsx` (modificar); `app/api/fiscal-danfe/[id]/route.ts` (criar).

Docs: `architecture/fiscal.md` (criar), `progress.md` (modificar).

---

### Task 1: Dinheiro — conversão e rateio de frete

**Files:**
- Create: `apps/backend/src/lib/fiscal/fiscal-dinheiro.ts`
- Test: `apps/backend/src/lib/fiscal/__tests__/fiscal-dinheiro.unit.spec.ts`

**Interfaces:**
- Consumes: `ErroFiscal` de `./tipos`.
- Produces:
  - `reais(centavos: number): string` — `18990` → `"189.90"`
  - `numeroReais(centavos: number): number` — `18990` → `189.9`; lança `ErroFiscal` se não for inteiro
  - `ratearFrete(freteCentavos: number, pesosCentavos: number[]): number[]` — mesma ordem e tamanho de `pesosCentavos`; a soma é **exatamente** `freteCentavos`

Por que existe: no XML da NF-e o frete é **por item**; o contrato da API não tem frete "da nota" (spec §7.1.1). Ratear em float faz a soma das partes diferir do frete em 1 centavo, e a SEFAZ rejeita nota cujos totais não fecham.

- [ ] **Step 1: Write the failing test**

```typescript
import { numeroReais, ratearFrete, reais } from "../fiscal-dinheiro"
import { ErroFiscal } from "../tipos"

describe("reais", () => {
  it("formata centavos com duas casas", () => {
    expect(reais(18990)).toBe("189.90")
    expect(reais(5)).toBe("0.05")
    expect(reais(0)).toBe("0.00")
    expect(reais(100000)).toBe("1000.00")
  })
})

describe("numeroReais", () => {
  it("converte centavos em número JSON de reais", () => {
    expect(numeroReais(18990)).toBe(189.9)
    expect(numeroReais(5)).toBe(0.05)
    expect(numeroReais(0)).toBe(0)
  })

  it("serializa sem ruído de ponto flutuante", () => {
    // 0.1 + 0.2 em float é 0.30000000000000004 — a conversão a partir de inteiro não pode vazar isso.
    expect(JSON.stringify(numeroReais(30))).toBe("0.3")
    expect(JSON.stringify(numeroReais(1999))).toBe("19.99")
  })

  it("recusa valor não inteiro", () => {
    expect(() => numeroReais(10.5)).toThrow(ErroFiscal)
    expect(() => numeroReais(NaN)).toThrow(ErroFiscal)
  })
})

describe("ratearFrete", () => {
  it("a soma das partes é exatamente o frete", () => {
    const partes = ratearFrete(1000, [18990, 12990, 8990])
    expect(partes.reduce((a, b) => a + b, 0)).toBe(1000)
  })

  it("dízima: 100 centavos entre três itens iguais vira 34 + 33 + 33", () => {
    expect(ratearFrete(100, [5000, 5000, 5000])).toEqual([34, 33, 33])
  })

  it("rateia em proporção ao peso", () => {
    expect(ratearFrete(1000, [7500, 2500])).toEqual([750, 250])
  })

  it("um item só recebe o frete inteiro", () => {
    expect(ratearFrete(2590, [18990])).toEqual([2590])
  })

  it("frete zero dá zero para todos", () => {
    expect(ratearFrete(0, [100, 200])).toEqual([0, 0])
  })

  it("todos os pesos zero (pedido 100% desconto): divide igualmente", () => {
    expect(ratearFrete(101, [0, 0])).toEqual([51, 50])
  })

  it("recusa frete negativo, fracionário, ou lista vazia", () => {
    expect(() => ratearFrete(-1, [100])).toThrow(ErroFiscal)
    expect(() => ratearFrete(10.5, [100])).toThrow(ErroFiscal)
    expect(() => ratearFrete(100, [])).toThrow(ErroFiscal)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && TEST_TYPE=unit NODE_OPTIONS=--experimental-vm-modules npx jest src/lib/fiscal/__tests__/fiscal-dinheiro.unit.spec.ts --runInBand --forceExit`
Expected: FAIL — `Cannot find module '../fiscal-dinheiro'`

- [ ] **Step 3: Write the implementation**

```typescript
// Dinheiro na fronteira com a API da Brasil NFe (spec §7.1.1).
//
// Tudo entra em centavos inteiros (Invariante 3). A API espera NÚMERO JSON em reais, então a
// conversão acontece uma única vez, aqui, no último instante — a partir de uma string decimal
// montada com aritmética inteira. Nenhuma soma, multiplicação ou arredondamento passa por float.

import { ErroFiscal } from "./tipos"

// Centavos inteiros -> "1234.56". Sem float em nenhum ponto.
export function reais(centavos: number): string {
  const sinal = centavos < 0 ? "-" : ""
  const abs = Math.abs(centavos)
  return `${sinal}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`
}

export function numeroReais(centavos: number): number {
  if (!Number.isInteger(centavos)) {
    throw new ErroFiscal(`Valor monetário inválido (${centavos}): a camada fiscal só aceita centavos inteiros.`)
  }
  return Number(reais(centavos))
}

// Rateia o frete entre os itens pelo método do maior resto: cada item recebe o piso da sua
// parte proporcional, e os centavos que sobram vão para os maiores restos (empate: o primeiro
// item). A soma das partes é EXATAMENTE o frete — a SEFAZ rejeita nota cujos totais não fecham.
export function ratearFrete(freteCentavos: number, pesosCentavos: number[]): number[] {
  if (!Number.isInteger(freteCentavos) || freteCentavos < 0) {
    throw new ErroFiscal(`Frete inválido (${freteCentavos}): precisa ser inteiro em centavos, >= 0.`)
  }
  if (pesosCentavos.length === 0) {
    throw new ErroFiscal("Não há itens entre os quais ratear o frete.")
  }
  const positivos = pesosCentavos.map((p) => Math.max(0, p))
  const soma = positivos.reduce((a, b) => a + b, 0)
  // Pedido com todos os itens zerados (100% de desconto): divide igualmente.
  const pesos = soma === 0 ? positivos.map(() => 1) : positivos
  const total = soma === 0 ? pesos.length : soma

  const partes = pesos.map((p) => Math.floor((freteCentavos * p) / total))
  const restos = pesos.map((p, i) => ({ i, resto: (freteCentavos * p) % total }))
  restos.sort((a, b) => b.resto - a.resto || a.i - b.i)

  const falta = freteCentavos - partes.reduce((a, b) => a + b, 0)
  for (let k = 0; k < falta; k++) partes[restos[k].i]++
  return partes
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: o mesmo comando do Step 2.
Expected: PASS — 11 testes.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/lib/fiscal/fiscal-dinheiro.ts apps/backend/src/lib/fiscal/__tests__/fiscal-dinheiro.unit.spec.ts
git commit -m "feat(fiscal): conversão de centavos e rateio de frete pelo maior resto

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Forma de pagamento do pedido

**Files:**
- Create: `apps/backend/src/lib/fiscal/fiscal-pagamento.ts`
- Modify: `apps/backend/src/lib/fiscal/fiscal-pedido.ts` (lista `fields` da query e o `return` final)
- Test: `apps/backend/src/lib/fiscal/__tests__/fiscal-pagamento.unit.spec.ts`

**Interfaces:**
- Produces:
  - `type PagamentoNF = { forma: string; descricao: string | null }`
  - `formaPagamentoDoPedido(providerIds: string[]): PagamentoNF`
  - `montarItensDoPedido(...)` passa a devolver também `pagamento: PagamentoNF`

Contexto: a NF-e leva a forma de pagamento (`tPag`). Hoje o único provedor do Medusa é o manual (`pp_system_default`), então o mapa devolve `99` (Outros). O código `99` **sem descrição é rejeição 441** da SEFAZ — por isso a descrição é obrigatória aqui. Quando o gateway real entrar (Mercado Pago/Getnet), este arquivo é o único ponto a mudar: `17` = Pix, `03` = cartão de crédito. **Não** adicionar esses casos agora — não sabemos ainda como o provedor identifica o meio de pagamento, e chutar o formato é exatamente o erro que esta revisão corrige.

- [ ] **Step 1: Write the failing test**

```typescript
import { formaPagamentoDoPedido } from "../fiscal-pagamento"

describe("formaPagamentoDoPedido", () => {
  it("provedor manual vira 99 COM descrição (99 sem descrição é rejeição 441)", () => {
    const p = formaPagamentoDoPedido(["pp_system_default"])
    expect(p.forma).toBe("99")
    expect(p.descricao).toBe("Pagamento online")
  })

  it("provedor desconhecido também vira 99 com descrição — nunca adivinha Pix ou cartão", () => {
    const p = formaPagamentoDoPedido(["pp_algum_gateway_novo"])
    expect(p.forma).toBe("99")
    expect(p.descricao).not.toBeNull()
  })

  it("pedido sem pagamento registrado vira 99 com descrição", () => {
    expect(formaPagamentoDoPedido([])).toEqual({ forma: "99", descricao: "Pagamento online" })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && TEST_TYPE=unit NODE_OPTIONS=--experimental-vm-modules npx jest src/lib/fiscal/__tests__/fiscal-pagamento.unit.spec.ts --runInBand --forceExit`
Expected: FAIL — `Cannot find module '../fiscal-pagamento'`

- [ ] **Step 3: Write the implementation**

`apps/backend/src/lib/fiscal/fiscal-pagamento.ts`:

```typescript
// Provedor de pagamento do pedido -> forma de pagamento da NF-e (tPag), spec §7.1.1.
//
// Tabela tPag relevante: 03 cartão de crédito · 17 Pix dinâmico · 90 sem pagamento · 99 outros.
// Hoje o único provedor é o manual, então tudo cai em 99. Quando o gateway real entrar, os casos
// 17 e 03 entram AQUI — e só aqui. Não adicionar antes de conhecer o formato real do provedor.
//
// 99 exige descrição: sem ela a SEFAZ devolve a rejeição 441.

export type PagamentoNF = { forma: string; descricao: string | null }

const OUTROS: PagamentoNF = { forma: "99", descricao: "Pagamento online" }

export function formaPagamentoDoPedido(_providerIds: string[]): PagamentoNF {
  return { ...OUTROS }
}
```

Em `fiscal-pedido.ts`:

1. Acrescente o import: `import { formaPagamentoDoPedido, type PagamentoNF } from "./fiscal-pagamento"`.
2. No tipo de retorno de `montarItensDoPedido`, acrescente `pagamento: PagamentoNF`:

```typescript
): Promise<{ itens: ItemPedido[]; destinatario: DestinatarioNF; frete_centavos: number; pagamento: PagamentoNF }> {
```

3. Na lista `fields` da `query.graph`, acrescente uma linha depois de `"shipping_address.*", "billing_address.*",`:

```typescript
      "payment_collections.payments.provider_id",
```

4. No `return` final, acrescente o campo:

```typescript
  const providerIds: string[] = (order.payment_collections ?? [])
    .flatMap((pc: any) => pc?.payments ?? [])
    .map((p: any) => String(p?.provider_id ?? ""))
    .filter(Boolean)

  return {
    itens,
    destinatario,
    frete_centavos: Math.round(Number(order.shipping_total ?? 0) * 100),
    pagamento: formaPagamentoDoPedido(providerIds),
  }
```

- [ ] **Step 4: Run tests**

Run: `cd apps/backend && TEST_TYPE=unit NODE_OPTIONS=--experimental-vm-modules npx jest src/lib/fiscal/__tests__/fiscal-pagamento.unit.spec.ts src/lib/fiscal/__tests__/fiscal-pedido.unit.spec.ts --runInBand --forceExit`
Expected: PASS nos dois arquivos. Se algum teste de `fiscal-pedido` comparar o retorno inteiro com `toEqual`, ajuste-o para incluir `pagamento: { forma: "99", descricao: "Pagamento online" }`.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/lib/fiscal/fiscal-pagamento.ts apps/backend/src/lib/fiscal/fiscal-pedido.ts apps/backend/src/lib/fiscal/__tests__/fiscal-pagamento.unit.spec.ts apps/backend/src/lib/fiscal/__tests__/fiscal-pedido.unit.spec.ts
git commit -m "feat(fiscal): forma de pagamento da NF-e a partir do provedor do pedido

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Migration 0012, tipos e payload de venda no contrato real

**Files:**
- Create: `supabase/migrations/0012_fiscal_contrato.sql`
- Modify: `apps/backend/src/lib/fiscal/tipos.ts`
- Rewrite: `apps/backend/src/lib/fiscal/fiscal-payload.ts`
- Rewrite: `apps/backend/src/lib/fiscal/__tests__/fiscal-payload.unit.spec.ts` (os 14 testes atuais afirmam o formato antigo; substitua o arquivo inteiro)

**Interfaces:**
- Consumes: `numeroReais`, `ratearFrete` (Task 1); `PagamentoNF` (Task 2); `resolverPerfil(perfis, product_id, categoria_handle): FiscalPerfil` de `./fiscal-perfil` (já existe).
- Produces (todos exportados de `fiscal-payload.ts`):
  - `type DestinatarioNF` (inalterado)
  - `CSOSN_SUPORTADOS: Set<string>`
  - `tipoAmbiente(a: Ambiente): 1 | 2`
  - `cfopNumerico(cfop: string, titulo: string): number`
  - `impostoDoPerfil(perfil: FiscalPerfil, titulo: string): Record<string, unknown>`
  - `montarPayloadVenda(args: { config; perfis; itens; destinatario; frete_centavos; pagamento: PagamentoNF; identificador: string }): { payload: Record<string, unknown>; itens_ordenados: ItemPedido[] }`
  - O código de cada item fica em `payload.Produtos[i].CodProdutoServico` — a Task 7 lê daí.

O mapa campo a campo está na spec §7.1.1. Três armadilhas que o JSON de exemplo do fornecedor esconde: (1) ele inclui `Intermediador` — em venda direta isso é **rejeição 435**, não enviar; (2) não existe bloco de emitente nem totais — vêm do cadastro/cálculo deles; (3) não existe campo para o número do item — **a posição no array é o `nItem`**.

- [ ] **Step 1: Write the migration**

`supabase/migrations/0012_fiscal_contrato.sql`:

```sql
-- Revisão 2 da integração fiscal (spec 2026-09-16, §10): contrato real da Brasil NFe.
-- Aditiva e idempotente. Não mexe em dado existente.

-- O XML autorizado é o documento fiscal com guarda obrigatória. A resposta síncrona da API já o
-- traz (Base64Xml); fica em coluna própria, não enterrado em resposta_bruta.
alter table public.fiscal_documento
  add column if not exists xml_autorizado text;

-- CST de PIS e COFINS (espelhados). Nulo = o bloco não é enviado.
alter table public.fiscal_perfil
  add column if not exists cst_pis_cofins text
  check (cst_pis_cofins is null or cst_pis_cofins ~ '^\d{2}$');

-- CEST: obrigatório quando o produto tem ICMS-ST (sem ele, rejeição 806).
alter table public.fiscal_perfil
  add column if not exists cest text
  check (cest is null or cest ~ '^\d{7}$');
```

**Não rode a migration.** O dono aplica pelo SQL Editor.

- [ ] **Step 2: Update the types**

Em `tipos.ts`, os campos novos são **opcionais** para não quebrar os literais já espalhados pelos testes:

Em `FiscalPerfil`, depois de `origem_padrao: number`:

```typescript
  cst_pis_cofins?: string | null   // migration 0012 — CST espelhado de PIS e COFINS
  cest?: string | null             // migration 0012 — obrigatório quando há ICMS-ST
```

Em `FiscalDocumento`, depois de `verificado_em: string | null`:

```typescript
  xml_autorizado?: string | null   // migration 0012 — XML autorizado (Base64Xml decodificado)
  created_at?: string              // vem do select=*; usado para a janela de busca no fornecedor
```

- [ ] **Step 3: Write the failing tests**

Substitua **todo** o conteúdo de `fiscal-payload.unit.spec.ts`:

```typescript
import { cfopNumerico, montarPayloadVenda, tipoAmbiente, type DestinatarioNF } from "../fiscal-payload"
import { ErroFiscal, type FiscalConfig, type FiscalPerfil, type ItemPedido } from "../tipos"

// Formato do payload: SDK brasilnfe@3.1.3, tipo NotaFiscalEnvio (spec §7.1.1).

const config: FiscalConfig = {
  id: 1, cnpj: "68673407000113", razao_social: "CAMILA DE MOURA NOGUEIRA",
  nome_fantasia: "USE ECLAT", ie: "56295050042", im: null, crt: 1,
  logradouro: "R NORTE", numero: "180", complemento: null, bairro: "ANGOLA",
  municipio: "BETIM", municipio_ibge: "3106705", uf: "MG", cep: "32604182",
  serie_nfe: 1, ambiente: "homologacao", emissao_ativa: true,
}

function perfil(p: Partial<FiscalPerfil> = {}): FiscalPerfil {
  return {
    id: "padrao", escopo: "padrao", alvo_id: null, csosn: "102",
    cfop_dentro_uf: "5102", cfop_fora_uf: "6108",
    cfop_devolucao_dentro_uf: "1202", cfop_devolucao_fora_uf: "2202",
    origem_padrao: 0, ativo: true, ...p,
  }
}

function item(p: Partial<ItemPedido> = {}): ItemPedido {
  return {
    line_item_id: p.line_item_id ?? "li_1",
    product_id: p.product_id ?? "prod_1",
    categoria_handle: p.categoria_handle ?? "tops",
    titulo: p.titulo ?? "Top Aura",
    // "in" distingue AUSENTE (usa o default) de NULO explícito (preserva o null do teste).
    sku: "sku" in p ? (p.sku ?? null) : "TOP-AURA-P",
    ncm: "ncm" in p ? (p.ncm ?? null) : "61091000",
    origem: "origem" in p ? (p.origem ?? null) : 0,
    quantidade: p.quantidade ?? 1,
    valor_unitario_centavos: p.valor_unitario_centavos ?? 18990,
    desconto_centavos: p.desconto_centavos ?? 0,
  }
}

function destino(uf: string): DestinatarioNF {
  return {
    cpf: "12345678909", nome: "Maria Silva", logradouro: "Rua A", numero: "10",
    complemento: null, bairro: "Centro", municipio: "Belo Horizonte",
    municipio_ibge: "3106200", uf, cep: "30110000",
  }
}

function montar(over: Partial<Parameters<typeof montarPayloadVenda>[0]> = {}) {
  return montarPayloadVenda({
    config, perfis: [perfil()], itens: [item()], destinatario: destino("MG"),
    frete_centavos: 0, pagamento: { forma: "99", descricao: "Pagamento online" },
    identificador: "order_1:venda:homologacao", ...over,
  }).payload as any
}

describe("tipoAmbiente / cfopNumerico", () => {
  it("homologação é 2, produção é 1", () => {
    expect(tipoAmbiente("homologacao")).toBe(2)
    expect(tipoAmbiente("producao")).toBe(1)
  })

  it("CFOP vira número; CFOP malformado é erro, nunca NaN na nota", () => {
    expect(cfopNumerico("5102", "Top")).toBe(5102)
    expect(() => cfopNumerico("", "Top")).toThrow(ErroFiscal)
    expect(() => cfopNumerico("51A2", "Top")).toThrow(ErroFiscal)
  })
})

describe("montarPayloadVenda — cabeçalho", () => {
  it("usa os nomes e tipos do contrato real", () => {
    const p = montar()
    expect(p.ModeloDocumento).toBe(55)
    expect(p.Finalidade).toBe(1)
    expect(p.TipoAmbiente).toBe(2)
    expect(p.ConsumidorFinal).toBe(true)      // booleano, não 1
    expect(p.IndicadorPresenca).toBe(2)       // não presencial, Internet
    expect(p.CalcularIBPT).toBe(true)         // Lei 12.741/2012
    expect(p.EnviarEmail).toBe(false)
    expect(p.NaturezaOperacao).toBe("VENDA DE MERCADORIA")
    expect(p.IdentificadorInterno).toBe("order_1:venda:homologacao")
  })

  it("NÃO envia o que o contrato não tem ou que causaria rejeição", () => {
    const p = montar()
    expect(p).not.toHaveProperty("Intermediador")   // rejeição 435 em venda direta
    expect(p).not.toHaveProperty("NFReferencia")
    expect(p).not.toHaveProperty("Serie")           // numeração é do fornecedor
    expect(p).not.toHaveProperty("Numero")
    expect(p).not.toHaveProperty("Lote")
    expect(p).not.toHaveProperty("emitente")        // vem do cadastro no painel deles
    expect(p).not.toHaveProperty("total")
    expect(p).not.toHaveProperty("itens")
  })

  it("monta o Cliente como pessoa física não contribuinte", () => {
    const c = montar().Cliente
    expect(c.CpfCnpj).toBe("12345678909")
    expect(c.NmCliente).toBe("Maria Silva")
    expect(c.IndicadorIe).toBe(9)
    expect(c.Endereco).toEqual({
      Cep: "30110000", Logradouro: "Rua A", Numero: "10", Complemento: null, Bairro: "Centro",
      CodMunicipio: "3106200", Municipio: "Belo Horizonte", Uf: "MG", CodPais: 1058, Pais: "BRASIL",
    })
  })

  it("envia ModalidadeFrete 0 de propósito (omitido, a API assume 9 = sem transporte)", () => {
    expect(montar().Transporte).toEqual({ ModalidadeFrete: 0 })
  })
})

describe("montarPayloadVenda — produtos", () => {
  it("CFOP de dentro do estado quando o destino é MG, interestadual fora — como número", () => {
    expect(montar({ destinatario: destino("MG") }).Produtos[0].CFOP).toBe(5102)
    expect(montar({ destinatario: destino("SP") }).Produtos[0].CFOP).toBe(6108)
  })

  it("UF com espaço ou minúscula não vira interestadual por engano", () => {
    expect(montar({ destinatario: destino(" mg ") }).Produtos[0].CFOP).toBe(5102)
  })

  it("valores em reais como NÚMERO, bruto e desconto separados", () => {
    const prod = montar({
      itens: [item({ quantidade: 2, valor_unitario_centavos: 18990, desconto_centavos: 3000 })],
    }).Produtos[0]
    expect(prod.ValorUnitario).toBe(189.9)
    expect(prod.ValorUnitarioTributavel).toBe(189.9)
    expect(prod.ValorTotal).toBe(379.8)      // bruto: 2 × 189.90
    expect(prod.ValorDesconto).toBe(30)
    expect(prod.Quantidade).toBe(2)
    expect(prod.QuantidadeTributavel).toBe(2)
    expect(prod.UnidadeComercial).toBe("UN")
  })

  it("o CSOSN vai dentro de Imposto.ICMS, não solto no item", () => {
    const prod = montar().Produtos[0]
    expect(prod.Imposto.ICMS.CodSituacaoTributaria).toBe("102")
    expect(prod).not.toHaveProperty("csosn")
  })

  it("PIS/COFINS e CEST só entram quando o perfil os define", () => {
    const sem = montar().Produtos[0]
    expect(sem.Imposto).not.toHaveProperty("PIS")
    expect(sem.Imposto).not.toHaveProperty("COFINS")
    expect(sem).not.toHaveProperty("CEST")

    const com = montar({ perfis: [perfil({ cst_pis_cofins: "99", cest: "2806000" })] }).Produtos[0]
    expect(com.Imposto.PIS).toEqual({ CodSituacaoTributaria: "99" })
    expect(com.Imposto.COFINS).toEqual({ CodSituacaoTributaria: "99" })
    expect(com.CEST).toBe("2806000")
  })

  it("nunca envia o grupo IBSCBS (risco 1 da spec ainda aberto)", () => {
    expect(montar().Produtos[0].Imposto).not.toHaveProperty("IBSCBS")
  })

  it("CSOSN que exige campos que não enviamos é recusado, não emitido pela metade", () => {
    for (const csosn of ["101", "201", "202", "203", "900"]) {
      expect(() => montar({ perfis: [perfil({ csosn })] })).toThrow(ErroFiscal)
    }
    for (const csosn of ["102", "103", "300", "400", "500"]) {
      expect(() => montar({ perfis: [perfil({ csosn })] })).not.toThrow()
    }
  })

  it("código é o SKU, ou o line_item_id na falta dele", () => {
    expect(montar().Produtos[0].CodProdutoServico).toBe("TOP-AURA-P")
    expect(montar({ itens: [item({ sku: null })] }).Produtos[0].CodProdutoServico).toBe("li_1")
  })

  it("origem da variante vence; sem ela, a do perfil", () => {
    expect(montar({ itens: [item({ origem: 1 })] }).Produtos[0].OrigemProduto).toBe(1)
    expect(montar({ itens: [item({ origem: null })], perfis: [perfil({ origem_padrao: 5 })] }).Produtos[0].OrigemProduto).toBe(5)
  })

  it("preserva a ordem dos itens — a posição no array É o nItem", () => {
    const r = montarPayloadVenda({
      config, perfis: [perfil()], destinatario: destino("MG"), frete_centavos: 0,
      pagamento: { forma: "99", descricao: "Pagamento online" }, identificador: "k",
      itens: [item({ line_item_id: "li_a", sku: "A" }), item({ line_item_id: "li_b", sku: "B" })],
    })
    expect((r.payload as any).Produtos.map((x: any) => x.CodProdutoServico)).toEqual(["A", "B"])
    expect(r.itens_ordenados.map((x) => x.line_item_id)).toEqual(["li_a", "li_b"])
    expect((r.payload as any).Produtos[0]).not.toHaveProperty("numero_item")
  })

  it("produto sem NCM bloqueia, apontando o produto", () => {
    expect(() => montar({ itens: [item({ ncm: null, titulo: "Legging Vértice" })] })).toThrow(/Legging Vértice/)
  })

  it("pedido sem itens é erro", () => {
    expect(() => montar({ itens: [] })).toThrow(ErroFiscal)
  })
})

describe("montarPayloadVenda — frete e pagamento", () => {
  it("rateia o frete entre os itens e a soma fecha no centavo", () => {
    const p = montar({
      frete_centavos: 100,
      itens: [
        item({ line_item_id: "a", sku: "A", valor_unitario_centavos: 5000 }),
        item({ line_item_id: "b", sku: "B", valor_unitario_centavos: 5000 }),
        item({ line_item_id: "c", sku: "C", valor_unitario_centavos: 5000 }),
      ],
    })
    expect(p.Produtos.map((x: any) => x.ValorFrete)).toEqual([0.34, 0.33, 0.33])
  })

  it("o rateio pesa pelo valor LÍQUIDO da linha (bruto − desconto)", () => {
    const p = montar({
      frete_centavos: 1000,
      itens: [
        item({ line_item_id: "a", sku: "A", valor_unitario_centavos: 10000, desconto_centavos: 2500 }), // líquido 7500
        item({ line_item_id: "b", sku: "B", valor_unitario_centavos: 2500 }),                            // líquido 2500
      ],
    })
    expect(p.Produtos.map((x: any) => x.ValorFrete)).toEqual([7.5, 2.5])
  })

  it("VlPago é o total da nota: produtos − desconto + frete", () => {
    const p = montar({
      frete_centavos: 2590,
      itens: [item({ quantidade: 2, valor_unitario_centavos: 18990, desconto_centavos: 3000 })],
    })
    // 2 × 189.90 − 30.00 + 25.90 = 375.70
    expect(p.Pagamentos).toEqual([
      { IndicadorPagamento: 0, FormaPagamento: "99", Descricao: "Pagamento online", VlPago: 375.7 },
    ])
  })

  it("forma de pagamento sem descrição não manda o campo Descricao", () => {
    const p = montar({ pagamento: { forma: "17", descricao: null } })
    expect(p.Pagamentos[0].FormaPagamento).toBe("17")
    expect(p.Pagamentos[0]).not.toHaveProperty("Descricao")
  })
})
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd apps/backend && TEST_TYPE=unit NODE_OPTIONS=--experimental-vm-modules npx jest src/lib/fiscal/__tests__/fiscal-payload.unit.spec.ts --runInBand --forceExit`
Expected: FAIL — `tipoAmbiente`/`cfopNumerico` não exportados; asserções de `Produtos` em `undefined`.

- [ ] **Step 5: Write the implementation**

Substitua **todo** o conteúdo de `fiscal-payload.ts`:

```typescript
// Monta o payload da NF-e de venda no contrato REAL da Brasil NFe (spec §7.1.1).
// Fonte do formato: SDK oficial brasilnfe@3.1.3, tipo NotaFiscalEnvio.
// Função PURA: não faz rede, não lê banco.
//
// O que NÃO vai, de propósito:
//   - emitente e totais da nota: vêm do cadastro e do cálculo do fornecedor;
//   - Serie/Numero/Lote: omitidos, a numeração é gerenciada por eles;
//   - Intermediador: venda em site próprio. Enviar o grupo é rejeição 435 — e o JSON de
//     exemplo do fornecedor o inclui, então não copie de lá;
//   - número do item: não existe campo. A POSIÇÃO no array Produtos é o nItem.

import { numeroReais, ratearFrete } from "./fiscal-dinheiro"
import type { PagamentoNF } from "./fiscal-pagamento"
import { resolverPerfil } from "./fiscal-perfil"
import { ErroFiscal, type Ambiente, type FiscalConfig, type FiscalPerfil, type ItemPedido } from "./tipos"

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

// Só os CSOSN que não exigem campo além do próprio código. 101 pede alíquota de crédito;
// 201/202/203/900 pedem MVA e base de ST — nada disso é enviado por este sistema (spec §11.3).
export const CSOSN_SUPORTADOS = new Set(["102", "103", "300", "400", "500"])

export function tipoAmbiente(a: Ambiente): 1 | 2 {
  return a === "producao" ? 1 : 2
}

export function cfopNumerico(cfop: string, titulo: string): number {
  if (!/^\d{4}$/.test(String(cfop ?? "").trim())) {
    throw new ErroFiscal(
      `CFOP inválido ("${cfop}") no perfil fiscal aplicado a "${titulo}". Corrija em Fiscal → Perfis tributários.`
    )
  }
  return Number(String(cfop).trim())
}

export function impostoDoPerfil(perfil: FiscalPerfil, titulo: string): Record<string, unknown> {
  const csosn = String(perfil.csosn ?? "").trim()
  if (!CSOSN_SUPORTADOS.has(csosn)) {
    throw new ErroFiscal(
      `O perfil fiscal aplicado a "${titulo}" usa CSOSN ${csosn || "(vazio)"}, que exige campos que este sistema ainda não envia (alíquota de crédito ou substituição tributária). Suportados: 102, 103, 300, 400, 500. Fale com o desenvolvedor antes de emitir.`
    )
  }
  const imposto: Record<string, unknown> = { ICMS: { CodSituacaoTributaria: csosn } }
  // CST de PIS e COFINS são espelhados. Sem valor no perfil, o bloco não vai.
  if (perfil.cst_pis_cofins) {
    imposto.PIS = { CodSituacaoTributaria: perfil.cst_pis_cofins }
    imposto.COFINS = { CodSituacaoTributaria: perfil.cst_pis_cofins }
  }
  return imposto
}

export function montarPayloadVenda(args: {
  config: FiscalConfig
  perfis: FiscalPerfil[]
  itens: ItemPedido[]
  destinatario: DestinatarioNF
  frete_centavos: number
  pagamento: PagamentoNF
  identificador: string
}): { payload: Record<string, unknown>; itens_ordenados: ItemPedido[] } {
  const { config, perfis, itens, destinatario, frete_centavos, pagamento, identificador } = args

  if (itens.length === 0) {
    throw new ErroFiscal("Pedido sem itens: não há o que emitir.")
  }

  // A MESMA normalização decide o CFOP e vai para o payload (achado 5.5 da revisão 1).
  const ufDestino = destinatario.uf.trim().toUpperCase()
  const ufEmitente = config.uf.trim().toUpperCase()
  const interestadual = ufDestino !== ufEmitente

  for (const it of itens) {
    if (!it.ncm) {
      throw new ErroFiscal(
        `Produto "${it.titulo}" está sem NCM. Cadastre o NCM da variante (campo hs_code) em Produtos antes de emitir.`
      )
    }
  }

  // Frete por item, pesado pelo valor LÍQUIDO da linha.
  const liquidos = itens.map((it) => it.valor_unitario_centavos * it.quantidade - it.desconto_centavos)
  const fretes = ratearFrete(frete_centavos, liquidos)

  const produtos = itens.map((it, idx) => {
    const perfil = resolverPerfil(perfis, it.product_id, it.categoria_handle)
    const produto: Record<string, unknown> = {
      NmProduto: it.titulo,
      CodProdutoServico: it.sku ?? it.line_item_id,
      NCM: it.ncm,
      CFOP: cfopNumerico(interestadual ? perfil.cfop_fora_uf : perfil.cfop_dentro_uf, it.titulo),
      UnidadeComercial: "UN",
      UnidadeComercialTributavel: "UN",
      Quantidade: it.quantidade,
      QuantidadeTributavel: it.quantidade,
      // Unitário e total ficam no BRUTO; o desconto vai em campo próprio, nunca escondido.
      ValorUnitario: numeroReais(it.valor_unitario_centavos),
      ValorUnitarioTributavel: numeroReais(it.valor_unitario_centavos),
      ValorTotal: numeroReais(it.valor_unitario_centavos * it.quantidade),
      ValorDesconto: numeroReais(it.desconto_centavos),
      ValorFrete: numeroReais(fretes[idx]),
      OrigemProduto: it.origem != null ? it.origem : perfil.origem_padrao,
      Imposto: impostoDoPerfil(perfil, it.titulo),
    }
    if (perfil.cest) produto.CEST = perfil.cest
    return produto
  })

  const totalNotaCentavos = liquidos.reduce((a, b) => a + b, 0) + frete_centavos

  const pag: Record<string, unknown> = { IndicadorPagamento: 0, FormaPagamento: pagamento.forma }
  if (pagamento.descricao) pag.Descricao = pagamento.descricao
  pag.VlPago = numeroReais(totalNotaCentavos)

  const payload: Record<string, unknown> = {
    ModeloDocumento: 55,
    Finalidade: 1,
    // Enviado sempre, embora opcional: se o cadastro no painel deles divergir, a resposta denuncia.
    TipoAmbiente: tipoAmbiente(config.ambiente),
    NaturezaOperacao: "VENDA DE MERCADORIA",
    ConsumidorFinal: true,
    IndicadorPresenca: 2,
    CalcularIBPT: true,
    EnviarEmail: false,
    IdentificadorInterno: identificador,
    Cliente: {
      CpfCnpj: destinatario.cpf,
      NmCliente: destinatario.nome,
      IndicadorIe: 9,
      Endereco: {
        Cep: destinatario.cep,
        Logradouro: destinatario.logradouro,
        Numero: destinatario.numero,
        Complemento: destinatario.complemento,
        Bairro: destinatario.bairro,
        CodMunicipio: destinatario.municipio_ibge,
        Municipio: destinatario.municipio,
        Uf: ufDestino,
        CodPais: 1058,
        Pais: "BRASIL",
      },
    },
    Produtos: produtos,
    Pagamentos: [pag],
    // Omitido, a API materializa ModalidadeFrete 9 ("sem transporte") — falso para quem despacha.
    Transporte: { ModalidadeFrete: 0 },
  }

  return { payload, itens_ordenados: itens }
}
```

Atenção à ordem das chaves em `pag`: o teste compara com `toEqual`, que ignora ordem — mas mantenha `Descricao` antes de `VlPago` para o payload gravado ficar legível.

- [ ] **Step 6: Run tests to verify they pass**

Run: o mesmo comando do Step 4.
Expected: PASS — 22 testes.

Os chamadores (`fiscal-emissao.ts`, as duas rotas) ainda passam a assinatura antiga e **vão quebrar a compilação** até a Task 7. Isso é esperado; não "conserte" aqui passando valores fictícios. Rode só o arquivo de teste desta tarefa.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0012_fiscal_contrato.sql apps/backend/src/lib/fiscal/tipos.ts apps/backend/src/lib/fiscal/fiscal-payload.ts apps/backend/src/lib/fiscal/__tests__/fiscal-payload.unit.spec.ts
git commit -m "feat(fiscal): payload de venda no contrato real da Brasil NFe + migration 0012

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Payload da NFD no contrato real

**Files:**
- Modify: `apps/backend/src/lib/fiscal/fiscal-payload-devolucao.ts`
- Modify: `apps/backend/src/lib/fiscal/__tests__/fiscal-payload-devolucao.unit.spec.ts`

**Interfaces:**
- Consumes: `numeroReais` (Task 1); `cfopNumerico`, `impostoDoPerfil`, `tipoAmbiente` (Task 3).
- Produces: `montarPayloadDevolucao(args)` ganha o argumento obrigatório `identificador: string`. O retorno (`payload`, `itens_ordenados`, `itens_documento`) mantém a forma; só o `payload` muda de formato.

**O que NÃO muda:** todas as travas (documento não verificado, sem chave, lista vazia, item fora da nota, `n_item_verificado` nulo, quantidade maior que a vendida, quantidade acumulada com NFDs anteriores), o rateio proporcional do desconto e o cálculo de `itens_documento`. Não toque nessa lógica — só na **forma de saída**.

**Mudança de semântica que derruba testes:** no formato antigo `valor_total` era o **líquido** da linha (bruto − desconto). No contrato real `ValorTotal` é o **bruto** ("Valor Total Bruto" no SDK), e o desconto vai só em `ValorDesconto`. Os testes de valor precisam ser re-calculados, não só renomeados.

- [ ] **Step 1: Update the tests**

No helper `chamar()`, acrescente o identificador ao objeto base:

```typescript
function chamar(over: Record<string, unknown> = {}) {
  return montarPayloadDevolucao({
    config, perfis: [perfilPadrao], documentoOrigem: documento(), itensOrigem,
    devolvidos: [{ line_item_id: "li_b", quantidade: 1 }],
    itensPedido, ufDestinatarioOriginal: "MG",
    identificador: "order_1:devolucao:homologacao:abc",
    ...over,
  } as Parameters<typeof montarPayloadDevolucao>[0])
}
```

Renomeação mecânica em **todo** o arquivo: `(payload as any).itens` → `(payload as any).Produtos`; `p.itens` → `p.Produtos`; `.codigo` → `.CodProdutoServico`; `.quantidade` (de item do payload) → `.Quantidade`; `.cfop).toBe("1202")` → `.CFOP).toBe(1202)` e `"2202"` → `2202` (CFOP agora é número).

Substitua estes testes pelo texto abaixo (os demais — travas e quantidade acumulada — ficam como estão, só com a renomeação mecânica):

```typescript
  it("é devolução (Finalidade 4); o tipo entrada NÃO é enviado — a API deriva do CFOP 1xxx/2xxx", () => {
    const { payload } = chamar()
    const p = payload as any
    expect(p.Finalidade).toBe(4)
    expect(p.ModeloDocumento).toBe(55)
    expect(p.TipoAmbiente).toBe(2)
    expect(p.NaturezaOperacao).toBe("DEVOLUCAO DE VENDA")
    expect(p.ConsumidorFinal).toBe(false)
    expect(p.IndicadorPresenca).toBe(0)
    expect(p.IdentificadorInterno).toBe("order_1:devolucao:homologacao:abc")
    expect(p).not.toHaveProperty("tipo_nf")
    expect(p).not.toHaveProperty("Serie")
    expect(p).not.toHaveProperty("Numero")
    expect(p).not.toHaveProperty("Intermediador")
  })

  it("referencia a nota de origem ITEM A ITEM: chave + nItem no próprio produto (VC02-14, VC03-20)", () => {
    const { payload } = chamar()
    const prod = (payload as any).Produtos[0]
    expect(prod.ChaveAcessoReferenciada).toBe(CHAVE)
    expect(prod.NItemReferenciado).toBe(2) // li_b foi autorizado como nItem 2 na venda
  })

  it("NUNCA envia NFReferencia na raiz — é o refNFe genérico que a VC02-14 proíbe", () => {
    expect(chamar().payload).not.toHaveProperty("NFReferencia")
  })

  it("respeita a quantidade devolvida, não a vendida; ValorTotal é o BRUTO", () => {
    const { payload } = chamar() // 1 de 2 leggings a 249.00
    const prod = (payload as any).Produtos[0]
    expect(prod.Quantidade).toBe(1)
    expect(prod.ValorUnitario).toBe(249)
    expect(prod.ValorTotal).toBe(249)
    expect(prod.ValorDesconto).toBe(0)
  })

  it("a ÉCLAT é o Cliente da NFD, como contribuinte com IE (spec §11 risco 10 — decisão provisória)", () => {
    const c = (chamar().payload as any).Cliente
    expect(c.CpfCnpj).toBe("68673407000113")
    expect(c.IndicadorIe).toBe(1)
    expect(c.Ie).toBe("56295050042")
    expect(c.Endereco.CodMunicipio).toBe("3106705")
    expect(c.Endereco.Uf).toBe("MG")
    expect(chamar().payload).not.toHaveProperty("emitente")
  })

  it("normaliza a UF do Cliente (config.uf cru com espaço/minúscula)", () => {
    const { payload } = chamar({ config: { ...config, uf: " mg " } })
    expect((payload as any).Cliente.Endereco.Uf).toBe("MG")
  })

  it("sem pagamento (90, valor 0) e sem transporte (9)", () => {
    const p = chamar().payload as any
    expect(p.Pagamentos).toEqual([{ IndicadorPagamento: 0, FormaPagamento: "90", VlPago: 0 }])
    expect(p.Transporte).toEqual({ ModalidadeFrete: 9 })
  })

  it("CSOSN vai em Imposto.ICMS; perfil com CSOSN não suportado é recusado", () => {
    expect((chamar().payload as any).Produtos[0].Imposto.ICMS.CodSituacaoTributaria).toBe("102")
    expect(() => chamar({ perfis: [{ ...perfilPadrao, csosn: "201" }] })).toThrow(ErroFiscal)
  })
```

Os seis testes antigos que estes substituem: "é nota de ENTRADA com finalidade 4", "referencia a nota de origem item a item", "respeita a quantidade devolvida", "a ÉCLAT é emitente E destinatária", "declara ind_ie_destinatario de contribuinte", "normaliza a UF do emitente/destinatário". Apague-os.

No bloco `describe("rateio do desconto na devolução")`, troque as asserções de valor:

```typescript
  // "devolução total de item com desconto estorna o desconto inteiro"
    const item = (payload as any).Produtos[0]
    expect(item.ValorDesconto).toBe(2)
    expect(item.ValorTotal).toBe(200)   // BRUTO: 10000 × 2 = 200.00; o desconto vai à parte

  // "devolução parcial (1 de 3, desconto de 100) estorna 33"
    const item = (payload as any).Produtos[0]
    expect(item.ValorDesconto).toBe(0.33)
    expect(item.ValorTotal).toBe(80)    // BRUTO de 1 unidade
    expect(itens_documento[0].desconto_centavos).toBe(33)
```

Nos testes "2 de 3 estorna 67" e "item sem desconto", aplique a mesma regra: `valor_desconto "0.67"` → `ValorDesconto 0.67`; qualquer `valor_total` → `ValorTotal` com o **bruto** (unitário × quantidade devolvida), em número.

**Apague** o teste "o total da nota fecha com a soma das linhas": o contrato real não tem bloco de totais (a API calcula). O que ele protegia — consistência entre linha e total — deixou de ser responsabilidade nossa.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/backend && TEST_TYPE=unit NODE_OPTIONS=--experimental-vm-modules npx jest src/lib/fiscal/__tests__/fiscal-payload-devolucao.unit.spec.ts --runInBand --forceExit`
Expected: FAIL nos testes de formato (`Produtos` indefinido). Os de trava (que só esperam `toThrow`) continuam passando — é o sinal de que a lógica não foi tocada.

- [ ] **Step 3: Update the implementation**

Em `fiscal-payload-devolucao.ts`:

1. No cabeçalho de comentário, troque "no grupo DFeReferenciado, com chave de acesso + nItem" por: "pelos campos `ChaveAcessoReferenciada` + `NItemReferenciado` DE CADA PRODUTO — a API monta com eles o grupo DFeReferenciado. `NFReferencia` (raiz) é o refNFe genérico que a VC02-14 proíbe, e os dois não podem coexistir."

2. Imports — remova a função local `reais` inteira e acrescente:

```typescript
import { numeroReais } from "./fiscal-dinheiro"
import { cfopNumerico, impostoDoPerfil, tipoAmbiente } from "./fiscal-payload"
```

3. Acrescente `identificador: string` ao tipo de `args` e à desestruturação.

4. Apague as variáveis `totalProdutosCentavos` e `totalDescontoCentavos` e as duas linhas que as incrementam. Apague também `totalItemCentavos`.

5. Substitua o `return { numero_item: ... }` do `devolvidos.map` por:

```typescript
    const produto: Record<string, unknown> = {
      NmProduto: doPedido.titulo,
      CodProdutoServico: codigoEnviado,
      NCM: origem.ncm,
      CFOP: cfopNumerico(
        interestadual ? perfil.cfop_devolucao_fora_uf : perfil.cfop_devolucao_dentro_uf,
        doPedido.titulo
      ),
      UnidadeComercial: "UN",
      UnidadeComercialTributavel: "UN",
      Quantidade: dev.quantidade,
      QuantidadeTributavel: dev.quantidade,
      ValorUnitario: numeroReais(origem.valor_unitario_centavos),
      ValorUnitarioTributavel: numeroReais(origem.valor_unitario_centavos),
      ValorTotal: numeroReais(origem.valor_unitario_centavos * dev.quantidade), // BRUTO
      ValorDesconto: numeroReais(descontoAEstornar),
      OrigemProduto: doPedido.origem ?? perfil.origem_padrao,
      Imposto: impostoDoPerfil(perfil, doPedido.titulo),
      // VC02-14 / VC03-20: referência item a item — chave + nItem DA NOTA DE VENDA.
      ChaveAcessoReferenciada: documentoOrigem.chave_acesso as string,
      NItemReferenciado: origem.n_item_verificado,
    }
    if (perfil.cest) produto.CEST = perfil.cest
    return produto
```

6. Apague `enderecoEclat` e substitua o objeto `payload` inteiro por:

```typescript
  const payload: Record<string, unknown> = {
    ModeloDocumento: 55,
    Finalidade: 4, // devolução. O tipo (entrada) a API deriva do CFOP 1xxx/2xxx.
    TipoAmbiente: tipoAmbiente(config.ambiente),
    NaturezaOperacao: "DEVOLUCAO DE VENDA",
    ConsumidorFinal: false,
    IndicadorPresenca: 0,
    EnviarEmail: false,
    IdentificadorInterno: identificador,
    // Spec §11 risco 10 — decisão PROVISÓRIA, a confirmar em homologação: a contraparte da NFD é
    // a própria ÉCLAT, contribuinte com IE (o CCC registra "IE como destinatário: Obrigatória").
    // Se a homologação rejeitar (VC02-50), é ESTE bloco — e só ele — que muda.
    Cliente: {
      CpfCnpj: config.cnpj,
      NmCliente: config.razao_social,
      IndicadorIe: 1,
      Ie: config.ie,
      Endereco: {
        Cep: config.cep,
        Logradouro: config.logradouro,
        Numero: config.numero,
        Complemento: config.complemento,
        Bairro: config.bairro,
        CodMunicipio: config.municipio_ibge,
        Municipio: config.municipio,
        Uf: ufEmitente,
        CodPais: 1058,
        Pais: "BRASIL",
      },
    },
    Produtos: linhas,
    Pagamentos: [{ IndicadorPagamento: 0, FormaPagamento: "90", VlPago: 0 }],
    Transporte: { ModalidadeFrete: 9 },
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: o mesmo comando do Step 2.
Expected: PASS. Confira que nenhum teste de trava foi apagado: `grep -c "toThrow" src/lib/fiscal/__tests__/fiscal-payload-devolucao.unit.spec.ts` deve dar **no mínimo** o mesmo número de antes (rode o grep antes de editar e anote).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/lib/fiscal/fiscal-payload-devolucao.ts apps/backend/src/lib/fiscal/__tests__/fiscal-payload-devolucao.unit.spec.ts
git commit -m "feat(fiscal): payload da NFD no contrato real — referência por produto

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Cliente HTTP — endpoints reais e interpretação da resposta

**Files:**
- Rewrite: `apps/backend/src/lib/fiscal/fiscal-client.ts`
- Rewrite: `apps/backend/src/lib/fiscal/__tests__/fiscal-client.unit.spec.ts`

**Interfaces:**
- Produces:

```typescript
export function brasilNfeConfigured(): boolean

export type Desfecho = "autorizado" | "rejeitado" | "denegado" | "indefinido"
export type ResultadoTransmissao = {
  desfecho: Desfecho
  chave_acesso: string | null
  numero: number | null
  serie: number | null
  codigo_sefaz: string | null
  motivo: string | null
  xml: string | null                 // Base64Xml decodificado (UTF-8)
  ambiente_divergente: boolean
  bruto: Record<string, unknown>     // a resposta SEM Base64Xml e SEM Base64File
}
export function interpretarResposta(bruto: Record<string, any>, ambienteEsperado: 1 | 2): ResultadoTransmissao
export async function transmitir(payload: Record<string, unknown>): Promise<ResultadoTransmissao>
export async function previsualizar(payload: Record<string, unknown>): Promise<{ xml: string }>
export type NotaLocalizada = { chave_acesso: string; status: 1 | 2 | 3; numero: number | null; serie: number | null }
export async function localizarPorIdentificador(args: { identificador: string; ambiente: 1 | 2; desde: string }): Promise<NotaLocalizada | null>
export async function baixarArquivo(chave: string, tipo: "xml" | "danfe"): Promise<Buffer>
```

Saem do arquivo: `RespostaTransmissao`, `consultarPorChave`, `baixarXml`. As Tasks 6 e 7 migram os chamadores.

**O bug que esta tarefa mata (spec §14):** a versão atual lê `bruto.status` como palavra e `bruto.chave` na raiz. A resposta real aninha tudo em `ReturnNF` e o veredito é o booleano `Ok`. Contra a API real, **toda nota autorizada seria gravada como rejeitada** — e a nova tentativa emitiria uma segunda nota válida. A tabela de interpretação está na spec §7.2 item 9; cada linha dela é um teste aqui.

**Regra de erro HTTP:**
- `4xx` (exceto 408) → o fornecedor **recusou antes de transmitir**. Se o corpo é JSON, interpreta; senão devolve desfecho `rejeitado` com `codigo_sefaz: "HTTP_<status>"`. Não lança.
- `5xx`, `408`, timeout, falha de rede → **lança `Error` comum** (não `ErroFiscal`): não sabemos se a nota saiu. Quem chama mantém o documento em `transmitido_sem_confirmacao`.
- Para `previsualizar`, `localizarPorIdentificador` e `baixarArquivo` (não transmitem nada): `4xx` → `ErroFiscal`; `5xx` → `Error`.

- [ ] **Step 1: Write the failing tests**

Substitua **todo** o conteúdo de `fiscal-client.unit.spec.ts`:

```typescript
// Formato das respostas: SDK oficial brasilnfe@3.1.3 — NotaFiscalRetorno, BuscarNotaFiscalRetorno,
// PreVisualizarNotaFiscalRetorno; ObterArquivoNotaFiscal devolve uma string JSON em base64.

import { interpretarResposta } from "../fiscal-client"
import { ErroFiscal } from "../tipos"

const CHAVE = "31260968673407000113550010000000011000000017"
const XML = `<nfeProc><NFe><infNFe Id="NFe${CHAVE}"><det nItem="1"><prod><cProd>TOP-P</cProd><NCM>61091000</NCM></prod></det></infNFe></NFe></nfeProc>`
const XML_B64 = Buffer.from(XML, "utf8").toString("base64")

function autorizada(over: Record<string, unknown> = {}) {
  return {
    ReturnNF: {
      Numero: 7, Serie: 1, ChaveNF: CHAVE, NumeroProtocolo: "131260000000001",
      CodTipoAmbiente: 2, DsTipoAmbiente: "Homologação",
      CodStatusRespostaSefaz: 100, DsStatusRespostaSefaz: "Autorizado o uso da NF-e", Ok: true,
      ...over,
    },
    Base64Xml: XML_B64,
    Base64File: "JVBERi0xLjQK",
  }
}

describe("interpretarResposta", () => {
  it("Ok + 100 é autorizado, com chave, número, série e XML decodificado", () => {
    const r = interpretarResposta(autorizada(), 2)
    expect(r.desfecho).toBe("autorizado")
    expect(r.chave_acesso).toBe(CHAVE)
    expect(r.numero).toBe(7)
    expect(r.serie).toBe(1)
    expect(r.codigo_sefaz).toBe("100")
    expect(r.xml).toBe(XML)
    expect(r.ambiente_divergente).toBe(false)
  })

  it("150 (autorizado fora do prazo) também é autorizado", () => {
    expect(interpretarResposta(autorizada({ CodStatusRespostaSefaz: 150 }), 2).desfecho).toBe("autorizado")
  })

  it("rejeição da SEFAZ: Ok false + código de rejeição", () => {
    const r = interpretarResposta(
      { ReturnNF: { Ok: false, CodStatusRespostaSefaz: 225, DsStatusRespostaSefaz: "Falha no Schema XML" } }, 2
    )
    expect(r.desfecho).toBe("rejeitado")
    expect(r.codigo_sefaz).toBe("225")
    expect(r.motivo).toBe("Falha no Schema XML")
    expect(r.chave_acesso).toBeNull()
  })

  it("códigos de denegação viram denegado", () => {
    for (const cod of [110, 301, 302, 303]) {
      const r = interpretarResposta({ ReturnNF: { Ok: false, CodStatusRespostaSefaz: cod, DsStatusRespostaSefaz: "Uso denegado" } }, 2)
      expect(r.desfecho).toBe("denegado")
    }
  })

  it("erro de validação do fornecedor (sem ReturnNF, com Error) é rejeitado — não chegou à SEFAZ", () => {
    const r = interpretarResposta({ Error: "NCM inválido no item 1" }, 2)
    expect(r.desfecho).toBe("rejeitado")
    expect(r.motivo).toBe("NCM inválido no item 1")
    expect(r.codigo_sefaz).toBeNull()
  })

  it("INCOERÊNCIA nunca é adivinhada: Ok true com código de rejeição é indefinido", () => {
    expect(interpretarResposta(autorizada({ CodStatusRespostaSefaz: 225 }), 2).desfecho).toBe("indefinido")
  })

  it("INCOERÊNCIA: Ok false com código 100 é indefinido", () => {
    expect(interpretarResposta(autorizada({ Ok: false }), 2).desfecho).toBe("indefinido")
  })

  it("autorizado sem chave de 44 dígitos é indefinido", () => {
    expect(interpretarResposta(autorizada({ ChaveNF: "123" }), 2).desfecho).toBe("indefinido")
  })

  it("resposta vazia ou sem ReturnNF e sem Error é indefinido", () => {
    expect(interpretarResposta({}, 2).desfecho).toBe("indefinido")
    expect(interpretarResposta({ Avisos: ["x"] }, 2).desfecho).toBe("indefinido")
  })

  it("O BUG DA REVISÃO 1: o formato antigo (status na raiz) NÃO é reconhecido como autorizado", () => {
    const r = interpretarResposta({ status: "autorizado", chave: CHAVE, numero: 1 }, 2)
    expect(r.desfecho).toBe("indefinido")
  })

  it("sinaliza ambiente divergente: esperávamos homologação (2), veio produção (1)", () => {
    const r = interpretarResposta(autorizada({ CodTipoAmbiente: 1 }), 2)
    expect(r.desfecho).toBe("autorizado")
    expect(r.ambiente_divergente).toBe(true)
  })

  it("o bruto guardado NÃO carrega os base64 (XML tem coluna própria; PDF é reobtido)", () => {
    const r = interpretarResposta(autorizada(), 2)
    expect(r.bruto).not.toHaveProperty("Base64Xml")
    expect(r.bruto).not.toHaveProperty("Base64File")
    expect((r.bruto as any).ReturnNF.ChaveNF).toBe(CHAVE)
  })
})

describe("fiscal-client — HTTP", () => {
  const OLD = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...OLD, BRASILNFE_USER_TOKEN: "user-token", BRASILNFE_COMPANY_TOKEN: "company-token" }
    delete process.env.BRASILNFE_BASE_URL
  })

  afterEach(() => {
    process.env = OLD
    jest.restoreAllMocks()
  })

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status })
  }

  it("transmite em POST /services/fiscal/EnviarNotaFiscal com os dois headers", async () => {
    const spy = jest.fn().mockResolvedValueOnce(json(autorizada()))
    global.fetch = spy as unknown as typeof fetch
    const { transmitir } = await import("../fiscal-client.js")
    const r = await transmitir({ TipoAmbiente: 2, ModeloDocumento: 55 })

    expect(spy.mock.calls[0][0]).toBe("https://api.brasilnfe.com.br/services/fiscal/EnviarNotaFiscal")
    const init = spy.mock.calls[0][1]
    expect(init.method).toBe("POST")
    expect(init.headers.UserToken).toBe("user-token")
    expect(init.headers.Token).toBe("company-token")
    expect(JSON.parse(init.body)).toEqual({ TipoAmbiente: 2, ModeloDocumento: 55 })
    expect(r.desfecho).toBe("autorizado")
  })

  it("usa o TipoAmbiente do PAYLOAD como ambiente esperado", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(json(autorizada({ CodTipoAmbiente: 2 }))) as unknown as typeof fetch
    const { transmitir } = await import("../fiscal-client.js")
    const r = await transmitir({ TipoAmbiente: 1 })
    expect(r.ambiente_divergente).toBe(true)
  })

  it("4xx com corpo JSON é interpretado — recusa do fornecedor vira rejeitado, não exceção", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(json({ Error: "CPF inválido" }, 400)) as unknown as typeof fetch
    const { transmitir } = await import("../fiscal-client.js")
    const r = await transmitir({ TipoAmbiente: 2 })
    expect(r.desfecho).toBe("rejeitado")
    expect(r.motivo).toBe("CPF inválido")
  })

  it("4xx sem JSON vira rejeitado com código HTTP", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(new Response("Unauthorized", { status: 401 })) as unknown as typeof fetch
    const { transmitir } = await import("../fiscal-client.js")
    const r = await transmitir({ TipoAmbiente: 2 })
    expect(r.desfecho).toBe("rejeitado")
    expect(r.codigo_sefaz).toBe("HTTP_401")
  })

  it("5xx LANÇA Error comum (não ErroFiscal): não sabemos se a nota saiu", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(new Response("erro interno", { status: 502 })) as unknown as typeof fetch
    const { transmitir } = await import("../fiscal-client.js")
    const erro = await transmitir({ TipoAmbiente: 2 }).catch((e) => e)
    expect(erro).toBeInstanceOf(Error)
    expect(erro).not.toBeInstanceOf(ErroFiscal)
  })

  it("408 também lança: timeout do lado deles é tão ambíguo quanto o nosso", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(new Response("timeout", { status: 408 })) as unknown as typeof fetch
    const { transmitir } = await import("../fiscal-client.js")
    await expect(transmitir({ TipoAmbiente: 2 })).rejects.toThrow()
  })

  it("falha de rede propaga como Error comum", async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new TypeError("fetch failed")) as unknown as typeof fetch
    const { transmitir } = await import("../fiscal-client.js")
    const erro = await transmitir({ TipoAmbiente: 2 }).catch((e) => e)
    expect(erro).not.toBeInstanceOf(ErroFiscal)
  })

  it("a transmissão usa timeout de 5 minutos (o mesmo do SDK oficial)", async () => {
    const timeoutSpy = jest.spyOn(AbortSignal, "timeout")
    global.fetch = jest.fn().mockResolvedValueOnce(json(autorizada())) as unknown as typeof fetch
    const { transmitir } = await import("../fiscal-client.js")
    await transmitir({ TipoAmbiente: 2 })
    expect(timeoutSpy).toHaveBeenCalledWith(300000)
  })

  it("redaciona o token LITERAL se o servidor o ecoar no corpo de erro", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(
      new Response("token company-token recusado", { status: 500 })
    ) as unknown as typeof fetch
    const { transmitir } = await import("../fiscal-client.js")
    const erro = (await transmitir({ TipoAmbiente: 2 }).catch((e) => e)) as Error
    expect(erro.message).toContain("***")
    expect(erro.message).not.toContain("company-token")
    expect(erro.message).not.toContain("user-token")
  })

  it("sem credenciais, recusa com ErroFiscal antes de qualquer rede", async () => {
    delete process.env.BRASILNFE_COMPANY_TOKEN
    const spy = jest.fn()
    global.fetch = spy as unknown as typeof fetch
    const { transmitir } = await import("../fiscal-client.js")
    await expect(transmitir({ TipoAmbiente: 2 })).rejects.toBeInstanceOf(ErroFiscal)
    expect(spy).not.toHaveBeenCalled()
  })

  it("previsualizar embrulha a nota no envelope de lote e devolve o XML decodificado", async () => {
    const spy = jest.fn().mockResolvedValueOnce(json({ Status: true, Base64File: XML_B64 }))
    global.fetch = spy as unknown as typeof fetch
    const { previsualizar } = await import("../fiscal-client.js")
    const r = await previsualizar({ TipoAmbiente: 2, ModeloDocumento: 55, Finalidade: 1 })

    expect(spy.mock.calls[0][0]).toBe("https://api.brasilnfe.com.br/services/fiscal/PreVisualizarNotaFiscal")
    expect(JSON.parse(spy.mock.calls[0][1].body)).toEqual({
      notaFiscal: { TipoAmbiente: 2, ModeloDocumento: 55, nFInfos: [{ TipoAmbiente: 2, ModeloDocumento: 55, Finalidade: 1 }] },
      TipoArquivo: 0,
      TipoEnvio: 1,
    })
    expect(r.xml).toBe(XML)
  })

  it("previsualizar com Status false é ErroFiscal com o motivo do fornecedor", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(json({ Status: false, Error: "CFOP inválido" })) as unknown as typeof fetch
    const { previsualizar } = await import("../fiscal-client.js")
    await expect(previsualizar({ TipoAmbiente: 2 })).rejects.toThrow(/CFOP inválido/)
  })

  it("localizarPorIdentificador acha a nota pelo IdentificadorInterno EXATO", async () => {
    const spy = jest.fn().mockResolvedValueOnce(json({
      Notas: [
        { Chave: "9".repeat(44), IdentificadorInterno: "order_1:venda:homologacao:r1", Status: 1, Numero: 8, Serie: "1" },
        { Chave: CHAVE, IdentificadorInterno: "order_1:venda:homologacao", Status: 1, Numero: 7, Serie: "1" },
      ],
    }))
    global.fetch = spy as unknown as typeof fetch
    const { localizarPorIdentificador } = await import("../fiscal-client.js")
    const r = await localizarPorIdentificador({
      identificador: "order_1:venda:homologacao", ambiente: 2, desde: "2026-09-17T10:00:00Z",
    })

    expect(spy.mock.calls[0][0]).toBe("https://api.brasilnfe.com.br/services/fiscal/ObterNotasFiscais")
    const body = JSON.parse(spy.mock.calls[0][1].body)
    expect(body.TipoAmbiente).toBe(2)
    expect(body.TipoDocumentoFiscal).toBe(1)
    expect(body.IdentificadorInterno).toBe("order_1:venda:homologacao")
    expect(r).toEqual({ chave_acesso: CHAVE, status: 1, numero: 7, serie: 1 })
  })

  it("localizarPorIdentificador devolve null quando não há nota", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(json({ Notas: [] })) as unknown as typeof fetch
    const { localizarPorIdentificador } = await import("../fiscal-client.js")
    expect(await localizarPorIdentificador({ identificador: "x", ambiente: 2, desde: "2026-09-17T10:00:00Z" })).toBeNull()
  })

  it("baixarArquivo pede XML (1) ou DANFE (2) e decodifica o base64 do corpo JSON", async () => {
    const spy = jest.fn()
      .mockResolvedValueOnce(json(XML_B64))
      .mockResolvedValueOnce(json("JVBERi0xLjQK"))
    global.fetch = spy as unknown as typeof fetch
    const { baixarArquivo } = await import("../fiscal-client.js")

    const xml = await baixarArquivo(CHAVE, "xml")
    expect(xml.toString("utf8")).toBe(XML)
    expect(spy.mock.calls[0][0]).toBe("https://api.brasilnfe.com.br/services/fiscal/ObterArquivoNotaFiscal")
    expect(JSON.parse(spy.mock.calls[0][1].body)).toEqual({ ChaveNF: CHAVE, FileType: 1, TipoDocumentoFiscal: 1 })

    const pdf = await baixarArquivo(CHAVE, "danfe")
    expect(pdf.subarray(0, 4).toString("latin1")).toBe("%PDF")
    expect(JSON.parse(spy.mock.calls[1][1].body).FileType).toBe(2)
  })

  it("baixarArquivo com corpo vazio é ErroFiscal", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(json("")) as unknown as typeof fetch
    const { baixarArquivo } = await import("../fiscal-client.js")
    await expect(baixarArquivo(CHAVE, "xml")).rejects.toBeInstanceOf(ErroFiscal)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/backend && TEST_TYPE=unit NODE_OPTIONS=--experimental-vm-modules npx jest src/lib/fiscal/__tests__/fiscal-client.unit.spec.ts --runInBand --forceExit`
Expected: FAIL — `interpretarResposta` não exportado.

- [ ] **Step 3: Write the implementation**

Substitua **todo** o conteúdo de `fiscal-client.ts`:

```typescript
// HTTP da Brasil NFe — contrato real (spec §7.0). Fonte: documentação pública + tipos do SDK
// oficial brasilnfe@3.1.3. O SDK NÃO é dependência: precisamos de controle sobre timeout,
// redação de segredo e classificação de erro.
//
// Autenticação por dois headers:  UserToken (usuário) · Token (empresa).
// Os valores vivem só no .env. Nunca são logados nem incluídos em mensagem de erro.

import { ErroFiscal } from "./tipos"

const BASE = process.env.BRASILNFE_BASE_URL || "https://api.brasilnfe.com.br"
const USER_TOKEN = process.env.BRASILNFE_USER_TOKEN
const COMPANY_TOKEN = process.env.BRASILNFE_COMPANY_TOKEN

// O SDK oficial usa 5 minutos: a rota é síncrona e espera a SEFAZ.
const TIMEOUT_TRANSMISSAO_MS = 300000
const TIMEOUT_CONSULTA_MS = 60000

const AUTORIZADO = new Set([100, 150])
const DENEGADO = new Set([110, 301, 302, 303])

export function brasilNfeConfigured(): boolean {
  return Boolean(USER_TOKEN && COMPANY_TOKEN)
}

export type Desfecho = "autorizado" | "rejeitado" | "denegado" | "indefinido"

export type ResultadoTransmissao = {
  desfecho: Desfecho
  chave_acesso: string | null
  numero: number | null
  serie: number | null
  codigo_sefaz: string | null
  motivo: string | null
  xml: string | null
  ambiente_divergente: boolean
  bruto: Record<string, unknown>
}

export type NotaLocalizada = {
  chave_acesso: string
  status: 1 | 2 | 3
  numero: number | null
  serie: number | null
}

function redacionar(texto: string): string {
  // split/join: substituição literal, sem regex (um segredo com metacaractere quebraria a regex).
  let t = texto
  if (USER_TOKEN) t = t.split(USER_TOKEN).join("***")
  if (COMPANY_TOKEN) t = t.split(COMPANY_TOKEN).join("***")
  return t
}

function numeroOuNull(v: unknown): number | null {
  if (v == null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// Interpreta a resposta de EnviarNotaFiscal (spec §7.2 item 9). PURA.
// Regra de ouro: nenhuma combinação é adivinhada. O que não fecha vira "indefinido", e quem
// chama mantém o documento em transmitido_sem_confirmacao.
export function interpretarResposta(
  bruto: Record<string, any>,
  ambienteEsperado: 1 | 2
): ResultadoTransmissao {
  const { Base64Xml, Base64File, ...resto } = bruto ?? {}
  const ret = bruto?.ReturnNF as Record<string, any> | undefined

  const base: ResultadoTransmissao = {
    desfecho: "indefinido",
    chave_acesso: null,
    numero: numeroOuNull(ret?.Numero),
    serie: numeroOuNull(ret?.Serie),
    codigo_sefaz: ret?.CodStatusRespostaSefaz != null ? String(ret.CodStatusRespostaSefaz) : null,
    motivo: ret?.DsStatusRespostaSefaz ?? bruto?.Error ?? null,
    xml: null,
    ambiente_divergente:
      ret?.CodTipoAmbiente != null && Number(ret.CodTipoAmbiente) !== ambienteEsperado,
    bruto: resto,
  }

  if (!ret) {
    // Sem ReturnNF: só é conclusivo se o fornecedor disse por quê (validação, não chegou à SEFAZ).
    return typeof bruto?.Error === "string" && bruto.Error.trim()
      ? { ...base, desfecho: "rejeitado" }
      : base
  }

  const cod = Number(ret.CodStatusRespostaSefaz)
  const ok = ret.Ok === true

  if (ok && AUTORIZADO.has(cod)) {
    const chave = String(ret.ChaveNF ?? "")
    if (!/^\d{44}$/.test(chave)) return base
    return {
      ...base,
      desfecho: "autorizado",
      chave_acesso: chave,
      motivo: null,
      xml: typeof Base64Xml === "string" && Base64Xml ? Buffer.from(Base64Xml, "base64").toString("utf8") : null,
    }
  }
  if (!ok && DENEGADO.has(cod)) return { ...base, desfecho: "denegado" }
  // Ok e código precisam concordar: Ok true com código de rejeição, ou Ok false com 100/150,
  // são incoerentes — não se adivinha qual dos dois está certo.
  if (!ok && Number.isFinite(cod) && !AUTORIZADO.has(cod)) return { ...base, desfecho: "rejeitado" }
  return base
}

async function post(
  metodo: string,
  corpo: unknown,
  timeoutMs: number
): Promise<{ status: number; texto: string }> {
  if (!brasilNfeConfigured()) {
    throw new ErroFiscal(
      "Credenciais da Brasil NFe ausentes. Defina BRASILNFE_USER_TOKEN e BRASILNFE_COMPANY_TOKEN no .env."
    )
  }
  const res = await fetch(`${BASE}/services/fiscal/${metodo}`, {
    method: "POST",
    headers: {
      UserToken: USER_TOKEN as string,
      Token: COMPANY_TOKEN as string,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(timeoutMs),
  })
  return { status: res.status, texto: await res.text() }
}

function parseJson(texto: string): unknown {
  try {
    return texto ? JSON.parse(texto) : {}
  } catch {
    return undefined
  }
}

// Para chamadas que NÃO transmitem nota: 4xx é recusa (ErroFiscal), 5xx é infra (Error).
async function consultar<T>(metodo: string, corpo: unknown): Promise<T> {
  const { status, texto } = await post(metodo, corpo, TIMEOUT_CONSULTA_MS)
  if (status >= 200 && status < 300) {
    const dados = parseJson(texto)
    if (dados === undefined) throw new Error(`Brasil NFe ${metodo}: resposta não é JSON.`)
    return dados as T
  }
  const mensagem = `Brasil NFe ${metodo}: ${status} ${redacionar(texto)}`
  if (status >= 400 && status < 500 && status !== 408) throw new ErroFiscal(mensagem)
  throw new Error(mensagem)
}

export async function transmitir(payload: Record<string, unknown>): Promise<ResultadoTransmissao> {
  const esperado: 1 | 2 = payload.TipoAmbiente === 1 ? 1 : 2
  const { status, texto } = await post("EnviarNotaFiscal", payload, TIMEOUT_TRANSMISSAO_MS)

  if (status >= 200 && status < 300) {
    const dados = parseJson(texto)
    return interpretarResposta((dados ?? {}) as Record<string, any>, esperado)
  }

  // 4xx (menos 408): o fornecedor recusou ANTES de transmitir — desfecho conclusivo.
  if (status >= 400 && status < 500 && status !== 408) {
    const dados = parseJson(texto)
    if (dados && typeof dados === "object" && ("ReturnNF" in dados || "Error" in dados)) {
      return interpretarResposta(dados as Record<string, any>, esperado)
    }
    return {
      desfecho: "rejeitado", chave_acesso: null, numero: null, serie: null,
      codigo_sefaz: `HTTP_${status}`, motivo: redacionar(texto).slice(0, 500),
      xml: null, ambiente_divergente: false, bruto: { http_status: status },
    }
  }

  // 5xx / 408: não sabemos se a nota saiu. Error comum — quem chama mantém o documento pendente.
  throw new Error(`Brasil NFe EnviarNotaFiscal: ${status} ${redacionar(texto)}`)
}

// Gera o XML sem transmitir à SEFAZ e sem consumir numeração. O endpoint espera a nota dentro
// de um envelope de lote (NotaFiscalLoteEnvio), mesmo sendo uma só.
export async function previsualizar(payload: Record<string, unknown>): Promise<{ xml: string }> {
  const r = await consultar<{ Status?: boolean; Base64File?: string; Error?: string }>(
    "PreVisualizarNotaFiscal",
    {
      notaFiscal: {
        TipoAmbiente: payload.TipoAmbiente,
        ModeloDocumento: payload.ModeloDocumento,
        nFInfos: [payload],
      },
      TipoArquivo: 0,
      TipoEnvio: 1,
    }
  )
  if (!r.Status || !r.Base64File) {
    throw new ErroFiscal(`A Brasil NFe recusou a pré-visualização: ${r.Error || "sem motivo informado"}`)
  }
  return { xml: Buffer.from(r.Base64File, "base64").toString("utf8") }
}

// Localiza uma nota pelo IdentificadorInterno (a nossa idempotency_key) — é assim que uma
// transmissão sem resposta se resolve sem reemitir (spec §7.3).
export async function localizarPorIdentificador(args: {
  identificador: string
  ambiente: 1 | 2
  desde: string
}): Promise<NotaLocalizada | null> {
  const inicio = new Date(new Date(args.desde).getTime() - 24 * 60 * 60 * 1000)
  const fim = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const r = await consultar<{ Notas?: Array<Record<string, any>> }>("ObterNotasFiscais", {
    TipoAmbiente: args.ambiente,
    TipoDocumentoFiscal: 1,
    DtInicio: inicio.toISOString(),
    DtFim: fim.toISOString(),
    IdentificadorInterno: args.identificador,
  })
  // Casamento EXATO: "pedido:venda:hom" não pode casar com "pedido:venda:hom:r1".
  const nota = (r.Notas ?? []).find(
    (n) => n.IdentificadorInterno === args.identificador && /^\d{44}$/.test(String(n.Chave ?? ""))
  )
  if (!nota) return null
  const status = Number(nota.Status)
  if (status !== 1 && status !== 2 && status !== 3) return null
  return {
    chave_acesso: String(nota.Chave),
    status,
    numero: numeroOuNull(nota.Numero),
    serie: numeroOuNull(nota.Serie),
  }
}

// O corpo da resposta é uma STRING JSON com o arquivo em base64 (é assim que o SDK oficial lê).
export async function baixarArquivo(chave: string, tipo: "xml" | "danfe"): Promise<Buffer> {
  const b64 = await consultar<unknown>("ObterArquivoNotaFiscal", {
    ChaveNF: chave,
    FileType: tipo === "xml" ? 1 : 2,
    TipoDocumentoFiscal: 1,
  })
  if (typeof b64 !== "string" || !b64) {
    throw new ErroFiscal(
      `A Brasil NFe não devolveu o arquivo da nota ${chave}. Confira se a chave pertence à empresa do token.`
    )
  }
  return Buffer.from(b64, "base64")
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: o mesmo comando do Step 2.
Expected: PASS — 28 testes. Tempo total na casa de poucos segundos; se algum teste individual passar de ~100 ms, ele está tocando a rede.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/lib/fiscal/fiscal-client.ts apps/backend/src/lib/fiscal/__tests__/fiscal-client.unit.spec.ts
git commit -m "fix(fiscal): cliente HTTP no contrato real — ReturnNF.Ok, endpoints /services/fiscal

A versão anterior lia status/chave na raiz da resposta; contra a API real toda
nota autorizada seria gravada como rejeitada.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Reconciliação com XML em mãos e localização no fornecedor

**Files:**
- Modify: `apps/backend/src/lib/fiscal/fiscal-reconciliar.ts`
- Modify: `apps/backend/src/lib/fiscal/__tests__/fiscal-reconciliar.unit.spec.ts`
- Modify: `apps/backend/src/jobs/fiscal-reconciliar.ts` (só o comentário)

**Interfaces:**
- Consumes (Task 5): `baixarArquivo(chave, "xml"): Promise<Buffer>`, `localizarPorIdentificador({identificador, ambiente, desde}): Promise<NotaLocalizada | null>`; (Task 3) `tipoAmbiente(a): 1 | 2`.
- Produces:
  - `reconciliarDocumento(documentoId: string, xmlEmMaos?: string): Promise<{ verificado: boolean; divergencias: string[] }>`
  - `localizarNoFornecedor(doc: FiscalDocumento): Promise<FiscalDocumento | null>` — se o fornecedor tem nota **autorizada** com o `IdentificadorInterno` = `doc.idempotency_key`, grava chave/número/série, põe o documento em `autorizado_nao_verificado` e devolve o documento atualizado. Denegada → grava `denegado` e devolve `null`. Não achou → `null`, **sem alterar nada**.
  - `reconciliarPendentes(limite?)` — inalterada na assinatura.

**De onde vem o XML, em ordem:** (1) `xmlEmMaos` — a emissão síncrona passa o `Base64Xml` decodificado; (2) `doc.xml_autorizado` — já gravado; (3) download por `baixarArquivo`. Quando o XML veio de download, ele é **gravado** em `xml_autorizado` junto com a verificação: o XML é o documento legal e precisa ficar conosco.

**Princípio que não pode ser violado:** `localizarNoFornecedor` nunca conclui que uma nota "não foi emitida". Ausência na consulta não é prova — a nota pode ainda não estar indexada. Só a rota manual `resolver` declara isso.

- [ ] **Step 1: Update existing tests (mecânico)**

Em `fiscal-reconciliar.unit.spec.ts`, em **todos** os `jest.doMock("../fiscal-client", ...)`:

- `baixarXml: jest.fn().mockResolvedValue(X)` → `baixarArquivo: jest.fn().mockResolvedValue(Buffer.from(X, "utf8")), localizarPorIdentificador: jest.fn()`
- `baixarXml: jest.fn()` → `baixarArquivo: jest.fn(), localizarPorIdentificador: jest.fn()`

No `mockDb`, acrescente ao objeto devolvido por `lerDocumento` os campos que o código novo lê: `idempotency_key: "order_1:venda:homologacao", ambiente: "homologacao", created_at: "2026-09-17T10:00:00Z", xml_autorizado: null`.

- [ ] **Step 2: Write the new failing tests**

Acrescente ao final do arquivo:

```typescript
describe("reconciliarDocumento — origem do XML", () => {
  beforeEach(() => jest.resetModules())
  afterEach(() => jest.restoreAllMocks())

  it("com XML em mãos (emissão síncrona) NÃO faz download", async () => {
    const { atualizarNItem, atualizarDocumento } = mockDb()
    const baixarArquivo = jest.fn()
    jest.doMock("../fiscal-client", () => ({ baixarArquivo, localizarPorIdentificador: jest.fn() }))
    const { reconciliarDocumento } = await import("../fiscal-reconciliar.js")

    const r = await reconciliarDocumento("doc_1", XML_OK)

    expect(r.verificado).toBe(true)
    expect(baixarArquivo).not.toHaveBeenCalled()
    expect(atualizarNItem).toHaveBeenCalledTimes(2)
    // XML em mãos já foi gravado por quem emitiu — a reconciliação não o regrava.
    expect(atualizarDocumento.mock.calls[0][1]).not.toHaveProperty("xml_autorizado")
  })

  it("usa o xml_autorizado já gravado antes de pensar em baixar", async () => {
    mockDb({
      lerDocumento: jest.fn().mockResolvedValue({
        id: "doc_1", chave_acesso: CHAVE, status: "autorizado_nao_verificado", verificado_em: null,
        xml_autorizado: XML_OK,
      }),
    })
    const baixarArquivo = jest.fn()
    jest.doMock("../fiscal-client", () => ({ baixarArquivo, localizarPorIdentificador: jest.fn() }))
    const { reconciliarDocumento } = await import("../fiscal-reconciliar.js")

    expect((await reconciliarDocumento("doc_1")).verificado).toBe(true)
    expect(baixarArquivo).not.toHaveBeenCalled()
  })

  it("XML baixado é GRAVADO em xml_autorizado junto com a verificação", async () => {
    const { atualizarDocumento } = mockDb()
    jest.doMock("../fiscal-client", () => ({
      baixarArquivo: jest.fn().mockResolvedValue(Buffer.from(XML_OK, "utf8")),
      localizarPorIdentificador: jest.fn(),
    }))
    const { reconciliarDocumento } = await import("../fiscal-reconciliar.js")

    await reconciliarDocumento("doc_1")

    const patch = atualizarDocumento.mock.calls[0][1]
    expect(patch.status).toBe("verificado")
    expect(patch.xml_autorizado).toBe(XML_OK)
  })
})

describe("localizarNoFornecedor", () => {
  beforeEach(() => jest.resetModules())
  afterEach(() => jest.restoreAllMocks())

  const pendente = {
    id: "doc_1", chave_acesso: null, status: "transmitido_sem_confirmacao",
    idempotency_key: "order_1:venda:homologacao", ambiente: "homologacao",
    created_at: "2026-09-17T10:00:00Z",
  }

  it("achou autorizada: grava chave/número/série e vai para autorizado_nao_verificado", async () => {
    const { atualizarDocumento } = mockDb()
    const localizarPorIdentificador = jest.fn().mockResolvedValue({ chave_acesso: CHAVE, status: 1, numero: 7, serie: 1 })
    jest.doMock("../fiscal-client", () => ({ baixarArquivo: jest.fn(), localizarPorIdentificador }))
    const { localizarNoFornecedor } = await import("../fiscal-reconciliar.js")

    const doc = await localizarNoFornecedor(pendente as any)

    expect(localizarPorIdentificador).toHaveBeenCalledWith({
      identificador: "order_1:venda:homologacao", ambiente: 2, desde: "2026-09-17T10:00:00Z",
    })
    expect(atualizarDocumento).toHaveBeenCalledWith("doc_1", {
      status: "autorizado_nao_verificado", chave_acesso: CHAVE, numero: 7, serie: 1,
      rejeicao_codigo: null, rejeicao_motivo: null,
    })
    expect(doc?.chave_acesso).toBe(CHAVE)
  })

  it("NÃO achou: devolve null e não altera NADA — ausência não é prova de que não emitiu", async () => {
    const { atualizarDocumento } = mockDb()
    jest.doMock("../fiscal-client", () => ({
      baixarArquivo: jest.fn(), localizarPorIdentificador: jest.fn().mockResolvedValue(null),
    }))
    const { localizarNoFornecedor } = await import("../fiscal-reconciliar.js")

    expect(await localizarNoFornecedor(pendente as any)).toBeNull()
    expect(atualizarDocumento).not.toHaveBeenCalled()
  })

  it("achou denegada: grava denegado e devolve null", async () => {
    const { atualizarDocumento } = mockDb()
    jest.doMock("../fiscal-client", () => ({
      baixarArquivo: jest.fn(),
      localizarPorIdentificador: jest.fn().mockResolvedValue({ chave_acesso: CHAVE, status: 3, numero: 7, serie: 1 }),
    }))
    const { localizarNoFornecedor } = await import("../fiscal-reconciliar.js")

    expect(await localizarNoFornecedor(pendente as any)).toBeNull()
    expect(atualizarDocumento.mock.calls[0][1].status).toBe("denegado")
  })

  it("achou CANCELADA: não adota (a nota não vale mais) e não altera nada", async () => {
    const { atualizarDocumento } = mockDb()
    jest.doMock("../fiscal-client", () => ({
      baixarArquivo: jest.fn(),
      localizarPorIdentificador: jest.fn().mockResolvedValue({ chave_acesso: CHAVE, status: 2, numero: 7, serie: 1 }),
    }))
    const { localizarNoFornecedor } = await import("../fiscal-reconciliar.js")

    expect(await localizarNoFornecedor(pendente as any)).toBeNull()
    expect(atualizarDocumento).not.toHaveBeenCalled()
  })
})

describe("reconciliarPendentes — transmitido_sem_confirmacao sem chave", () => {
  beforeEach(() => jest.resetModules())
  afterEach(() => jest.restoreAllMocks())

  it("localiza no fornecedor e reconcilia, em vez de pular o documento", async () => {
    const semChave = {
      id: "doc_1", chave_acesso: null, status: "transmitido_sem_confirmacao",
      idempotency_key: "order_1:venda:homologacao", ambiente: "homologacao", created_at: "2026-09-17T10:00:00Z",
    }
    const { atualizarNItem } = mockDb({ listarPorStatus: jest.fn().mockResolvedValue([semChave]) })
    jest.doMock("../fiscal-client", () => ({
      baixarArquivo: jest.fn().mockResolvedValue(Buffer.from(XML_OK, "utf8")),
      localizarPorIdentificador: jest.fn().mockResolvedValue({ chave_acesso: CHAVE, status: 1, numero: 7, serie: 1 }),
    }))
    const { reconciliarPendentes } = await import("../fiscal-reconciliar.js")

    const r = await reconciliarPendentes()

    expect(r).toEqual({ processados: 1, verificados: 1 })
    expect(atualizarNItem).toHaveBeenCalledTimes(2)
  })

  it("não localizado: segue pendente, sem verificar e sem quebrar a varredura", async () => {
    const semChave = {
      id: "doc_1", chave_acesso: null, status: "transmitido_sem_confirmacao",
      idempotency_key: "k", ambiente: "homologacao", created_at: "2026-09-17T10:00:00Z",
    }
    const { atualizarDocumento } = mockDb({ listarPorStatus: jest.fn().mockResolvedValue([semChave]) })
    jest.doMock("../fiscal-client", () => ({
      baixarArquivo: jest.fn(), localizarPorIdentificador: jest.fn().mockResolvedValue(null),
    }))
    const { reconciliarPendentes } = await import("../fiscal-reconciliar.js")

    expect(await reconciliarPendentes()).toEqual({ processados: 1, verificados: 0 })
    expect(atualizarDocumento).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run tests to verify the new ones fail**

Run: `cd apps/backend && TEST_TYPE=unit NODE_OPTIONS=--experimental-vm-modules npx jest src/lib/fiscal/__tests__/fiscal-reconciliar.unit.spec.ts --runInBand --forceExit`
Expected: FAIL — `localizarNoFornecedor` não existe; `baixarXml` não é mais chamado.

- [ ] **Step 4: Update the implementation**

Em `fiscal-reconciliar.ts`:

1. Troque o parágrafo de cabeçalho "A Brasil NFe gera o nItem pela ordem em que enviamos os itens, mas não devolve o valor." por:

```typescript
// A Brasil NFe gera o nItem pela ordem em que enviamos os itens, mas não devolve o valor.
// A resposta síncrona de EnviarNotaFiscal já traz o XML autorizado (Base64Xml), então a emissão
// reconcilia NA HORA, passando o XML em mãos (spec §7.3). O download só acontece na varredura
// e na resolução manual.
```

2. Imports:

```typescript
import { atualizarDocumento, atualizarNItem, lerDocumento, listarItens, listarPorStatus } from "./fiscal-db"
import { baixarArquivo, localizarPorIdentificador } from "./fiscal-client"
import { tipoAmbiente } from "./fiscal-payload"
import { extrairChaveDoXml, extrairItensDoXml, type ItemXml } from "./fiscal-xml"
import { ErroFiscal, type FiscalDocumento, type FiscalDocumentoItem } from "./tipos"
```

3. Assinatura e obtenção do XML — substitua a linha `const xml = await baixarXml(doc.chave_acesso)` e a assinatura:

```typescript
export async function reconciliarDocumento(
  documentoId: string,
  xmlEmMaos?: string
): Promise<{ verificado: boolean; divergencias: string[] }> {
  const doc = await lerDocumento(documentoId)
  if (!doc.chave_acesso) {
    throw new ErroFiscal(
      `Documento ${documentoId} não tem chave de acesso — não há XML para reconciliar.`
    )
  }

  // Origem do XML, em ordem: em mãos (emissão síncrona) → já gravado → download.
  let xml = xmlEmMaos ?? doc.xml_autorizado ?? null
  let veioDeDownload = false
  if (!xml) {
    xml = (await baixarArquivo(doc.chave_acesso, "xml")).toString("utf8")
    veioDeDownload = true
  }
```

4. No final, a gravação passa a guardar o XML quando ele veio de download:

```typescript
  await atualizarDocumento(documentoId, {
    status: "verificado",
    verificado_em: new Date().toISOString(),
    // O XML é o documento legal: se veio de download, fica guardado conosco.
    ...(veioDeDownload ? { xml_autorizado: xml } : {}),
  })
```

Todo o miolo (contagem de itens, conferência da chave do XML, unicidade de `codigo_enviado`, casamento por código, divergências) fica **como está**.

5. Acrescente, antes de `reconciliarPendentes`:

```typescript
// Procura no fornecedor uma nota emitida com o IdentificadorInterno deste documento (é a nossa
// idempotency_key, enviada no payload). Serve à varredura e à barreira de duplicidade da emissão.
//
// NUNCA conclui que a nota "não foi emitida": ausência na consulta não é prova (a nota pode não
// estar indexada ainda). Só a resolução manual (/admin/fiscal/resolver) declara isso.
export async function localizarNoFornecedor(doc: FiscalDocumento): Promise<FiscalDocumento | null> {
  const achada = await localizarPorIdentificador({
    identificador: doc.idempotency_key,
    ambiente: tipoAmbiente(doc.ambiente),
    desde: doc.created_at ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  })
  if (!achada) return null

  if (achada.status === 3) {
    await atualizarDocumento(doc.id, {
      status: "denegado",
      chave_acesso: achada.chave_acesso,
      rejeicao_motivo: "Uso denegado — localizado na Brasil NFe pela varredura.",
    })
    return null
  }
  // status 2 = cancelada: a nota existiu mas não vale mais. Não adota e não mexe — o operador
  // decide em Fiscal → Fila.
  if (achada.status !== 1) return null

  return atualizarDocumento(doc.id, {
    status: "autorizado_nao_verificado",
    chave_acesso: achada.chave_acesso,
    numero: achada.numero,
    serie: achada.serie,
    rejeicao_codigo: null,
    rejeicao_motivo: null,
  })
}
```

6. Substitua o corpo do `for` de `reconciliarPendentes`:

```typescript
  for (const pendente of pendentes) {
    try {
      let doc: FiscalDocumento | null = pendente
      // Sem chave: a transmissão não teve resposta. Pergunta ao fornecedor se a nota existe.
      if (!doc.chave_acesso) doc = await localizarNoFornecedor(doc)
      if (!doc) continue
      const r = await reconciliarDocumento(doc.id)
      if (r.verificado) verificados++
    } catch {
      // Falha de um documento não pode parar a varredura dos outros.
      // O documento permanece pendente e reaparece na próxima passada.
    }
  }
```

E troque o comentário acima da função por:

```typescript
// Varredura de segurança (spec §7.3). A emissão síncrona reconcilia na hora; a varredura cobre o
// que ela não fecha sozinha: transmissão sem resposta (localiza pelo IdentificadorInterno) e
// reconciliação que falhou ou ficou sem XML.
```

7. Em `src/jobs/fiscal-reconciliar.ts`, troque o comentário do topo por:

```typescript
// Rede de segurança da emissão síncrona (spec §7.3): resolve transmissões que ficaram sem resposta
// (timeout, 5xx) localizando a nota no fornecedor, e refaz reconciliações que falharam. Um
// documento preso em 'autorizado_nao_verificado' bloqueia a devolução daquele pedido.
```

8. Em `src/api/admin/fiscal/resolver/route.ts`, o comentário acima de `POST` diz que "reconciliarPendentes pula quem não tem chave". Isso deixou de ser verdade. Troque essa frase por: "a varredura tenta localizar a nota no fornecedor pelo IdentificadorInterno; esta rota é a saída manual para quando nem isso resolve — e é o ÚNICO lugar que pode declarar que uma nota não foi emitida". Nenhuma mudança de código nessa rota.

- [ ] **Step 5: Run tests to verify they pass**

Run: o mesmo comando do Step 3.
Expected: PASS — os testes antigos (com o mock renomeado) mais os 9 novos.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/lib/fiscal/fiscal-reconciliar.ts apps/backend/src/lib/fiscal/__tests__/fiscal-reconciliar.unit.spec.ts apps/backend/src/jobs/fiscal-reconciliar.ts apps/backend/src/api/admin/fiscal/resolver/route.ts
git commit -m "feat(fiscal): reconcilia com XML em mãos e localiza transmissão sem resposta

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Emissão — barreira de duplicidade, gravação do resultado e reconciliação inline

**Files:**
- Modify: `apps/backend/src/lib/fiscal/fiscal-emissao.ts`
- Modify: `apps/backend/src/api/admin/fiscal/emitir/route.ts`
- Modify: `apps/backend/src/api/admin/fiscal/emitir-devolucao/route.ts`
- Modify: `apps/backend/src/lib/fiscal/__tests__/fiscal-emissao.unit.spec.ts`
- Modify: `apps/backend/src/api/admin/fiscal/emitir/__tests__/route.unit.spec.ts`
- Modify: `apps/backend/src/api/admin/fiscal/emitir-devolucao/__tests__/route.unit.spec.ts`

**Interfaces:**
- Consumes: `transmitir(payload): Promise<ResultadoTransmissao>` (Task 5); `reconciliarDocumento(id, xml?)`, `localizarNoFornecedor(doc)` (Task 6); `montarPayloadVenda({..., pagamento, identificador})` (Task 3); `montarPayloadDevolucao({..., identificador})` (Task 4); `PagamentoNF` (Task 2).
- Produces (exportados de `fiscal-emissao.ts`):

```typescript
export async function prepararTentativa(args: {
  orderId: string; tipo: "venda" | "devolucao"; ambiente: Ambiente; baseKey: string
  avisar?: (mensagem: string) => void
}): Promise<{ existente: FiscalDocumento } | { key: string }>

export async function transmitirEGravar(args: {
  doc: FiscalDocumento; payload: Record<string, unknown>; rotulo: string
  avisar?: (mensagem: string) => void
}): Promise<FiscalDocumento>

export async function emitirVenda(args: {
  orderId: string; itens: ItemPedido[]; destinatario: DestinatarioNF
  frete_centavos: number; pagamento: PagamentoNF; avisar?: (mensagem: string) => void
}): Promise<FiscalDocumento>
```

**Por que duas funções compartilhadas:** hoje a sequência "marca pendente → transmite → grava resultado" está **duplicada** entre `emitirVenda` e a rota `emitir-devolucao`. Com a interpretação nova da resposta, manter duas cópias é pedir para uma delas desalinhar. E a rota de devolução tem um bug latente que a venda já corrigiu (achado C3): documento `rejeitado` → nova tentativa usa a **mesma** chave → `duplicate key` → 500. `prepararTentativa` resolve as duas.

**A barreira (spec §7.2 item 8).** A numeração é do fornecedor: cada tentativa ganha número novo, e a SEFAZ aceita as duas. Antes de qualquer nova tentativa, perguntamos ao fornecedor se alguma tentativa anterior — inclusive uma que **nós** gravamos como `rejeitado` — na verdade foi autorizada. Se foi, adotamos a nota existente. Se a consulta **falhar** (fornecedor fora do ar), o erro propaga e a emissão não acontece: sem poder verificar, não se arrisca a duplicata.

- [ ] **Step 1: Update existing emission tests (mecânico)**

Em `fiscal-emissao.unit.spec.ts`, no `describe("emitirVenda")`:

1. Em **todas** as chamadas `emitirVenda({...})`, acrescente `pagamento: { forma: "99", descricao: "Pagamento online" }`.
2. Em **todos** os `jest.doMock("../fiscal-db", ...)`, acrescente `lerDocumento: jest.fn(async (id: string) => ({ id, status: "verificado" }))`.
3. Acrescente a **todos** os testes do bloco um mock da reconciliação:
   `jest.doMock("../fiscal-reconciliar", () => ({ reconciliarDocumento: jest.fn(async () => ({ verificado: true, divergencias: [] })), localizarNoFornecedor: jest.fn(async () => null) }))`
4. Onde o mock de `transmitir` devolve o formato antigo (`{ autorizado: true, chave_acesso, numero, serie, status_sefaz, motivo, xml_url, danfe_url, bruto }`), troque por:
   `{ desfecho: "autorizado", chave_acesso: "3".repeat(44), numero: 2, serie: 1, codigo_sefaz: "100", motivo: null, xml: "<nfeProc/>", ambiente_divergente: false, bruto: {} }`

- [ ] **Step 2: Write the new failing tests**

Acrescente dentro do `describe("emitirVenda")`, reaproveitando `itens`, `destinatario`, `configBase` e `perfilPadrao` já definidos no bloco:

```typescript
  const pagamento = { forma: "99", descricao: "Pagamento online" }
  const AUTORIZADA = {
    desfecho: "autorizado", chave_acesso: "3".repeat(44), numero: 7, serie: 1,
    codigo_sefaz: "100", motivo: null, xml: "<nfeProc>x</nfeProc>", ambiente_divergente: false, bruto: { ReturnNF: {} },
  }

  // Monta os três mocks (db, client, reconciliar) e devolve os espiões que os testes inspecionam.
  function preparar(opts: {
    documentos?: any[]
    transmitir?: jest.Mock
    localizarNoFornecedor?: jest.Mock
    reconciliarDocumento?: jest.Mock
  } = {}) {
    const estado: Record<string, any> = {}
    const criarDocumento = jest.fn(async (d: any) => { Object.assign(estado, d, { id: "doc_novo" }); return { ...estado } })
    const atualizarDocumento = jest.fn(async (_id: string, patch: any) => { Object.assign(estado, patch); return { ...estado } })
    const transmitir = opts.transmitir ?? jest.fn(async () => AUTORIZADA)
    const reconciliarDocumento = opts.reconciliarDocumento ?? jest.fn(async () => { estado.status = "verificado"; return { verificado: true, divergencias: [] } })
    const localizarNoFornecedor = opts.localizarNoFornecedor ?? jest.fn(async () => null)
    jest.doMock("../fiscal-db", () => ({
      documentosDoPedido: jest.fn().mockResolvedValue(opts.documentos ?? []),
      getConfig: jest.fn().mockResolvedValue(configBase),
      listPerfis: jest.fn().mockResolvedValue(perfilPadrao),
      criarDocumento,
      criarItens: jest.fn(async () => []),
      atualizarDocumento,
      lerDocumento: jest.fn(async (id: string) => (id === "doc_novo" ? { ...estado } : { id, status: "verificado" })),
    }))
    jest.doMock("../fiscal-client", () => ({ transmitir, previsualizar: jest.fn(), brasilNfeConfigured: () => true }))
    jest.doMock("../fiscal-reconciliar", () => ({ reconciliarDocumento, localizarNoFornecedor }))
    return { estado, criarDocumento, atualizarDocumento, transmitir, reconciliarDocumento, localizarNoFornecedor }
  }

  it("autorizada: grava chave, número, série e xml_autorizado, e reconcilia NA HORA com o XML da resposta", async () => {
    const m = preparar()
    const { emitirVenda } = await import("../fiscal-emissao.js")
    const doc = await emitirVenda({ orderId: "order_1", itens, destinatario, frete_centavos: 0, pagamento })

    const gravacao = m.atualizarDocumento.mock.calls.find(([, p]) => p.status === "autorizado_nao_verificado")![1]
    expect(gravacao.chave_acesso).toBe("3".repeat(44))
    expect(gravacao.numero).toBe(7)
    expect(gravacao.xml_autorizado).toBe("<nfeProc>x</nfeProc>")
    expect(m.reconciliarDocumento).toHaveBeenCalledWith("doc_novo", "<nfeProc>x</nfeProc>")
    expect(doc.status).toBe("verificado")
  })

  it("o IdentificadorInterno do payload É a chave de idempotência gravada", async () => {
    const m = preparar()
    const { emitirVenda } = await import("../fiscal-emissao.js")
    await emitirVenda({ orderId: "order_1", itens, destinatario, frete_centavos: 0, pagamento })

    const criado = m.criarDocumento.mock.calls[0][0]
    expect(criado.idempotency_key).toBe("order_1:venda:homologacao")
    expect(criado.payload_enviado.IdentificadorInterno).toBe("order_1:venda:homologacao")
    expect(m.transmitir.mock.calls[0][0].IdentificadorInterno).toBe("order_1:venda:homologacao")
  })

  it("falha na reconciliação NÃO desfaz a emissão: a nota está autorizada, o despacho segue", async () => {
    const avisar = jest.fn()
    const m = preparar({ reconciliarDocumento: jest.fn(async () => { throw new Error("XML sem det") }) })
    const { emitirVenda } = await import("../fiscal-emissao.js")
    const doc = await emitirVenda({ orderId: "order_1", itens, destinatario, frete_centavos: 0, pagamento, avisar })

    expect(doc.status).toBe("autorizado_nao_verificado")
    expect(doc.chave_acesso).toBe("3".repeat(44))
    expect(avisar).toHaveBeenCalledWith(expect.stringContaining("XML sem det"))
    expect(m.estado.status).not.toBe("rejeitado")
  })

  it("rejeitada: grava código e motivo, não reconcilia", async () => {
    const m = preparar({
      transmitir: jest.fn(async () => ({
        desfecho: "rejeitado", chave_acesso: null, numero: null, serie: null,
        codigo_sefaz: "225", motivo: "Falha no Schema XML", xml: null, ambiente_divergente: false, bruto: {},
      })),
    })
    const { emitirVenda } = await import("../fiscal-emissao.js")
    const doc = await emitirVenda({ orderId: "order_1", itens, destinatario, frete_centavos: 0, pagamento })

    expect(doc.status).toBe("rejeitado")
    expect(doc.rejeicao_codigo).toBe("225")
    expect(doc.rejeicao_motivo).toBe("Falha no Schema XML")
    expect(m.reconciliarDocumento).not.toHaveBeenCalled()
  })

  it("resposta INDEFINIDA: lança Error comum e o documento FICA em transmitido_sem_confirmacao", async () => {
    const m = preparar({
      transmitir: jest.fn(async () => ({
        desfecho: "indefinido", chave_acesso: null, numero: null, serie: null,
        codigo_sefaz: null, motivo: null, xml: null, ambiente_divergente: false, bruto: { estranho: true },
      })),
    })
    const { emitirVenda } = await import("../fiscal-emissao.js")
    const { ErroFiscal } = await import("../tipos.js")
    const erro = await emitirVenda({ orderId: "order_1", itens, destinatario, frete_centavos: 0, pagamento }).catch((e) => e)

    expect(erro).toBeInstanceOf(Error)
    expect(erro).not.toBeInstanceOf(ErroFiscal)
    expect(m.estado.status).toBe("transmitido_sem_confirmacao")
    expect(m.estado.resposta_bruta).toEqual({ estranho: true })
  })

  it("ambiente divergente: grava o alerta e avisa, sem perder a autorização", async () => {
    const avisar = jest.fn()
    const m = preparar({ transmitir: jest.fn(async () => ({ ...AUTORIZADA, ambiente_divergente: true })) })
    const { emitirVenda } = await import("../fiscal-emissao.js")
    await emitirVenda({ orderId: "order_1", itens, destinatario, frete_centavos: 0, pagamento, avisar })

    const gravacao = m.atualizarDocumento.mock.calls.find(([, p]) => p.status === "autorizado_nao_verificado")![1]
    expect(gravacao.rejeicao_motivo).toMatch(/ambiente/i)
    expect(avisar).toHaveBeenCalledWith(expect.stringMatching(/ambiente/i))
  })

  it("BARREIRA: tentativa anterior gravada como rejeitada, mas AUTORIZADA no fornecedor — adota, não reemite", async () => {
    const rejeitado = { id: "doc_antigo", status: "rejeitado", idempotency_key: "order_1:venda:homologacao" }
    const adotado = { ...rejeitado, status: "autorizado_nao_verificado", chave_acesso: "5".repeat(44) }
    const m = preparar({
      documentos: [rejeitado],
      localizarNoFornecedor: jest.fn(async () => adotado),
    })
    const { emitirVenda } = await import("../fiscal-emissao.js")
    const doc = await emitirVenda({ orderId: "order_1", itens, destinatario, frete_centavos: 0, pagamento })

    expect(m.localizarNoFornecedor).toHaveBeenCalledWith(rejeitado)
    expect(m.transmitir).not.toHaveBeenCalled()
    expect(m.criarDocumento).not.toHaveBeenCalled()
    expect(m.reconciliarDocumento).toHaveBeenCalledWith("doc_antigo")
    expect(doc.id).toBe("doc_antigo")
  })

  it("BARREIRA: consulta ao fornecedor falhou — a emissão NÃO acontece (sem verificar, não arrisca duplicata)", async () => {
    const rejeitado = { id: "doc_antigo", status: "rejeitado", idempotency_key: "order_1:venda:homologacao" }
    const m = preparar({
      documentos: [rejeitado],
      localizarNoFornecedor: jest.fn(async () => { throw new Error("Brasil NFe ObterNotasFiscais: 503") }),
    })
    const { emitirVenda } = await import("../fiscal-emissao.js")

    await expect(emitirVenda({ orderId: "order_1", itens, destinatario, frete_centavos: 0, pagamento })).rejects.toThrow(/503/)
    expect(m.transmitir).not.toHaveBeenCalled()
  })

  it("transmitido_sem_confirmacao que o fornecedor conhece é adotado em vez de recusado", async () => {
    const pendente = { id: "doc_pend", status: "transmitido_sem_confirmacao", idempotency_key: "order_1:venda:homologacao" }
    const m = preparar({
      documentos: [pendente],
      localizarNoFornecedor: jest.fn(async () => ({ ...pendente, status: "autorizado_nao_verificado", chave_acesso: "5".repeat(44) })),
    })
    const { emitirVenda } = await import("../fiscal-emissao.js")
    const doc = await emitirVenda({ orderId: "order_1", itens, destinatario, frete_centavos: 0, pagamento })

    expect(doc.id).toBe("doc_pend")
    expect(m.transmitir).not.toHaveBeenCalled()
  })
```

Acrescente também, fora do `describe("emitirVenda")`:

```typescript
describe("prepararTentativa — devolução", () => {
  beforeEach(() => jest.resetModules())
  afterEach(() => jest.restoreAllMocks())

  it("só considera documentos do MESMO conjunto devolvido, e dá sufixo :rN na nova tentativa", async () => {
    const base = "order_1:devolucao:homologacao:aaaa"
    jest.doMock("../fiscal-db", () => ({
      documentosDoPedido: jest.fn().mockResolvedValue([
        { id: "d1", status: "rejeitado", idempotency_key: base },
        { id: "d2", status: "verificado", idempotency_key: "order_1:devolucao:homologacao:bbbb" }, // OUTRA remessa
      ]),
      lerDocumento: jest.fn(),
    }))
    jest.doMock("../fiscal-client", () => ({ transmitir: jest.fn() }))
    jest.doMock("../fiscal-reconciliar", () => ({
      reconciliarDocumento: jest.fn(), localizarNoFornecedor: jest.fn(async () => null),
    }))
    const { prepararTentativa } = await import("../fiscal-emissao.js")

    const r = await prepararTentativa({ orderId: "order_1", tipo: "devolucao", ambiente: "homologacao", baseKey: base })

    // d2 é de outro conjunto: não pode ser devolvido como "existente" desta remessa.
    expect(r).toEqual({ key: `${base}:r1` })
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd apps/backend && TEST_TYPE=unit NODE_OPTIONS=--experimental-vm-modules npx jest src/lib/fiscal/__tests__/fiscal-emissao.unit.spec.ts --runInBand --forceExit`
Expected: FAIL — `prepararTentativa` não existe; `reconciliarDocumento` não é chamado.

- [ ] **Step 4: Update `fiscal-emissao.ts`**

1. Imports — substitua o bloco de imports por:

```typescript
import { createHash } from "node:crypto"
import {
  atualizarDocumento, criarDocumento, criarItens, documentosDoPedido, getConfig, lerDocumento, listPerfis,
} from "./fiscal-db"
import { transmitir } from "./fiscal-client"
import type { PagamentoNF } from "./fiscal-pagamento"
import { montarPayloadVenda, type DestinatarioNF } from "./fiscal-payload"
import { localizarNoFornecedor, reconciliarDocumento } from "./fiscal-reconciliar"
import { ErroFiscal, type Ambiente, type FiscalDocumento, type ItemPedido } from "./tipos"
```

2. `chaveIdempotencia`, `digestDevolvidos` e `JA_RESOLVIDO` ficam **como estão**.

3. Acrescente, depois de `JA_RESOLVIDO`:

```typescript
const ALERTA_AMBIENTE =
  "ALERTA: a nota foi autorizada num ambiente diferente do configurado em Fiscal → Configuração. " +
  "Confira o ambiente da empresa no painel da Brasil NFe antes de emitir qualquer outra nota."

// Adota uma nota que o fornecedor já tem para este documento: grava a chave (localizarNoFornecedor)
// e tenta reconciliar. Falha de reconciliação não impede a adoção — a nota existe de qualquer jeito.
async function adotarSeExistir(
  doc: FiscalDocumento,
  avisar?: (mensagem: string) => void
): Promise<FiscalDocumento | null> {
  const achado = await localizarNoFornecedor(doc)
  if (!achado) return null
  try {
    await reconciliarDocumento(achado.id)
  } catch (e) {
    avisar?.(`[fiscal] nota ${achado.id} adotada do fornecedor, mas a reconciliação falhou: ${(e as Error).message}`)
  }
  return lerDocumento(achado.id)
}

// Decide se há o que emitir (spec §7.2 item 8). Com numeração automática do fornecedor, a SEFAZ
// NÃO barra duplicata — cada tentativa ganha número novo. A barreira é só nossa.
//
// Se a consulta ao fornecedor falhar, o erro PROPAGA: sem poder verificar, não se emite.
export async function prepararTentativa(args: {
  orderId: string
  tipo: "venda" | "devolucao"
  ambiente: Ambiente
  baseKey: string
  avisar?: (mensagem: string) => void
}): Promise<{ existente: FiscalDocumento } | { key: string }> {
  const { orderId, tipo, ambiente, baseKey, avisar } = args
  const todos = await documentosDoPedido(orderId, tipo, ambiente)
  // Só as tentativas DESTA chave. Na devolução a chave carrega o digest do conjunto devolvido —
  // outra remessa do mesmo pedido é outro documento, não uma tentativa anterior deste.
  const docs = todos.filter(
    (d) => d.idempotency_key === baseKey || d.idempotency_key.startsWith(`${baseKey}:r`)
  )

  const jaResolvido = docs.find((d) => JA_RESOLVIDO.has(d.status))
  if (jaResolvido) return { existente: jaResolvido }

  const pendente = docs.find((d) => d.status === "transmitido_sem_confirmacao")
  if (pendente) {
    const adotado = await adotarSeExistir(pendente, avisar)
    if (adotado) return { existente: adotado }
    throw new ErroFiscal(
      "Já existe uma transmissão sem confirmação para este pedido, e a Brasil NFe ainda não a localiza. " +
        "Resolva em Fiscal → Fila (reconciliar ou resolver) antes de tentar de novo — reemitir criaria nota duplicada."
    )
  }

  // Tentativas que NÓS demos como não emitidas. Antes de emitir outra, confirma com o fornecedor.
  const anteriores = docs.filter((d) => d.status === "rejeitado" || d.status === "montado")
  for (const anterior of anteriores) {
    const adotado = await adotarSeExistir(anterior, avisar)
    if (adotado) return { existente: adotado }
  }

  // Sufixo de tentativa: sem ele a nova linha colide no índice único idempotency_key_key (C3).
  return { key: anteriores.length === 0 ? baseKey : `${baseKey}:r${anteriores.length}` }
}

// Marca pendente → transmite → grava o resultado → reconcilia na hora. Compartilhada por venda e
// devolução: a interpretação da resposta não pode existir em duas cópias.
export async function transmitirEGravar(args: {
  doc: FiscalDocumento
  payload: Record<string, unknown>
  rotulo: string
  avisar?: (mensagem: string) => void
}): Promise<FiscalDocumento> {
  const { doc, payload, rotulo, avisar } = args
  await atualizarDocumento(doc.id, { status: "transmitido_sem_confirmacao" })

  let r
  try {
    r = await transmitir(payload)
  } catch (e) {
    // Fica em transmitido_sem_confirmacao de propósito: a varredura localiza pelo
    // IdentificadorInterno. A CLASSE do erro é preservada (ErroFiscal → 422, Error → 500):
    // queda do fornecedor não é erro do operador (achado I2/5.1).
    const erro = e as Error
    const mensagem = `Falha ao transmitir a ${rotulo}. O documento ficou pendente de reconciliação. Detalhe: ${erro.message}`
    throw erro instanceof ErroFiscal ? new ErroFiscal(mensagem) : new Error(mensagem)
  }

  if (r.desfecho === "indefinido") {
    await atualizarDocumento(doc.id, { resposta_bruta: r.bruto })
    throw new Error(
      `A Brasil NFe devolveu uma resposta que não permite concluir se a ${rotulo} foi autorizada. ` +
        "O documento ficou pendente de reconciliação — não reemita."
    )
  }

  if (r.desfecho !== "autorizado") {
    return atualizarDocumento(doc.id, {
      status: r.desfecho,
      chave_acesso: r.chave_acesso,
      numero: r.numero,
      serie: r.serie,
      rejeicao_codigo: r.codigo_sefaz,
      rejeicao_motivo: r.motivo,
      resposta_bruta: r.bruto,
    })
  }

  await atualizarDocumento(doc.id, {
    status: "autorizado_nao_verificado",
    chave_acesso: r.chave_acesso,
    numero: r.numero,
    serie: r.serie,
    xml_autorizado: r.xml,
    rejeicao_codigo: null,
    rejeicao_motivo: r.ambiente_divergente ? ALERTA_AMBIENTE : null,
    resposta_bruta: r.bruto,
  })
  if (r.ambiente_divergente) avisar?.(`[fiscal] ${rotulo}: ${ALERTA_AMBIENTE}`)

  // Reconciliação NA HORA, com o XML que veio na resposta (spec §7.3). Falhar aqui não desfaz a
  // emissão: a nota está autorizada. O documento fica autorizado_nao_verificado e a varredura tenta.
  try {
    if (!r.xml) throw new Error("a resposta não trouxe o XML autorizado (Base64Xml vazio)")
    await reconciliarDocumento(doc.id, r.xml)
  } catch (e) {
    avisar?.(`[fiscal] ${rotulo} autorizada, mas a reconciliação na hora falhou: ${(e as Error).message}`)
  }
  return lerDocumento(doc.id)
}
```

4. Substitua `emitirVenda` inteira (mantendo o comentário sobre `emissao_ativa` que está acima dela):

```typescript
export async function emitirVenda(args: {
  orderId: string
  itens: ItemPedido[]
  destinatario: DestinatarioNF
  frete_centavos: number
  pagamento: PagamentoNF
  avisar?: (mensagem: string) => void
}): Promise<FiscalDocumento> {
  const config = await getConfig()

  const tentativa = await prepararTentativa({
    orderId: args.orderId,
    tipo: "venda",
    ambiente: config.ambiente,
    baseKey: chaveIdempotencia(args.orderId, "venda", config.ambiente),
    avisar: args.avisar,
  })
  if ("existente" in tentativa) return tentativa.existente
  const key = tentativa.key

  const perfis = await listPerfis()
  const { payload, itens_ordenados } = montarPayloadVenda({
    config,
    perfis,
    itens: args.itens,
    destinatario: args.destinatario,
    frete_centavos: args.frete_centavos,
    pagamento: args.pagamento,
    // A chave de idempotência viaja no payload: é por ela que o fornecedor é consultado depois.
    identificador: key,
  })

  // 1) grava ANTES de transmitir
  const doc = await criarDocumento({
    medusa_order_id: args.orderId,
    tipo: "venda",
    modelo: 55,
    serie: null, // a numeração é do fornecedor; série e número reais voltam na resposta
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

  // O codigo_enviado grava o MESMO valor que foi para o payload, nunca recalculado aqui: a regra
  // "sku ?? line_item_id" mora só em montarPayloadVenda. É por ele que o XML é casado (§7.3).
  const produtos = payload.Produtos as Array<{ CodProdutoServico: string }>
  await criarItens(
    itens_ordenados.map((it, idx) => ({
      fiscal_documento_id: doc.id,
      medusa_line_item_id: it.line_item_id,
      ordem_enviada: idx + 1,
      n_item_verificado: null,
      codigo_enviado: produtos[idx].CodProdutoServico,
      ncm: it.ncm as string,
      quantidade: it.quantidade,
      valor_unitario_centavos: it.valor_unitario_centavos,
      desconto_centavos: it.desconto_centavos,
    }))
  )

  // 2) transmite, grava o resultado e reconcilia
  return transmitirEGravar({
    doc, payload, rotulo: `NF-e do pedido ${args.orderId}`, avisar: args.avisar,
  })
}
```

Também atualize o comentário do topo do arquivo: troque "a reconciliação consulta pela chave em vez de reemitir" por "a varredura localiza a nota no fornecedor pelo IdentificadorInterno (a própria chave de idempotência) em vez de reemitir".

- [ ] **Step 5: Run the emission tests**

Run: o mesmo comando do Step 3.
Expected: PASS. O teste antigo "transmitido_sem_confirmacao: continua recusando com a mensagem atual" pode precisar de ajuste na regex da mensagem — a frase nova contém "reemitir criaria nota duplicada", que é a parte que o teste deve afirmar.

- [ ] **Step 6: Update the `emitir` route**

Em `admin/fiscal/emitir/route.ts`:

1. No ramo da prévia, passe o identificador:

```typescript
    if (previa) {
      const [config, perfis] = await Promise.all([getConfig(), listPerfis()])
      // Prévia não consome numeração nem grava documento — o identificador só precisa existir.
      const { payload } = montarPayloadVenda({ config, perfis, ...dados, identificador: `previa:${order_id}` })
      return res.json({ previa: await previsualizar(payload), payload })
    }
```

2. Na emissão, passe o `avisar`:

```typescript
    return res.json({
      documento: await emitirVenda({ orderId: order_id, ...dados, avisar: (m) => logger.warn(m) }),
    })
```

`...dados` já carrega `pagamento` (Task 2). A resposta da prévia muda de forma: `previa` agora é `{ xml: string }`.

Em `emitir/__tests__/route.unit.spec.ts`: onde `montarItensDoPedido` é mockado com retorno, acrescente `pagamento: { forma: "99", descricao: "Pagamento online" }`; onde `previsualizar` é mockado, faça-o devolver `{ xml: "<NFe/>" }`. A intenção de cada teste (ordem do interruptor, 422 sem CPF, prévia independente do interruptor) não muda.

- [ ] **Step 7: Update the `emitir-devolucao` route**

Em `admin/fiscal/emitir-devolucao/route.ts`:

1. Imports: de `fiscal-emissao` importe `chaveIdempotencia, digestDevolvidos, JA_RESOLVIDO, prepararTentativa, transmitirEGravar`; de `fiscal-client` importe só `previsualizar`; de `fiscal-db` remova `acharPorIdempotencia` e `atualizarDocumento`.

2. A chave precisa existir **antes** de montar o payload (ela vai como `IdentificadorInterno`). Reordene: logo depois de calcular `quantidadesJaDevolvidas`, e **antes** de `montarPayloadDevolucao`:

```typescript
    const baseKey = `${chaveIdempotencia(order_id, "devolucao", config.ambiente)}:${digestDevolvidos(itens)}`

    // Na prévia nada é transmitido nem gravado — não consulta o fornecedor nem exige o interruptor.
    let key = `previa:${baseKey}`
    if (!previa) {
      if (!config.emissao_ativa) {
        throw new ErroFiscal(
          "A emissão está desligada em Fiscal → Configuração (emissao_ativa). Ligue-a para transmitir notas."
        )
      }
      const tentativa = await prepararTentativa({
        orderId: order_id, tipo: "devolucao", ambiente: config.ambiente, baseKey,
        avisar: (m) => logger.warn(m),
      })
      if ("existente" in tentativa) return res.json({ documento: tentativa.existente })
      key = tentativa.key
    }
```

3. Passe `identificador: key` a `montarPayloadDevolucao`.

4. Mantenha `if (previa) return res.json({ previa: await previsualizar(payload), payload })` logo após montar o payload. Remova o bloco antigo de `emissao_ativa` que vinha depois (já foi checado acima) e o bloco antigo de idempotência (`acharPorIdempotencia` / `existente`).

5. Em `criarDocumento`, troque `serie: config.serie_nfe` por `serie: null`.

6. Substitua os passos "2) transmite" e "3) grava o resultado" inteiros por:

```typescript
    const atualizado = await transmitirEGravar({
      doc: docDevolucao, payload, rotulo: `NFD do pedido ${order_id}`, avisar: (m) => logger.warn(m),
    })
    return res.json({ documento: atualizado })
```

Em `emitir-devolucao/__tests__/route.unit.spec.ts`: os mocks de `fiscal-emissao` passam a incluir `prepararTentativa` (devolvendo `{ key: "k" }` ou `{ existente }` conforme o cenário) e `transmitirEGravar`; os de `fiscal-client` só `previsualizar`. Os cenários "mesma devolução repetida devolve o existente" e "transmissão sem confirmação recusa" passam a ser exercidos via o retorno/rejeição de `prepararTentativa`.

- [ ] **Step 8: Run the whole fiscal suite**

Run: `cd apps/backend && TEST_TYPE=unit NODE_OPTIONS=--experimental-vm-modules npx jest src/lib/fiscal src/api/admin/fiscal --runInBand --forceExit`
Expected: PASS em tudo. Depois: `npx tsc --noEmit -p .` — sem erro novo em `src/lib/fiscal` nem em `src/api/admin/fiscal` (a rota `resolver` usa `reconciliarDocumento(id)`, que continua válida).

- [ ] **Step 9: Commit**

```bash
git add apps/backend/src/lib/fiscal/fiscal-emissao.ts apps/backend/src/lib/fiscal/__tests__/fiscal-emissao.unit.spec.ts apps/backend/src/api/admin/fiscal/emitir apps/backend/src/api/admin/fiscal/emitir-devolucao
git commit -m "feat(fiscal): barreira de duplicidade pelo fornecedor e reconciliação na própria emissão

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Webhook — HMAC sobre o corpo bruto e envelope real

**Files:**
- Create: `apps/backend/src/lib/fiscal/fiscal-webhook.ts`
- Create: `apps/backend/src/lib/fiscal/__tests__/fiscal-webhook.unit.spec.ts`
- Modify: `apps/backend/src/api/webhooks/brasilnfe/route.ts`
- Modify: `apps/backend/src/api/middlewares.ts`

**Interfaces:**
- Produces:
  - `assinaturaValida(corpoBruto: Buffer | string | undefined, header: string | undefined, segredo: string | undefined): boolean`
  - `chavesDoLote(data: unknown): string[]` — extrai as chaves de 44 dígitos de `data.notas[].chaveAcesso`

**Contexto (spec §7.4).** A rota atual autentica por `?token=` na URL — um chute, como o próprio comentário dela admite. O fornecedor assina com **HMAC-SHA256 do corpo bruto**, no header `X-Webhook-Signature: sha256=<hex>`. A documentação deles avisa: *"Calcule o HMAC sobre o body exatamente como recebido — sem reserializar o JSON."* O Medusa já fez `JSON.parse` antes da rota rodar, então `JSON.stringify(req.body)` **não** reproduz os bytes originais. Por isso a rota é configurada com `preserveRawBody`, que expõe `req.rawBody`.

A rota também muda de função: `EnviarNotaFiscal` (síncrono) **não dispara webhook**. Ela passa a atender o botão "Testar" do painel deles, o evento de lote (que não usamos, mas é barato tratar) e os avisos de nota de entrada.

- [ ] **Step 1: Write the failing tests**

`fiscal-webhook.unit.spec.ts`:

```typescript
// Esquema de assinatura e envelope: https://www.brasilnfe.com.br/webhooks

import { createHmac } from "node:crypto"
import { assinaturaValida, chavesDoLote } from "../fiscal-webhook"

const SEGREDO = "segredo-de-teste"
const CORPO = '{"event":"test.ping","deliveryId":"abc","timestamp":"2026-09-17T12:00:00Z","data":{"test":true}}'

function assinar(corpo: string, segredo = SEGREDO): string {
  return "sha256=" + createHmac("sha256", segredo).update(corpo).digest("hex")
}

describe("assinaturaValida", () => {
  it("aceita a assinatura correta, com o corpo como string ou Buffer", () => {
    expect(assinaturaValida(CORPO, assinar(CORPO), SEGREDO)).toBe(true)
    expect(assinaturaValida(Buffer.from(CORPO, "utf8"), assinar(CORPO), SEGREDO)).toBe(true)
  })

  it("recusa corpo alterado em 1 byte", () => {
    expect(assinaturaValida(CORPO.replace("true", "tru3"), assinar(CORPO), SEGREDO)).toBe(false)
  })

  it("recusa o MESMO JSON reserializado com outro espaçamento — é por isso que precisa do corpo bruto", () => {
    const reserializado = JSON.stringify(JSON.parse(CORPO), null, 2)
    expect(JSON.parse(reserializado)).toEqual(JSON.parse(CORPO)) // mesmo conteúdo…
    expect(assinaturaValida(reserializado, assinar(CORPO), SEGREDO)).toBe(false) // …assinatura diferente
  })

  it("recusa assinatura feita com outro segredo", () => {
    expect(assinaturaValida(CORPO, assinar(CORPO, "outro"), SEGREDO)).toBe(false)
  })

  it("recusa header sem o prefixo sha256=, vazio ou ausente", () => {
    const hex = assinar(CORPO).slice("sha256=".length)
    expect(assinaturaValida(CORPO, hex, SEGREDO)).toBe(false)
    expect(assinaturaValida(CORPO, "", SEGREDO)).toBe(false)
    expect(assinaturaValida(CORPO, undefined, SEGREDO)).toBe(false)
  })

  it("recusa quando o segredo não está configurado — nunca 'aceita tudo' por falta de config", () => {
    expect(assinaturaValida(CORPO, assinar(CORPO, ""), "")).toBe(false)
    expect(assinaturaValida(CORPO, assinar(CORPO), undefined)).toBe(false)
  })

  it("recusa quando o corpo bruto não está disponível", () => {
    expect(assinaturaValida(undefined, assinar(CORPO), SEGREDO)).toBe(false)
  })

  it("header de tamanho diferente não lança (timingSafeEqual exige tamanhos iguais)", () => {
    expect(() => assinaturaValida(CORPO, "sha256=abc", SEGREDO)).not.toThrow()
    expect(assinaturaValida(CORPO, "sha256=abc", SEGREDO)).toBe(false)
  })
})

describe("chavesDoLote", () => {
  const CHAVE = "31260968673407000113550010000000011000000017"

  it("extrai só as chaves de 44 dígitos (nota não autorizada vem com chave vazia)", () => {
    expect(chavesDoLote({ notas: [{ chaveAcesso: CHAVE }, { chaveAcesso: "" }, { chaveAcesso: "123" }] })).toEqual([CHAVE])
  })

  it("corpo malformado devolve lista vazia, sem lançar", () => {
    expect(chavesDoLote(undefined)).toEqual([])
    expect(chavesDoLote({})).toEqual([])
    expect(chavesDoLote({ notas: "x" })).toEqual([])
    expect(chavesDoLote({ notas: [null, 5, {}] })).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/backend && TEST_TYPE=unit NODE_OPTIONS=--experimental-vm-modules npx jest src/lib/fiscal/__tests__/fiscal-webhook.unit.spec.ts --runInBand --forceExit`
Expected: FAIL — `Cannot find module '../fiscal-webhook'`

- [ ] **Step 3: Write `fiscal-webhook.ts`**

```typescript
// Verificação do webhook da Brasil NFe (spec §7.4). Fonte: https://www.brasilnfe.com.br/webhooks
//
// A assinatura é o HMAC-SHA256 do CORPO BRUTO, em hexadecimal, prefixado por "sha256=", no
// header X-Webhook-Signature. "Bruto" é literal: o mesmo JSON reserializado tem outros bytes e
// outra assinatura. Funções PURAS — a rota só entrega o que recebeu.

import { createHmac, timingSafeEqual } from "node:crypto"

export function assinaturaValida(
  corpoBruto: Buffer | string | undefined,
  header: string | undefined,
  segredo: string | undefined
): boolean {
  // Sem segredo configurado, NADA é aceito — nunca degradar para "aceita tudo".
  if (!segredo || !header || corpoBruto === undefined || corpoBruto === null) return false
  if (!header.startsWith("sha256=")) return false

  const esperada = Buffer.from("sha256=" + createHmac("sha256", segredo).update(corpoBruto).digest("hex"))
  const recebida = Buffer.from(header)
  // timingSafeEqual lança se os tamanhos diferem — confere antes. Comparação em tempo constante
  // para não vazar, pelo tempo de resposta, quantos caracteres da assinatura estavam certos.
  return esperada.length === recebida.length && timingSafeEqual(esperada, recebida)
}

// nfe.lote.finalizado → data.notas[].chaveAcesso (vazio quando a nota não foi autorizada).
export function chavesDoLote(data: unknown): string[] {
  const notas = (data as { notas?: unknown } | undefined)?.notas
  if (!Array.isArray(notas)) return []
  return notas
    .map((n) => String((n as { chaveAcesso?: unknown } | null)?.chaveAcesso ?? ""))
    .filter((c) => /^\d{44}$/.test(c))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: o mesmo comando do Step 2.
Expected: PASS — 10 testes.

- [ ] **Step 5: Preserve the raw body for this route**

Em `src/api/middlewares.ts`, acrescente como **primeiro** item do array `routes` de `defineMiddlewares`:

```typescript
    // Webhook da Brasil NFe: a assinatura HMAC é sobre os BYTES recebidos. preserveRawBody expõe
    // req.rawBody; sem isso só existe o JSON já parseado, que não reproduz a assinatura.
    { method: "POST", matcher: "/webhooks/brasilnfe", bodyParser: { preserveRawBody: true } },
```

- [ ] **Step 6: Rewrite the route**

Substitua **todo** o conteúdo de `src/api/webhooks/brasilnfe/route.ts`:

```typescript
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { reconciliarDocumento } from "../../../lib/fiscal/fiscal-reconciliar"
import { documentoPorChave } from "../../../lib/fiscal/fiscal-db"
import { assinaturaValida, chavesDoLote } from "../../../lib/fiscal/fiscal-webhook"
import type { StatusDocumento } from "../../../lib/fiscal/tipos"

// Status que já não mudam mais: reconciliar de novo só baixaria XML à toa.
const STATUS_TERMINAIS = new Set<StatusDocumento>(["verificado", "rejeitado", "denegado"])

// Webhook da Brasil NFe (spec §7.4). Envelope: { event, deliveryId, timestamp, data }.
//
// A emissão de venda usa a rota SÍNCRONA do fornecedor, que não dispara webhook — então este
// endpoint NÃO é o gatilho da reconciliação. Ele existe para: o botão "Testar" do painel deles
// (test.ping), o fechamento de lote (não usamos lote hoje, mas ignorar o evento principal do
// fornecedor seria uma armadilha) e o aviso de nota de entrada contra o nosso CNPJ.
//
// O corpo é DADO NÃO CONFIÁVEL mesmo depois de autenticado: nunca carrega o resultado fiscal.
// A verdade vem do XML autorizado. Um webhook não fabrica autorização.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  const assinatura = req.headers["x-webhook-signature"]
  const valida = assinaturaValida(
    (req as unknown as { rawBody?: Buffer }).rawBody,
    Array.isArray(assinatura) ? assinatura[0] : assinatura,
    process.env.BRASILNFE_WEBHOOK_SECRET
  )
  if (!valida) {
    // 401, não 200: quem assina errado não é o fornecedor, e ele não precisa de gentileza.
    logger.warn("[fiscal] webhook com assinatura inválida — recusado")
    return res.status(401).json({ error: "assinatura inválida" })
  }

  const { event, deliveryId, data } = (req.body || {}) as {
    event?: string
    deliveryId?: string
    data?: unknown
  }

  try {
    if (event === "nfe.lote.finalizado") {
      for (const chave of chavesDoLote(data)) {
        const doc = await documentoPorChave(chave)
        if (!doc || STATUS_TERMINAIS.has(doc.status)) continue
        const r = await reconciliarDocumento(doc.id)
        for (const d of r.divergencias) logger.warn(`[fiscal] ${d}`)
        logger.info(`[fiscal] documento ${doc.id} reconciliado via webhook (${deliveryId})`)
      }
    } else if (event === "documento.entrada.recebida" || event === "documento.entrada.cancelada") {
      const d = (data || {}) as Record<string, unknown>
      logger.info(
        `[fiscal] nota de ENTRADA (${event}): emissor ${d.NomeEmissor} (${d.CnpjEmissor}), ` +
          `valor ${d.Valor}, chave ${d.Chave}, status ${d.Status}`
      )
    } else if (event !== "test.ping") {
      logger.info(`[fiscal] webhook com evento não tratado: ${event}`)
    }
  } catch (e) {
    // Autenticado e recebido: responde 200 mesmo se o processamento falhar, para o fornecedor
    // não re-tentar 5 vezes algo que a varredura periódica resolve.
    logger.error(`[fiscal] webhook ${event} (${deliveryId}) falhou: ${(e as Error).message}`)
  }

  return res.status(200).json({ ok: true })
}
```

- [ ] **Step 7: Verify and commit**

Run: `cd apps/backend && npx tsc --noEmit -p .` — sem erro novo em `src/api/webhooks/brasilnfe` nem em `src/api/middlewares.ts`.

```bash
git add apps/backend/src/lib/fiscal/fiscal-webhook.ts apps/backend/src/lib/fiscal/__tests__/fiscal-webhook.unit.spec.ts apps/backend/src/api/webhooks/brasilnfe/route.ts apps/backend/src/api/middlewares.ts
git commit -m "fix(fiscal): webhook autentica por HMAC-SHA256 do corpo bruto

Troca o ?token= suposto pelo esquema real do fornecedor (X-Webhook-Signature),
com comparação em tempo constante e 401 para assinatura inválida.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Resumo da prévia da NFD — o Cockpit para de ler o payload do fornecedor

**Files:**
- Modify: `apps/backend/src/lib/fiscal/fiscal-payload-devolucao.ts`
- Modify: `apps/backend/src/lib/fiscal/__tests__/fiscal-payload-devolucao.unit.spec.ts`
- Modify: `apps/backend/src/api/admin/fiscal/emitir-devolucao/route.ts`
- Modify: `apps/cockpit/lib/fiscal-devolucao.ts`
- Modify: `apps/cockpit/lib/fiscal-devolucao.test.ts`
- Modify: `apps/cockpit/components/nfd-do-pedido.tsx`

**Interfaces:**
- Produces (backend): `montarPayloadDevolucao` passa a devolver também

```typescript
resumo: {
  itens: Array<{ codigo: string; descricao: string; quantidade: number; bruto_centavos: number; desconto_centavos: number; liquido_centavos: number }>
  produtos_centavos: number
  desconto_centavos: number
  total_centavos: number
}
```

  e a rota responde `{ previa, payload, resumo }` na prévia.
- Produces (Cockpit): `type ResumoDevolucao` (mesma forma) e `resumoValido(v: unknown): v is ResumoDevolucao` em `lib/fiscal-devolucao.ts`.

**O defeito que esta tarefa evita.** `components/nfd-do-pedido.tsx` monta a prévia lendo `d.payload.itens` e `d.payload.total` — o **formato antigo do payload do fornecedor**. Com a Task 4, `payload.itens` deixa de existir e a tela passa a responder "Falha ao montar a prévia da NFD" para toda devolução. Renomear os campos na tela consertaria hoje e quebraria de novo na próxima mudança do fornecedor. A correção de verdade é de fronteira: **a tela não conhece o payload do fornecedor**; o backend devolve um resumo próprio, em centavos (Invariante 3).

- [ ] **Step 1: Backend — failing test**

Acrescente a `fiscal-payload-devolucao.unit.spec.ts` (use os `itensOrigemComDesconto` / `itensPedidoComDesconto` já definidos no bloco de rateio; mova-os para o escopo do arquivo se estiverem dentro de um `describe`):

```typescript
describe("resumo da devolução (para a tela, em centavos)", () => {
  it("traz itens e totais sem depender do formato do payload do fornecedor", () => {
    const { resumo } = chamar() // 1 de 2 leggings a 249.00, sem desconto
    expect(resumo).toEqual({
      itens: [{
        codigo: "LEG-VERTICE-M", descricao: "Legging Vertice", quantidade: 1,
        bruto_centavos: 24900, desconto_centavos: 0, liquido_centavos: 24900,
      }],
      produtos_centavos: 24900,
      desconto_centavos: 0,
      total_centavos: 24900,
    })
  })

  it("os totais fecham com a soma das linhas, inclusive com desconto rateado", () => {
    const { resumo } = chamar({
      itensOrigem: itensOrigemComDesconto,
      itensPedido: itensPedidoComDesconto,
      devolvidos: [{ line_item_id: "li_c", quantidade: 2 }, { line_item_id: "li_d", quantidade: 1 }],
    })
    const soma = (f: (i: (typeof resumo.itens)[number]) => number) => resumo.itens.reduce((a, i) => a + f(i), 0)
    expect(resumo.produtos_centavos).toBe(soma((i) => i.bruto_centavos))
    expect(resumo.desconto_centavos).toBe(soma((i) => i.desconto_centavos))
    expect(resumo.total_centavos).toBe(soma((i) => i.liquido_centavos))
    expect(resumo.total_centavos).toBe(resumo.produtos_centavos - resumo.desconto_centavos)
    for (const i of resumo.itens) expect(i.liquido_centavos).toBe(i.bruto_centavos - i.desconto_centavos)
  })
})
```

Este segundo teste recupera a proteção do teste "o total da nota fecha com a soma das linhas", apagado na Task 4 — agora sobre um dado que é nosso.

- [ ] **Step 2: Backend — implementation**

Em `fiscal-payload-devolucao.ts`:

1. Exporte o tipo, acima de `montarPayloadDevolucao`:

```typescript
// Resumo para a tela, em centavos. A tela NUNCA lê o payload do fornecedor: o formato dele é
// problema desta camada, não do Cockpit.
export type ResumoDevolucao = {
  itens: Array<{
    codigo: string; descricao: string; quantidade: number
    bruto_centavos: number; desconto_centavos: number; liquido_centavos: number
  }>
  produtos_centavos: number
  desconto_centavos: number
  total_centavos: number
}
```

2. Acrescente `resumo: ResumoDevolucao` ao tipo de retorno da função.

3. Antes do `devolvidos.map`, declare `const itensResumo: ResumoDevolucao["itens"] = []`. Dentro do `map`, logo depois do `itensDocumento.push({...})`:

```typescript
    const brutoCentavos = origem.valor_unitario_centavos * dev.quantidade
    itensResumo.push({
      codigo: codigoEnviado,
      descricao: doPedido.titulo,
      quantidade: dev.quantidade,
      bruto_centavos: brutoCentavos,
      desconto_centavos: descontoAEstornar,
      liquido_centavos: brutoCentavos - descontoAEstornar,
    })
```

4. Antes do `return`:

```typescript
  const produtosCentavos = itensResumo.reduce((a, i) => a + i.bruto_centavos, 0)
  const descontoCentavos = itensResumo.reduce((a, i) => a + i.desconto_centavos, 0)
  const resumo: ResumoDevolucao = {
    itens: itensResumo,
    produtos_centavos: produtosCentavos,
    desconto_centavos: descontoCentavos,
    total_centavos: produtosCentavos - descontoCentavos,
  }

  return { payload, itens_ordenados: ordenados, itens_documento: itensDocumento, resumo }
```

Em `emitir-devolucao/route.ts`: desestruture `resumo` junto com `payload` e `itens_documento`, e na prévia responda `res.json({ previa: await previsualizar(payload), payload, resumo })`.

Run: `cd apps/backend && TEST_TYPE=unit NODE_OPTIONS=--experimental-vm-modules npx jest src/lib/fiscal/__tests__/fiscal-payload-devolucao.unit.spec.ts src/api/admin/fiscal/emitir-devolucao --runInBand --forceExit`
Expected: PASS.

- [ ] **Step 3: Cockpit — failing test**

Acrescente a `apps/cockpit/lib/fiscal-devolucao.test.ts`:

```typescript
import { resumoValido } from "./fiscal-devolucao"

describe("resumoValido", () => {
  const ok = {
    itens: [{ codigo: "A", descricao: "Top", quantidade: 1, bruto_centavos: 100, desconto_centavos: 0, liquido_centavos: 100 }],
    produtos_centavos: 100, desconto_centavos: 0, total_centavos: 100,
  }

  it("aceita o resumo bem formado", () => {
    expect(resumoValido(ok)).toBe(true)
  })

  it("recusa ausente, sem itens, ou com total que não é inteiro", () => {
    expect(resumoValido(undefined)).toBe(false)
    expect(resumoValido({ ...ok, itens: [] })).toBe(false)
    expect(resumoValido({ ...ok, total_centavos: 1.5 })).toBe(false)
    expect(resumoValido({ ...ok, total_centavos: "100" })).toBe(false)
  })

  it("recusa o formato ANTIGO (payload do fornecedor) — a tela não deve mais entendê-lo", () => {
    expect(resumoValido({ itens: [{ codigo: "A", valor_total: "1.00" }], total: { valor_nota: "1.00" } })).toBe(false)
  })
})
```

(Se o arquivo de teste já importa de `./fiscal-devolucao`, junte o import ao existente.)

Run: `cd apps/cockpit && npx vitest run lib/fiscal-devolucao.test.ts` — Expected: FAIL, `resumoValido` não exportado.

- [ ] **Step 4: Cockpit — implementation**

Em `apps/cockpit/lib/fiscal-devolucao.ts`, acrescente ao final:

```typescript
// Resumo da prévia da NFD, como o backend devolve (em centavos — Invariante 3). A tela lê ISTO,
// nunca o payload do fornecedor.
export type ResumoDevolucao = {
  itens: Array<{
    codigo: string; descricao: string; quantidade: number
    bruto_centavos: number; desconto_centavos: number; liquido_centavos: number
  }>
  produtos_centavos: number
  desconto_centavos: number
  total_centavos: number
}

export function resumoValido(v: unknown): v is ResumoDevolucao {
  const r = v as ResumoDevolucao | undefined
  if (!r || !Array.isArray(r.itens) || r.itens.length === 0) return false
  const inteiros = [r.produtos_centavos, r.desconto_centavos, r.total_centavos]
  if (!inteiros.every((n) => Number.isInteger(n))) return false
  return r.itens.every(
    (i) =>
      typeof i?.codigo === "string" && typeof i?.descricao === "string" &&
      [i.quantidade, i.bruto_centavos, i.desconto_centavos, i.liquido_centavos].every((n) => Number.isInteger(n))
  )
}
```

Em `components/nfd-do-pedido.tsx`:

1. Apague os tipos `ItemPreviaDevolucao`, `TotalPreviaDevolucao`, `PreviaDevolucao` e a função `brlDeString`. Importe `resumoValido, type ResumoDevolucao` de `@/lib/fiscal-devolucao` (junte ao import que já existe) e acrescente:

```typescript
function brl(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
```

2. O estado vira `useState<ResumoDevolucao | null>(null)`.

3. Na função da prévia, troque as duas linhas de validação/atribuição por:

```typescript
      if (!r.ok || !resumoValido(d.resumo)) throw new Error(d.error || "Falha ao montar a prévia da NFD.")
      setPrevia(d.resumo)
```

4. Em `emitir()`: `const totalTxt = brl(previa.total_centavos)`.

5. Na tabela: `{it.descricao}`, `({it.codigo})`, `{it.quantidade}×`, `{brl(it.desconto_centavos)} desc.`, `{brl(it.liquido_centavos)}`. No rodapé: `produtos {brl(previa.produtos_centavos)} − desconto {brl(previa.desconto_centavos)}` e `{brl(previa.total_centavos)}`.

- [ ] **Step 5: Verify and commit**

Run: `cd apps/cockpit && npx vitest run lib/fiscal-devolucao.test.ts && npx tsc --noEmit`
Expected: PASS; nenhum erro de tipo em `nfd-do-pedido.tsx`. Confirme que não sobrou leitura do formato antigo: `grep -n "valor_nota\|payload?.itens\|payload.itens" apps/cockpit -r` não deve achar nada.

```bash
git add apps/backend/src/lib/fiscal/fiscal-payload-devolucao.ts apps/backend/src/lib/fiscal/__tests__/fiscal-payload-devolucao.unit.spec.ts apps/backend/src/api/admin/fiscal/emitir-devolucao apps/cockpit/lib/fiscal-devolucao.ts apps/cockpit/lib/fiscal-devolucao.test.ts apps/cockpit/components/nfd-do-pedido.tsx
git commit -m "fix(fiscal): prévia da NFD usa resumo próprio em centavos, não o payload do fornecedor

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: DANFE sob demanda e campos novos do perfil tributário

**Files:**
- Create: `apps/backend/src/api/admin/fiscal/documentos/[id]/danfe/route.ts`
- Create: `apps/backend/src/api/admin/fiscal/documentos/[id]/danfe/__tests__/route.unit.spec.ts`
- Modify: `apps/backend/src/api/admin/fiscal/perfis/route.ts`
- Create: `apps/cockpit/app/api/fiscal-danfe/[id]/route.ts`
- Modify: `apps/cockpit/lib/fiscal.ts`, `apps/cockpit/lib/fiscal.test.ts`
- Modify: `apps/cockpit/components/fiscal-do-pedido.tsx`
- Modify: `apps/cockpit/app/(painel)/fiscal/page.tsx`

**Interfaces:**
- Consumes: `baixarArquivo(chave, "danfe"): Promise<Buffer>` (Task 5); `lerDocumento`, `ehUuidValido` de `fiscal-db`.
- Produces: `GET /admin/fiscal/documentos/:id/danfe` → `application/pdf`; `GET /api/fiscal-danfe/:id` no Cockpit; `ehUuid(v: string): boolean` em `apps/cockpit/lib/fiscal.ts`.

**Contexto (spec §10).** A API não devolve URL de DANFE nem de XML — `danfe_url` e `xml_url` ficam nulos para sempre, e os links da tela nunca apareceriam. A DANFE precisa ser **impressa no despacho** (vai dentro da caixa), então o operador precisa de um botão que funcione. Ela é buscada no fornecedor sob demanda; o que guardamos é o XML, que é o documento legal.

O proxy genérico `/api/fiscal/[...path]` faz `r.json()` — não serve para PDF. Por isso a rota dedicada, com validação própria do `id` (é o único segmento variável e vai para dentro de uma URL com token de admin — mesma classe do path traversal já corrigido).

- [ ] **Step 1: Backend route — failing test**

`documentos/[id]/danfe/__tests__/route.unit.spec.ts`:

```typescript
describe("GET /admin/fiscal/documentos/:id/danfe", () => {
  const UUID = "3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b"
  const CHAVE = "31260968673407000113550010000000011000000017"

  beforeEach(() => jest.resetModules())
  afterEach(() => jest.restoreAllMocks())

  function fakeRes() {
    const res: any = { statusCode: 200, headers: {} as Record<string, string>, body: undefined as unknown }
    res.status = (c: number) => { res.statusCode = c; return res }
    res.json = (b: unknown) => { res.body = b; return res }
    res.setHeader = (k: string, v: string) => { res.headers[k] = v; return res }
    res.send = (b: unknown) => { res.body = b; return res }
    return res
  }
  function fakeReq(id: string) {
    return { params: { id }, scope: { resolve: () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn() }) } } as any
  }

  function mocks(doc: unknown, baixarArquivo = jest.fn().mockResolvedValue(Buffer.from("%PDF-1.4"))) {
    jest.doMock("../../../../../../../lib/fiscal/fiscal-db", () => ({
      ehUuidValido: (v: string) => /^[0-9a-f-]{36}$/i.test(v),
      lerDocumento: jest.fn(async () => {
        if (!doc) throw new Error("Documento fiscal x não encontrado.")
        return doc
      }),
    }))
    jest.doMock("../../../../../../../lib/fiscal/fiscal-client", () => ({ baixarArquivo }))
    return { baixarArquivo }
  }

  it("id que não é uuid: 400, sem tocar no banco nem no fornecedor", async () => {
    const { baixarArquivo } = mocks({ id: UUID, chave_acesso: CHAVE })
    const { GET } = await import("../route.js")
    const res = fakeRes()
    await GET(fakeReq("../../customers"), res)
    expect(res.statusCode).toBe(400)
    expect(baixarArquivo).not.toHaveBeenCalled()
  })

  it("documento sem chave de acesso: 422 com mensagem legível", async () => {
    mocks({ id: UUID, chave_acesso: null, status: "rejeitado" })
    const { GET } = await import("../route.js")
    const res = fakeRes()
    await GET(fakeReq(UUID), res)
    expect(res.statusCode).toBe(422)
    expect(res.body.error).toMatch(/não foi autorizada/i)
  })

  it("documento autorizado: devolve o PDF com o Content-Type certo", async () => {
    const { baixarArquivo } = mocks({ id: UUID, chave_acesso: CHAVE, status: "verificado" })
    const { GET } = await import("../route.js")
    const res = fakeRes()
    await GET(fakeReq(UUID), res)
    expect(baixarArquivo).toHaveBeenCalledWith(CHAVE, "danfe")
    expect(res.statusCode).toBe(200)
    expect(res.headers["Content-Type"]).toBe("application/pdf")
    expect(Buffer.isBuffer(res.body)).toBe(true)
  })

  it("documento inexistente: 422, não 500", async () => {
    mocks(null)
    const { GET } = await import("../route.js")
    const res = fakeRes()
    await GET(fakeReq(UUID), res)
    expect(res.statusCode).toBe(422)
  })
})
```

Conte os `../` do `doMock` a partir da pasta `__tests__`: `__tests__` → `danfe` → `[id]` → `documentos` → `fiscal` → `admin` → `api` → `src`. São 7 níveis até `src`, depois `lib/fiscal/...`. Se o Jest reclamar de módulo não encontrado, é essa contagem.

Run: `cd apps/backend && TEST_TYPE=unit NODE_OPTIONS=--experimental-vm-modules npx jest "src/api/admin/fiscal/documentos" --runInBand --forceExit` — Expected: FAIL, `../route.js` não existe.

- [ ] **Step 2: Backend route — implementation**

`documentos/[id]/danfe/route.ts`:

```typescript
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { baixarArquivo } from "../../../../../../lib/fiscal/fiscal-client"
import { ehUuidValido, lerDocumento } from "../../../../../../lib/fiscal/fiscal-db"
import { ErroFiscal } from "../../../../../../lib/fiscal/tipos"

// GET /admin/fiscal/documentos/:id/danfe — a DANFE em PDF, buscada no fornecedor sob demanda
// (spec §10). A API da Brasil NFe não devolve URL; e a DANFE não é guardada: o documento legal é
// o XML (fiscal_documento.xml_autorizado). A DANFE é só a representação impressa dele.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const id = String(req.params.id ?? "")

  if (!ehUuidValido(id)) {
    return res.status(400).json({ error: "id precisa ser um uuid válido." })
  }

  try {
    let doc
    try {
      doc = await lerDocumento(id)
    } catch (e) {
      if (/não encontrado/i.test((e as Error).message)) {
        throw new ErroFiscal(`Documento fiscal ${id} não encontrado.`)
      }
      throw e
    }
    if (!doc.chave_acesso) {
      throw new ErroFiscal("Esta nota não foi autorizada — não existe DANFE para baixar.")
    }

    const pdf = await baixarArquivo(doc.chave_acesso, "danfe")
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `inline; filename="danfe-${doc.chave_acesso}.pdf"`)
    return res.status(200).send(pdf)
  } catch (e) {
    const erro = e as Error
    logger.warn(`[fiscal] danfe ${id}: ${erro.message}`)
    return res.status(erro instanceof ErroFiscal ? 422 : 500).json({ error: erro.message })
  }
}
```

Run: o mesmo comando do Step 1. Expected: PASS — 4 testes.

- [ ] **Step 3: Backend — perfil allowlist**

Em `admin/fiscal/perfis/route.ts`, acrescente os dois campos à lista `permitidos`:

```typescript
  const permitidos = [
    "id", "escopo", "alvo_id", "csosn", "cfop_dentro_uf", "cfop_fora_uf",
    "cfop_devolucao_dentro_uf", "cfop_devolucao_fora_uf", "origem_padrao", "ativo",
    "cst_pis_cofins", "cest",
  ]
```

E, logo depois do laço que monta `patch`, normalize vazio para nulo — a tela manda `""` quando o campo está em branco, e `""` viola o `check` da migration 0012:

```typescript
  for (const k of ["cst_pis_cofins", "cest"]) {
    if (k in patch && String(patch[k] ?? "").trim() === "") patch[k] = null
  }
```

- [ ] **Step 4: Cockpit — `ehUuid` with test**

Acrescente a `apps/cockpit/lib/fiscal.test.ts` (junte `ehUuid` ao import existente de `./fiscal`):

```typescript
describe("ehUuid", () => {
  it("aceita uuid", () => {
    expect(ehUuid("3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b")).toBe(true)
  })
  it("recusa qualquer coisa que possa escapar do caminho", () => {
    for (const v of ["", "..", "../customers", "3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b/../x", "3f2b8c1e%2f"]) {
      expect(ehUuid(v)).toBe(false)
    }
  })
})
```

Em `apps/cockpit/lib/fiscal.ts`, ao final:

```typescript
// O id do documento fiscal vai para dentro de uma URL da Admin API com o token de admin anexado.
// Só uuid passa — mesma classe de defesa do validarCaminhoFiscal acima.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function ehUuid(v: string): boolean {
  return UUID_RE.test(v)
}
```

Run: `cd apps/cockpit && npx vitest run lib/fiscal.test.ts` — Expected: PASS.

- [ ] **Step 5: Cockpit — DANFE route**

`apps/cockpit/app/api/fiscal-danfe/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server"
import { medusaAdmin } from "@/lib/medusa"
import { ehUuid } from "@/lib/fiscal"

// DANFE em PDF. Rota dedicada porque o proxy /api/fiscal/* só fala JSON. O id é validado ANTES de
// montar a URL: ele é o único segmento variável de um caminho que recebe o token de admin.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!ehUuid(id)) {
    return NextResponse.json({ error: "Documento inválido." }, { status: 400 })
  }
  try {
    const r = await medusaAdmin(`/admin/fiscal/documentos/${id}/danfe`, { method: "GET" })
    if (!r.ok) {
      const data = await r.json().catch(() => ({}))
      return NextResponse.json(data, { status: r.status })
    }
    return new NextResponse(await r.arrayBuffer(), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline" },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
```

- [ ] **Step 6: Cockpit — component and profile form**

Em `components/fiscal-do-pedido.tsx`: remova `xml_url` e `danfe_url` do tipo `DocumentoFiscal`, e substitua o bloco `{(documento.danfe_url || documento.xml_url) && ( ... )}` inteiro por:

```tsx
      {documento.chave_acesso && (
        <div className="flex gap-3 text-sm">
          <a
            className="text-eclat-dourado underline"
            href={`/api/fiscal-danfe/${documento.id}`}
            target="_blank"
            rel="noreferrer"
          >
            Baixar DANFE (PDF)
          </a>
        </div>
      )}
```

Se algum chamador do componente monta o objeto `documento` citando `xml_url`/`danfe_url`, remova lá também (`grep -rn "danfe_url\|xml_url" apps/cockpit`).

Em `app/(painel)/fiscal/page.tsx`:

1. No tipo `Perfil`, depois de `origem_padrao: number`: `cst_pis_cofins: string | null` e `cest: string | null`.
2. Em `PERFIL_VAZIO`, depois de `origem_padrao: 0,`: `cst_pis_cofins: null,` e `cest: null,`.
3. No formulário, depois do `<div>` de "Origem padrão":

```tsx
          <div><label className={label}>CST PIS/COFINS (2 dígitos, opcional)</label><input className={input} maxLength={2} value={form.cst_pis_cofins ?? ""} onChange={(e) => setForm({ ...form, cst_pis_cofins: e.target.value.replace(/\D/g, "") || null })} /></div>
          <div><label className={label}>CEST (7 dígitos, só se houver ICMS-ST)</label><input className={input} maxLength={7} value={form.cest ?? ""} onChange={(e) => setForm({ ...form, cest: e.target.value.replace(/\D/g, "") || null })} /></div>
```

4. Onde o formulário é preenchido para **edição** (a função que faz `setForm` a partir de um perfil existente), garanta que os dois campos entram — se ela copia campo a campo, acrescente `cst_pis_cofins: p.cst_pis_cofins ?? null, cest: p.cest ?? null`.

- [ ] **Step 7: Verify and commit**

Run: `cd apps/cockpit && npx vitest run && npx tsc --noEmit` — Expected: PASS, sem erro de tipo.
Run: `cd apps/backend && npx tsc --noEmit -p .` — sem erro novo.

```bash
git add apps/backend/src/api/admin/fiscal/documentos apps/backend/src/api/admin/fiscal/perfis/route.ts apps/cockpit/app/api/fiscal-danfe apps/cockpit/lib/fiscal.ts apps/cockpit/lib/fiscal.test.ts apps/cockpit/components/fiscal-do-pedido.tsx "apps/cockpit/app/(painel)/fiscal/page.tsx"
git commit -m "feat(fiscal): DANFE sob demanda e campos CST PIS/COFINS e CEST no perfil

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: SOP fiscal e roteiro de homologação

**Files:**
- Create: `architecture/fiscal.md`
- Modify: `progress.md`

A constituição do projeto (`CLAUDE.md`, "Auto-reparo") manda atualizar o SOP em `architecture/` para o erro nunca se repetir. Não existe SOP fiscal. Esta tarefa o cria, com a lição da revisão 2 como regra permanente.

- [ ] **Step 1: Write `architecture/fiscal.md`**

```markdown
# SOP — Integração fiscal (Brasil NFe)

Spec: `docs/superpowers/specs/2026-09-16-fiscal-brasilnfe-design.md` (revisão 2).
Código: `apps/backend/src/lib/fiscal/`. Dados: Supabase, tabelas `fiscal_*` (migrations 0011 e 0012).

## Regra nº 1 — contrato de fornecedor não se supõe

A revisão 1 deste módulo foi escrita, revisada e mesclada com 151 testes verdes — e nenhuma nota
autorizada teria sido reconhecida, porque código **e fixtures** nasceram da mesma suposição sobre
o formato da API. Teste contra contrato inventado mede coerência interna, não correção.

Portanto, para qualquer integração externa:

1. **Antes do código**, obter o contrato de uma fonte do fornecedor: documentação, SDK oficial
   (os tipos servem de contrato mesmo sem usar o SDK) ou resposta real de sandbox.
2. **Toda fixture cita a fonte** num comentário (`// formato: SDK brasilnfe@3.1.3, NotaFiscalRetorno`).
3. Nome de campo, endpoint ou formato marcado como "pendente de confirmação" **bloqueia o merge**,
   não vira comentário.

Fontes da Brasil NFe: `https://www.brasilnfe.com.br/llms-full.txt` (documentação inteira em texto),
`/webhooks`, `/conceitos-fiscais/*`, e o pacote npm `brasilnfe` (tipos em `dist/models/`).

## O contrato, em uma tela

- Base `https://api.brasilnfe.com.br/services/fiscal/` · todos `POST` · headers `Token` + `UserToken`.
- `EnviarNotaFiscal` é **síncrono** (timeout de 5 min) e **não dispara webhook**. A resposta traz
  `ReturnNF { Ok, CodStatusRespostaSefaz, ChaveNF, Numero, Serie }` + `Base64Xml` + `Base64File`.
- Autorizado = `Ok === true` **e** código 100/150. Combinação incoerente = **indefinido**, nunca adivinhado.
- A **posição** no array `Produtos` é o `nItem`. Não existe campo para informá-lo.
- Emitente, totais e numeração **não são enviados**: cadastro, cálculo e contador são do fornecedor.
- `Intermediador` **não é enviado** (venda direta; enviar é rejeição 435). O exemplo de JSON deles o inclui.
- NFD: `ChaveAcessoReferenciada` + `NItemReferenciado` **por produto**. `NFReferencia` (raiz) nunca.

## Nota duplicada — a barreira é só nossa

Com numeração automática, a SEFAZ aceita duas notas para o mesmo pedido (cada tentativa ganha
número novo). Defesas, todas em `fiscal-emissao.ts`:

1. grava o documento **antes** de transmitir, com `idempotency_key` única;
2. a chave viaja no payload como `IdentificadorInterno`;
3. antes de **qualquer** nova tentativa, `prepararTentativa` pergunta ao fornecedor se alguma
   tentativa anterior existe lá (`ObterNotasFiscais`). Se existe, adota. Se a consulta falha, **não emite**;
4. resposta que não fecha → `transmitido_sem_confirmacao`. A varredura localiza; **nunca** conclui
   sozinha que "não emitiu" — só a rota manual `resolver` declara isso.

## Webhook

HMAC-SHA256 do **corpo bruto** (`req.rawBody`, via `preserveRawBody` em `middlewares.ts`), header
`X-Webhook-Signature: sha256=<hex>`, comparação em tempo constante, 401 se inválido. Reserializar o
JSON quebra a assinatura. O webhook não é gatilho da reconciliação de vendas (a rota síncrona não o dispara).

## Roteiro de homologação (o dono executa; nenhum agente consegue)

Pré-requisitos: migration 0012 aplicada; empresa cadastrada no painel da Brasil NFe com os dados
do §6.0 da spec, certificado A1 carregado, **ambiente = homologação**; tokens no `.env` do backend;
perfil tributário padrão e NCM em ao menos um produto; `fiscal_config.ambiente = homologacao`.

1. **Prévia de venda** (não transmite): Cockpit → pedido de teste → prévia. Conferir no XML: NCM,
   CFOP, CSOSN, `vFrete` rateado, ausência de `infIntermed`. **Verificar se há grupo IBSCBS** (risco 1).
2. Ligar `emissao_ativa`. **Despachar** o pedido de teste. Esperado: documento vai a `verificado`
   na hora; `numero`, `serie`, `chave_acesso` preenchidos; "Baixar DANFE" abre o PDF.
3. **Despachar de novo** o mesmo pedido: nenhuma nota nova (conferir no painel deles).
4. **Prévia de NFD** de 1 item de um pedido com 2. Conferir `refNFe`/`nItem` do item certo.
5. **Emitir a NFD**. Se a SEFAZ rejeitar por destinatário (VC02-50), é o risco 10 da spec: o bloco
   `Cliente` de `fiscal-payload-devolucao.ts` é o único ponto a mudar.
6. **Webhook**: painel deles → Webhooks → Testar. Esperado 200. Conferir no log `test.ping`.
7. Anotar em `progress.md` o resultado de cada passo e qualquer rejeição com o código.

Produção só depois dos riscos 1 (IBS/CBS) e 3 (tabela do contador) da spec resolvidos.
```

- [ ] **Step 2: Update `progress.md`**

Acrescente ao final uma seção `## Fiscal — revisão 2 (contrato real da Brasil NFe)` com: a data; um parágrafo dizendo que a revisão 1 estava em `main` com emissão desligada e nunca transmitiu; a lista das quatro divergências (copie a tabela do §14 da spec); o que foi entregue neste plano (uma linha por tarefa); e as **pendências do dono**, nesta ordem: aplicar a migration 0012 · cadastrar a empresa e o certificado no painel da Brasil NFe · colocar os tokens e o segredo do webhook no `.env` · cadastrar o webhook no painel apontando para `/webhooks/brasilnfe` · obter a tabela do contador · executar o roteiro de homologação de `architecture/fiscal.md` · `git push`.

- [ ] **Step 3: Full verification**

Run: `cd apps/backend && TEST_TYPE=unit NODE_OPTIONS=--experimental-vm-modules npx jest --runInBand --forceExit` — a suíte **inteira** do backend, não só a fiscal.
Run: `cd apps/cockpit && npx vitest run`
Run: `cd apps/storefront && npx vitest run` (não foi tocada — deve continuar 286/26).
Expected: tudo verde. Registre os três totais no `progress.md`.

Depois, a varredura final por resíduo do contrato antigo — cada comando abaixo deve voltar **vazio**:

```bash
grep -rn "v1/nfe\|baixarXml\|consultarPorChave\|RespostaTransmissao" apps/backend/src
grep -rn "req.query?.token\|query.token" apps/backend/src/api/webhooks/brasilnfe
grep -rn "natureza_operacao\|ind_presenca\|documentos_referenciados\|numero_item" apps/backend/src/lib/fiscal --include=*.ts --exclude-dir=__tests__
grep -rn "pendente de confirma\|ainda não confrontado\|melhor leitura" apps/backend/src/lib/fiscal apps/backend/src/api
```

O último é o mais importante: é a busca pelos comentários que **admitiam o chute**. Se algum sobrou, o campo ao lado dele ainda é suposição — confronte com a spec §7.0/§7.1.1 antes de apagar o comentário.

- [ ] **Step 4: Commit**

```bash
git add architecture/fiscal.md progress.md
git commit -m "docs(fiscal): SOP da integração fiscal e roteiro de homologação

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
