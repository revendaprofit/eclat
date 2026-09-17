// Aceite da F1 da Parte 4 (spec 2026-09-17-pagamento-mercadopago-design.md §14): pagamento no
// SANDBOX REAL do Mercado Pago vira pedido pago no Medusa — pela Store API, do carrinho ao pedido.
//
// Este spec fala com a API de verdade do Mercado Pago. Só roda se as credenciais DE TESTE estiverem
// em apps/backend/.env (MERCADOPAGO_ACCESS_TOKEN + MERCADOPAGO_PUBLIC_KEY); sem elas a suíte é
// pulada inteira — nunca falha por falta de segredo, nunca usa credencial de produção.
import { createHmac } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { AxiosInstance } from "axios"
import { criarAdmin } from "../helpers/admin"
import { criarCatalogoBase, type CatalogoBase } from "../helpers/catalogo"

const SEGREDO_WEBHOOK_DE_TESTE = "segredo-webhook-do-teste-de-integracao"
const PROVIDER = "pp_mercadopago_mercadopago"
const CPF_TESTE = "12345678909"

// O medusa-config só registra o provider se MERCADOPAGO_ACCESS_TOKEN existir QUANDO ele é lido —
// por isso as variáveis entram no process.env aqui, antes do runner subir o app.
function carregarCredenciaisDeTeste(): boolean {
  const caminho = join(process.cwd(), ".env")
  if (!existsSync(caminho)) return false
  for (const linha of readFileSync(caminho, "utf8").split(/\r?\n/)) {
    const m = linha.match(/^(MERCADOPAGO_[A-Z_]+)=(.+)$/)
    if (m) process.env[m[1]] = m[2].trim()
  }
  process.env.MERCADOPAGO_WEBHOOK_SECRET = SEGREDO_WEBHOOK_DE_TESTE
  return !!process.env.MERCADOPAGO_ACCESS_TOKEN && !!process.env.MERCADOPAGO_PUBLIC_KEY
}

const temCredenciais = carregarCredenciaisDeTeste()
const suite = temCredenciais ? medusaIntegrationTestRunner : () => describe.skip("pagamento mercadopago (sem credenciais de teste no .env)", () => it("pulado", () => {}))

jest.setTimeout(240 * 1000)

/** Em produção quem tokeniza é o Brick, no navegador. Cartão de TESTE público da doc do MP. */
async function tokenDeCartao(titular: string): Promise<string> {
  const res = await fetch(`https://api.mercadopago.com/v1/card_tokens?public_key=${process.env.MERCADOPAGO_PUBLIC_KEY}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      card_number: "5480832801033311",
      security_code: "123",
      expiration_month: 11,
      expiration_year: 2030,
      cardholder: { name: titular, identification: { type: "CPF", number: CPF_TESTE } },
    }),
  })
  const dados = (await res.json()) as { id?: string }
  if (!dados.id) throw new Error(`não deu pra tokenizar o cartão de teste (HTTP ${res.status})`)
  return dados.id
}

/** Frete mínimo pra um carrinho poder ser concluído: local de estoque, zona Brasil, opção manual. */
async function montarFrete(api: AxiosInstance, admin: Record<string, string>, cat: CatalogoBase): Promise<string> {
  const h = { headers: admin }
  const local = (await api.post("/admin/stock-locations", { name: "CD teste" }, h)).data.stock_location
  await api.post(`/admin/stock-locations/${local.id}/sales-channels`, { add: [cat.salesChannelId] }, h)
  await api.post(`/admin/stock-locations/${local.id}/fulfillment-providers`, { add: ["manual_manual"] }, h)
  const comSet = (await api.post(`/admin/stock-locations/${local.id}/fulfillment-sets?fields=*fulfillment_sets`, { name: "Envio teste", type: "shipping" }, h)).data.stock_location
  const setId = comSet.fulfillment_sets[0].id
  const comZona = (await api.post(`/admin/fulfillment-sets/${setId}/service-zones`, { name: "Brasil", geo_zones: [{ type: "country", country_code: "br" }] }, h)).data.fulfillment_set
  const perfil = (await api.post("/admin/shipping-profiles", { name: "Padrão teste", type: "default" }, h)).data.shipping_profile
  for (const peca of [cat.top, cat.legging]) {
    await api.post(`/admin/products/${peca.productId}`, { shipping_profile_id: perfil.id }, h)
  }
  const opcao = (
    await api.post(
      "/admin/shipping-options",
      {
        name: "Envio padrão",
        service_zone_id: comZona.service_zones[0].id,
        shipping_profile_id: perfil.id,
        provider_id: "manual_manual",
        price_type: "flat",
        type: { label: "Padrão", description: "Envio de teste", code: "padrao" },
        prices: [{ currency_code: "brl", amount: 24.9 }],
        rules: [],
      },
      h
    )
  ).data.shipping_option
  return opcao.id
}

suite({
  inApp: true,
  env: {},
  disableAutoTeardown: true,
  testSuite: ({ api, getContainer }) => {
    let admin: Record<string, string>
    let cat: CatalogoBase
    let opcaoDeFreteId: string

    async function carrinhoProntoPraPagar(): Promise<{ id: string; total: number; colecaoId: string }> {
      const endereco = { first_name: "Cliente", last_name: "Teste", address_1: "Rua Um, 100", city: "Belo Horizonte", province: "MG", postal_code: "30130000", country_code: "br", phone: "31999990000" }
      const criado = (
        await api.post(
          "/store/carts",
          { region_id: cat.regionId, sales_channel_id: cat.salesChannelId, email: "test_user_br@testuser.com", shipping_address: endereco, billing_address: endereco, metadata: { cpf: CPF_TESTE } },
          { headers: cat.storeHeaders }
        )
      ).data.cart
      await api.post(`/store/carts/${criado.id}/line-items`, { variant_id: cat.top.variantId, quantity: 1 }, { headers: cat.storeHeaders })
      const comFrete = (await api.post(`/store/carts/${criado.id}/shipping-methods`, { option_id: opcaoDeFreteId }, { headers: cat.storeHeaders })).data.cart
      const colecao = (await api.post("/store/payment-collections", { cart_id: criado.id }, { headers: cat.storeHeaders })).data.payment_collection
      return { id: criado.id, total: Number(comFrete.total), colecaoId: colecao.id }
    }

    async function abrirSessao(colecaoId: string, data: Record<string, unknown>) {
      const res = await api.post(`/store/payment-collections/${colecaoId}/payment-sessions`, { provider_id: PROVIDER, data }, { headers: cat.storeHeaders })
      return res.data.payment_collection.payment_sessions.find((s: any) => s.provider_id === PROVIDER)
    }

    beforeAll(async () => {
      admin = (await criarAdmin(api, getContainer())).headers
      cat = await criarCatalogoBase(api, admin)
      await api.post(`/admin/regions/${cat.regionId}`, { payment_providers: [PROVIDER] }, { headers: admin })
      opcaoDeFreteId = await montarFrete(api, admin, cat)
    })

    it("o provider aparece como meio de pagamento da região Brasil", async () => {
      const res = await api.get(`/store/payment-providers?region_id=${cat.regionId}`, { headers: cat.storeHeaders })
      expect(res.data.payment_providers.map((p: any) => p.id)).toContain(PROVIDER)
    })

    it("Pix: a sessão devolve o QR, e o carrinho NÃO vira pedido enquanto o Pix não é pago (D1)", async () => {
      const carrinho = await carrinhoProntoPraPagar()
      const sessao = await abrirSessao(carrinho.colecaoId, { metodo: "pix", cpf: CPF_TESTE, email: "test_user_br@testuser.com", nomeTitular: "APRO" })

      expect(sessao.data.metodo).toBe("pix")
      expect(sessao.data.qr_code).toEqual(expect.any(String))
      expect(sessao.data.qr_code_base64).toEqual(expect.any(String))
      expect(Number(sessao.data.valor_total)).toBeCloseTo(carrinho.total, 2)
      const minutosAteExpirar = (new Date(sessao.data.expira_em).getTime() - Date.now()) / 60000
      expect(minutosAteExpirar).toBeGreaterThan(25)
      expect(minutosAteExpirar).toBeLessThan(35)

      const tentativa = await api.post(`/store/carts/${carrinho.id}/complete`, {}, { headers: cat.storeHeaders, validateStatus: () => true })
      // Com o Pix pendente o Medusa responde erro `not_allowed` ("was not authorized with the
      // provider") — é isso que a consulta periódica da vitrine recebe enquanto espera.
      expect(tentativa.data.type).toBe("not_allowed")
      const cart = (await api.get(`/store/carts/${carrinho.id}?fields=id,completed_at`, { headers: cat.storeHeaders })).data.cart
      expect(cart.completed_at).toBeNull()
    })

    it("Cartão aprovado: sessão → complete → pedido com pagamento capturado e tarifa real gravada", async () => {
      const carrinho = await carrinhoProntoPraPagar()
      const token = await tokenDeCartao("APRO")
      const sessao = await abrirSessao(carrinho.colecaoId, { metodo: "cartao", cpf: CPF_TESTE, email: "test_user_br@testuser.com", nomeTitular: "APRO", token, bandeira: "master", parcelas: 1 })

      expect(sessao.data.status_mp).toBe("processed")

      const concluido = await api.post(`/store/carts/${carrinho.id}/complete`, {}, { headers: cat.storeHeaders })
      expect(concluido.data.type).toBe("order")

      const pedido = (await api.get(`/admin/orders/${concluido.data.order.id}?fields=id,payment_status,*payment_collections.payments`, { headers: admin })).data.order
      expect(pedido.payment_status).toBe("captured")
      const pagamento = pedido.payment_collections[0].payments[0]
      expect(pagamento.data.mp_order_id).toEqual(expect.any(String))
      expect(pagamento.data.metodo).toBe("cartao")
      expect(pagamento.data.tarifa_centavos).toBeGreaterThan(0)
    })

    it("Cartão recusado: sessão em erro com mensagem em pt-BR, e o carrinho não vira pedido", async () => {
      const carrinho = await carrinhoProntoPraPagar()
      const token = await tokenDeCartao("FUND")
      const sessao = await abrirSessao(carrinho.colecaoId, { metodo: "cartao", cpf: CPF_TESTE, email: "test_user_br@testuser.com", nomeTitular: "FUND", token, bandeira: "master", parcelas: 1 })

      expect(sessao.status).toBe("error")
      expect(sessao.data.mensagem_recusa).toMatch(/limite/)

      const tentativa = await api.post(`/store/carts/${carrinho.id}/complete`, {}, { headers: cat.storeHeaders, validateStatus: () => true })
      expect(tentativa.data.type).not.toBe("order")
    })

    it("Webhook: pagamento aprovado + notificação assinada conclui o carrinho sozinho (cliente fechou a aba)", async () => {
      const carrinho = await carrinhoProntoPraPagar()
      const token = await tokenDeCartao("APRO")
      const sessao = await abrirSessao(carrinho.colecaoId, { metodo: "cartao", cpf: CPF_TESTE, email: "test_user_br@testuser.com", nomeTitular: "APRO", token, bandeira: "master", parcelas: 1 })
      const orderId = sessao.data.mp_order_id as string

      const ts = String(Date.now())
      const v1 = createHmac("sha256", SEGREDO_WEBHOOK_DE_TESTE).update(`id:${orderId.toLowerCase()};request-id:req-teste;ts:${ts};`).digest("hex")
      const resposta = await api.post(
        `/hooks/payment/mercadopago_mercadopago?data.id=${orderId}&type=order`,
        { action: "order.processed", type: "order", data: { id: orderId } },
        { headers: { "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": "req-teste" } }
      )
      expect(resposta.status).toBe(200)

      // O Medusa processa o webhook com atraso de propósito (5 s) — espera até 40 s pelo pedido.
      let completado = false
      for (let i = 0; i < 20 && !completado; i++) {
        await new Promise((r) => setTimeout(r, 2000))
        const cart = (await api.get(`/store/carts/${carrinho.id}?fields=id,completed_at`, { headers: cat.storeHeaders })).data.cart
        completado = !!cart.completed_at
      }
      expect(completado).toBe(true)

      // A vitrine consulta o pagamento chamando `complete` de novo: num carrinho que o webhook já
      // concluiu, isso tem que devolver o MESMO pedido (é assim que a tela de Pix descobre o pedido).
      const deNovo = await api.post(`/store/carts/${carrinho.id}/complete`, {}, { headers: cat.storeHeaders })
      expect(deNovo.data.type).toBe("order")
    })

    it("Webhook com assinatura inválida é ignorado (carrinho segue aberto)", async () => {
      const carrinho = await carrinhoProntoPraPagar()
      const token = await tokenDeCartao("APRO")
      const sessao = await abrirSessao(carrinho.colecaoId, { metodo: "cartao", cpf: CPF_TESTE, email: "test_user_br@testuser.com", nomeTitular: "APRO", token, bandeira: "master", parcelas: 1 })

      await api.post(
        `/hooks/payment/mercadopago_mercadopago`,
        { action: "order.processed", type: "order", data: { id: sessao.data.mp_order_id } },
        { headers: { "x-signature": "ts=1,v1=00", "x-request-id": "req-falso" } }
      )
      await new Promise((r) => setTimeout(r, 9000))
      const cart = (await api.get(`/store/carts/${carrinho.id}?fields=id,completed_at`, { headers: cat.storeHeaders })).data.cart
      expect(cart.completed_at).toBeNull()
    })
  },
} as any)
