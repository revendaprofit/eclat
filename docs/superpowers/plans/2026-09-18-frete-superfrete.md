# Frete e etiquetas — SuperFrete — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cotar frete real (SuperFrete) no checkout com a regra comercial da ÉCLAT e gerar a etiqueta pelo Cockpit.

**Architecture:** Um fulfillment provider do Medusa (`src/modules/superfrete`) responde por três opções de entrega `calculated` (Mini Envios, PAC, SEDEX). A regra de negócio (embalagem, margem, final `,90`, frete grátis por UF) vive em funções puras de centavos; o provider só orquestra. A vitrine mostra preço e prazo; o Cockpit troca o Melhor Envio preparado pela SuperFrete, lendo do pedido o serviço e o pacote cotados.

**Tech Stack:** Medusa 2.15.5 (TypeScript, Jest + `@medusajs/test-utils`), Next.js (vitrine e Cockpit, Vitest), API SuperFrete v0 (`/api/v0/calculator`, `/cart`, `/checkout`).

**Spec:** `docs/superpowers/specs/2026-09-18-frete-superfrete-design.md` — leia antes de qualquer task.

## Global Constraints

- Trabalhar **só** na worktree `eclat-wt-frete` (branch `feat/frete-superfrete`). Outra sessão usa o clone `eclat/` na `main`. Nunca `git stash` sem tag; nunca push (push é do dono).
- Primeira vez na worktree: `npm install` na raiz da worktree (o repo usa npm workspaces; a worktree nasce sem `node_modules`).
- **Dinheiro em centavos inteiros** em todo código nosso. Duas bordas, e só elas, convertem: (a) a SuperFrete fala reais decimais (`price: 17.43`); (b) o Medusa v2 guarda `amount`/`unit_price` em **reais decimais** (ex.: `199.9`), não em centavos — `calculated_amount` é devolvido como `centavos / 100`.
- O repositório é **público**: token, CNPJ, CEP e endereço de origem só por variável de ambiente. Nunca em código, teste, log, commit ou doc do repo. Testes usam o CEP fictício `01001000` como origem.
- Nada grava em produção sem o "pode aplicar" do dono (script de ativação, `railway up`).
- Parâmetros da regra (padrão no código, sobrescritos por env): margem `200`, piso MG `49900`, piso Brasil `59900`, reserva PAC `2490`.
- Serviços SuperFrete: Mini Envios `17`, PAC `1`, SEDEX `2`. Identificadores internos: `"mini" | "pac" | "sedex"`.
- Textos de tela e mensagens de erro em pt-BR. Comentários no estilo do repo (explicam o porquê, citam a spec).
- Commits pequenos, em português, terminando com `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- **Halt entre fases** (F0 → F1 → F2 → F3 → F4): ao fim de cada fase, parar e reportar ao dono o aceite antes de seguir.

## Achados do levantamento (já verificados no código, não re-derivar)

1. O `context` que o Medusa entrega a `calculatePrice` vem de `cartFieldsForCalculateShippingOptionsPrices`: `id`, `items.*`, `items.variant.weight`, `shipping_address.*` — **sem `items.adjustments`**. Logo o provider não enxerga descontos pelo `context`; ele busca a base pelo Query do container global (`import { container } from "@medusajs/framework"`), já que provider de módulo não recebe o container da aplicação. Task 6 implementa; Task 8 prova com cupom.
2. Peso em **gramas**. Em produção (consulta de 2026-09-18) o peso está no **produto** (`product.weight`) e nenhuma variante tem `weight`. O cálculo usa `variant.weight ?? product.weight ?? 300 g`. O `context` do `calculatePrice` traz os dois (`items.variant.weight`, `items.product.weight`).
3. O passo Entrega da vitrine já chama `/store/shipping-options/{id}/calculate` por opção (`modules/checkout/components/shipping/index.tsx`), mas trata preço `0` como ausente (`calculatedPricesMap[id] ? … : "-"`). Frete grátis exige corrigir isso.
4. Scripts de ativação do repo são `.mjs` na raiz de `apps/backend`, via Admin API, com `--aplicar` (padrão de `ativar-mercadopago-regiao.mjs`). A spec §6 foi alinhada a isso.
5. O Cockpit lê o pedido por `ORDER_DETAIL_FIELDS` (`apps/cockpit/lib/medusa.ts:711`), com teste de trava em `lib/medusa-order-fields.test.ts`. CPF, número e bairro vêm de `lerDadosFiscais` (`lib/dados-fiscais.ts`). A chave da NFe sai de `decisao.fiscal.chave_acesso` na rota de despacho.
6. UF chega em `shipping_address.province` como sigla (`"MG"`); normalizar com `toUpperCase()` e remover prefixo `BR-`.

## Mapa de arquivos

**Backend — `apps/backend/`**
| Arquivo | Responsabilidade |
|---|---|
| `f0-superfrete.mjs` (novo) | Sonda do sandbox: confirma formato da resposta do `calculator` e o comportamento com medidas abaixo do mínimo |
| `src/modules/superfrete/dinheiro.ts` (novo) | `paraCentavos`, `paraValorMedusa`, `arredonda90` |
| `src/modules/superfrete/embalagem.ts` (novo) | `montarPacote`, `cabeNoMiniEnvios` |
| `src/modules/superfrete/preco.ts` (novo) | `normalizaUf`, `pisoPara`, `precosNormais`, `aplicarFreteGratis` |
| `src/modules/superfrete/parametros.ts` (novo) | `parametrosDoAmbiente()` |
| `src/modules/superfrete/cliente.ts` (novo) | `ClienteSuperfrete.cotar` |
| `src/modules/superfrete/cache.ts` (novo) | `CacheDeCotacao` (TTL + promessa compartilhada) |
| `src/modules/superfrete/cotador.ts` (novo) | `obterCotador()` — singleton cliente+cache, usado pelo provider e pela rota de prazos |
| `src/modules/superfrete/base-carrinho.ts` (novo) | `calcularBase` (pura) e `buscarBaseDoCarrinho` (Query global) |
| `src/modules/superfrete/service.ts` + `index.ts` (novos) | O provider |
| `src/api/store/frete/regras/route.ts`, `src/api/store/frete/prazos/route.ts` (novos) | Pisos públicos; prazos por serviço |
| `medusa-config.ts` (modificar) | Registrar o provider quando `SUPERFRETE_TOKEN` existir |
| `integration-tests/http/frete-superfrete.spec.ts` (novo) | Integração com SuperFrete simulada |
| `ativar-superfrete.mjs` (novo) | Liga/desliga as opções na região Brasil |

**Vitrine — `apps/storefront/src/`**
| Arquivo | Responsabilidade |
|---|---|
| `lib/util/frete.ts` + `frete.test.ts` (novos) | `baseDoCarrinho`, `progressoFreteGratis`, `textoPrazo`, `servicoDaOpcao` |
| `lib/data/frete.ts` (novo) | `getRegrasDeFrete`, `getPrazosDeFrete` |
| `modules/checkout/components/shipping/index.tsx` (modificar) | Prazo, "Grátis", esconder opção sem preço |
| `modules/cart/components/frete-gratis-barra/index.tsx` (novo) + `modules/cart/templates/summary.tsx`, `templates/index.tsx`, `app/[countryCode]/(main)/cart/page.tsx` (modificar) | Barra de frete grátis |

**Cockpit — `apps/cockpit/`**
| Arquivo | Responsabilidade |
|---|---|
| `lib/superfrete-etiqueta.ts` + `.test.ts` (novos) | Funções puras: pacote do pedido, corpo do `cart` |
| `lib/shipping.ts` (reescrever) | `carrierCreateLabel` via SuperFrete |
| `lib/medusa.ts`, `lib/medusa-order-fields.test.ts` (modificar) | `shipping_methods.data`, `shipping_address.address_2` |
| `app/api/orders/[id]/dispatch/route.ts`, `app/(painel)/pedidos/page.tsx` (modificar) | Passar pedido completo; rótulo do botão |

---

# FASE F0 — Verificação

### Task 1: Preparar a worktree e sondar o sandbox

**Files:**
- Create: `apps/backend/f0-superfrete.mjs`
- Modify: `docs/superpowers/specs/2026-09-18-frete-superfrete-design.md` (só se a sonda contradisser a spec)

**Interfaces:**
- Consumes: `SUPERFRETE_TOKEN` (sandbox) e `SUPERFRETE_CONTACT_EMAIL` em `apps/backend/.env`, colocados pelo dono.
- Produces: confirmação (ou correção) do formato `{ id, price, delivery_range: { min, max }, has_error }` usado na Task 5.

- [ ] **Step 1: Instalar dependências na worktree**

Run (na raiz da worktree): `npm install`
Expected: termina sem erro; `apps/backend/node_modules/.bin/jest` existe (ou o hoist na raiz).

- [ ] **Step 2: Confirmar que a suíte de unidade atual passa (linha de base)**

Run: `cd apps/backend && npm run test:unit`
Expected: PASS (suítes do `mercadopago`, `beneficio-conjunto`, `fiscal`).

- [ ] **Step 3: Escrever a sonda**

```js
// F0 da spec 2026-09-18-frete-superfrete-design.md — sonda do SANDBOX da SuperFrete.
// Não grava nada: só chama o calculator e imprime o que volta. Responde duas perguntas:
//  1) o formato da resposta (id, price, delivery_range, has_error) é o que a spec assume?
//  2) medidas abaixo do mínimo dos Correios (16x4x24 p/ PAC/SEDEX) são aceitas ou recusadas?
//
//   node --env-file=.env f0-superfrete.mjs <cep-origem> <cep-destino>
const TOKEN = process.env.SUPERFRETE_TOKEN
const CONTATO = process.env.SUPERFRETE_CONTACT_EMAIL
const [origem, destino] = process.argv.slice(2)
if (!TOKEN || !CONTATO || !origem || !destino) {
  console.error("✗ defina SUPERFRETE_TOKEN e SUPERFRETE_CONTACT_EMAIL no .env e passe <cep-origem> <cep-destino>.")
  process.exit(1)
}
const pacotes = {
  "1 peça (15x15x4, 0.21 kg)": { width: 15, height: 4, length: 15, weight: 0.21 },
  "2 peças (20x20x5, 0.51 kg)": { width: 20, height: 5, length: 20, weight: 0.51 },
  "caixa (25x10x20, 0.95 kg)": { width: 25, height: 10, length: 20, weight: 0.95 },
}
for (const [nome, pacote] of Object.entries(pacotes)) {
  const r = await fetch("https://sandbox.superfrete.com/api/v0/calculator", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "User-Agent": `use.ECLAT (${CONTATO})`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      from: { postal_code: origem },
      to: { postal_code: destino },
      services: "1,2,17",
      options: { own_hand: false, receipt: false, insurance_value: 0, use_insurance_value: false },
      package: pacote,
    }),
  })
  console.log(`\n=== ${nome} → HTTP ${r.status}`)
  console.log(JSON.stringify(await r.json().catch(() => null), null, 2))
}
```

- [ ] **Step 4: Rodar a sonda (depende do token de sandbox do dono)**

Run: `cd apps/backend && node --env-file=.env f0-superfrete.mjs 01001000 30130010`
Expected: três blocos HTTP 200, cada um com uma lista de serviços. Conferir: (a) `price` é número em reais; (b) `delivery_range.min/max` existem; (c) no pacote de 1 peça, PAC e SEDEX vêm com preço (a API ajusta ao mínimo) ou com `has_error: true`.

Se o `.env` ainda não tiver o token: **parar e pedir ao dono** (não inventar token, não usar produção).

- [ ] **Step 5: Registrar o achado**

Se (c) vier com `has_error` para PAC/SEDEX no pacote pequeno: editar a spec §4.3 (última frase) para "`embalagem.ts` eleva as medidas ao mínimo do serviço" e, na Task 5, enviar `max(medida, mínimo)` para PAC/SEDEX (mínimos: largura 16, altura 4, comprimento 24 — na mesma chamada, como o pacote é único para os três serviços, mandar duas chamadas: uma `services: "17"` com o pacote real e outra `services: "1,2"` com o pacote elevado). Se o formato divergir, ajustar o tipo `RespostaCalculator` da Task 5. Se tudo bater, nada muda.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/f0-superfrete.mjs docs/superpowers/specs/2026-09-18-frete-superfrete-design.md
git commit -m "chore(frete): sonda F0 do sandbox da SuperFrete"
```

**HALT F0:** reportar ao dono o que a sonda mostrou.

---

# FASE F1 — Backend

### Task 2: Dinheiro (`dinheiro.ts`)

**Files:**
- Create: `apps/backend/src/modules/superfrete/dinheiro.ts`
- Test: `apps/backend/src/modules/superfrete/__tests__/dinheiro.unit.spec.ts`

**Interfaces:**
- Produces: `paraCentavos(v: string | number): number`, `paraValorMedusa(centavos: number): number`, `arredonda90(centavos: number): number`.

- [ ] **Step 1: Teste que falha**

```ts
import { arredonda90, paraCentavos, paraValorMedusa } from "../dinheiro"

describe("dinheiro do frete", () => {
  it("converte reais decimais da SuperFrete em centavos inteiros", () => {
    expect(paraCentavos(17.43)).toBe(1743)
    expect(paraCentavos("17.4")).toBe(1740)
    expect(paraCentavos(0.1 + 0.2)).toBe(30)
  })

  it("recusa valor que não é número", () => {
    expect(() => paraCentavos("abc")).toThrow("Valor inválido")
  })

  it("devolve ao Medusa o valor na unidade maior decimal", () => {
    expect(paraValorMedusa(1690)).toBe(16.9)
    expect(paraValorMedusa(0)).toBe(0)
  })

  it("arredonda para cima até o próximo final ,90", () => {
    expect(arredonda90(1630)).toBe(1690)
    expect(arredonda90(1689)).toBe(1690)
    expect(arredonda90(1690)).toBe(1690)
    expect(arredonda90(1691)).toBe(1790)
    expect(arredonda90(200)).toBe(290)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/backend && npx cross-env TEST_TYPE=unit NODE_OPTIONS=--experimental-vm-modules jest src/modules/superfrete/__tests__/dinheiro.unit.spec.ts`
Expected: FAIL — `Cannot find module '../dinheiro'`.
(Se `cross-env` não existir, no Git Bash: `TEST_TYPE=unit NODE_OPTIONS=--experimental-vm-modules npx jest <caminho>`. Vale para todos os testes de unidade do backend deste plano.)

- [ ] **Step 3: Implementar**

```ts
// Dinheiro do frete. Invariante 3 do CLAUDE.md: tudo que é nosso roda em centavos inteiros.
// Duas bordas convertem, e só elas: a SuperFrete devolve `price` em reais decimais, e o Medusa v2
// guarda valores na unidade maior decimal (16.9 = R$ 16,90) — ver mercadopago/dinheiro.ts.

/** Reais decimais (número ou string, ex.: 17.43) → centavos inteiros. */
export function paraCentavos(valor: string | number): number {
  const numero = Number(valor)
  if (!Number.isFinite(numero)) throw new Error(`Valor inválido para o frete: ${String(valor)}`)
  return Math.round(numero * 100)
}

/** Centavos inteiros → unidade maior decimal, que é o que o Medusa espera em `calculated_amount`. */
export function paraValorMedusa(centavos: number): number {
  return centavos / 100
}

/** Menor valor ≥ `centavos` que termina em ,90 (spec §4.4). */
export function arredonda90(centavos: number): number {
  const resto = centavos % 100
  return resto <= 90 ? centavos - resto + 90 : centavos - resto + 190
}
```

- [ ] **Step 4: Rodar e ver passar** — mesmo comando do Step 2. Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/superfrete
git commit -m "feat(frete): conversões de dinheiro e arredondamento ,90"
```

### Task 3: Embalagem (`embalagem.ts`)

**Files:**
- Create: `apps/backend/src/modules/superfrete/embalagem.ts`
- Test: `apps/backend/src/modules/superfrete/__tests__/embalagem.unit.spec.ts`

**Interfaces:**
- Produces:
  - `type ItemParaEmbalagem = { quantidade: number; peso_g?: number | null }`
  - `type Pacote = { pecas: number; largura: number; altura: number; comprimento: number; peso_kg: number }`
  - `montarPacote(itens: ItemParaEmbalagem[]): Pacote`
  - `cabeNoMiniEnvios(p: Pacote): boolean`

- [ ] **Step 1: Teste que falha**

```ts
import { cabeNoMiniEnvios, montarPacote } from "../embalagem"

describe("embalagem", () => {
  it("1 peça leve vai no saquinho P com 4 cm e cabe no Mini Envios", () => {
    const p = montarPacote([{ quantidade: 1, peso_g: 200 }])
    expect(p).toEqual({ pecas: 1, largura: 15, altura: 4, comprimento: 15, peso_kg: 0.21 })
    expect(cabeNoMiniEnvios(p)).toBe(true)
  })

  it("1 peça de 300 g passa do limite de peso: saquinho P com 5 cm, sem Mini Envios", () => {
    const p = montarPacote([{ quantidade: 1, peso_g: 300 }])
    expect(p).toEqual({ pecas: 1, largura: 15, altura: 5, comprimento: 15, peso_kg: 0.31 })
    expect(cabeNoMiniEnvios(p)).toBe(false)
  })

  it("no limite exato de 300 g (290 g + 10 g) ainda cabe", () => {
    expect(cabeNoMiniEnvios(montarPacote([{ quantidade: 1, peso_g: 290 }]))).toBe(true)
  })

  it("2 peças vão no saquinho M", () => {
    const p = montarPacote([{ quantidade: 2, peso_g: 200 }])
    expect(p).toEqual({ pecas: 2, largura: 20, altura: 5, comprimento: 20, peso_kg: 0.41 })
    expect(cabeNoMiniEnvios(p)).toBe(false)
  })

  it("3 peças ou mais vão na caixa, somando linhas diferentes", () => {
    const p = montarPacote([
      { quantidade: 2, peso_g: 200 },
      { quantidade: 1, peso_g: 300 },
    ])
    expect(p).toEqual({ pecas: 3, largura: 25, altura: 10, comprimento: 20, peso_kg: 0.85 })
  })

  it("peça sem peso cadastrado conta 300 g", () => {
    expect(montarPacote([{ quantidade: 1, peso_g: null }]).peso_kg).toBe(0.31)
    expect(montarPacote([{ quantidade: 1 }]).peso_kg).toBe(0.31)
  })

  it("carrinho vazio é erro", () => {
    expect(() => montarPacote([])).toThrow("sem peças")
  })
})
```

- [ ] **Step 2: Rodar e ver falhar** — `…jest src/modules/superfrete/__tests__/embalagem.unit.spec.ts`. Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar**

```ts
// Qual embalagem um carrinho usa (spec §4.3, decisão 6 do dono em 2026-09-18).
// Medidas em cm, peso em gramas até a saída (a SuperFrete quer kg).
export type ItemParaEmbalagem = { quantidade: number; peso_g?: number | null }
export type Pacote = { pecas: number; largura: number; altura: number; comprimento: number; peso_kg: number }

const PESO_PADRAO_G = 300 // peça sem peso cadastrado
const SAQUINHO_G = 10
const CAIXA_G = 150
// Mini Envios (SuperFrete/Correios): até 0,3 kg, altura 1–4, largura 10–16, comprimento 15–24.
const MINI = { peso_g: 300, altura: 4, largura: [10, 16], comprimento: [15, 24] } as const

export function montarPacote(itens: ItemParaEmbalagem[]): Pacote {
  const pecas = itens.reduce((n, i) => n + i.quantidade, 0)
  if (pecas <= 0) throw new Error("Carrinho sem peças: não há o que embalar.")
  const pesoPecas = itens.reduce((g, i) => g + i.quantidade * (i.peso_g || PESO_PADRAO_G), 0)

  if (pecas === 1) {
    const total = pesoPecas + SAQUINHO_G
    // O saquinho P é flexível: com uma peça leve fecha em 4 cm (o que habilita o Mini Envios).
    return { pecas, largura: 15, altura: total <= MINI.peso_g ? 4 : 5, comprimento: 15, peso_kg: total / 1000 }
  }
  if (pecas === 2) {
    return { pecas, largura: 20, altura: 5, comprimento: 20, peso_kg: (pesoPecas + SAQUINHO_G) / 1000 }
  }
  return { pecas, largura: 25, altura: 10, comprimento: 20, peso_kg: (pesoPecas + CAIXA_G) / 1000 }
}

export function cabeNoMiniEnvios(p: Pacote): boolean {
  return (
    p.peso_kg * 1000 <= MINI.peso_g &&
    p.altura <= MINI.altura &&
    p.largura >= MINI.largura[0] &&
    p.largura <= MINI.largura[1] &&
    p.comprimento >= MINI.comprimento[0] &&
    p.comprimento <= MINI.comprimento[1]
  )
}
```

- [ ] **Step 4: Rodar e ver passar.** Expected: PASS (7 testes).

- [ ] **Step 5: Commit** — `git add apps/backend/src/modules/superfrete && git commit -m "feat(frete): escolha de embalagem e limite do Mini Envios"`

### Task 4: Regra de preço (`preco.ts` + `parametros.ts`)

**Files:**
- Create: `apps/backend/src/modules/superfrete/preco.ts`, `apps/backend/src/modules/superfrete/parametros.ts`
- Test: `apps/backend/src/modules/superfrete/__tests__/preco.unit.spec.ts`

**Interfaces:**
- Consumes: `arredonda90` (Task 2).
- Produces:
  - `type Servico = "mini" | "pac" | "sedex"`; `const SERVICOS: Servico[]`; `const ID_SUPERFRETE: Record<Servico, number>` (`mini: 17, pac: 1, sedex: 2`)
  - `type Parametros = { margem: number; pisoMg: number; pisoBrasil: number; reservaPac: number }`
  - `type Precos = Partial<Record<Servico, number>>` (centavos)
  - `normalizaUf(provincia?: string | null): string`
  - `pisoPara(uf: string, p: Parametros): number`
  - `precosNormais(cotacoes: Precos, p: Parametros): Precos`
  - `aplicarFreteGratis(normais: Precos, base: number, uf: string, p: Parametros): Precos`
  - `parametrosDoAmbiente(env?: NodeJS.ProcessEnv): Parametros`

- [ ] **Step 1: Teste que falha**

```ts
import { aplicarFreteGratis, normalizaUf, pisoPara, precosNormais } from "../preco"
import { parametrosDoAmbiente } from "../parametros"

const P = { margem: 200, pisoMg: 49900, pisoBrasil: 59900, reservaPac: 2490 }

describe("regra de preço do frete", () => {
  it("preço normal = cotação + margem, arredondado para ,90", () => {
    expect(precosNormais({ pac: 1430, sedex: 2210 }, P)).toEqual({ pac: 1690, sedex: 2490 })
  })

  it("normaliza a UF", () => {
    expect(normalizaUf("mg")).toBe("MG")
    expect(normalizaUf("BR-MG")).toBe("MG")
    expect(normalizaUf(" sp ")).toBe("SP")
    expect(normalizaUf(null)).toBe("")
  })

  it("piso de MG é diferente do resto do Brasil; UF desconhecida usa o do Brasil", () => {
    expect(pisoPara("MG", P)).toBe(49900)
    expect(pisoPara("SP", P)).toBe(59900)
    expect(pisoPara("", P)).toBe(59900)
  })

  it("abaixo do piso ninguém fica grátis", () => {
    expect(aplicarFreteGratis({ pac: 1690, sedex: 2490 }, 48000, "MG", P)).toEqual({ pac: 1690, sedex: 2490 })
  })

  it("no piso exato a mais barata zera e o SEDEX cobra a diferença (exemplo da spec)", () => {
    expect(aplicarFreteGratis({ pac: 1690, sedex: 2490 }, 49900, "MG", P)).toEqual({ pac: 0, sedex: 800 })
  })

  it("R$ 520 em SP não atinge o piso do Brasil", () => {
    expect(aplicarFreteGratis({ pac: 1690, sedex: 2490 }, 52000, "SP", P)).toEqual({ pac: 1690, sedex: 2490 })
  })

  it("com Mini Envios disponível, só ele zera; PAC e SEDEX cobram a diferença", () => {
    expect(aplicarFreteGratis({ mini: 1290, pac: 1690, sedex: 2490 }, 60000, "SP", P)).toEqual({
      mini: 0,
      pac: 400,
      sedex: 1200,
    })
  })

  it("diferença nunca fica negativa e mapa vazio continua vazio", () => {
    expect(aplicarFreteGratis({ pac: 1690, sedex: 1590 }, 60000, "SP", P)).toEqual({ pac: 100, sedex: 0 })
    expect(aplicarFreteGratis({}, 60000, "SP", P)).toEqual({})
  })
})

describe("parâmetros do ambiente", () => {
  it("usa os padrões da spec quando não há env", () => {
    expect(parametrosDoAmbiente({})).toEqual(P)
  })

  it("env sobrescreve, e valor inválido cai no padrão", () => {
    expect(parametrosDoAmbiente({ FRETE_MARGEM_CENTAVOS: "300", FRETE_GRATIS_MG_CENTAVOS: "abc" })).toEqual({
      ...P,
      margem: 300,
    })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar `preco.ts`**

```ts
// Regra comercial do frete (spec §4.4). Funções puras, tudo em centavos inteiros.
import { arredonda90 } from "./dinheiro"

export type Servico = "mini" | "pac" | "sedex"
export const SERVICOS: Servico[] = ["mini", "pac", "sedex"]
export const ID_SUPERFRETE: Record<Servico, number> = { mini: 17, pac: 1, sedex: 2 }
export type Parametros = { margem: number; pisoMg: number; pisoBrasil: number; reservaPac: number }
export type Precos = Partial<Record<Servico, number>>

export function normalizaUf(provincia?: string | null): string {
  return (provincia ?? "").trim().toUpperCase().replace(/^BR-/, "")
}

export function pisoPara(uf: string, p: Parametros): number {
  return uf === "MG" ? p.pisoMg : p.pisoBrasil
}

/** Cotação crua da SuperFrete → preço normal de vitrine (margem de embalagem + final ,90). */
export function precosNormais(cotacoes: Precos, p: Parametros): Precos {
  const normais: Precos = {}
  for (const s of SERVICOS) {
    const c = cotacoes[s]
    if (typeof c === "number") normais[s] = arredonda90(c + p.margem)
  }
  return normais
}

/**
 * Decisão 5 da spec: atingido o piso, a opção MAIS BARATA sai por 0 e as demais cobram só a
 * diferença para ela. Empate: vence a primeira na ordem mini → pac → sedex.
 */
export function aplicarFreteGratis(normais: Precos, base: number, uf: string, p: Parametros): Precos {
  const disponiveis = SERVICOS.filter((s) => typeof normais[s] === "number")
  if (!disponiveis.length || base < pisoPara(uf, p)) return { ...normais }
  const menor = Math.min(...disponiveis.map((s) => normais[s] as number))
  const finais: Precos = {}
  for (const s of disponiveis) finais[s] = Math.max(0, (normais[s] as number) - menor)
  return finais
}
```

O caso "diferença nunca negativa" do teste: com `{ pac: 1690, sedex: 1590 }` o menor é o SEDEX (1590) → `{ pac: 100, sedex: 0 }`.

- [ ] **Step 4: Implementar `parametros.ts`**

```ts
// Parâmetros da regra de frete: padrão da spec §4.4, sobrescrito por env (Railway) sem deploy de código.
import type { Parametros } from "./preco"

const PADRAO: Parametros = { margem: 200, pisoMg: 49900, pisoBrasil: 59900, reservaPac: 2490 }

function inteiro(valor: string | undefined, padrao: number): number {
  const n = Number(valor)
  return valor !== undefined && valor !== "" && Number.isInteger(n) && n >= 0 ? n : padrao
}

export function parametrosDoAmbiente(env: NodeJS.ProcessEnv = process.env): Parametros {
  return {
    margem: inteiro(env.FRETE_MARGEM_CENTAVOS, PADRAO.margem),
    pisoMg: inteiro(env.FRETE_GRATIS_MG_CENTAVOS, PADRAO.pisoMg),
    pisoBrasil: inteiro(env.FRETE_GRATIS_BRASIL_CENTAVOS, PADRAO.pisoBrasil),
    reservaPac: inteiro(env.FRETE_RESERVA_PAC_CENTAVOS, PADRAO.reservaPac),
  }
}
```

- [ ] **Step 5: Rodar e ver passar.** Expected: PASS (10 testes).

- [ ] **Step 6: Commit** — `git commit -m "feat(frete): regra de preço (margem, ,90, frete grátis por UF)"`

### Task 5: Cliente da SuperFrete, cache e cotador

**Files:**
- Create: `apps/backend/src/modules/superfrete/cliente.ts`, `cache.ts`, `cotador.ts`
- Test: `apps/backend/src/modules/superfrete/__tests__/cliente.unit.spec.ts`, `cache.unit.spec.ts`

**Interfaces:**
- Consumes: `paraCentavos` (Task 2), `Pacote` (Task 3), `Servico`, `ID_SUPERFRETE` (Task 4).
- Produces:
  - `type Cotacao = { servico: Servico; centavos: number; prazoMin: number; prazoMax: number }`
  - `class ErroSuperfrete extends Error`
  - `class ClienteSuperfrete { constructor(o: OpcoesCliente); cotar(cepDestino: string, pacote: Pacote): Promise<Cotacao[]> }` com `type OpcoesCliente = { token: string; contato: string; cepOrigem: string; sandbox?: boolean; baseUrl?: string; timeoutMs?: number }`
  - `class CacheDeCotacao<T> { constructor(ttlMs: number, agora?: () => number); obter(chave: string, produzir: () => Promise<T>): Promise<T> }`
  - `type Cotador = { cotar(cepDestino: string, pacote: Pacote): Promise<Cotacao[]> }`; `obterCotador(): Cotador`; `zerarCotador(): void` (para testes)

- [ ] **Step 1: Teste do cliente (falha)**

```ts
import { ClienteSuperfrete, ErroSuperfrete } from "../cliente"

const PACOTE = { pecas: 1, largura: 15, altura: 4, comprimento: 15, peso_kg: 0.21 }
const opcoes = { token: "tok-teste", contato: "teste@example.com", cepOrigem: "01001000" }

function respostaFetch(status: number, corpo: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo, text: async () => JSON.stringify(corpo) }
}

describe("ClienteSuperfrete.cotar", () => {
  const fetchOriginal = global.fetch
  afterEach(() => {
    global.fetch = fetchOriginal
  })

  it("chama o calculator do ambiente certo com os headers exigidos e o pacote em cm/kg", async () => {
    const chamado = jest.fn().mockResolvedValue(respostaFetch(200, []))
    global.fetch = chamado as unknown as typeof fetch
    await new ClienteSuperfrete({ ...opcoes, sandbox: true }).cotar("30130-010", PACOTE)

    const [url, init] = chamado.mock.calls[0]
    expect(url).toBe("https://sandbox.superfrete.com/api/v0/calculator")
    expect(init.headers.Authorization).toBe("Bearer tok-teste")
    expect(init.headers["User-Agent"]).toBe("use.ECLAT (teste@example.com)")
    expect(JSON.parse(init.body)).toEqual({
      from: { postal_code: "01001000" },
      to: { postal_code: "30130010" },
      services: "1,2,17",
      options: { own_hand: false, receipt: false, insurance_value: 0, use_insurance_value: false },
      package: { width: 15, height: 4, length: 15, weight: 0.21 },
    })
  })

  it("produção é o padrão", async () => {
    const chamado = jest.fn().mockResolvedValue(respostaFetch(200, []))
    global.fetch = chamado as unknown as typeof fetch
    await new ClienteSuperfrete(opcoes).cotar("30130010", PACOTE)
    expect(chamado.mock.calls[0][0]).toBe("https://api.superfrete.com/api/v0/calculator")
  })

  it("converte preço para centavos, lê o prazo e descarta serviço com erro ou desconhecido", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      respostaFetch(200, [
        { id: 1, name: "PAC", price: 17.43, delivery_time: 6, delivery_range: { min: 5, max: 6 }, has_error: false },
        { id: 2, name: "SEDEX", price: "22.1", delivery_time: 2, has_error: false },
        { id: 17, name: "Mini Envios", has_error: true, error: "Dimensões inválidas" },
        { id: 3, name: "Jadlog", price: 30, delivery_time: 4, has_error: false },
      ])
    ) as unknown as typeof fetch

    expect(await new ClienteSuperfrete(opcoes).cotar("30130010", PACOTE)).toEqual([
      { servico: "pac", centavos: 1743, prazoMin: 5, prazoMax: 6 },
      { servico: "sedex", centavos: 2210, prazoMin: 2, prazoMax: 2 },
    ])
  })

  it("HTTP de erro vira ErroSuperfrete sem vazar o token", async () => {
    global.fetch = jest.fn().mockResolvedValue(respostaFetch(401, { message: "Unauthenticated." })) as unknown as typeof fetch
    const erro = await new ClienteSuperfrete(opcoes).cotar("30130010", PACOTE).catch((e) => e)
    expect(erro).toBeInstanceOf(ErroSuperfrete)
    expect(erro.message).toContain("401")
    expect(erro.message).not.toContain("tok-teste")
  })

  it("resposta que não é lista vira ErroSuperfrete", async () => {
    global.fetch = jest.fn().mockResolvedValue(respostaFetch(200, { message: "ok" })) as unknown as typeof fetch
    await expect(new ClienteSuperfrete(opcoes).cotar("30130010", PACOTE)).rejects.toBeInstanceOf(ErroSuperfrete)
  })

  it("timeout aborta a chamada", async () => {
    global.fetch = jest.fn((_u: string, init: RequestInit) =>
      new Promise((_r, rejeita) => init.signal?.addEventListener("abort", () => rejeita(new Error("aborted"))))
    ) as unknown as typeof fetch
    await expect(new ClienteSuperfrete({ ...opcoes, timeoutMs: 20 }).cotar("30130010", PACOTE)).rejects.toBeInstanceOf(ErroSuperfrete)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar `cliente.ts`**

```ts
// Cliente HTTP da SuperFrete — só a cotação (a etiqueta nasce no Cockpit, spec §4.7).
// Doc: https://superfrete.readme.io/reference/cotacao-de-frete
import { paraCentavos } from "./dinheiro"
import type { Pacote } from "./embalagem"
import { ID_SUPERFRETE, SERVICOS, type Servico } from "./preco"

export type Cotacao = { servico: Servico; centavos: number; prazoMin: number; prazoMax: number }
export type OpcoesCliente = {
  token: string
  contato: string
  cepOrigem: string
  sandbox?: boolean
  /** Só para teste de integração (SuperFrete simulada). */
  baseUrl?: string
  timeoutMs?: number
}

export class ErroSuperfrete extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = "ErroSuperfrete"
  }
}

type ItemDaResposta = {
  id?: number
  price?: number | string | null
  delivery_time?: number | null
  delivery_range?: { min?: number | null; max?: number | null } | null
  has_error?: boolean
}

const soDigitos = (s: string) => s.replace(/\D/g, "")

export class ClienteSuperfrete {
  private readonly base: string

  constructor(private readonly o: OpcoesCliente) {
    this.base = o.baseUrl ?? (o.sandbox ? "https://sandbox.superfrete.com" : "https://api.superfrete.com")
  }

  async cotar(cepDestino: string, pacote: Pacote): Promise<Cotacao[]> {
    const controle = new AbortController()
    const relogio = setTimeout(() => controle.abort(), this.o.timeoutMs ?? 5000)
    let resposta: Response
    try {
      resposta = await fetch(`${this.base}/api/v0/calculator`, {
        method: "POST",
        signal: controle.signal,
        headers: {
          Authorization: `Bearer ${this.o.token}`,
          "User-Agent": `use.ECLAT (${this.o.contato})`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          from: { postal_code: soDigitos(this.o.cepOrigem) },
          to: { postal_code: soDigitos(cepDestino) },
          services: "1,2,17",
          options: { own_hand: false, receipt: false, insurance_value: 0, use_insurance_value: false },
          package: { width: pacote.largura, height: pacote.altura, length: pacote.comprimento, weight: pacote.peso_kg },
        }),
      })
    } catch (e) {
      throw new ErroSuperfrete(`SuperFrete fora do ar ou sem resposta: ${(e as Error).message}`)
    } finally {
      clearTimeout(relogio)
    }
    if (!resposta.ok) {
      throw new ErroSuperfrete(`SuperFrete calculator → HTTP ${resposta.status}: ${(await resposta.text()).slice(0, 200)}`)
    }
    const corpo = (await resposta.json()) as unknown
    if (!Array.isArray(corpo)) throw new ErroSuperfrete("SuperFrete calculator devolveu um formato inesperado.")

    const cotacoes: Cotacao[] = []
    for (const item of corpo as ItemDaResposta[]) {
      const servico = SERVICOS.find((s) => ID_SUPERFRETE[s] === item.id)
      if (!servico || item.has_error || item.price === null || item.price === undefined) continue
      const prazo = item.delivery_time ?? 0
      cotacoes.push({
        servico,
        centavos: paraCentavos(item.price),
        prazoMin: item.delivery_range?.min ?? prazo,
        prazoMax: item.delivery_range?.max ?? prazo,
      })
    }
    // Ordem estável (mini → pac → sedex), independente da ordem da resposta.
    return SERVICOS.flatMap((s) => cotacoes.filter((c) => c.servico === s))
  }
}
```

- [ ] **Step 4: Rodar o teste do cliente e ver passar.** Expected: PASS (6 testes).

- [ ] **Step 5: Teste do cache (falha)**

```ts
import { CacheDeCotacao } from "../cache"

describe("CacheDeCotacao", () => {
  it("reaproveita o valor dentro do TTL e refaz depois", async () => {
    let agora = 1000
    const cache = new CacheDeCotacao<number>(600_000, () => agora)
    const produzir = jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2)

    expect(await cache.obter("k", produzir)).toBe(1)
    agora += 599_999
    expect(await cache.obter("k", produzir)).toBe(1)
    agora += 2
    expect(await cache.obter("k", produzir)).toBe(2)
    expect(produzir).toHaveBeenCalledTimes(2)
  })

  it("chamadas simultâneas compartilham a mesma promessa", async () => {
    const cache = new CacheDeCotacao<number>(600_000)
    let resolver!: (n: number) => void
    const produzir = jest.fn(() => new Promise<number>((r) => (resolver = r)))
    const a = cache.obter("k", produzir)
    const b = cache.obter("k", produzir)
    resolver(7)
    expect(await Promise.all([a, b])).toEqual([7, 7])
    expect(produzir).toHaveBeenCalledTimes(1)
  })

  it("erro não fica no cache", async () => {
    const cache = new CacheDeCotacao<number>(600_000)
    await expect(cache.obter("k", () => Promise.reject(new Error("caiu")))).rejects.toThrow("caiu")
    expect(await cache.obter("k", () => Promise.resolve(3))).toBe(3)
  })

  it("chaves diferentes não se misturam", async () => {
    const cache = new CacheDeCotacao<number>(600_000)
    expect(await cache.obter("a", () => Promise.resolve(1))).toBe(1)
    expect(await cache.obter("b", () => Promise.resolve(2))).toBe(2)
  })
})
```

- [ ] **Step 6: Implementar `cache.ts`**

```ts
// Cache em memória da cotação (spec §4.5). O passo Entrega dispara um /calculate por opção, e os
// três chegam juntos: guardar a PROMESSA faz as três chamadas dividirem uma só ida à SuperFrete.
export class CacheDeCotacao<T> {
  private readonly entradas = new Map<string, { expira: number; valor: Promise<T> }>()

  constructor(
    private readonly ttlMs: number,
    private readonly agora: () => number = Date.now
  ) {}

  obter(chave: string, produzir: () => Promise<T>): Promise<T> {
    const atual = this.entradas.get(chave)
    if (atual && atual.expira > this.agora()) return atual.valor

    const valor = produzir()
    this.entradas.set(chave, { expira: this.agora() + this.ttlMs, valor })
    // Erro não é resposta: some do cache para a próxima tentativa ir à API de novo.
    valor.catch(() => {
      if (this.entradas.get(chave)?.valor === valor) this.entradas.delete(chave)
    })
    return valor
  }
}
```

- [ ] **Step 7: Implementar `cotador.ts`**

```ts
// Cotador único do processo: cliente + cache. O provider (container do módulo de fulfillment) e a
// rota /store/frete/prazos (container da aplicação) precisam enxergar o MESMO cache, então ele vive
// num singleton de módulo Node, montado a partir do ambiente na primeira chamada.
import { CacheDeCotacao } from "./cache"
import { ClienteSuperfrete, type Cotacao } from "./cliente"
import type { Pacote } from "./embalagem"

export type Cotador = { cotar(cepDestino: string, pacote: Pacote): Promise<Cotacao[]> }

const TTL_MS = 10 * 60 * 1000
let instancia: Cotador | null = null

export function obterCotador(): Cotador {
  if (instancia) return instancia
  const token = process.env.SUPERFRETE_TOKEN
  const cepOrigem = process.env.SUPERFRETE_FROM_POSTAL_CODE
  const contato = process.env.SUPERFRETE_CONTACT_EMAIL
  if (!token || !cepOrigem || !contato) {
    throw new Error("Frete: defina SUPERFRETE_TOKEN, SUPERFRETE_FROM_POSTAL_CODE e SUPERFRETE_CONTACT_EMAIL no ambiente.")
  }
  const cliente = new ClienteSuperfrete({
    token,
    cepOrigem,
    contato,
    sandbox: process.env.SUPERFRETE_SANDBOX === "true",
    baseUrl: process.env.SUPERFRETE_BASE_URL || undefined,
  })
  const cache = new CacheDeCotacao<Cotacao[]>(TTL_MS)
  instancia = {
    cotar: (cep, p) =>
      cache.obter(`${cep.replace(/\D/g, "")}|${p.largura}|${p.altura}|${p.comprimento}|${p.peso_kg}`, () => cliente.cotar(cep, p)),
  }
  return instancia
}

/** Só para testes: força remontar o cotador com o ambiente atual. */
export function zerarCotador(): void {
  instancia = null
}
```

- [ ] **Step 8: Rodar os dois testes e ver passar.** Expected: PASS (10 testes no total).

- [ ] **Step 9: Commit** — `git commit -m "feat(frete): cliente da SuperFrete, cache de cotação e cotador"`

### Task 6: Base do frete grátis (`base-carrinho.ts`)

**Files:**
- Create: `apps/backend/src/modules/superfrete/base-carrinho.ts`
- Test: `apps/backend/src/modules/superfrete/__tests__/base-carrinho.unit.spec.ts`

**Interfaces:**
- Consumes: `paraCentavos` (Task 2).
- Produces:
  - `type ItemDaBase = { unit_price: unknown; quantity: unknown; adjustments?: { amount?: unknown }[] | null }`
  - `calcularBase(itens: ItemDaBase[]): number` — centavos, peças já com desconto, sem frete
  - `buscarBaseDoCarrinho(cartId: string): Promise<number>`

- [ ] **Step 1: Teste que falha**

```ts
import { calcularBase } from "../base-carrinho"

describe("calcularBase", () => {
  it("soma preço × quantidade, em centavos", () => {
    expect(calcularBase([{ unit_price: 259, quantity: 2 }, { unit_price: 159.9, quantity: 1 }])).toBe(67790)
  })

  it("desconta os adjustments (cupom e Benefício Conjunto), que vêm por linha", () => {
    expect(
      calcularBase([
        { unit_price: 259, quantity: 1, adjustments: [{ amount: 25.9 }] },
        { unit_price: 159, quantity: 1, adjustments: [{ amount: 15.9 }, { amount: 31.8 }] },
      ])
    ).toBe(34440)
  })

  it("aceita BigNumber do Medusa ({ numeric }) e valor bruto ({ value })", () => {
    expect(calcularBase([{ unit_price: { numeric: 100 }, quantity: { value: "2" }, adjustments: [{ amount: { numeric: 10 } }] }])).toBe(19000)
  })

  it("nunca fica negativa", () => {
    expect(calcularBase([{ unit_price: 10, quantity: 1, adjustments: [{ amount: 50 }] }])).toBe(0)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar**

```ts
// Base do frete grátis (spec §4.4): valor das peças JÁ COM descontos, sem o frete, em centavos.
//
// Achado do levantamento: o `context` que o Medusa entrega a `calculatePrice` vem de
// `cartFieldsForCalculateShippingOptionsPrices` (core-flows) — `items.*` SEM `items.adjustments`.
// O provider, que vive no container do módulo de fulfillment, também não recebe o Query da
// aplicação. A saída é o container global do framework, preenchido no boot do Medusa.
import { container } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { paraCentavos } from "./dinheiro"

export type ItemDaBase = { unit_price: unknown; quantity: unknown; adjustments?: { amount?: unknown }[] | null }

/** O Medusa entrega números ora crus, ora como BigNumber ({ numeric }) ou bruto ({ value }). */
function numero(v: unknown): number {
  if (typeof v === "object" && v !== null) {
    const o = v as { numeric?: unknown; value?: unknown }
    if (typeof o.numeric === "number") return o.numeric
    if (o.value !== undefined) return Number(o.value)
  }
  return Number(v)
}

export function calcularBase(itens: ItemDaBase[]): number {
  let base = 0
  for (const item of itens) {
    base += paraCentavos(numero(item.unit_price)) * numero(item.quantity)
    // `adjustment.amount` é o desconto da LINHA inteira, não por unidade.
    for (const a of item.adjustments ?? []) base -= paraCentavos(numero(a.amount ?? 0))
  }
  return Math.max(0, base)
}

export async function buscarBaseDoCarrinho(cartId: string): Promise<number> {
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "cart",
    fields: ["id", "items.unit_price", "items.quantity", "items.adjustments.amount"],
    filters: { id: cartId },
  })
  return calcularBase((data[0]?.items ?? []) as ItemDaBase[])
}
```

- [ ] **Step 4: Rodar e ver passar.** Expected: PASS (4 testes). (`buscarBaseDoCarrinho` é coberta pela integração da Task 8.)

- [ ] **Step 5: Commit** — `git commit -m "feat(frete): base do frete grátis com descontos do carrinho"`

### Task 7: O provider (`service.ts`, `index.ts`, `medusa-config.ts`)

**Files:**
- Create: `apps/backend/src/modules/superfrete/service.ts`, `apps/backend/src/modules/superfrete/index.ts`
- Modify: `apps/backend/medusa-config.ts`
- Test: `apps/backend/src/modules/superfrete/__tests__/service.unit.spec.ts`

**Interfaces:**
- Consumes: tudo das Tasks 2–6.
- Produces:
  - Provider com `static identifier = "superfrete"` → `provider_id` das opções: **`superfrete_superfrete`**.
  - `getFulfillmentOptions()` → `[{ id: "mini" }, { id: "pac" }, { id: "sedex" }]` (cada um com `name`).
  - `calculatePrice` → `{ calculated_amount: reais decimais, is_calculated_price_tax_inclusive: true }`; lança `MedusaError.NOT_ALLOWED` quando o serviço não se aplica e `INVALID_DATA` sem CEP.
  - `validateFulfillmentData` grava no shipping method: `{ servico: 1 | 2 | 17, pacote: Pacote, prazo_min?: number, prazo_max?: number }` — é isso que o Cockpit lê (Task 13).
  - `type OpcoesSuperfrete = { cotador?: Cotador; buscarBase?: (cartId: string) => Promise<number>; parametros?: Parametros }` (injeção para teste; em produção tudo vem do ambiente).

- [ ] **Step 1: Teste que falha**

```ts
import SuperfreteProviderService from "../service"
import { ErroSuperfrete, type Cotacao } from "../cliente"

const P = { margem: 200, pisoMg: 49900, pisoBrasil: 59900, reservaPac: 2490 }
const logger = { warn: jest.fn(), error: jest.fn(), info: jest.fn() }

const COTACOES: Cotacao[] = [
  { servico: "mini", centavos: 990, prazoMin: 6, prazoMax: 8 },
  { servico: "pac", centavos: 1430, prazoMin: 5, prazoMax: 6 },
  { servico: "sedex", centavos: 2210, prazoMin: 1, prazoMax: 2 },
]

function provider(o: { cotacoes?: Cotacao[] | Error; base?: number } = {}) {
  const cotar = jest.fn(async () => {
    const c = o.cotacoes ?? COTACOES
    if (c instanceof Error) throw c
    return c
  })
  const buscarBase = jest.fn(async () => o.base ?? 20000)
  const svc = new SuperfreteProviderService({ logger } as any, { cotador: { cotar }, buscarBase, parametros: P })
  return { svc, cotar, buscarBase }
}

const contexto = (o: { qtd?: number; peso?: number; uf?: string; cep?: string | null } = {}) =>
  ({
    id: "cart_1",
    items: [{ quantity: o.qtd ?? 1, unit_price: 200, variant: { weight: o.peso ?? 200 } }],
    shipping_address: { postal_code: o.cep === undefined ? "30130-010" : o.cep, province: o.uf ?? "MG" },
  }) as any

describe("provider superfrete", () => {
  it("oferece as três opções e valida o id", async () => {
    const { svc } = provider()
    expect((await svc.getFulfillmentOptions()).map((o) => o.id)).toEqual(["mini", "pac", "sedex"])
    expect(await svc.validateOption({ id: "pac" })).toBe(true)
    expect(await svc.validateOption({ id: "jadlog" })).toBe(false)
    expect(await svc.canCalculate({} as any)).toBe(true)
  })

  it("preço normal em reais decimais, com imposto incluso", async () => {
    const { svc } = provider()
    expect(await svc.calculatePrice({ id: "pac" }, {}, contexto())).toEqual({
      calculated_amount: 16.9,
      is_calculated_price_tax_inclusive: true,
    })
    expect((await svc.calculatePrice({ id: "mini" }, {}, contexto())).calculated_amount).toBe(11.9)
  })

  it("frete grátis: a mais barata zera e as outras cobram a diferença", async () => {
    const { svc, buscarBase } = provider({ base: 52000 })
    expect((await svc.calculatePrice({ id: "mini" }, {}, contexto())).calculated_amount).toBe(0)
    expect((await svc.calculatePrice({ id: "pac" }, {}, contexto())).calculated_amount).toBe(5)
    expect((await svc.calculatePrice({ id: "sedex" }, {}, contexto())).calculated_amount).toBe(13)
    expect(buscarBase).toHaveBeenCalledWith("cart_1")
  })

  it("usa os adjustments do context quando o Medusa os entrega, sem ir ao banco", async () => {
    const { svc, buscarBase } = provider()
    const ctx = contexto()
    ctx.items = [{ quantity: 2, unit_price: 300, adjustments: [{ amount: 50 }], variant: { weight: 200 } }]
    // base = 60000 − 5000 = 55000 ≥ piso MG → 2 peças não têm Mini; PAC é a mais barata
    expect((await svc.calculatePrice({ id: "pac" }, {}, ctx)).calculated_amount).toBe(0)
    expect(buscarBase).not.toHaveBeenCalled()
  })

  it("sem peso na variante, usa o peso do produto (é onde ele mora em produção)", async () => {
    const { svc, cotar } = provider()
    const ctx = contexto()
    ctx.items = [{ quantity: 1, unit_price: 200, variant: { weight: null }, product: { weight: 200 } }]
    expect((await svc.calculatePrice({ id: "mini" }, {}, ctx)).calculated_amount).toBe(11.9)
    expect(cotar).toHaveBeenCalledWith("30130010", { pecas: 1, largura: 15, altura: 4, comprimento: 15, peso_kg: 0.21 })
  })

  it("Mini Envios não se aplica a pacote fora do limite, mesmo que a API cote", async () => {
    const { svc } = provider()
    await expect(svc.calculatePrice({ id: "mini" }, {}, contexto({ qtd: 2 }))).rejects.toMatchObject({ type: "not_allowed" })
    // e o Mini fora do jogo não pode ser "a mais barata" do frete grátis
    const gratis = provider({ base: 60000 })
    expect((await gratis.svc.calculatePrice({ id: "pac" }, {}, contexto({ qtd: 2 }))).calculated_amount).toBe(0)
  })

  it("serviço que a SuperFrete não cotou não se aplica", async () => {
    const { svc } = provider({ cotacoes: [COTACOES[1]] })
    await expect(svc.calculatePrice({ id: "sedex" }, {}, contexto())).rejects.toMatchObject({ type: "not_allowed" })
  })

  it("SuperFrete fora do ar: só PAC, pelo valor de reserva, e o frete grátis continua valendo", async () => {
    const fora = provider({ cotacoes: new ErroSuperfrete("caiu") })
    expect((await fora.svc.calculatePrice({ id: "pac" }, {}, contexto())).calculated_amount).toBe(24.9)
    await expect(fora.svc.calculatePrice({ id: "sedex" }, {}, contexto())).rejects.toMatchObject({ type: "not_allowed" })
    expect(logger.error).toHaveBeenCalled()

    const foraGratis = provider({ cotacoes: new ErroSuperfrete("caiu"), base: 60000 })
    expect((await foraGratis.svc.calculatePrice({ id: "pac" }, {}, contexto())).calculated_amount).toBe(0)
  })

  it("sem CEP válido pede o CEP", async () => {
    const { svc } = provider()
    await expect(svc.calculatePrice({ id: "pac" }, {}, contexto({ cep: null }))).rejects.toThrow("Informe o CEP")
    await expect(svc.calculatePrice({ id: "pac" }, {}, contexto({ cep: "123" }))).rejects.toThrow("Informe o CEP")
  })

  it("grava no shipping method o serviço, o pacote e o prazo — ignorando o que vier do navegador", async () => {
    const { svc } = provider()
    expect(await svc.validateFulfillmentData({ id: "sedex" }, { servico: 999, pacote: "forjado" }, contexto())).toEqual({
      servico: 2,
      pacote: { pecas: 1, largura: 15, altura: 4, comprimento: 15, peso_kg: 0.21 },
      prazo_min: 1,
      prazo_max: 2,
    })
  })

  it("sem cotação, grava serviço e pacote sem prazo", async () => {
    const { svc } = provider({ cotacoes: new ErroSuperfrete("caiu") })
    expect(await svc.validateFulfillmentData({ id: "pac" }, {}, contexto())).toEqual({
      servico: 1,
      pacote: { pecas: 1, largura: 15, altura: 4, comprimento: 15, peso_kg: 0.21 },
    })
  })

  it("createFulfillment não compra etiqueta (isso é do Cockpit)", async () => {
    const { svc, cotar } = provider()
    expect(await svc.createFulfillment({}, [], undefined, {})).toEqual({ data: {}, labels: [] })
    expect(cotar).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar `service.ts`**

```ts
// Fulfillment provider da SuperFrete (spec 2026-09-18-frete-superfrete-design.md §4).
// Só COTA. A etiqueta é comprada pelo Cockpit no despacho (spec §4.7) — por isso
// createFulfillment/cancelFulfillment não fazem nada, como no provider manual.
import { AbstractFulfillmentProviderService, MedusaError } from "@medusajs/framework/utils"
import type {
  CalculatedShippingOptionPrice,
  CalculateShippingOptionPriceDTO,
  CreateFulfillmentResult,
  FulfillmentOption,
  Logger,
} from "@medusajs/framework/types"
import { buscarBaseDoCarrinho, calcularBase, type ItemDaBase } from "./base-carrinho"
import type { Cotacao } from "./cliente"
import { obterCotador, type Cotador } from "./cotador"
import { paraValorMedusa } from "./dinheiro"
import { cabeNoMiniEnvios, montarPacote, type Pacote } from "./embalagem"
import { parametrosDoAmbiente } from "./parametros"
import { aplicarFreteGratis, ID_SUPERFRETE, normalizaUf, precosNormais, SERVICOS, type Parametros, type Precos, type Servico } from "./preco"

export type OpcoesSuperfrete = {
  cotador?: Cotador
  buscarBase?: (cartId: string) => Promise<number>
  parametros?: Parametros
}

type InjectedDependencies = { logger: Logger }
type Contexto = CalculateShippingOptionPriceDTO["context"]

const NOMES: Record<Servico, string> = { mini: "Econômica (Mini Envios)", pac: "PAC", sedex: "SEDEX" }

export default class SuperfreteProviderService extends AbstractFulfillmentProviderService {
  static identifier = "superfrete"

  protected readonly logger_: Logger
  protected readonly opcoes_: OpcoesSuperfrete

  constructor({ logger }: InjectedDependencies, options: OpcoesSuperfrete = {}) {
    super()
    this.logger_ = logger
    this.opcoes_ = options
  }

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return SERVICOS.map((id) => ({ id, name: NOMES[id] }))
  }

  async validateOption(data: Record<string, unknown>): Promise<boolean> {
    return SERVICOS.includes(data.id as Servico)
  }

  async canCalculate(): Promise<boolean> {
    return true
  }

  async calculatePrice(
    optionData: CalculateShippingOptionPriceDTO["optionData"],
    _data: CalculateShippingOptionPriceDTO["data"],
    context: Contexto
  ): Promise<CalculatedShippingOptionPrice> {
    const servico = this.servico_(optionData)
    const cep = this.cep_(context)
    const pacote = this.pacote_(context)
    const parametros = this.opcoes_.parametros ?? parametrosDoAmbiente()

    const normais = await this.precosNormais_(cep, pacote, parametros)
    const finais = aplicarFreteGratis(normais, await this.base_(context), normalizaUf(context.shipping_address?.province), parametros)
    const centavos = finais[servico]
    if (typeof centavos !== "number") {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `${NOMES[servico]} não está disponível para este pedido.`)
    }
    return { calculated_amount: paraValorMedusa(centavos), is_calculated_price_tax_inclusive: true }
  }

  /**
   * O que o pedido guarda sobre o frete (spec §4.5 e §4.8). Tudo é recalculado aqui no servidor:
   * `data` vem do navegador e não é confiável para serviço, pacote ou prazo.
   */
  async validateFulfillmentData(
    optionData: Record<string, unknown>,
    _data: Record<string, unknown>,
    context: Contexto
  ): Promise<Record<string, unknown>> {
    const servico = this.servico_(optionData)
    const pacote = this.pacote_(context)
    const gravado: Record<string, unknown> = { servico: ID_SUPERFRETE[servico], pacote }
    const cotacao = (await this.cotar_(this.cep_(context), pacote))?.find((c) => c.servico === servico)
    if (cotacao) {
      gravado.prazo_min = cotacao.prazoMin
      gravado.prazo_max = cotacao.prazoMax
    }
    return gravado
  }

  async createFulfillment(): Promise<CreateFulfillmentResult> {
    return { data: {}, labels: [] }
  }

  async cancelFulfillment(): Promise<Record<string, unknown>> {
    return {}
  }

  async createReturnFulfillment(): Promise<CreateFulfillmentResult> {
    return { data: {}, labels: [] }
  }

  private servico_(optionData: Record<string, unknown>): Servico {
    const id = optionData.id as Servico
    if (!SERVICOS.includes(id)) throw new MedusaError(MedusaError.Types.INVALID_DATA, `Opção de frete desconhecida: ${String(optionData.id)}`)
    return id
  }

  private cep_(context: Contexto): string {
    const cep = String(context.shipping_address?.postal_code ?? "").replace(/\D/g, "")
    if (cep.length !== 8) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Informe o CEP para calcular o frete.")
    return cep
  }

  private pacote_(context: Contexto): Pacote {
    // Em produção o peso mora no PRODUTO; a variante só tem peso quando difere (ex.: produto de teste).
    return montarPacote(
      (context.items ?? []).map((i) => ({
        quantidade: Number(i.quantity),
        peso_g: i.variant?.weight ?? (i as { product?: { weight?: number | null } }).product?.weight ?? null,
      }))
    )
  }

  /** Cotações válidas para o pacote, ou `null` se a SuperFrete não respondeu (já logado). */
  private async cotar_(cep: string, pacote: Pacote): Promise<Cotacao[] | null> {
    try {
      const cotacoes = await (this.opcoes_.cotador ?? obterCotador()).cotar(cep, pacote)
      return cotacoes.filter((c) => c.servico !== "mini" || cabeNoMiniEnvios(pacote))
    } catch (e) {
      // Nunca logar token nem CPF: a mensagem do cliente HTTP já vem sem eles.
      this.logger_.error(`[superfrete] cotação falhou, usando valor de reserva: ${(e as Error).message}`)
      return null
    }
  }

  private async precosNormais_(cep: string, pacote: Pacote, parametros: Parametros): Promise<Precos> {
    const cotacoes = await this.cotar_(cep, pacote)
    // Reserva (spec §4.5): checkout não trava — só PAC, pelo valor fixo, já como preço final de vitrine.
    if (!cotacoes) return { pac: parametros.reservaPac }
    const crus: Precos = {}
    for (const c of cotacoes) crus[c.servico] = c.centavos
    return precosNormais(crus, parametros)
  }

  private async base_(context: Contexto): Promise<number> {
    const itens = (context.items ?? []) as unknown as ItemDaBase[]
    // O /calculate do Medusa não traz adjustments; outros fluxos trazem. Se vieram, confio neles.
    if (itens.length && itens.every((i) => Array.isArray(i.adjustments))) return calcularBase(itens)
    return (this.opcoes_.buscarBase ?? buscarBaseDoCarrinho)(String(context.id))
  }
}
```

- [ ] **Step 4: Implementar `index.ts`**

```ts
import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import SuperfreteProviderService from "./service"

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [SuperfreteProviderService],
})
```

- [ ] **Step 5: Rodar o teste do provider e ver passar.** Expected: PASS (12 testes).

- [ ] **Step 6: Registrar no `medusa-config.ts`**

Acima de `module.exports`, depois do bloco `modulosDeNotificacao`, acrescentar:

```ts
// Frete — spec docs/superpowers/specs/2026-09-18-frete-superfrete-design.md §4.1: o provider da
// SuperFrete só é registrado se o token existir. Ao declarar o módulo de fulfillment à mão, o
// provider manual deixa de vir por padrão — por isso ele é listado junto (pedidos antigos e o modo
// manual do Cockpit dependem dele).
const modulosDeFrete = process.env.SUPERFRETE_TOKEN
  ? [
      {
        resolve: '@medusajs/medusa/fulfillment',
        options: {
          providers: [
            { resolve: '@medusajs/medusa/fulfillment-manual', id: 'manual' },
            { resolve: './src/modules/superfrete', id: 'superfrete' },
          ],
        },
      },
    ]
  : []
```

E trocar a linha `modules:` por:

```ts
  modules: [{ resolve: "./src/modules/beneficio-conjunto" }, ...modulosDePagamento, ...modulosDeNotificacao, ...modulosDeFrete],
```

- [ ] **Step 7: Rodar toda a unidade do backend**

Run: `cd apps/backend && npm run test:unit`
Expected: PASS, incluindo as suítes antigas.

- [ ] **Step 8: Commit** — `git commit -m "feat(frete): fulfillment provider da SuperFrete"`

### Task 8: Rotas da loja e teste de integração

**Files:**
- Create: `apps/backend/src/api/store/frete/regras/route.ts`, `apps/backend/src/api/store/frete/prazos/route.ts`
- Test: `apps/backend/integration-tests/http/frete-superfrete.spec.ts`

**Interfaces:**
- Consumes: `parametrosDoAmbiente`, `obterCotador`, `zerarCotador`, `montarPacote`, `cabeNoMiniEnvios`.
- Produces:
  - `GET /store/frete/regras` → `{ piso_mg: number, piso_brasil: number }` (centavos)
  - `GET /store/frete/prazos?cart_id=…` → `{ prazos: { mini?: { min, max }, pac?: { min, max }, sedex?: { min, max } } }` (vazio se não houver CEP ou a cotação falhar)

- [ ] **Step 1: Escrever o teste de integração (falha)**

Pré-requisito: Postgres de teste no ar (`npm run test:db:up`, porta 55432 — ver `integration-tests/setup.js`).

```ts
// Aceite da F1 do frete (spec 2026-09-18-frete-superfrete-design.md §7): do carrinho ao preço do
// frete pela Store API, com a SuperFrete SIMULADA por um servidor HTTP local. Nenhuma credencial real.
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { AxiosInstance } from "axios"
import { criarAdmin } from "../helpers/admin"
import { criarCatalogoBase, type CatalogoBase } from "../helpers/catalogo"
import { zerarCotador } from "../../src/modules/superfrete/cotador"

jest.setTimeout(240 * 1000)

const PROVIDER = "superfrete_superfrete"
let foraDoAr = false
let chamadas = 0
let servidor: Server

// O medusa-config só registra o provider se SUPERFRETE_TOKEN existir quando é lido: as variáveis
// entram no process.env ANTES do runner subir o app. CEP de origem fictício (o real nunca entra no repo).
function subirSuperfreteSimulada(): Promise<void> {
  servidor = createServer((req, res) => {
    chamadas++
    if (foraDoAr || req.url !== "/api/v0/calculator") {
      res.writeHead(503).end("{}")
      return
    }
    res.writeHead(200, { "content-type": "application/json" }).end(
      JSON.stringify([
        { id: 1, name: "PAC", price: 14.3, delivery_time: 6, delivery_range: { min: 5, max: 6 }, has_error: false },
        { id: 2, name: "SEDEX", price: 22.1, delivery_time: 2, delivery_range: { min: 1, max: 2 }, has_error: false },
        { id: 17, name: "Mini Envios", price: 9.9, delivery_time: 8, delivery_range: { min: 6, max: 8 }, has_error: false },
      ])
    )
  })
  return new Promise((ok) =>
    servidor.listen(0, "127.0.0.1", () => {
      process.env.SUPERFRETE_TOKEN = "token-de-teste"
      process.env.SUPERFRETE_CONTACT_EMAIL = "teste@example.com"
      process.env.SUPERFRETE_FROM_POSTAL_CODE = "01001000"
      process.env.SUPERFRETE_BASE_URL = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`
      ok()
    })
  )
}

const pronto = subirSuperfreteSimulada()

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let admin: Record<string, string>
    let cat: CatalogoBase
    const opcoes: Record<string, string> = {}

    beforeAll(async () => {
      await pronto
      admin = (await criarAdmin(api, getContainer())).headers
      cat = await criarCatalogoBase(api, admin)
      const h = { headers: admin }
      const local = (await api.post("/admin/stock-locations", { name: "CD teste" }, h)).data.stock_location
      await api.post(`/admin/stock-locations/${local.id}/sales-channels`, { add: [cat.salesChannelId] }, h)
      await api.post(`/admin/stock-locations/${local.id}/fulfillment-providers`, { add: [PROVIDER] }, h)
      const comSet = (await api.post(`/admin/stock-locations/${local.id}/fulfillment-sets?fields=*fulfillment_sets`, { name: "Envio teste", type: "shipping" }, h)).data.stock_location
      const comZona = (await api.post(`/admin/fulfillment-sets/${comSet.fulfillment_sets[0].id}/service-zones`, { name: "Brasil", geo_zones: [{ type: "country", country_code: "br" }] }, h)).data.fulfillment_set
      const perfil = (await api.post("/admin/shipping-profiles", { name: "Padrão teste", type: "default" }, h)).data.shipping_profile
      for (const peca of [cat.top, cat.legging, cat.short, cat.macaquinho]) {
        await api.post(`/admin/products/${peca.productId}`, { shipping_profile_id: perfil.id }, h)
      }
      for (const [id, nome] of [["mini", "Econômica (Mini Envios)"], ["pac", "PAC"], ["sedex", "SEDEX"]]) {
        const criada = (
          await api.post(
            "/admin/shipping-options",
            {
              name: nome,
              service_zone_id: comZona.service_zones[0].id,
              shipping_profile_id: perfil.id,
              provider_id: PROVIDER,
              price_type: "calculated",
              data: { id },
              type: { label: nome, description: nome, code: id },
              prices: [],
              rules: [
                { attribute: "enabled_in_store", value: "true", operator: "eq" },
                { attribute: "is_return", value: "false", operator: "eq" },
              ],
            },
            h
          )
        ).data.shipping_option
        opcoes[id] = criada.id
      }
    })

    afterAll(() => servidor.close())

    beforeEach(() => {
      foraDoAr = false
      zerarCotador()
    })

    async function carrinho(linhas: { variantId: string; quantity: number }[], uf = "MG") {
      const cart = (await api.post("/store/carts", { region_id: cat.regionId, sales_channel_id: cat.salesChannelId }, { headers: cat.storeHeaders })).data.cart
      for (const l of linhas) {
        await api.post(`/store/carts/${cart.id}/line-items`, { variant_id: l.variantId, quantity: l.quantity }, { headers: cat.storeHeaders })
      }
      await api.post(
        `/store/carts/${cart.id}`,
        { email: "cliente@example.com", shipping_address: { first_name: "Ana", last_name: "Teste", address_1: "Rua Um", city: "Belo Horizonte", province: uf, postal_code: "30130-010", country_code: "br" } },
        { headers: cat.storeHeaders }
      )
      return cart.id as string
    }

    async function preco(api: AxiosInstance, cartId: string, servico: string): Promise<number | null> {
      const r = await api
        .post(`/store/shipping-options/${opcoes[servico]}/calculate`, { cart_id: cartId }, { headers: cat.storeHeaders })
        .catch((e) => e.response)
      return r.status === 200 ? r.data.shipping_option.amount : null
    }

    it("abaixo do piso: preço normal; 1 peça de 300 g não tem Mini Envios", async () => {
      const id = await carrinho([{ variantId: cat.top.variantId, quantity: 1 }])
      expect(await preco(api, id, "pac")).toBe(16.9)
      expect(await preco(api, id, "sedex")).toBe(24.9)
      expect(await preco(api, id, "mini")).toBeNull()
    })

    it("as três opções de uma tela custam UMA ida à SuperFrete", async () => {
      const id = await carrinho([{ variantId: cat.short.variantId, quantity: 1 }])
      const antes = chamadas
      await Promise.all(["mini", "pac", "sedex"].map((s) => preco(api, id, s)))
      expect(chamadas - antes).toBe(1)
    })

    it("MG acima de R$ 499: PAC grátis e SEDEX cobra a diferença; SP com o mesmo carrinho paga", async () => {
      const linhas = [{ variantId: cat.legging.variantId, quantity: 2 }] // 518,00
      const mg = await carrinho(linhas, "MG")
      expect(await preco(api, mg, "pac")).toBe(0)
      expect(await preco(api, mg, "sedex")).toBe(8)
      const sp = await carrinho(linhas, "SP")
      expect(await preco(api, sp, "pac")).toBe(16.9)
    })

    it("o piso olha o valor JÁ COM desconto: cupom derruba o frete grátis", async () => {
      await api.post(
        "/admin/promotions",
        {
          code: "FRETE10TESTE",
          type: "standard",
          is_automatic: false,
          status: "active",
          application_method: { type: "percentage", target_type: "items", allocation: "each", max_quantity: 1000, value: 10, currency_code: "brl" },
        },
        { headers: admin }
      )
      const id = await carrinho([{ variantId: cat.legging.variantId, quantity: 2 }], "MG") // 518,00 → grátis
      expect(await preco(api, id, "pac")).toBe(0)
      await api.post(`/store/carts/${id}/promotions`, { promo_codes: ["FRETE10TESTE"] }, { headers: cat.storeHeaders }) // 466,20
      expect(await preco(api, id, "pac")).toBe(16.9)
    })

    it("tirar peça depois de escolher o frete recalcula o método já escolhido", async () => {
      const id = await carrinho([{ variantId: cat.legging.variantId, quantity: 2 }], "MG")
      await api.post(`/store/carts/${id}/shipping-methods`, { option_id: opcoes.pac }, { headers: cat.storeHeaders })
      let cart = (await api.get(`/store/carts/${id}`, { headers: cat.storeHeaders })).data.cart
      expect(cart.shipping_methods[0].amount).toBe(0)

      await api.post(`/store/carts/${id}/line-items/${cart.items[0].id}`, { quantity: 1 }, { headers: cat.storeHeaders })
      cart = (await api.get(`/store/carts/${id}`, { headers: cat.storeHeaders })).data.cart
      expect(cart.shipping_methods[0].amount).toBe(16.9)
    })

    it("o método de envio guarda serviço, pacote e prazo calculados no servidor", async () => {
      const id = await carrinho([{ variantId: cat.top.variantId, quantity: 1 }])
      await api.post(`/store/carts/${id}/shipping-methods`, { option_id: opcoes.sedex, data: { servico: 999 } }, { headers: cat.storeHeaders })
      const cart = (await api.get(`/store/carts/${id}?fields=*shipping_methods`, { headers: cat.storeHeaders })).data.cart
      expect(cart.shipping_methods[0].data).toEqual({
        servico: 2,
        pacote: { pecas: 1, largura: 15, altura: 5, comprimento: 15, peso_kg: 0.31 },
        prazo_min: 1,
        prazo_max: 2,
      })
    })

    it("SuperFrete fora do ar: só PAC, por R$ 24,90", async () => {
      foraDoAr = true
      const id = await carrinho([{ variantId: cat.top.variantId, quantity: 1 }])
      expect(await preco(api, id, "pac")).toBe(24.9)
      expect(await preco(api, id, "sedex")).toBeNull()
    })

    it("GET /store/frete/regras devolve os pisos em centavos", async () => {
      const r = await api.get("/store/frete/regras", { headers: cat.storeHeaders })
      expect(r.data).toEqual({ piso_mg: 49900, piso_brasil: 59900 })
    })

    it("GET /store/frete/prazos devolve o prazo por serviço aplicável", async () => {
      const id = await carrinho([{ variantId: cat.top.variantId, quantity: 1 }])
      const r = await api.get(`/store/frete/prazos?cart_id=${id}`, { headers: cat.storeHeaders })
      expect(r.data).toEqual({ prazos: { pac: { min: 5, max: 6 }, sedex: { min: 1, max: 2 } } })
    })

    it("prazos sem CEP ou com a SuperFrete fora do ar voltam vazios, nunca erro", async () => {
      const cart = (await api.post("/store/carts", { region_id: cat.regionId, sales_channel_id: cat.salesChannelId }, { headers: cat.storeHeaders })).data.cart
      await api.post(`/store/carts/${cart.id}/line-items`, { variant_id: cat.top.variantId, quantity: 1 }, { headers: cat.storeHeaders })
      expect((await api.get(`/store/frete/prazos?cart_id=${cart.id}`, { headers: cat.storeHeaders })).data).toEqual({ prazos: {} })
    })
  },
})
```

Se `cat.short`/`cat.macaquinho` não existirem em `CatalogoBase` com esses nomes, abrir `integration-tests/helpers/catalogo.ts` e usar os nomes reais do tipo (o helper cria top 189, legging 259, short 159, topLum 199, macaquinho 299).

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/backend && TEST_TYPE=integration:http NODE_OPTIONS=--experimental-vm-modules npx jest integration-tests/http/frete-superfrete.spec.ts --runInBand --forceExit`
Expected: os testes de preço podem já passar (provider da Task 7); os de `/store/frete/*` FALHAM com 404.

- [ ] **Step 3: Implementar `regras/route.ts`**

```ts
// Pisos do frete grátis, públicos (a vitrine mostra "faltam R$ X" — spec §4.6). Em centavos.
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { parametrosDoAmbiente } from "../../../../modules/superfrete/parametros"

export const GET = async (_req: MedusaRequest, res: MedusaResponse) => {
  const p = parametrosDoAmbiente()
  res.json({ piso_mg: p.pisoMg, piso_brasil: p.pisoBrasil })
}
```

- [ ] **Step 4: Implementar `prazos/route.ts`**

```ts
// Prazo de entrega por serviço para o passo Entrega (spec §4.5): `calculatePrice` do Medusa só
// devolve preço. Lê o MESMO cache do provider (cotador.ts), então não custa outra ida à SuperFrete.
// Nunca derruba o checkout: sem CEP, sem token ou com a API fora do ar, devolve `{ prazos: {} }`.
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { obterCotador } from "../../../../modules/superfrete/cotador"
import { cabeNoMiniEnvios, montarPacote } from "../../../../modules/superfrete/embalagem"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const cartId = req.query.cart_id
  if (typeof cartId !== "string" || !cartId.trim()) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "cart_id é obrigatório.")
  }
  res.setHeader("Cache-Control", "no-store")

  const query: any = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "cart",
    fields: ["id", "items.quantity", "items.variant.weight", "items.product.weight", "shipping_address.postal_code"],
    filters: { id: cartId },
  })
  const cart = data[0]
  if (!cart) throw new MedusaError(MedusaError.Types.NOT_FOUND, `Carrinho ${cartId} não encontrado.`)

  const prazos: Record<string, { min: number; max: number }> = {}
  const cep = String(cart.shipping_address?.postal_code ?? "").replace(/\D/g, "")
  if (cep.length === 8 && cart.items?.length) {
    try {
      const pacote = montarPacote(cart.items.map((i: any) => ({ quantidade: Number(i.quantity), peso_g: i.variant?.weight ?? i.product?.weight ?? null })))
      for (const c of await obterCotador().cotar(cep, pacote)) {
        if (c.servico === "mini" && !cabeNoMiniEnvios(pacote)) continue
        prazos[c.servico] = { min: c.prazoMin, max: c.prazoMax }
      }
    } catch {
      // o provider já loga a falha da cotação; aqui o prazo só fica ausente
    }
  }
  res.json({ prazos })
}
```

- [ ] **Step 5: Rodar a integração e ver passar.** Expected: PASS (10 testes). Se "tirar peça … recalcula" falhar porque o Medusa não refaz método calculado nessa versão, **parar e reportar** (é um risco de negócio: frete grátis preso após esvaziar o carrinho) — não "consertar" afrouxando o teste.

- [ ] **Step 6: Rodar as integrações antigas que tocam frete/checkout** (regressão do `medusa-config`)

Run: `… npx jest integration-tests/http/saude.spec.ts integration-tests/http/conjunto-carrinho.spec.ts --runInBand --forceExit`
Expected: PASS. (Nesses specs `SUPERFRETE_TOKEN` não está definido, então o módulo de fulfillment segue o padrão.)

- [ ] **Step 7: Commit** — `git commit -m "feat(frete): rotas de regras e prazos + integração com SuperFrete simulada"`

### Task 9: Script de ativação (`ativar-superfrete.mjs`)

**Files:**
- Create: `apps/backend/ativar-superfrete.mjs`

**Interfaces:**
- Consumes: Admin API (`MEDUSA_ADMIN_URL`, `MEDUSA_ADMIN_EMAIL`, `MEDUSA_ADMIN_PASSWORD` — os mesmos do Cockpit).
- Produces: opções `calculated` com `data.id` e `type.code` iguais a `mini`/`pac`/`sedex`; "Entrega Padrão" com `enabled_in_store=false` (não apagada).

- [ ] **Step 1: Escrever o script**

```js
// F4 do frete (spec 2026-09-18-frete-superfrete-design.md §6) — liga a SuperFrete na região Brasil.
// Só pela Admin API — Medusa é a fonte da verdade. Idempotente.
//
// Sem argumentos: só MOSTRA o estado (não grava nada).
//   node ativar-superfrete.mjs
// Grava (só com "pode aplicar" do dono):
//   node ativar-superfrete.mjs --aplicar              → cria/liga Mini, PAC e SEDEX; desliga a "Entrega Padrão"
//   node ativar-superfrete.mjs --aplicar --desfazer   → religa a "Entrega Padrão"; desliga as três
//
// Ambiente: MEDUSA_ADMIN_URL, MEDUSA_ADMIN_EMAIL, MEDUSA_ADMIN_PASSWORD.
const URL = process.env.MEDUSA_ADMIN_URL
const EMAIL = process.env.MEDUSA_ADMIN_EMAIL
const SENHA = process.env.MEDUSA_ADMIN_PASSWORD
const PROVIDER = "superfrete_superfrete"
const SERVICOS = [
  { id: "mini", nome: "Econômica (Mini Envios)", descricao: "Entrega econômica pelos Correios." },
  { id: "pac", nome: "PAC", descricao: "Entrega padrão pelos Correios." },
  { id: "sedex", nome: "SEDEX", descricao: "Entrega expressa pelos Correios." },
]

if (!URL || !EMAIL || !SENHA) {
  console.error("✗ defina MEDUSA_ADMIN_URL, MEDUSA_ADMIN_EMAIL e MEDUSA_ADMIN_PASSWORD no ambiente.")
  process.exit(1)
}
const args = new Set(process.argv.slice(2))
const aplicar = args.has("--aplicar")
const desfazer = args.has("--desfazer")

const j = async (r) => {
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`HTTP ${r.status} ${r.url}: ${JSON.stringify(d).slice(0, 300)}`)
  return d
}
const { token } = await j(await fetch(`${URL}/auth/user/emailpass`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: SENHA }) }))
const h = { "content-type": "application/json", authorization: `Bearer ${token}` }
const get = async (caminho) => j(await fetch(`${URL}${caminho}`, { headers: h }))
const post = async (caminho, corpo) => j(await fetch(`${URL}${caminho}`, { method: "POST", headers: h, body: JSON.stringify(corpo) }))

const locais = (await get("/admin/stock-locations?limit=20&fields=id,name,*fulfillment_providers,*fulfillment_sets,*fulfillment_sets.service_zones")).stock_locations
const local = locais.find((l) => (l.fulfillment_sets ?? []).some((s) => s.type === "shipping"))
if (!local) throw new Error("não achei stock location com fulfillment set de envio")
const zona = local.fulfillment_sets.find((s) => s.type === "shipping").service_zones[0]
const temProvider = (local.fulfillment_providers ?? []).some((p) => p.id === PROVIDER)
console.log(`Local ${local.name} (${local.id}) — zona ${zona.name} — provider ${PROVIDER}: ${temProvider ? "vinculado" : "NÃO vinculado"}`)

const registrados = (await get("/admin/fulfillment-providers?limit=50")).fulfillment_providers.map((p) => p.id)
if (!registrados.includes(PROVIDER)) {
  console.error(`✗ ${PROVIDER} não está registrado no backend — SUPERFRETE_TOKEN está no Railway e o deploy foi feito?`)
  process.exit(1)
}

const opcoes = (await get(`/admin/shipping-options?limit=100&service_zone_id=${zona.id}&fields=id,name,provider_id,price_type,data,shipping_profile_id,*rules`)).shipping_options
const ligada = (o) => (o.rules ?? []).some((r) => r.attribute === "enabled_in_store" && String(r.value) === "true")
for (const o of opcoes) console.log(`  · ${o.name} [${o.provider_id}, ${o.price_type}] na loja: ${ligada(o) ? "sim" : "não"}`)

const padrao = opcoes.find((o) => o.provider_id === "manual_manual" && o.price_type === "flat")
if (!padrao) throw new Error('não achei a opção fixa "Entrega Padrão" (manual_manual, flat)')
const daSuperfrete = (id) => opcoes.find((o) => o.provider_id === PROVIDER && o.data?.id === id)

if (!aplicar) {
  console.log(`(simulação — nada gravado; repita com --aplicar${desfazer ? " --desfazer" : ""} quando o dono disser "pode aplicar")`)
  process.exit(0)
}

const regras = (naLoja) => [
  { attribute: "enabled_in_store", value: naLoja ? "true" : "false", operator: "eq" },
  { attribute: "is_return", value: "false", operator: "eq" },
]
const definirNaLoja = async (opcao, naLoja) => {
  // O update de shipping option troca o conjunto de regras: mando as duas sempre, reaproveitando o id.
  const atuais = Object.fromEntries((opcao.rules ?? []).map((r) => [r.attribute, r.id]))
  await post(`/admin/shipping-options/${opcao.id}`, { rules: regras(naLoja).map((r) => (atuais[r.attribute] ? { id: atuais[r.attribute], ...r } : r)) })
  console.log(`✓ ${opcao.name}: na loja = ${naLoja ? "sim" : "não"}`)
}

if (!temProvider) {
  await post(`/admin/stock-locations/${local.id}/fulfillment-providers`, { add: [PROVIDER] })
  console.log(`✓ provider ${PROVIDER} vinculado a ${local.name}`)
}
for (const s of SERVICOS) {
  const existente = daSuperfrete(s.id)
  if (existente) {
    await definirNaLoja(existente, !desfazer)
  } else if (!desfazer) {
    await post("/admin/shipping-options", {
      name: s.nome,
      service_zone_id: zona.id,
      shipping_profile_id: padrao.shipping_profile_id,
      provider_id: PROVIDER,
      price_type: "calculated",
      data: { id: s.id },
      type: { label: s.nome, description: s.descricao, code: s.id },
      prices: [],
      rules: regras(true),
    })
    console.log(`✓ criada: ${s.nome}`)
  }
}
await definirNaLoja(padrao, desfazer)
console.log(desfazer ? "✓ desfeito: só a Entrega Padrão está na loja." : "✓ SuperFrete ligada: Mini Envios, PAC e SEDEX na loja; Entrega Padrão desligada.")
```

- [ ] **Step 2: Provar contra o backend LOCAL** (nunca produção nesta task)

Pré-requisito: backend local com seed (`npm run dev` em `apps/backend`, `.env` local com `SUPERFRETE_TOKEN` de sandbox, `SUPERFRETE_SANDBOX=true`, `SUPERFRETE_FROM_POSTAL_CODE`, `SUPERFRETE_CONTACT_EMAIL`).

Run: `MEDUSA_ADMIN_URL=http://localhost:9000 MEDUSA_ADMIN_EMAIL=<admin local> MEDUSA_ADMIN_PASSWORD=<senha local> node ativar-superfrete.mjs`
Expected: lista o local, a zona e a "Entrega Padrão"; termina em "(simulação — nada gravado…)".

Run: mesmo comando com `--aplicar`. Expected: três "✓ criada" + "✓ Entrega Padrão: na loja = não".
Run: de novo com `--aplicar`. Expected (idempotência): nenhuma "criada"; só "na loja = sim/não".
Run: `--aplicar --desfazer`, depois `--aplicar`. Expected: alterna sem erro.

Se o update de regras responder 400 pelo formato do `rules`, conferir o validador em `node_modules/@medusajs/medusa/dist/api/admin/shipping-options/validators.js` (`AdminUpdateShippingOption`) e ajustar `definirNaLoja` ao formato aceito — mantendo o comportamento (não apagar a opção).

- [ ] **Step 3: Conferir pela Store API local**

Run: `node test-checkout.mjs` (já existe) ou criar um carrinho pela vitrine local.
Expected: `/store/shipping-options?cart_id=…` lista Mini/PAC/SEDEX e não lista "Entrega Padrão".

- [ ] **Step 4: Commit** — `git commit -m "feat(frete): script de ativação da SuperFrete na região Brasil"`

**HALT F1:** reportar ao dono — unidade e integração verdes, cotação real do sandbox funcionando no backend local.

---

# FASE F2 — Vitrine

### Task 10: Utilitários e leitores de frete

**Files:**
- Create: `apps/storefront/src/lib/util/frete.ts`, `apps/storefront/src/lib/util/frete.test.ts`, `apps/storefront/src/lib/data/frete.ts`

**Interfaces:**
- Consumes: `GET /store/frete/regras`, `GET /store/frete/prazos` (Task 8).
- Produces:
  - `type RegrasDeFrete = { piso_mg: number; piso_brasil: number }`
  - `type Prazos = Partial<Record<"mini" | "pac" | "sedex", { min: number; max: number }>>`
  - `baseDoCarrinho(cart: { item_subtotal?: number | null; discount_total?: number | null }): number` (centavos)
  - `progressoFreteGratis(base: number, uf: string | null | undefined, regras: RegrasDeFrete): { piso: number; falta: number; atingiu: boolean; percentual: number }`
  - `textoPrazo(p?: { min: number; max: number }): string | null`
  - `servicoDaOpcao(opcao: { type?: { code?: string | null } | null }): "mini" | "pac" | "sedex" | null`
  - `getRegrasDeFrete(): Promise<RegrasDeFrete | null>`, `getPrazosDeFrete(cartId: string): Promise<Prazos>`

- [ ] **Step 1: Teste que falha (`frete.test.ts`)**

```ts
import { describe, expect, it } from "vitest"
import { baseDoCarrinho, progressoFreteGratis, servicoDaOpcao, textoPrazo } from "./frete"

const REGRAS = { piso_mg: 49900, piso_brasil: 59900 }

describe("frete na vitrine", () => {
  it("base = peças menos descontos, em centavos (o Medusa entrega reais decimais)", () => {
    expect(baseDoCarrinho({ item_subtotal: 518, discount_total: 51.8 })).toBe(46620)
    expect(baseDoCarrinho({ item_subtotal: 159.9 })).toBe(15990)
    expect(baseDoCarrinho({})).toBe(0)
  })

  it("progresso usa o piso de MG só para MG", () => {
    expect(progressoFreteGratis(45000, "MG", REGRAS)).toEqual({ piso: 49900, falta: 4900, atingiu: false, percentual: 90 })
    expect(progressoFreteGratis(45000, "sp", REGRAS)).toMatchObject({ piso: 59900, falta: 14900 })
    expect(progressoFreteGratis(45000, null, REGRAS).piso).toBe(59900)
    expect(progressoFreteGratis(45000, "br-mg", REGRAS).piso).toBe(49900)
  })

  it("atingiu o piso", () => {
    expect(progressoFreteGratis(49900, "MG", REGRAS)).toEqual({ piso: 49900, falta: 0, atingiu: true, percentual: 100 })
    expect(progressoFreteGratis(99900, "MG", REGRAS).percentual).toBe(100)
  })

  it("texto do prazo", () => {
    expect(textoPrazo({ min: 5, max: 6 })).toBe("Chega em 5 a 6 dias úteis")
    expect(textoPrazo({ min: 2, max: 2 })).toBe("Chega em 2 dias úteis")
    expect(textoPrazo({ min: 1, max: 1 })).toBe("Chega em 1 dia útil")
    expect(textoPrazo(undefined)).toBeNull()
  })

  it("descobre o serviço pelo código do tipo da opção", () => {
    expect(servicoDaOpcao({ type: { code: "sedex" } })).toBe("sedex")
    expect(servicoDaOpcao({ type: { code: "standard" } })).toBeNull()
    expect(servicoDaOpcao({})).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar** — `cd apps/storefront && npx vitest run src/lib/util/frete.test.ts`. Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar `lib/util/frete.ts`**

```ts
// Regras de frete do lado da vitrine (spec 2026-09-18-frete-superfrete-design.md §4.5–4.6).
// A conta que VALE é a do backend (modules/superfrete/preco.ts); aqui é só exibição.
export type RegrasDeFrete = { piso_mg: number; piso_brasil: number }
export type ServicoDeFrete = "mini" | "pac" | "sedex"
export type Prazos = Partial<Record<ServicoDeFrete, { min: number; max: number }>>

const centavos = (v?: number | null) => Math.round((v ?? 0) * 100)

/** Mesma base do backend: valor das peças já com desconto, sem o frete. */
export function baseDoCarrinho(cart: { item_subtotal?: number | null; discount_total?: number | null }): number {
  return Math.max(0, centavos(cart.item_subtotal) - centavos(cart.discount_total))
}

export function progressoFreteGratis(base: number, uf: string | null | undefined, regras: RegrasDeFrete) {
  const sigla = (uf ?? "").trim().toUpperCase().replace(/^BR-/, "")
  const piso = sigla === "MG" ? regras.piso_mg : regras.piso_brasil
  const falta = Math.max(0, piso - base)
  return { piso, falta, atingiu: falta === 0, percentual: Math.min(100, Math.floor((base / piso) * 100)) }
}

export function textoPrazo(p?: { min: number; max: number }): string | null {
  if (!p) return null
  if (p.min === p.max) return `Chega em ${p.max} ${p.max === 1 ? "dia útil" : "dias úteis"}`
  return `Chega em ${p.min} a ${p.max} dias úteis`
}

export function servicoDaOpcao(opcao: { type?: { code?: string | null } | null }): ServicoDeFrete | null {
  const code = opcao.type?.code
  return code === "mini" || code === "pac" || code === "sedex" ? code : null
}
```

- [ ] **Step 4: Rodar e ver passar.** Expected: PASS (5 testes).

- [ ] **Step 5: Implementar `lib/data/frete.ts`**

```ts
"use server"

import { sdk } from "@lib/config"
import type { Prazos, RegrasDeFrete } from "@lib/util/frete"
import { getAuthHeaders } from "./cookies"

/** Pisos do frete grátis. `null` se o backend ainda não tiver a rota (deploy da vitrine antes do backend). */
export async function getRegrasDeFrete(): Promise<RegrasDeFrete | null> {
  return sdk.client
    .fetch<RegrasDeFrete>(`/store/frete/regras`, { method: "GET", next: { revalidate: 300 } })
    .then((r) => (typeof r?.piso_mg === "number" && typeof r?.piso_brasil === "number" ? r : null))
    .catch(() => null)
}

/** Prazo por serviço para o carrinho. Nunca lança: sem prazo, a tela só não mostra a linha. */
export async function getPrazosDeFrete(cartId: string): Promise<Prazos> {
  const headers = { ...(await getAuthHeaders()) }
  return sdk.client
    .fetch<{ prazos: Prazos }>(`/store/frete/prazos`, { method: "GET", query: { cart_id: cartId }, headers, cache: "no-store" })
    .then((r) => r?.prazos ?? {})
    .catch(() => ({}))
}
```

- [ ] **Step 6: Typecheck** — `cd apps/storefront && npx tsc --noEmit`. Expected: sem erro novo.

- [ ] **Step 7: Commit** — `git commit -m "feat(vitrine): utilitários e leitores de frete"`

### Task 11: Passo Entrega — prazo, "Grátis" e opção indisponível

**Files:**
- Modify: `apps/storefront/src/modules/checkout/components/shipping/index.tsx`

**Interfaces:**
- Consumes: `getPrazosDeFrete`, `servicoDaOpcao`, `textoPrazo`, `Prazos` (Task 10).

- [ ] **Step 1: Imports e estado**

Junto ao import de `calculatePriceForShippingOption`, acrescentar:

```tsx
import { getPrazosDeFrete } from "@lib/data/frete"
import { servicoDaOpcao, textoPrazo, type Prazos } from "@lib/util/frete"
```

Logo após o `useState` de `calculatedPricesMap`:

```tsx
  const [prazos, setPrazos] = useState<Prazos>({})
```

- [ ] **Step 2: Buscar prazos junto com os preços**

Dentro do `useEffect` que calcula os preços, logo depois de `setIsLoadingPrices(true)`:

```tsx
    getPrazosDeFrete(cart.id).then(setPrazos)
```

E, no mesmo `useEffect`, garantir que o carregamento termina quando não há opção calculada (hoje ficaria girando para sempre). Trocar:

```tsx
      if (promises.length) {
```

por:

```tsx
      if (!promises.length) {
        setIsLoadingPrices(false)
      } else {
```

- [ ] **Step 3: Esconder opção calculada sem preço**

Logo antes do `return (` do componente, acrescentar:

```tsx
  // Opção calculada que o backend recusou (Mini Envios fora do limite, serviço sem cotação) não
  // aparece — spec §4.2. Enquanto os preços carregam, todas aparecem com o loader.
  const opcoesDeEnvio = _shippingMethods?.filter(
    (o) => o.price_type !== "calculated" || isLoadingPrices || typeof calculatedPricesMap[o.id] === "number"
  )
```

E no JSX trocar `{_shippingMethods?.map((option) => {` por `{opcoesDeEnvio?.map((option) => {`.

- [ ] **Step 4: Nome + prazo**

Trocar o bloco:

```tsx
                          <span className="text-base-regular">
                            {option.name}
                          </span>
```

(o que está dentro do `opcoesDeEnvio.map`, não o de retirada) por:

```tsx
                          <span className="flex flex-col">
                            <span className="text-base-regular">{option.name}</span>
                            {(() => {
                              const servico = servicoDaOpcao(option as { type?: { code?: string | null } | null })
                              const prazo = servico ? textoPrazo(prazos[servico]) : null
                              return prazo ? (
                                <span className="text-small-regular text-ui-fg-muted" data-testid="delivery-option-prazo">
                                  {prazo}
                                </span>
                              ) : null
                            })()}
                          </span>
```

- [ ] **Step 5: Preço zero vira "Grátis"**

Trocar:

```tsx
                          ) : calculatedPricesMap[option.id] ? (
                            convertToLocale({
                              amount: calculatedPricesMap[option.id],
                              currency_code: cart?.currency_code,
                            })
                          ) : isLoadingPrices ? (
```

por:

```tsx
                          ) : typeof calculatedPricesMap[option.id] === "number" ? (
                            calculatedPricesMap[option.id] === 0 ? (
                              <span className="font-medium" data-testid="delivery-option-gratis">Grátis</span>
                            ) : (
                              convertToLocale({
                                amount: calculatedPricesMap[option.id],
                                currency_code: cart?.currency_code,
                              })
                            )
                          ) : isLoadingPrices ? (
```

- [ ] **Step 6: Conferir o resumo do método já escolhido**

No mesmo arquivo, o bloco que mostra o método escolhido quando o passo está fechado usa `cart.shipping_methods.at(-1).amount` com `convertToLocale`. Se mostrar "R$ 0,00" para frete grátis, trocar para exibir "Grátis" quando `amount === 0` (mesmo padrão do Step 5). Conferir também `modules/common/components/cart-totals` — a linha "Frete" com `shipping_total === 0` **e** método de envio escolhido deve ler "Grátis"; sem método escolhido, manter o comportamento atual.

- [ ] **Step 7: Typecheck e lint** — `cd apps/storefront && npx tsc --noEmit && npm run lint`. Expected: sem erro novo.

- [ ] **Step 8: Verificar no navegador**

Backend local (com as opções ligadas pela Task 9) + vitrine local (`preview_start` com a configuração da vitrine no `.claude/launch.json` da raiz; ver `contexto-claude/eclat-verificacao-local-vitrine.md`). Roteiro:
1. Carrinho com 1 top, CEP de MG → passo Entrega mostra Econômica, PAC e SEDEX com preço final `,90` e "Chega em X a Y dias úteis".
2. Carrinho com 1 legging (300 g) → Econômica não aparece.
3. Carrinho ≥ R$ 499 com CEP de MG → a mais barata mostra "Grátis"; SEDEX mostra a diferença.
4. Mesmo carrinho com CEP de SP (abaixo de R$ 599) → preços normais.
Guardar screenshot dos casos 1 e 3 para o relatório do Halt.

- [ ] **Step 9: Commit** — `git commit -m "feat(vitrine): prazo, frete grátis e opção indisponível no passo Entrega"`

### Task 12: Barra de frete grátis no carrinho

**Files:**
- Create: `apps/storefront/src/modules/cart/components/frete-gratis-barra/index.tsx`
- Modify: `apps/storefront/src/modules/cart/templates/summary.tsx`, `apps/storefront/src/modules/cart/templates/index.tsx`, `apps/storefront/src/app/[countryCode]/(main)/cart/page.tsx`

**Interfaces:**
- Consumes: `getRegrasDeFrete`, `baseDoCarrinho`, `progressoFreteGratis`, `RegrasDeFrete` (Task 10).

- [ ] **Step 1: Componente**

```tsx
// Barra "faltam R$ X para frete grátis" (spec §4.6). Sem endereço, vale o piso do Brasil e a linha
// de baixo avisa do piso menor de MG. Some se o backend ainda não expõe /store/frete/regras.
import { convertToLocale } from "@lib/util/money"
import { baseDoCarrinho, progressoFreteGratis, type RegrasDeFrete } from "@lib/util/frete"
import { HttpTypes } from "@medusajs/types"

const reais = (centavos: number, moeda: string) =>
  convertToLocale({ amount: centavos / 100, currency_code: moeda, minimumFractionDigits: 0 })

const FreteGratisBarra = ({ cart, regras }: { cart: HttpTypes.StoreCart; regras: RegrasDeFrete | null }) => {
  if (!regras) return null
  const uf = cart.shipping_address?.province
  const p = progressoFreteGratis(baseDoCarrinho(cart), uf, regras)

  return (
    <div className="flex flex-col gap-y-2" data-testid="frete-gratis-barra">
      <span className="text-small-regular text-ui-fg-base">
        {p.atingiu ? (
          <>Você ganhou <strong>frete grátis</strong> na entrega econômica.</>
        ) : (
          <>Faltam <strong>{reais(p.falta, cart.currency_code)}</strong> para o frete grátis.</>
        )}
      </span>
      <div className="h-1.5 w-full rounded-full bg-ui-bg-subtle overflow-hidden" role="progressbar" aria-valuenow={p.percentual} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-ui-fg-base transition-all" style={{ width: `${p.percentual}%` }} />
      </div>
      {!uf && !p.atingiu && (
        <span className="text-xsmall-regular text-ui-fg-muted">
          Frete grátis a partir de {reais(regras.piso_brasil, cart.currency_code)} · em MG, a partir de {reais(regras.piso_mg, cart.currency_code)}.
        </span>
      )}
    </div>
  )
}

export default FreteGratisBarra
```

Conferir a assinatura real de `convertToLocale` em `lib/util/money.ts`: se não aceitar `minimumFractionDigits`, remover o argumento (a barra mostra "R$ 49,00" em vez de "R$ 49").

- [ ] **Step 2: Passar as regras até o `Summary`**

`app/[countryCode]/(main)/cart/page.tsx` — importar `getRegrasDeFrete` de `@lib/data/frete`, buscar junto com o que a página já busca (`const regrasDeFrete = await getRegrasDeFrete()`) e passar `regrasDeFrete={regrasDeFrete}` ao `<CartTemplate …>`.

`modules/cart/templates/index.tsx` — acrescentar a prop `regrasDeFrete?: RegrasDeFrete | null` (import do tipo de `@lib/util/frete`) e repassar: `<Summary cart={cart} regrasDeFrete={regrasDeFrete ?? null} />`.

`modules/cart/templates/summary.tsx` — acrescentar a prop ao tipo `SummaryProps` (`regrasDeFrete: RegrasDeFrete | null`), importar `FreteGratisBarra` de `@modules/cart/components/frete-gratis-barra` e renderizar logo abaixo do `<Heading>`:

```tsx
      <FreteGratisBarra cart={cart} regras={regrasDeFrete} />
```

Procurar outros usos de `<Summary` (`grep -rn "<Summary" apps/storefront/src`) e passar `regrasDeFrete={null}` onde não houver as regras à mão.

- [ ] **Step 3: Typecheck, lint e testes** — `npx tsc --noEmit && npm run lint && npm test`. Expected: tudo verde.

- [ ] **Step 4: Verificar no navegador** — carrinho abaixo do piso mostra "Faltam R$ …" com a barra parcial; acima do piso mostra "Você ganhou frete grátis"; em 375 px de largura nada quebra. Screenshot para o Halt.

- [ ] **Step 5: Commit** — `git commit -m "feat(vitrine): barra de frete grátis no carrinho"`

**HALT F2:** reportar ao dono com os screenshots; checkout local completo com frete calculado é o aceite.

---

# FASE F3 — Cockpit

### Task 13: Corpo da etiqueta (funções puras) e campos do pedido

**Files:**
- Create: `apps/cockpit/lib/superfrete-etiqueta.ts`, `apps/cockpit/lib/superfrete-etiqueta.test.ts`
- Modify: `apps/cockpit/lib/medusa.ts` (`ORDER_DETAIL_FIELDS`, tipos `OrderAddress` e `CockpitOrderDetail`), `apps/cockpit/lib/medusa-order-fields.test.ts`

**Interfaces:**
- Consumes: `data` do shipping method gravado pelo backend (Task 7): `{ servico, pacote: { pecas, largura, altura, comprimento, peso_kg } }`; `lerDadosFiscais` (`lib/dados-fiscais.ts`).
- Produces:
  - `type Remetente = { name; document; phone; address; number; complement; district; city; state_abbr; postal_code }` (todos `string`)
  - `type PedidoParaEtiqueta = { itens: { titulo: string; quantidade: number; preco_unitario: number }[]; endereco: OrderAddress | null; email: string | null; cpf: string; numero: string; bairro: string; dados_do_frete: Record<string, unknown> | null }`
  - `servicoDoPedido(dados: Record<string, unknown> | null): 1 | 2 | 17` (padrão `1`, PAC)
  - `pacoteDoPedido(dados: Record<string, unknown> | null, pecas: number): { width; height; length; weight }`
  - `montarCorpoDoCart(pedido: PedidoParaEtiqueta, remetente: Remetente, chaveNfe: string | null): Record<string, unknown>` — lança `Error` com mensagem para o operador quando falta CPF, CEP ou endereço
  - `remetenteDoAmbiente(env?): Remetente` — lança se faltar variável obrigatória

- [ ] **Step 1: Teste que falha**

```ts
import { describe, expect, it } from "vitest"
import { montarCorpoDoCart, pacoteDoPedido, remetenteDoAmbiente, servicoDoPedido, type PedidoParaEtiqueta } from "./superfrete-etiqueta"

const REMETENTE = {
  name: "Loja Teste", document: "11222333000181", phone: "31999990000", address: "Rua Exemplo", number: "100",
  complement: "", district: "Centro", city: "Cidade Teste", state_abbr: "MG", postal_code: "01001000",
}
const pedido = (o: Partial<PedidoParaEtiqueta> = {}): PedidoParaEtiqueta => ({
  itens: [{ titulo: "Top Aura", quantidade: 1, preco_unitario: 189 }],
  endereco: { first_name: "Ana", last_name: "Silva", address_1: "Rua Um", address_2: "Apto 2", city: "Belo Horizonte", province: "mg", postal_code: "30130-010", country_code: "br", phone: "+55 31 98888-7777" },
  email: "ana@example.com",
  cpf: "52998224725",
  numero: "45",
  bairro: "Savassi",
  dados_do_frete: { servico: 2, pacote: { pecas: 1, largura: 15, altura: 4, comprimento: 15, peso_kg: 0.21 } },
  ...o,
})

describe("serviço e pacote lidos do pedido", () => {
  it("usa o serviço cotado; pedido antigo (Entrega Padrão) cai em PAC", () => {
    expect(servicoDoPedido({ servico: 17 })).toBe(17)
    expect(servicoDoPedido({ servico: 999 })).toBe(1)
    expect(servicoDoPedido(null)).toBe(1)
  })

  it("usa o pacote cotado quando a contagem de peças ainda bate", () => {
    expect(pacoteDoPedido({ pacote: { pecas: 1, largura: 15, altura: 4, comprimento: 15, peso_kg: 0.21 } }, 1)).toEqual({ width: 15, height: 4, length: 15, weight: 0.21 })
  })

  it("sem pacote gravado, ou com contagem divergente, cai na tabela da spec §4.3 (300 g por peça)", () => {
    expect(pacoteDoPedido(null, 1)).toEqual({ width: 15, height: 5, length: 15, weight: 0.31 })
    expect(pacoteDoPedido(null, 2)).toEqual({ width: 20, height: 5, length: 20, weight: 0.61 })
    expect(pacoteDoPedido({ pacote: { pecas: 1, largura: 15, altura: 4, comprimento: 15, peso_kg: 0.21 } }, 4)).toEqual({ width: 25, height: 10, length: 20, weight: 1.35 })
  })
})

describe("corpo do POST /api/v0/cart", () => {
  it("monta remetente, destinatário com CPF, serviço, volume e produtos", () => {
    expect(montarCorpoDoCart(pedido(), REMETENTE, null)).toEqual({
      from: REMETENTE,
      to: {
        name: "Ana Silva", document: "52998224725", phone: "5531988887777", email: "ana@example.com",
        address: "Rua Um", number: "45", complement: "Apto 2", district: "Savassi",
        city: "Belo Horizonte", state_abbr: "MG", postal_code: "30130010",
      },
      service: 2,
      volumes: { width: 15, height: 4, length: 15, weight: 0.21 },
      products: [{ name: "Top Aura", quantity: 1, unitary_value: 189 }],
      options: { insurance_value: 0, receipt: false, own_hand: false, non_commercial: true },
      platform: "use.ECLAT",
    })
  })

  it("com a chave da NFe, vai como nota e não como declaração de conteúdo", () => {
    const chave = "3".repeat(44)
    expect((montarCorpoDoCart(pedido(), REMETENTE, chave) as any).options).toEqual({
      insurance_value: 0, receipt: false, own_hand: false, non_commercial: false, invoice: { number: chave },
    })
  })

  it("chave malformada é ignorada (vira declaração de conteúdo)", () => {
    expect((montarCorpoDoCart(pedido(), REMETENTE, "123") as any).options.non_commercial).toBe(true)
  })

  it("erros claros para o operador", () => {
    expect(() => montarCorpoDoCart(pedido({ cpf: "" }), REMETENTE, null)).toThrow("CPF")
    expect(() => montarCorpoDoCart(pedido({ endereco: null }), REMETENTE, null)).toThrow("endereço")
    expect(() => montarCorpoDoCart(pedido({ endereco: { ...pedido().endereco!, postal_code: "123" } }), REMETENTE, null)).toThrow("CEP")
  })
})

describe("remetente do ambiente", () => {
  it("lê SUPERFRETE_FROM_* e limpa documento, telefone e CEP", () => {
    expect(
      remetenteDoAmbiente({
        SUPERFRETE_FROM_NAME: "Loja Teste", SUPERFRETE_FROM_DOCUMENT: "11.222.333/0001-81", SUPERFRETE_FROM_PHONE: "(31) 99999-0000",
        SUPERFRETE_FROM_ADDRESS: "Rua Exemplo", SUPERFRETE_FROM_NUMBER: "100", SUPERFRETE_FROM_DISTRICT: "Centro",
        SUPERFRETE_FROM_CITY: "Cidade Teste", SUPERFRETE_FROM_STATE: "mg", SUPERFRETE_FROM_POSTAL_CODE: "01001-000",
      } as NodeJS.ProcessEnv)
    ).toEqual(REMETENTE)
  })

  it("diz qual variável falta", () => {
    expect(() => remetenteDoAmbiente({} as NodeJS.ProcessEnv)).toThrow("SUPERFRETE_FROM_NAME")
  })
})
```

- [ ] **Step 2: Rodar e ver falhar** — `cd apps/cockpit && npx vitest run lib/superfrete-etiqueta.test.ts`.

- [ ] **Step 3: Implementar `lib/superfrete-etiqueta.ts`**

```ts
// Etiqueta SuperFrete — a parte PURA (spec 2026-09-18-frete-superfrete-design.md §4.7–4.8).
// O backend grava no shipping method o serviço e o pacote usados na cotação; a etiqueta é comprada
// com os mesmos, para o valor debitado bater com o frete cobrado da cliente.
import type { OrderAddress } from "./medusa"

export type Remetente = {
  name: string; document: string; phone: string; address: string; number: string
  complement: string; district: string; city: string; state_abbr: string; postal_code: string
}
export type PedidoParaEtiqueta = {
  itens: { titulo: string; quantidade: number; preco_unitario: number }[]
  endereco: OrderAddress | null
  email: string | null
  cpf: string
  numero: string
  bairro: string
  dados_do_frete: Record<string, unknown> | null
}
type Volume = { width: number; height: number; length: number; weight: number }

const digitos = (s: unknown) => String(s ?? "").replace(/\D/g, "")
const SERVICOS = [1, 2, 17] as const

export function servicoDoPedido(dados: Record<string, unknown> | null): 1 | 2 | 17 {
  const s = Number(dados?.servico)
  // Pedido antigo ("Entrega Padrão", sem serviço gravado) sai como PAC — spec §4.7.
  return (SERVICOS as readonly number[]).includes(s) ? (s as 1 | 2 | 17) : 1
}

// Cópia mínima da tabela da spec §4.3 (a fonte é apps/backend/src/modules/superfrete/embalagem.ts).
// Só vale para pedido sem `data.pacote` ou cujo pacote ficou velho; sem o peso real, 300 g por peça.
function pacoteDaTabela(pecas: number): Volume {
  const gramas = pecas * 300
  if (pecas <= 1) return { width: 15, height: 5, length: 15, weight: (gramas + 10) / 1000 }
  if (pecas === 2) return { width: 20, height: 5, length: 20, weight: (gramas + 10) / 1000 }
  return { width: 25, height: 10, length: 20, weight: (gramas + 150) / 1000 }
}

export function pacoteDoPedido(dados: Record<string, unknown> | null, pecas: number): Volume {
  const p = dados?.pacote as { pecas?: number; largura?: number; altura?: number; comprimento?: number; peso_kg?: number } | undefined
  const completo = p && [p.largura, p.altura, p.comprimento, p.peso_kg].every((n) => typeof n === "number" && n > 0)
  // O Medusa refaz o PREÇO do método quando o carrinho muda, mas não o `data`: se a contagem de
  // peças divergiu, o pacote gravado é de outro carrinho.
  if (completo && p.pecas === pecas) return { width: p.largura!, height: p.altura!, length: p.comprimento!, weight: p.peso_kg! }
  return pacoteDaTabela(pecas)
}

export function montarCorpoDoCart(pedido: PedidoParaEtiqueta, remetente: Remetente, chaveNfe: string | null): Record<string, unknown> {
  const a = pedido.endereco
  if (!a?.address_1) throw new Error("Pedido sem endereço de entrega: não dá para gerar a etiqueta.")
  const cep = digitos(a.postal_code)
  if (cep.length !== 8) throw new Error("CEP do pedido inválido: corrija o endereço antes de gerar a etiqueta.")
  const documento = digitos(pedido.cpf)
  if (documento.length !== 11 && documento.length !== 14) {
    throw new Error("Pedido sem CPF da cliente: a SuperFrete exige o documento do destinatário. Preencha os dados fiscais do pedido ou use o rastreio manual.")
  }
  const telefone = digitos(a.phone)
  const chave = digitos(chaveNfe)
  const comNota = chave.length === 44
  const pecas = pedido.itens.reduce((n, i) => n + i.quantidade, 0)

  return {
    from: remetente,
    to: {
      name: [a.first_name, a.last_name].filter(Boolean).join(" ") || "Cliente",
      document: documento,
      phone: telefone ? (telefone.startsWith("55") ? telefone : `55${telefone}`) : "",
      email: pedido.email ?? "",
      address: a.address_1,
      number: pedido.numero || "S/N",
      complement: a.address_2 ?? "",
      district: pedido.bairro || "NA",
      city: a.city ?? "",
      state_abbr: (a.province ?? "").trim().toUpperCase().replace(/^BR-/, ""),
      postal_code: cep,
    },
    service: servicoDoPedido(pedido.dados_do_frete),
    volumes: pacoteDoPedido(pedido.dados_do_frete, pecas),
    products: pedido.itens.map((i) => ({ name: i.titulo, quantity: i.quantidade, unitary_value: i.preco_unitario })),
    options: {
      insurance_value: 0,
      receipt: false,
      own_hand: false,
      non_commercial: !comNota,
      ...(comNota ? { invoice: { number: chave } } : {}),
    },
    platform: "use.ECLAT",
  }
}

export function remetenteDoAmbiente(env: NodeJS.ProcessEnv = process.env): Remetente {
  const obrigatoria = (nome: string) => {
    const v = env[nome]?.trim()
    if (!v) throw new Error(`Etiqueta SuperFrete: defina ${nome} no ambiente do Cockpit (ver architecture/envios.md).`)
    return v
  }
  return {
    name: obrigatoria("SUPERFRETE_FROM_NAME"),
    document: digitos(obrigatoria("SUPERFRETE_FROM_DOCUMENT")),
    phone: digitos(obrigatoria("SUPERFRETE_FROM_PHONE")),
    address: obrigatoria("SUPERFRETE_FROM_ADDRESS"),
    number: obrigatoria("SUPERFRETE_FROM_NUMBER"),
    complement: env.SUPERFRETE_FROM_COMPLEMENT?.trim() ?? "",
    district: obrigatoria("SUPERFRETE_FROM_DISTRICT"),
    city: obrigatoria("SUPERFRETE_FROM_CITY"),
    state_abbr: obrigatoria("SUPERFRETE_FROM_STATE").toUpperCase(),
    postal_code: digitos(obrigatoria("SUPERFRETE_FROM_POSTAL_CODE")),
  }
}
```

O valor unitário vai em reais decimais porque é assim que o Medusa o entrega ao Cockpit (`items.unit_price`) e é assim que a SuperFrete o recebe — é repasse de um valor declarado, não conta nossa.

- [ ] **Step 4: Campos do pedido**

Em `lib/medusa.ts`:
- `ORDER_DETAIL_FIELDS`: acrescentar `shipping_address.address_2` na linha do endereço e trocar `"shipping_methods.name,shipping_methods.total,"` por `"shipping_methods.name,shipping_methods.total,shipping_methods.data,"`.
- `OrderAddress`: acrescentar `address_2?: string | null`.
- `CockpitOrderDetail.shipping_methods`: `{ name: string; total: number; data?: Record<string, unknown> | null }[]`.

Em `lib/medusa-order-fields.test.ts`, acrescentar ao fim:

```ts
// Etiqueta SuperFrete (spec 2026-09-18-frete-superfrete-design.md §4.8): o serviço e o pacote cotados
// vivem em shipping_methods.data. Sem esse caminho no `fields`, toda etiqueta sairia como PAC com o
// pacote da tabela — e custaria diferente do frete cobrado, em silêncio.
describe("campos da etiqueta (frete)", () => {
  it.each(["shipping_methods.data", "shipping_address.address_2"])("ORDER_DETAIL_FIELDS inclui %s", (caminho) => {
    expect(ORDER_DETAIL_FIELDS.split(",")).toContain(caminho)
  })
})
```

- [ ] **Step 5: Rodar os testes do Cockpit** — `cd apps/cockpit && npm test`. Expected: PASS (novos + antigos).

- [ ] **Step 6: Commit** — `git commit -m "feat(cockpit): corpo da etiqueta SuperFrete e campos do pedido"`

### Task 14: `lib/shipping.ts` via SuperFrete, rota de despacho e tela

**Files:**
- Modify (reescrever): `apps/cockpit/lib/shipping.ts`
- Create: `apps/cockpit/lib/shipping.test.ts`
- Modify: `apps/cockpit/app/api/orders/[id]/dispatch/route.ts`, `apps/cockpit/app/(painel)/pedidos/page.tsx`, `apps/cockpit/.env.example` (se existir; senão o bloco comentado de `.env.local` não é versionado — documentar só em `architecture/envios.md`, Task 15)

**Interfaces:**
- Consumes: `montarCorpoDoCart`, `remetenteDoAmbiente`, `PedidoParaEtiqueta` (Task 13); `lerDadosFiscais`.
- Produces: `CARRIER_NAME = "SuperFrete"`, `carrierConfigured(): boolean`, `carrierCreateLabel(pedido: PedidoParaEtiqueta, chaveNfe: string | null): Promise<CarrierLabel>` com `CarrierLabel = { tracking_number; tracking_url; label_url }` (contrato que a rota já usa).

- [ ] **Step 1: Teste que falha (`lib/shipping.test.ts`)**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PedidoParaEtiqueta } from "./superfrete-etiqueta"

const PEDIDO: PedidoParaEtiqueta = {
  itens: [{ titulo: "Top Aura", quantidade: 1, preco_unitario: 189 }],
  endereco: { first_name: "Ana", last_name: "Silva", address_1: "Rua Um", city: "Belo Horizonte", province: "MG", postal_code: "30130010", country_code: "br", phone: "31988887777" },
  email: "ana@example.com", cpf: "52998224725", numero: "45", bairro: "Savassi",
  dados_do_frete: { servico: 1, pacote: { pecas: 1, largura: 15, altura: 4, comprimento: 15, peso_kg: 0.21 } },
}
const ENV = {
  SUPERFRETE_TOKEN: "tok-teste", SUPERFRETE_SANDBOX: "true", SUPERFRETE_CONTACT_EMAIL: "teste@example.com",
  SUPERFRETE_FROM_NAME: "Loja Teste", SUPERFRETE_FROM_DOCUMENT: "11222333000181", SUPERFRETE_FROM_PHONE: "31999990000",
  SUPERFRETE_FROM_ADDRESS: "Rua Exemplo", SUPERFRETE_FROM_NUMBER: "100", SUPERFRETE_FROM_DISTRICT: "Centro",
  SUPERFRETE_FROM_CITY: "Cidade Teste", SUPERFRETE_FROM_STATE: "MG", SUPERFRETE_FROM_POSTAL_CODE: "01001000",
}
const resposta = (status: number, corpo: unknown) => ({ ok: status < 300, status, json: async () => corpo, text: async () => JSON.stringify(corpo) })

describe("carrierCreateLabel (SuperFrete)", () => {
  beforeEach(() => {
    vi.resetModules()
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("cria o frete, paga com saldo e devolve rastreio + PDF", async () => {
    const chamadas: { url: string; corpo: any }[] = []
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      chamadas.push({ url, corpo: JSON.parse(String(init.body)) })
      if (url.endsWith("/api/v0/cart")) return resposta(200, { id: "ord_1", price: 14.3, status: "pending" })
      return resposta(200, { success: true, purchase: { status: "paid", orders: [{ id: "ord_1", tracking: "AA123456789BR", print: { url: "https://sandbox.superfrete.com/etiqueta.pdf" } }] } })
    }))
    const { carrierCreateLabel, carrierConfigured, CARRIER_NAME } = await import("./shipping")

    expect(CARRIER_NAME).toBe("SuperFrete")
    expect(carrierConfigured()).toBe(true)
    expect(await carrierCreateLabel(PEDIDO, null)).toEqual({
      tracking_number: "AA123456789BR",
      tracking_url: "https://rastreamento.correios.com.br/app/index.php?objetos=AA123456789BR",
      label_url: "https://sandbox.superfrete.com/etiqueta.pdf",
    })
    expect(chamadas.map((c) => c.url)).toEqual(["https://sandbox.superfrete.com/api/v0/cart", "https://sandbox.superfrete.com/api/v0/checkout"])
    expect(chamadas[0].corpo.service).toBe(1)
    expect(chamadas[1].corpo).toEqual({ orders: ["ord_1"] })
  })

  it("saldo insuficiente vira mensagem clara e não esconde o motivo", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      url.endsWith("/cart") ? resposta(200, { id: "ord_1" }) : resposta(402, { message: "Saldo insuficiente" })
    ))
    const { carrierCreateLabel } = await import("./shipping")
    await expect(carrierCreateLabel(PEDIDO, null)).rejects.toThrow("Sem saldo na SuperFrete. Recarregue a carteira e tente de novo.")
  })

  it("sem token, avisa e a UI segue no modo manual", async () => {
    vi.stubEnv("SUPERFRETE_TOKEN", "")
    const { carrierCreateLabel, carrierConfigured } = await import("./shipping")
    expect(carrierConfigured()).toBe(false)
    await expect(carrierCreateLabel(PEDIDO, null)).rejects.toThrow("SUPERFRETE_TOKEN")
  })

  it("não chama a API se o pedido não tem CPF", async () => {
    const chamada = vi.fn()
    vi.stubGlobal("fetch", chamada)
    const { carrierCreateLabel } = await import("./shipping")
    await expect(carrierCreateLabel({ ...PEDIDO, cpf: "" }, null)).rejects.toThrow("CPF")
    expect(chamada).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Reescrever `lib/shipping.ts`**

```ts
// Integração com transportadora — SuperFrete (spec 2026-09-18-frete-superfrete-design.md §4.7).
// Sem SUPERFRETE_TOKEN, o Cockpit opera no modo MANUAL (operador digita o rastreio).
// Variáveis: ver architecture/envios.md. Fluxo da etiqueta:
//   1) POST /api/v0/cart      → cria o frete (remetente, destinatário com CPF, serviço, volume)
//   2) POST /api/v0/checkout  → paga com o saldo da carteira; devolve rastreio e link do PDF
import { montarCorpoDoCart, remetenteDoAmbiente, type PedidoParaEtiqueta } from "./superfrete-etiqueta"

export const CARRIER_NAME = "SuperFrete"
export const carrierConfigured = () => Boolean(process.env.SUPERFRETE_TOKEN)

export type CarrierLabel = {
  tracking_number: string
  tracking_url: string
  label_url: string
}

class CarrierNotConfigured extends Error {
  constructor() {
    super("Integração com a SuperFrete ainda não configurada. Defina SUPERFRETE_TOKEN no ambiente do Cockpit (ver architecture/envios.md). Use o rastreio manual por enquanto.")
    this.name = "CarrierNotConfigured"
  }
}

const base = () => (process.env.SUPERFRETE_SANDBOX === "true" ? "https://sandbox.superfrete.com" : "https://api.superfrete.com")

async function sf(path: string, corpo: unknown): Promise<any> {
  const r = await fetch(`${base()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPERFRETE_TOKEN}`,
      "User-Agent": `use.ECLAT Cockpit (${process.env.SUPERFRETE_CONTACT_EMAIL ?? ""})`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(corpo),
  })
  if (!r.ok) {
    const texto = (await r.text()).slice(0, 300)
    if (r.status === 402 || /saldo/i.test(texto)) {
      throw new Error("Sem saldo na SuperFrete. Recarregue a carteira e tente de novo.")
    }
    throw new Error(`SuperFrete ${path} → HTTP ${r.status}: ${texto}`)
  }
  return r.json()
}

// Compra a etiqueta do pedido e devolve o rastreio + URL do PDF.
// Lança CarrierNotConfigured se faltar credencial (a UI cai no modo manual).
export async function carrierCreateLabel(pedido: PedidoParaEtiqueta, chaveNfe: string | null): Promise<CarrierLabel> {
  if (!carrierConfigured()) throw new CarrierNotConfigured()
  // Monta (e valida CPF/CEP/endereço) ANTES de qualquer chamada: erro de dado não gasta saldo.
  const corpo = montarCorpoDoCart(pedido, remetenteDoAmbiente(), chaveNfe)

  const frete = await sf("/api/v0/cart", corpo)
  const id = String(frete?.id ?? "")
  if (!id) throw new Error("SuperFrete não devolveu o id do frete criado.")

  const compra = await sf("/api/v0/checkout", { orders: [id] })
  const emitida = compra?.purchase?.orders?.find((o: { id?: string }) => o.id === id) ?? compra?.purchase?.orders?.[0]
  const rastreio = String(emitida?.tracking ?? "")
  return {
    tracking_number: rastreio || id,
    tracking_url: rastreio ? `https://rastreamento.correios.com.br/app/index.php?objetos=${rastreio}` : "",
    label_url: String(emitida?.print?.url ?? ""),
  }
}
```

- [ ] **Step 4: Rodar o teste e ver passar.** Expected: PASS (4 testes).

- [ ] **Step 5: Rota de despacho**

Em `app/api/orders/[id]/dispatch/route.ts`:
- Importar `lerDadosFiscais` de `@/lib/dados-fiscais`.
- A chave da NFe nasce no passo fiscal: declarar `let chaveNfe: string | null = null` antes do bloco fiscal e, no ramo `decisao.prosseguir` que chama `medusaMergeOrderMetadata(id, { fiscal: decisao.fiscal })`, acrescentar `chaveNfe = decisao.fiscal.chave_acesso ?? null`.
- Trocar o bloco `if (body.use_carrier) { … carrierCreateLabel({ destino: {…} }) }` por:

```ts
    if (body.use_carrier) {
      const fiscais = lerDadosFiscais(order)
      label = await carrierCreateLabel(
        {
          itens: order.items.map((i) => ({ titulo: [i.title, i.variant_title].filter(Boolean).join(" — "), quantidade: i.quantity, preco_unitario: i.unit_price })),
          endereco: order.shipping_address,
          email: order.email ?? null,
          cpf: fiscais.cpf,
          numero: fiscais.numero,
          bairro: fiscais.bairro,
          dados_do_frete: order.shipping_methods?.[0]?.data ?? null,
        },
        chaveNfe
      )
    }
```

Atenção à ordem: a etiqueta é comprada **antes** de `medusaFulfillOrder`; se a SuperFrete falhar, o `catch` devolve 502 com a mensagem e o pedido continua `not_fulfilled` (o operador corrige ou usa o manual). Não mudar essa ordem.

- [ ] **Step 6: Tela de pedidos**

Em `app/(painel)/pedidos/page.tsx`, trocar os textos que citam "Melhor Envio" por "SuperFrete" (`grep -n "Melhor Envio" "app/(painel)/pedidos/page.tsx"`). Se a tela importa `CARRIER_NAME`, nada mais a fazer.

Run: `grep -rni "melhor.\?envio" apps/cockpit --include=*.ts --include=*.tsx`
Expected: nenhuma ocorrência.

- [ ] **Step 7: Typecheck e testes** — `cd apps/cockpit && npx tsc --noEmit && npm test`. Expected: verde.

- [ ] **Step 8: Verificar com o sandbox**

Cockpit local com `SUPERFRETE_TOKEN` de sandbox, `SUPERFRETE_SANDBOX=true` e `SUPERFRETE_FROM_*` no `.env.local` (valores do dono; se faltarem, **parar e pedir**). A conta sandbox precisa de saldo de teste. Roteiro: pedido local feito pela vitrine com SEDEX → Cockpit › Pedidos › abrir › "Gerar etiqueta (SuperFrete)" → conferir que o pedido vira "enviado", com rastreio e link do PDF, e que a etiqueta no painel do sandbox saiu como SEDEX com o volume cotado. Screenshot para o Halt. O login do Cockpit é do dono (ver `contexto-claude/eclat-validacao-cockpit-producao.md`): se não houver sessão, validar pela rota `POST /api/orders/{id}/dispatch` não é possível sem o cookie — pedir ao dono que clique e reporte.

- [ ] **Step 9: Commit** — `git commit -m "feat(cockpit): etiqueta pela SuperFrete no despacho (sai o Melhor Envio preparado)"`

**HALT F3:** reportar ao dono.

---

# FASE F4 — Documentação e go-live

### Task 15: SOP, estado do projeto e roteiro do dono

**Files:**
- Modify: `architecture/envios.md`, `CLAUDE.md` (seção "Estado atual"), `progress.md`
- Modify (fora do repo): `../contexto-claude/eclat-frete-superfrete.md`

- [ ] **Step 1: `architecture/envios.md`**

Trocar o título da seção "Modo transportadora (Melhor Envio)" e todo o seu conteúdo por:

```markdown
## Frete calculado no checkout (SuperFrete)
Spec: `docs/superpowers/specs/2026-09-18-frete-superfrete-design.md`. Provider `superfrete_superfrete`
(`apps/backend/src/modules/superfrete`), só registrado se `SUPERFRETE_TOKEN` existir no ambiente.
- Três opções `calculated`: Econômica (Mini Envios, `mini`), PAC (`pac`), SEDEX (`sedex`).
- Preço = cotação + margem, arredondado para cima até o próximo `,90`. Frete grátis por piso (MG × Brasil)
  sobre o valor das peças já com desconto: a mais barata zera, as outras cobram a diferença.
- Embalagem por quantidade de peças (`embalagem.ts`); Mini Envios só quando o pacote cabe no limite.
- SuperFrete fora do ar: só PAC, pelo valor de reserva. O erro vai para o log com `[superfrete]`.
- O pedido guarda em `shipping_methods.data`: `servico`, `pacote`, `prazo_min`, `prazo_max`.
- Variáveis do backend: `SUPERFRETE_TOKEN`, `SUPERFRETE_SANDBOX`, `SUPERFRETE_FROM_POSTAL_CODE`,
  `SUPERFRETE_CONTACT_EMAIL`; opcionais `FRETE_MARGEM_CENTAVOS`, `FRETE_GRATIS_MG_CENTAVOS`,
  `FRETE_GRATIS_BRASIL_CENTAVOS`, `FRETE_RESERVA_PAC_CENTAVOS`.
- Ligar/desligar na região: `node apps/backend/ativar-superfrete.mjs` (simula) · `--aplicar` · `--aplicar --desfazer`.
  Em produção, só com o "pode aplicar" do dono.

## Etiqueta pelo Cockpit (SuperFrete)
Botão **"Gerar etiqueta (SuperFrete)"** no despacho: `POST /api/v0/cart` → `POST /api/v0/checkout` (paga com o
saldo da carteira) → grava rastreio + PDF no Medusa → aviso WhatsApp. Código: `apps/cockpit/lib/shipping.ts`
e `lib/superfrete-etiqueta.ts`.
- Usa o serviço e o pacote gravados no pedido; pedido antigo ("Entrega Padrão") sai como PAC.
- Com NFe emitida no despacho, a chave vai na etiqueta; sem ela, vai como declaração de conteúdo.
- Exige CPF no pedido. Sem CPF, sem saldo ou com erro da SuperFrete, o despacho NÃO acontece e o modo manual segue disponível.
- Variáveis do Cockpit: `SUPERFRETE_TOKEN`, `SUPERFRETE_SANDBOX`, `SUPERFRETE_CONTACT_EMAIL` e o remetente em
  `SUPERFRETE_FROM_NAME`, `_DOCUMENT` (CNPJ), `_PHONE`, `_ADDRESS`, `_NUMBER`, `_COMPLEMENT`, `_DISTRICT`, `_CITY`, `_STATE`, `_POSTAL_CODE`.
  Valores só no ambiente — este repositório é público.
```

E, no topo do arquivo, trocar a frase que cita o Melhor Envio por: "A integração com transportadora é a **SuperFrete**; sem credenciais, opera-se no **modo manual**."

- [ ] **Step 2: `CLAUDE.md` — Estado atual**

Acrescentar após a linha do "E-mail transacional (Resend)":

```markdown
- Frete (SuperFrete): cotação calculada no checkout (provider `superfrete_superfrete`, `src/modules/superfrete`) + etiqueta pelo Cockpit, em código desde 2026-09 (spec `docs/superpowers/specs/2026-09-18-frete-superfrete-design.md`, SOP `architecture/envios.md`). Só liga com `SUPERFRETE_TOKEN` no ambiente. GO-LIVE PENDENTE do dono: variáveis no Railway e no Cockpit, `railway up`, `ativar-superfrete.mjs --aplicar` com "pode aplicar", saldo na carteira, pedido real.
```

Na linha da Fase 4 do Cockpit e na de pendências do "COCKPIT COMPLETO", trocar "Melhor Envio PREPARADA"/"transportadora real via Melhor Envio — credenciais" por "SuperFrete (ver linha Frete)".

- [ ] **Step 3: `progress.md` — roteiro de go-live**

Acrescentar ao fim uma seção "Frete SuperFrete — go-live (dono)" com o roteiro:

```markdown
## Frete SuperFrete — go-live (dono)
1. Railway (serviço do backend) → Variables: `SUPERFRETE_TOKEN` (produção), `SUPERFRETE_SANDBOX=false`, `SUPERFRETE_FROM_POSTAL_CODE`, `SUPERFRETE_CONTACT_EMAIL`.
2. Ambiente do Cockpit: as mesmas + `SUPERFRETE_FROM_*` (remetente completo, `_DOCUMENT` = CNPJ).
3. Merge/push da branch `feat/frete-superfrete`; backend: `railway up --detach`; deploy da vitrine e do Cockpit.
4. `node apps/backend/ativar-superfrete.mjs` (simulação) → conferir → dizer "pode aplicar" → `--aplicar`.
5. Na vitrine: carrinho com CEP de MG e de outra UF, abaixo e acima do piso. Conferir preço `,90`, prazo e "Grátis".
6. Saldo na carteira da SuperFrete. Pedido real → Cockpit › Despachar › "Gerar etiqueta (SuperFrete)".
7. Conferir: valor debitado da carteira × frete cobrado da cliente; rastreio no WhatsApp; PDF abre.
8. Se algo der errado: `node apps/backend/ativar-superfrete.mjs --aplicar --desfazer` volta a "Entrega Padrão".
```

- [ ] **Step 4: `contexto-claude/eclat-frete-superfrete.md`**

Atualizar a seção "Estado" com: fases concluídas em código, branch, o que falta do dono (itens 1–7 acima) e o resultado da sonda F0. Datas absolutas. Sem token, CPF, CNPJ nem endereço.

- [ ] **Step 5: Commit** — `git add architecture/envios.md CLAUDE.md progress.md && git commit -m "docs(frete): SOP de envios, estado do projeto e roteiro de go-live"`

**HALT F4:** entregar ao dono os dois comandos de push (ver `contexto-claude/eclat-git-push.md`) e o roteiro de go-live. Deploy e ativação em produção são dele.

---

## Self-review (feito ao escrever o plano)

- **Cobertura da spec:** §2.1–2.8 → Global Constraints + Tasks 3, 4, 7; §4.1 → Tasks 2–7; §4.2 → Tasks 7, 9, 11 (opção escondida); §4.3 → Task 3 (+ verificação na Task 1); §4.4 → Tasks 4, 6, 7, 8; §4.5 → Tasks 5, 7, 8, 11; §4.6 → Tasks 8, 10, 12; §4.7 → Tasks 13, 14; §4.8 → Tasks 7, 13; §5 → Tasks 5, 13, 15; §6 → Task 9; §7 → testes de cada task + roteiros; §8 → fases; §9 riscos → Task 1 (mínimo dos Correios), Task 13 (pacote velho), Task 15 (roteiro confere cotado × debitado).
- **Desvios conscientes da spec, já refletidos nela:** script de ativação é `.mjs` com `--aplicar` (padrão do repo), não `src/scripts/*.ts --dry-run`; o código do tipo da opção é igual ao id do serviço (`mini`, não `economica`) para a vitrine casar opção ↔ prazo; `data.pacote` ganhou o campo `pecas` para detectar pacote velho.
- **Consistência de tipos:** `Servico`, `Pacote`, `Cotacao`, `Parametros`, `Precos`, `Cotador` são definidos uma vez (Tasks 3–5) e só consumidos depois; o `data` do shipping method (Task 7) é o mesmo lido nas Tasks 8 e 13.
