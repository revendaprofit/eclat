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
  const rootHasPanel = (r: NavData["roots"][number]) => r.children.length > 0 || r.colors.length > 0 || !!r.image_url

  // I5: o painel é renderizado DENTRO do wrapper do item que o abriu (ordem do DOM), logo
  // depois do link — Tab a partir do item vai direto para os links do painel, antes do
  // próximo item da barra. O wrapper do item (`h-11 flex items-center`) NÃO leva `position:
  // relative`, então `absolute inset-x-0 top-full` do painel continua resolvendo contra o
  // container da barra (que é `relative`) e o painel segue ocupando a largura toda.
  const renderPanel = (key: string, kind: "feminine" | "parent" | "collections", category?: NavData["roots"][number]) => (
    <div
      id="nav-panel"
      role="region"
      aria-label={kind === "collections" ? "Coleções" : "Detalhes da categoria"}
      className="absolute inset-x-0 top-full bg-white border-b border-ui-border-base shadow-lg z-40"
      onMouseEnter={() => show(key)}
      onMouseLeave={hide}
    >
      <div className="content-container py-6">
        <NavPanel kind={kind} category={category} collections={nav.collections} onNavigate={() => setOpen(null)} />
      </div>
    </div>
  )

  return (
    <div
      className="hidden small:block bg-white border-b border-ui-border-base relative"
      onMouseLeave={hide}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hide() }}
    >
      <nav className="content-container flex items-center justify-center gap-x-10 h-11 text-xsmall-regular uppercase tracking-[0.18em]" aria-label="Categorias">
        <div className="h-11 flex items-center">
          <LocalizedClientLink href="/store?ordenar=novidades" className={clx(item, "text-eclat-terracota font-semibold")} onMouseEnter={hide} data-testid="nav-novidades">Novidades</LocalizedClientLink>
        </div>
        {nav.roots.map((r) => {
          const withPanel = rootHasPanel(r)
          const isOpen = open === r.handle
          return (
            <div key={r.id} className="h-11 flex items-center">
              <LocalizedClientLink
                href={`/categories/${r.handle}`}
                className={clx(item, r.feminine ? "text-eclat-grafite/80" : "text-eclat-grafite/60", isOpen && "text-eclat-terracota")}
                onMouseEnter={withPanel ? () => show(r.handle) : undefined}
                onFocus={withPanel ? () => show(r.handle) : undefined}
                onClick={() => setOpen(null)}
                {...(withPanel ? { "aria-expanded": isOpen, "aria-controls": "nav-panel" } : {})}
                data-testid={`nav-cat-${r.handle}`}
              >
                {r.name}
              </LocalizedClientLink>
              {isOpen && withPanel && renderPanel(r.handle, r.children.length > 0 ? "parent" : "feminine", r)}
            </div>
          )
        })}
        {nav.collections.length > 0 && (
          <div className="h-11 flex items-center">
            <button
              type="button"
              className={clx(item, "uppercase tracking-[0.18em] text-eclat-grafite/80", open === "colecoes" && "text-eclat-terracota")}
              onMouseEnter={() => show("colecoes")}
              onFocus={() => show("colecoes")}
              onClick={() => setOpen(open === "colecoes" ? null : "colecoes")}
              aria-expanded={open === "colecoes"}
              aria-haspopup="true"
              aria-controls="nav-panel"
              data-testid="nav-colecoes"
            >
              Coleções
            </button>
            {open === "colecoes" && renderPanel("colecoes", "collections")}
          </div>
        )}
        <div className="h-11 flex items-center">
          <LocalizedClientLink href="/store" className={clx(item, "text-eclat-grafite/60")} onMouseEnter={hide} data-testid="nav-ver-tudo">Ver tudo</LocalizedClientLink>
        </div>
      </nav>
    </div>
  )
}
