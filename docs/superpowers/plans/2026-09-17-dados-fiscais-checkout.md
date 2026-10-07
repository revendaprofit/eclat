# Dados Fiscais no Checkout — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Coletar CPF, número, bairro e código IBGE do município no checkout da vitrine, para que a emissão de NF-e (já pronta em `main`) possa ser ligada.

**Architecture:** Toda lógica que pode errar mora em funções puras em `src/lib/util/`, onde o Vitest da vitrine alcança. Um componente único de campos de endereço, com busca de CEP, serve o checkout e o cadastro da conta — uma fonte da verdade. A busca de CEP passa por uma rota nossa (casca fina sobre funções puras), com cache, para que o navegador da cliente não fale com terceiro. O CPF é sempre copiado para o pedido; salvá-lo na cliente é só conveniência de pré-preenchimento.

**Tech Stack:** Next.js 15 (App Router, Server Actions) · Medusa v2 Store API · Vitest (`environment: "node"`, só funções puras) · Cockpit Next.js 15.5

**Spec:** `docs/superpowers/specs/2026-09-17-dados-fiscais-checkout-design.md`

## Global Constraints

- **O backend NÃO muda.** `apps/backend/src/lib/fiscal/fiscal-pedido.ts` já lê `order.metadata.cpf`, `shipping_address.metadata.numero`, `.bairro` e `.municipio_ibge`. Se precisar mudar o backend, o desenho está errado — pare e relate.
- **Chaves de `metadata`, exatas:** `cpf`, `numero`, `bairro`, `municipio_ibge`. O IBGE tem **7 dígitos**.
- **O CPF vai SEMPRE para `order.metadata.cpf`.** `customer.metadata.cpf` é só pré-preenchimento e nunca é a fonte da nota.
- **Falha de terceiro nunca custa uma venda.** CEP não encontrado ou provedor fora do ar liberam digitação manual e a compra segue. O único bloqueio é CPF com dígito verificador inválido.
- **Nenhum teste faz chamada de rede real.**
- **O Vitest da vitrine é restrito a funções puras** (`vitest.config.ts`: `include: ["src/**/*.test.ts"]`, `environment: "node"`, comentário "Nada de React, nada de `server-only`"). Não escreva teste que importe componente React ou route handler — não roda.
- **Estilo:** TypeScript sem ponto-e-vírgula, aspas duplas, textos e comentários em **português**. Siga `src/lib/util/catalog-filters.ts` e `src/modules/checkout/components/shipping-address/index.tsx`.
- **Dinheiro não aparece aqui.** Se aparecer, é centavos inteiros.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `apps/storefront/src/lib/util/cpf.ts` | Normalizar, validar dígitos verificadores, formatar CPF |
| `apps/storefront/src/lib/util/cep.ts` | Normalizar/validar CEP, montar URL do provedor, interpretar a resposta |
| `apps/storefront/src/lib/util/endereco-fiscal.ts` | Montar o `metadata` que `fiscal-pedido.ts` espera |
| `apps/storefront/src/app/api/cep/[cep]/route.ts` | Casca fina: valida, busca com cache, parseia, devolve |
| `apps/storefront/src/modules/common/components/address-fields/index.tsx` | Campos de endereço compartilhados, com busca de CEP |
| `apps/storefront/src/modules/checkout/components/shipping-address/index.tsx` | **Modificar**: usar o componente + campo CPF |
| `apps/storefront/src/modules/checkout/components/billing_address/index.tsx` | **Modificar**: usar o componente |
| `apps/storefront/src/lib/data/cart.ts` | **Modificar**: `setAddresses` repassa `metadata` e `cpf` |
| `apps/storefront/src/modules/account/components/address-card/add-address.tsx` | **Modificar**: usar o componente |
| `apps/storefront/src/modules/account/components/address-card/edit-address-modal.tsx` | **Modificar**: usar o componente |
| `apps/cockpit/lib/dados-fiscais.ts` | Decidir o que falta num pedido (função pura) |
| `apps/cockpit/lib/cep.ts` | **Cópia deliberada** de `storefront/src/lib/util/cep.ts` — apps separados, sem pacote compartilhado neste monorepo |
| `apps/cockpit/app/api/cep/[cep]/route.ts` | Busca de CEP para o Cockpit (o app não alcança a rota da vitrine) |
| `apps/cockpit/components/dados-fiscais-do-pedido.tsx` | Bloco que completa os dados fiscais de um pedido |
| `apps/cockpit/app/(painel)/pedidos/page.tsx` | **Modificar**: renderizar o bloco |
| `apps/cockpit/app/api/orders/[id]/dados-fiscais/route.ts` | Gravar os dados fiscais via Admin API |

**Sobre a cópia do `cep.ts`:** dois apps Next separados, sem pacote compartilhado. Criar um só para quatro funções puras acrescentaria build, versionamento e um lugar a mais para quebrar. A duplicação é de ~20 linhas, tem teste dos dois lados, e o arquivo carrega comentário dizendo que mudança precisa ir aos dois. Decisão consciente, não descuido.

---

### Task 1: Validação de CPF

**Files:**
- Create: `apps/storefront/src/lib/util/cpf.ts`
- Test: `apps/storefront/src/lib/util/cpf.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: `normalizarCpf(v: string): string` · `cpfValido(v: string): boolean` · `formatarCpf(v: string): string`

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/storefront/src/lib/util/cpf.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { normalizarCpf, cpfValido, formatarCpf } from "./cpf"

describe("normalizarCpf", () => {
  it("tira máscara e espaços", () => {
    expect(normalizarCpf("529.982.247-25")).toBe("52998224725")
    expect(normalizarCpf(" 529 982 247 25 ")).toBe("52998224725")
  })

  it("devolve string vazia para entrada vazia", () => {
    expect(normalizarCpf("")).toBe("")
  })
})

describe("cpfValido", () => {
  it("aceita CPFs válidos conhecidos", () => {
    expect(cpfValido("529.982.247-25")).toBe(true)
    expect(cpfValido("52998224725")).toBe(true)
    expect(cpfValido("111.444.777-35")).toBe(true)
  })

  it("rejeita dígito verificador errado", () => {
    expect(cpfValido("529.982.247-26")).toBe(false)
    expect(cpfValido("111.444.777-30")).toBe(false)
  })

  it("rejeita todos os dígitos iguais, que passam no cálculo mas não são CPF", () => {
    expect(cpfValido("111.111.111-11")).toBe(false)
    expect(cpfValido("00000000000")).toBe(false)
    expect(cpfValido("99999999999")).toBe(false)
  })

  it("rejeita tamanho errado", () => {
    expect(cpfValido("5299822472")).toBe(false)
    expect(cpfValido("529982247250")).toBe(false)
  })

  it("rejeita vazio e lixo", () => {
    expect(cpfValido("")).toBe(false)
    expect(cpfValido("abc.def.ghi-jk")).toBe(false)
  })
})

describe("formatarCpf", () => {
  it("aplica a máscara", () => {
    expect(formatarCpf("52998224725")).toBe("529.982.247-25")
  })

  it("devolve o que recebeu quando não dá para formatar", () => {
    expect(formatarCpf("529")).toBe("529")
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd apps/storefront && npx vitest run src/lib/util/cpf.test.ts
```

Esperado: FAIL — não encontra `./cpf`.

- [ ] **Step 3: Implementar**

Criar `apps/storefront/src/lib/util/cpf.ts`:

```typescript
// Validação de CPF por dígito verificador. Função PURA: sem rede, sem I/O.
//
// Isto NÃO prova que o CPF existe na Receita — prova que os dígitos fecham.
// Serve para pegar erro de digitação antes de o pedido virar nota fiscal, onde
// um CPF errado só apareceria na rejeição da SEFAZ, com a cliente já esperando.

export function normalizarCpf(v: string): string {
  return (v || "").replace(/\D/g, "")
}

// Calcula um dígito verificador sobre os `n` primeiros dígitos.
function digito(cpf: string, n: number): number {
  let soma = 0
  for (let i = 0; i < n; i++) {
    soma += Number(cpf[i]) * (n + 1 - i)
  }
  const resto = (soma * 10) % 11
  return resto === 10 ? 0 : resto
}

export function cpfValido(v: string): boolean {
  const cpf = normalizarCpf(v)
  if (cpf.length !== 11) return false

  // 111.111.111-11 e os outros repetidos FECHAM a conta dos dígitos verificadores,
  // mas não são CPF. Sem esta checagem, o campo aceitaria o placeholder mais óbvio.
  if (/^(\d)\1{10}$/.test(cpf)) return false

  return digito(cpf, 9) === Number(cpf[9]) && digito(cpf, 10) === Number(cpf[10])
}

export function formatarCpf(v: string): string {
  const cpf = normalizarCpf(v)
  if (cpf.length !== 11) return v
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
cd apps/storefront && npx vitest run src/lib/util/cpf.test.ts
```

Esperado: PASS, 9 testes.

- [ ] **Step 5: Commit**

```bash
git add apps/storefront/src/lib/util/cpf.ts apps/storefront/src/lib/util/cpf.test.ts
git commit -m "feat(vitrine): validacao de CPF por digito verificador"
```

---

### Task 2: CEP e interpretação da resposta do provedor

**Files:**
- Create: `apps/storefront/src/lib/util/cep.ts`
- Test: `apps/storefront/src/lib/util/cep.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `type EnderecoCep = { logradouro: string; bairro: string; cidade: string; uf: string; ibge: string }`
  - `normalizarCep(v: string): string`
  - `cepValido(v: string): boolean`
  - `urlProvedorCep(cep: string): string`
  - `parseRespostaCep(bruto: unknown): EnderecoCep | null`

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/storefront/src/lib/util/cep.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { normalizarCep, cepValido, urlProvedorCep, parseRespostaCep } from "./cep"

describe("normalizarCep", () => {
  it("tira máscara e espaços", () => {
    expect(normalizarCep("32604-182")).toBe("32604182")
    expect(normalizarCep(" 32604 182 ")).toBe("32604182")
  })
})

describe("cepValido", () => {
  it("aceita 8 dígitos", () => {
    expect(cepValido("32604182")).toBe(true)
    expect(cepValido("32604-182")).toBe(true)
  })

  it("rejeita tamanho errado, vazio e lixo", () => {
    expect(cepValido("3260418")).toBe(false)
    expect(cepValido("326041820")).toBe(false)
    expect(cepValido("")).toBe(false)
    expect(cepValido("abcdefgh")).toBe(false)
  })
})

describe("urlProvedorCep", () => {
  it("monta a URL com o CEP normalizado", () => {
    expect(urlProvedorCep("32604-182")).toBe("https://viacep.com.br/ws/32604182/json/")
  })
})

describe("parseRespostaCep", () => {
  const respostaReal = {
    cep: "32604-182",
    logradouro: "Rua Norte",
    complemento: "",
    bairro: "Angola",
    localidade: "Betim",
    uf: "MG",
    ibge: "3106705",
  }

  it("mapeia a resposta real para a nossa forma", () => {
    expect(parseRespostaCep(respostaReal)).toEqual({
      logradouro: "Rua Norte",
      bairro: "Angola",
      cidade: "Betim",
      uf: "MG",
      ibge: "3106705",
    })
  })

  it("devolve null quando o provedor sinaliza CEP inexistente", () => {
    // O ViaCEP responde HTTP 200 com { erro: true } — não um status de erro.
    // Quem olha só o status acha que deu certo e preenche o endereço com campos vazios.
    expect(parseRespostaCep({ erro: true })).toBeNull()
    expect(parseRespostaCep({ erro: "true" })).toBeNull()
  })

  it("devolve null quando falta o ibge, que é o campo que a nota exige", () => {
    const { ibge: _ibge, ...semIbge } = respostaReal
    expect(parseRespostaCep(semIbge)).toBeNull()
  })

  it("devolve null quando o ibge não tem 7 dígitos", () => {
    expect(parseRespostaCep({ ...respostaReal, ibge: "310670" })).toBeNull()
    expect(parseRespostaCep({ ...respostaReal, ibge: "" })).toBeNull()
  })

  it("devolve null para entrada que não é objeto", () => {
    expect(parseRespostaCep(null)).toBeNull()
    expect(parseRespostaCep("texto")).toBeNull()
    expect(parseRespostaCep(undefined)).toBeNull()
  })

  it("aceita logradouro e bairro vazios — CEP de cidade inteira ainda serve", () => {
    const geral = { ...respostaReal, logradouro: "", bairro: "" }
    expect(parseRespostaCep(geral)).toEqual({
      logradouro: "",
      bairro: "",
      cidade: "Betim",
      uf: "MG",
      ibge: "3106705",
    })
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd apps/storefront && npx vitest run src/lib/util/cep.test.ts
```

Esperado: FAIL — não encontra `./cep`.

- [ ] **Step 3: Implementar**

Criar `apps/storefront/src/lib/util/cep.ts`:

```typescript
// CEP e a resposta do provedor de busca. Funções PURAS: sem rede, sem I/O.
//
// O provedor (ViaCEP) fica isolado aqui — trocar de provedor é mudar este arquivo,
// não o formulário nem a rota.
//
// Por que o parse é tão desconfiado: o ViaCEP responde CEP inexistente com
// HTTP 200 e corpo { "erro": true }. Código que confia no status acha que deu certo
// e preenche o endereço com campos vazios. E sem `ibge` de 7 dígitos a nota não sai —
// então resposta sem ele vale tanto quanto resposta nenhuma.

export type EnderecoCep = {
  logradouro: string
  bairro: string
  cidade: string
  uf: string
  ibge: string
}

export function normalizarCep(v: string): string {
  return (v || "").replace(/\D/g, "")
}

export function cepValido(v: string): boolean {
  return /^\d{8}$/.test(normalizarCep(v))
}

export function urlProvedorCep(cep: string): string {
  return `https://viacep.com.br/ws/${normalizarCep(cep)}/json/`
}

export function parseRespostaCep(bruto: unknown): EnderecoCep | null {
  if (!bruto || typeof bruto !== "object") return null

  const r = bruto as Record<string, unknown>

  // CEP inexistente: HTTP 200 com { erro: true } (às vezes como string "true").
  if (r.erro === true || r.erro === "true") return null

  const ibge = String(r.ibge ?? "")
  if (!/^\d{7}$/.test(ibge)) return null

  return {
    logradouro: String(r.logradouro ?? ""),
    bairro: String(r.bairro ?? ""),
    cidade: String(r.localidade ?? ""),
    uf: String(r.uf ?? ""),
    ibge,
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
cd apps/storefront && npx vitest run src/lib/util/cep.test.ts
```

Esperado: PASS, 10 testes.

- [ ] **Step 5: Commit**

```bash
git add apps/storefront/src/lib/util/cep.ts apps/storefront/src/lib/util/cep.test.ts
git commit -m "feat(vitrine): normalizacao de CEP e parse da resposta do provedor"
```

---

### Task 3: Montagem do `metadata` fiscal

**Files:**
- Create: `apps/storefront/src/lib/util/endereco-fiscal.ts`
- Test: `apps/storefront/src/lib/util/endereco-fiscal.test.ts`

**Interfaces:**
- Consumes: `EnderecoCep` (Task 2)
- Produces:
  - `type MetadataFiscal = { numero: string; bairro: string; municipio_ibge: string }`
  - `montarMetadataFiscal(args: { numero: string; bairro: string; ibge: string }): MetadataFiscal`

> Este arquivo **não** tem função de "o que falta". O Cockpit tem a sua (Task 9), porque lá o veredito é sobre um pedido inteiro, não sobre um endereço. Uma segunda versão aqui ficaria sem consumidor.

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/storefront/src/lib/util/endereco-fiscal.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { montarMetadataFiscal } from "./endereco-fiscal"

describe("montarMetadataFiscal", () => {
  it("produz exatamente as chaves que o backend fiscal lê", () => {
    const m = montarMetadataFiscal({ numero: "180", bairro: "Angola", ibge: "3106705" })
    expect(m).toEqual({ numero: "180", bairro: "Angola", municipio_ibge: "3106705" })
    expect(Object.keys(m).sort()).toEqual(["bairro", "municipio_ibge", "numero"])
  })

  it("apara espaços", () => {
    const m = montarMetadataFiscal({ numero: " 180 ", bairro: " Angola ", ibge: " 3106705 " })
    expect(m).toEqual({ numero: "180", bairro: "Angola", municipio_ibge: "3106705" })
  })

  it("aceita número sem valor como S/N — imóvel sem número existe", () => {
    expect(montarMetadataFiscal({ numero: "", bairro: "Angola", ibge: "3106705" }).numero).toBe("S/N")
  })
})

describe("montarMetadataFiscal — o contrato com o backend", () => {
  it("não inventa chave nenhuma além das três que fiscal-pedido.ts lê", () => {
    const m = montarMetadataFiscal({ numero: "180", bairro: "Angola", ibge: "3106705" })
    // Chave a mais é inofensiva; chave a MENOS ou com nome diferente quebra a emissão
    // sem quebrar teste nenhum do checkout. Por isso a asserção é exata.
    expect(Object.keys(m)).toHaveLength(3)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd apps/storefront && npx vitest run src/lib/util/endereco-fiscal.test.ts
```

Esperado: FAIL — não encontra `./endereco-fiscal`.

- [ ] **Step 3: Implementar**

Criar `apps/storefront/src/lib/util/endereco-fiscal.ts`:

```typescript
// O contrato com a camada fiscal do backend. Funções PURAS.
//
// As chaves aqui NÃO são escolha nossa: apps/backend/src/lib/fiscal/fiscal-pedido.ts
// lê exatamente `numero`, `bairro` e `municipio_ibge` do metadata do endereço.
// Mudar um nome aqui quebra a emissão de nota sem quebrar teste nenhum do checkout.

export type MetadataFiscal = {
  numero: string
  bairro: string
  municipio_ibge: string
}

export function montarMetadataFiscal(args: {
  numero: string
  bairro: string
  ibge: string
}): MetadataFiscal {
  return {
    // Imóvel sem número existe, e a NF-e aceita "S/N". Deixar vazio faria o
    // despacho recusar por um dado que a cliente não tem como fornecer.
    numero: args.numero.trim() || "S/N",
    bairro: args.bairro.trim(),
    municipio_ibge: args.ibge.trim(),
  }
}

```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
cd apps/storefront && npx vitest run src/lib/util/endereco-fiscal.test.ts
```

Esperado: PASS, 4 testes.

- [ ] **Step 5: Rodar a bateria toda**

```bash
cd apps/storefront && npm run test
```

Esperado: todos os testes existentes continuam verdes, mais os 23 novos das Tasks 1–3 (9 + 10 + 4).

- [ ] **Step 6: Commit**

```bash
git add apps/storefront/src/lib/util/endereco-fiscal.ts apps/storefront/src/lib/util/endereco-fiscal.test.ts
git commit -m "feat(vitrine): contrato de metadata fiscal do endereco"
```

---

### Task 4: Rota de busca de CEP

**Files:**
- Create: `apps/storefront/src/app/api/cep/[cep]/route.ts`

**Interfaces:**
- Consumes: `cepValido`, `normalizarCep`, `urlProvedorCep`, `parseRespostaCep` (Task 2)
- Produces: `GET /api/cep/{cep}` → `200 { logradouro, bairro, cidade, uf, ibge }` · `400 { error }` · `404 { error }` · `502 { error }`

**Sem teste automatizado, de propósito:** o Vitest da vitrine roda com `environment: "node"` e o próprio `vitest.config.ts` declara "Nada de React, nada de `server-only`". Importar o route handler puxaria `next/server`. Por isso toda a lógica que pode errar está nas funções puras da Task 2, já testadas — o handler abaixo só orquestra.

- [ ] **Step 1: Escrever a rota**

Criar `apps/storefront/src/app/api/cep/[cep]/route.ts`:

```typescript
import { NextResponse } from "next/server"
import { cepValido, normalizarCep, parseRespostaCep, urlProvedorCep } from "@lib/util/cep"

// Busca de CEP pelo nosso backend, não pelo navegador da cliente.
//
// Três razões: o CEP dela não vai para um terceiro sem passar por nós; o cache
// abaixo faz o segundo pedido do mesmo CEP não gerar chamada externa nenhuma
// (CEP -> IBGE é dado estável); e uma queda do provedor aparece no nosso log em
// vez de virar reclamação de cliente.
//
// Esta rota é casca fina: validar, buscar, parsear e mapear moram em
// src/lib/util/cep.ts, que tem teste. Aqui só há orquestração.

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ cep: string }> }
) {
  const { cep } = await ctx.params

  if (!cepValido(cep)) {
    return NextResponse.json({ error: "CEP deve ter 8 dígitos." }, { status: 400 })
  }

  let bruto: unknown
  try {
    const r = await fetch(urlProvedorCep(cep), {
      // CEP -> IBGE não muda. Cache permanente evita chamada externa repetida.
      cache: "force-cache",
      headers: { Accept: "application/json" },
    })
    if (!r.ok) {
      return NextResponse.json(
        { error: "Serviço de CEP indisponível. Preencha o endereço manualmente." },
        { status: 502 }
      )
    }
    bruto = await r.json()
  } catch {
    return NextResponse.json(
      { error: "Serviço de CEP indisponível. Preencha o endereço manualmente." },
      { status: 502 }
    )
  }

  const endereco = parseRespostaCep(bruto)
  if (!endereco) {
    return NextResponse.json(
      { error: "CEP não encontrado. Preencha o endereço manualmente." },
      { status: 404 }
    )
  }

  return NextResponse.json(endereco)
}
```

- [ ] **Step 2: Verificar com o servidor rodando**

```bash
cd apps/storefront && npm run dev
```

Em outro terminal, quatro casos:

```bash
curl -s http://localhost:8000/api/cep/32604182
curl -s http://localhost:8000/api/cep/32604-182
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/api/cep/123
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/api/cep/99999999
```

Esperado, na ordem: JSON com `"ibge":"3106705"` e `"cidade":"Betim"`; o mesmo (máscara aceita); `400`; `404`.

Se o servidor não subir neste ambiente, **relate e siga** — não invente que passou.

- [ ] **Step 3: Verificar que o tipo compila**

```bash
cd apps/storefront && npx tsc --noEmit
```

Esperado: nenhum erro apontando `src/app/api/cep/`.

- [ ] **Step 4: Commit**

```bash
git add apps/storefront/src/app/api/cep/
git commit -m "feat(vitrine): rota de busca de CEP com cache"
```

---

### Task 5: Componente compartilhado de campos de endereço

**Files:**
- Create: `apps/storefront/src/modules/common/components/address-fields/index.tsx`

**Interfaces:**
- Consumes: `cepValido`, `normalizarCep`, `EnderecoCep` (Task 2); `Input` de `@modules/common/components/input`; `CountrySelect` de `@modules/checkout/components/country-select`
- Produces:
```ts
type AddressFieldsProps = {
  prefixo: string                              // "shipping_address" | "billing_address" | ""
  valores: Record<string, string>              // chaveado com o prefixo, ex. "shipping_address.city"
  onChange: (campo: string, valor: string) => void
  countriesInRegion?: string[]
  region?: HttpTypes.StoreRegion
}
export default function AddressFields(props: AddressFieldsProps): JSX.Element
```

Nomes de campo emitidos (com o prefixo aplicado): `postal_code`, `address_1`, `metadata.numero`, `address_2`, `metadata.bairro`, `city`, `province`, `country_code`, e o hidden `metadata.municipio_ibge`.

- [ ] **Step 1: Escrever o componente**

Criar `apps/storefront/src/modules/common/components/address-fields/index.tsx`:

```tsx
"use client"

import { HttpTypes } from "@medusajs/types"
import Input from "@modules/common/components/input"
import CountrySelect from "@modules/checkout/components/country-select"
import { cepValido, normalizarCep, type EnderecoCep } from "@lib/util/cep"
import { useState } from "react"

// Campos de endereço usados pelo checkout E pelo cadastro da conta.
//
// Existe um só porque endereço salvo na conta também vira nota fiscal: se os dois
// formulários divergirem, a cliente logada escolhe um endereço salvo sem número,
// bairro ou IBGE e o despacho falha — sem ela ter feito nada errado.
//
// O código IBGE nunca aparece para a cliente: ela não sabe o da própria cidade.
// Ele vem da busca de CEP e viaja num input hidden.

type AddressFieldsProps = {
  prefixo: string
  valores: Record<string, string>
  onChange: (campo: string, valor: string) => void
  countriesInRegion?: string[]
  region?: HttpTypes.StoreRegion
}

export default function AddressFields({
  prefixo,
  valores,
  onChange,
  countriesInRegion,
  region,
}: AddressFieldsProps) {
  const [buscando, setBuscando] = useState(false)
  const [avisoCep, setAvisoCep] = useState<string | null>(null)

  const n = (campo: string) => (prefixo ? `${prefixo}.${campo}` : campo)
  const v = (campo: string) => valores[n(campo)] || ""

  async function buscarCep(bruto: string) {
    const cep = normalizarCep(bruto)
    if (!cepValido(cep)) return

    setBuscando(true)
    setAvisoCep(null)
    try {
      const r = await fetch(`/api/cep/${cep}`)
      if (!r.ok) {
        const { error } = (await r.json()) as { error?: string }
        // Falha de terceiro NÃO custa a venda: avisa e libera a digitação manual.
        setAvisoCep(error || "Não foi possível buscar o CEP. Preencha manualmente.")
        return
      }
      const e = (await r.json()) as EnderecoCep
      onChange(n("address_1"), e.logradouro)
      onChange(n("metadata.bairro"), e.bairro)
      onChange(n("city"), e.cidade)
      onChange(n("province"), e.uf)
      onChange(n("metadata.municipio_ibge"), e.ibge)
    } catch {
      setAvisoCep("Não foi possível buscar o CEP. Preencha manualmente.")
    } finally {
      setBuscando(false)
    }
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <Input
        label="CEP"
        name={n("postal_code")}
        autoComplete="postal-code"
        value={v("postal_code")}
        onChange={(e) => {
          onChange(n("postal_code"), e.target.value)
          void buscarCep(e.target.value)
        }}
        required
        data-testid="input-cep"
      />
      <div className="flex items-end text-sm text-ui-fg-subtle">
        {buscando ? "Buscando endereço…" : avisoCep}
      </div>

      <Input
        label="Endereço"
        name={n("address_1")}
        autoComplete="address-line1"
        value={v("address_1")}
        onChange={(e) => onChange(n("address_1"), e.target.value)}
        required
        data-testid="input-endereco"
      />
      <Input
        label="Número"
        name={n("metadata.numero")}
        autoComplete="address-line2"
        value={v("metadata.numero")}
        onChange={(e) => onChange(n("metadata.numero"), e.target.value)}
        required
        data-testid="input-numero"
      />

      <Input
        label="Complemento"
        name={n("address_2")}
        value={v("address_2")}
        onChange={(e) => onChange(n("address_2"), e.target.value)}
        data-testid="input-complemento"
      />
      <Input
        label="Bairro"
        name={n("metadata.bairro")}
        value={v("metadata.bairro")}
        onChange={(e) => onChange(n("metadata.bairro"), e.target.value)}
        required
        data-testid="input-bairro"
      />

      <Input
        label="Cidade"
        name={n("city")}
        autoComplete="address-level2"
        value={v("city")}
        onChange={(e) => onChange(n("city"), e.target.value)}
        required
        data-testid="input-cidade"
      />
      <Input
        label="Estado"
        name={n("province")}
        autoComplete="address-level1"
        value={v("province")}
        onChange={(e) => onChange(n("province"), e.target.value)}
        required
        data-testid="input-estado"
      />

      <CountrySelect
        name={n("country_code")}
        autoComplete="country"
        region={region}
        value={v("country_code")}
        onChange={(e) => onChange(n("country_code"), e.target.value)}
        required
        data-testid="select-pais"
      />

      {/* A cliente não digita código IBGE — ele vem da busca de CEP. */}
      <input type="hidden" name={n("metadata.municipio_ibge")} value={v("metadata.municipio_ibge")} />
    </div>
  )
}
```

> **Se `CountrySelect` não aceitar essas props**, leia `src/modules/checkout/components/country-select/index.tsx` e ajuste a chamada ao que ele realmente expõe. Não mude o `CountrySelect`.

- [ ] **Step 2: Verificar que compila**

```bash
cd apps/storefront && npx tsc --noEmit
```

Esperado: nenhum erro apontando `address-fields`. Os erros pré-existentes em outros arquivos, se houver, não são seus — relate a contagem.

- [ ] **Step 3: Commit**

```bash
git add apps/storefront/src/modules/common/components/address-fields/
git commit -m "feat(vitrine): componente compartilhado de campos de endereco com busca de CEP"
```

---

### Task 6: Checkout usa o componente e coleta CPF

**Files:**
- Modify: `apps/storefront/src/modules/checkout/components/shipping-address/index.tsx`
- Modify: `apps/storefront/src/modules/checkout/components/billing_address/index.tsx`
- Modify: `apps/storefront/src/lib/data/cart.ts:340-370` (`setAddresses`)

**Interfaces:**
- Consumes: `AddressFields` (Task 5), `cpfValido`, `formatarCpf` (Task 1)
- Produces: pedido com `cart.metadata.cpf` e `shipping_address.metadata` preenchidos

- [ ] **Step 1: Trocar os campos de endereço pelo componente**

Em `shipping-address/index.tsx`, substitua o bloco de `<Input>` de endereço (Endereço, CEP, Cidade, País, Estado — linhas ~134 a ~185) por:

```tsx
<AddressFields
  prefixo="shipping_address"
  valores={formData}
  onChange={(campo, valor) => setFormData((p) => ({ ...p, [campo]: valor }))}
  countriesInRegion={countriesInRegion}
  region={cart?.region}
/>
```

Acrescente ao `useState` inicial de `formData` as três chaves novas, lidas do carrinho:

```ts
"shipping_address.address_2": cart?.shipping_address?.address_2 || "",
"shipping_address.metadata.numero":
  String((cart?.shipping_address?.metadata as Record<string, unknown>)?.numero ?? ""),
"shipping_address.metadata.bairro":
  String((cart?.shipping_address?.metadata as Record<string, unknown>)?.bairro ?? ""),
"shipping_address.metadata.municipio_ibge":
  String((cart?.shipping_address?.metadata as Record<string, unknown>)?.municipio_ibge ?? ""),
```

Faça o mesmo em `setFormAddress`, que preenche o formulário quando a cliente escolhe um endereço salvo — sem isso, escolher endereço salvo apaga os campos fiscais.

Mantenha Nome, Sobrenome, Empresa, telefone e e-mail onde estão. Faça o equivalente em `billing_address/index.tsx`.

- [ ] **Step 2: Acrescentar o campo de CPF**

Em `shipping-address/index.tsx`, depois do bloco de endereço:

```tsx
<div className="mt-4">
  <Input
    label="CPF"
    name="cpf"
    value={formData["cpf"] || ""}
    onChange={(e) => setFormData((p) => ({ ...p, cpf: e.target.value }))}
    required
    data-testid="input-cpf"
  />
  <p className="mt-1 text-sm text-ui-fg-subtle">
    Precisamos do CPF para emitir a nota fiscal do seu pedido.
  </p>
  {formData["cpf"] && !cpfValido(formData["cpf"]) && (
    <p className="mt-1 text-sm text-red-600">CPF inválido. Confira os números.</p>
  )}
</div>
```

E no `useState` inicial: `cpf: formatarCpf(String((customer?.metadata as Record<string, unknown>)?.cpf ?? ""))`.

Cliente logada vê o CPF pré-preenchido e editável; convidada digita.

- [ ] **Step 3: Repassar `metadata` e `cpf` no server action**

Em `src/lib/data/cart.ts`, dentro de `setAddresses`, monte o `metadata` a partir dos campos novos e acrescente ao payload:

```ts
import { montarMetadataFiscal } from "@lib/util/endereco-fiscal"

const metaEnvio = montarMetadataFiscal({
  numero: String(formData.get("shipping_address.metadata.numero") ?? ""),
  bairro: String(formData.get("shipping_address.metadata.bairro") ?? ""),
  ibge: String(formData.get("shipping_address.metadata.municipio_ibge") ?? ""),
})
```

**Use `montarMetadataFiscal`, não monte o objeto à mão.** A regra de nomes de chave e o fallback `S/N` do número vivem num lugar só, com teste. Duas fórmulas para a mesma coisa é como um sistema passa a ter dois comportamentos diferentes para o mesmo dado sem ninguém perceber.

Acrescente `metadata: metaEnvio` dentro de `data.shipping_address`, e `address_2: formData.get("shipping_address.address_2")` no lugar do `address_2: ""` que está lá hoje.

O CPF vai para o **carrinho**, que é de onde o pedido herda:

```ts
const cpf = normalizarCpf(String(formData.get("cpf") ?? ""))
if (!cpfValido(cpf)) {
  return "CPF inválido. Confira os números."
}
data.metadata = { cpf }
```

Importe `cpfValido` e `normalizarCpf` de `@lib/util/cpf`. A validação no servidor é a que vale — a do passo 2 é conveniência, e um POST direto contornaria.

> Se o `billing_address` for montado separadamente (não pelo `same_as_billing`), dê a ele o mesmo `metadata`.

- [ ] **Step 4: Verificar que compila e que os testes seguem verdes**

```bash
cd apps/storefront && npx tsc --noEmit
cd apps/storefront && npm run test
```

- [ ] **Step 5: Verificar no navegador**

```bash
cd apps/storefront && npm run dev
```

Abra `http://localhost:8000/br/checkout`, com um item no carrinho. Confira, nesta ordem:

1. Digitar `32604182` no CEP preenche Endereço, Bairro, Cidade e Estado.
2. `999999` no CEP não trava nada — o aviso aparece e os campos ficam editáveis.
3. CPF inválido (`111.111.111-11`) mostra o erro e não deixa concluir.
4. CPF válido (`529.982.247-25`) passa.

Se o checkout não fechar por falta de frete ou pagamento na região de teste, **isso é esperado** — o que importa é o formulário aceitar e o erro de CPF bloquear. Relate até onde chegou.

- [ ] **Step 6: Commit**

```bash
git add apps/storefront/src/modules/checkout/ apps/storefront/src/lib/data/cart.ts
git commit -m "feat(vitrine): checkout coleta CPF e dados fiscais do endereco"
```

---

### Task 7: Cadastro de endereços da conta usa o mesmo componente

**Files:**
- Modify: `apps/storefront/src/modules/account/components/address-card/add-address.tsx`
- Modify: `apps/storefront/src/modules/account/components/address-card/edit-address-modal.tsx`

**Interfaces:**
- Consumes: `AddressFields` (Task 5)
- Produces: endereço salvo com `metadata` fiscal completo

- [ ] **Step 1: Trocar os campos pelos do componente**

Nos dois arquivos, substitua os `<Input>` de endereço (`address_1`, `address_2`, `postal_code`, `city`, `province`, `country_code`) por:

```tsx
<AddressFields
  prefixo=""
  valores={formState}
  onChange={(campo, valor) => setFormState((p) => ({ ...p, [campo]: valor }))}
/>
```

Aqui o prefixo é vazio: o formulário da conta usa nomes sem prefixo (`address_1`, não `shipping_address.address_1`). Mantenha Nome, Sobrenome, Empresa e telefone onde estão.

Se o arquivo usar `FormData` direto em vez de estado controlado, introduza um `useState` para os valores — o componente precisa de `valores` e `onChange`.

- [ ] **Step 2: Repassar `metadata` ao salvar**

Onde o endereço é enviado ao Medusa, inclua:

```ts
metadata: {
  numero: String(formData.get("metadata.numero") ?? "").trim() || "S/N",
  bairro: String(formData.get("metadata.bairro") ?? "").trim(),
  municipio_ibge: String(formData.get("metadata.municipio_ibge") ?? "").trim(),
},
```

- [ ] **Step 3: Verificar que compila e que os testes seguem verdes**

```bash
cd apps/storefront && npx tsc --noEmit
cd apps/storefront && npm run test
```

- [ ] **Step 4: Verificar no navegador**

Com `npm run dev`, entre em `/br/account/addresses` (exige login). Cadastre um endereço, digite um CEP válido, confirme que preenche e salva. Se não conseguir logar neste ambiente, **relate e siga**.

- [ ] **Step 5: Commit**

```bash
git add apps/storefront/src/modules/account/components/address-card/
git commit -m "feat(vitrine): cadastro de enderecos da conta usa o formulario compartilhado"
```

---

### Task 8: CPF volta para a cliente logada

**Files:**
- Modify: `apps/storefront/src/lib/data/cart.ts` (dentro de `setAddresses`, depois de gravar o carrinho)

**Interfaces:**
- Consumes: `normalizarCpf` (Task 1); o helper de atualização de cliente já existente em `@lib/data/customer`
- Produces: `customer.metadata.cpf` gravado quando há cliente logada

- [ ] **Step 1: Descobrir o helper que atualiza a cliente**

```bash
cd apps/storefront && grep -n "export async function\|export const" src/lib/data/customer.ts
```

Use o que atualiza o cliente (algo como `updateCustomer`). **Não crie outro** — reuse o que existe.

- [ ] **Step 2: Gravar o CPF na cliente, sem derrubar o checkout se falhar**

Em `setAddresses`, depois de o carrinho ser atualizado com sucesso:

```ts
// Conveniência de pré-preenchimento na próxima compra. A fonte da nota é o
// metadata do PEDIDO — nunca este valor, que a cliente pode mudar depois.
// Falha aqui NÃO pode derrubar o checkout: o pedido já tem o CPF de que precisa.
try {
  const customer = await retrieveCustomer()
  if (customer && normalizarCpf(String(customer.metadata?.cpf ?? "")) !== cpf) {
    await updateCustomer({ metadata: { ...(customer.metadata ?? {}), cpf } })
  }
} catch {
  // silencioso de propósito — ver comentário acima
}
```

Ajuste os nomes ao que a Step 1 encontrou.

- [ ] **Step 3: Verificar que compila e que os testes seguem verdes**

```bash
cd apps/storefront && npx tsc --noEmit
cd apps/storefront && npm run test
```

- [ ] **Step 4: Verificar no navegador**

Logada, conclua um checkout com CPF. Volte ao checkout com outro item: o CPF tem que vir preenchido. Se não conseguir logar neste ambiente, **relate e siga**.

- [ ] **Step 5: Commit**

```bash
git add apps/storefront/src/lib/data/cart.ts
git commit -m "feat(vitrine): guarda o CPF na conta para pre-preencher a proxima compra"
```

---

### Task 9: Bloco "Dados fiscais" no Cockpit

**Files:**
- Create: `apps/cockpit/lib/dados-fiscais.ts`
- Test: `apps/cockpit/lib/dados-fiscais.test.ts`
- Create: `apps/cockpit/app/api/orders/[id]/dados-fiscais/route.ts`
- Modify: `apps/cockpit/app/(painel)/pedidos/page.tsx`

**Interfaces:**
- Consumes: `medusaAdmin` de `@/lib/medusa`
- Produces:
  - `type DadosFiscaisPedido = { cpf: string; numero: string; bairro: string; municipio_ibge: string }`
  - `lerDadosFiscais(order: unknown): DadosFiscaisPedido`
  - `faltamDadosFiscaisPedido(d: DadosFiscaisPedido): string[]`
  - `PATCH /api/orders/{id}/dados-fiscais`

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/cockpit/lib/dados-fiscais.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { lerDadosFiscais, faltamDadosFiscaisPedido } from "./dados-fiscais"

const completo = {
  metadata: { cpf: "52998224725" },
  shipping_address: { metadata: { numero: "180", bairro: "Angola", municipio_ibge: "3106705" } },
}

describe("lerDadosFiscais", () => {
  it("lê das duas fontes que o backend fiscal usa", () => {
    expect(lerDadosFiscais(completo)).toEqual({
      cpf: "52998224725",
      numero: "180",
      bairro: "Angola",
      municipio_ibge: "3106705",
    })
  })

  it("devolve strings vazias em vez de undefined quando não há nada", () => {
    expect(lerDadosFiscais({})).toEqual({ cpf: "", numero: "", bairro: "", municipio_ibge: "" })
    expect(lerDadosFiscais(null)).toEqual({ cpf: "", numero: "", bairro: "", municipio_ibge: "" })
  })

  it("normaliza o CPF, tirando a máscara", () => {
    expect(lerDadosFiscais({ metadata: { cpf: "529.982.247-25" } }).cpf).toBe("52998224725")
  })
})

describe("faltamDadosFiscaisPedido", () => {
  it("não acusa nada quando está completo", () => {
    expect(faltamDadosFiscaisPedido(lerDadosFiscais(completo))).toEqual([])
  })

  it("acusa CPF inválido, não só ausente", () => {
    const d = lerDadosFiscais({ ...completo, metadata: { cpf: "111.111.111-11" } })
    expect(faltamDadosFiscaisPedido(d)).toEqual(["CPF"])
  })

  it("acusa IBGE com formato errado", () => {
    const d = lerDadosFiscais({
      ...completo,
      shipping_address: { metadata: { numero: "180", bairro: "Angola", municipio_ibge: "310670" } },
    })
    expect(faltamDadosFiscaisPedido(d)).toEqual(["município (código IBGE)"])
  })

  it("acusa tudo num pedido antigo, sem nada preenchido", () => {
    expect(faltamDadosFiscaisPedido(lerDadosFiscais({}))).toEqual([
      "CPF",
      "número",
      "bairro",
      "município (código IBGE)",
    ])
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd apps/cockpit && npx vitest run lib/dados-fiscais.test.ts
```

Esperado: FAIL — não encontra `./dados-fiscais`.

- [ ] **Step 3: Implementar os helpers**

Criar `apps/cockpit/lib/dados-fiscais.ts`:

```typescript
// O que a emissão de nota exige de um pedido, e o que falta nele.
//
// As chaves e a ordem de leitura espelham apps/backend/src/lib/fiscal/fiscal-pedido.ts.
// Se aquele arquivo mudar, este precisa mudar junto — senão a tela diz que está tudo
// certo e o despacho recusa mesmo assim.

export type DadosFiscaisPedido = {
  cpf: string
  numero: string
  bairro: string
  municipio_ibge: string
}

function meta(o: unknown): Record<string, unknown> {
  return (o && typeof o === "object" ? (o as Record<string, unknown>) : {}) as Record<
    string,
    unknown
  >
}

export function lerDadosFiscais(order: unknown): DadosFiscaisPedido {
  const o = meta(order)
  const pedido = meta(o.metadata)
  const envio = meta(meta(o.shipping_address).metadata)

  return {
    cpf: String(pedido.cpf ?? "").replace(/\D/g, ""),
    numero: String(envio.numero ?? "").trim(),
    bairro: String(envio.bairro ?? "").trim(),
    municipio_ibge: String(envio.municipio_ibge ?? "").trim(),
  }
}

function digito(cpf: string, n: number): number {
  let soma = 0
  for (let i = 0; i < n; i++) soma += Number(cpf[i]) * (n + 1 - i)
  const resto = (soma * 10) % 11
  return resto === 10 ? 0 : resto
}

function cpfOk(cpf: string): boolean {
  if (cpf.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false
  return digito(cpf, 9) === Number(cpf[9]) && digito(cpf, 10) === Number(cpf[10])
}

export function faltamDadosFiscaisPedido(d: DadosFiscaisPedido): string[] {
  const faltam: string[] = []
  if (!cpfOk(d.cpf)) faltam.push("CPF")
  if (!d.numero) faltam.push("número")
  if (!d.bairro) faltam.push("bairro")
  if (!/^\d{7}$/.test(d.municipio_ibge)) faltam.push("município (código IBGE)")
  return faltam
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
cd apps/cockpit && npx vitest run lib/dados-fiscais.test.ts
```

Esperado: PASS, 7 testes.

- [ ] **Step 5: Escrever a rota que grava**

Criar `apps/cockpit/app/api/orders/[id]/dados-fiscais/route.ts`:

```typescript
import { NextResponse } from "next/server"
import { medusaAdmin } from "@/lib/medusa"
import { faltamDadosFiscaisPedido, type DadosFiscaisPedido } from "@/lib/dados-fiscais"

// Completa os dados fiscais de um pedido que veio sem eles — pedidos anteriores à
// coleta no checkout, ou qualquer caso em que o dado chegou torto.
//
// Recusa gravar dado inválido: a alternativa seria descobrir na rejeição da SEFAZ,
// com a cliente esperando.

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const body = (await req.json()) as Partial<DadosFiscaisPedido>

  const dados: DadosFiscaisPedido = {
    cpf: String(body.cpf ?? "").replace(/\D/g, ""),
    numero: String(body.numero ?? "").trim(),
    bairro: String(body.bairro ?? "").trim(),
    municipio_ibge: String(body.municipio_ibge ?? "").trim(),
  }

  const faltam = faltamDadosFiscaisPedido(dados)
  if (faltam.length > 0) {
    return NextResponse.json(
      { error: `Ainda inválido ou faltando: ${faltam.join(", ")}.` },
      { status: 422 }
    )
  }

  try {
    const r = await medusaAdmin(`/admin/orders/${encodeURIComponent(id)}`, {
      method: "POST",
      body: JSON.stringify({
        metadata: { cpf: dados.cpf },
        shipping_address: {
          metadata: {
            numero: dados.numero,
            bairro: dados.bairro,
            municipio_ibge: dados.municipio_ibge,
          },
        },
      }),
    })
    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { message?: string; error?: string }
      return NextResponse.json(
        { error: d.message || d.error || `Falha ao gravar (HTTP ${r.status}).` },
        { status: r.status }
      )
    }
    return NextResponse.json({ ok: true, dados })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
```

> **Confirme que o Medusa aceita atualizar `shipping_address.metadata` por `POST /admin/orders/{id}`.** Se não aceitar, leia as rotas de pedido em `node_modules/@medusajs/medusa/dist/api/admin/orders/` e use a que funciona. **Não invente endpoint** — se nenhuma servir, pare e relate.

- [ ] **Step 6: Rota de CEP do Cockpit**

O Cockpit é outro app Next e **não alcança** a rota de CEP da vitrine — apps separados, sem pacote compartilhado neste monorepo. A decisão é duplicar ~20 linhas aqui em vez de criar um pacote compartilhado só para isso: é menos acoplamento e o custo da duplicação é conhecido e pequeno.

Criar `apps/cockpit/lib/cep.ts` com **cópia** de `normalizarCep`, `cepValido`, `urlProvedorCep`, `parseRespostaCep` e o tipo `EnderecoCep` da Task 2 — e um comentário no topo dizendo que é cópia de `apps/storefront/src/lib/util/cep.ts` e que mudanças precisam ir aos dois.

Criar `apps/cockpit/lib/cep.test.ts` com os **mesmos** testes da Task 2 (o `{erro:true}` com HTTP 200 e o IBGE de 7 dígitos são o que importa aqui também).

Criar `apps/cockpit/app/api/cep/[cep]/route.ts`, idêntico ao da Task 4, importando de `@/lib/cep`.

- [ ] **Step 7: Acrescentar o bloco na tela de pedidos**

Criar `apps/cockpit/components/dados-fiscais-do-pedido.tsx`:

```tsx
"use client"

import { useState } from "react"
import { lerDadosFiscais, faltamDadosFiscaisPedido } from "@/lib/dados-fiscais"
import { cepValido, normalizarCep, type EnderecoCep } from "@/lib/cep"

// Completa os dados fiscais de um pedido que veio sem eles.
//
// Só aparece quando falta algo E o pedido ainda não tem nota. Depois de emitida,
// o dado é histórico: alterá-lo criaria divergência com o XML já transmitido.

export function DadosFiscaisDoPedido({
  order,
  temNotaEmitida,
}: {
  order: unknown
  temNotaEmitida: boolean
}) {
  const atual = lerDadosFiscais(order)
  const faltam = faltamDadosFiscaisPedido(atual)

  const [form, setForm] = useState({ ...atual, cep: "" })
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (temNotaEmitida || faltam.length === 0) return null

  const orderId = (order as { id?: string })?.id ?? ""

  async function buscarCep(bruto: string) {
    if (!cepValido(bruto)) return
    try {
      const r = await fetch(`/api/cep/${normalizarCep(bruto)}`)
      if (!r.ok) return
      const e = (await r.json()) as EnderecoCep
      setForm((p) => ({ ...p, bairro: e.bairro || p.bairro, municipio_ibge: e.ibge }))
    } catch {
      // Silencioso: o operador pode digitar o IBGE à mão no campo abaixo.
    }
  }

  async function salvar() {
    setOcupado(true)
    setErro(null)
    try {
      const r = await fetch(`/api/orders/${orderId}/dados-fiscais`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cpf: form.cpf,
          numero: form.numero,
          bairro: form.bairro,
          municipio_ibge: form.municipio_ibge,
        }),
      })
      const d = (await r.json()) as { error?: string }
      if (!r.ok) throw new Error(d.error ?? "Falha ao salvar.")
      location.reload()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className="card space-y-3">
      <h3 className="font-medium">Dados fiscais</h3>

      <p className="rounded border border-yellow-300 bg-yellow-50 p-2 text-sm">
        Este pedido não pode gerar nota fiscal ainda. Falta: <b>{faltam.join(", ")}</b>.
      </p>

      <label className="label">CPF da cliente</label>
      <input
        className="input"
        value={form.cpf}
        onChange={(e) => setForm((p) => ({ ...p, cpf: e.target.value }))}
      />

      <label className="label">CEP (preenche bairro e município)</label>
      <input
        className="input"
        value={form.cep}
        onChange={(e) => {
          setForm((p) => ({ ...p, cep: e.target.value }))
          void buscarCep(e.target.value)
        }}
      />

      <label className="label">Número</label>
      <input
        className="input"
        value={form.numero}
        onChange={(e) => setForm((p) => ({ ...p, numero: e.target.value }))}
      />

      <label className="label">Bairro</label>
      <input
        className="input"
        value={form.bairro}
        onChange={(e) => setForm((p) => ({ ...p, bairro: e.target.value }))}
      />

      <label className="label">Código IBGE do município</label>
      <input
        className="input"
        value={form.municipio_ibge}
        onChange={(e) => setForm((p) => ({ ...p, municipio_ibge: e.target.value }))}
      />
      <p className="hint">7 dígitos. O CEP acima preenche automaticamente.</p>

      <button type="button" className="btn" onClick={salvar} disabled={ocupado}>
        {ocupado ? "Salvando…" : "Salvar dados fiscais"}
      </button>

      {erro && <p className="text-sm text-red-700">{erro}</p>}
    </section>
  )
}
```

Em `apps/cockpit/app/(painel)/pedidos/page.tsx`, no detalhe do pedido, renderize `<DadosFiscaisDoPedido order={order} temNotaEmitida={Boolean(docFiscal)} />` ao lado do bloco fiscal que já existe. Ajuste `className` aos utilitários reais do arquivo (`card`, `input`, `label`, `hint`, `btn` são os mesmos de `app/(painel)/fiscal/page.tsx` — confirme lendo aquele arquivo).

- [ ] **Step 8: Verificar**

```bash
cd apps/cockpit && npm run test
cd apps/cockpit && npx tsc --noEmit
```

Esperado: os 87 testes atuais seguem verdes, mais os 7 novos. Zero erros de `tsc`.

Tente `npm run dev`; `/pedidos` vai redirecionar para `/login` (o Cockpit exige sessão Supabase, fora do alcance de agentes) — **isso é esperado, relate e siga**.

- [ ] **Step 9: Commit**

```bash
git add apps/cockpit/lib/dados-fiscais.ts apps/cockpit/lib/dados-fiscais.test.ts "apps/cockpit/app/api/orders/[id]/dados-fiscais/" "apps/cockpit/app/(painel)/pedidos/page.tsx"
git commit -m "feat(cockpit): completar dados fiscais de um pedido antes do despacho"
```

---

## Cobertura da spec

| Requisito da spec | Task |
|---|---|
| §3 CPF em `order.metadata` sempre; `customer.metadata` só pré-preenche | 6, 8 |
| §3 `numero`, `bairro`, `municipio_ibge` em `shipping_address.metadata` | 5, 6 |
| §5 componente único, usado pelos dois lugares | 5, 6, 7 |
| §6 rota de CEP com cache, casca fina sobre funções puras | 2, 4 |
| §6 `{erro:true}` com HTTP 200 tratado | 2 |
| §7 CPF obrigatório, com explicação, validado nos dois lados | 1, 6 |
| §8 bloco fiscal no Cockpit, oculto depois de emitida | 9 |
| §9 falha de terceiro não bloqueia a venda | 4, 5 |
| §10 testes só de funções puras, sem rede | 1, 2, 3, 9 |
| §11 aceite 1–8 | 6, 7, 8, 9 |
| §11 aceite 9 (ponta a ponta com emissão ligada) | roteiro do dono — exige a tabela do contador |

**Fora deste plano, por decisão da spec §4:** mudança em `apps/backend`; backfill por script; coleta de CPF fora do checkout; validação contra a Receita; ligar `emissao_ativa`.

**Riscos herdados da spec §12:** sem provedor de CEP não há como obter o IBGE senão pelo Cockpit; CPF passa a ser dado pessoal guardado; pedidos antigos só despacham depois de completados.
