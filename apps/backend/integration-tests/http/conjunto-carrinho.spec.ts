// Testes do gancho real do carrinho (substitui a PoC): marcação de unidades via avaliarCarrinho/
// marcarContexto, com os 4 tipos de desconto, máximo de pares por coleção, sobra, coleções
// diferentes, exceção por coleção (inativa/ativa), curado consumindo antes do par, e cupom de
// itens respeitando a marcação "conjunto" (spec §6.1–§6.4).
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { criarAdmin } from "../helpers/admin"
import { criarCatalogoBase, type CatalogoBase } from "../helpers/catalogo"
import { BENEFICIO_CONJUNTO_MODULE } from "../../src/modules/beneficio-conjunto"
import { sincronizarPromocao } from "../../src/modules/beneficio-conjunto/sincronizar-promocao"
import { codigoDaRegra } from "../../src/modules/beneficio-conjunto/utils/promocao"
import type { TipoDesconto } from "../../src/modules/beneficio-conjunto/utils/tipos"

jest.setTimeout(180 * 1000)

const ajustes = (item: any) => (item.adjustments ?? []) as { code: string; amount: number }[]
const somaPorCodigo = (cart: any, code: string) =>
  cart.items.flatMap(ajustes).filter((a: any) => a.code === code).reduce((s: number, a: any) => s + Number(a.amount), 0)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  // Ver conjunto-poc.spec.ts (removido): o afterEach padrão do runner faz TRUNCATE em todas as
  // tabelas após cada it(); com disableAutoTeardown os casos reaproveitam catálogo/regras/pares
  // criados uma única vez no beforeAll, cada it() abrindo seu próprio carrinho.
  disableAutoTeardown: true,
  testSuite: ({ api, getContainer }) => {
    let admin: Record<string, string>
    let cat: CatalogoBase
    let regraPadraoId: string
    let regraColecaoBlackId: string

    beforeAll(async () => {
      admin = (await criarAdmin(api, getContainer())).headers
      cat = await criarCatalogoBase(api, admin)
      const svc: any = getContainer().resolve(BENEFICIO_CONJUNTO_MODULE)

      const regraPadrao = await svc.createConjuntoRegras({ nome: "Padrão", escopo: "padrao", tipo_desconto: "menor_peca_percentual", valor: 20, ativa: true })
      regraPadraoId = regraPadrao.id
      await sincronizarPromocao(getContainer(), regraPadraoId)

      // Par.categoria_a/categoria_b guardam o HANDLE da categoria raiz (igual a Linha.categoria_raiz,
      // calculado por raizPorCategoria a partir do handle) — não o id da categoria.
      await svc.criarPar({ categoria_a: "leggings", categoria_b: "tops" })
      await svc.criarPar({ categoria_a: "shorts", categoria_b: "tops" })

      // Cupom de itens (§6.4): só alcança unidades marcadas "nenhum" (fora de qualquer conjunto).
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
    })

    async function setPadrao(tipo_desconto: TipoDesconto, valor: number, ativa = true) {
      const svc: any = getContainer().resolve(BENEFICIO_CONJUNTO_MODULE)
      await svc.updateConjuntoRegras({ id: regraPadraoId, tipo_desconto, valor, ativa })
      await sincronizarPromocao(getContainer(), regraPadraoId)
    }

    // Exceção por coleção (Blackout): cria na primeira chamada, só ajusta depois (índice único por collection_id).
    async function setColecaoBlack(ativa: boolean, tipo_desconto: TipoDesconto = "total_percentual", valor = 10) {
      const svc: any = getContainer().resolve(BENEFICIO_CONJUNTO_MODULE)
      if (!regraColecaoBlackId) {
        const r = await svc.createConjuntoRegras({ nome: "Exceção Blackout", escopo: "colecao", collection_id: cat.collections.black, tipo_desconto, valor, ativa })
        regraColecaoBlackId = r.id
      } else {
        await svc.updateConjuntoRegras({ id: regraColecaoBlackId, tipo_desconto, valor, ativa })
      }
      await sincronizarPromocao(getContainer(), regraColecaoBlackId)
    }

    // Remove de vez a exceção de coleção do caso 6: uma linha "colecao" inativa NÃO cai de volta
    // para o padrão (regraEfetiva devolve null quando a exceção existe e está inativa — spec/ruling
    // adotada no caso 6) — só a AUSÊNCIA da linha restaura o padrão para a coleção Blackout.
    async function removerColecaoBlack() {
      if (!regraColecaoBlackId) return
      const svc: any = getContainer().resolve(BENEFICIO_CONJUNTO_MODULE)
      const promo: any = getContainer().resolve(Modules.PROMOTION)
      const regra = await svc.retrieveConjuntoRegra(regraColecaoBlackId)
      await svc.deleteConjuntoRegras([regraColecaoBlackId])
      if (regra.promotion_id) await promo.deletePromotions([regra.promotion_id]).catch(() => {})
      regraColecaoBlackId = ""
    }

    async function novoCarrinho(linhas: { variantId: string; quantity: number }[]) {
      const cart = (
        await api.post("/store/carts", { region_id: cat.regionId, sales_channel_id: cat.salesChannelId }, { headers: cat.storeHeaders })
      ).data.cart
      for (const l of linhas) {
        await api.post(`/store/carts/${cart.id}/line-items`, { variant_id: l.variantId, quantity: l.quantity }, { headers: cat.storeHeaders })
      }
      return (await api.get(`/store/carts/${cart.id}?fields=*items,*items.adjustments`, { headers: cat.storeHeaders })).data.cart
    }

    // 1 — Par simples, menor peça 20%.
    it("caso 1: top + legging → 20% da menor peça (top) = 37,80; legging sem ajuste", async () => {
      await setPadrao("menor_peca_percentual", 20)
      const cart = await novoCarrinho([{ variantId: cat.top.variantId, quantity: 1 }, { variantId: cat.legging.variantId, quantity: 1 }])
      const top = cart.items.find((i: any) => i.variant_id === cat.top.variantId)
      const legging = cart.items.find((i: any) => i.variant_id === cat.legging.variantId)
      expect(somaPorCodigo(cart, codigoDaRegra(regraPadraoId))).toBeCloseTo(37.8, 2)
      expect(ajustes(top)).toHaveLength(1)
      expect(ajustes(legging)).toHaveLength(0)
      expect(Number(cart.discount_total)).toBeCloseTo(37.8, 2)
    })

    // 2 — Troca de tipo: total_percentual, total_valor, menor_peca_valor (carrinho novo por tipo).
    describe("caso 2: troca de tipo de desconto", () => {
      it("total_percentual 10 → 18,90 (top) + 25,90 (legging) = 44,80", async () => {
        await setPadrao("total_percentual", 10)
        const cart = await novoCarrinho([{ variantId: cat.top.variantId, quantity: 1 }, { variantId: cat.legging.variantId, quantity: 1 }])
        expect(Number(cart.discount_total)).toBeCloseTo(44.8, 2)
      })

      it("total_valor 4500 → 22,50 + 22,50 = 45,00", async () => {
        await setPadrao("total_valor", 4500)
        const cart = await novoCarrinho([{ variantId: cat.top.variantId, quantity: 1 }, { variantId: cat.legging.variantId, quantity: 1 }])
        const top = cart.items.find((i: any) => i.variant_id === cat.top.variantId)
        const legging = cart.items.find((i: any) => i.variant_id === cat.legging.variantId)
        expect(somaPorCodigo({ items: [top] }, codigoDaRegra(regraPadraoId))).toBeCloseTo(22.5, 2)
        expect(somaPorCodigo({ items: [legging] }, codigoDaRegra(regraPadraoId))).toBeCloseTo(22.5, 2)
        expect(Number(cart.discount_total)).toBeCloseTo(45.0, 2)
      })

      it("menor_peca_valor 5000 → 50,00 no top (mais barato)", async () => {
        await setPadrao("menor_peca_valor", 5000)
        const cart = await novoCarrinho([{ variantId: cat.top.variantId, quantity: 1 }, { variantId: cat.legging.variantId, quantity: 1 }])
        const top = cart.items.find((i: any) => i.variant_id === cat.top.variantId)
        const legging = cart.items.find((i: any) => i.variant_id === cat.legging.variantId)
        expect(somaPorCodigo({ items: [top] }, codigoDaRegra(regraPadraoId))).toBeCloseTo(50.0, 2)
        expect(ajustes(legging)).toHaveLength(0)
        expect(Number(cart.discount_total)).toBeCloseTo(50.0, 2)
      })
    })

    // 3 — Máximo de pares: top×2 + legging + short → 2 conjuntos (top+legging, top+short).
    it("caso 3: top×2 + legging + short → 20% de 189 + 20% de 159 = 37,80 + 31,80 = 69,60", async () => {
      await setPadrao("menor_peca_percentual", 20)
      const cart = await novoCarrinho([
        { variantId: cat.top.variantId, quantity: 2 },
        { variantId: cat.legging.variantId, quantity: 1 },
        { variantId: cat.short.variantId, quantity: 1 },
      ])
      expect(Number(cart.discount_total)).toBeCloseTo(69.6, 2)
    })

    // 4 — Sobra: top×1 + legging×2 → só um conjunto (37,80); uma legging livre.
    it("caso 4: top×1 + legging×2 → só um conjunto = 37,80", async () => {
      await setPadrao("menor_peca_percentual", 20)
      const cart = await novoCarrinho([{ variantId: cat.top.variantId, quantity: 1 }, { variantId: cat.legging.variantId, quantity: 2 }])
      expect(Number(cart.discount_total)).toBeCloseTo(37.8, 2)
    })

    // 5 — Coleções diferentes: pareamento só dentro da mesma coleção.
    describe("caso 5: coleções diferentes", () => {
      it("top (Blackout) + topLum (Lumière), mesma categoria raiz mas coleções diferentes → 0", async () => {
        await setPadrao("menor_peca_percentual", 20)
        const cart = await novoCarrinho([{ variantId: cat.top.variantId, quantity: 1 }, { variantId: cat.topLum.variantId, quantity: 1 }])
        expect(Number(cart.discount_total)).toBeCloseTo(0, 2)
      })

      it("top + legging + macaquinho → conjunto só top+legging (37,80); macaquinho fora (sem par)", async () => {
        const cart = await novoCarrinho([
          { variantId: cat.top.variantId, quantity: 1 },
          { variantId: cat.legging.variantId, quantity: 1 },
          { variantId: cat.macaquinho.variantId, quantity: 1 },
        ])
        expect(Number(cart.discount_total)).toBeCloseTo(37.8, 2)
      })
    })

    // 6 — Exceção por coleção: inativa bloqueia o padrão; ativa substitui o padrão.
    describe("caso 6: exceção de coleção (Blackout)", () => {
      it("exceção inativa → nenhum desconto (bloqueia o padrão para a coleção)", async () => {
        await setPadrao("menor_peca_percentual", 20)
        await setColecaoBlack(false, "total_percentual", 10)
        const cart = await novoCarrinho([{ variantId: cat.top.variantId, quantity: 1 }, { variantId: cat.legging.variantId, quantity: 1 }])
        expect(Number(cart.discount_total)).toBeCloseTo(0, 2)
      })

      it("exceção ativa (total_percentual 10) → 18,90 + 25,90 = 44,80", async () => {
        await setColecaoBlack(true, "total_percentual", 10)
        const cart = await novoCarrinho([{ variantId: cat.top.variantId, quantity: 1 }, { variantId: cat.legging.variantId, quantity: 1 }])
        expect(Number(cart.discount_total)).toBeCloseTo(44.8, 2)
      })
    })

    // 7 — Curado consome antes do par: top+topLum formam o curado; a legging fica sem par (top já foi usado).
    it("caso 7: curado (top+topLum, total_valor 4000) formado antes do par → 40,00; legging sem par", async () => {
      // Desliga a exceção de coleção do caso 6 para não interferir na avaliação da coleção Blackout.
      await removerColecaoBlack()
      await setPadrao("menor_peca_percentual", 20)

      const svc: any = getContainer().resolve(BENEFICIO_CONJUNTO_MODULE)
      const regraCurado = await svc.createConjuntoRegras({ nome: "Curado Top+TopLum", escopo: "curado", tipo_desconto: "total_valor", valor: 4000, ativa: true })
      await svc.createConjuntoCurados({
        nome: "Look misto",
        handle: "look-misto-caso-7",
        product_ids: [cat.top.productId, cat.topLum.productId],
        regra_id: regraCurado.id,
        ativo: true,
      })
      await sincronizarPromocao(getContainer(), regraCurado.id)

      const cart = await novoCarrinho([
        { variantId: cat.top.variantId, quantity: 1 },
        { variantId: cat.topLum.variantId, quantity: 1 },
        { variantId: cat.legging.variantId, quantity: 1 },
      ])
      const top = cart.items.find((i: any) => i.variant_id === cat.top.variantId)
      const topLum = cart.items.find((i: any) => i.variant_id === cat.topLum.variantId)
      const legging = cart.items.find((i: any) => i.variant_id === cat.legging.variantId)
      expect(somaPorCodigo({ items: [top] }, codigoDaRegra(regraCurado.id))).toBeCloseTo(20.0, 2)
      expect(somaPorCodigo({ items: [topLum] }, codigoDaRegra(regraCurado.id))).toBeCloseTo(20.0, 2)
      expect(ajustes(legging)).toHaveLength(0)
      expect(Number(cart.discount_total)).toBeCloseTo(40.0, 2)
    })

    // 8 — Cupom: conjunto no top, cupom só no macaquinho (fora de conjunto); legging em conjunto sem
    // desconto próprio ("conjunto") não recebe cupom (marca ≠ "nenhum").
    it("caso 8: top+legging em conjunto (37,80) + macaquinho com cupom (29,90) = 67,70; legging sem cupom", async () => {
      await removerColecaoBlack()
      await setPadrao("menor_peca_percentual", 20)

      const cart0 = await novoCarrinho([
        { variantId: cat.top.variantId, quantity: 1 },
        { variantId: cat.legging.variantId, quantity: 1 },
        { variantId: cat.macaquinho.variantId, quantity: 1 },
      ])
      await api.post(`/store/carts/${cart0.id}/promotions`, { promo_codes: ["CUPOM10"] }, { headers: cat.storeHeaders })
      const cart = (await api.get(`/store/carts/${cart0.id}?fields=*items,*items.adjustments`, { headers: cat.storeHeaders })).data.cart

      const legging = cart.items.find((i: any) => i.variant_id === cat.legging.variantId)
      expect(somaPorCodigo(cart, codigoDaRegra(regraPadraoId))).toBeCloseTo(37.8, 2)
      expect(somaPorCodigo(cart, "CUPOM10")).toBeCloseTo(29.9, 2)
      expect(ajustes(legging).filter((a) => a.code === "CUPOM10")).toHaveLength(0)
      expect(Number(cart.discount_total)).toBeCloseTo(67.7, 2)
    })
  },
})
