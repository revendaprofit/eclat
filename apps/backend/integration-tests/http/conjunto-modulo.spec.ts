import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { BENEFICIO_CONJUNTO_MODULE } from "../../src/modules/beneficio-conjunto"

jest.setTimeout(120 * 1000)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ getContainer }) => {
    it("cria e lê regra, par e curado; índice único de coleção", async () => {
      const svc: any = getContainer().resolve(BENEFICIO_CONJUNTO_MODULE)
      const regra = await svc.createConjuntoRegras({ nome: "Padrão", escopo: "padrao", tipo_desconto: "total_percentual", valor: 10, ativa: false })
      expect(regra.id).toMatch(/^creg_/)
      // Nota (fallback registrado): o MedusaService pluraliza "ConjuntoPar" para "ConjuntoPars"
      // (lib `pluralize`, regras do inglês) — não "ConjuntoPares" como esperado inicialmente.
      await svc.createConjuntoPars({ categoria_a: "leggings", categoria_b: "tops" })
      const cur = await svc.createConjuntoCurados({ nome: "Look Blackout", handle: "look-blackout", product_ids: ["p1", "p2"], regra_id: regra.id })
      expect(cur.product_ids).toEqual(["p1", "p2"])
      const excecao = await svc.createConjuntoRegras({ nome: "Col X", escopo: "colecao", collection_id: "col_x", tipo_desconto: "menor_peca_percentual", valor: 20 })
      await expect(svc.createConjuntoRegras({ nome: "Col X de novo", escopo: "colecao", collection_id: "col_x", tipo_desconto: "total_valor", valor: 1000 })).rejects.toBeTruthy()
      const ativos = await svc.carregarAtivos()
      expect(ativos.regras.map((r: any) => r.id).sort()).toEqual([regra.id, excecao.id].sort())
      expect(ativos.pares).toHaveLength(1)
      expect(ativos.curados).toHaveLength(1)
    })
  },
})
