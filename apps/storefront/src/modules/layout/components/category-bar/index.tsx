"use client"

import { useEffect, useRef, useState } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { clx } from "@modules/common/components/ui"
import type { NavData } from "@lib/util/navigation"
import NavPanel from "./nav-panel"

// Barra de categorias (desktop, spec §5.1): Novidades · raízes por rank · Coleções · Ver tudo.
// Painel abre por hover ou foco; fecha ao sair (com atraso), Escape ou clique num link.
export default function CategoryBar({ nav }: { nav: NavData }) {
  const [open, setOpen] = useState<string | null>(null)
  const timer = useRef<number | null>(null)
  const show = (key: string) => { if (timer.current) window.clearTimeout(timer.current); setOpen(key) }
  const hide = () => { if (timer.current) window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setOpen(null), 120) }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null) }
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [])

  const item = "h-11 flex items-center transition-colors hover:text-eclat-terracota focus:outline-none focus-visible:text-eclat-terracota"
  const current = open ? nav.roots.find((r) => r.handle === open) : undefined
  const panelKind = open === "colecoes" ? "collections" : current?.children.length ? "parent" : "feminine"
  const hasPanel = open === "colecoes" ? nav.collections.length > 0 : !!current && (current.children.length > 0 || current.colors.length > 0 || !!current.image_url)
  const rootHasPanel = (r: NavData["roots"][number]) => r.children.length > 0 || r.colors.length > 0 || !!r.image_url

  return (
    <div
      className="hidden small:block bg-white border-b border-ui-border-base relative"
      onMouseLeave={hide}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hide() }}
    >
      <nav className="content-container flex items-center justify-center gap-x-10 h-11 text-xsmall-regular uppercase tracking-[0.18em]" aria-label="Categorias">
        <LocalizedClientLink href="/store?ordenar=novidades" className={clx(item, "text-eclat-terracota font-semibold")} onMouseEnter={hide} data-testid="nav-novidades">Novidades</LocalizedClientLink>
        {nav.roots.map((r) => {
          const withPanel = rootHasPanel(r)
          return (
            <LocalizedClientLink
              key={r.id}
              href={`/categories/${r.handle}`}
              className={clx(item, r.feminine ? "text-eclat-grafite/80" : "text-eclat-grafite/60", open === r.handle && "text-eclat-terracota")}
              onMouseEnter={withPanel ? () => show(r.handle) : undefined}
              onFocus={withPanel ? () => show(r.handle) : undefined}
              onClick={() => setOpen(null)}
              {...(withPanel ? { "aria-expanded": open === r.handle, "aria-controls": "nav-panel" } : {})}
              data-testid={`nav-cat-${r.handle}`}
            >
              {r.name}
            </LocalizedClientLink>
          )
        })}
        {nav.collections.length > 0 && (
          <button type="button" className={clx(item, "uppercase tracking-[0.18em] text-eclat-grafite/80", open === "colecoes" && "text-eclat-terracota")} onMouseEnter={() => show("colecoes")} onFocus={() => show("colecoes")} onClick={() => setOpen(open === "colecoes" ? null : "colecoes")} aria-expanded={open === "colecoes"} aria-controls="nav-panel" data-testid="nav-colecoes">Coleções</button>
        )}
        <LocalizedClientLink href="/store" className={clx(item, "text-eclat-grafite/60")} onMouseEnter={hide} data-testid="nav-ver-tudo">Ver tudo</LocalizedClientLink>
      </nav>
      {open && hasPanel && (
        <div id="nav-panel" role="region" aria-label="Detalhes da categoria" className="absolute inset-x-0 top-full bg-white border-b border-ui-border-base shadow-lg z-40" onMouseEnter={() => show(open)} onMouseLeave={hide}>
          <div className="content-container py-6">
            <NavPanel kind={panelKind} category={current} collections={nav.collections} onNavigate={() => setOpen(null)} />
          </div>
        </div>
      )}
    </div>
  )
}
