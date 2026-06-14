"use client"

import { useEffect, useState } from "react"

type Check = { ok: boolean; detail: string }
type Health = { medusa: Check; supabase: Check; evolution: Check }

const LABELS: Record<keyof Health, string> = {
  medusa: "Medusa (comércio)",
  supabase: "Supabase (relacionamento)",
  evolution: "Evolution (WhatsApp)",
}

export default function ConnectionsPanel() {
  const [health, setHealth] = useState<Health | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const r = await fetch("/api/health", { cache: "no-store" })
      setHealth(await r.json())
    } catch {
      setHealth(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl">Conexões</h2>
        <button
          onClick={load}
          className="uppercase tracking-widest text-[10px] text-eclat-grafite/70 hover:text-eclat-dourado"
        >
          {loading ? "Verificando…" : "Recarregar"}
        </button>
      </div>
      <div className="grid grid-cols-1 small:grid-cols-3 gap-3 sm:grid-cols-3">
        {(Object.keys(LABELS) as (keyof Health)[]).map((key) => {
          const c = health?.[key]
          const ok = c?.ok
          return (
            <div
              key={key}
              className="border border-eclat-pedra/40 rounded-lg p-4 bg-white/60"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block w-2.5 h-2.5 rounded-full ${
                    loading
                      ? "bg-eclat-pedra"
                      : ok
                      ? "bg-green-500"
                      : "bg-red-500"
                  }`}
                />
                <span className="text-sm font-medium">{LABELS[key]}</span>
              </div>
              <p className="text-xs text-eclat-grafite/60 mt-2">
                {loading ? "…" : c?.detail ?? "sem resposta"}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
