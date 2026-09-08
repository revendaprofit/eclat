"use client"

import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import type { NavCategory, NavCollection } from "@lib/util/navigation"

const MAX_COLORS = 6

// Capa com fallback pela inicial do nome quando não há imagem (minor 9) — mesmo padrão do
// menu mobile e do "Compre por peça" na home. Módulo (minor 10): não recriar a cada render.
const Capa = ({ src, alt }: { src: string | null; alt: string }) => (
  <div className="relative w-40 aspect-[3/4] rounded-md overflow-hidden bg-eclat-areia/40 shrink-0">
    {src ? (
      <Image src={src} alt={alt} fill sizes="160px" quality={80} className="object-cover" />
    ) : (
      <div className="absolute inset-0 flex items-center justify-center font-serif text-3xl text-eclat-grafite/30">{alt.charAt(0)}</div>
    )}
  </div>
)

// Painel do hover da barra (spec §5.1): feminina = capa + cores; mãe = filhas; coleções = capas.
export default function NavPanel({ kind, category, collections = [], onNavigate }: { kind: "feminine" | "parent" | "collections"; category?: NavCategory; collections?: NavCollection[]; onNavigate: () => void }) {
  if (kind === "feminine" && category) {
    const cores = category.colors.slice(0, MAX_COLORS)
    return (
      <div className="flex gap-8">
        <LocalizedClientLink href={`/categories/${category.handle}`} onClick={onNavigate}><Capa src={category.image_url} alt={category.name} /></LocalizedClientLink>
        <div className="flex flex-col gap-3 min-w-[220px]">
          <p className="font-serif text-xl text-eclat-grafite">{category.name}</p>
          {category.descricao_curta && <p className="text-sm text-eclat-grafite/70 max-w-xs">{category.descricao_curta}</p>}
          {cores.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-eclat-grafite/60 mb-2">Cores disponíveis</p>
              <ul className="flex flex-wrap gap-3">
                {cores.map((c) => (
                  <li key={c.name}>
                    <LocalizedClientLink href={`/categories/${category.handle}?cor=${encodeURIComponent(c.name)}`} onClick={onNavigate} className="flex items-center gap-2 text-sm hover:text-eclat-terracota" title={c.name}>
                      <span className="w-5 h-5 rounded-full border border-black/10" style={c.swatch_url ? { backgroundImage: `url(${c.swatch_url})`, backgroundSize: "cover" } : { backgroundColor: c.hex }} aria-hidden />
                      <span>{c.name}</span>
                    </LocalizedClientLink>
                  </li>
                ))}
                {category.colors.length > MAX_COLORS && <li className="text-sm text-eclat-grafite/50">+{category.colors.length - MAX_COLORS}</li>}
              </ul>
            </div>
          )}
          <LocalizedClientLink href={`/categories/${category.handle}`} onClick={onNavigate} className="text-xs uppercase tracking-widest underline underline-offset-4 mt-2">Ver tudo de {category.name}</LocalizedClientLink>
        </div>
      </div>
    )
  }
  if (kind === "parent" && category) {
    return (
      <ul className="flex gap-6">
        {category.children.map((ch) => (
          <li key={ch.id}>
            <LocalizedClientLink href={`/categories/${ch.handle}`} onClick={onNavigate} className="flex flex-col gap-2 group/item">
              <Capa src={ch.image_url ?? category.image_url} alt={ch.name} />
              <span className="text-sm group-hover/item:text-eclat-terracota">{ch.name}</span>
            </LocalizedClientLink>
          </li>
        ))}
        <li>
          <LocalizedClientLink href={`/categories/${category.handle}`} onClick={onNavigate} className="text-xs uppercase tracking-widest underline underline-offset-4 self-end">Ver tudo de {category.name}</LocalizedClientLink>
        </li>
      </ul>
    )
  }
  return (
    <ul className="flex gap-6">
      {collections.map((c) => (
        <li key={c.id}>
          <LocalizedClientLink href={`/collections/${c.handle}`} onClick={onNavigate} className="flex flex-col gap-2 group/item">
            <Capa src={c.image_url} alt={c.title} />
            <span className="text-sm group-hover/item:text-eclat-terracota">{c.title}</span>
          </LocalizedClientLink>
        </li>
      ))}
    </ul>
  )
}
