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

    it("índice único parcial de conjunto_regra.escopo rejeita uma segunda regra padrao (fix round 1)", async () => {
      const svc: any = getContainer().resolve(BENEFICIO_CONJUNTO_MODULE)
      await svc.createConjuntoRegras({ nome: "Padrão 1", escopo: "padrao", tipo_desconto: "total_percentual", valor: 10 })
      await expect(
        svc.createConjuntoRegras({ nome: "Padrão 2", escopo: "padrao", tipo_desconto: "total_valor", valor: 500 })
      ).rejects.toBeTruthy()
    })

    it("criarPar normaliza a ordem das categorias, rejeita duplicata e categoria igual (fix round 1)", async () => {
      const svc: any = getContainer().resolve(BENEFICIO_CONJUNTO_MODULE)

      const par = await svc.criarPar({ categoria_a: "tops", categoria_b: "leggings" })
      expect(par.categoria_a).toBe("leggings")
      expect(par.categoria_b).toBe("tops")

      // Mesmo par, ordem invertida na entrada — normaliza para a mesma linha e colide no índice único.
      await expect(svc.criarPar({ categoria_a: "leggings", categoria_b: "tops" })).rejects.toBeTruthy()

      // Categoria igual a si mesma — rejeitado antes de tocar o banco (MedusaError INVALID_DATA).
      await expect(svc.criarPar({ categoria_a: "tops", categoria_b: "tops" })).rejects.toBeTruthy()
    })

    it("CHECK conjunto_par_ordem rejeita escrita fora de ordem via createConjuntoPars cru (fix round 1)", async () => {
      const svc: any = getContainer().resolve(BENEFICIO_CONJUNTO_MODULE)
      // Chamando o método gerado diretamente (sem passar por criarPar) para provar que a ordem
      // é garantida pelo CHECK do banco, não só pela normalização do serviço.
      await expect(svc.createConjuntoPars({ categoria_a: "tops", categoria_b: "leggings" })).rejects.toBeTruthy()
    })

    it("índice único de conjunto_curado.handle rejeita handle duplicado (fix round 1)", async () => {
      const svc: any = getContainer().resolve(BENEFICIO_CONJUNTO_MODULE)
      const regra = await svc.createConjuntoRegras({ nome: "Curado", escopo: "curado", tipo_desconto: "total_percentual", valor: 15 })
      await svc.createConjuntoCurados({ nome: "Look A", handle: "look-duplicado", product_ids: ["p1"], regra_id: regra.id })
      await expect(
        svc.createConjuntoCurados({ nome: "Look B", handle: "look-duplicado", product_ids: ["p2"], regra_id: regra.id })
      ).rejects.toBeTruthy()
    })
  },
})
