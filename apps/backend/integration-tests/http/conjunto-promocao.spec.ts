import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { BENEFICIO_CONJUNTO_MODULE } from "../../src/modules/beneficio-conjunto"
import { sincronizarPromocao } from "../../src/modules/beneficio-conjunto/sincronizar-promocao"

jest.setTimeout(120 * 1000)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  disableAutoTeardown: true,
  testSuite: ({ getContainer }) => {
    it("cria a promoção automática da regra, atualiza valor/status e recria se apagada", async () => {
      const c = getContainer()
      const svc: any = c.resolve(BENEFICIO_CONJUNTO_MODULE)
      const promo: any = c.resolve(Modules.PROMOTION)
      const regra = await svc.createConjuntoRegras({ nome: "Padrão", escopo: "padrao", tipo_desconto: "menor_peca_percentual", valor: 20, ativa: true })
      const { promotion_id } = await sincronizarPromocao(c, regra.id)
      let p = await promo.retrievePromotion(promotion_id, { relations: ["application_method", "application_method.target_rules"] })
      expect(p.code).toBe(`CONJUNTO-${regra.id}`)
      expect(p.is_automatic).toBe(true)
      expect(p.status).toBe("active")
      expect(p.application_method).toMatchObject({ type: "percentage", target_type: "items", allocation: "each", max_quantity: 1000 })
      expect(Number(p.application_method.value)).toBe(20)
      expect(p.application_method.target_rules[0]).toMatchObject({ attribute: "items.conjunto_desconto", operator: "eq" })

      await svc.updateConjuntoRegras({ id: regra.id, valor: 15, ativa: false })
      await sincronizarPromocao(c, regra.id)
      p = await promo.retrievePromotion(promotion_id, { relations: ["application_method"] })
      expect(Number(p.application_method.value)).toBe(15)
      expect(p.status).toBe("inactive")

      await promo.deletePromotions([promotion_id])
      const { promotion_id: novo } = await sincronizarPromocao(c, regra.id)
      expect(novo).not.toBe(promotion_id)
      expect((await svc.retrieveConjuntoRegra(regra.id)).promotion_id).toBe(novo)
    })

    it("total_valor reparte por unidade: 45,00 num par vira fixed 22,50", async () => {
      const c = getContainer()
      const svc: any = c.resolve(BENEFICIO_CONJUNTO_MODULE)
      const promo: any = c.resolve(Modules.PROMOTION)
      const regra = await svc.createConjuntoRegras({ nome: "Col", escopo: "colecao", collection_id: "col_t", tipo_desconto: "total_valor", valor: 4500, ativa: true })
      const { promotion_id } = await sincronizarPromocao(c, regra.id)
      const p = await promo.retrievePromotion(promotion_id, { relations: ["application_method"] })
      expect(p.application_method.type).toBe("fixed")
      expect(Number(p.application_method.value)).toBeCloseTo(22.5, 2)
    })
  },
})
