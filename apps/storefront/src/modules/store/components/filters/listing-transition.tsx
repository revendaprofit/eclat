"use client"

import { createContext, useContext, useTransition, type ReactNode, type TransitionStartFunction } from "react"

type ListingTransitionValue = {
  isPending: boolean
  startTransition: TransitionStartFunction
}

const noop: TransitionStartFunction = (callback) => callback()

const ListingTransitionContext = createContext<ListingTransitionValue>({ isPending: false, startTransition: noop })

// Contexto compartilhado de transição: dá feedback de "carregando" (isPending) durante a navegação
// de filtro/ordenação/página sem depender de remontar a árvore (Suspense com key), o que preservava
// identidade instável do toolbar/painel/gaveta. useFilterNavigation usa startTransition ao navegar;
// PendingGrid usa isPending para aplicar aria-busy/opacidade na grade.
export function ListingTransitionProvider({ children }: { children: ReactNode }) {
  const [isPending, startTransition] = useTransition()
  return <ListingTransitionContext.Provider value={{ isPending, startTransition }}>{children}</ListingTransitionContext.Provider>
}

export function useListingTransition() {
  return useContext(ListingTransitionContext)
}
