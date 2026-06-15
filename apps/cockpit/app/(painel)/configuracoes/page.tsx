"use client"

import { useCallback, useEffect, useState } from "react"
import ConnectionsPanel from "@/components/connections-panel"
import { createSupabaseBrowser } from "@/lib/supabase/client"

type Categoria = { id: string; nome: string }

export default function ConfiguracoesPage() {
  const [email, setEmail] = useState<string>("")
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [novaCat, setNovaCat] = useState("")

  useEffect(() => {
    createSupabaseBrowser()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? ""))
  }, [])

  const carregarCategorias = useCallback(async () => {
    const r = await fetch("/api/finance/categories", { cache: "no-store" })
    if (r.ok) setCategorias(await r.json())
  }, [])
  useEffect(() => {
    carregarCategorias()
  }, [carregarCategorias])

  async function addCategoria() {
    const nome = novaCat.trim()
    if (!nome) return
    setNovaCat("")
    const r = await fetch("/api/finance/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome }),
    })
    if (r.ok) carregarCategorias()
    else alert((await r.json()).error || "Falha")
  }
  async function delCategoria(id: string) {
    if (!confirm("Excluir categoria? As despesas dela ficam sem categoria.")) return
    const r = await fetch(`/api/finance/categories/${id}`, { method: "DELETE" })
    if (r.ok) carregarCategorias()
    else alert((await r.json()).error || "Falha")
  }

  const Param = ({ label, valor }: { label: string; valor: string }) => (
    <div className="border border-eclat-pedra/40 rounded-lg bg-white/60 p-4">
      <div className="text-xs uppercase tracking-wider text-eclat-grafite/50">{label}</div>
      <div className="text-lg text-eclat-grafite mt-1">{valor}</div>
    </div>
  )

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="font-serif text-3xl text-eclat-grafite">Configurações</h1>
        <p className="text-sm text-eclat-grafite/60 mt-1">Conexões, WhatsApp, categorias de despesa, parâmetros e conta.</p>
      </div>

      {/* Conexões (inclui WhatsApp/Evolution) */}
      <ConnectionsPanel />

      {/* Categorias de despesa */}
      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-2xl text-eclat-grafite">Categorias de despesa</h2>
        <div className="border border-eclat-pedra/40 rounded-lg bg-white/60 p-4 flex flex-wrap gap-2 items-center">
          {categorias.map((c) => (
            <span key={c.id} className="text-sm bg-white border border-eclat-pedra/30 rounded-full px-3 py-1 flex items-center gap-2">
              {c.nome}
              <button onClick={() => delCategoria(c.id)} className="text-eclat-grafite/40 hover:text-red-700">✕</button>
            </span>
          ))}
          <input
            value={novaCat}
            onChange={(e) => setNovaCat(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addCategoria()
              }
            }}
            placeholder="+ categoria (Enter)"
            className="border border-eclat-pedra/50 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-eclat-dourado w-44"
          />
        </div>
        <p className="text-xs text-eclat-grafite/50">Usadas ao lançar despesas no Financeiro.</p>
      </section>

      {/* Parâmetros do negócio */}
      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-2xl text-eclat-grafite">Parâmetros do negócio</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Param label="Moeda" valor="BRL (R$)" />
          <Param label="Estoque baixo" valor="≤ 5 unidades" />
          <Param label="Reativação" valor="recorrentes +60 dias" />
          <Param label="Cliente VIP" valor="≥ R$ 1.000" />
          <Param label="Local de estoque" valor="CD Brasil" />
          <Param label="Receita no DRE" valor="pagos / autorizados" />
          <Param label="Frete no DRE" valor="linha separada" />
          <Param label="IA (chat/leads)" valor="Google Gemini" />
        </div>
        <p className="text-xs text-eclat-grafite/50">
          Estes parâmetros são fixos no código por enquanto. Posso torná-los editáveis (salvos no Supabase) se você quiser.
        </p>
      </section>

      {/* Conta */}
      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-2xl text-eclat-grafite">Conta</h2>
        <div className="border border-eclat-pedra/40 rounded-lg bg-white/60 p-4 text-sm">
          <div>Operador: <b>{email || "—"}</b></div>
          <div className="text-eclat-grafite/50 text-xs mt-1">Sair pelo menu lateral (canto inferior esquerdo).</div>
        </div>
      </section>
    </div>
  )
}
