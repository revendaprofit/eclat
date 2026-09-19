// Integração com transportadora — SuperFrete (spec 2026-09-18-frete-superfrete-design.md §4.7).
// Sem SUPERFRETE_TOKEN, o Cockpit opera no modo MANUAL (operador digita o rastreio).
// Variáveis: ver architecture/envios.md. Fluxo da etiqueta:
//   1) POST /api/v0/cart      → cria o frete (remetente, destinatário com CPF, serviço, volume)
//   2) POST /api/v0/checkout  → paga com o saldo da carteira; devolve rastreio e link do PDF
import { montarCorpoDoCart, remetenteDoAmbiente, type PedidoParaEtiqueta } from "./superfrete-etiqueta"

export const CARRIER_NAME = "SuperFrete"
export const carrierConfigured = () => Boolean(process.env.SUPERFRETE_TOKEN)

export type CarrierLabel = {
  tracking_number: string
  tracking_url: string
  label_url: string
  // id do frete devolvido pelo POST /api/v0/cart — precisa ficar gravado no pedido para permitir
  // cancelar a etiqueta depois (POST /api/v0/order/cancel), só vale antes de postar.
  carrier_order_id: string
}

class CarrierNotConfigured extends Error {
  constructor() {
    super("Integração com a SuperFrete ainda não configurada. Defina SUPERFRETE_TOKEN no ambiente do Cockpit (ver architecture/envios.md). Use o rastreio manual por enquanto.")
    this.name = "CarrierNotConfigured"
  }
}

const base = () => (process.env.SUPERFRETE_SANDBOX === "true" ? "https://sandbox.superfrete.com" : "https://api.superfrete.com")

// Formato mínimo das respostas de /api/v0/cart e /api/v0/checkout que a etiqueta usa.
type RespostaSuperFrete = {
  id?: string
  purchase?: {
    orders?: { id?: string; tracking?: string; print?: { url?: string } }[]
  }
}

async function sf(path: string, corpo: unknown): Promise<RespostaSuperFrete> {
  const r = await fetch(`${base()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPERFRETE_TOKEN}`,
      "User-Agent": `use.ECLAT Cockpit (${process.env.SUPERFRETE_CONTACT_EMAIL ?? ""})`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(corpo),
  })
  if (!r.ok) {
    const texto = (await r.text()).slice(0, 300)
    if (r.status === 402 || /saldo/i.test(texto)) {
      throw new Error("Sem saldo na SuperFrete. Recarregue a carteira e tente de novo.")
    }
    throw new Error(`SuperFrete ${path} → HTTP ${r.status}: ${texto}`)
  }
  return r.json()
}

// Compra a etiqueta do pedido e devolve o rastreio + URL do PDF + id do frete na SuperFrete.
// Lança CarrierNotConfigured se faltar credencial (a UI cai no modo manual).
export async function carrierCreateLabel(pedido: PedidoParaEtiqueta, chaveNfe: string | null): Promise<CarrierLabel> {
  if (!carrierConfigured()) throw new CarrierNotConfigured()
  // Monta (e valida CPF/CEP/endereço) ANTES de qualquer chamada: erro de dado não gasta saldo.
  const corpo = montarCorpoDoCart(pedido, remetenteDoAmbiente(), chaveNfe)

  const frete = await sf("/api/v0/cart", corpo)
  const id = String(frete?.id ?? "")
  if (!id) throw new Error("SuperFrete não devolveu o id do frete criado.")

  const compra = await sf("/api/v0/checkout", { orders: [id] })
  const emitida = compra?.purchase?.orders?.find((o) => o.id === id) ?? compra?.purchase?.orders?.[0]
  const rastreio = String(emitida?.tracking ?? "")
  return {
    tracking_number: rastreio || id,
    tracking_url: rastreio ? `https://rastreamento.correios.com.br/app/index.php?objetos=${rastreio}` : "",
    label_url: String(emitida?.print?.url ?? ""),
    carrier_order_id: id,
  }
}
