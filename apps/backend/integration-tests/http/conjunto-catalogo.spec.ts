// Fix round 1 (Task 6 admin), achado "listarConjuntos/conjuntoPorHandle ficaram sem cobertura":
// testa os dois helpers de catálogo de `catalogo-conjuntos.ts` (Task 6 Step 1) direto pelo
// container, com dados montados pelas próprias rotas admin (mesmo harness dos outros specs).
//
// Nota de ordem canônica: `ConjuntoPar` sempre grava `categoria_a < categoria_b` (CHECK
// `conjunto_par_ordem` no banco, `service.criarPar`/`normalizarPar`) — visto em
// `conjunto-modulo.spec.ts` (`criarPar({categoria_a:"tops",categoria_b:"leggings"})` devolve
// `categoria_a:"leggings", categoria_b:"tops"`). Como "leggings" e "shorts" vêm antes de "tops"
// alfabeticamente, o par CANÔNICO desta base de catálogo é sempre "não-top primeiro, top depois"
// — ex.: `legging-vertice--top-aura`, não `top-aura--legging-vertice`. `conjuntoPorHandle` (fix
// round 1, ordem canônica só) resolve exatamente essa ordem e devolve `null` para a invertida.
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { criarAdmin } from "../helpers/admin"
import { criarCatalogoBase, type CatalogoBase } from "../helpers/catalogo"
import { listarConjuntos, conjuntoPorHandle } from "../../src/modules/beneficio-conjunto/catalogo-conjuntos"

jest.setTimeout(180 * 1000)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  disableAutoTeardown: true,
  testSuite: ({ api, getContainer }) => {
    let admin: Record<string, string>
    let cat: CatalogoBase
    let regraPadraoId: string

    beforeAll(async () => {
      admin = (await criarAdmin(api, getContainer())).headers
      cat = await criarCatalogoBase(api, admin)

      const regra = await api.post(
        "/admin/conjuntos/regras",
        { nome: "Padrão", escopo: "padrao", tipo_desconto: "menor_peca_percentual", valor: 20 },
        { headers: admin }
      )
      regraPadraoId = regra.data.regra.id

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

    describe("listarConjuntos — coleções", () => {
      it("Blackout tem os dois pares canônicos (legging+top, short+top); Lumière ausente (só tem um top)", async () => {
        const { colecoes, curados } = await listarConjuntos(getContainer())
        expect(curados).toEqual([])

        const black = colecoes.find((c) => c.collection_id === cat.collections.black)
        expect(black).toBeTruthy()
        expect(colecoes.find((c) => c.collection_id === cat.collections.lum)).toBeUndefined()

        const handles = black!.pares.map((p) => p.handle).sort()
        expect(handles).toEqual(["legging-vertice--top-aura", "short-nimble--top-aura"].sort())

        const parLegging = black!.pares.find((p) => p.handle === "legging-vertice--top-aura")!
        expect(parLegging.product_ids).toEqual([cat.legging.productId, cat.top.productId])
        const parShort = black!.pares.find((p) => p.handle === "short-nimble--top-aura")!
        expect(parShort.product_ids).toEqual([cat.short.productId, cat.top.productId])

        expect(black!.regra.tipo_desconto).toBe("menor_peca_percentual")
        expect(black!.regra.valor).toBe(20)
      })

      it("regra padrão inativa → colecoes vazio", async () => {
        await api.put(`/admin/conjuntos/regras/${regraPadraoId}`, { ativa: false }, { headers: admin })
        const { colecoes } = await listarConjuntos(getContainer())
        expect(colecoes).toEqual([])
      })

      it("exceção por coleção ativa para Blackout → volta a aparecer, com a regra da exceção", async () => {
        await api.post(
          "/admin/conjuntos/regras",
          { nome: "Exceção Blackout", escopo: "colecao", collection_id: cat.collections.black, tipo_desconto: "total_valor", valor: 5000, ativa: true },
          { headers: admin }
        )
        const { colecoes } = await listarConjuntos(getContainer())
        expect(colecoes).toHaveLength(1)
        expect(colecoes[0].collection_id).toBe(cat.collections.black)
        expect(colecoes[0].regra).toEqual({ tipo_desconto: "total_valor", valor: 5000 })
      })
    })

    describe("conjuntoPorHandle — par de coleção", () => {
      it("ordem canônica (legging--top) resolve; invertida (top--legging) e sem par (top--macaquinho) dão null", async () => {
        const canonico = await conjuntoPorHandle(getContainer(), "legging-vertice--top-aura")
        expect(canonico).toMatchObject({ tipo: "colecao" })
        expect(canonico!.product_ids.sort()).toEqual([cat.legging.productId, cat.top.productId].sort())

        expect(await conjuntoPorHandle(getContainer(), "top-aura--legging-vertice")).toBeNull()
        expect(await conjuntoPorHandle(getContainer(), "top-aura--macaquinho-vero")).toBeNull()
      })
    })

    describe("conjuntoPorHandle — curado", () => {
      let curadoHandle: string

      it("curado criado pela rota admin aparece em listarConjuntos().curados e resolve por handle", async () => {
        const res = await api.post(
          "/admin/conjuntos/curados",
          { nome: "Trio Vero", product_ids: [cat.macaquinho.productId, cat.topLum.productId], tipo_desconto: "total_valor", valor: 3000 },
          { headers: admin }
        )
        curadoHandle = res.data.curado.handle

        const { curados } = await listarConjuntos(getContainer())
        expect(curados.some((c) => c.handle === curadoHandle)).toBe(true)

        const resolvido = await conjuntoPorHandle(getContainer(), curadoHandle)
        expect(resolvido).toMatchObject({ tipo: "curado" })
        expect(resolvido!.product_ids.sort()).toEqual([cat.macaquinho.productId, cat.topLum.productId].sort())
      })

      it("produto do curado despublicado → some da lista e resolve null", async () => {
        await api.post(`/admin/products/${cat.macaquinho.productId}`, { status: "draft" }, { headers: admin })

        const { curados } = await listarConjuntos(getContainer())
        expect(curados.some((c) => c.handle === curadoHandle)).toBe(false)

        expect(await conjuntoPorHandle(getContainer(), curadoHandle)).toBeNull()
      })
    })
  },
})
