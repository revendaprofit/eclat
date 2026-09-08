"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import type { HttpTypes } from "@medusajs/types"
import { findOption, initialSelection, isCompleteSelection, selectedColor, sizeAvailability, variantFor, type Selection } from "@lib/util/pdp-variants"
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

export function ProductSelectionProvider({ product, initialVariantId, initialColor, children }: { product: HttpTypes.StoreProduct; initialVariantId?: string | null; initialColor?: string | null; children: ReactNode }) {
  // SSR e 1º render do client usam só v_id/cor da URL (determinístico); a preferência do wizard
  // entra depois de hidratar. O template monta este provider com `key={product.id}`, então ele é
  // recriado do zero a cada troca de produto — este efeito de montagem ([] deps) roda uma vez por
  // produto, sem precisar recalcular deps.
  const [selection, setSelection] = useState<Selection>(() => initialSelection(product, { variantId: initialVariantId ?? null, color: initialColor ?? null }))
  useEffect(() => {
    const pref = getPrefs().tamanho
    if (!pref) return
    const tamOpt = findOption(product, "Tamanho")
    if (tamOpt && selection[tamOpt.id] !== undefined) return
    const next = initialSelection(product, { variantId: initialVariantId ?? null, color: initialColor ?? null, prefSize: pref })
    setSelection((prev) => ({ ...next, ...prev }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedVariant = useMemo(() => variantFor(product, selection), [product, selection])
  const isComplete = useMemo(() => isCompleteSelection(product, selection), [product, selection])
  const color = useMemo(() => selectedColor(product, selection), [product, selection])
  const sizeAvail = useMemo(() => sizeAvailability(product, color), [product, color])

  // ?v_id acompanha a variante sem recarregar (history API). Passamos `null` como 1º argumento
  // (não `window.history.state`): o Next 15.5 detecta o estado atual (`__NA`) e, ao ver o MESMO
  // objeto de volta, curto-circuita sem atualizar sua URL canônica interna — daí o próximo refresh
  // do router (ex.: `addToCart` → `revalidateTag`) sobrescreve a barra de endereço e perde o `?v_id`.
  // Com `null`, o Next copia seu próprio estado interno e dispara uma restauração que também
  // ressincroniza `useSearchParams`.
  useEffect(() => {
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    const current = url.searchParams.get("v_id")
    const next = selectedVariant?.id ?? null
    if (current === next) return
    if (next) url.searchParams.set("v_id", next)
    else url.searchParams.delete("v_id")
    window.history.replaceState(null, "", url.toString())
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
