// Integração com transportadora — PREPARADA (Melhor Envio: agrega Correios + transportadoras).
// Sem credenciais, o cockpit opera no modo MANUAL (operador digita o rastreio).
// Para ativar, definir no .env.local (ver architecture/envios.md):
//   MELHOR_ENVIO_TOKEN=...            (Bearer token da conta)
//   MELHOR_ENVIO_SANDBOX=true|false   (default true)
//   MELHOR_ENVIO_SERVICE=1            (id do serviço: 1=Correios PAC, 2=SEDEX, etc.)
//   MELHOR_ENVIO_FROM_*              (origem: postal_code, address, number, city, state, name, phone, document)
//
// Fluxo Melhor Envio p/ gerar etiqueta:
//   1) POST /api/v2/me/cart            → adiciona o frete ao carrinho (from/to/volumes/service)
//   2) POST /api/v2/me/shipment/checkout {orders:[id]}  → paga com o saldo
//   3) POST /api/v2/me/shipment/generate {orders:[id]}  → emite a etiqueta
//   4) POST /api/v2/me/shipment/print    {orders:[id]}  → URL do PDF
//      + o item já traz o tracking (código dos Correios/transportadora)

const TOKEN = process.env.MELHOR_ENVIO_TOKEN
const SANDBOX = (process.env.MELHOR_ENVIO_SANDBOX ?? "true") !== "false"
const SERVICE = process.env.MELHOR_ENVIO_SERVICE || "1"
const BASE = SANDBOX
  ? "https://sandbox.melhorenvio.com.br"
  : "https://melhorenvio.com.br"

export const CARRIER_NAME = "Melhor Envio"
export const carrierConfigured = () => Boolean(TOKEN)

export type CarrierLabel = {
  tracking_number: string
  tracking_url: string
  label_url: string
}

type Destino = {
  nome: string
  telefone: string | null
  endereco: string | null
  cidade: string | null
  estado: string | null
  cep: string | null
}

class CarrierNotConfigured extends Error {
  constructor() {
    super(
      "Integração com transportadora ainda não configurada. Defina MELHOR_ENVIO_TOKEN no .env.local (ver architecture/envios.md). Use o rastreio manual por enquanto."
    )
    this.name = "CarrierNotConfigured"
  }
}

async function me(path: string, init: RequestInit = {}) {
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "use.ECLAT Cockpit (leobergconsultoria@gmail.com)",
      ...(init.headers || {}),
    },
  })
  if (!r.ok) throw new Error(`Melhor Envio ${path} → HTTP ${r.status}: ${await r.text()}`)
  return r.json()
}

// Gera a etiqueta para um pedido e devolve o rastreio + URL do PDF.
// Lança CarrierNotConfigured se faltar credencial (a UI cai no modo manual).
export async function carrierCreateLabel(input: {
  destino: Destino
  // peso/dimensões padrão da peça (configuráveis depois por produto)
  peso_kg?: number
}): Promise<CarrierLabel> {
  if (!carrierConfigured()) throw new CarrierNotConfigured()

  const from = {
    postal_code: process.env.MELHOR_ENVIO_FROM_POSTAL_CODE,
    address: process.env.MELHOR_ENVIO_FROM_ADDRESS,
    number: process.env.MELHOR_ENVIO_FROM_NUMBER,
    city: process.env.MELHOR_ENVIO_FROM_CITY,
    state_abbr: process.env.MELHOR_ENVIO_FROM_STATE,
    name: process.env.MELHOR_ENVIO_FROM_NAME,
    phone: process.env.MELHOR_ENVIO_FROM_PHONE,
    document: process.env.MELHOR_ENVIO_FROM_DOCUMENT,
  }
  if (!from.postal_code)
    throw new Error("Defina o endereço de origem (MELHOR_ENVIO_FROM_*) no .env.local.")

  const cep = (input.destino.cep || "").replace(/\D/g, "")
  // 1) carrinho
  const cart = await me("/api/v2/me/cart", {
    method: "POST",
    body: JSON.stringify({
      service: Number(SERVICE),
      from,
      to: {
        name: input.destino.nome,
        phone: input.destino.telefone || undefined,
        address: input.destino.endereco || undefined,
        city: input.destino.cidade || undefined,
        state_abbr: input.destino.estado || undefined,
        postal_code: cep,
      },
      volumes: [{ weight: input.peso_kg ?? 0.3, width: 16, height: 6, length: 22 }],
      options: { receipt: false, own_hand: false },
    }),
  })
  const orderId = cart.id as string

  // 2) checkout (paga com saldo) · 3) generate (emite)
  await me("/api/v2/me/shipment/checkout", {
    method: "POST",
    body: JSON.stringify({ orders: [orderId] }),
  })
  await me("/api/v2/me/shipment/generate", {
    method: "POST",
    body: JSON.stringify({ orders: [orderId] }),
  })

  // 4) URL do PDF + rastreio
  const print = await me("/api/v2/me/shipment/print", {
    method: "POST",
    body: JSON.stringify({ orders: [orderId], mode: "public" }),
  })
  const tracking = cart.tracking || cart.self_tracking || ""
  return {
    tracking_number: String(tracking || orderId),
    tracking_url: tracking ? `https://www.melhorrastreio.com.br/rastreio/${tracking}` : "",
    label_url: (print?.url as string) || "",
  }
}
