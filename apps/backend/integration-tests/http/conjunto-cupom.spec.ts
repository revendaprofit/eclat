// Testes da conversão de cupons (gancho de promoção, spec §6.4, F0 D/D2/D3): cupom nunca alcança
// unidade em conjunto. (a) cupom de PEDIDO sem regras vira cupom de ITENS (across, sem max_quantity)
// com a regra-alvo de exclusão; (b) cupom de itens sem regras ganha a mesma regra; (c) editar um cupom
// já convertido não duplica a regra (idempotência); (d) o cupom convertido, aplicado num carrinho,
// só alcança a unidade fora de qualquer conjunto; (e) `reconciliar` devolve contagens e não duplica.
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { criarAdmin } from "../helpers/admin"
import { criarCatalogoBase, type CatalogoBase } from "../helpers/catalogo"
import { BENEFICIO_CONJUNTO_MODULE } from "../../src/modules/beneficio-conjunto"
import { reconciliar, sincronizarPromocao } from "../../src/modules/beneficio-conjunto/sincronizar-promocao"
import { ATRIBUTO, MARCA_LIVRE, codigoDaRegra } from "../../src/modules/beneficio-conjunto/utils/promocao"

jest.setTimeout(180 * 1000)

const ajustes = (item: any) => (item.adjustments ?? []) as { code: string; amount: number }[]
const somaPorCodigo = (cart: any, code: string) =>
  cart.items.flatMap(ajustes).filter((a: any) => a.code === code).reduce((s: number, a: any) => s + Number(a.amount), 0)

const regrasExclusao = (rules: any[]) =>
  (rules ?? []).filter((r: any) => r.attribute === ATRIBUTO && r.operator === "eq" && (r.values ?? []).some((v: any) => (v.value ?? v) === MARCA_LIVRE))

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  disableAutoTeardown: true,
  testSuite: ({ api, getContainer }) => {
    let admin: Record<string, string>
    let cat: CatalogoBase
    let regraPadraoId: string
    let pedido10Id: string
    let itens10Id: string

    async function retrievePromo(id: string) {
      const promo: any = getContainer().resolve(Modules.PROMOTION)
      return promo.retrievePromotion(id, {
        relations: ["application_method", "application_method.target_rules", "application_method.target_rules.values"],
      })
    }

    beforeAll(async () => {
      admin = (await criarAdmin(api, getContainer())).headers
      cat = await criarCatalogoBase(api, admin)
      const svc: any = getContainer().resolve(BENEFICIO_CONJUNTO_MODULE)

      const regraPadrao = await svc.createConjuntoRegras({ nome: "Padrão", escopo: "padrao", tipo_desconto: "menor_peca_percentual", valor: 20, ativa: true })
      regraPadraoId = regraPadrao.id
      await sincronizarPromocao(getContainer(), regraPadraoId)

      await svc.criarPar({ categoria_a: "leggings", categoria_b: "tops" })
    })

    async function novoCarrinho(linhas: { variantId: string; quantity: number }[]) {
      const cart = (
        await api.post("/store/carts", { region_id: cat.regionId, sales_channel_id: cat.salesChannelId }, { headers: cat.storeHeaders })
      ).data.cart
      for (const l of linhas) {
        await api.post(`/store/carts/${cart.id}/line-items`, { variant_id: l.variantId, quantity: l.quantity }, { headers: cat.storeHeaders })
      }
      return (await api.get(`/store/carts/${cart.id}?fields=*items,*items.adjustments`, { headers: cat.storeHeaders })).data.cart
    }

    // a — Cupom de PEDIDO (target_type "order"), criado sem nenhuma regra-alvo (a Admin API rejeita
    // target_rules em promoções de pedido na criação — F0). O gancho promotionsCreated deve convertê-lo
    // para item (across, sem max_quantity) e acrescentar a regra de exclusão.
    it("caso a: PEDIDO10 (cupom de pedido) vira cupom de itens com a regra de exclusão", async () => {
      const res = await api.post(
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
      pedido10Id = res.data.promotion.id

      const p = await retrievePromo(pedido10Id)
      expect(p.application_method.target_type).toBe("items")
      expect(p.application_method.allocation).toBe("across")
      expect(p.application_method.max_quantity).toBeNull()
      expect(regrasExclusao(p.application_method.target_rules)).toHaveLength(1)
    })

    // b — Cupom de itens, criado sem nenhuma regra-alvo → ganha a regra de exclusão (target_type não
    // muda, já é "items").
    it("caso b: ITENS10 (cupom de itens sem regras) ganha a regra de exclusão", async () => {
      const res = await api.post(
        "/admin/promotions",
        {
          code: "ITENS10",
          type: "standard",
          is_automatic: false,
          status: "active",
          application_method: { type: "percentage", target_type: "items", allocation: "each", max_quantity: 1000, value: 10, currency_code: "brl" },
        },
        { headers: admin }
      )
      itens10Id = res.data.promotion.id

      const p = await retrievePromo(itens10Id)
      expect(p.application_method.target_type).toBe("items")
      expect(regrasExclusao(p.application_method.target_rules)).toHaveLength(1)
    })

    // c — Editar o cupom já convertido (gancho promotionsUpdated) não duplica a regra de exclusão.
    it("caso c: editar ITENS10 (status) continua com UMA regra de exclusão (idempotência)", async () => {
      await api.post(`/admin/promotions/${itens10Id}`, { status: "active" }, { headers: admin })

      const p = await retrievePromo(itens10Id)
      expect(regrasExclusao(p.application_method.target_rules)).toHaveLength(1)
    })

    // d — Carrinho top + legging (conjunto, padrão 20%) + macaquinho (fora de conjunto) com PEDIDO10
    // aplicado: o conjunto desconta o top; o cupom (convertido) só alcança o macaquinho (marca "nenhum");
    // a legging (marca "conjunto", sem desconto próprio) não recebe o cupom.
    it("caso d: top+legging em conjunto (37,80) + macaquinho com PEDIDO10 (29,90) = 67,70; legging sem cupom", async () => {
      const cart0 = await novoCarrinho([
        { variantId: cat.top.variantId, quantity: 1 },
        { variantId: cat.legging.variantId, quantity: 1 },
        { variantId: cat.macaquinho.variantId, quantity: 1 },
      ])
      await api.post(`/store/carts/${cart0.id}/promotions`, { promo_codes: ["PEDIDO10"] }, { headers: cat.storeHeaders })
      const cart = (await api.get(`/store/carts/${cart0.id}?fields=*items,*items.adjustments`, { headers: cat.storeHeaders })).data.cart

      const legging = cart.items.find((i: any) => i.variant_id === cat.legging.variantId)
      expect(somaPorCodigo(cart, codigoDaRegra(regraPadraoId))).toBeCloseTo(37.8, 2)
      expect(somaPorCodigo(cart, "PEDIDO10")).toBeCloseTo(29.9, 2)
      expect(ajustes(legging).filter((a) => a.code === "PEDIDO10")).toHaveLength(0)
      expect(Number(cart.discount_total)).toBeCloseTo(67.7, 2)
    })

    // e — Reconciliação: cobre o cupom que NUNCA passou pelo gancho (criado direto no serviço do
    // módulo PROMOTION, contornando createPromotionsWorkflow — ex.: script/seed antigo), contagens
    // coerentes, e não duplica regras já convertidas (nem as dos casos a/b, nem a que acabou de converter).
    it("caso e: reconciliar converte um cupom que não passou pelo gancho e não duplica regras", async () => {
      const promo: any = getContainer().resolve(Modules.PROMOTION)
      const manual = await promo.createPromotions({
        code: "PEDIDOMANUAL10",
        type: "standard",
        is_automatic: false,
        status: "active",
        application_method: { type: "percentage", target_type: "order", value: 10, currency_code: "brl" },
      })
      const antesManual = await retrievePromo(manual.id)
      expect(antesManual.application_method.target_type).toBe("order")
      expect(regrasExclusao(antesManual.application_method.target_rules)).toHaveLength(0)

      const resultado = await reconciliar(getContainer())
      expect(resultado.regras).toBeGreaterThanOrEqual(1)
      expect(resultado.cupons).toBeGreaterThanOrEqual(1)

      const depoisManual = await retrievePromo(manual.id)
      expect(depoisManual.application_method.target_type).toBe("items")
      expect(depoisManual.application_method.allocation).toBe("across")
      expect(depoisManual.application_method.max_quantity).toBeNull()
      expect(regrasExclusao(depoisManual.application_method.target_rules)).toHaveLength(1)

      const itens10 = await retrievePromo(itens10Id)
      expect(regrasExclusao(itens10.application_method.target_rules)).toHaveLength(1)
      const pedido10 = await retrievePromo(pedido10Id)
      expect(regrasExclusao(pedido10.application_method.target_rules)).toHaveLength(1)

      // Rodar de novo não converte nada a mais nem duplica a regra que acabou de ganhar.
      const resultado2 = await reconciliar(getContainer())
      expect(resultado2.cupons).toBe(0)
      const aindaManual = await retrievePromo(manual.id)
      expect(regrasExclusao(aindaManual.application_method.target_rules)).toHaveLength(1)
    })
  },
})
