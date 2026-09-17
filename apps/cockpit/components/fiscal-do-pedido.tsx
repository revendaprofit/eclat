"use client"

import { useState } from "react"
import { rotuloStatus, corDoStatus, statusBloqueiaDevolucao, type StatusDocumento } from "@/lib/fiscal"

// Status fiscal do pedido (Task 14). Mostra o documento de venda (montado na emissão que roda
// dentro do despacho, app/api/orders/[id]/dispatch/route.ts) e, quando aplicável, deixa o
// operador reconciliar pelo proxy /api/fiscal/reconciliar (rota permitida na allowlist).

export type DocumentoFiscal = {
  id: string
  status: StatusDocumento
  serie: number | null
  numero: number | null
  chave_acesso: string | null
  rejeicao_codigo: string | null
  rejeicao_motivo: string | null
}

const CORES_STATUS: Record<"verde" | "amarelo" | "vermelho", string> = {
  verde: "bg-emerald-100 text-emerald-900",
  amarelo: "bg-amber-100 text-amber-900",
  vermelho: "bg-red-100 text-red-900",
}

export function FiscalDoPedido({
  documento,
  erroCarregar,
  onAtualizado,
  onTentarNovamente,
}: {
  documento: DocumentoFiscal | null
  // Falha ao BUSCAR o documento (rede/servidor) — diferente de "não existe nota" (achado da
  // revisão: um `.catch` que trata as duas situações igual faria o operador achar que o pedido
  // não tem nota quando na verdade só a consulta falhou.
  erroCarregar?: string | null
  onAtualizado?: () => void
  onTentarNovamente?: () => void
}) {
  const [ocupado, setOcupado] = useState(false)
  const [erroReconciliar, setErroReconciliar] = useState<string | null>(null)

  if (erroCarregar) {
    return (
      <section className="border border-red-200 bg-red-50 rounded-lg p-4 flex flex-col gap-1">
        <h4 className="text-xs uppercase tracking-wider text-red-800/80 mb-1">Nota fiscal</h4>
        <p className="text-sm text-red-800">{erroCarregar}</p>
        {onTentarNovamente && (
          <button type="button" onClick={onTentarNovamente} className="self-start text-sm text-red-800 underline">
            Tentar de novo
          </button>
        )}
      </section>
    )
  }

  if (!documento) {
    return (
      <section className="border border-eclat-pedra/40 rounded-lg p-4 bg-white/60">
        <h4 className="text-xs uppercase tracking-wider text-eclat-grafite/60 mb-1">Nota fiscal</h4>
        <p className="text-sm text-eclat-grafite/50">Nenhuma nota fiscal emitida para este pedido.</p>
      </section>
    )
  }

  async function reconciliar() {
    setOcupado(true)
    setErroReconciliar(null)
    try {
      const r = await fetch("/api/fiscal/reconciliar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documento_id: documento!.id }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || "Falha ao reconciliar.")
      onAtualizado?.()
    } catch (e) {
      setErroReconciliar((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className="border border-eclat-pedra/40 rounded-lg p-4 bg-white/60 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h4 className="text-xs uppercase tracking-wider text-eclat-grafite/60">Nota fiscal</h4>
        <span className={`text-[11px] px-2 py-0.5 rounded-full ${CORES_STATUS[corDoStatus(documento.status)]}`}>
          {rotuloStatus(documento.status)}
        </span>
      </div>

      {documento.numero != null && (
        <p className="text-sm text-eclat-grafite">
          NF-e nº {documento.numero} · série {documento.serie}
        </p>
      )}

      {documento.chave_acesso && (
        <p className="break-all font-mono text-xs text-eclat-grafite/60">{documento.chave_acesso}</p>
      )}

      {documento.rejeicao_motivo && (
        <p className="text-sm text-red-800">
          {documento.rejeicao_motivo}
          {documento.rejeicao_codigo ? ` (código ${documento.rejeicao_codigo})` : ""}
        </p>
      )}

      {documento.chave_acesso && (
        <div className="flex gap-3 text-sm">
          <a
            className="text-eclat-dourado underline"
            href={`/api/fiscal-danfe/${documento.id}`}
            target="_blank"
            rel="noreferrer"
          >
            Baixar DANFE (PDF)
          </a>
        </div>
      )}

      {statusBloqueiaDevolucao(documento.status) && (
        <div className="border border-amber-300 bg-amber-50 rounded-md p-2 text-sm text-amber-900">
          <p>Devolução bloqueada até a reconciliação (o nItem da SEFAZ ainda não foi lido).</p>
          <button
            type="button"
            onClick={reconciliar}
            disabled={ocupado}
            className="mt-1 underline disabled:opacity-50"
          >
            {ocupado ? "Reconciliando…" : "Reconciliar agora"}
          </button>
          {erroReconciliar && <p className="mt-1 text-red-800">{erroReconciliar}</p>}
        </div>
      )}
    </section>
  )
}
