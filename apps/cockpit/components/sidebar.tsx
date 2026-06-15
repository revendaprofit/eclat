"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createSupabaseBrowser } from "@/lib/supabase/client"

const ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/conversas", label: "Conversas" },
  { href: "/clientes", label: "Clientes" },
  { href: "/pedidos", label: "Pedidos" },
  { href: "/leads", label: "Leads" },
  { href: "/produtos", label: "Produtos & Estoque" },
  { href: "/vitrine", label: "Vitrine (site)" },
  { href: "/financeiro", label: "Financeiro" },
  { href: "/configuracoes", label: "Configurações" },
]

export default function Sidebar({ email }: { email?: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    const supabase = createSupabaseBrowser()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <aside className="w-64 shrink-0 bg-eclat-areia/40 border-r border-eclat-pedra/40 flex flex-col">
      <div className="px-6 py-6 border-b border-eclat-pedra/30">
        <div className="font-serif text-2xl tracking-wide text-eclat-grafite">
          use.ÉCLAT
        </div>
        <div className="uppercase tracking-[0.3em] text-[10px] text-eclat-dourado mt-0.5">
          Cockpit
        </div>
      </div>

      <nav className="flex-1 py-4">
        {ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-6 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-eclat-dourado/20 text-eclat-grafite border-l-2 border-eclat-dourado font-medium"
                  : "text-eclat-grafite/70 hover:bg-eclat-dourado/10 hover:text-eclat-grafite"
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-6 py-4 border-t border-eclat-pedra/30 text-xs text-eclat-grafite/70">
        <div className="truncate mb-2">{email}</div>
        <button
          onClick={logout}
          className="uppercase tracking-widest text-[10px] text-eclat-grafite hover:text-eclat-dourado transition-colors"
        >
          Sair
        </button>
      </div>
    </aside>
  )
}
