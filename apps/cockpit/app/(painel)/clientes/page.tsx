"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

type Customer = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  phone: string | null
  created_at: string
  pedidos: number
  total_gasto: number
  ultimo_pedido_em: string | null
}

const VIP_MIN = 1000 // R$ — cliente VIP/alto valor
const INATIVO_DIAS = 90
const NOVO_DIAS = 30
const diasAtras = (iso: string | null) =>
  iso ? (Date.now() - new Date(iso).getTime()) / 86400000 : Infinity

type Segmento = "" | "novos" | "recorrentes" | "vip" | "inativos" | "sem_pedido"
const noSegmento = (c: Customer, s: Segmento): boolean => {
  switch (s) {
    case "novos":
      return diasAtras(c.created_at) <= NOVO_DIAS
    case "recorrentes":
      return c.pedidos >= 2
    case "vip":
      return c.total_gasto >= VIP_MIN
    case "inativos":
      return c.pedidos >= 1 && diasAtras(c.ultimo_pedido_em) > INATIVO_DIAS
    case "sem_pedido":
      return c.pedidos === 0
    default:
      return true
  }
}
const SEGMENTOS: { key: Segmento; label: string }[] = [
  { key: "", label: "Todos" },
  { key: "novos", label: "Novos" },
  { key: "recorrentes", label: "Recorrentes" },
  { key: "vip", label: "VIP" },
  { key: "inativos", label: "Inativos" },
  { key: "sem_pedido", label: "Sem pedido" },
]

const TEMPLATES_FUP: { nome: string; texto: (n: string) => string }[] = [
  {
    nome: "Pós-venda",
    texto: (n) =>
      `Oi, ${n}! 💛 Aqui é da use.ÉCLAT. Passando só pra saber se você está amando suas peças e se ficou tudo certinho com o tamanho. Qualquer coisa, é só me chamar por aqui. ✨`,
  },
  {
    nome: "Recompra / novidade",
    texto: (n) =>
      `Oi, ${n}! ✨ Chegaram novidades na use.ÉCLAT que têm tudo a ver com você. Quer que eu te mostre? 💛`,
  },
  {
    nome: "Reativação",
    texto: (n) =>
      `Oi, ${n}! 💛 Sentimos a sua falta por aqui. Preparei um mimo especial pra te receber de volta na use.ÉCLAT — posso te contar?`,
  },
]
type Address = {
  city: string | null
  province: string | null
  address_1: string | null
  postal_code: string | null
  country_code: string | null
}
type Order = {
  id: string
  display_id: number
  total: number
  payment_status: string
  fulfillment_status: string
  created_at: string
}
type Ficha = {
  customer: Customer
  addresses: Address[]
  orders: Order[]
  lead: { id: string; whatsapp: string | null; status: string; conversation_id: string | null } | null
  cliente_rel: { tags: string[] | null; notas: string | null; consentimento_lgpd: boolean } | null
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const data = (iso: string) => new Date(iso).toLocaleDateString("pt-BR")
const nomeDe = (c: { first_name: string | null; last_name: string | null; email: string }) =>
  [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email

const PAGAMENTO: Record<string, { txt: string; cls: string }> = {
  captured: { txt: "pago", cls: "bg-green-100 text-green-800" },
  authorized: { txt: "autorizado", cls: "bg-blue-100 text-blue-800" },
  partially_captured: { txt: "parcial", cls: "bg-amber-100 text-amber-800" },
  refunded: { txt: "estornado", cls: "bg-gray-100 text-gray-600" },
  canceled: { txt: "cancelado", cls: "bg-gray-100 text-gray-600" },
  not_paid: { txt: "não pago", cls: "bg-red-100 text-red-700" },
}
const ENVIO: Record<string, { txt: string; cls: string }> = {
  not_fulfilled: { txt: "a enviar", cls: "bg-amber-100 text-amber-800" },
  fulfilled: { txt: "preparado", cls: "bg-blue-100 text-blue-800" },
  shipped: { txt: "enviado", cls: "bg-green-100 text-green-800" },
  partially_shipped: { txt: "parcial", cls: "bg-amber-100 text-amber-800" },
  delivered: { txt: "entregue", cls: "bg-green-100 text-green-800" },
  canceled: { txt: "cancelado", cls: "bg-gray-100 text-gray-600" },
}
const badge = (m: Record<string, { txt: string; cls: string }>, k: string) => {
  const b = m[k] ?? { txt: k, cls: "bg-gray-100 text-gray-600" }
  return <span className={`text-[11px] px-2 py-0.5 rounded-full ${b.cls}`}>{b.txt}</span>
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState("")
  const [seg, setSeg] = useState<Segmento>("")
  const [fichaId, setFichaId] = useState<string | null>(null)
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [fichaLoading, setFichaLoading] = useState(false)
  const [fupText, setFupText] = useState("")
  const [fupSending, setFupSending] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const r = await fetch("/api/customers", { cache: "no-store" })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || "Falha ao carregar")
      setClientes(d)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    if (!fichaId) {
      setFicha(null)
      return
    }
    setFupText("")
    setFichaLoading(true)
    fetch(`/api/customers/${fichaId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setFicha(d.error ? null : d))
      .finally(() => setFichaLoading(false))
  }, [fichaId])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return clientes.filter((c) => {
      if (!noSegmento(c, seg)) return false
      if (!q) return true
      return (
        nomeDe(c).toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.phone ?? "").includes(q)
      )
    })
  }, [clientes, busca, seg])

  async function enviarFollowup() {
    if (!ficha || !fupText.trim()) return
    setFupSending(true)
    try {
      const r = await fetch(`/api/customers/${ficha.customer.id}/followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: fupText }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || "Falha ao enviar")
      alert(`✓ Follow-up enviado para ${d.phone}.`)
      setFupText("")
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setFupSending(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <h1 className="font-serif text-3xl text-eclat-grafite">Clientes</h1>
        <span className="text-xs text-eclat-grafite/50">{filtrados.length} cliente(s)</span>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {SEGMENTOS.map((s) => {
          const n = clientes.filter((c) => noSegmento(c, s.key)).length
          return (
            <button
              key={s.key || "todos"}
              onClick={() => setSeg(s.key)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                seg === s.key
                  ? "bg-eclat-dourado/30 border-eclat-dourado text-eclat-grafite"
                  : "border-eclat-pedra/40 text-eclat-grafite/70 hover:bg-eclat-areia/40"
              }`}
            >
              {s.label} <span className="text-eclat-grafite/40">{n}</span>
            </button>
          )
        })}
      </div>

      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome, e-mail ou telefone…"
        className="border border-eclat-pedra/50 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-eclat-dourado w-80 mb-4"
      />

      {loading && <p className="text-sm text-eclat-grafite/50">Carregando…</p>}
      {erro && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">{erro}</p>
      )}

      {!loading && !erro && (
        <div className="border border-eclat-pedra/40 rounded-lg bg-white/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-eclat-grafite/50 border-b border-eclat-pedra/20">
                <th className="px-4 py-2 font-normal">Cliente</th>
                <th className="px-4 py-2 font-normal">Telefone</th>
                <th className="px-4 py-2 font-normal text-center">Pedidos</th>
                <th className="px-4 py-2 font-normal text-right">Total gasto</th>
                <th className="px-4 py-2 font-normal">Desde</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setFichaId(c.id)}
                  className="border-b border-eclat-pedra/10 last:border-0 cursor-pointer hover:bg-eclat-areia/30"
                >
                  <td className="px-4 py-2">
                    <div className="font-medium">{nomeDe(c)}</div>
                    <div className="text-xs text-eclat-grafite/50">{c.email}</div>
                  </td>
                  <td className="px-4 py-2 text-eclat-grafite/70">{c.phone || "—"}</td>
                  <td className="px-4 py-2 text-center">{c.pedidos}</td>
                  <td className="px-4 py-2 text-right">{brl(c.total_gasto)}</td>
                  <td className="px-4 py-2 text-eclat-grafite/60 text-xs">{data(c.created_at)}</td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-eclat-grafite/50 text-sm">
                    Nenhum cliente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Ficha 360° */}
      {fichaId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setFichaId(null)}>
          <div
            className="w-full max-w-lg h-full bg-eclat-luz overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-eclat-luz border-b border-eclat-pedra/30 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="font-serif text-2xl text-eclat-grafite">Ficha do cliente</h2>
              <button onClick={() => setFichaId(null)} className="text-eclat-grafite/50 hover:text-eclat-grafite text-xl">✕</button>
            </div>

            {fichaLoading || !ficha ? (
              <p className="p-6 text-sm text-eclat-grafite/50">Carregando…</p>
            ) : (
              <div className="p-6 flex flex-col gap-6">
                {/* Identificação */}
                <section>
                  <h3 className="font-medium text-lg text-eclat-grafite">{nomeDe(ficha.customer)}</h3>
                  <p className="text-sm text-eclat-grafite/60">{ficha.customer.email}</p>
                  <p className="text-sm text-eclat-grafite/60">{ficha.customer.phone || ficha.lead?.whatsapp || "sem telefone"}</p>
                  <div className="flex gap-4 mt-2 text-sm">
                    <span><b>{ficha.orders.length}</b> pedido(s)</span>
                    <span>
                      total{" "}
                      <b>{brl(ficha.orders.reduce((s, o) => s + (o.total ?? 0), 0))}</b>
                    </span>
                    <span className="text-eclat-grafite/50">desde {data(ficha.customer.created_at)}</span>
                  </div>
                </section>

                {/* Relacionamento */}
                {(ficha.lead || ficha.cliente_rel) && (
                  <section className="bg-white/60 border border-eclat-pedra/30 rounded-lg p-3 text-sm flex flex-col gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {ficha.lead && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-eclat-dourado/20">
                          lead: {ficha.lead.status}
                        </span>
                      )}
                      {ficha.cliente_rel?.tags?.map((t) => (
                        <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-eclat-areia/60">{t}</span>
                      ))}
                      {ficha.cliente_rel && (
                        <span className="text-xs text-eclat-grafite/50">
                          LGPD: {ficha.cliente_rel.consentimento_lgpd ? "consentido" : "—"}
                        </span>
                      )}
                    </div>
                    {ficha.cliente_rel?.notas && (
                      <p className="text-eclat-grafite/70 text-xs">{ficha.cliente_rel.notas}</p>
                    )}
                    {ficha.lead?.conversation_id && (
                      <a
                        href={`/conversas?c=${ficha.lead.conversation_id}`}
                        className="text-xs text-eclat-dourado underline self-start"
                      >
                        💬 Abrir conversa no WhatsApp
                      </a>
                    )}
                  </section>
                )}

                {/* Endereços */}
                {ficha.addresses.length > 0 && (
                  <section>
                    <h4 className="text-xs uppercase tracking-wider text-eclat-grafite/60 mb-2">Endereços</h4>
                    {ficha.addresses.map((a, i) => (
                      <p key={i} className="text-sm text-eclat-grafite/70">
                        {[a.address_1, a.city, a.province, a.postal_code].filter(Boolean).join(", ")}
                      </p>
                    ))}
                  </section>
                )}

                {/* Pedidos */}
                <section>
                  <h4 className="text-xs uppercase tracking-wider text-eclat-grafite/60 mb-2">Pedidos</h4>
                  {ficha.orders.length === 0 ? (
                    <p className="text-sm text-eclat-grafite/50">Nenhum pedido.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {ficha.orders.map((o) => (
                        <div key={o.id} className="border border-eclat-pedra/30 rounded-md px-3 py-2 flex items-center justify-between text-sm bg-white/50">
                          <div>
                            <span className="font-medium">#{o.display_id}</span>
                            <span className="text-eclat-grafite/50 text-xs ml-2">{data(o.created_at)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {badge(PAGAMENTO, o.payment_status)}
                            {badge(ENVIO, o.fulfillment_status)}
                            <span className="font-medium">{brl(o.total)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Follow-up por WhatsApp */}
                <section className="border border-eclat-dourado/40 rounded-lg p-4 bg-white/60 flex flex-col gap-2">
                  <h4 className="text-xs uppercase tracking-wider text-eclat-grafite/60">Follow-up (WhatsApp)</h4>
                  <div className="flex flex-wrap gap-2">
                    {TEMPLATES_FUP.map((t) => (
                      <button
                        key={t.nome}
                        onClick={() => setFupText(t.texto(ficha.customer.first_name || "tudo bem"))}
                        className="text-xs border border-eclat-pedra/40 rounded-full px-3 py-1 hover:bg-eclat-areia/40"
                      >
                        {t.nome}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={fupText}
                    onChange={(e) => setFupText(e.target.value)}
                    rows={4}
                    placeholder="Escreva ou escolha um modelo acima…"
                    className="border border-eclat-pedra/50 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-eclat-dourado resize-y"
                  />
                  <button
                    onClick={enviarFollowup}
                    disabled={fupSending || !fupText.trim()}
                    className="self-start bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-xs px-5 py-2.5 rounded-md hover:bg-eclat-dourado hover:text-eclat-grafite disabled:opacity-50"
                  >
                    {fupSending ? "Enviando…" : "Enviar follow-up"}
                  </button>
                  <p className="text-xs text-eclat-grafite/50">
                    Telefone resolvido por: cadastro → lead → último pedido.
                  </p>
                </section>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
