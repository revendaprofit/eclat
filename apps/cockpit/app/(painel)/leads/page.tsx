"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"

type Lead = {
  id: string
  nome: string
  whatsapp: string | null
  email: string | null
  origem: string | null
  status: string
  notas: string | null
  medusa_customer_id: string | null
  created_at: string
  conversation: { id: string }[]
}

const STAGES: { key: string; label: string }[] = [
  { key: "novo", label: "Novo" },
  { key: "contatado", label: "Contatado" },
  { key: "negociando", label: "Negociando" },
  { key: "convertido", label: "Convertido" },
  { key: "perdido", label: "Perdido" },
]

const ORIGENS = ["instagram", "whatsapp", "indicacao", "anuncio", "site", "pagina_eclat"]

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [selected, setSelected] = useState<Lead | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [novo, setNovo] = useState({ nome: "", whatsapp: "", email: "", origem: "" })
  const [dragId, setDragId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [classifying, setClassifying] = useState(false)
  const [stageSuggestion, setStageSuggestion] = useState<{
    estagio: string
    motivo: string
  } | null>(null)

  const load = useCallback(async () => {
    const r = await fetch("/api/leads", { cache: "no-store" })
    if (r.ok) setLeads(await r.json())
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // limpa a sugestão de estágio ao trocar de lead
  useEffect(() => {
    setStageSuggestion(null)
  }, [selected?.id])

  async function moveTo(leadId: string, status: string) {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status } : l))
    )
    await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
  }

  async function salvarNotas() {
    if (!selected) return
    setBusy(true)
    try {
      await fetch(`/api/leads/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notas: selected.notas ?? "" }),
      })
      setLeads((prev) =>
        prev.map((l) => (l.id === selected.id ? { ...l, notas: selected.notas } : l))
      )
    } finally {
      setBusy(false)
    }
  }

  async function converter() {
    if (!selected) return
    setBusy(true)
    try {
      const r = await fetch(`/api/leads/${selected.id}/convert`, { method: "POST" })
      const data = await r.json()
      if (r.ok) {
        const upd = { medusa_customer_id: data.customer_id, status: "convertido" }
        setSelected((s) => (s ? { ...s, ...upd } : s))
        setLeads((prev) =>
          prev.map((l) => (l.id === selected.id ? { ...l, ...upd } : l))
        )
      } else {
        alert(data.error || "Falha ao converter.")
      }
    } finally {
      setBusy(false)
    }
  }

  async function classify() {
    if (!selected) return
    setClassifying(true)
    try {
      const r = await fetch(`/api/leads/${selected.id}/classify`, { method: "POST" })
      const data = await r.json()
      if (r.ok) setStageSuggestion({ estagio: data.estagio, motivo: data.motivo })
      else alert(data.error || "Não foi possível detectar o estágio.")
    } finally {
      setClassifying(false)
    }
  }

  async function aplicarEstagio() {
    if (!selected || !stageSuggestion) return
    const estagio = stageSuggestion.estagio
    await moveTo(selected.id, estagio)
    setSelected((s) => (s ? { ...s, status: estagio } : s))
    setStageSuggestion(null)
  }

  async function criarLead(e: React.FormEvent) {
    e.preventDefault()
    if (!novo.nome.trim()) return
    setBusy(true)
    try {
      const r = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(novo),
      })
      if (r.ok) {
        setShowNew(false)
        setNovo({ nome: "", whatsapp: "", email: "", origem: "" })
        load()
      } else {
        alert("Não foi possível criar o lead.")
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-serif text-3xl text-eclat-grafite">Leads</h1>
          <p className="text-sm text-eclat-grafite/60">
            Arraste os cards entre as colunas para mover no funil.
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-xs px-4 py-2 rounded-md hover:bg-eclat-dourado hover:text-eclat-grafite transition-colors"
        >
          + Novo lead
        </button>
      </div>

      {/* Kanban */}
      <div className="flex-1 min-h-0 flex gap-3 overflow-x-auto">
        {STAGES.map((stage) => {
          const items = leads.filter((l) => l.status === stage.key)
          return (
            <div
              key={stage.key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragId) moveTo(dragId, stage.key)
                setDragId(null)
              }}
              className="flex-1 min-w-[220px] flex flex-col bg-eclat-areia/30 border border-eclat-pedra/40 rounded-lg min-h-0"
            >
              <div className="px-3 py-2 border-b border-eclat-pedra/30 flex items-center justify-between">
                <span className="text-sm font-medium">{stage.label}</span>
                <span className="text-xs text-eclat-grafite/50">{items.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
                {items.map((l) => (
                  <button
                    key={l.id}
                    draggable
                    onDragStart={() => setDragId(l.id)}
                    onClick={() => setSelected(l)}
                    className="text-left bg-white border border-eclat-pedra/40 rounded-md p-3 hover:border-eclat-dourado transition-colors cursor-grab active:cursor-grabbing"
                  >
                    <div className="text-sm font-medium truncate">{l.nome}</div>
                    <div className="text-xs text-eclat-grafite/50">
                      {l.whatsapp || l.email || "—"}
                    </div>
                    <div className="mt-1 flex gap-1 flex-wrap">
                      {l.origem && (
                        <span className="text-[10px] uppercase tracking-wide bg-eclat-areia px-1.5 py-0.5 rounded">
                          {l.origem}
                        </span>
                      )}
                      {l.medusa_customer_id && (
                        <span className="text-[10px] uppercase tracking-wide bg-eclat-dourado/30 px-1.5 py-0.5 rounded">
                          cliente
                        </span>
                      )}
                    </div>
                  </button>
                ))}
                {items.length === 0 && (
                  <p className="text-xs text-eclat-grafite/40 px-1 py-2">—</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Ficha do lead (drawer) */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/30 flex justify-end"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md h-full bg-eclat-luz p-6 overflow-y-auto flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h2 className="font-serif text-2xl">{selected.nome}</h2>
              <button
                onClick={() => setSelected(null)}
                className="text-eclat-grafite/50 hover:text-eclat-grafite text-sm"
              >
                Fechar
              </button>
            </div>

            <dl className="text-sm flex flex-col gap-2">
              <div className="flex justify-between">
                <dt className="text-eclat-grafite/50">WhatsApp</dt>
                <dd>{selected.whatsapp || "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-eclat-grafite/50">E-mail</dt>
                <dd>{selected.email || "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-eclat-grafite/50">Origem</dt>
                <dd>{selected.origem || "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-eclat-grafite/50">Estágio</dt>
                <dd>{STAGES.find((s) => s.key === selected.status)?.label || selected.status}</dd>
              </div>
            </dl>

            {/* IA: detectar estágio (modo sugestão) */}
            <div className="flex flex-col gap-2">
              <button
                onClick={classify}
                disabled={classifying}
                className="self-start border border-eclat-dourado/60 text-eclat-grafite text-xs px-3 py-1.5 rounded-md hover:bg-eclat-dourado/15 transition-colors disabled:opacity-50"
              >
                {classifying ? "Analisando…" : "✨ Detectar estágio (IA)"}
              </button>
              {stageSuggestion && (
                <div className="border border-eclat-dourado/50 bg-eclat-dourado/10 rounded-md p-3 text-sm flex flex-col gap-2">
                  <div>
                    Sugestão:{" "}
                    <strong>
                      {STAGES.find((s) => s.key === stageSuggestion.estagio)?.label ||
                        stageSuggestion.estagio}
                    </strong>
                  </div>
                  {stageSuggestion.motivo && (
                    <div className="text-xs text-eclat-grafite/60">{stageSuggestion.motivo}</div>
                  )}
                  {stageSuggestion.estagio === selected.status ? (
                    <div className="text-xs text-eclat-grafite/50">Já está neste estágio.</div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={aplicarEstagio}
                        className="bg-eclat-grafite text-eclat-luz text-xs uppercase tracking-widest px-3 py-1.5 rounded-md hover:bg-eclat-dourado hover:text-eclat-grafite transition-colors"
                      >
                        Mover para{" "}
                        {STAGES.find((s) => s.key === stageSuggestion.estagio)?.label}
                      </button>
                      <button
                        onClick={() => setStageSuggestion(null)}
                        className="text-xs text-eclat-grafite/60 px-2"
                      >
                        Ignorar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-eclat-grafite/60">Notas</span>
              <textarea
                value={selected.notas ?? ""}
                onChange={(e) =>
                  setSelected((s) => (s ? { ...s, notas: e.target.value } : s))
                }
                rows={4}
                className="border border-eclat-pedra/50 rounded-md px-3 py-2 bg-white text-sm focus:outline-none focus:border-eclat-dourado resize-none"
              />
              <button
                onClick={salvarNotas}
                disabled={busy}
                className="self-start text-xs uppercase tracking-widest text-eclat-grafite hover:text-eclat-dourado disabled:opacity-50"
              >
                Salvar notas
              </button>
            </label>

            <div className="flex flex-col gap-2 mt-2">
              {selected.conversation?.[0]?.id && (
                <Link
                  href={`/conversas?c=${selected.conversation[0].id}`}
                  className="text-center border border-eclat-pedra/50 rounded-md py-2 text-sm hover:bg-eclat-areia/40 transition-colors"
                >
                  Abrir conversa
                </Link>
              )}

              {selected.medusa_customer_id ? (
                <div className="text-center text-xs text-eclat-grafite/60 border border-eclat-dourado/40 rounded-md py-2">
                  Cliente no Medusa: {selected.medusa_customer_id}
                </div>
              ) : (
                <button
                  onClick={converter}
                  disabled={busy}
                  className="bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-xs py-2.5 rounded-md hover:bg-eclat-dourado hover:text-eclat-grafite transition-colors disabled:opacity-50"
                >
                  {busy ? "…" : "Converter em cliente"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Novo lead */}
      {showNew && (
        <div
          className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
          onClick={() => setShowNew(false)}
        >
          <form
            onSubmit={criarLead}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-eclat-luz rounded-xl p-6 flex flex-col gap-3"
          >
            <h2 className="font-serif text-2xl">Novo lead</h2>
            <input
              required
              placeholder="Nome"
              value={novo.nome}
              onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
              className="border border-eclat-pedra/50 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-eclat-dourado"
            />
            <input
              placeholder="WhatsApp (ex.: 5531999999999)"
              value={novo.whatsapp}
              onChange={(e) => setNovo({ ...novo, whatsapp: e.target.value })}
              className="border border-eclat-pedra/50 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-eclat-dourado"
            />
            <input
              placeholder="E-mail (opcional)"
              value={novo.email}
              onChange={(e) => setNovo({ ...novo, email: e.target.value })}
              className="border border-eclat-pedra/50 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-eclat-dourado"
            />
            <select
              value={novo.origem}
              onChange={(e) => setNovo({ ...novo, origem: e.target.value })}
              className="border border-eclat-pedra/50 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-eclat-dourado"
            >
              <option value="">Origem…</option>
              {ORIGENS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <div className="flex gap-2 justify-end mt-2">
              <button
                type="button"
                onClick={() => setShowNew(false)}
                className="text-sm text-eclat-grafite/60 px-3"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={busy}
                className="bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-xs px-4 py-2 rounded-md hover:bg-eclat-dourado hover:text-eclat-grafite transition-colors disabled:opacity-50"
              >
                Criar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
