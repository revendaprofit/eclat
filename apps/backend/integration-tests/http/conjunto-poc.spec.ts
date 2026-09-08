import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { criarAdmin } from "../helpers/admin"
import { criarCatalogoBase, type CatalogoBase } from "../helpers/catalogo"

jest.setTimeout(180 * 1000)

const ajustes = (item: any) => (item.adjustments ?? []) as { code: string; amount: number }[]
const somaPorCodigo = (cart: any, code: string) =>
  cart.items.flatMap(ajustes).filter((a: any) => a.code === code).reduce((s: number, a: any) => s + Number(a.amount), 0)

medusaIntegrationTestRunner({
  inApp: true,
  env: { CONJUNTO_POC: "1" },
  // Ajuste de harness (2.15.5): o afterEach padrão do medusaIntegrationTestRunner faz TRUNCATE
  // em todas as tabelas depois de CADA it() (ver @medusajs/test-utils/dist/database.js `teardown`).
  // Os casos A e B reaproveitam o catálogo/admin/promoção criados uma única vez no beforeAll —
  // sem desligar o teardown automático, o caso B rodaria contra um banco vazio (região, canal de
  // vendas e chave publicável já apagados pelo truncate após o caso A) e falharia por 400
  // ("A valid publishable key is required"), não pela lógica do gancho/promoção.
  disableAutoTeardown: true,
  testSuite: ({ api, getContainer }) => {
    let admin: Record<string, string>
    let cat: CatalogoBase
    // D2 (findings do Task 3): payload de PEDIDO10X (cupom de pedido COM target_rules) é decidido
    // em runtime dentro do beforeAll (chamada HTTP real), mas o Jest resolve describe/it de forma
    // síncrona na fase de coleta, ANTES do beforeAll rodar — não dá pra usar it.skip condicionado a
    // este resultado (ele sempre "veria" o valor inicial). Por isso o it() de D2 abaixo é único e se
    // adapta ao resultado real (aceito ou rejeitado), sempre passando — o achado vai pro console.log
    // e para o relatório, não para o status do teste.
    let d2Aceito = false
    let d2ErroTentativa1: unknown
    let d2ErroTentativa2: unknown

    beforeAll(async () => {
      admin = (await criarAdmin(api, getContainer())).headers
      cat = await criarCatalogoBase(api, admin)
      // Promoção automática do "conjunto": 10% em cada unidade marcada com conjunto_desconto = poc
      await api.post(
        "/admin/promotions",
        {
          code: "CONJUNTO-POC",
          type: "standard",
          is_automatic: true,
          status: "active",
          application_method: {
            type: "percentage",
            target_type: "items",
            allocation: "each",
            // Ajuste de payload (2.15.5): allocation "each"/"once" exige max_quantity —
            // não documentado no brief. IMPORTANTE (achado da revisão): max_quantity: 1 faria o
            // motor CAPAR o desconto em 1 unidade sozinho (ver @medusajs/utils/dist/totals/promotion/
            // index.js: maximumPromotionAmount = unitPrice * (max_quantity ?? 1)), então o caso B
            // passaria com 18,90 mesmo se o hook NÃO dividisse o contexto — não provaria o §6.3.
            // Usamos um valor alto (bem acima de qualquer quantidade testada) para que o teto do
            // motor nunca entre em jogo: o valor observado passa a depender só da divisão de
            // contexto feita pelo gancho, que é o que este teste precisa provar.
            max_quantity: 1000,
            value: 10,
            currency_code: "brl",
            // Ajuste de payload (2.15.5): o atributo de target_rules em escopo "items" precisa do
            // prefixo "items." — é o que o pré-filtro de promoções automáticas (build-promotion-
            // rule-query-filter-from-context) usa para casar com o contexto achatado (flattenObjectToKeyValuePairs
            // prefixa cada chave de items com "items."); sem o prefixo a promoção é descartada ANTES da
            // avaliação da regra em si (que aí sim aceita os dois formatos, pois remove o prefixo "items."
            // antes de ler a propriedade do item — ver areRulesValidForContext em
            // @medusajs/promotion/dist/utils/validations/promotion-rule.js). O gancho continua marcando o
            // item com a propriedade "conjunto_desconto" (sem prefixo) — é o `attribute` da regra que muda.
            target_rules: [{ attribute: "items.conjunto_desconto", operator: "eq", values: ["poc"] }],
          },
        },
        { headers: admin }
      )
      // Cupom de ITENS com a regra de exclusão do §6.4: só alcança unidades marcadas "nenhum"
      // (fora do conjunto). Mesmos ajustes de payload do Task 2: max_quantity obrigatório para
      // allocation "each" (usamos 1000 pelo mesmo motivo documentado acima) e o atributo de
      // target_rules em escopo "items" precisa do prefixo "items.".
      await api.post(
        "/admin/promotions",
        {
          code: "CUPOM10",
          type: "standard",
          is_automatic: false,
          status: "active",
          application_method: {
            type: "percentage",
            target_type: "items",
            allocation: "each",
            max_quantity: 1000,
            value: 10,
            currency_code: "brl",
            target_rules: [{ attribute: "items.conjunto_desconto", operator: "eq", values: ["nenhum"] }],
          },
        },
        { headers: admin }
      )
      // Cupom de PEDIDO inteiro (não aceita target_rules por item): observar o que acontece
      await api.post(
        "/admin/promotions",
        {
          code: "PEDIDO10",
          type: "standard",
          is_automatic: false,
          status: "active",
          application_method: { type: "percentage", target_type: "order", value: 10, currency_code: "brl" },
        },
        { headers: admin }
      )
      // D2 (achado #1 da revisão do Task 3): a leitura de que "cupom de PEDIDO não tem como respeitar
      // target_rules" era uma suposição não testada, contradita pela leitura do motor (getValidItemsForPromotion
      // em @medusajs/promotion/dist/utils/compute-actions/line-items.js:97-125 aplica target_rules igual para
      // isTargetOrder e isTargetItems). Testamos empiricamente: tenta criar PEDIDO10X (pedido + target_rules).
      try {
        await api.post(
          "/admin/promotions",
          {
            code: "PEDIDO10X",
            type: "standard",
            is_automatic: false,
            status: "active",
            application_method: {
              type: "percentage",
              target_type: "order",
              value: 10,
              currency_code: "brl",
              target_rules: [{ attribute: "items.conjunto_desconto", operator: "eq", values: ["nenhum"] }],
            },
          },
          { headers: admin }
        )
        d2Aceito = true
      } catch (e: any) {
        d2ErroTentativa1 = e.response?.data ?? { message: e.message }
        // Fallback do brief: allocation "across" + max_quantity (caso a rejeição seja sobre allocation, não sobre target_rules)
        try {
          await api.post(
            "/admin/promotions",
            {
              code: "PEDIDO10X",
              type: "standard",
              is_automatic: false,
              status: "active",
              application_method: {
                type: "percentage",
                target_type: "order",
                value: 10,
                currency_code: "brl",
                allocation: "across",
                max_quantity: 1000,
                target_rules: [{ attribute: "items.conjunto_desconto", operator: "eq", values: ["nenhum"] }],
              },
            },
            { headers: admin }
          )
          d2Aceito = true
        } catch (e2: any) {
          d2Aceito = false
          d2ErroTentativa2 = e2.response?.data ?? { message: e2.message }
        }
      }
      // eslint-disable-next-line no-console
      console.log(
        "[F0-D2] PEDIDO10X aceito?",
        d2Aceito,
        "erro (1a tentativa, sem allocation):",
        JSON.stringify(d2ErroTentativa1),
        "erro (2a tentativa, allocation across):",
        JSON.stringify(d2ErroTentativa2)
      )
    })

    async function novoCarrinho(linhas: { variantId: string; quantity: number }[], metadata?: Record<string, unknown>) {
      const cart = (
        await api.post(
          "/store/carts",
          { region_id: cat.regionId, sales_channel_id: cat.salesChannelId, ...(metadata ? { metadata } : {}) },
          { headers: cat.storeHeaders }
        )
      ).data.cart
      for (const l of linhas) {
        await api.post(`/store/carts/${cart.id}/line-items`, { variant_id: l.variantId, quantity: l.quantity }, { headers: cat.storeHeaders })
      }
      return (await api.get(`/store/carts/${cart.id}?fields=*items,*items.adjustments`, { headers: cat.storeHeaders })).data.cart
    }

    describe("A — top + legging, 1 unidade cada", () => {
      it("desconta só a unidade marcada (a mais barata: Top R$ 189 → R$ 18,90)", async () => {
        const cart = await novoCarrinho([{ variantId: cat.top.variantId, quantity: 1 }, { variantId: cat.legging.variantId, quantity: 1 }])
        const top = cart.items.find((i: any) => i.variant_id === cat.top.variantId)
        const legging = cart.items.find((i: any) => i.variant_id === cat.legging.variantId)
        expect(somaPorCodigo({ items: [top] }, "CONJUNTO-POC")).toBeCloseTo(18.9, 2)
        expect(ajustes(legging)).toHaveLength(0)
        expect(Number(cart.discount_total)).toBeCloseTo(18.9, 2)
      })
    })

    // Resultado F0: PASSOU como escrito — decisão §6.3 adotada (divisão de contexto, sem fallback).
    describe("B — linha com 2 unidades, só 1 em conjunto (§6.3)", () => {
      it("desconta uma unidade só (Top ×2 = R$ 378 → desconto R$ 18,90, não R$ 37,80)", async () => {
        const cart = await novoCarrinho([{ variantId: cat.top.variantId, quantity: 2 }, { variantId: cat.legging.variantId, quantity: 1 }])
        const top = cart.items.find((i: any) => i.variant_id === cat.top.variantId)
        expect(Number(top.quantity)).toBe(2)
        expect(Number(cart.discount_total)).toBeCloseTo(18.9, 2)
      })
    })

    // Resultado F0: PASSOU (37,80) — confirma que a divisão de contexto generaliza para K intermediário.
    describe("B2 — linha com 3 unidades, 2 em conjunto (K=2 de N=3)", () => {
      it("desconta duas unidades (Top ×3 = R$ 567 → R$ 37,80, não R$ 56,70 nem R$ 18,90)", async () => {
        const cart = await novoCarrinho(
          [{ variantId: cat.top.variantId, quantity: 3 }, { variantId: cat.legging.variantId, quantity: 1 }],
          { conjunto_poc_k: 2 }
        )
        const top = cart.items.find((i: any) => i.variant_id === cat.top.variantId)
        expect(Number(top.quantity)).toBe(3)
        expect(somaPorCodigo({ items: [top] }, "CONJUNTO-POC")).toBeCloseTo(37.8, 2)
        expect(Number(cart.discount_total)).toBeCloseTo(37.8, 2)
      })
    })

    // Resultado F0: PASSOU (44,80 = 18,90 + 25,90) — decisão §6.4 adotada para cupons de itens.
    describe("C — cupom de itens com exclusão (§6.4)", () => {
      it("cupom desconta só a legging (fora do conjunto); o conjunto continua no top", async () => {
        const cart0 = await novoCarrinho([{ variantId: cat.top.variantId, quantity: 1 }, { variantId: cat.legging.variantId, quantity: 1 }])
        await api.post(`/store/carts/${cart0.id}/promotions`, { promo_codes: ["CUPOM10"] }, { headers: cat.storeHeaders })
        const cart = (await api.get(`/store/carts/${cart0.id}?fields=*items,*items.adjustments`, { headers: cat.storeHeaders })).data.cart
        expect(somaPorCodigo(cart, "CONJUNTO-POC")).toBeCloseTo(18.9, 2) // 10% do top
        expect(somaPorCodigo(cart, "CUPOM10")).toBeCloseTo(25.9, 2) // 10% da legging, nada no top
        expect(Number(cart.discount_total)).toBeCloseTo(44.8, 2)
      })
    })

    // Resultado F0: 42,91 — cupom de pedido alcança a unidade em conjunto, mas incide sobre o
    // subtotal já líquido do CONJUNTO-POC (compounding), não sobre o preço cheio. Ver §6.4.
    describe("D — cupom de pedido inteiro (sem regra por item)", () => {
      it("registra o comportamento: desconto do pedido alcança ou não a unidade em conjunto?", async () => {
        const cart0 = await novoCarrinho([{ variantId: cat.top.variantId, quantity: 1 }, { variantId: cat.legging.variantId, quantity: 1 }])
        await api.post(`/store/carts/${cart0.id}/promotions`, { promo_codes: ["PEDIDO10"] }, { headers: cat.storeHeaders })
        const cart = (await api.get(`/store/carts/${cart0.id}?fields=*items,*items.adjustments`, { headers: cat.storeHeaders })).data.cart
        const pedido = somaPorCodigo(cart, "PEDIDO10")
        // eslint-disable-next-line no-console
        console.log("[F0-D] PEDIDO10 total =", pedido, "ajustes:", JSON.stringify(cart.items.map((i: any) => ({ v: i.variant_id, adj: i.adjustments }))))
        expect(pedido).toBeGreaterThan(0) // só garante que o cupom foi aplicado; o VALOR vai para o relatório

        // Observação extra (sem asserção): empilhando CUPOM10 (itens) em cima de PEDIDO10 (pedido)
        // no mesmo carrinho — /store/carts/{id}/promotions é aditivo (PromotionActions.ADD quando
        // promo_codes não é vazio), então isso NÃO substitui o PEDIDO10 já aplicado. Serve só para
        // o relatório da F0 (empilhamento de cupons de pedido + itens).
        await api.post(`/store/carts/${cart0.id}/promotions`, { promo_codes: ["CUPOM10"] }, { headers: cat.storeHeaders })
        const cartAmbos = (await api.get(`/store/carts/${cart0.id}?fields=*items,*items.adjustments`, { headers: cat.storeHeaders })).data.cart
        // eslint-disable-next-line no-console
        console.log(
          "[F0-bonus] PEDIDO10 + CUPOM10 discount_total =",
          cartAmbos.discount_total,
          "ajustes:",
          JSON.stringify(cartAmbos.items.map((i: any) => ({ v: i.variant_id, adj: i.adjustments })))
        )
      })
    })

    // Resultado F0: REJEITADO pela Admin API (400 invalid_data, promotion-module.js:570-574) —
    // target_rules não é permitido em target_type: order. Decisão §6.4: F1 converte cupons de
    // pedido em cupons de itens (allocation: across) para poder excluir a unidade em conjunto.
    describe("D2 — cupom de pedido inteiro COM regra de exclusão por item", () => {
      it("registra se o desconto de pedido respeita a marcação (esperado se respeitar: 25,90 = 10% só da legging; se ignorar: 44,80/42,91-like)", async () => {
        if (!d2Aceito) {
          // eslint-disable-next-line no-console
          console.log("[F0-D2] SKIP (payload rejeitado pela Admin API nas duas tentativas) — ver [F0-D2] acima para o erro exato")
          expect(d2Aceito).toBe(false) // documenta a rejeição; o valor vai para o relatório, não há carrinho a testar
          return
        }
        const cart0 = await novoCarrinho([{ variantId: cat.top.variantId, quantity: 1 }, { variantId: cat.legging.variantId, quantity: 1 }])
        await api.post(`/store/carts/${cart0.id}/promotions`, { promo_codes: ["PEDIDO10X"] }, { headers: cat.storeHeaders })
        const cart = (await api.get(`/store/carts/${cart0.id}?fields=*items,*items.adjustments`, { headers: cat.storeHeaders })).data.cart
        const pedido = somaPorCodigo(cart, "PEDIDO10X")
        // eslint-disable-next-line no-console
        console.log("[F0-D2] PEDIDO10X total =", pedido, "ajustes:", JSON.stringify(cart.items.map((i: any) => ({ v: i.variant_id, adj: i.adjustments }))))
        expect(pedido).toBeGreaterThan(0)
      })
    })
  },
})
