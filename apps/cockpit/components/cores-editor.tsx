"use client"

import { useCallback, useEffect, useState } from "react"

// Vitrine → Cores. Fonte única de nome canônico + hex + foto do tecido (site_content.cores).
type Entry = { hex: string | null; swatch_url?: string | null }
type Row = { id: string; name: string; hex: string; swatch_url: string }

const HEX_RE = /^#[0-9a-f]{6}$/i

let idSeq = 0
function newId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID()
  idSeq += 1
  return `row-${idSeq}`
}

export default function CoresEditor() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [novo, setNovo] = useState("")

  const carregar = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const r = await fetch("/api/site-content/cores", { cache: "no-store" })
      const d = (await r.json().catch(() => null)) as Record<string, Entry> | { error?: string } | null
      if (!r.ok || !d || typeof d !== "object" || Array.isArray(d) || "error" in d) {
        const msg = d && typeof d === "object" && "error" in d && typeof d.error === "string" ? d.error : null
        throw new Error(msg || "Falha ao carregar cores do servidor.")
      }
      const map = d as Record<string, Entry>
      setRows(
        Object.entries(map)
          .map(([name, e]) => ({ id: newId(), name, hex: e?.hex ?? "", swatch_url: e?.swatch_url ?? "" }))
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      )
    } catch (e) {
      setRows([])
      setLoadError((e as Error).message || "Falha ao carregar cores do servidor.")
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    carregar()
  }, [carregar])

  function upd(id: string, patch: Partial<Row>) {
    setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }
  function add(name: string) {
    const n = name.trim()
    if (!n || rows.some((r) => r.name.toLowerCase() === n.toLowerCase())) return
    setRows([...rows, { id: newId(), name: n, hex: "", swatch_url: "" }])
  }
  async function importarDoCatalogo() {
    const r = await fetch("/api/catalog-colors", { cache: "no-store" })
    const d = await r.json()
    if (!r.ok) return alert(d.error || "Falha ao ler cores do catálogo")
    const faltantes = (d.colors as string[]).filter((c) => !rows.some((x) => x.name.toLowerCase() === c.toLowerCase()))
    if (!faltantes.length) return alert("Todas as cores do catálogo já estão no mapa.")
    setRows([...rows, ...faltantes.map((name) => ({ id: newId(), name, hex: "", swatch_url: "" }))])
  }
  async function upload(id: string, file: File) {
    const fd = new FormData()
    fd.append("file", file)
    const r = await fetch("/api/site-upload", { method: "POST", body: fd })
    const d = await r.json()
    if (!r.ok) return alert(d.error || "Falha no upload")
    upd(id, { swatch_url: d.url })
  }
  async function salvar() {
    for (const r of rows) {
      if (!r.name.trim()) return alert("Há uma cor sem nome.")
      if (r.hex && !HEX_RE.test(r.hex)) return alert(`Hex inválido em "${r.name}": use #RRGGBB.`)
    }
    const vistos = new Map<string, string>()
    for (const r of rows) {
      const chave = r.name.trim().toLowerCase()
      const original = vistos.get(chave)
      if (original) return alert(`Nome duplicado: "${original}" e "${r.name.trim()}" seriam salvos como a mesma cor.`)
      vistos.set(chave, r.name.trim())
    }
    const value: Record<string, Entry> = {}
    for (const r of rows) value[r.name.trim()] = { hex: r.hex ? r.hex.toUpperCase() : null, swatch_url: r.swatch_url || null }
    setSaving(true)
    try {
      const res = await fetch("/api/site-content/cores", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || "Falha ao salvar")
      alert("Cores salvas! A vitrine atualiza em até ~30s.")
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    "border border-eclat-pedra/50 rounded-md px-2 py-1 text-sm bg-white focus:outline-none focus:border-eclat-dourado"
  if (loading) return <p className="text-sm text-eclat-grafite/50">Carregando cores…</p>

  if (loadError) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-red-700">
          Não foi possível carregar as cores atuais ({loadError}). Salvar agora apagaria as cores já cadastradas, então
          isso foi bloqueado.
        </p>
        <button onClick={carregar} className="self-start text-xs text-eclat-dourado underline">
          tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-eclat-grafite/60">
        O nome aqui é o nome canônico: escreva-o igual na opção &quot;Cor&quot; de todo produto. O hex vira o círculo
        (swatch) no card, no filtro e na página do produto; a foto do tecido é opcional e substitui o círculo.
      </p>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.id} className="grid grid-cols-[1fr_120px_36px_1fr_auto] gap-2 items-center">
            <input value={r.name} onChange={(e) => upd(r.id, { name: e.target.value })} className={inputCls} placeholder="Nome canônico" />
            <input value={r.hex} onChange={(e) => upd(r.id, { hex: e.target.value })} className={inputCls} placeholder="#RRGGBB" />
            <input type="color" value={HEX_RE.test(r.hex) ? r.hex : "#c9c4bc"} onChange={(e) => upd(r.id, { hex: e.target.value.toUpperCase() })} className="w-9 h-8 p-0 border-0 bg-transparent" title="Escolher cor" />
            <div className="flex items-center gap-2 text-xs">
              {r.swatch_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.swatch_url} alt="" className="w-8 h-8 rounded-full object-cover border border-eclat-pedra/40" />
              )}
              <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload(r.id, e.target.files[0])} className="text-xs" />
              {r.swatch_url && <button onClick={() => upd(r.id, { swatch_url: "" })} className="text-red-700 underline">tirar foto</button>}
            </div>
            <button onClick={() => setRows(rows.filter((x) => x.id !== r.id))} className="text-eclat-grafite/40 hover:text-red-700 px-1" title="Remover">✕</button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add(novo)
              setNovo("")
            }
          }}
          placeholder="+ nova cor (Enter)"
          className={inputCls + " w-44"}
        />
        <button onClick={importarDoCatalogo} className="text-xs text-eclat-dourado underline">importar cores já usadas no catálogo</button>
      </div>
      <button
        onClick={salvar}
        disabled={saving}
        className="self-start bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-xs px-5 py-2 rounded-md hover:bg-eclat-dourado hover:text-eclat-grafite transition-colors disabled:opacity-50"
      >
        {saving ? "Salvando…" : "Salvar cores"}
      </button>
    </div>
  )
}
