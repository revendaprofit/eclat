"use client"

import { useState } from "react"
import { rotuloStatus, statusBloqueiaDevolucao, type StatusDocumento } from "@/lib/fiscal"
import { montarItensDevolvidos, resumoValido, type ItemDevolvido, type ResumoDevolucao } from "@/lib/fiscal-devolucao"

// Botão manual "Emitir NFD" (spec §3, decisão do controlador na Task 14 — o brief não menciona,
// mas a spec põe no escopo e a rota já existe no backend). Lista os itens do pedido com campo de
// quantidade (0 = não devolver) e chama POST /api/fiscal/emitir-devolucao PELO PROXY — essa rota
// está na allowlist de lib/fiscal.ts, ao contrário de "emitir" (venda), que só o servidor chama.
// Só libera quando o documento de venda está "verificado" (statusBloqueiaDevolucao); bloqueado,
// explica o motivo em vez de só desabilitar o botão.
//
// Emitir é transmissão IRREVERSÍVEL à SEFAZ — categoria de risco diferente de excluir um produto
// (achado da revisão: um `confirm()` sozinho não é proporcional a isso). Por isso o fluxo tem dois
// passos: "Ver prévia" (previa: true, não transmite nada) mostra itens/quantidades/valores/desconto
// rateado; só depois disso o botão "Emitir NFD" aparece. Qualquer mudança de quantidade invalida a
// prévia e esconde o botão de emitir de novo, para o operador nunca conferir uma coisa e emitir
// outra.

export type ItemParaDevolucao = {
  line_item_id: string
  titulo: string
  variante: string | null
  quantidade_pedido: number
}

type ResultadoNfd = {
  status: StatusDocumento
  numero: number | null
  chave_acesso: string | null
  rejeicao_codigo: string | null
  rejeicao_motivo: string | null
}

// O resumo vem do backend em centavos inteiros (Invariante 3) — só formata para exibir.
function brl(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export function NfdDoPedido({
  orderId,
  statusDocumentoVenda,
  itens,
}: {
  orderId: string
  statusDocumentoVenda: StatusDocumento | null
  itens: ItemParaDevolucao[]
}) {
  const [quantidades, setQuantidades] = useState<Record<string, number>>({})
  const [previa, setPrevia] = useState<ResumoDevolucao | null>(null)
  const [previaOcupada, setPreviaOcupada] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoNfd | null>(null)

  const bloqueado = statusDocumentoVenda === null || statusBloqueiaDevolucao(statusDocumentoVenda)

  function motivoBloqueio(): string {
    if (statusDocumentoVenda === null) {
      return "Ainda não há nota de venda emitida para este pedido — a NFD referencia a nota de venda."
    }
    return `A nota de venda está "${rotuloStatus(statusDocumentoVenda)}" — a devolução só é liberada depois da reconciliação (status "Verificado").`
  }

  function mudarQuantidade(itemId: string, valor: number) {
    setQuantidades((q) => ({ ...q, [itemId]: valor }))
    // Qualquer alteração invalida a prévia já vista e esconde "Emitir NFD" de novo.
    setPrevia(null)
    setResultado(null)
  }

  function montarOuAvisar() {
    const montagem = montarItensDevolvidos(
      itens.map((i) => ({ item_id: i.line_item_id, quantidade_pedido: i.quantidade_pedido })),
      quantidades
    )
    if (!montagem.ok) {
      setErro(montagem.erro)
      return null
    }
    return montagem.itens
  }

  async function verPrevia() {
    const itensDevolvidos = montarOuAvisar()
    if (!itensDevolvidos) return
    setPreviaOcupada(true)
    setErro(null)
    setPrevia(null)
    setResultado(null)
    try {
      const r = await fetch("/api/fiscal/emitir-devolucao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, itens: itensDevolvidos satisfies ItemDevolvido[], previa: true }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !resumoValido(d.resumo)) throw new Error(d.error || "Falha ao montar a prévia da NFD.")
      setPrevia(d.resumo)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setPreviaOcupada(false)
    }
  }

  async function emitir() {
    const itensDevolvidos = montarOuAvisar()
    if (!itensDevolvidos || !previa) return
    const totalTxt = brl(previa.total_centavos)
    if (!confirm(`Emitir NFD no valor de ${totalTxt}? Essa ação transmite a nota à SEFAZ e não pode ser desfeita.`)) {
      return
    }
    setOcupado(true)
    setErro(null)
    setResultado(null)
    try {
      const r = await fetch("/api/fiscal/emitir-devolucao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, itens: itensDevolvidos satisfies ItemDevolvido[] }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.documento) throw new Error(d.error || "Falha ao emitir a NFD.")
      setResultado({
        status: d.documento.status,
        numero: d.documento.numero,
        chave_acesso: d.documento.chave_acesso,
        rejeicao_codigo: d.documento.rejeicao_codigo,
        rejeicao_motivo: d.documento.rejeicao_motivo,
      })
      setQuantidades({})
      setPrevia(null)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className="border border-eclat-pedra/40 rounded-lg p-4 bg-white/60 flex flex-col gap-3">
      <h4 className="text-meta uppercase tracking-wider text-eclat-texto-3">Devolução (NFD)</h4>

      {bloqueado ? (
        <p className="text-corpo text-amber-900 bg-amber-50 border border-amber-300 rounded-md p-2">{motivoBloqueio()}</p>
      ) : (
        <>
          <div className="border border-eclat-pedra/30 rounded-md overflow-hidden bg-white">
            <table className="w-full text-corpo">
              <tbody>
                {itens.map((i) => (
                  <tr key={i.line_item_id} className="border-b border-eclat-pedra/10 last:border-0">
                    <td className="px-3 py-2">
                      <div>{i.titulo}</div>
                      <div className="text-meta text-eclat-texto-3">{i.variante} · pedido: {i.quantidade_pedido}×</div>
                    </td>
                    <td className="px-3 py-2 text-right w-24">
                      <input
                        type="number"
                        min={0}
                        max={i.quantidade_pedido}
                        value={quantidades[i.line_item_id] ?? 0}
                        onChange={(e) => mudarQuantidade(i.line_item_id, Number(e.target.value))}
                        disabled={ocupado || previaOcupada}
                        className="w-20 border border-eclat-pedra/50 rounded-md px-2 py-1 text-corpo text-right bg-white focus:outline-none focus:border-eclat-dourado"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={verPrevia}
              disabled={previaOcupada || ocupado}
              className="self-start border border-eclat-grafite/40 uppercase tracking-widest text-meta px-4 py-2 rounded-md hover:bg-eclat-areia/40 disabled:opacity-50"
            >
              {previaOcupada ? "Montando prévia…" : "Ver prévia"}
            </button>
            {previa && (
              <button
                type="button"
                onClick={emitir}
                disabled={ocupado}
                className="self-start bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-meta px-4 py-2 rounded-md hover:bg-eclat-dourado hover:text-eclat-texto disabled:opacity-50"
              >
                {ocupado ? "Emitindo…" : "Emitir NFD"}
              </button>
            )}
          </div>

          {previa && (
            <div className="border border-eclat-pedra/30 rounded-md p-3 bg-white text-corpo flex flex-col gap-2">
              <p className="text-meta uppercase tracking-wider text-eclat-texto-3">Prévia da devolução (nada foi transmitido)</p>
              <table className="w-full text-corpo">
                <tbody>
                  {previa.itens.map((it, idx) => (
                    <tr key={idx} className="border-b border-eclat-pedra/10 last:border-0">
                      <td className="py-1">{it.descricao} <span className="text-meta text-eclat-texto-3">({it.codigo})</span></td>
                      <td className="py-1 text-center">{it.quantidade}×</td>
                      <td className="py-1 text-right text-eclat-texto-3">{brl(it.desconto_centavos)} desc.</td>
                      <td className="py-1 text-right font-medium">{brl(it.liquido_centavos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-between border-t border-eclat-pedra/20 pt-2 font-medium">
                <span>Total da NFD (produtos {brl(previa.produtos_centavos)} − desconto {brl(previa.desconto_centavos)})</span>
                <span>{brl(previa.total_centavos)}</span>
              </div>
            </div>
          )}
        </>
      )}

      {erro && <p className="text-corpo text-red-800">{erro}</p>}

      {resultado && (
        <div className="text-corpo bg-white border border-eclat-pedra/40 rounded-md p-2">
          {resultado.status === "rejeitado" || resultado.status === "denegado" ? (
            <p className="text-red-800">
              NFD {resultado.status}: {resultado.rejeicao_motivo ?? "sem motivo informado"}
              {resultado.rejeicao_codigo ? ` (código ${resultado.rejeicao_codigo})` : ""}
            </p>
          ) : (
            <p className="text-emerald-900">
              NFD emitida{resultado.numero != null ? ` — nº ${resultado.numero}` : ""} ({rotuloStatus(resultado.status)}).
            </p>
          )}
          {resultado.chave_acesso && (
            <p className="break-all font-mono text-meta text-eclat-texto-3 mt-1">{resultado.chave_acesso}</p>
          )}
        </div>
      )}
    </section>
  )
}
