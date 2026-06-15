"use client"

import { useMemo, useState } from "react"
import * as XLSX from "xlsx"

// Campos-alvo da importação. SKU é a chave de casamento.
const CAMPOS = [
  { key: "sku", label: "SKU (chave)", dica: ["sku", "codigo", "código", "ref"] },
  { key: "titulo", label: "Título do produto", dica: ["titulo", "título", "produto", "nome"] },
  { key: "descricao", label: "Descrição", dica: ["descricao", "descrição", "desc"] },
  { key: "colecao", label: "Coleção", dica: ["colecao", "coleção", "collection"] },
  { key: "categoria", label: "Categoria", dica: ["categoria", "category"] },
  { key: "tamanho", label: "Tamanho", dica: ["tamanho", "size"] },
  { key: "cor", label: "Cor", dica: ["cor", "color"] },
  { key: "preco", label: "Preço (R$)", dica: ["preco", "price", "venda"] },
  { key: "custo", label: "Custo (R$)", dica: ["custo", "cost", "cogs"] },
  { key: "estoque", label: "Estoque", dica: ["estoque", "stock", "qtd", "quantidade"] },
  { key: "status", label: "Status", dica: ["status", "situacao"] },
] as const

// normaliza p/ comparar cabeçalhos sem acento/caixa (ex.: "Título" ~ "titulo")
const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()

type CampoKey = (typeof CAMPOS)[number]["key"]

export default function ImportDialog({
  onClose,
  onDone,
}: {
  onClose: () => void
  onDone: () => void
}) {
  const [headers, setHeaders] = useState<string[]>([])
  const [linhas, setLinhas] = useState<string[][]>([])
  const [mapa, setMapa] = useState<Record<CampoKey, number>>({} as Record<CampoKey, number>)
  const [fileName, setFileName] = useState("")
  const [importando, setImportando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<{
    atualizados: number
    criados: number
    custos: number
    pulados: { ref: string; motivo: string }[]
  } | null>(null)

  function autoMapear(hs: string[]) {
    const m = {} as Record<CampoKey, number>
    const norms = hs.map(semAcento)
    for (const campo of CAMPOS) {
      const idx = norms.findIndex((h) => campo.dica.some((d) => h.includes(semAcento(d))))
      if (idx >= 0) m[campo.key] = idx
    }
    return m
  }

  async function lerArquivo(file: File) {
    setErro(null)
    setResultado(null)
    setFileName(file.name)
    try {
      const buf = await file.arrayBuffer()
      // CSV → decodifica como UTF-8 (evita acentos quebrados); xlsx → binário.
      const isCsv = /\.csv$/i.test(file.name) || file.type.includes("csv")
      const wb = isCsv
        ? XLSX.read(new TextDecoder("utf-8").decode(buf), { type: "string" })
        : XLSX.read(buf, { type: "array" })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const aoa = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false, raw: false })
      if (!aoa.length) throw new Error("Planilha vazia.")
      const hs = (aoa[0] as string[]).map((h) => String(h ?? ""))
      const body = (aoa.slice(1) as string[][]).filter((r) => r.some((c) => String(c ?? "").trim()))
      setHeaders(hs)
      setLinhas(body)
      setMapa(autoMapear(hs))
    } catch (e) {
      setErro((e as Error).message)
      setHeaders([])
      setLinhas([])
    }
  }

  const semSku = mapa.sku === undefined
  const cel = (linha: string[], k: CampoKey) =>
    mapa[k] !== undefined ? String(linha[mapa[k]] ?? "").trim() : ""

  const preview = useMemo(() => linhas.slice(0, 8), [linhas])

  async function importar() {
    if (semSku) {
      setErro("Mapeie a coluna de SKU (é a chave de casamento).")
      return
    }
    setImportando(true)
    setErro(null)
    try {
      const rows = linhas.map((l) => {
        const o: Record<string, string> = {}
        for (const campo of CAMPOS) o[campo.key] = cel(l, campo.key)
        return o
      })
      const r = await fetch("/api/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || "Falha na importação")
      setResultado(d)
      onDone()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setImportando(false)
    }
  }

  const selectCls =
    "border border-eclat-pedra/50 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:border-eclat-dourado"

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-start bg-black/40 overflow-y-auto p-6" onClick={onClose}>
      <div
        className="w-full max-w-4xl bg-eclat-luz rounded-lg shadow-xl my-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-eclat-luz border-b border-eclat-pedra/30 px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h2 className="font-serif text-2xl text-eclat-grafite">Importar planilha de produtos</h2>
          <button onClick={onClose} className="text-eclat-grafite/50 hover:text-eclat-grafite text-xl">✕</button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          {erro && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">{erro}</p>
          )}

          {resultado ? (
            <div className="flex flex-col gap-3">
              <div className="bg-green-50 border border-green-200 rounded-md p-4 text-sm text-green-900">
                ✓ Importação concluída — <b>{resultado.atualizados}</b> variação(ões) atualizada(s),{" "}
                <b>{resultado.criados}</b> produto(s) criado(s), <b>{resultado.custos}</b> custo(s) gravado(s).
              </div>
              {resultado.pulados.length > 0 && (
                <div className="border border-amber-300 bg-amber-50 rounded-md p-3 text-xs text-amber-900 max-h-48 overflow-y-auto">
                  <p className="font-medium mb-1">{resultado.pulados.length} linha(s)/grupo(s) pulado(s):</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {resultado.pulados.map((p, i) => (
                      <li key={i}><b>{p.ref}</b> — {p.motivo}</li>
                    ))}
                  </ul>
                </div>
              )}
              <button onClick={onClose} className="self-start bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-xs px-6 py-3 rounded-md hover:bg-eclat-dourado hover:text-eclat-grafite">
                Fechar
              </button>
            </div>
          ) : (
            <>
              <div>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv"
                  onChange={(e) => e.target.files?.[0] && lerArquivo(e.target.files[0])}
                  className="text-sm"
                />
                {fileName && <span className="text-xs text-eclat-grafite/50 ml-2">{fileName} · {linhas.length} linha(s)</span>}
              </div>

              {headers.length > 0 && (
                <>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-eclat-grafite/60 mb-2">
                      Mapeamento de colunas <span className="text-eclat-grafite/40">(casa por SKU: existente atualiza; novo cria produto)</span>
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {CAMPOS.map((campo) => (
                        <label key={campo.key} className="flex flex-col gap-1">
                          <span className="text-xs text-eclat-grafite/70">
                            {campo.label}
                            {campo.key === "sku" && <span className="text-red-600"> *</span>}
                          </span>
                          <select
                            value={mapa[campo.key] ?? ""}
                            onChange={(e) =>
                              setMapa((prev) => {
                                const n = { ...prev }
                                if (e.target.value === "") delete n[campo.key]
                                else n[campo.key] = Number(e.target.value)
                                return n
                              })
                            }
                            className={selectCls}
                          >
                            <option value="">— ignorar —</option>
                            {headers.map((h, i) => (
                              <option key={i} value={i}>{h || `coluna ${i + 1}`}</option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wider text-eclat-grafite/60 mb-2">Pré-visualização (até 8 linhas)</p>
                    <div className="overflow-x-auto border border-eclat-pedra/40 rounded-md">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-eclat-areia/40 text-left">
                            {CAMPOS.filter((c) => mapa[c.key] !== undefined).map((c) => (
                              <th key={c.key} className="px-2 py-1 font-medium whitespace-nowrap">{c.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {preview.map((l, i) => (
                            <tr key={i} className="border-t border-eclat-pedra/15">
                              {CAMPOS.filter((c) => mapa[c.key] !== undefined).map((c) => (
                                <td key={c.key} className="px-2 py-1 whitespace-nowrap">{cel(l, c.key) || <span className="text-eclat-grafite/30">—</span>}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={importar}
                      disabled={importando || semSku}
                      className="bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-xs px-6 py-3 rounded-md hover:bg-eclat-dourado hover:text-eclat-grafite disabled:opacity-50"
                    >
                      {importando ? "Importando…" : `Importar ${linhas.length} linha(s)`}
                    </button>
                    {semSku && <span className="text-xs text-red-600">Mapeie o SKU para continuar.</span>}
                    <span className="text-xs text-eclat-grafite/50">Produtos novos entram como rascunho.</span>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
