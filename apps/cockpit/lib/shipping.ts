// Integração com transportadora — SuperFrete (spec 2026-09-18-frete-superfrete-design.md §4.7).
// Sem SUPERFRETE_TOKEN, o Cockpit opera no modo MANUAL (operador digita o rastreio).
// Variáveis: ver architecture/envios.md.
//
// A compra da etiqueta é DELIBERADAMENTE três chamadas pequenas, não uma função só — a orquestração
// que decide QUANDO chamar cada uma (e nunca pagar em dobro numa retentativa) mora em
// lib/etiqueta-segura.ts (garantirEtiqueta), que injeta estas três funções como dependências:
//   carrierCriarFrete    → POST /api/v0/cart              cria o frete (não gasta saldo)
//   carrierPagarFrete    → POST /api/v0/checkout           paga com o saldo da carteira (gasta saldo)
//   carrierConsultarFrete → GET /api/v0/order/info/{id}    confere o status ANTES de decidir pagar de novo
import { montarCorpoDoCart, remetenteDoAmbiente, type PedidoParaEtiqueta } from "./superfrete-etiqueta"

export const CARRIER_NAME = "SuperFrete"
export const carrierConfigured = () => Boolean(process.env.SUPERFRETE_TOKEN)

export type CarrierLabel = {
  tracking_number: string
  tracking_url: string
  label_url: string
  // id do frete devolvido pelo POST /api/v0/cart — precisa ficar gravado no pedido para permitir
  // cancelar a etiqueta depois (POST /api/v0/order/cancel) e para conferir o status antes de comprar
  // de novo numa retentativa (ver lib/etiqueta-segura.ts).
  carrier_order_id: string
}

class CarrierNotConfigured extends Error {
  constructor() {
    super("Integração com a SuperFrete ainda não configurada. Defina SUPERFRETE_TOKEN no ambiente do Cockpit (ver architecture/envios.md). Use o rastreio manual por enquanto.")
    this.name = "CarrierNotConfigured"
  }
}

const base = () => (process.env.SUPERFRETE_SANDBOX === "true" ? "https://sandbox.superfrete.com" : "https://api.superfrete.com")

// Nenhuma chamada à SuperFrete pode ficar pendurada: um hang no /checkout deixaria "foi cobrado ou
// não?" em aberto (achado 2 da revisão), o que alimentava o risco de pagar em dobro numa retentativa
// (achado 1). 20s é generoso pro pior caso e curto o bastante pro operador não travar no despacho.
const TIMEOUT_MS = 20_000
const MSG_TIMEOUT =
  "A SuperFrete não respondeu a tempo. Nada foi cobrado em dobro: clique em Despachar de novo que o sistema confere a etiqueta antes de comprar."

function headersPadrao(): HeadersInit {
  return {
    Authorization: `Bearer ${process.env.SUPERFRETE_TOKEN}`,
    "User-Agent": `use.ECLAT Cockpit (${process.env.SUPERFRETE_CONTACT_EMAIL ?? ""})`,
    Accept: "application/json",
    "Content-Type": "application/json",
  }
}

// Formato mínimo das respostas de /api/v0/cart, /api/v0/checkout e /api/v0/order/info/{id} que a
// etiqueta usa.
type RespostaSuperFrete = {
  id?: string
  status?: string
  tracking?: string
  print?: { url?: string }
  purchase?: {
    orders?: { id?: string; tracking?: string; print?: { url?: string } }[]
  }
}

async function requisitar(path: string, init: RequestInit): Promise<RespostaSuperFrete> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let r: Response
  try {
    r = await fetch(`${base()}${path}`, { ...init, signal: controller.signal })
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") throw new Error(MSG_TIMEOUT)
    throw e
  } finally {
    clearTimeout(timer)
  }
  if (!r.ok) {
    const texto = (await r.text()).slice(0, 300)
    // "saldo insuficiente" é o texto oficial da SuperFrete pra carteira sem saldo; qualquer outro
    // erro que só cite "saldo" de passagem (ex.: "saldo devedor de tributos") não pode ser confundido
    // com isso — vira o erro genérico abaixo, com o texto original visível pro operador.
    if (r.status === 402 || /saldo\s+insuficiente/i.test(texto)) {
      throw new Error("Sem saldo na SuperFrete. Recarregue a carteira e tente de novo.")
    }
    throw new Error(`SuperFrete ${path} → HTTP ${r.status}: ${texto}`)
  }
  return r.json()
}

const post = (path: string, corpo: unknown) => requisitar(path, { method: "POST", headers: headersPadrao(), body: JSON.stringify(corpo) })
const get = (path: string) => requisitar(path, { method: "GET", headers: headersPadrao() })

// Cria o frete (POST /api/v0/cart) e devolve o id — NÃO gasta saldo. Lança CarrierNotConfigured se
// faltar credencial (a UI cai no modo manual).
export async function carrierCriarFrete(pedido: PedidoParaEtiqueta, chaveNfe: string | null): Promise<string> {
  if (!carrierConfigured()) throw new CarrierNotConfigured()
  // Monta (e valida CPF/CEP/endereço/UF) ANTES de qualquer chamada: erro de dado não gasta saldo.
  const corpo = montarCorpoDoCart(pedido, remetenteDoAmbiente(), chaveNfe)
  const frete = await post("/api/v0/cart", corpo)
  const id = String(frete?.id ?? "")
  if (!id) throw new Error("SuperFrete não devolveu o id do frete criado.")
  return id
}

// Paga o frete já criado (POST /api/v0/checkout) — GASTA SALDO. Só chamar uma vez por frete; quem
// garante isso é lib/etiqueta-segura.ts, nunca a rota direto.
export async function carrierPagarFrete(id: string): Promise<CarrierLabel> {
  if (!carrierConfigured()) throw new CarrierNotConfigured()
  const compra = await post("/api/v0/checkout", { orders: [id] })
  const emitida = compra?.purchase?.orders?.find((o) => o.id === id) ?? compra?.purchase?.orders?.[0]
  const rastreio = String(emitida?.tracking ?? "")
  return {
    tracking_number: rastreio || id,
    tracking_url: rastreio ? `https://rastreamento.correios.com.br/app/index.php?objetos=${rastreio}` : "",
    label_url: String(emitida?.print?.url ?? ""),
    carrier_order_id: id,
  }
}

// Status finais em que a doc da SuperFrete garante rastreio + PDF prontos (tracking só preenche
// depois do pagamento). "pending" = criado e não pago; "canceled" = liberou o saldo de volta.
const STATUS_COM_ETIQUETA = new Set(["released", "posted", "delivered"])

// Consulta o estado de um frete já criado (GET /api/v0/order/info/{id}) — NÃO gasta saldo. Usada
// para decidir, antes de comprar de novo, se o frete já foi pago (não paga de novo) ou nunca chegou
// a ser pago (pode pagar com segurança).
export async function carrierConsultarFrete(id: string): Promise<{ status: string; label: CarrierLabel | null }> {
  if (!carrierConfigured()) throw new CarrierNotConfigured()
  const info = await get(`/api/v0/order/info/${id}`)
  const status = String(info?.status ?? "")
  if (!STATUS_COM_ETIQUETA.has(status)) return { status, label: null }
  const rastreio = String(info?.tracking ?? "")
  return {
    status,
    label: {
      tracking_number: rastreio || id,
      tracking_url: rastreio ? `https://rastreamento.correios.com.br/app/index.php?objetos=${rastreio}` : "",
      label_url: String(info?.print?.url ?? ""),
      carrier_order_id: id,
    },
  }
}
