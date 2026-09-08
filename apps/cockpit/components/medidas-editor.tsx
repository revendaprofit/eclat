"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

// Vitrine → Medidas. Uma tabela por categoria (chave = caminho de handle). Subcategoria
// sem tabela herda a da mãe na vitrine; acessórios podem ficar sem tabela.
type Cat = { id: string; name: string; handle: string; parent_id: string | null; rank: number }
// Formato salvo em site_content.medidas (task 3): linhas como string[], rows[i][0] = tamanho.
type WireTable = { columns: string[]; rows: string[][] }
// Formato interno: cada linha ganha um id estável, para não perder o foco/digitação
// ao remover uma linha acima de outra que está sendo editada.
type Row = { id: string; cells: string[] }
type Table = { columns: string[]; rows: Row[] }

let idSeq = 0
function newId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID()
  idSeq += 1
  return `row-${idSeq}`
}
function toWire(t: Table): WireTable {
  return { columns: t.columns, rows: t.rows.map((r) => r.cells) }
}
function fromWire(w: WireTable): Table {
  return { columns: w.columns, rows: w.rows.map((cells) => ({ id: newId(), cells })) }
}

const PADRAO: Record<string, WireTable> = {
  tops: { columns: ["Busto", "Cintura"], rows: [["P", "82–88 cm", "62–68 cm"], ["M", "88–94 cm", "68–74 cm"], ["G", "94–100 cm", "74–80 cm"], ["GG", "100–108 cm", "80–88 cm"]] },
  shorts: { columns: ["Cintura", "Quadril"], rows: [["P", "62–68 cm", "88–94 cm"], ["M", "68–74 cm", "94–100 cm"], ["G", "74–80 cm", "100–106 cm"], ["GG", "80–88 cm", "106–114 cm"]] },
  leggings: { columns: ["Cintura", "Quadril"], rows: [["P", "62–68 cm", "88–94 cm"], ["M", "68–74 cm", "94–100 cm"], ["G", "74–80 cm", "100–106 cm"], ["GG", "80–88 cm", "106–114 cm"]] },
  macaquinhos: { columns: ["Busto", "Cintura", "Quadril"], rows: [["P", "82–88 cm", "62–68 cm", "88–94 cm"], ["M", "88–94 cm", "68–74 cm", "94–100 cm"], ["G", "94–100 cm", "74–80 cm", "100–106 cm"], ["GG", "100–108 cm", "80–88 cm", "106–114 cm"]] },
}

export default function MedidasEditor() {
  const [cats, setCats] = useState<Cat[]>([])
  const [map, setMap] = useState<Record<string, Table>>({})
  const [sel, setSel] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [catsRes, medRes] = await Promise.all([
        fetch("/api/taxonomy/categories", { cache: "no-store" }),
        fetch("/api/site-content/medidas", { cache: "no-store" }),
      ])
      const catsBody = await catsRes.json().catch(() => null)
      const medBody = await medRes.json().catch(() => null)
      if (!catsRes.ok || !Array.isArray(catsBody)) {
        const msg = catsBody && typeof catsBody === "object" && "error" in catsBody && typeof (catsBody as { error?: unknown }).error === "string" ? (catsBody as { error: string }).error : null
        throw new Error(msg || "Falha ao carregar categorias do servidor.")
      }
      if (!medRes.ok || !medBody || typeof medBody !== "object" || Array.isArray(medBody) || "error" in medBody) {
        const msg = medBody && typeof medBody === "object" && "error" in medBody && typeof (medBody as { error?: unknown }).error === "string" ? (medBody as { error: string }).error : null
        throw new Error(msg || "Falha ao carregar medidas do servidor.")
      }
      setCats(catsBody as Cat[])
      const wireMap = medBody as Record<string, WireTable>
      const nextMap: Record<string, Table> = {}
      for (const [k, v] of Object.entries(wireMap)) nextMap[k] = fromWire(v)
      setMap(nextMap)
    } catch (e) {
      setCats([])
      setMap({})
      setLoadError((e as Error).message || "Falha ao carregar dados do servidor.")
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    carregar()
  }, [carregar])

  // caminhos "mae/filha" na ordem da árvore
  const caminhos = useMemo(() => {
    const byId = new Map(cats.map((c) => [c.id, c]))
    const path = (c: Cat): string => (c.parent_id && byId.get(c.parent_id) ? `${path(byId.get(c.parent_id)!)}/${c.handle}` : c.handle)
    return [...cats]
      .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
      .map((c) => ({ key: path(c), label: c.parent_id ? `↳ ${c.name}` : c.name, depth: c.parent_id ? 1 : 0 }))
      .sort((a, b) => a.key.localeCompare(b.key))
  }, [cats])

  useEffect(() => {
    if (!sel && caminhos.length) setSel(caminhos[0].key)
  }, [caminhos, sel])

  const tabela = map[sel]
  function setTabela(t: Table | null) {
    const next = { ...map }
    if (t) next[sel] = t
    else delete next[sel]
    setMap(next)
  }
  function setCol(i: number, v: string) {
    if (!tabela) return
    setTabela({ ...tabela, columns: tabela.columns.map((c, j) => (j === i ? v : c)) })
  }
  function setCell(rowId: string, cellIdx: number, v: string) {
    if (!tabela) return
    setTabela({
      ...tabela,
      rows: tabela.rows.map((row) => (row.id === rowId ? { ...row, cells: row.cells.map((x, j) => (j === cellIdx ? v : x)) } : row)),
    })
  }
  function addCol() {
    if (!tabela) return
    setTabela({ columns: [...tabela.columns, "Medida"], rows: tabela.rows.map((r) => ({ ...r, cells: [...r.cells, ""] })) })
  }
  function delCol(i: number) {
    if (!tabela) return
    setTabela({ columns: tabela.columns.filter((_, j) => j !== i), rows: tabela.rows.map((r) => ({ ...r, cells: r.cells.filter((_, j) => j !== i + 1) })) })
  }
  function addRow() {
    if (!tabela) return
    setTabela({ ...tabela, rows: [...tabela.rows, { id: newId(), cells: ["", ...tabela.columns.map(() => "")] }] })
  }
  function delRow(rowId: string) {
    if (!tabela) return
    setTabela({ ...tabela, rows: tabela.rows.filter((r) => r.id !== rowId) })
  }
  function criar() {
    const wire = PADRAO[sel] ?? { columns: ["Cintura", "Quadril"], rows: [["P", "", ""], ["M", "", ""], ["G", "", ""], ["GG", "", ""]] }
    setTabela(fromWire(wire))
  }
  async function salvar() {
    setSaving(true)
    try {
      const wireMap: Record<string, WireTable> = {}
      for (const [k, v] of Object.entries(map)) wireMap[k] = toWire(v)
      const r = await fetch("/api/site-content/medidas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(wireMap),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || "Falha ao salvar")
      alert("Medidas salvas! A vitrine atualiza em até ~30s.")
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    "w-full border border-eclat-pedra/50 rounded-md px-2 py-1 text-sm bg-white focus:outline-none focus:border-eclat-dourado"
  if (loading) return <p className="text-sm text-eclat-grafite/50">Carregando medidas…</p>

  if (loadError) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-red-700">
          Não foi possível carregar as medidas atuais ({loadError}). Salvar agora poderia apagar dados já cadastrados,
          então isso foi bloqueado.
        </p>
        <button onClick={carregar} className="self-start text-xs text-eclat-dourado underline">
          tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <label className="text-xs uppercase tracking-wider text-eclat-grafite/60">Categoria</label>
        <select value={sel} onChange={(e) => setSel(e.target.value)} className={inputCls + " max-w-xs"}>
          {caminhos.map((c) => (
            <option key={c.key} value={c.key}>{c.depth ? "   " : ""}{c.label} ({c.key})</option>
          ))}
        </select>
        {map[sel] ? (
          <span className="text-xs text-green-700">tem tabela própria</span>
        ) : (
          <span className="text-xs text-eclat-grafite/50">sem tabela (herda da mãe, se houver)</span>
        )}
      </div>

      {!tabela ? (
        <button onClick={criar} className="self-start text-xs text-eclat-dourado underline">+ criar tabela para esta categoria</button>
      ) : (
        <div className="flex flex-col gap-2">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-xs uppercase tracking-wider text-eclat-grafite/60 px-1">Tamanho</th>
                {tabela.columns.map((c, i) => (
                  <th key={i} className="px-1">
                    <div className="flex items-center gap-1">
                      <input value={c} onChange={(e) => setCol(i, e.target.value)} className={inputCls} />
                      <button onClick={() => delCol(i)} className="text-eclat-grafite/40 hover:text-red-700" title="Remover coluna">✕</button>
                    </div>
                  </th>
                ))}
                <th><button onClick={addCol} className="text-xs text-eclat-dourado underline">+ coluna</button></th>
              </tr>
            </thead>
            <tbody>
              {tabela.rows.map((row) => (
                <tr key={row.id}>
                  {row.cells.map((cell, c) => (
                    <td key={c} className="px-1 py-1">
                      <input value={cell} onChange={(e) => setCell(row.id, c, e.target.value)} className={inputCls} placeholder={c === 0 ? "P" : "62–68 cm"} />
                    </td>
                  ))}
                  <td><button onClick={() => delRow(row.id)} className="text-eclat-grafite/40 hover:text-red-700" title="Remover linha">✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-3">
            <button onClick={addRow} className="text-xs text-eclat-dourado underline">+ linha (tamanho)</button>
            <button onClick={() => setTabela(null)} className="text-xs text-red-700 underline">remover tabela desta categoria</button>
          </div>
        </div>
      )}

      <button
        onClick={salvar}
        disabled={saving}
        className="self-start bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-xs px-5 py-2 rounded-md hover:bg-eclat-dourado hover:text-eclat-grafite transition-colors disabled:opacity-50"
      >
        {saving ? "Salvando…" : "Salvar medidas"}
      </button>
    </div>
  )
}
