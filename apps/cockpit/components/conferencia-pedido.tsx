"use client"

import { useMemo } from "react"
import CampoLeitor from "@/components/campo-leitor"
import { avaliarLeitura, resumoConferencia, type ItemPedido, type StatusLinha } from "@/lib/leitor"

// Conferência do pedido antes de despachar (spec leitor-codigo-barras F1). Estado (leituras e motivo)
// fica no pai, que envia tudo para a rota de despacho — o servidor refaz a conta com os itens reais.

const STATUS: Record<StatusLinha, { txt: string; cls: string }> = {
  ok: { txt: "conferido", cls: "bg-green-100 text-green-800" },
  faltando: { txt: "faltando", cls: "bg-amber-100 text-amber-800" },
  excedente: { txt: "a mais", cls: "bg-red-100 text-red-700" },
  sem_codigo: { txt: "sem código", cls: "bg-eclat-areia text-eclat-grafite" },
}

async function descreverCodigo(codigo: string): Promise<string> {
  try {
    const r = await fetch(`/api/leitor/variante?codigo=${encodeURIComponent(codigo)}`, { cache: "no-store" })
    if (!r.ok) return `${codigo} (não está no catálogo)`
    const { variante } = await r.json()
    return `${variante.produto}${variante.tamanho || variante.cor ? ` ${[variante.tamanho, variante.cor].filter(Boolean).join(" / ")}` : ""} (${codigo})`
  } catch {
    return codigo
  }
}

export default function ConferenciaPedido({
  itens,
  leituras,
  onLeituras,
  motivo,
  onMotivo,
  disabled,
}: {
  itens: ItemPedido[]
  leituras: string[]
  onLeituras: (l: string[]) => void
  motivo: string
  onMotivo: (m: string) => void
  disabled?: boolean
}) {
  const resumo = useMemo(() => resumoConferencia(itens, leituras), [itens, leituras])

  async function aoLer(codigo: string) {
    const r = avaliarLeitura(itens, leituras, codigo)
    if (r.tipo === "invalido") return { sinal: "erro" as const, mensagem: "Leitura vazia. Bipe de novo." }
    onLeituras([...leituras, codigo])
    if (r.tipo === "ok") {
      return { sinal: "ok" as const, mensagem: r.faltam > 0 ? `✓ ${r.sku} conferido. Falta mais ${r.faltam} dessa peça.` : `✓ ${r.sku} conferido.` }
    }
    if (r.tipo === "excedente") return { sinal: "aviso" as const, mensagem: `${r.sku} já foi conferido. Essa leitura está a mais.` }
    return { sinal: "erro" as const, mensagem: `✕ Não é deste pedido: ${await descreverCodigo(r.sku)}` }
  }

  return (
    <div className="flex flex-col gap-3" data-testid="conferencia-pedido">
      <div className="flex items-baseline justify-between">
        <h5 className="text-xs uppercase tracking-wider text-eclat-grafite/60">Conferir peças</h5>
        <span className="text-xs text-eclat-grafite/60">
          {resumo.pecasBipadas} de {resumo.pecasEsperadas} bipadas
        </span>
      </div>

      <CampoLeitor onLeitura={aoLer} disabled={disabled} />

      <div className="border border-eclat-pedra/30 rounded-md overflow-hidden bg-white">
        <table className="w-full text-sm">
          <tbody>
            {resumo.linhas.map((l, i) => (
              <tr key={`${l.sku ?? "sem"}-${i}`} className="border-b border-eclat-pedra/10 last:border-0">
                <td className="px-3 py-2">
                  <div>{l.titulo}</div>
                  <div className="text-xs text-eclat-grafite/50">
                    {l.variante}
                    {l.sku && <span className="font-mono ml-1">· {l.sku}</span>}
                  </div>
                </td>
                <td className="px-3 py-2 text-center whitespace-nowrap">
                  {l.bipado}/{l.esperado}
                </td>
                <td className="px-3 py-2 text-right">
                  <span className={`text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 ${STATUS[l.status].cls}`}>{STATUS[l.status].txt}</span>
                </td>
              </tr>
            ))}
            {resumo.foraDoPedido.map((f) => (
              <tr key={`fora-${f.codigo}`} className="border-b border-eclat-pedra/10 last:border-0 bg-red-50">
                <td className="px-3 py-2 text-red-700">
                  <div className="font-mono text-xs">{f.codigo}</div>
                  <div className="text-xs">não é deste pedido: separe e troque a peça</div>
                </td>
                <td className="px-3 py-2 text-center text-red-700">{f.vezes}×</td>
                <td className="px-3 py-2 text-right">
                  <span className="text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 bg-red-100 text-red-700">errada</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onLeituras(leituras.slice(0, -1))}
          disabled={disabled || leituras.length === 0}
          className="border border-eclat-grafite/30 text-xs px-3 py-1.5 rounded-md hover:bg-eclat-areia/40 disabled:opacity-40"
        >
          Desfazer última
        </button>
        <button
          type="button"
          onClick={() => onLeituras([])}
          disabled={disabled || leituras.length === 0}
          className="border border-eclat-grafite/30 text-xs px-3 py-1.5 rounded-md hover:bg-eclat-areia/40 disabled:opacity-40"
        >
          Recomeçar
        </button>
      </div>

      {resumo.completa ? (
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-md px-3 py-2" data-testid="conferencia-ok">
          ✓ Todas as peças conferidas. Pode despachar.
        </p>
      ) : (
        <label className="flex flex-col gap-1 text-xs text-eclat-grafite/70">
          A conferência ainda não fechou. Para despachar mesmo assim, explique o motivo:
          <textarea
            value={motivo}
            onChange={(e) => onMotivo(e.target.value)}
            disabled={disabled}
            rows={2}
            placeholder="Ex.: etiqueta da peça danificada, conferida pelo tamanho na costura"
            data-testid="conferencia-motivo"
            className="border border-eclat-pedra/50 rounded-md px-3 py-2 text-sm bg-white text-eclat-grafite focus:outline-none focus:border-eclat-dourado"
          />
        </label>
      )}
    </div>
  )
}
