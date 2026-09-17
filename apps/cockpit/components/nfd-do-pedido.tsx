"use client"

import { useState } from "react"
import { rotuloStatus, statusBloqueiaDevolucao, type StatusDocumento } from "@/lib/fiscal"
import { montarItensDevolvidos, type ItemDevolvido } from "@/lib/fiscal-devolucao"

// Botão manual "Emitir NFD" (spec §3, decisão do controlador na Task 14 — o brief não menciona,
// mas a spec põe no escopo e a rota já existe no backend). Lista os itens do pedido com campo de
// quantidade (0 = não devolver) e chama POST /api/fiscal/emitir-devolucao PELO PROXY — essa rota
// está na allowlist de lib/fiscal.ts, ao contrário de "emitir" (venda), que só o servidor chama.
// Só libera quando o documento de venda está "verificado" (statusBloqueiaDevolucao); bloqueado,
// explica o motivo em vez de só desabilitar o botão.

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

  async function emitir() {
    const montagem = montarItensDevolvidos(
      itens.map((i) => ({ item_id: i.line_item_id, quantidade_pedido: i.quantidade_pedido })),
      quantidades
    )
    if (!montagem.ok) {
      setErro(montagem.erro)
      return
    }
    if (!confirm("Emitir NFD (nota fiscal de devolução) para os itens selecionados? Essa ação transmite a nota à SEFAZ.")) {
      return
    }
    setOcupado(true)
    setErro(null)
    setResultado(null)
    try {
      const r = await fetch("/api/fiscal/emitir-devolucao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, itens: montagem.itens satisfies ItemDevolvido[] }),
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
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className="border border-eclat-pedra/40 rounded-lg p-4 bg-white/60 flex flex-col gap-3">
      <h4 className="text-xs uppercase tracking-wider text-eclat-grafite/60">Devolução (NFD)</h4>

      {bloqueado ? (
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-300 rounded-md p-2">{motivoBloqueio()}</p>
      ) : (
        <>
          <div className="border border-eclat-pedra/30 rounded-md overflow-hidden bg-white">
            <table className="w-full text-sm">
              <tbody>
                {itens.map((i) => (
                  <tr key={i.line_item_id} className="border-b border-eclat-pedra/10 last:border-0">
                    <td className="px-3 py-2">
                      <div>{i.titulo}</div>
                      <div className="text-xs text-eclat-grafite/50">{i.variante} · pedido: {i.quantidade_pedido}×</div>
                    </td>
                    <td className="px-3 py-2 text-right w-24">
                      <input
                        type="number"
                        min={0}
                        max={i.quantidade_pedido}
                        value={quantidades[i.line_item_id] ?? 0}
                        onChange={(e) =>
                          setQuantidades((q) => ({ ...q, [i.line_item_id]: Number(e.target.value) }))
                        }
                        disabled={ocupado}
                        className="w-20 border border-eclat-pedra/50 rounded-md px-2 py-1 text-sm text-right bg-white focus:outline-none focus:border-eclat-dourado"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={emitir}
            disabled={ocupado}
            className="self-start bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-xs px-4 py-2 rounded-md hover:bg-eclat-dourado hover:text-eclat-grafite disabled:opacity-50"
          >
            {ocupado ? "Emitindo…" : "Emitir NFD"}
          </button>
        </>
      )}

      {erro && <p className="text-sm text-red-800">{erro}</p>}

      {resultado && (
        <div className="text-sm bg-white border border-eclat-pedra/40 rounded-md p-2">
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
            <p className="break-all font-mono text-xs text-eclat-grafite/60 mt-1">{resultado.chave_acesso}</p>
          )}
        </div>
      )}
    </section>
  )
}
