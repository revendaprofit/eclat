"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { agruparDescontosPedido, etiquetaConjunto, residualDesconto } from "@/lib/pedido-conjunto"
import { resumoConferencia, type ItemPedido, type RegistroConferencia } from "@/lib/leitor"
import ConferenciaPedido from "@/components/conferencia-pedido"
import { FiscalDoPedido, type DocumentoFiscal } from "@/components/fiscal-do-pedido"
import { NfdDoPedido } from "@/components/nfd-do-pedido"
import { DadosFiscaisDoPedido } from "@/components/dados-fiscais-do-pedido"
import { resumoDoPagamento, type PagamentoDoPedido } from "@/lib/pagamento"
import { aceiteDaEntregaApp, ehEntregaPorApp } from "@/lib/entrega-app"

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
  id: string
  variant_id?: string | null
  variant_sku?: string | null
  title: string
  variant_title: string | null
  quantity: number
  unit_price: number
  total: number
  metadata?: Record<string, unknown> | null
  adjustments?: { code?: string | null; amount?: number | null }[] | null
}
type OrderDetail = Order & {
  status: string
  subtotal: number
  item_subtotal: number
  discount_total: number
  shipping_total: number
  shipping_subtotal: number
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
    // Lido por DadosFiscaisDoPedido (lib/dados-fiscais.ts) para numero/bairro/
    // municipio_ibge/cpf — precisa estar aqui para o tsc pegar se o `fields` do
    // medusaGetOrder voltar a esquecer esse caminho (achado da revisão final).
    metadata?: Record<string, unknown> | null
  } | null
  // Mesma razão do metadata acima: billing_address é a fonte de MAIOR prioridade do
  // CPF em lerDadosFiscais (fallback de três fontes). Sem declarar aqui, a tipagem
  // estrutural deixa a ausência invisível — hoje o objeto vem cru de medusaGetOrder e
  // funciona, mas se alguém montar este objeto a partir de um mapeamento amanhã, o
  // CPF de cobrança some sem erro de compilação e sem teste (achado da re-revisão).
  billing_address?: { metadata?: Record<string, unknown> | null } | null
  shipping_methods: { name: string; total: number; data?: Record<string, unknown> | null; shipping_option?: { provider_id?: string | null } | null }[]
  // Pagamentos (Parte 4): método, parcelas e tarifa real vêm de payment.data (lib/pagamento.ts).
  payment_collections?: { payments?: PagamentoDoPedido[] | null }[] | null
  fulfillments: {
    id: string
    shipped_at: string | null
    delivered_at: string | null
    canceled_at: string | null
    labels: { tracking_number: string | null; tracking_url: string | null; label_url: string | null }[]
  }[]
  metadata?:
    | ({
        conferencia?: RegistroConferencia
        // Duas formas: nota emitida (documento_id/chave/numero) OU despacho sem nota por
        // interruptor desligado (emitida:false + motivo + carimbo de hora) — correção da spec
        // §6.1, é o vestígio de auditoria deste caso (dispatch/route.ts).
        fiscal?:
          | { documento_id: string; chave_acesso: string | null; numero: number | null }
          | { emitida: false; motivo: string; em: string }
      } & Record<string, unknown>)
    | null
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const brlCent = (cent: number) => brl(cent / 100)
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
  // Conferência com o leitor de código de barras (spec leitor-codigo-barras F1)
  const [leituras, setLeituras] = useState<string[]>([])
  const [motivo, setMotivo] = useState("")
  // Fiscal (Task 14): documento de venda do pedido, buscado à parte via o proxy fiscal
  const [docFiscal, setDocFiscal] = useState<DocumentoFiscal | null>(null)
  // Falha ao CONSULTAR (rede/servidor) — nunca vira "nenhuma nota emitida" na tela: são situações
  // diferentes e o operador pode estar decidindo se despacha de novo (achado da revisão).
  const [erroFiscal, setErroFiscal] = useState<string | null>(null)

  const carregarFiscal = useCallback((orderId: string) => {
    setErroFiscal(null)
    fetch(`/api/fiscal/documentos?order_id=${orderId}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error("Falha ao consultar.")
        const d = await r.json()
        setDocFiscal(d?.documento ?? null)
      })
      .catch(() => {
        setDocFiscal(null)
        setErroFiscal("Não foi possível consultar o status fiscal deste pedido. Pode haver uma nota emitida mesmo assim.")
      })
  }, [])

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
      setDocFiscal(null)
      setErroFiscal(null)
      return
    }
    setTrackNum("")
    setTrackUrl("")
    setNotify(true)
    setLeituras([])
    setMotivo("")
    setDocFiscal(null)
    setDetLoading(true)
    fetch(`/api/orders/${detId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setDet(d.error ? null : d))
      .finally(() => setDetLoading(false))
    carregarFiscal(detId)
  }, [detId, carregarFiscal])

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
          conferencia: { leituras, motivo },
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || "Falha ao despachar")
      let msg = `✓ Pedido #${det.display_id} despachado${d.conferencia === "divergente" ? " (conferência com divergência registrada)" : " com as peças conferidas"}.`
      if (d.aviso_fiscal) msg += `\n⚠️ ${d.aviso_fiscal}`
      if (d.tracking_number) msg += `\nRastreio: ${d.tracking_number}`
      if (d.whatsapp)
        msg += d.whatsapp.ok
          ? "\nCliente avisado no WhatsApp."
          : `\nWhatsApp não enviado: ${d.whatsapp.error}`
      alert(msg)
      const rr = await fetch(`/api/orders/${det.id}`, { cache: "no-store" })
      if (rr.ok) setDet(await rr.json())
      carregarFiscal(det.id)
      carregar()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setDespachando(false)
    }
  }

  const itensConferencia: ItemPedido[] = useMemo(
    () =>
      (det?.items ?? []).map((i) => ({
        item_id: i.id,
        sku: i.variant_sku ?? null,
        titulo: i.title,
        variante: i.variant_title,
        quantidade: i.quantity,
      })),
    [det]
  )
  const pagamento = useMemo(
    () => resumoDoPagamento(det?.payment_collections?.flatMap((c) => c.payments ?? []) ?? []),
    [det]
  )
  const conferenciaCompleta = useMemo(() => resumoConferencia(itensConferencia, leituras).completa, [itensConferencia, leituras])
  const podeDespachar = conferenciaCompleta || motivo.trim().length > 0

  const itensParaDevolucao = useMemo(
    () =>
      (det?.items ?? []).map((i) => ({
        line_item_id: i.id,
        titulo: i.title,
        variante: i.variant_title,
        quantidade_pedido: i.quantity,
      })),
    [det]
  )

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
  const descontos = det ? agruparDescontosPedido(det.items) : { conjunto: 0, cupom: 0 }
  const residual = det ? residualDesconto(det.discount_total, descontos) : 0

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
                              {etiquetaConjunto(i) && (
                                <span className="inline-block mt-0.5 rounded-sm bg-eclat-areia px-1.5 text-[10px] uppercase tracking-wider text-eclat-grafite" data-testid="etiqueta-conjunto">Conjunto</span>
                              )}
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
                  <div className="flex justify-between py-1"><span className="text-eclat-grafite/60">Itens</span><span>{brl(det.item_subtotal)}</span></div>
                  {descontos.conjunto > 0 && (
                    <div className="flex justify-between py-1"><span className="text-eclat-grafite/60">Benefício Conjunto</span><span>- {brl(descontos.conjunto)}</span></div>
                  )}
                  {descontos.cupom > 0 && (
                    <div className="flex justify-between py-1"><span className="text-eclat-grafite/60">Cupom</span><span>- {brl(descontos.cupom)}</span></div>
                  )}
                  {residual > 0 && (
                    <div className="flex justify-between py-1"><span className="text-eclat-grafite/60">Desconto</span><span>- {brl(residual)}</span></div>
                  )}
                  <div className="flex justify-between py-1"><span className="text-eclat-grafite/60">Frete</span><span>{brl(det.shipping_subtotal ?? det.shipping_total)}</span></div>
                  <div className="flex justify-between py-2 border-t border-eclat-pedra/30 font-medium text-base"><span>Total</span><span>{brl(det.total)}</span></div>
                </section>

                {/* Pagamento (Parte 4): o que a cliente usou e quanto o gateway cobrou */}
                {pagamento && (
                  <section data-testid="bloco-pagamento">
                    <h4 className="text-xs uppercase tracking-wider text-eclat-grafite/60 mb-2">Pagamento</h4>
                    <p className="text-sm">
                      {pagamento.metodo}
                      {pagamento.detalhe && <span className="text-eclat-grafite/60"> · {pagamento.detalhe}</span>}
                    </p>
                    {pagamento.ehMercadoPago && (
                      <div className="text-sm mt-1">
                        {pagamento.tarifa_centavos != null ? (
                          <>
                            <div className="flex justify-between py-0.5"><span className="text-eclat-grafite/60">Tarifa do Mercado Pago</span><span className="text-red-700">−{brlCent(pagamento.tarifa_centavos)}</span></div>
                            {pagamento.liquido_centavos != null && (
                              <div className="flex justify-between py-0.5"><span className="text-eclat-grafite/60">Líquido a receber</span><span className="font-medium">{brlCent(pagamento.liquido_centavos)}</span></div>
                            )}
                          </>
                        ) : (
                          <p className="text-xs text-amber-700">Tarifa ainda não informada pelo Mercado Pago.</p>
                        )}
                        {pagamento.mp_order_id && (
                          <p className="text-xs text-eclat-grafite/50 mt-1 break-all">Mercado Pago: {pagamento.mp_order_id}</p>
                        )}
                      </div>
                    )}
                  </section>
                )}

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

                {/* Dados fiscais (Task 9): completa CPF/número/bairro/IBGE de pedidos que vieram sem eles */}
                <DadosFiscaisDoPedido order={det} statusFiscal={docFiscal?.status} />

                {/* Fiscal (Task 14): status da NF-e de venda + devolução manual (NFD) */}
                <FiscalDoPedido
                  documento={docFiscal}
                  erroCarregar={erroFiscal}
                  onAtualizado={() => carregarFiscal(det.id)}
                  onTentarNovamente={() => carregarFiscal(det.id)}
                  orderId={det.id}
                />
                {docFiscal && (
                  <NfdDoPedido orderId={det.id} statusDocumentoVenda={docFiscal.status} itens={itensParaDevolucao} />
                )}

                {/* Despacho */}
                {det.fulfillment_status === "not_fulfilled" ? (
                  <section className="border border-eclat-dourado/40 rounded-lg p-4 bg-white/60 flex flex-col gap-3">
                    <h4 className="text-sm font-medium text-eclat-grafite">Despachar pedido</h4>
                    {ehEntregaPorApp(det) && (
                      <div className="border border-eclat-terracota/40 bg-eclat-blush-claro/60 rounded-md p-3 text-sm text-eclat-grafite flex flex-col gap-1">
                        <strong className="text-xs uppercase tracking-wider text-eclat-terracota">
                          Entrega por aplicativo
                        </strong>
                        <span>
                          A cliente chama e paga o carro. Combine endereço e horário pelo WhatsApp e entregue a
                          sacola ao motorista. <strong>Não compre etiqueta</strong> deste pedido: despache sem
                          rastreio quando entregar.
                        </span>
                        {aceiteDaEntregaApp(det) && (
                          <span className="text-xs text-eclat-grafite/60">
                            Aceite da cliente registrado em {aceiteDaEntregaApp(det)}.
                          </span>
                        )}
                      </div>
                    )}
                    <ConferenciaPedido
                      itens={itensConferencia}
                      leituras={leituras}
                      onLeituras={setLeituras}
                      motivo={motivo}
                      onMotivo={setMotivo}
                      disabled={despachando}
                    />
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
                        disabled={despachando || !podeDespachar}
                        title={podeDespachar ? undefined : "Confira as peças com o leitor ou informe o motivo"}
                        className="bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-xs px-5 py-2.5 rounded-md hover:bg-eclat-dourado hover:text-eclat-grafite disabled:opacity-50"
                      >
                        {despachando ? "Despachando…" : conferenciaCompleta ? "Despachar" : "Despachar mesmo assim"}
                      </button>
                      <button
                        onClick={() => despachar(true)}
                        disabled={despachando || !podeDespachar || ehEntregaPorApp(det)}
                        title={
                          ehEntregaPorApp(det)
                            ? "Entrega por aplicativo não tem etiqueta: a cliente contrata o transporte"
                            : "Gera a etiqueta na transportadora (requer credenciais configuradas)"
                        }
                        className="border border-eclat-grafite/40 text-xs uppercase tracking-widest px-4 py-2.5 rounded-md hover:bg-eclat-areia/40 disabled:opacity-50"
                      >
                        Gerar etiqueta (SuperFrete)
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
                      {det.metadata?.conferencia && (
                        <span className={det.metadata.conferencia.status === "ok" ? "text-green-900" : "text-amber-800"} data-testid="registro-conferencia">
                          {det.metadata.conferencia.status === "ok" ? "Peças conferidas com o leitor" : `Despachado com divergência: ${det.metadata.conferencia.motivo ?? ""}`}
                          {det.metadata.conferencia.operador_email ? ` · ${det.metadata.conferencia.operador_email}` : ""}
                          {` · ${dataHora(det.metadata.conferencia.em)}`}
                        </span>
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
