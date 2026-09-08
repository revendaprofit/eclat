"use client"

import { createContext, useContext, useTransition, type ReactNode, type TransitionStartFunction } from "react"

type ListingTransitionValue = { isPending: boolean; startTransition: TransitionStartFunction; implicitSize: string | null }

const noop: TransitionStartFunction = (callback) => callback()

const ListingTransitionContext = createContext<ListingTransitionValue>({ isPending: false, startTransition: noop, implicitSize: null })

// Contexto compartilhado de transição: dá feedback de "carregando" (isPending) durante a navegação
// de filtro/ordenação/página sem depender de remontar a árvore (Suspense com key), o que preservava
// identidade instável do toolbar/painel/gaveta. useFilterNavigation usa startTransition ao navegar;
// PendingGrid usa isPending para aplicar aria-busy/opacidade na grade.
// implicitSize: tamanho do wizard pré-aplicado pelo servidor (spec §10) — a navegação de filtros
// precisa dele para gravar o opt-out `?tamanho=` (listingHref).
export function ListingTransitionProvider({ children, implicitSize = null }: { children: ReactNode; implicitSize?: string | null }) {
  const [isPending, startTransition] = useTransition()
  return <ListingTransitionContext.Provider value={{ isPending, startTransition, implicitSize }}>{children}</ListingTransitionContext.Provider>
}

export function useListingTransition() {
  return useContext(ListingTransitionContext)
}
