// Aceite da F1 do frete (spec 2026-09-18-frete-superfrete-design.md §7): do carrinho ao preço do
// frete pela Store API, com a SuperFrete SIMULADA por um servidor HTTP local. Nenhuma credencial real.
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { AxiosInstance } from "axios"
import { criarAdmin } from "../helpers/admin"
import { criarCatalogoBase, type CatalogoBase } from "../helpers/catalogo"
import { zerarCotador } from "../../src/modules/superfrete/cotador"

jest.setTimeout(240 * 1000)

const PROVIDER = "superfrete_superfrete"
let foraDoAr = false
let chamadas = 0
let servidor: Server

// O medusa-config só registra o provider se SUPERFRETE_TOKEN existir quando é lido: as variáveis
// entram no process.env ANTES do runner subir o app. CEP de origem fictício (o real nunca entra no repo).
function subirSuperfreteSimulada(): Promise<void> {
  servidor = createServer((req, res) => {
    chamadas++
    if (foraDoAr || req.url !== "/api/v0/calculator") {
      res.writeHead(503).end("{}")
      return
    }
    res.writeHead(200, { "content-type": "application/json" }).end(
      JSON.stringify([
        { id: 1, name: "PAC", price: 14.3, delivery_time: 6, delivery_range: { min: 5, max: 6 }, has_error: false },
        { id: 2, name: "SEDEX", price: 22.1, delivery_time: 2, delivery_range: { min: 1, max: 2 }, has_error: false },
        { id: 17, name: "Mini Envios", price: 9.9, delivery_time: 8, delivery_range: { min: 6, max: 8 }, has_error: false },
      ])
    )
  })
  return new Promise((ok) =>
    servidor.listen(0, "127.0.0.1", () => {
      process.env.SUPERFRETE_TOKEN = "token-de-teste"
      process.env.SUPERFRETE_CONTACT_EMAIL = "teste@example.com"
      process.env.SUPERFRETE_FROM_POSTAL_CODE = "01001000"
      process.env.SUPERFRETE_BASE_URL = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`
      ok()
    })
  )
}

const pronto = subirSuperfreteSimulada()

medusaIntegrationTestRunner({
  // Sem isto o runner faz TRUNCATE no banco inteiro depois de CADA it() (ver
  // node_modules/@medusajs/test-utils dist/medusa-test-runner.js `afterEach`/`beforeEach`), o que
  // apagaria o catálogo, as stock locations e as shipping options montadas uma única vez no
  // beforeAll — exatamente o padrão que conjunto-cupom.spec.ts e conjunto-carrinho.spec.ts já usam
  // por este motivo. Desvio do literal do brief, ver task-8-report.md.
  inApp: true,
  env: {},
  disableAutoTeardown: true,
  testSuite: ({ api, getContainer }) => {
    let admin: Record<string, string>
    let cat: CatalogoBase
    const opcoes: Record<string, string> = {}

    beforeAll(async () => {
      await pronto
      admin = (await criarAdmin(api, getContainer())).headers
      cat = await criarCatalogoBase(api, admin)
      const h = { headers: admin }
      const local = (await api.post("/admin/stock-locations", { name: "CD teste" }, h)).data.stock_location
      await api.post(`/admin/stock-locations/${local.id}/sales-channels`, { add: [cat.salesChannelId] }, h)
      await api.post(`/admin/stock-locations/${local.id}/fulfillment-providers`, { add: [PROVIDER] }, h)
      const comSet = (await api.post(`/admin/stock-locations/${local.id}/fulfillment-sets?fields=*fulfillment_sets`, { name: "Envio teste", type: "shipping" }, h)).data.stock_location
      const comZona = (await api.post(`/admin/fulfillment-sets/${comSet.fulfillment_sets[0].id}/service-zones`, { name: "Brasil", geo_zones: [{ type: "country", country_code: "br" }] }, h)).data.fulfillment_set
      const perfil = (await api.post("/admin/shipping-profiles", { name: "Padrão teste", type: "default" }, h)).data.shipping_profile
      for (const peca of [cat.top, cat.legging, cat.short, cat.macaquinho]) {
        await api.post(`/admin/products/${peca.productId}`, { shipping_profile_id: perfil.id }, h)
      }
      for (const [id, nome] of [["mini", "Econômica (Mini Envios)"], ["pac", "PAC"], ["sedex", "SEDEX"]]) {
        const criada = (
          await api.post(
            "/admin/shipping-options",
            {
              name: nome,
              service_zone_id: comZona.service_zones[0].id,
              shipping_profile_id: perfil.id,
              provider_id: PROVIDER,
              price_type: "calculated",
              data: { id },
              type: { label: nome, description: nome, code: id },
              prices: [],
              rules: [
                { attribute: "enabled_in_store", value: "true", operator: "eq" },
                { attribute: "is_return", value: "false", operator: "eq" },
              ],
            },
            h
          )
        ).data.shipping_option
        opcoes[id] = criada.id
      }
    })

    afterAll(() => servidor.close())

    beforeEach(() => {
      foraDoAr = false
      zerarCotador()
    })

    async function carrinho(linhas: { variantId: string; quantity: number }[], uf = "MG") {
      const cart = (await api.post("/store/carts", { region_id: cat.regionId, sales_channel_id: cat.salesChannelId }, { headers: cat.storeHeaders })).data.cart
      for (const l of linhas) {
        await api.post(`/store/carts/${cart.id}/line-items`, { variant_id: l.variantId, quantity: l.quantity }, { headers: cat.storeHeaders })
      }
      await api.post(
        `/store/carts/${cart.id}`,
        { email: "cliente@example.com", shipping_address: { first_name: "Ana", last_name: "Teste", address_1: "Rua Um", city: "Belo Horizonte", province: uf, postal_code: "30130-010", country_code: "br" } },
        { headers: cat.storeHeaders }
      )
      return cart.id as string
    }

    async function preco(api: AxiosInstance, cartId: string, servico: string): Promise<number | null> {
      const r = await api
        .post(`/store/shipping-options/${opcoes[servico]}/calculate`, { cart_id: cartId }, { headers: cat.storeHeaders })
        .catch((e) => e.response)
      return r.status === 200 ? r.data.shipping_option.amount : null
    }

    it("abaixo do piso: preço normal; 1 peça de 300 g não tem Mini Envios", async () => {
      const id = await carrinho([{ variantId: cat.top.variantId, quantity: 1 }])
      expect(await preco(api, id, "pac")).toBe(16.9)
      expect(await preco(api, id, "sedex")).toBe(24.9)
      expect(await preco(api, id, "mini")).toBeNull()
    })

    it("as três opções de uma tela custam UMA ida à SuperFrete", async () => {
      const id = await carrinho([{ variantId: cat.short.variantId, quantity: 1 }])
      const antes = chamadas
      await Promise.all(["mini", "pac", "sedex"].map((s) => preco(api, id, s)))
      expect(chamadas - antes).toBe(1)
    })

    it("MG acima de R$ 499: PAC grátis e SEDEX cobra a diferença; SP com o mesmo carrinho paga", async () => {
      const linhas = [{ variantId: cat.legging.variantId, quantity: 2 }] // 518,00
      const mg = await carrinho(linhas, "MG")
      expect(await preco(api, mg, "pac")).toBe(0)
      expect(await preco(api, mg, "sedex")).toBe(8)
      const sp = await carrinho(linhas, "SP")
      expect(await preco(api, sp, "pac")).toBe(16.9)
    })

    it("o piso olha o valor JÁ COM desconto: cupom derruba o frete grátis", async () => {
      await api.post(
        "/admin/promotions",
        {
          code: "FRETE10TESTE",
          type: "standard",
          is_automatic: false,
          status: "active",
          application_method: { type: "percentage", target_type: "items", allocation: "each", max_quantity: 1000, value: 10, currency_code: "brl" },
        },
        { headers: admin }
      )
      const id = await carrinho([{ variantId: cat.legging.variantId, quantity: 2 }], "MG") // 518,00 → grátis
      expect(await preco(api, id, "pac")).toBe(0)
      await api.post(`/store/carts/${id}/promotions`, { promo_codes: ["FRETE10TESTE"] }, { headers: cat.storeHeaders }) // 466,20
      expect(await preco(api, id, "pac")).toBe(16.9)
    })

    it("tirar peça depois de escolher o frete recalcula o método já escolhido", async () => {
      const id = await carrinho([{ variantId: cat.legging.variantId, quantity: 2 }], "MG")
      await api.post(`/store/carts/${id}/shipping-methods`, { option_id: opcoes.pac }, { headers: cat.storeHeaders })
      let cart = (await api.get(`/store/carts/${id}`, { headers: cat.storeHeaders })).data.cart
      expect(cart.shipping_methods[0].amount).toBe(0)

      await api.post(`/store/carts/${id}/line-items/${cart.items[0].id}`, { quantity: 1 }, { headers: cat.storeHeaders })
      cart = (await api.get(`/store/carts/${id}`, { headers: cat.storeHeaders })).data.cart
      expect(cart.shipping_methods[0].amount).toBe(16.9)
    })

    it("o método de envio guarda serviço, pacote e prazo calculados no servidor", async () => {
      const id = await carrinho([{ variantId: cat.top.variantId, quantity: 1 }])
      await api.post(`/store/carts/${id}/shipping-methods`, { option_id: opcoes.sedex, data: { servico: 999 } }, { headers: cat.storeHeaders })
      const cart = (await api.get(`/store/carts/${id}?fields=*shipping_methods`, { headers: cat.storeHeaders })).data.cart
      expect(cart.shipping_methods[0].data).toEqual({
        servico: 2,
        pacote: { pecas: 1, largura: 15, altura: 5, comprimento: 15, peso_kg: 0.31 },
        prazo_min: 1,
        prazo_max: 2,
      })
    })

    it("SuperFrete fora do ar: só PAC, por R$ 24,90", async () => {
      foraDoAr = true
      const id = await carrinho([{ variantId: cat.top.variantId, quantity: 1 }])
      expect(await preco(api, id, "pac")).toBe(24.9)
      expect(await preco(api, id, "sedex")).toBeNull()
    })

    it("GET /store/frete/regras devolve os pisos em centavos", async () => {
      const r = await api.get("/store/frete/regras", { headers: cat.storeHeaders })
      expect(r.data).toEqual({ piso_mg: 49900, piso_brasil: 59900 })
    })

    it("GET /store/frete/prazos devolve o prazo por serviço aplicável", async () => {
      const id = await carrinho([{ variantId: cat.top.variantId, quantity: 1 }])
      const r = await api.get(`/store/frete/prazos?cart_id=${id}`, { headers: cat.storeHeaders })
      expect(r.data).toEqual({ prazos: { pac: { min: 5, max: 6 }, sedex: { min: 1, max: 2 } } })
    })

    it("prazos sem CEP ou com a SuperFrete fora do ar voltam vazios, nunca erro", async () => {
      const cart = (await api.post("/store/carts", { region_id: cat.regionId, sales_channel_id: cat.salesChannelId }, { headers: cat.storeHeaders })).data.cart
      await api.post(`/store/carts/${cart.id}/line-items`, { variant_id: cat.top.variantId, quantity: 1 }, { headers: cat.storeHeaders })
      expect((await api.get(`/store/frete/prazos?cart_id=${cart.id}`, { headers: cat.storeHeaders })).data).toEqual({ prazos: {} })
    })
  },
})
