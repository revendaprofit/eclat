// Testes das rotas admin do Benefício Conjunto (Task 6, spec §5): regras (CRUD + validação),
// pares (substituição da lista inteira), curados (CRUD + promoção), por-produto e reconciliar.
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { criarAdmin } from "../helpers/admin"
import { criarCatalogoBase, type CatalogoBase } from "../helpers/catalogo"

jest.setTimeout(180 * 1000)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  disableAutoTeardown: true,
  testSuite: ({ api, getContainer }) => {
    let admin: Record<string, string>
    let cat: CatalogoBase

    beforeAll(async () => {
      admin = (await criarAdmin(api, getContainer())).headers
      cat = await criarCatalogoBase(api, admin)
    })

    describe("regras", () => {
      let regraPadraoId: string

      it("cria a regra padrão (promoção automática criada)", async () => {
        const res = await api.post(
          "/admin/conjuntos/regras",
          { nome: "Padrão", escopo: "padrao", tipo_desconto: "menor_peca_percentual", valor: 20 },
          { headers: admin }
        )
        expect(res.status).toBe(200)
        expect(res.data.regra.escopo).toBe("padrao")
        expect(res.data.regra.ativa).toBe(true)
        expect(res.data.regra.promotion_id).toBeTruthy()
        regraPadraoId = res.data.regra.id
      })

      it("segunda regra padrão → 400", async () => {
        await expect(
          api.post("/admin/conjuntos/regras", { nome: "Padrão 2", escopo: "padrao", tipo_desconto: "total_percentual", valor: 10 }, { headers: admin })
        ).rejects.toMatchObject({ response: { status: 400 } })
      })

      it("escopo colecao sem collection_id → 400", async () => {
        await expect(
          api.post("/admin/conjuntos/regras", { nome: "Sem coleção", escopo: "colecao", tipo_desconto: "total_percentual", valor: 10 }, { headers: admin })
        ).rejects.toMatchObject({ response: { status: 400 } })
      })

      it("edita valor da regra padrão; promoção automática é atualizada", async () => {
        const res = await api.put(`/admin/conjuntos/regras/${regraPadraoId}`, { valor: 15 }, { headers: admin })
        expect(res.data.regra.valor).toBe(15)
        const promo: any = getContainer().resolve(Modules.PROMOTION)
        const p = await promo.retrievePromotion(res.data.regra.promotion_id, { relations: ["application_method"] })
        expect(Number(p.application_method.value)).toBe(15)
      })

      it("valor: 0 → 400", async () => {
        await expect(
          api.post(
            "/admin/conjuntos/regras",
            { nome: "X", escopo: "colecao", collection_id: cat.collections.lum, tipo_desconto: "total_percentual", valor: 0 },
            { headers: admin }
          )
        ).rejects.toMatchObject({ response: { status: 400 } })
      })

      it("tipo_desconto inválido → 400", async () => {
        await expect(
          api.post(
            "/admin/conjuntos/regras",
            { nome: "X", escopo: "colecao", collection_id: cat.collections.lum, tipo_desconto: "invalido", valor: 10 },
            { headers: admin }
          )
        ).rejects.toMatchObject({ response: { status: 400 } })
      })

      it("valor percentual > 100 → 400", async () => {
        await expect(
          api.post(
            "/admin/conjuntos/regras",
            { nome: "X", escopo: "colecao", collection_id: cat.collections.lum, tipo_desconto: "total_percentual", valor: 101 },
            { headers: admin }
          )
        ).rejects.toMatchObject({ response: { status: 400 } })
      })

      it("coleção já com exceção → 422 (brief pede 409; framework mapeia DUPLICATE_ERROR para 422 — ver report)", async () => {
        const primeira = await api.post(
          "/admin/conjuntos/regras",
          { nome: "Exceção Blackout", escopo: "colecao", collection_id: cat.collections.black, tipo_desconto: "total_percentual", valor: 10 },
          { headers: admin }
        )
        expect(primeira.status).toBe(200)
        await expect(
          api.post(
            "/admin/conjuntos/regras",
            { nome: "Exceção Blackout 2", escopo: "colecao", collection_id: cat.collections.black, tipo_desconto: "total_valor", valor: 500 },
            { headers: admin }
          )
        ).rejects.toMatchObject({ response: { status: 422 } })
      })

      it("GET /regras lista todas (inclusive inativas), exceto escopo curado", async () => {
        const res = await api.get("/admin/conjuntos/regras", { headers: admin })
        expect(res.data.regras.length).toBeGreaterThanOrEqual(2)
        expect(res.data.regras.every((r: any) => r.escopo !== "curado")).toBe(true)
      })
    })

    describe("pares", () => {
      it("PUT normaliza a<b, cria, ajusta ativo e remove os ausentes (substituição total)", async () => {
        let res = await api.put(
          "/admin/conjuntos/pares",
          { pares: [{ categoria_a: "tops", categoria_b: "leggings" }, { categoria_a: "shorts", categoria_b: "tops" }] },
          { headers: admin }
        )
        expect(res.data.pares).toHaveLength(2)
        const topLeg = res.data.pares.find((p: any) => p.categoria_a === "leggings" && p.categoria_b === "tops")
        expect(topLeg).toBeTruthy() // "leggings" < "tops" alfabeticamente — normalizado
        expect(topLeg.ativo).toBe(true)

        // Substitui a lista inteira: remove shorts-tops, mantém leggings-tops mas desativa.
        res = await api.put("/admin/conjuntos/pares", { pares: [{ categoria_a: "tops", categoria_b: "leggings", ativo: false }] }, { headers: admin })
        expect(res.data.pares).toHaveLength(1)
        expect(res.data.pares[0].ativo).toBe(false)

        // Restaura os dois pares (usados pelo teste de "por-produto" mais abaixo).
        res = await api.put(
          "/admin/conjuntos/pares",
          { pares: [{ categoria_a: "tops", categoria_b: "leggings" }, { categoria_a: "shorts", categoria_b: "tops" }] },
          { headers: admin }
        )
        expect(res.data.pares).toHaveLength(2)
        expect(res.data.pares.every((p: any) => p.ativo)).toBe(true)
      })

      it("categoria_a === categoria_b → 400", async () => {
        await expect(
          api.put("/admin/conjuntos/pares", { pares: [{ categoria_a: "tops", categoria_b: "tops" }] }, { headers: admin })
        ).rejects.toMatchObject({ response: { status: 400 } })
      })
    })

    describe("curados", () => {
      let curadoId: string
      let promotionId: string

      it("cria curado com 2 produtos do catálogo; regra + promoção criadas; handle gerado do nome", async () => {
        const res = await api.post(
          "/admin/conjuntos/curados",
          { nome: "Look Verão", product_ids: [cat.top.productId, cat.legging.productId], tipo_desconto: "total_valor", valor: 4000 },
          { headers: admin }
        )
        expect(res.status).toBe(200)
        expect(res.data.curado.handle).toBe("look-verao")
        expect(res.data.curado.product_ids.sort()).toEqual([cat.top.productId, cat.legging.productId].sort())
        expect(res.data.curado.regra.escopo).toBe("curado")
        expect(res.data.curado.regra.promotion_id).toBeTruthy()
        curadoId = res.data.curado.id
        promotionId = res.data.curado.regra.promotion_id

        const promo: any = getContainer().resolve(Modules.PROMOTION)
        const p = await promo.retrievePromotion(promotionId, { relations: ["application_method"] })
        expect(p.is_automatic).toBe(true)
        expect(Number(p.application_method.value)).toBeCloseTo(20.0, 2) // 4000 centavos / 2 unidades / 100
      })

      it("produto inexistente → 400", async () => {
        await expect(
          api.post(
            "/admin/conjuntos/curados",
            { nome: "Look Inválido", product_ids: [cat.top.productId, "prod_inexistente_123"], tipo_desconto: "total_valor", valor: 1000 },
            { headers: admin }
          )
        ).rejects.toMatchObject({ response: { status: 400 } })
      })

      it("menos de 2 produtos distintos → 400", async () => {
        await expect(
          api.post(
            "/admin/conjuntos/curados",
            { nome: "Look Sozinho", product_ids: [cat.top.productId, cat.top.productId], tipo_desconto: "total_valor", valor: 1000 },
            { headers: admin }
          )
        ).rejects.toMatchObject({ response: { status: 400 } })
      })

      it("handle já existente → 422", async () => {
        await expect(
          api.post(
            "/admin/conjuntos/curados",
            { nome: "Outro nome", handle: "look-verao", product_ids: [cat.short.productId, cat.macaquinho.productId], tipo_desconto: "total_valor", valor: 1000 },
            { headers: admin }
          )
        ).rejects.toMatchObject({ response: { status: 422 } })
      })

      it("GET /curados lista com a regra embutida", async () => {
        const res = await api.get("/admin/conjuntos/curados", { headers: admin })
        const item = res.data.curados.find((c: any) => c.id === curadoId)
        expect(item.regra.tipo_desconto).toBe("total_valor")
      })

      it("PUT atualiza valor; handle permanece igual; promoção é ressincronizada", async () => {
        const res = await api.put(`/admin/conjuntos/curados/${curadoId}`, { valor: 3000 }, { headers: admin })
        expect(res.data.curado.handle).toBe("look-verao")
        expect(res.data.curado.regra.valor).toBe(3000)
        const promo: any = getContainer().resolve(Modules.PROMOTION)
        const p = await promo.retrievePromotion(promotionId, { relations: ["application_method"] })
        expect(Number(p.application_method.value)).toBeCloseTo(15.0, 2) // 3000 / 2 / 100
      })

      it("DELETE apaga curado, regra e promoção (promoção some)", async () => {
        const res = await api.delete(`/admin/conjuntos/curados/${curadoId}`, { headers: admin })
        expect(res.data).toEqual({ id: curadoId, deleted: true })
        const promo: any = getContainer().resolve(Modules.PROMOTION)
        await expect(promo.retrievePromotion(promotionId)).rejects.toBeTruthy()
      })
    })

    describe("por-produto", () => {
      it("top devolve legging e short como parceiras (mesma coleção, pares ativos)", async () => {
        const res = await api.get(`/admin/conjuntos/por-produto/${cat.top.productId}`, { headers: admin })
        const ids = res.data.parceiras.map((p: any) => p.product_id).sort()
        expect(ids).toEqual([cat.legging.productId, cat.short.productId].sort())
        expect(res.data.curados).toEqual([])
      })
    })

    describe("reconciliar", () => {
      it("devolve contagens de regras e cupons processados", async () => {
        const res = await api.post("/admin/conjuntos/reconciliar", {}, { headers: admin })
        expect(typeof res.data.regras).toBe("number")
        expect(typeof res.data.cupons).toBe("number")
        expect(res.data.regras).toBeGreaterThanOrEqual(2)
      })
    })
  },
})
