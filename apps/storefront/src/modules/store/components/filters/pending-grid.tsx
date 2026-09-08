"use client"

import type { ReactNode } from "react"
import { clx } from "@modules/common/components/ui"
import { useListingTransition } from "./listing-transition"

// Envolve a grade + paginação para dar feedback de carregamento (aria-busy + opacidade) durante a
// transição de filtro, sem desmontar o conteúdo (mantém estado do que estiver dentro).
export default function PendingGrid({ children, className }: { children: ReactNode; className?: string }) {
  const { isPending } = useListingTransition()
  return (
    <div className={clx(className, "transition-opacity", isPending && "opacity-50 pointer-events-none")} aria-busy={isPending}>
      {children}
    </div>
  )
}
