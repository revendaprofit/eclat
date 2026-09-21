"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { createSupabaseBrowser } from "@/lib/supabase/client"

// Dezessete links em lista corrida obrigavam a ler todos para achar um. Agrupados por assunto,
// o olho pula direto para o bloco certo — e os parênteses explicativos dos nomes ("Vitrine
// (site)", "GEO (busca por IA)") saem, porque o grupo já diz do que se trata.
const GRUPOS: { titulo: string | null; itens: { href: string; label: string }[] }[] = [
  { titulo: null, itens: [{ href: "/", label: "Dashboard" }] },
  {
    titulo: "Vender",
    itens: [
      { href: "/pedidos", label: "Pedidos" },
      { href: "/conversas", label: "Conversas" },
      { href: "/clientes", label: "Clientes" },
      { href: "/leads", label: "Leads" },
    ],
  },
  {
    titulo: "Catálogo",
    itens: [
      { href: "/produtos", label: "Produtos e estoque" },
      { href: "/conjuntos", label: "Conjuntos" },
      { href: "/custos", label: "Custos de coleção" },
    ],
  },
  {
    titulo: "Site",
    itens: [
      { href: "/vitrine", label: "Vitrine" },
      { href: "/editorial", label: "Editorial" },
      { href: "/personas", label: "Personas" },
      { href: "/geo", label: "Busca por IA" },
    ],
  },
  {
    titulo: "Crescimento",
    itens: [
      { href: "/marketing", label: "Marketing" },
      { href: "/clube", label: "Clube Éclat" },
    ],
  },
  {
    titulo: "Dinheiro",
    itens: [
      { href: "/financeiro", label: "Financeiro" },
      { href: "/fiscal", label: "Fiscal" },
    ],
  },
  { titulo: null, itens: [{ href: "/configuracoes", label: "Configurações" }] },
]

function estaAtivo(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href)
}

export default function Sidebar({ email }: { email?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [aberto, setAberto] = useState(false)

  // No celular o menu vira uma gaveta por cima do conteúdo; trocar de tela tem que fechá-la.
  useEffect(() => setAberto(false), [pathname])

  async function logout() {
    const supabase = createSupabaseBrowser()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const navegacao = (
    <>
      <div className="px-5 py-5 border-b border-eclat-pedra/30">
        <div className="font-serif text-2xl tracking-wide text-eclat-texto">use.ÉCLAT</div>
        <div className="uppercase tracking-[0.3em] text-meta text-eclat-dourado-texto mt-0.5">
          Cockpit
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {GRUPOS.map((grupo, i) => (
          <div key={grupo.titulo ?? `solto-${i}`} className="mb-1.5">
            {grupo.titulo && (
              <div className="px-5 pt-3 pb-1 text-meta uppercase tracking-[0.14em] text-eclat-texto-3">
                {grupo.titulo}
              </div>
            )}
            {grupo.itens.map((item) => {
              const ativo = estaAtivo(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={ativo ? "page" : undefined}
                  className={`block px-5 py-2.5 text-corpo transition-colors ${
                    ativo
                      ? "bg-eclat-dourado/20 text-eclat-texto border-l-2 border-eclat-dourado font-medium"
                      : "text-eclat-texto-2 hover:bg-eclat-dourado/10 hover:text-eclat-texto"
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-eclat-pedra/30 text-meta text-eclat-texto-2">
        <div className="truncate mb-2">{email}</div>
        <button onClick={logout} className="text-eclat-texto hover:text-eclat-dourado-texto transition-colors">
          Sair
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Barra do celular: o painel era largura fixa de 256px sem recolher, e no telefone comia
          dois terços da tela. */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center gap-3 border-b border-eclat-pedra/40 bg-eclat-luz px-4 py-3">
        <button
          onClick={() => setAberto(true)}
          aria-label="Abrir menu"
          className="h-10 w-10 -ml-2 inline-flex items-center justify-center rounded-lg text-eclat-texto hover:bg-eclat-areia/50"
        >
          <span aria-hidden="true" className="text-xl leading-none">
            ☰
          </span>
        </button>
        <span className="font-serif text-xl text-eclat-texto">use.ÉCLAT</span>
      </div>

      {aberto && (
        <button
          aria-label="Fechar menu"
          onClick={() => setAberto(false)}
          className="lg:hidden fixed inset-0 z-40 bg-black/40"
        />
      )}

      <aside
        className={`w-64 shrink-0 bg-eclat-painel border-r border-eclat-pedra/40 flex-col shadow-xl lg:shadow-none
          lg:flex lg:sticky lg:top-0 lg:h-screen
          fixed inset-y-0 left-0 z-50 transition-transform duration-200
          ${aberto ? "flex translate-x-0" : "hidden lg:translate-x-0"}`}
      >
        {navegacao}
      </aside>
    </>
  )
}
