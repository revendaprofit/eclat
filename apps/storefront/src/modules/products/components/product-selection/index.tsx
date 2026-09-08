"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import type { HttpTypes } from "@medusajs/types"
import { initialSelection, isCompleteSelection, selectedColor, sizeAvailability, variantFor, type Selection } from "@lib/util/pdp-variants"
import { getPrefs } from "@modules/personalization/prefs"

// Seleção de variante da PDP compartilhada por seletores, botão, galeria e "Avise-me".
type Ctx = {
  product: HttpTypes.StoreProduct
  selection: Selection
  setValue: (optionId: string, value: string) => void
  selectedVariant: HttpTypes.StoreProductVariant | null
  isComplete: boolean
  color: string | null
  sizeAvail: Record<string, boolean>
}
const SelectionContext = createContext<Ctx | null>(null)

export function ProductSelectionProvider({ product, initialVariantId, children }: { product: HttpTypes.StoreProduct; initialVariantId?: string | null; children: ReactNode }) {
  // SSR e 1º render do client usam só o v_id (determinístico); a preferência do wizard entra depois de hidratar.
  const [selection, setSelection] = useState<Selection>(() => initialSelection(product, { variantId: initialVariantId ?? null }))
  useEffect(() => {
    const pref = getPrefs().tamanho
    if (!pref) return
    setSelection((prev) => {
      const next = initialSelection(product, { variantId: initialVariantId ?? null, prefSize: pref })
      return Object.keys(next).length > Object.keys(prev).length ? { ...next, ...prev } : prev
    })
  }, [product, initialVariantId])

  const selectedVariant = useMemo(() => variantFor(product, selection), [product, selection])
  const isComplete = useMemo(() => isCompleteSelection(product, selection), [product, selection])
  const color = useMemo(() => selectedColor(product, selection), [product, selection])
  const sizeAvail = useMemo(() => sizeAvailability(product, color), [product, color])

  // ?v_id acompanha a variante sem recarregar (history API; o App Router sincroniza useSearchParams).
  useEffect(() => {
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    const current = url.searchParams.get("v_id")
    const next = selectedVariant?.id ?? null
    if (current === next) return
    if (next) url.searchParams.set("v_id", next)
    else url.searchParams.delete("v_id")
    window.history.replaceState(window.history.state, "", url.toString())
  }, [selectedVariant?.id])

  const value = useMemo<Ctx>(
    () => ({ product, selection, setValue: (id, v) => setSelection((p) => ({ ...p, [id]: v })), selectedVariant, isComplete, color, sizeAvail }),
    [product, selection, selectedVariant, isComplete, color, sizeAvail]
  )
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>
}

export function useProductSelection(): Ctx {
  const ctx = useContext(SelectionContext)
  if (!ctx) throw new Error("useProductSelection precisa de ProductSelectionProvider")
  return ctx
}
