# Benefício Conjunto — F4 Carrinho — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A cliente vê o Benefício Conjunto no carrinho, no checkout e no pedido: etiqueta "Conjunto" nas linhas, "Benefício Conjunto −R$ X" separado de "Cupom −R$ Y" no resumo, aviso quando um cupom coexiste com conjunto, e o bloco "Feche mais um conjunto" com candidatas de adição rápida; o Cockpit mostra o mesmo desdobramento no detalhe do pedido.

**Architecture:** O backend já faz tudo que importa (gancho marca as unidades, promoções `CONJUNTO-<regra_id>` geram os ajustes, `GET /store/conjuntos/oportunidades?cart_id=` devolve conjuntos formados + oportunidades). A F4 é **apresentação**: um módulo **puro** `src/lib/util/carrinho-conjunto.ts` (agrupamento dos ajustes por prefixo `CONJUNTO-`, etiquetas por linha, aviso de cupom, montagem dos gatilhos) testado com Vitest; um leitor `getCarrinhoConjunto` em `src/lib/data/conjuntos.ts` (rota `oportunidades`, `no-store`, hidrata candidatas com `listProductsByIds`); e componentes que só recebem dados prontos. `retrieveCart`/`retrieveOrder` passam a pedir `*items.adjustments`. No Cockpit, `medusaGetOrder` pede os ajustes e um helper puro agrupa. Nenhuma mudança de backend.

**Tech Stack:** Next 15.5 App Router, Medusa Store/Admin API (rotas F1), Vitest 3, Tailwind, componentes existentes (`Item`, `CartTotals`, `DiscountCode`, `showToast`, `pushEcommerceEvent`, utilitários de variante `lib/util/pdp-variants`, `adicao-conjunto.ts` da F3).

**Spec:** `docs/superpowers/specs/2026-09-08-beneficio-conjunto-design.md` §7.5 (carrinho e checkout), §7.7 (`conjunto_trigger_click`), §6.1 (marcas), §6.3/§12 (linhas separadas, limite I2), §6.5 (`oportunidades`), §11 itens 1–4, 9, 10. SOP do backend: `architecture/conjunto.md` (§6.5 rotas, §13 nota F4). Vitrine F3: `architecture/catalog.md` "Conjuntos na vitrine (Fase F3)".

## Global Constraints

- **O carrinho é a verdade.** Nenhum desconto é calculado na vitrine: os valores vêm dos `adjustments` das linhas (`amount` decimal em R$) e dos totais do carrinho/pedido. Somas sempre em **centavos** (`Math.round(amount*100)`), exibição com `convertToLocale({ amount: centavos/100, currency_code })` (mesmo formatador do `CartTotals`).
- **Agrupamento por prefixo:** ajuste cujo `code` começa com `CONJUNTO-` (constante `CODIGO_PREFIXO` do backend, `apps/backend/src/modules/beneficio-conjunto/utils/promocao.ts`) é "Benefício Conjunto"; qualquer outro ajuste de linha é "Cupom".
- **Quem forma qual conjunto** só a rota `GET /store/conjuntos/oportunidades?cart_id=` sabe (`conjuntos[].unidades[].item_id`) — `no-store`, nunca cacheada, chamada **uma vez por render** de página (carrinho e checkout), nunca por linha. Falha → carrinho sem etiquetas e sem gatilhos, nunca lança (`console.error("[conjuntos] …")`).
- **Linhas separadas:** toda adição feita pelos gatilhos leva `metadata.conjunto_slot` (`slotGatilho(categoria_faltante)`), como os fluxos da F3 — nunca funde com uma linha existente.
- **Copy pt-BR**: "Benefício Conjunto" (nunca "promoção"), "Cupom", etiqueta "Conjunto" / "Conjunto 1/2", bloco "Feche mais um conjunto", aviso "Cupom não se aplica a peças com Benefício Conjunto".
- **Tracking (spec §7.7):** evento custom `conjunto_trigger_click` com `collection_id` e `categoria_faltante` (via `pushEcommerceEvent(evento, undefined, extra)`), e `add_to_cart` com `item_list_name: "Feche mais um conjunto"` para a peça adicionada pelo gatilho.
- **tsconfig es5 no storefront:** nada de spread de `Map`/`Set`; usar `Array.from`. Leitores em `lib/data/*` com `import "server-only"`; módulos puros em `lib/util/*` sem React/I/O.
- **Cockpit** lê e escreve só pela Admin API (`lib/medusa.ts`); dinheiro do Medusa chega **decimal** (o `brl()` da tela de pedidos formata decimal, `apps/cockpit/app/(painel)/pedidos/page.tsx:47`); somar em centavos e dividir por 100 antes de exibir.
- **Validação no navegador** com `mcp__plugin_chrome-devtools-mcp` contra o **backend local** semeado (`architecture/catalog.md`, seção "Como validar localmente (com o seed)"); produção tem a regra padrão inativa e **não recebe escrita nenhuma** nesta fase. Nunca editar `.env.local`.
- Suítes na partida: storefront 172 (`npm test --workspace=apps/storefront`), backend 73 integração / 30 unit (Windows: `cd apps/backend && npm_config_script_shell="C:\Program Files\Git\usr\bin\bash.exe" npm run test:integration:http`), cockpit 36 (`npm test --workspace=apps/cockpit`). Backend inalterado. `npx tsc -p apps/storefront --noEmit` e `npx tsc -p apps/cockpit --noEmit` limpos. Commits pequenos com trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Rulings do controller (não reabrir)

1. **Etiquetas numeradas só onde existe carrinho** (página do carrinho e checkout): vêm de `conjuntos` da rota `oportunidades`; "Conjunto" quando há 1 conjunto, "Conjunto n/T" por conjunto do qual a linha participa (linha em dois conjuntos → "Conjunto 1/2 · Conjunto 2/2"); linha com K unidades em conjunto de N → sufixo "(K de N)". Nas páginas de **pedido** (confirmação, conta) e no **Cockpit** a etiqueta é só "Conjunto", derivada de ajuste `CONJUNTO-` **ou** `metadata.conjunto_slot` — limite documentado: a unidade não descontada de uma regra "menor peça" adicionada pelo botão comum da PDP (sem slot e sem ajuste) fica sem etiqueta no pedido.
2. **Resumo:** "Benefício Conjunto" = soma dos ajustes `CONJUNTO-*` das linhas; "Cupom" = soma dos demais ajustes de linha. Ajustes de método de envio não entram (não existem cupons de frete no projeto); se `discount_subtotal` > soma dos dois grupos, a diferença aparece na linha genérica "Desconto" existente. Cada linha só aparece quando > 0.
3. **Lista de cupons** (`DiscountCode`) esconde promoções `CONJUNTO-*` (são automáticas, não cupons); o **aviso** "Cupom não se aplica a peças com Benefício Conjunto" aparece quando há pelo menos um cupom visível aplicado **e** o grupo "Benefício Conjunto" > 0.
4. **Gatilhos só na página do carrinho** (não no checkout, não no mini-cart): uma seção por oportunidade, na ordem do backend, até 3 candidatas (ordem do backend, só as com variante disponível); card = foto na primeira cor disponível, nome, preço "a partir de" (`precoMinDisponivel`), chips de tamanho inline (mesmo estilo de `complete-set/parceira.tsx`), botão "Adicionar"; adiciona 1 unidade com `slotGatilho`; sucesso → `showToast("<título> adicionado à sacola")` (a página se atualiza sozinha pela revalidação do carrinho); falha → toast "Não foi possível adicionar <título>. Tente de novo.".
5. **Mini-cart (dropdown do header) não muda** nesta fase (spec §7.5 lista carrinho, checkout e pedido).
6. **Cockpit:** só apresentação no detalhe do pedido existente (`pedidos/page.tsx`) com campos a mais em `medusaGetOrder`; sem rota nova, sem escrita.
7. **Aceite §11 item 9 (pedido concluído):** metade storefront validada localmente **se** o checkout local fechar com o seed atual (frete + pagamento manual); se não fechar, a Task 6 registra o item como "validado pelo dono no primeiro pedido real" — nunca criar pedido em produção. Metade Cockpit (tela do pedido) é do dono (login Supabase), com a resposta da Admin API conferida pelo implementador.
8. **Sem teste de componente React** (padrão do repo): toda lógica testável fica no módulo puro; componentes só mapeiam dados → JSX.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `apps/storefront/src/lib/util/carrinho-conjunto.ts` (novo) | puro: `ehAjusteConjunto`, `agruparDescontos`, `etiquetasDoCarrinho`, `etiquetaDoPedido`, `cuponsVisiveis`, `avisoCupom`, `montarGatilhos`, `tituloGatilho`, `slotGatilho` + tipos `ConjuntoFormadoStore`, `OportunidadeStore`, `Gatilho`, `GruposDesconto`, `LinhaComAjustes` |
| `apps/storefront/src/lib/util/carrinho-conjunto.test.ts` (novo) | Vitest do módulo acima |
| `apps/storefront/src/lib/data/conjuntos.ts` (modificar) | `getCarrinhoConjunto(cartId, countryCode, { comGatilhos })` — rota `oportunidades` (`no-store`), hidratação das candidatas, nomes de coleção/categoria |
| `apps/storefront/src/lib/data/cart.ts` (modificar) | `retrieveCart`: `fields` padrão ganha `*items.adjustments` |
| `apps/storefront/src/lib/data/orders.ts` (modificar) | `retrieveOrder`: `fields` ganha `*items.adjustments` |
| `apps/storefront/src/modules/common/components/cart-totals/index.tsx` (modificar) | linhas "Benefício Conjunto" / "Cupom" a partir de `agruparDescontos(totals.items)` |
| `apps/storefront/src/modules/checkout/components/discount-code/index.tsx` (modificar) | esconde `CONJUNTO-*`; aviso de cupom |
| `apps/storefront/src/modules/cart/components/item/index.tsx` (modificar) | prop `etiqueta?: string \| null` |
| `apps/storefront/src/modules/cart/templates/items.tsx`, `preview.tsx` (modificar) | prop `etiquetas?: Record<string, string>` |
| `apps/storefront/src/modules/cart/templates/index.tsx` (modificar) | recebe `etiquetas` e `gatilhos`; renderiza `GatilhosConjunto` sob a lista |
| `apps/storefront/src/app/[countryCode]/(main)/cart/page.tsx` (modificar) | chama `getCarrinhoConjunto(cart.id, countryCode)` |
| `apps/storefront/src/modules/cart/components/gatilhos-conjunto/index.tsx` (novo) | seção "Feche mais um conjunto" (server-safe, recebe `gatilhos`) |
| `apps/storefront/src/modules/cart/components/gatilhos-conjunto/candidata.tsx` (novo) | client: card da candidata com chips de tamanho + "Adicionar" + tracking |
| `apps/storefront/src/app/[countryCode]/(checkout)/checkout/page.tsx`, `modules/checkout/templates/checkout-summary/index.tsx` (modificar) | etiquetas no resumo do checkout |
| `apps/storefront/src/modules/order/components/{items,item,order-summary}/index.tsx` (modificar) | etiqueta "Conjunto" e resumo desdobrado no pedido |
| `apps/cockpit/lib/pedido-conjunto.ts` (+ `.test.ts`, novos) | puro: `agruparDescontosPedido`, `etiquetaConjunto` |
| `apps/cockpit/lib/medusa.ts` (modificar) | `medusaGetOrder` pede `discount_total`, `items.metadata`, `items.adjustments.code`, `items.adjustments.amount`; tipos |
| `apps/cockpit/app/(painel)/pedidos/page.tsx` (modificar) | etiqueta no item e linhas "Benefício Conjunto"/"Cupom" nos totais |
| Docs | `architecture/catalog.md` (nova seção "Carrinho e pedido (Fase F4)"), `architecture/conjunto.md` (§13 F4 → entregue, §12 limite da etiqueta), `architecture/cockpit.md` §7 (detalhe do pedido), spec §7.5/§10/§11, `CLAUDE.md` (linha do Benefício Conjunto), `progress.md` (aceite local + roteiro do dono) |

---

### Task 1: Módulo puro `carrinho-conjunto.ts`

**Files:**
- Create: `apps/storefront/src/lib/util/carrinho-conjunto.ts`
- Test: `apps/storefront/src/lib/util/carrinho-conjunto.test.ts`

**Interfaces:**
- Consumes (F3, `lib/util/conjuntos.ts`): `RegraStore`, `ColecaoStore`, `descricaoRegra(regra, n): string`, `precoMinDisponivel(p): number | null`, `slotMetadata(handle, i, agora?)`.
- Produces (usados pelas Tasks 2–5): tudo que está exportado no código abaixo, com esses nomes exatos.

- [ ] **Step 1: Escrever os testes (falhando)**

```ts
// apps/storefront/src/lib/util/carrinho-conjunto.test.ts
import { describe, expect, it } from "vitest"
import type { HttpTypes } from "@medusajs/types"
import {
  agruparDescontos,
  avisoCupom,
  cuponsVisiveis,
  ehAjusteConjunto,
  etiquetaDoPedido,
  etiquetasDoCarrinho,
  montarGatilhos,
  slotGatilho,
  tituloGatilho,
  type ConjuntoFormadoStore,
  type Gatilho,
} from "./carrinho-conjunto"

const conj = (id: string, itens: string[]): ConjuntoFormadoStore => ({
  id,
  tipo: "colecao",
  regra_id: "creg_1",
  unidades: itens.map((item_id) => ({ item_id, product_id: "p", preco_unitario: 18900, desconto_unitario: 0 })),
})

const produto = (id: string, disponivel = true): HttpTypes.StoreProduct =>
  ({
    id,
    title: `Produto ${id}`,
    handle: id,
    variants: [
      {
        id: `v-${id}`,
        manage_inventory: true,
        inventory_quantity: disponivel ? 3 : 0,
        allow_backorder: false,
        calculated_price: { calculated_amount: 189 },
      },
    ],
  }) as unknown as HttpTypes.StoreProduct

describe("ehAjusteConjunto", () => {
  it("reconhece o prefixo CONJUNTO-", () => {
    expect(ehAjusteConjunto("CONJUNTO-creg_1")).toBe(true)
    expect(ehAjusteConjunto("CUPOM10")).toBe(false)
    expect(ehAjusteConjunto(undefined)).toBe(false)
    expect(ehAjusteConjunto(null)).toBe(false)
  })
})

describe("agruparDescontos", () => {
  it("separa conjunto de cupom, em centavos, sem erro de ponto flutuante", () => {
    const g = agruparDescontos([
      { id: "a", quantity: 1, adjustments: [{ code: "CONJUNTO-creg_1", amount: 18.9 }] },
      { id: "b", quantity: 1, adjustments: [{ code: "CUPOM10", amount: 25.9 }, { code: "CONJUNTO-creg_1", amount: 0.1 }] },
    ])
    expect(g).toEqual({ conjunto: 1900, cupom: 2590 })
  })
  it("tolera itens sem ajustes e lista vazia", () => {
    expect(agruparDescontos([{ id: "a", quantity: 1 }])).toEqual({ conjunto: 0, cupom: 0 })
    expect(agruparDescontos(undefined)).toEqual({ conjunto: 0, cupom: 0 })
  })
})

describe("etiquetasDoCarrinho", () => {
  const itens = [
    { id: "top", quantity: 2 },
    { id: "legging", quantity: 1 },
    { id: "short", quantity: 1 },
    { id: "meia", quantity: 1 },
  ]
  it("um conjunto → 'Conjunto' nas linhas dele, nada nas outras", () => {
    const e = etiquetasDoCarrinho([conj("c1", ["top", "legging"])], itens)
    expect(e.legging).toBe("Conjunto")
    expect(e.top).toBe("Conjunto (1 de 2)")
    expect(e.short).toBeUndefined()
    expect(e.meia).toBeUndefined()
  })
  it("dois conjuntos → numerados; linha em ambos lista os dois", () => {
    const e = etiquetasDoCarrinho([conj("c1", ["top", "legging"]), conj("c2", ["top", "short"])], itens)
    expect(e.legging).toBe("Conjunto 1/2")
    expect(e.short).toBe("Conjunto 2/2")
    expect(e.top).toBe("Conjunto 1/2 · Conjunto 2/2")
  })
  it("sem conjuntos → objeto vazio", () => {
    expect(etiquetasDoCarrinho([], itens)).toEqual({})
  })
})

describe("etiquetaDoPedido", () => {
  it("por ajuste CONJUNTO- ou por conjunto_slot; senão null", () => {
    expect(etiquetaDoPedido({ id: "a", quantity: 1, adjustments: [{ code: "CONJUNTO-x", amount: 1 }] })).toBe("Conjunto")
    expect(etiquetaDoPedido({ id: "b", quantity: 1, metadata: { conjunto_slot: "look#0#1" } })).toBe("Conjunto")
    expect(etiquetaDoPedido({ id: "c", quantity: 1, adjustments: [{ code: "CUPOM10", amount: 1 }] })).toBeNull()
    expect(etiquetaDoPedido({ id: "d", quantity: 1 })).toBeNull()
  })
})

describe("cuponsVisiveis / avisoCupom", () => {
  const promos = [{ code: "CONJUNTO-creg_1" }, { code: "CUPOM10" }]
  it("esconde promoções CONJUNTO-", () => {
    expect(cuponsVisiveis(promos).map((p) => p.code)).toEqual(["CUPOM10"])
    expect(cuponsVisiveis(undefined)).toEqual([])
  })
  it("aviso só com cupom visível E benefício no carrinho", () => {
    const comConjunto = [{ id: "a", quantity: 1, adjustments: [{ code: "CONJUNTO-creg_1", amount: 18.9 }] }]
    expect(avisoCupom({ promotions: promos, items: comConjunto })).toBe(true)
    expect(avisoCupom({ promotions: [{ code: "CONJUNTO-creg_1" }], items: comConjunto })).toBe(false)
    expect(avisoCupom({ promotions: promos, items: [{ id: "a", quantity: 1 }] })).toBe(false)
  })
})

describe("montarGatilhos / tituloGatilho / slotGatilho", () => {
  const colecoes = [{ collection_id: "col_1", regra: { tipo_desconto: "menor_peca_percentual" as const, valor: 20 }, pares: [] }]
  const produtos = new Map<string, HttpTypes.StoreProduct>([
    ["p1", produto("p1")],
    ["p2", produto("p2", false)],
    ["p3", produto("p3")],
  ])
  const oportunidade = { collection_id: "col_1", categoria_faltante: "tops", a_partir_do_item_id: "legging", candidatos: ["p1", "p2", "p3", "p-fantasma"] }
  it("hidrata candidatas disponíveis na ordem, com nomes de coleção e categoria", () => {
    const g = montarGatilhos([oportunidade], produtos, colecoes, new Map([["col_1", "Família Blackout"]]), new Map([["tops", "Tops"]]))
    expect(g).toHaveLength(1)
    expect(g[0].candidatas.map((p) => p.id)).toEqual(["p1", "p3"])
    expect(g[0].colecaoNome).toBe("Família Blackout")
    expect(g[0].categoriaNome).toBe("Tops")
    expect(g[0].regra.valor).toBe(20)
  })
  it("descarta oportunidade sem candidata disponível ou sem regra da coleção", () => {
    expect(montarGatilhos([{ ...oportunidade, candidatos: ["p2"] }], produtos, colecoes, new Map(), new Map())).toEqual([])
    expect(montarGatilhos([{ ...oportunidade, collection_id: "col_x" }], produtos, colecoes, new Map(), new Map())).toEqual([])
  })
  it("cai para o handle quando não há nome de categoria", () => {
    const g = montarGatilhos([oportunidade], produtos, colecoes, new Map(), new Map())
    expect(g[0].categoriaNome).toBe("tops")
    expect(g[0].colecaoNome).toBe("")
  })
  it("título nomeia categoria, coleção e a regra", () => {
    const g: Gatilho = { collection_id: "col_1", colecaoNome: "Família Blackout", categoria_faltante: "tops", categoriaNome: "Tops", regra: colecoes[0].regra, candidatas: [] }
    const t = tituloGatilho(g)
    expect(t).toContain("Mais uma peça de Tops da coleção Família Blackout fecha outro conjunto")
    expect(tituloGatilho({ ...g, colecaoNome: "" })).not.toContain("da coleção")
  })
  it("slotGatilho gera conjunto_slot próprio e único por instante", () => {
    expect(slotGatilho("tops", 123)).toEqual({ conjunto_slot: "gatilho-tops#0#123" })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/util/carrinho-conjunto.test.ts` (de `apps/storefront`)
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar o módulo**

```ts
// apps/storefront/src/lib/util/carrinho-conjunto.ts
// Módulo puro do Benefício Conjunto no carrinho/checkout/pedido (F4, spec §7.5). Sem I/O, sem
// React. O carrinho é a verdade: aqui só se agrupa o que o Medusa já calculou (ajustes das linhas
// com código `CONJUNTO-<regra_id>`) e se monta a apresentação (etiquetas, aviso, gatilhos).
import type { HttpTypes } from "@medusajs/types"
import { type ColecaoStore, type RegraStore, descricaoRegra, precoMinDisponivel, slotMetadata } from "./conjuntos"

// Mesmo prefixo de `CODIGO_PREFIXO` no backend (`utils/promocao.ts`).
export const PREFIXO_CONJUNTO = "CONJUNTO-"

export type AjusteLinha = { code?: string | null; amount?: number | null }
export type LinhaComAjustes = {
  id: string
  quantity: number
  adjustments?: AjusteLinha[] | null
  metadata?: Record<string, unknown> | null
}
/** Centavos inteiros. */
export type GruposDesconto = { conjunto: number; cupom: number }

// Resposta de GET /store/conjuntos/oportunidades?cart_id= (F1; dinheiro em centavos no backend).
export type UnidadeStore = { item_id: string; product_id: string; preco_unitario: number; desconto_unitario: number }
export type ConjuntoFormadoStore = { id: string; tipo: "curado" | "colecao"; regra_id: string; unidades: UnidadeStore[] }
export type OportunidadeStore = { collection_id: string; categoria_faltante: string; a_partir_do_item_id: string; candidatos: string[] }

export type Gatilho = {
  collection_id: string
  colecaoNome: string
  categoria_faltante: string
  categoriaNome: string
  regra: RegraStore
  candidatas: HttpTypes.StoreProduct[]
}

export function ehAjusteConjunto(code?: string | null): boolean {
  return typeof code === "string" && code.indexOf(PREFIXO_CONJUNTO) === 0
}

const centavos = (v?: number | null): number => Math.round((v ?? 0) * 100)

// Ruling 2: "Benefício Conjunto" = ajustes CONJUNTO-*; "Cupom" = todos os outros ajustes de linha.
export function agruparDescontos(itens?: LinhaComAjustes[] | null): GruposDesconto {
  const g: GruposDesconto = { conjunto: 0, cupom: 0 }
  for (const item of itens ?? []) {
    for (const a of item.adjustments ?? []) {
      if (ehAjusteConjunto(a.code)) g.conjunto += centavos(a.amount)
      else g.cupom += centavos(a.amount)
    }
  }
  return g
}

// Ruling 1: etiqueta por linha a partir dos conjuntos formados (rota `oportunidades`).
export function etiquetasDoCarrinho(
  conjuntos: ConjuntoFormadoStore[],
  itens: { id: string; quantity: number }[]
): Record<string, string> {
  const total = conjuntos.length
  if (!total) return {}
  const porItem: Record<string, { numeros: number[]; unidades: number }> = {}
  conjuntos.forEach((c, idx) => {
    for (const u of c.unidades) {
      if (!porItem[u.item_id]) porItem[u.item_id] = { numeros: [], unidades: 0 }
      const e = porItem[u.item_id]
      if (e.numeros.indexOf(idx + 1) === -1) e.numeros.push(idx + 1)
      e.unidades += 1
    }
  })
  const out: Record<string, string> = {}
  for (const item of itens) {
    const e = porItem[item.id]
    if (!e) continue
    const base = total === 1 ? "Conjunto" : e.numeros.map((n) => `Conjunto ${n}/${total}`).join(" · ")
    out[item.id] = e.unidades < item.quantity ? `${base} (${e.unidades} de ${item.quantity})` : base
  }
  return out
}

// Ruling 1 (páginas de pedido e Cockpit): sem carrinho, a etiqueta vem do ajuste ou do slot.
export function etiquetaDoPedido(item: LinhaComAjustes): string | null {
  const porAjuste = (item.adjustments ?? []).some((a) => ehAjusteConjunto(a.code))
  const porSlot = typeof item.metadata?.conjunto_slot === "string"
  return porAjuste || porSlot ? "Conjunto" : null
}

// Ruling 3: promoções CONJUNTO-* são automáticas, não cupons — não aparecem na lista.
export function cuponsVisiveis<T extends { code?: string | null }>(promotions?: T[] | null): T[] {
  return (promotions ?? []).filter((p) => !ehAjusteConjunto(p.code))
}

export function avisoCupom(cart: {
  promotions?: { code?: string | null }[] | null
  items?: LinhaComAjustes[] | null
}): boolean {
  return cuponsVisiveis(cart.promotions).length > 0 && agruparDescontos(cart.items).conjunto > 0
}

// Ruling 4: candidatas na ordem do backend, só disponíveis; nomes com fallback para o handle.
export function montarGatilhos(
  oportunidades: OportunidadeStore[],
  produtos: Map<string, HttpTypes.StoreProduct>,
  colecoes: ColecaoStore[],
  nomesColecoes: Map<string, string>,
  nomesCategorias: Map<string, string>
): Gatilho[] {
  const out: Gatilho[] = []
  for (const o of oportunidades) {
    const col = colecoes.find((c) => c.collection_id === o.collection_id)
    if (!col) continue
    const candidatas = o.candidatos
      .map((id) => produtos.get(id))
      .filter((p): p is HttpTypes.StoreProduct => !!p && precoMinDisponivel(p) !== null)
    if (!candidatas.length) continue
    out.push({
      collection_id: o.collection_id,
      colecaoNome: nomesColecoes.get(o.collection_id) ?? "",
      categoria_faltante: o.categoria_faltante,
      categoriaNome: nomesCategorias.get(o.categoria_faltante) ?? o.categoria_faltante,
      regra: col.regra,
      candidatas,
    })
  }
  return out
}

export function tituloGatilho(g: Gatilho): string {
  const colecao = g.colecaoNome ? ` da coleção ${g.colecaoNome}` : ""
  return `Mais uma peça de ${g.categoriaNome}${colecao} fecha outro conjunto — ${descricaoRegra(g.regra, 2)}.`
}

// Linha separada para a peça do gatilho (Global Constraints), mesmo formato dos slots da F3.
export function slotGatilho(categoriaFaltante: string, agora: number = Date.now()): { conjunto_slot: string } {
  return slotMetadata(`gatilho-${categoriaFaltante}`, 0, agora)
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run src/lib/util/carrinho-conjunto.test.ts` (de `apps/storefront`)
Expected: PASS (14 testes). Depois `npm test --workspace=apps/storefront` → 186.

- [ ] **Step 5: Commit**

```bash
git add apps/storefront/src/lib/util/carrinho-conjunto.ts apps/storefront/src/lib/util/carrinho-conjunto.test.ts
git commit -m "feat(vitrine): módulo puro do Benefício Conjunto no carrinho (agrupamento, etiquetas, gatilhos)"
```

---

### Task 2: Leitor `getCarrinhoConjunto` + campos `adjustments` no carrinho e no pedido

**Files:**
- Modify: `apps/storefront/src/lib/data/conjuntos.ts` (acrescentar função + exports)
- Modify: `apps/storefront/src/lib/data/cart.ts:24-27` (`retrieveCart`, `fields` padrão)
- Modify: `apps/storefront/src/lib/data/orders.ts:17-22` (`retrieveOrder`, `fields`)

**Interfaces:**
- Consumes: Task 1 (`ConjuntoFormadoStore`, `OportunidadeStore`, `Gatilho`, `montarGatilhos`); já existentes em `lib/data/conjuntos.ts`: `fetchVitrineRaw()` (privada, mesmo arquivo), `listProductsByIds(ids, countryCode)`, `listCollections()`, `listCategories()`, `sdk`.
- Produces: `getCarrinhoConjunto(cartId: string, countryCode: string, opts?: { comGatilhos: boolean }): Promise<{ conjuntos: ConjuntoFormadoStore[]; gatilhos: Gatilho[] }>` — nunca lança; sem `cartId` devolve vazio.

- [ ] **Step 1: `retrieveCart` e `retrieveOrder` pedem os ajustes**

Em `cart.ts`, o `fields ??=` passa a ser:

```ts
  fields ??=
    "*items, *region, *items.product, *items.variant, *items.thumbnail, *items.metadata, *items.adjustments, +items.total, *promotions, +shipping_methods.name"
```

Em `orders.ts` (`retrieveOrder`):

```ts
        fields:
          "*payment_collections.payments,*items,*items.metadata,*items.adjustments,*items.variant,*items.product",
```

- [ ] **Step 2: Leitor em `lib/data/conjuntos.ts`**

Acrescentar aos imports do topo:

```ts
import { type ConjuntoFormadoStore, type Gatilho, type OportunidadeStore, montarGatilhos } from "@lib/util/carrinho-conjunto"
```

E a função (antes do `export type {...}` final):

```ts
// Conjuntos formados + gatilhos "Feche mais um conjunto" do carrinho (F4, spec §7.5, ruling 1/4).
// `no-store`: estado por carrinho, muda a cada linha adicionada. Uma chamada por render de página,
// nunca por linha. Falha em qualquer ponto → vazio, nunca lança (o carrinho nunca quebra).
export async function getCarrinhoConjunto(
  cartId: string,
  countryCode: string,
  opts: { comGatilhos: boolean } = { comGatilhos: true }
): Promise<{ conjuntos: ConjuntoFormadoStore[]; gatilhos: Gatilho[] }> {
  const vazio = { conjuntos: [] as ConjuntoFormadoStore[], gatilhos: [] as Gatilho[] }
  if (!cartId) return vazio
  let raw: { conjuntos: ConjuntoFormadoStore[]; oportunidades: OportunidadeStore[] }
  try {
    raw = await sdk.client.fetch<{ conjuntos: ConjuntoFormadoStore[]; oportunidades: OportunidadeStore[] }>(
      "/store/conjuntos/oportunidades",
      { method: "GET", query: { cart_id: cartId }, cache: "no-store" }
    )
  } catch (err) {
    console.error("[conjuntos] falha ao buscar oportunidades do carrinho", cartId, err)
    return vazio
  }
  const conjuntos = raw.conjuntos ?? []
  const oportunidades = raw.oportunidades ?? []
  if (!opts.comGatilhos || !oportunidades.length) return { conjuntos, gatilhos: [] }

  try {
    const ids = Array.from(new Set(oportunidades.flatMap((o) => o.candidatos)))
    const [produtos, vitrine, colecoesResp, categorias] = await Promise.all([
      listProductsByIds(ids, countryCode),
      fetchVitrineRaw(),
      listCollections().catch(() => ({ collections: [] as HttpTypes.StoreCollection[], count: 0 })),
      listCategories().catch(() => [] as HttpTypes.StoreProductCategory[]),
    ])
    const produtosMap = new Map(produtos.map((p) => [p.id, p]))
    const nomesColecoes = new Map(colecoesResp.collections.map((c) => [c.id, c.title ?? ""]))
    const nomesCategorias = new Map(categorias.map((c) => [c.handle, c.name ?? ""]))
    return { conjuntos, gatilhos: montarGatilhos(oportunidades, produtosMap, vitrine.colecoes, nomesColecoes, nomesCategorias) }
  } catch (err) {
    console.error("[conjuntos] falha ao montar gatilhos do carrinho", cartId, err)
    return { conjuntos, gatilhos: [] }
  }
}
```

Acrescentar ao `export type {...}` final: `ConjuntoFormadoStore, Gatilho`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p apps/storefront --noEmit` (da raiz)
Expected: 0 erros. Se `listCategories()` não tipar como array de `StoreProductCategory`, tipar o `.catch` com o mesmo tipo que a função devolve (ver `buildRaizesMap` no mesmo arquivo, que já consome `listCategories()` como array com `id`/`handle`).

- [ ] **Step 4: Commit**

```bash
git add apps/storefront/src/lib/data/conjuntos.ts apps/storefront/src/lib/data/cart.ts apps/storefront/src/lib/data/orders.ts
git commit -m "feat(vitrine): leitor getCarrinhoConjunto (oportunidades) e adjustments no carrinho/pedido"
```

---

### Task 3: Página do carrinho — etiquetas, resumo desdobrado, aviso de cupom

**Files:**
- Modify: `apps/storefront/src/modules/cart/components/item/index.tsx`
- Modify: `apps/storefront/src/modules/cart/templates/items.tsx`
- Modify: `apps/storefront/src/modules/cart/templates/preview.tsx`
- Modify: `apps/storefront/src/modules/cart/templates/index.tsx`
- Modify: `apps/storefront/src/app/[countryCode]/(main)/cart/page.tsx`
- Modify: `apps/storefront/src/modules/common/components/cart-totals/index.tsx`
- Modify: `apps/storefront/src/modules/checkout/components/discount-code/index.tsx`

**Interfaces:**
- Consumes: Task 1 (`agruparDescontos`, `etiquetasDoCarrinho`, `cuponsVisiveis`, `avisoCupom`), Task 2 (`getCarrinhoConjunto`).
- Produces: `Item` ganha `etiqueta?: string | null`; `ItemsTemplate`/`ItemsPreviewTemplate` ganham `etiquetas?: Record<string, string>`; `CartTemplate` ganha `etiquetas?: Record<string, string>` e `gatilhos?: Gatilho[]` (a Task 4 renderiza os gatilhos; nesta task a prop existe e é ignorada se vazia); `CartTotals` aceita `totals.items`.

- [ ] **Step 1: `Item` com etiqueta**

Em `cart/components/item/index.tsx`, adicionar a prop e renderizar sob o título (nos dois `type`):

```tsx
type ItemProps = {
  item: HttpTypes.StoreCartLineItem
  type?: "full" | "preview"
  currencyCode: string
  etiqueta?: string | null
}

const Item = ({ item, type = "full", currencyCode, etiqueta }: ItemProps) => {
```

Dentro da célula do título, logo após `<LineItemOptions … />`:

```tsx
        {etiqueta && (
          <span
            className="mt-1 inline-block rounded-sm bg-eclat-areia px-1.5 py-0.5 text-[11px] uppercase tracking-wider text-eclat-grafite"
            data-testid="etiqueta-conjunto"
          >
            {etiqueta}
          </span>
        )}
```

- [ ] **Step 2: Templates passam as etiquetas**

`cart/templates/items.tsx`:

```tsx
type ItemsTemplateProps = {
  cart?: HttpTypes.StoreCart
  etiquetas?: Record<string, string>
}

const ItemsTemplate = ({ cart, etiquetas }: ItemsTemplateProps) => {
```

e no `.map`: `<Item key={item.id} item={item} currencyCode={cart?.currency_code} etiqueta={etiquetas?.[item.id]} />`.

`cart/templates/preview.tsx`: mesma prop `etiquetas?: Record<string, string>` e `etiqueta={etiquetas?.[item.id]}` no `<Item type="preview" …/>`.

`cart/templates/index.tsx`:

```tsx
import type { Gatilho } from "@lib/util/carrinho-conjunto"

const CartTemplate = ({
  cart,
  customer,
  etiquetas,
  gatilhos,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
  etiquetas?: Record<string, string>
  gatilhos?: Gatilho[]
}) => {
```

e `<ItemsTemplate cart={cart} etiquetas={etiquetas} />`. (`gatilhos` fica sem uso até a Task 4 — deixar um comentário `// gatilhos: Task 4`.)

`app/[countryCode]/(main)/cart/page.tsx`:

```tsx
import { retrieveCart } from "@lib/data/cart"
import { getCarrinhoConjunto } from "@lib/data/conjuntos"
import { retrieveCustomer } from "@lib/data/customer"
import { etiquetasDoCarrinho } from "@lib/util/carrinho-conjunto"
import CartTemplate from "@modules/cart/templates"
import { Metadata } from "next"
import { notFound } from "next/navigation"

export const metadata: Metadata = {
  title: "Sacola",
  description: "Veja sua sacola",
}

export default async function Cart({ params }: { params: Promise<{ countryCode: string }> }) {
  const { countryCode } = await params
  const cart = await retrieveCart().catch((error) => {
    console.error(error)
    return notFound()
  })

  const customer = await retrieveCustomer()
  const { conjuntos, gatilhos } = cart ? await getCarrinhoConjunto(cart.id, countryCode) : { conjuntos: [], gatilhos: [] }
  const etiquetas = etiquetasDoCarrinho(conjuntos, cart?.items ?? [])

  return <CartTemplate cart={cart} customer={customer} etiquetas={etiquetas} gatilhos={gatilhos} />
}
```

- [ ] **Step 3: `CartTotals` desdobra o desconto**

Substituir o bloco `{!!discount_subtotal && (…)}` e o tipo:

```tsx
import { agruparDescontos, type LinhaComAjustes } from "@lib/util/carrinho-conjunto"

type CartTotalsProps = {
  totals: {
    total?: number | null
    subtotal?: number | null
    tax_total?: number | null
    currency_code: string
    item_subtotal?: number | null
    shipping_subtotal?: number | null
    discount_subtotal?: number | null
    items?: LinhaComAjustes[] | null
  }
}
```

Dentro do componente, depois do destructuring:

```tsx
  const grupos = agruparDescontos(totals.items)
  // Ruling 2: o que não for conjunto nem cupom de linha (ex.: ajuste de frete) fica na linha genérica.
  const restante = Math.max(0, Math.round((discount_subtotal ?? 0) * 100) - grupos.conjunto - grupos.cupom)
```

E no JSX, no lugar da linha "Desconto":

```tsx
        {grupos.conjunto > 0 && (
          <div className="flex items-center justify-between">
            <span>Benefício Conjunto</span>
            <span className="text-ui-fg-interactive" data-testid="cart-beneficio-conjunto" data-value={grupos.conjunto}>
              - {convertToLocale({ amount: grupos.conjunto / 100, currency_code })}
            </span>
          </div>
        )}
        {grupos.cupom > 0 && (
          <div className="flex items-center justify-between">
            <span>Cupom</span>
            <span className="text-ui-fg-interactive" data-testid="cart-cupom" data-value={grupos.cupom}>
              - {convertToLocale({ amount: grupos.cupom / 100, currency_code })}
            </span>
          </div>
        )}
        {restante > 0 && (
          <div className="flex items-center justify-between">
            <span>Desconto</span>
            <span className="text-ui-fg-interactive" data-testid="cart-discount" data-value={restante}>
              - {convertToLocale({ amount: restante / 100, currency_code })}
            </span>
          </div>
        )}
```

(`CartTotals` já é chamado com `totals={cart}` e `totals={order}` — ambos têm `items` com `adjustments` depois da Task 2; nada a mudar nos chamadores.)

- [ ] **Step 4: `DiscountCode` esconde `CONJUNTO-*` e mostra o aviso**

No topo: `import { avisoCupom, cuponsVisiveis } from "@lib/util/carrinho-conjunto"`.

Trocar `const { promotions = [] } = cart` por:

```tsx
  const promotions = cuponsVisiveis(cart.promotions)
  const mostrarAviso = avisoCupom(cart)
```

(`removePromotionCode` e `addPromotionCode` continuam usando `promotions` — agora só os cupons; as automáticas `CONJUNTO-*` são reaplicadas pelo Medusa sozinhas.)

Depois do bloco `{promotions.length > 0 && (…)}`, dentro do mesmo `div.txt-medium`:

```tsx
        {mostrarAviso && (
          <p className="txt-small text-eclat-grafite/70 mt-1" role="note" data-testid="aviso-cupom-conjunto">
            Cupom não se aplica a peças com Benefício Conjunto.
          </p>
        )}
```

- [ ] **Step 5: Typecheck + suíte**

Run: `npx tsc -p apps/storefront --noEmit` e `npm test --workspace=apps/storefront`
Expected: 0 erros; 186 testes.

- [ ] **Step 6: Validar no navegador (backend local semeado)**

Subir backend local + storefront conforme `architecture/catalog.md` ("Como validar localmente (com o seed)"). Com `mcp__plugin_chrome-devtools-mcp`: em `/br/products/top-aura-blackout` adicionar Top M pelo botão comum; em `/br/products/legging-vertice-blackout` adicionar Legging M; abrir `/br/cart`. Esperado: as duas linhas com etiqueta "Conjunto"; resumo com "Benefício Conjunto - R$ 45,00" (curado Look Blackout, `total_valor` 4500 — o curado vence o par de coleção) e sem linha "Cupom"; nenhuma badge `CONJUNTO-*` na lista de cupons. Registrar no relatório os valores vistos.

- [ ] **Step 7: Commit**

```bash
git add apps/storefront/src/modules/cart apps/storefront/src/modules/common/components/cart-totals apps/storefront/src/modules/checkout/components/discount-code "apps/storefront/src/app/[countryCode]/(main)/cart/page.tsx"
git commit -m "feat(vitrine): carrinho com etiqueta Conjunto, resumo Benefício Conjunto × Cupom e aviso de cupom"
```

---

### Task 4: Gatilhos "Feche mais um conjunto"

**Files:**
- Create: `apps/storefront/src/modules/cart/components/gatilhos-conjunto/index.tsx`
- Create: `apps/storefront/src/modules/cart/components/gatilhos-conjunto/candidata.tsx`
- Modify: `apps/storefront/src/modules/cart/templates/index.tsx` (renderizar sob `ItemsTemplate`)

**Interfaces:**
- Consumes: Task 1 (`Gatilho`, `tituloGatilho`, `slotGatilho`), Task 3 (`CartTemplate.gatilhos`), F3 (`corParceira`, `formatarReais`, `precoMinDisponivel` de `lib/util/conjuntos`; `findOption`, `imagesForColor`, `sizeAvailability`, `sizeValues`, `variantFor` de `lib/util/pdp-variants`), `addToCart` (`lib/data/cart`), `showToast`, `pushEcommerceEvent`, `variantToAddToCart`.
- Produces: `GatilhosConjunto({ gatilhos, countryCode })`.

- [ ] **Step 1: Seção**

```tsx
// apps/storefront/src/modules/cart/components/gatilhos-conjunto/index.tsx
// "Feche mais um conjunto" (spec §7.5, ruling 4): uma seção por oportunidade devolvida por
// GET /store/conjuntos/oportunidades, já hidratada pelo leitor (`getCarrinhoConjunto`). Sem
// dados → nada renderizado. Só na página do carrinho (ruling 4/5).
import { type Gatilho, tituloGatilho } from "@lib/util/carrinho-conjunto"
import Candidata from "./candidata"

export default function GatilhosConjunto({ gatilhos, countryCode }: { gatilhos: Gatilho[]; countryCode: string }) {
  if (!gatilhos.length) return null
  return (
    <section className="mt-10" data-testid="gatilhos-conjunto">
      <h2 className="font-serif text-2xl text-eclat-grafite">Feche mais um conjunto</h2>
      {gatilhos.map((g) => (
        <div key={`${g.collection_id}:${g.categoria_faltante}`} className="mt-6" data-testid="gatilho">
          <p className="text-sm text-eclat-grafite/70" data-testid="gatilho-titulo">
            {tituloGatilho(g)}
          </p>
          <ul className="mt-4 grid grid-cols-2 small:grid-cols-3 gap-x-6 gap-y-8">
            {g.candidatas.map((p) => (
              <li key={p.id}>
                <Candidata produto={p} gatilho={g} countryCode={countryCode} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
```

- [ ] **Step 2: Candidata (client)**

```tsx
// apps/storefront/src/modules/cart/components/gatilhos-conjunto/candidata.tsx
"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import type { HttpTypes } from "@medusajs/types"
import { addToCart } from "@lib/data/cart"
import { pushEcommerceEvent } from "@modules/analytics/push"
import { variantToAddToCart } from "@modules/analytics/items"
import { showToast } from "@modules/common/components/toast"
import { Button, clx } from "@modules/common/components/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { corParceira, formatarReais, precoMinDisponivel } from "@lib/util/conjuntos"
import { type Gatilho, slotGatilho } from "@lib/util/carrinho-conjunto"
import { findOption, imagesForColor, sizeAvailability, sizeValues, variantFor } from "@lib/util/pdp-variants"

export const LISTA_GATILHO = "Feche mais um conjunto"

// Card de uma candidata do gatilho (ruling 4): foto na primeira cor disponível, nome, preço
// "a partir de", chips de tamanho (mesmo estilo de `complete-set/parceira.tsx`) e "Adicionar".
// Adiciona 1 unidade em linha própria (`slotGatilho`); a página do carrinho se atualiza pela
// revalidação do carrinho feita por `addToCart`.
export default function Candidata({ produto, gatilho, countryCode }: { produto: HttpTypes.StoreProduct; gatilho: Gatilho; countryCode: string }) {
  const cor = useMemo(() => corParceira(produto, null), [produto])
  const [tamanho, setTamanho] = useState<string | null>(null)
  const [adicionando, setAdicionando] = useState(false)

  const colorOpt = findOption(produto, "Cor")
  const sizeOpt = findOption(produto, "Tamanho")
  const sizes = useMemo(() => sizeValues(produto), [produto])
  const avail = useMemo(() => sizeAvailability(produto, cor), [produto, cor])

  const variante = useMemo(() => {
    if (sizeOpt && !tamanho) return null
    const sel: Record<string, string> = {}
    if (colorOpt && cor) sel[colorOpt.id] = cor
    if (sizeOpt && tamanho) sel[sizeOpt.id] = tamanho
    return variantFor(produto, sel)
  }, [produto, colorOpt, cor, sizeOpt, tamanho])

  const preco = precoMinDisponivel(produto)
  const imagem = imagesForColor(produto, cor)[0]?.url ?? produto.thumbnail ?? null
  const href = `/products/${produto.handle}${cor ? `?cor=${encodeURIComponent(cor)}` : ""}`
  const podeAdicionar = !!variante && !adicionando

  async function handleAdicionar() {
    if (!variante || adicionando) return
    pushEcommerceEvent("conjunto_trigger_click", undefined, {
      collection_id: gatilho.collection_id,
      categoria_faltante: gatilho.categoria_faltante,
    })
    setAdicionando(true)
    try {
      await addToCart({ variantId: variante.id, quantity: 1, countryCode, metadata: slotGatilho(gatilho.categoria_faltante) })
      pushEcommerceEvent("add_to_cart", { ...variantToAddToCart(produto, variante, 1), item_list_name: LISTA_GATILHO })
      showToast({ message: `${produto.title} adicionado à sacola` })
    } catch {
      showToast({ message: `Não foi possível adicionar ${produto.title}. Tente de novo.` })
    } finally {
      setAdicionando(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-3" data-testid="gatilho-candidata">
      <LocalizedClientLink href={href} className="block relative w-full aspect-[9/16] overflow-hidden rounded-large bg-eclat-areia/40">
        {imagem && (
          <Image src={imagem} alt={produto.title ?? ""} fill quality={80} sizes="(max-width: 576px) 50vw, 25vw" className="object-cover object-center" draggable={false} />
        )}
      </LocalizedClientLink>
      <div>
        <p className="text-eclat-grafite" data-testid="candidata-nome">{produto.title}</p>
        {preco !== null && (
          <p className="text-eclat-grafite/70 text-sm" data-testid="candidata-preco">a partir de {formatarReais(preco)}</p>
        )}
      </div>
      {sizeOpt && (
        <div className="flex flex-wrap gap-1.5">
          {sizes.map((s) => {
            const esgotado = avail[s] === false
            const on = tamanho === s
            return (
              <button
                key={s}
                type="button"
                disabled={esgotado || adicionando}
                onClick={() => setTamanho(s)}
                aria-pressed={on}
                className={clx(
                  "h-8 min-w-[36px] px-2 text-xs rounded border",
                  on
                    ? "bg-eclat-grafite text-eclat-luz border-eclat-grafite"
                    : esgotado
                      ? "border-eclat-pedra/50 text-eclat-grafite/40 line-through cursor-not-allowed"
                      : "border-eclat-grafite hover:bg-eclat-grafite hover:text-eclat-luz"
                )}
                data-testid={`candidata-tamanho-${s}`}
              >
                {s}
              </button>
            )
          })}
        </div>
      )}
      <Button type="button" onClick={handleAdicionar} disabled={!podeAdicionar} isLoading={adicionando} variant="secondary" className="w-full h-10 text-sm" data-testid="candidata-adicionar">
        Adicionar
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: Renderizar no `CartTemplate`**

`cart/templates/index.tsx`: importar `GatilhosConjunto` e, na coluna esquerda logo após `<ItemsTemplate … />`:

```tsx
              <GatilhosConjunto gatilhos={gatilhos ?? []} countryCode={countryCode} />
```

`CartTemplate` ganha a prop `countryCode: string`; `cart/page.tsx` passa `countryCode={countryCode}`. Remover o comentário `// gatilhos: Task 4`.

- [ ] **Step 4: Typecheck + navegador**

Run: `npx tsc -p apps/storefront --noEmit` → 0 erros.
Navegador (backend local): carrinho com Legging M + Legging M + Top M (adicionar a segunda legging pelo botão comum da PDP). Esperado em `/br/cart`: 1 conjunto (curado Look Blackout, top+legging) com etiquetas "Conjunto" numa legging e no top; seção "Feche mais um conjunto" com o texto "Mais uma peça de Tops da coleção Família Blackout fecha outro conjunto — …" e o card do Top Aura; escolher M e "Adicionar" → toast; a página atualiza com 2 conjuntos ("Conjunto 1/2", "Conjunto 2/2") e a seção some. Conferir no `dataLayer` (via `javascript` do devtools: `window.dataLayer.filter(e => e.event === "conjunto_trigger_click")`) o evento com `collection_id` e `categoria_faltante: "tops"`.

- [ ] **Step 5: Commit**

```bash
git add apps/storefront/src/modules/cart "apps/storefront/src/app/[countryCode]/(main)/cart/page.tsx"
git commit -m "feat(vitrine): gatilhos \"Feche mais um conjunto\" no carrinho com adição rápida"
```

---

### Task 5: Checkout, páginas do pedido e detalhe do pedido no Cockpit

**Files:**
- Modify: `apps/storefront/src/app/[countryCode]/(checkout)/checkout/page.tsx`
- Modify: `apps/storefront/src/modules/checkout/templates/checkout-summary/index.tsx`
- Modify: `apps/storefront/src/modules/order/components/items/index.tsx`, `order/components/item/index.tsx`, `order/components/order-summary/index.tsx`
- Create: `apps/cockpit/lib/pedido-conjunto.ts`, `apps/cockpit/lib/pedido-conjunto.test.ts`
- Modify: `apps/cockpit/lib/medusa.ts:664-685` (`OrderItem`, `CockpitOrderDetail`, `medusaGetOrder`)
- Modify: `apps/cockpit/app/(painel)/pedidos/page.tsx` (tipos locais `OrderItem`/`OrderDetail`, tabela de itens, totais)

**Interfaces:**
- Consumes: Task 1 (`etiquetasDoCarrinho`, `etiquetaDoPedido`, `agruparDescontos`), Task 2 (`getCarrinhoConjunto` com `comGatilhos: false`), Task 3 (`ItemsPreviewTemplate.etiquetas`, `CartTotals` já desdobrado).
- Produces (Cockpit): `agruparDescontosPedido(items): { conjunto: number; cupom: number }` (**decimal**, mesma unidade do `det.total`), `etiquetaConjunto(item): "Conjunto" | null`.

- [ ] **Step 1: Checkout**

`(checkout)/checkout/page.tsx`:

```tsx
import { getCarrinhoConjunto } from "@lib/data/conjuntos"
import { etiquetasDoCarrinho } from "@lib/util/carrinho-conjunto"
// …
export default async function Checkout({ params }: { params: Promise<{ countryCode: string }> }) {
  const { countryCode } = await params
  const cart = await retrieveCart()
  if (!cart) {
    return notFound()
  }
  const customer = await retrieveCustomer()
  const { conjuntos } = await getCarrinhoConjunto(cart.id, countryCode, { comGatilhos: false })
  const etiquetas = etiquetasDoCarrinho(conjuntos, cart.items ?? [])
  // …
      <CheckoutSummary cart={cart} etiquetas={etiquetas} />
```

`checkout-summary/index.tsx`: `({ cart, etiquetas }: { cart: HttpTypes.StoreCart; etiquetas?: Record<string, string> })` e `<ItemsPreviewTemplate cart={cart} etiquetas={etiquetas} />`. (`CartTotals` e `DiscountCode` já estão desdobrados/avisando pela Task 3.)

- [ ] **Step 2: Páginas do pedido (storefront)**

`order/components/item/index.tsx`: prop `etiqueta?: string | null`, renderizada sob `<LineItemOptions …/>` com o mesmo `<span data-testid="etiqueta-conjunto" …>` da Task 3.

`order/components/items/index.tsx`: `import { etiquetaDoPedido } from "@lib/util/carrinho-conjunto"` e `<Item key={item.id} item={item} currencyCode={order.currency_code} etiqueta={etiquetaDoPedido(item)} />`.

`order/components/order-summary/index.tsx`: `import { agruparDescontos } from "@lib/util/carrinho-conjunto"`, `const grupos = agruparDescontos(order.items)` e `const restante = Math.max(0, Math.round((order.discount_total ?? 0) * 100) - grupos.conjunto - grupos.cupom)`; trocar o bloco `{order.discount_total > 0 && (…"Desconto"…)}` por três blocos (mesma ordem da Task 3): "Benefício Conjunto" (`grupos.conjunto / 100`), "Cupom" (`grupos.cupom / 100`), "Desconto" (`restante / 100`), cada um só quando > 0, usando o `getAmount` local. (`order-completed-template.tsx` usa `CartTotals totals={order}` — já desdobra.)

- [ ] **Step 3: Cockpit — helper puro + teste (falhando primeiro)**

```ts
// apps/cockpit/lib/pedido-conjunto.test.ts
import { describe, expect, it } from "vitest"
import { agruparDescontosPedido, etiquetaConjunto } from "./pedido-conjunto"

describe("agruparDescontosPedido", () => {
  it("separa CONJUNTO- de cupom, somando em centavos e devolvendo decimal", () => {
    expect(
      agruparDescontosPedido([
        { adjustments: [{ code: "CONJUNTO-creg_1", amount: 18.9 }] },
        { adjustments: [{ code: "CUPOM10", amount: 25.9 }, { code: "CONJUNTO-creg_1", amount: 0.1 }] },
        {},
      ])
    ).toEqual({ conjunto: 19, cupom: 25.9 })
  })
  it("vazio → zeros", () => {
    expect(agruparDescontosPedido(undefined)).toEqual({ conjunto: 0, cupom: 0 })
  })
})

describe("etiquetaConjunto", () => {
  it("ajuste CONJUNTO- ou conjunto_slot → 'Conjunto'; senão null", () => {
    expect(etiquetaConjunto({ adjustments: [{ code: "CONJUNTO-x", amount: 1 }] })).toBe("Conjunto")
    expect(etiquetaConjunto({ metadata: { conjunto_slot: "a#0#1" } })).toBe("Conjunto")
    expect(etiquetaConjunto({ adjustments: [{ code: "CUPOM10", amount: 1 }] })).toBeNull()
    expect(etiquetaConjunto({})).toBeNull()
  })
})
```

```ts
// apps/cockpit/lib/pedido-conjunto.ts
// Desdobramento do desconto de um pedido (Benefício Conjunto × cupom) para o detalhe em
// /pedidos (spec §7.5, aceite §11 item 9). Puro. Valores do Medusa Admin chegam decimais; soma em
// centavos para não acumular erro de ponto flutuante e devolve decimal (unidade do `brl()` da tela).
export type ItemComAjustes = {
  adjustments?: { code?: string | null; amount?: number | null }[] | null
  metadata?: Record<string, unknown> | null
}

const PREFIXO = "CONJUNTO-"
const ehConjunto = (code?: string | null) => typeof code === "string" && code.startsWith(PREFIXO)
const cents = (v?: number | null) => Math.round((v ?? 0) * 100)

export function agruparDescontosPedido(items?: ItemComAjustes[] | null): { conjunto: number; cupom: number } {
  let conjunto = 0
  let cupom = 0
  for (const item of items ?? []) {
    for (const a of item.adjustments ?? []) {
      if (ehConjunto(a.code)) conjunto += cents(a.amount)
      else cupom += cents(a.amount)
    }
  }
  return { conjunto: conjunto / 100, cupom: cupom / 100 }
}

export function etiquetaConjunto(item: ItemComAjustes): "Conjunto" | null {
  const porAjuste = (item.adjustments ?? []).some((a) => ehConjunto(a.code))
  const porSlot = typeof item.metadata?.conjunto_slot === "string"
  return porAjuste || porSlot ? "Conjunto" : null
}
```

Run: `npm test --workspace=apps/cockpit` → 40 testes.

- [ ] **Step 4: Cockpit — campos e tela**

`lib/medusa.ts`: no tipo `OrderItem` (o usado por `CockpitOrderDetail`) acrescentar `metadata?: Record<string, unknown> | null` e `adjustments?: { code?: string | null; amount?: number | null }[] | null`; em `CockpitOrderDetail` acrescentar `discount_total: number`; em `medusaGetOrder` o `fields` passa a incluir `discount_total,` (junto de `total,`) e `items.metadata,items.adjustments.code,items.adjustments.amount,` (junto dos `items.*`).

`pedidos/page.tsx`: nos tipos locais, `OrderItem` ganha os mesmos dois campos e `OrderDetail` ganha `discount_total: number`; `import { agruparDescontosPedido, etiquetaConjunto } from "@/lib/pedido-conjunto"`. Na tabela de itens, sob `<div>{i.title}</div>`:

```tsx
                              {etiquetaConjunto(i) && (
                                <span className="inline-block mt-0.5 rounded-sm bg-eclat-areia px-1.5 text-[10px] uppercase tracking-wider text-eclat-grafite" data-testid="etiqueta-conjunto">Conjunto</span>
                              )}
```

Na seção "Totais", entre "Itens" e "Frete" (com `const descontos = det ? agruparDescontosPedido(det.items) : { conjunto: 0, cupom: 0 }` junto de `itensTotal`):

```tsx
                  {descontos.conjunto > 0 && (
                    <div className="flex justify-between py-1"><span className="text-eclat-grafite/60">Benefício Conjunto</span><span>- {brl(descontos.conjunto)}</span></div>
                  )}
                  {descontos.cupom > 0 && (
                    <div className="flex justify-between py-1"><span className="text-eclat-grafite/60">Cupom</span><span>- {brl(descontos.cupom)}</span></div>
                  )}
```

- [ ] **Step 5: Typecheck ×2 + suítes**

Run: `npx tsc -p apps/storefront --noEmit`, `npx tsc -p apps/cockpit --noEmit`, `npm test --workspace=apps/storefront` (186), `npm test --workspace=apps/cockpit` (40).

- [ ] **Step 6: Conferir a resposta da Admin API local** (metade Cockpit do item 9 é do dono na UI; aqui só o contrato): com o backend local, `GET /admin/orders/:id?fields=<os fields de medusaGetOrder>` de um pedido criado localmente (se houver — ver Task 6) devolve `items[].adjustments[].code` começando com `CONJUNTO-`. Sem pedido local, registrar "contrato conferido só por tipo" no relatório.

- [ ] **Step 7: Commit**

```bash
git add apps/storefront/src/app apps/storefront/src/modules/checkout apps/storefront/src/modules/order apps/cockpit/lib apps/cockpit/app
git commit -m "feat(vitrine,cockpit): etiqueta Conjunto e resumo desdobrado no checkout, no pedido e no Cockpit"
```

---

### Task 6: Aceite local (§11 itens 1–4, 9, 10) + documentação

**Files:**
- Modify: `architecture/catalog.md` (nova seção `## Carrinho e pedido (Fase F4, 2026-09)` depois de "Conjuntos na vitrine (Fase F3)"), `architecture/conjunto.md` (§12 limite da etiqueta no pedido; §13 nota F4 → entregue), `architecture/cockpit.md` (§7: detalhe do pedido), `docs/superpowers/specs/2026-09-08-beneficio-conjunto-design.md` (§7.5 parágrafo "Entregue F4" com os rulings 1–8 deste plano; §10 linha F4; §11 resultados), `CLAUDE.md` (linha "Benefício Conjunto (Spec 2)": F4 concluída em código, pendências do dono), `progress.md` (entrada "Benefício Conjunto F4": aceite + roteiro do dono).

**Interfaces:** nenhuma nova.

- [ ] **Step 1: Aceite no navegador (backend local semeado, chrome-devtools)**

Preparação (Admin API local, sem escrever em produção): criar um usuário admin local uma vez com `DATABASE_URL=postgres://postgres:postgres@localhost:55432/eclat_dev npx medusa user -e admin@local.test -p senha12345` (de `apps/backend`); obter token com `POST http://localhost:9000/auth/user/emailpass {"email":"admin@local.test","password":"senha12345"}`; usar `Authorization: Bearer <token>`.

| Item | Como | Esperado (registrar valores no relatório) |
|---|---|---|
| 1 | Carrinho Top M + Short M (par de coleção — o curado é top+legging, então o par shorts+tops recebe a regra padrão). Para cada tipo, `PUT /admin/conjuntos/regras/<id da padrão>` com `{ "tipo_desconto": …, "valor": … }` (`menor_peca_percentual` 20; `menor_peca_valor` 3000; `total_percentual` 10; `total_valor` 5000), depois recarregar `/br/cart` | "Benefício Conjunto" = R$ 31,80 / R$ 30,00 / R$ 34,80 / R$ 50,00; etiquetas "Conjunto" nas duas linhas. Voltar a regra para `menor_peca_percentual` 20 no fim |
| 2 | (a) 2× Top M + Legging M + Short M → (b) esvaziar; Top M + 2× Legging M | (a) "Conjunto 1/2" e "Conjunto 2/2" (top em ambos: "Conjunto 1/2 · Conjunto 2/2" se for uma linha só, ou uma etiqueta por linha se forem linhas separadas); resumo = curado R$ 45,00 + par shorts+tops R$ 31,80 = R$ 76,80. (b) 1 conjunto + gatilho "Mais uma peça de Tops …" com o Top Aura; "Adicionar" fecha o 2º conjunto |
| 3 | Criar cupom local `POST /admin/promotions {"code":"CUPOM10","type":"standard","status":"active","is_automatic":false,"application_method":{"type":"percentage","target_type":"items","allocation":"across","value":10,"currency_code":"brl"}}` (o gancho `conjunto-cupom` acrescenta a exclusão). Carrinho Top M + Legging M + Macaquinho M; aplicar `CUPOM10` em `/br/cart` | "Benefício Conjunto - R$ 45,00", "Cupom - R$ 29,90" (10% só do macaquinho), aviso "Cupom não se aplica a peças com Benefício Conjunto" visível; lista de cupons mostra só `CUPOM10` |
| 4 | Carrinho Top M + Legging M + Short M | curado (top+legging) formado primeiro: etiquetas nos três? Não — só top e legging; short sem etiqueta; gatilho "Mais uma peça de Tops" (o short precisa de outro top); resumo R$ 45,00 |
| 9 | `/br/checkout`: etiquetas iguais no resumo; se o seed local tiver frete + pagamento manual, concluir e abrir `/br/order/<id>/confirmed` e `/br/account/orders/details/<id>` → etiqueta "Conjunto" e "Benefício Conjunto" separado. Se o checkout local não fechar (sem opção de frete/pagamento no seed), registrar **exatamente** o passo que faltou e marcar o item como "dono valida no primeiro pedido real" (ruling 7) | conforme |
| 10 | Parar o backend local com o storefront aberto e recarregar `/br/cart` | página de carrinho continua (sem etiquetas, sem gatilhos), `console.error("[conjuntos] …")` no servidor, nenhum 500 |

- [ ] **Step 2: Docs**

`architecture/catalog.md` — nova seção (modelo da F3): o que existe (etiquetas, resumo, aviso, gatilhos, checkout, pedido), de onde vem cada dado (`adjustments` × rota `oportunidades`), o módulo puro e seus testes, os rulings 1–8, "Limites conhecidos" (etiqueta no pedido para a unidade não descontada sem slot; mini-cart sem etiqueta; gatilho só no carrinho), "Como validar localmente" apontando para o comando da F3 + o usuário admin local.

`architecture/conjunto.md` — §12: acrescentar o limite da etiqueta do pedido; §13: "F4 — entregue (2026-09-09): …" com o link para `architecture/catalog.md`.

`architecture/cockpit.md` §7 — parágrafo "Detalhe do pedido (F4)": campos a mais em `medusaGetOrder`, helper `lib/pedido-conjunto.ts`, etiqueta e linhas.

Spec — §7.5: parágrafo **"Entregue F4 (2026-09-09)"** com os rulings; §10: linha F4 → "ENTREGUE em código e aceite local"; §11: resultado por item (PASSOU / parcial com o motivo).

`CLAUDE.md` — só a linha do Benefício Conjunto: F4 concluída em código; pendentes do dono: push/deploy da vitrine (sem redeploy do backend nesta fase), ativar a regra padrão, roteiro em `progress.md`.

`progress.md` — entrada "Benefício Conjunto F4": tabela do aceite com os valores observados; **roteiro do dono em produção** (após ativar a regra padrão): (1) adicionar top + legging da mesma coleção → `/br/cart` com etiquetas e "Benefício Conjunto"; (2) adicionar uma segunda legging → bloco "Feche mais um conjunto"; (3) aplicar um cupom → aviso e "Cupom" separado; (4) concluir um pedido de teste (pagamento manual) → página do pedido e Cockpit › Pedidos com "Benefício Conjunto"; contagens (storefront 186, cockpit 40, backend 73/30).

- [ ] **Step 3: Suítes completas + tsc**

Run: `npm test --workspace=apps/storefront` (186), `npm test --workspace=apps/cockpit` (40), backend integração (73) e unit (30) com o prefixo do Windows, `npx tsc -p apps/storefront --noEmit`, `npx tsc -p apps/cockpit --noEmit`.

- [ ] **Step 4: Commit**

```bash
git add architecture/catalog.md architecture/conjunto.md architecture/cockpit.md docs/superpowers/specs/2026-09-08-beneficio-conjunto-design.md CLAUDE.md progress.md
git commit -m "docs(vitrine): F4 Benefício Conjunto — carrinho, checkout, pedido, Cockpit, aceite"
```

---

## Self-review

**Spec coverage (§7.5):** etiqueta "Conjunto"/"Conjunto 1/2" → Task 1 (`etiquetasDoCarrinho`) + Task 3/5; resumo separado por prefixo `CONJUNTO-` → Task 1 (`agruparDescontos`) + Task 3 (`CartTotals`) + Task 5 (`OrderSummary`, Cockpit); gatilhos com até 3 candidatas, tamanho inline e adição rápida → Task 1 (`montarGatilhos`) + Task 2 + Task 4; aviso de cupom → Task 1 (`avisoCupom`) + Task 3; checkout e página do pedido com as mesmas etiquetas e linhas → Task 5. §7.7 `conjunto_trigger_click` → Task 4. §11 itens 1–4, 9, 10 → Task 6; item 9 (Cockpit) → Task 5 + roteiro do dono. §12 limite I2 respeitado (gatilho usa `slotGatilho`).

**Placeholders:** nenhum "TBD"; os passos de navegador têm valores esperados; o item 9 tem regra explícita de fallback (ruling 7).

**Type consistency:** `Gatilho`, `ConjuntoFormadoStore`, `OportunidadeStore`, `LinhaComAjustes`, `GruposDesconto` definidos na Task 1 e usados com os mesmos nomes nas Tasks 2–5; `getCarrinhoConjunto(cartId, countryCode, { comGatilhos })` igual nas Tasks 2, 3 e 5; `etiquetas?: Record<string, string>` em `ItemsTemplate`, `ItemsPreviewTemplate`, `CartTemplate`, `CheckoutSummary`; `slotGatilho(categoria, agora?)` devolve `{ conjunto_slot }` como `slotMetadata`; Cockpit `agruparDescontosPedido` devolve decimal (unidade do `brl()` da tela), enquanto o storefront `agruparDescontos` devolve centavos (dividido por 100 na exibição) — diferença intencional e documentada nos comentários de cada módulo.
