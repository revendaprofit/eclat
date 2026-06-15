"use client"

import { useParams, useRouter } from "next/navigation"
import { useState } from "react"

// Busca da vitrine: navega para /[cc]/busca?q=... (resultados via Store API).
export default function SearchBar() {
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

  return (
    <form onSubmit={submit} className="flex items-center">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar peças…"
        aria-label="Buscar produtos"
        className={`bg-transparent border-b border-ui-border-base focus:border-eclat-dourado outline-none text-small-regular transition-all duration-200 ${
          aberta ? "w-40 small:w-48 px-1" : "w-0 px-0"
        } small:w-40 small:px-1`}
        onFocus={() => setAberta(true)}
        onBlur={() => !q && setAberta(false)}
      />
      <button
        type="submit"
        aria-label="Buscar"
        onClick={() => setAberta(true)}
        className="hover:text-eclat-dourado transition-colors px-1"
      >
        {/* lupa */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="11" cy="11" r="7" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" />
        </svg>
      </button>
    </form>
  )
}
