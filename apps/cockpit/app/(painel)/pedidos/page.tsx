"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

type Order = {
  id: string
  display_id: number
  total: number
  payment_status: string
  fulfillment_status: string
  created_at: string
  email: string | null
  customer_id: string | null
}
type OrderItem = {
  title: string
  variant_title: string | null
  quantity: number
  unit_price: number
  total: number
}
type OrderDetail = Order & {
  status: string
  subtotal: number
  shipping_total: number
  tax_total: number
  items: OrderItem[]
  shipping_address: {
    first_name: string | null
    last_name: string | null
    address_1: string | null
    city: string | null
    province: string | null
    postal_code: string | null
    phone: string | null
  } | null
  shipping_methods: { name: string; total: number }[]
  fulfillments: {
    id: string
    shipped_at: string | null
    delivered_at: string | null
    canceled_at: string | null
    labels: { tracking_number: string | null; tracking_url: string | null; label_url: string | null }[]
  }[]
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })

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

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState("")
  const [fPag, setFPag] = useState("")
  const [fEnvio, setFEnvio] = useState("")
  const [detId, setDetId] = useState<string | null>(null)
  const [det, setDet] = useState<OrderDetail | null>(null)
  const [detLoading, setDetLoading] = useState(false)
  // despacho
  const [trackNum, setTrackNum] = useState("")
  const [trackUrl, setTrackUrl] = useState("")
  const [notify, setNotify] = useState(true)
  const [despachando, setDespachando] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const r = await fetch("/api/orders", { cache: "no-store" })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || "Falha ao carregar")
      setPedidos(d)
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
    if (!detId) {
      setDet(null)
      return
    }
    setTrackNum("")
    setTrackUrl("")
    setNotify(true)
    setDetLoading(true)
    fetch(`/api/orders/${detId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setDet(d.error ? null : d))
      .finally(() => setDetLoading(false))
  }, [detId])

  async function despachar(useCarrier: boolean) {
    if (!det) return
    setDespachando(true)
    try {
      const r = await fetch(`/api/orders/${det.id}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tracking_number: trackNum,
          tracking_url: trackUrl,
          use_carrier: useCarrier,
          notify,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || "Falha ao despachar")
      let msg = `✓ Pedido #${det.display_id} despachado.`
      if (d.tracking_number) msg += `\nRastreio: ${d.tracking_number}`
      if (d.whatsapp)
        msg += d.whatsapp.ok
          ? "\nCliente avisado no WhatsApp."
          : `\nWhatsApp não enviado: ${d.whatsapp.error}`
      alert(msg)
      const rr = await fetch(`/api/orders/${det.id}`, { cache: "no-store" })
      if (rr.ok) setDet(await rr.json())
      carregar()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setDespachando(false)
    }
  }

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return pedidos.filter((o) => {
      if (fPag && o.payment_status !== fPag) return false
      if (fEnvio && o.fulfillment_status !== fEnvio) return false
      if (q) {
        const hit = String(o.display_id).includes(q) || (o.email ?? "").toLowerCase().includes(q)
        if (!hit) return false
      }
      return true
    })
  }, [pedidos, busca, fPag, fEnvio])

  const selectCls =
    "border border-eclat-pedra/50 rounded-md px-2 py-2 text-sm bg-white focus:outline-none focus:border-eclat-dourado"
  const itensTotal = det ? det.items.reduce((s, i) => s + (i.total ?? 0), 0) : 0

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <h1 className="font-serif text-3xl text-eclat-grafite">Pedidos</h1>
        <div className="flex items-center gap-3">
          {(() => {
            const aEnviar = pedidos.filter((o) => o.fulfillment_status === "not_fulfilled").length
            return aEnviar > 0 ? (
              <button
                onClick={() => setFEnvio((s) => (s === "not_fulfilled" ? "" : "not_fulfilled"))}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  fEnvio === "not_fulfilled"
                    ? "bg-amber-500 text-white border-amber-500"
                    : "border-amber-400 text-amber-700 hover:bg-amber-50"
                }`}
              >
                📦 {aEnviar} a enviar
              </button>
            ) : null
          })()}
          <span className="text-xs text-eclat-grafite/50">{filtrados.length} pedido(s)</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar nº ou e-mail…"
          className="border border-eclat-pedra/50 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-eclat-dourado w-56"
        />
        <select value={fPag} onChange={(e) => setFPag(e.target.value)} className={selectCls}>
          <option value="">Pagamento: todos</option>
          <option value="captured">Pago</option>
          <option value="authorized">Autorizado</option>
          <option value="not_paid">Não pago</option>
          <option value="refunded">Estornado</option>
        </select>
        <select value={fEnvio} onChange={(e) => setFEnvio(e.target.value)} className={selectCls}>
          <option value="">Envio: todos</option>
          <option value="not_fulfilled">A enviar</option>
          <option value="fulfilled">Preparado</option>
          <option value="shipped">Enviado</option>
          <option value="delivered">Entregue</option>
        </select>
        {(busca || fPag || fEnvio) && (
          <button
            onClick={() => {
              setBusca("")
              setFPag("")
              setFEnvio("")
            }}
            className="text-xs text-eclat-grafite/50 underline"
          >
            limpar
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-eclat-grafite/50">Carregando…</p>}
      {erro && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">{erro}</p>}

      {!loading && !erro && (
        <div className="border border-eclat-pedra/40 rounded-lg bg-white/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-eclat-grafite/50 border-b border-eclat-pedra/20">
                <th className="px-4 py-2 font-normal">Pedido</th>
                <th className="px-4 py-2 font-normal">Cliente</th>
                <th className="px-4 py-2 font-normal">Data</th>
                <th className="px-4 py-2 font-normal">Pagamento</th>
                <th className="px-4 py-2 font-normal">Envio</th>
                <th className="px-4 py-2 font-normal text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => setDetId(o.id)}
                  className="border-b border-eclat-pedra/10 last:border-0 cursor-pointer hover:bg-eclat-areia/30"
                >
                  <td className="px-4 py-2 font-medium">#{o.display_id}</td>
                  <td className="px-4 py-2 text-eclat-grafite/70">{o.email || "—"}</td>
                  <td className="px-4 py-2 text-eclat-grafite/60 text-xs">{dataHora(o.created_at)}</td>
                  <td className="px-4 py-2">{badge(PAGAMENTO, o.payment_status)}</td>
                  <td className="px-4 py-2">{badge(ENVIO, o.fulfillment_status)}</td>
                  <td className="px-4 py-2 text-right font-medium">{brl(o.total)}</td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-eclat-grafite/50 text-sm">
                    Nenhum pedido.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Detalhe */}
      {detId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setDetId(null)}>
          <div
            className="w-full max-w-lg h-full bg-eclat-luz overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-eclat-luz border-b border-eclat-pedra/30 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="font-serif text-2xl text-eclat-grafite">
                {det ? `Pedido #${det.display_id}` : "Pedido"}
              </h2>
              <button onClick={() => setDetId(null)} className="text-eclat-grafite/50 hover:text-eclat-grafite text-xl">✕</button>
            </div>

            {detLoading || !det ? (
              <p className="p-6 text-sm text-eclat-grafite/50">Carregando…</p>
            ) : (
              <div className="p-6 flex flex-col gap-6">
                <div className="flex items-center gap-2 flex-wrap">
                  {badge(PAGAMENTO, det.payment_status)}
                  {badge(ENVIO, det.fulfillment_status)}
                  <span className="text-xs text-eclat-grafite/50">{dataHora(det.created_at)}</span>
                </div>

                {/* Itens */}
                <section>
                  <h4 className="text-xs uppercase tracking-wider text-eclat-grafite/60 mb-2">Itens</h4>
                  <div className="border border-eclat-pedra/30 rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <tbody>
                        {det.items.map((i, idx) => (
                          <tr key={idx} className="border-b border-eclat-pedra/10 last:border-0">
                            <td className="px-3 py-2">
                              <div>{i.title}</div>
                              <div className="text-xs text-eclat-grafite/50">{i.variant_title}</div>
                            </td>
                            <td className="px-3 py-2 text-center text-eclat-grafite/70">{i.quantity}×</td>
                            <td className="px-3 py-2 text-right text-eclat-grafite/60">{brl(i.unit_price)}</td>
                            <td className="px-3 py-2 text-right font-medium">{brl(i.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Totais */}
                <section className="text-sm">
                  <div className="flex justify-between py-1"><span className="text-eclat-grafite/60">Itens</span><span>{brl(itensTotal)}</span></div>
                  <div className="flex justify-between py-1"><span className="text-eclat-grafite/60">Frete</span><span>{brl(det.shipping_total)}</span></div>
                  <div className="flex justify-between py-2 border-t border-eclat-pedra/30 font-medium text-base"><span>Total</span><span>{brl(det.total)}</span></div>
                </section>

                {/* Entrega */}
                {det.shipping_address && (
                  <section>
                    <h4 className="text-xs uppercase tracking-wider text-eclat-grafite/60 mb-2">Entrega</h4>
                    <p className="text-sm">
                      {[det.shipping_address.first_name, det.shipping_address.last_name].filter(Boolean).join(" ")}
                    </p>
                    <p className="text-sm text-eclat-grafite/70">
                      {[det.shipping_address.address_1, det.shipping_address.city, det.shipping_address.province, det.shipping_address.postal_code]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                    {det.shipping_address.phone && (
                      <p className="text-sm text-eclat-grafite/60">{det.shipping_address.phone}</p>
                    )}
                    {det.shipping_methods[0] && (
                      <p className="text-xs text-eclat-grafite/50 mt-1">
                        {det.shipping_methods[0].name} · {brl(det.shipping_methods[0].total)}
                      </p>
                    )}
                  </section>
                )}

                {/* Despacho */}
                {det.fulfillment_status === "not_fulfilled" ? (
                  <section className="border border-eclat-dourado/40 rounded-lg p-4 bg-white/60 flex flex-col gap-3">
                    <h4 className="text-sm font-medium text-eclat-grafite">Despachar pedido</h4>
                    <input
                      value={trackNum}
                      onChange={(e) => setTrackNum(e.target.value)}
                      placeholder="Código de rastreio (opcional)"
                      className="border border-eclat-pedra/50 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-eclat-dourado"
                    />
                    <input
                      value={trackUrl}
                      onChange={(e) => setTrackUrl(e.target.value)}
                      placeholder="URL de rastreio (opcional)"
                      className="border border-eclat-pedra/50 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-eclat-dourado"
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={notify && !!det.shipping_address?.phone}
                        disabled={!det.shipping_address?.phone}
                        onChange={(e) => setNotify(e.target.checked)}
                        className="accent-eclat-dourado"
                      />
                      Avisar cliente por WhatsApp
                      {!det.shipping_address?.phone && (
                        <span className="text-xs text-eclat-grafite/40">(sem telefone)</span>
                      )}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => despachar(false)}
                        disabled={despachando}
                        className="bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-xs px-5 py-2.5 rounded-md hover:bg-eclat-dourado hover:text-eclat-grafite disabled:opacity-50"
                      >
                        {despachando ? "Despachando…" : "Despachar"}
                      </button>
                      <button
                        onClick={() => despachar(true)}
                        disabled={despachando}
                        title="Gera a etiqueta na transportadora (requer credenciais configuradas)"
                        className="border border-eclat-grafite/40 text-xs uppercase tracking-widest px-4 py-2.5 rounded-md hover:bg-eclat-areia/40 disabled:opacity-50"
                      >
                        Gerar etiqueta (Melhor Envio)
                      </button>
                    </div>
                    <p className="text-xs text-eclat-grafite/50">
                      Sem código → despacha sem rastreio. A etiqueta automática precisa das credenciais da transportadora (modo manual funciona já).
                    </p>
                  </section>
                ) : (
                  det.fulfillments?.some((f) => !f.canceled_at) && (
                    <section className="border border-green-200 bg-green-50 rounded-lg p-4 text-sm flex flex-col gap-1">
                      <h4 className="text-xs uppercase tracking-wider text-green-800 mb-1">Envio</h4>
                      {det.fulfillments
                        .filter((f) => !f.canceled_at)
                        .flatMap((f) => f.labels)
                        .map((l, i) => (
                          <div key={i} className="text-green-900">
                            Rastreio: <b>{l.tracking_number || "—"}</b>
                            {l.tracking_url && (
                              <a href={l.tracking_url} target="_blank" rel="noreferrer" className="underline ml-2">acompanhar</a>
                            )}
                            {l.label_url && (
                              <a href={l.label_url} target="_blank" rel="noreferrer" className="underline ml-2">etiqueta PDF</a>
                            )}
                          </div>
                        ))}
                      {det.fulfillments.filter((f) => !f.canceled_at).every((f) => f.labels.length === 0) && (
                        <span className="text-green-900">Pedido despachado (sem código de rastreio).</span>
                      )}
                    </section>
                  )
                )}

                <section className="text-sm text-eclat-grafite/60">
                  <span>Cliente: {det.email}</span>
                  {det.customer_id && (
                    <a href={`/clientes`} className="text-eclat-dourado underline ml-2">ver ficha</a>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
