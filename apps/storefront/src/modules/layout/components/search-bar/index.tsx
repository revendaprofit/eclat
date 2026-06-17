"use client"

import { useParams, useRouter } from "next/navigation"
import { useState } from "react"

// Busca da vitrine: navega para /[cc]/busca?q=... (resultados via Store API).
// variant "inline" = lupa que expande (desktop nav); "full" = barra arredondada (mobile).
export default function SearchBar({
  variant = "inline",
}: {
  variant?: "inline" | "full"
}) {
  const router = useRouter()
  const { countryCode } = useParams() as { countryCode?: string }
  const [q, setQ] = useState("")
  const [aberta, setAberta] = useState(false)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const termo = q.trim()
    if (!termo) return
    const cc = countryCode || "br"
    router.push(`/${cc}/busca?q=${encodeURIComponent(termo)}`)
    setAberta(false)
  }

  const Lupa = ({ size = 18 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  )

  if (variant === "full") {
    return (
      <form onSubmit={submit} className="relative w-full">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar peças, coleções…"
          aria-label="Buscar produtos"
          className="w-full rounded-full border border-eclat-pedra/60 bg-white px-5 py-3 pr-14 text-base text-eclat-grafite placeholder:text-eclat-grafite/40 outline-none focus:border-eclat-terracota transition-colors"
        />
        <button
          type="submit"
          aria-label="Buscar"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full flex items-center justify-center text-eclat-grafite/70 hover:text-eclat-terracota transition-colors"
        >
          <Lupa size={20} />
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={submit} className="flex items-center">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar peças…"
        aria-label="Buscar produtos"
        className={`bg-transparent border-b border-ui-border-base focus:border-eclat-terracota outline-none text-small-regular transition-all duration-200 ${
          aberta ? "w-40 small:w-48 px-1" : "w-0 px-0"
        } small:w-40 small:px-1`}
        onFocus={() => setAberta(true)}
        onBlur={() => !q && setAberta(false)}
      />
      <button
        type="submit"
        aria-label="Buscar"
        onClick={() => setAberta(true)}
        className="hover:text-eclat-terracota transition-colors px-1"
      >
        <Lupa />
      </button>
    </form>
  )
}
