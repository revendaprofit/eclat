"use client"

import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { pushEcommerceEvent } from "@modules/analytics/push"
import { buildSuggestions, MIN_QUERY, type ProductHit, type Suggestions } from "@lib/util/search-suggest"
import type { NavData } from "@lib/util/navigation"

// Busca da vitrine (spec §9): sugestões ao digitar (categorias + cores vêm da NavData já em
// memória; produtos via GET /api/busca/sugestoes — Route Handler, I1 — com debounce de 200 ms
// e AbortController por digitação). Enter continua indo para /busca.
// variant "inline" = lupa que expande (desktop nav); "full" = barra arredondada (mobile).

const DEBOUNCE_MS = 200
type SuggestionType = "categoria" | "cor" | "produto" | "todos"

export default function SearchBar({ variant = "inline", nav }: { variant?: "inline" | "full"; nav: NavData }) {
  const router = useRouter()
  const { countryCode } = useParams() as { countryCode?: string }
  const cc = countryCode || "br"
  const [q, setQ] = useState("")
  const [aberta, setAberta] = useState(false) // campo expandido (só "inline")
  const [focada, setFocada] = useState(false) // dropdown visível
  const [hits, setHits] = useState<ProductHit[]>([])
  const ultimoTermo = useRef("")
  const id = `busca-sugestoes-${variant}`

  // produtos: debounce + AbortController (cancela a requisição anterior); resposta de um termo
  // antigo é descartada (ultimoTermo). I2: qualquer rejeição que não seja abort limpa os hits.
  useEffect(() => {
    const termo = q.trim()
    ultimoTermo.current = termo
    if (termo.length < MIN_QUERY) {
      setHits([])
      return
    }
    const controller = new AbortController()
    const t = setTimeout(() => {
      fetch(`/api/busca/sugestoes?q=${encodeURIComponent(termo)}&cc=${cc}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((data: { products?: ProductHit[] }) => {
          if (ultimoTermo.current === termo) setHits(data.products ?? [])
        })
        .catch((e) => {
          if (e?.name === "AbortError") return
          if (ultimoTermo.current === termo) setHits([])
        })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(t)
      controller.abort()
    }
  }, [q, cc])

  const sugestoes = useMemo(() => buildSuggestions(q, nav, hits), [q, nav, hits])
  const mostrar = focada && q.trim().length >= MIN_QUERY

  function fechar() {
    setFocada(false)
    if (!q) setAberta(false)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    const termo = q.trim()
    if (!termo) return
    router.push(`/${cc}/busca?q=${encodeURIComponent(termo)}`)
    setFocada(false)
    setAberta(false)
  }
  function escolher(type: SuggestionType, value: string) {
    pushEcommerceEvent("search_suggestion_click", undefined, { suggestion_type: type, suggestion_value: value, search_term: q.trim() })
    setFocada(false)
    setAberta(false)
    setQ("")
  }
  // fecha quando o foco sai do formulário inteiro (input + dropdown); Tab dentro do dropdown mantém
  function onBlur(e: React.FocusEvent<HTMLFormElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) fechar()
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") setFocada(false)
  }

  const Lupa = ({ size = 18 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  )

  const dropdown = mostrar && (
    <Dropdown id={id} sugestoes={sugestoes} termo={q.trim()} cc={cc} onPick={escolher} className={variant === "full" ? "left-0 right-0" : "right-0 w-80"} />
  )

  if (variant === "full") {
    return (
      <form onSubmit={submit} onBlur={onBlur} onKeyDown={onKeyDown} className="relative w-full" role="search">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setFocada(true)
          }}
          onFocus={() => setFocada(true)}
          placeholder="Buscar peças, coleções…"
          aria-label="Buscar produtos"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={mostrar}
          aria-controls={mostrar ? id : undefined}
          autoComplete="off"
          className="w-full rounded-full border border-eclat-pedra/60 bg-white px-5 py-3 pr-14 text-base text-eclat-grafite placeholder:text-eclat-grafite/40 outline-none focus:border-eclat-terracota transition-colors"
        />
        {dropdown}
        <button type="submit" aria-label="Buscar" className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full flex items-center justify-center text-eclat-grafite/70 hover:text-eclat-terracota transition-colors">
          <Lupa size={20} />
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={submit} onBlur={onBlur} onKeyDown={onKeyDown} className="relative flex items-center" role="search">
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setFocada(true)
        }}
        placeholder="Buscar peças…"
        aria-label="Buscar produtos"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={mostrar}
        aria-controls={mostrar ? id : undefined}
        autoComplete="off"
        className={`bg-transparent border-b border-ui-border-base focus:border-eclat-terracota outline-none text-small-regular transition-all duration-200 ${
          aberta ? "w-40 small:w-48 px-1" : "w-0 px-0"
        } small:w-40 small:px-1`}
        onFocus={() => {
          setAberta(true)
          setFocada(true)
        }}
      />
      {dropdown}
      <button type="submit" aria-label="Buscar" onClick={() => setAberta(true)} className="hover:text-eclat-terracota transition-colors px-1">
        <Lupa />
      </button>
    </form>
  )
}

function Dropdown({ id, sugestoes, termo, cc, onPick, className }: { id: string; sugestoes: Suggestions; termo: string; cc: string; onPick: (t: SuggestionType, v: string) => void; className: string }) {
  const vazio = sugestoes.categories.length + sugestoes.colors.length + sugestoes.products.length === 0
  const titulo = "px-4 pt-3 pb-1 text-[10px] uppercase tracking-[0.2em] text-eclat-grafite/50"
  const item = "block px-4 py-2 text-sm text-eclat-grafite hover:bg-eclat-areia/40 focus:bg-eclat-areia/40 outline-none"
  return (
    <div
      id={id}
      role="region"
      aria-label="Sugestões de busca"
      className={`absolute top-full mt-2 z-50 bg-white border border-ui-border-base rounded-xl shadow-lg overflow-hidden ${className}`}
      data-testid="search-suggestions"
    >
      {vazio ? (
        <p className="px-4 py-3 text-sm text-eclat-grafite/60">Nenhuma sugestão — pressione Enter para buscar “{termo}”.</p>
      ) : (
        <>
          {sugestoes.categories.length > 0 && (
            <div>
              <p className={titulo}>Categorias</p>
              {sugestoes.categories.map((c) => (
                <LocalizedClientLink key={c.handle} href={c.href} className={item} onClick={() => onPick("categoria", c.handle)}>
                  {c.name}
                </LocalizedClientLink>
              ))}
            </div>
          )}
          {sugestoes.colors.length > 0 && (
            <div>
              <p className={titulo}>Cores</p>
              {sugestoes.colors.map((c) => (
                <div key={c.color} className="px-4 py-2 text-sm">
                  <span className="inline-flex items-center gap-2 text-eclat-grafite">
                    <span className="h-3.5 w-3.5 rounded-full border border-eclat-pedra/60" style={{ backgroundColor: c.hex }} aria-hidden />
                    {c.color}
                  </span>
                  <span className="text-eclat-grafite/60"> em </span>
                  {c.categories.map((cat, i) => (
                    <span key={cat.handle}>
                      {i > 0 && <span className="text-eclat-grafite/60">, </span>}
                      <LocalizedClientLink href={cat.href} className="underline text-eclat-terracota outline-none focus:bg-eclat-areia/40" onClick={() => onPick("cor", `${c.color}|${cat.handle}`)}>
                        {cat.name}
                      </LocalizedClientLink>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}
          {sugestoes.products.length > 0 && (
            <div>
              <p className={titulo}>Peças</p>
              {sugestoes.products.map((p) => (
                <LocalizedClientLink key={p.id} href={p.href} className={`${item} flex items-center gap-3`} onClick={() => onPick("produto", p.handle)}>
                  <span className="relative h-10 w-8 shrink-0 rounded bg-eclat-areia/40 overflow-hidden">
                    {p.thumbnail && <Image src={p.thumbnail} alt="" fill sizes="32px" className="object-cover" />}
                  </span>
                  <span className="truncate">{p.title}</span>
                </LocalizedClientLink>
              ))}
            </div>
          )}
        </>
      )}
      <LocalizedClientLink href={`/busca?q=${encodeURIComponent(termo)}`} className={`${item} border-t border-ui-border-base text-eclat-terracota`} onClick={() => onPick("todos", termo)}>
        Ver todos os resultados para “{termo}”
      </LocalizedClientLink>
    </div>
  )
}
