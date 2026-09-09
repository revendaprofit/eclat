// Rotas store do Benefício Conjunto (Task 7 Step 2): vitrine (`/store/conjuntos`), página do
// conjunto por handle canônico, parceiras por produto e oportunidades por carrinho. Mesmo harness
// e base de dados dos specs de Task 6 (`conjunto-catalogo.spec.ts`): regra padrão ativa
// (menor_peca_percentual 20%) + pares leggings-tops e shorts-tops, catálogo Blackout/Lumière.
//
// Ordem canônica do handle (ver nota em conjunto-catalogo.spec.ts): "leggings" e "shorts" vêm
// antes de "tops" alfabeticamente, então os pares desta base são sempre "não-top primeiro, top
// depois" — `legging-vertice--top-aura` e `short-nimble--top-aura`, nunca invertidos.
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
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

      await api.post(
        "/admin/conjuntos/regras",
        { nome: "Padrão", escopo: "padrao", tipo_desconto: "menor_peca_percentual", valor: 20 },
        { headers: admin }
      )

      await api.put(
        "/admin/conjuntos/pares",
        {
          pares: [
            { categoria_a: "leggings", categoria_b: "tops" },
            { categoria_a: "shorts", categoria_b: "tops" },
          ],
        },
        { headers: admin }
      )
    })

    async function novoCarrinho(linhas: { variantId: string; quantity: number }[]) {
      const cart = (
        await api.post("/store/carts", { region_id: cat.regionId, sales_channel_id: cat.salesChannelId }, { headers: cat.storeHeaders })
      ).data.cart
      for (const l of linhas) {
        await api.post(`/store/carts/${cart.id}/line-items`, { variant_id: l.variantId, quantity: l.quantity }, { headers: cat.storeHeaders })
      }
      return cart.id as string
    }

    describe("GET /store/conjuntos", () => {
      it("lista a coleção Blackout com os dois pares canônicos; Lumière ausente; cache 300s", async () => {
        const res = await api.get("/store/conjuntos", { headers: cat.storeHeaders })
        expect(res.status).toBe(200)
        expect(res.headers["cache-control"]).toBe("public, s-maxage=300, stale-while-revalidate=600")

        expect(res.data.curados).toEqual([])

        const black = res.data.colecoes.find((c: any) => c.collection_id === cat.collections.black)
        expect(black).toBeTruthy()
        expect(res.data.colecoes.find((c: any) => c.collection_id === cat.collections.lum)).toBeUndefined()

        const handles = black.pares.map((p: any) => p.handle).sort()
        expect(handles).toEqual(["legging-vertice--top-aura", "short-nimble--top-aura"].sort())
        expect(black.regra).toEqual({ tipo_desconto: "menor_peca_percentual", valor: 20 })
      })
    })

    describe("GET /store/conjuntos/:handle", () => {
      it("handle canônico → 200 com os 2 ids e a regra; capa_url null (par de coleção não tem capa); cache 300s", async () => {
        const res = await api.get("/store/conjuntos/legging-vertice--top-aura", { headers: cat.storeHeaders })
        expect(res.status).toBe(200)
        expect(res.headers["cache-control"]).toBe("public, s-maxage=300, stale-while-revalidate=600")
        expect(res.data.conjunto).toMatchObject({
          tipo: "colecao",
          handle: "legging-vertice--top-aura",
          capa_url: null,
          regra: { tipo_desconto: "menor_peca_percentual", valor: 20 },
        })
        expect(res.data.conjunto.product_ids.sort()).toEqual([cat.legging.productId, cat.top.productId].sort())
      })

      it("handle invertido → 404", async () => {
        await expect(api.get("/store/conjuntos/top-aura--legging-vertice", { headers: cat.storeHeaders })).rejects.toMatchObject({
          response: { status: 404 },
        })
      })

      it("handle inexistente → 404", async () => {
        await expect(api.get("/store/conjuntos/nada-aqui", { headers: cat.storeHeaders })).rejects.toMatchObject({
          response: { status: 404 },
        })
      })

      it("curado com capa_url → 200 devolve a mesma capa_url gravada na criação", async () => {
        const criado = await api.post(
          "/admin/conjuntos/curados",
          {
            nome: "Trio Vero Store",
            capa_url: "https://exemplo.test/capa.jpg",
            product_ids: [cat.macaquinho.productId, cat.topLum.productId],
            tipo_desconto: "total_valor",
            valor: 3000,
          },
          { headers: admin }
        )
        const handle = criado.data.curado.handle

        const res = await api.get(`/store/conjuntos/${handle}`, { headers: cat.storeHeaders })
        expect(res.status).toBe(200)
        expect(res.data.conjunto).toMatchObject({
          tipo: "curado",
          handle,
          capa_url: "https://exemplo.test/capa.jpg",
        })
      })
    })

    describe("GET /store/conjuntos/por-produto/:product_id", () => {
      it("parceiras do top: legging e short; cache 300s", async () => {
        const res = await api.get(`/store/conjuntos/por-produto/${cat.top.productId}`, { headers: cat.storeHeaders })
        expect(res.status).toBe(200)
        expect(res.headers["cache-control"]).toBe("public, s-maxage=300, stale-while-revalidate=600")

        const ids = res.data.parceiras.map((p: any) => p.product_id).sort()
        expect(ids).toEqual([cat.legging.productId, cat.short.productId].sort())

        const legging = res.data.parceiras.find((p: any) => p.product_id === cat.legging.productId)
        expect(legging.categoria_raiz).toBe("leggings")
        const short = res.data.parceiras.find((p: any) => p.product_id === cat.short.productId)
        expect(short.categoria_raiz).toBe("shorts")
      })
    })

    describe("GET /store/conjuntos/oportunidades", () => {
      it("cart_id ausente → 400", async () => {
        await expect(api.get("/store/conjuntos/oportunidades", { headers: cat.storeHeaders })).rejects.toMatchObject({
          response: { status: 400 },
        })
      })

      it("carrinho inexistente → 404", async () => {
        await expect(
          api.get("/store/conjuntos/oportunidades?cart_id=cart_naoexiste", { headers: cat.storeHeaders })
        ).rejects.toMatchObject({ response: { status: 404 } })
      })

      it("top×1 + legging×2 → falta top (sobra uma legging); candidatos inclui o top; no-store", async () => {
        const cartId = await novoCarrinho([
          { variantId: cat.top.variantId, quantity: 1 },
          { variantId: cat.legging.variantId, quantity: 2 },
        ])

        const res = await api.get(`/store/conjuntos/oportunidades?cart_id=${cartId}`, { headers: cat.storeHeaders })
        expect(res.status).toBe(200)
        expect(res.headers["cache-control"]).toBe("no-store")

        const oportunidade = res.data.oportunidades.find((o: any) => o.categoria_faltante === "tops")
        expect(oportunidade).toBeTruthy()
        expect(oportunidade.collection_id).toBe(cat.collections.black)
        expect(oportunidade.candidatos).toContain(cat.top.productId)
        expect(oportunidade.candidatos.length).toBeLessThanOrEqual(3)

        expect(res.data.conjuntos).toHaveLength(1)
      })
    })
  },
})
