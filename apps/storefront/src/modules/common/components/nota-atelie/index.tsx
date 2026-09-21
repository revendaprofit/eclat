import type { ReactNode } from "react"

// "Nota de ateliê": o cartão do resumo (sacola, checkout e pedido). Filete duplo em terracota no topo,
// fundo blush claro e título em serifada — a assinatura visual do fluxo de compra (redesenho 2026-09).
// As linhas de valores vêm do `CartTotals`, com pontilhado entre rótulo e valor.
export default function NotaAtelie({
  titulo,
  children,
  className = "",
  ...rest
}: {
  titulo: string
  children: ReactNode
  className?: string
  "data-testid"?: string
}) {
  return (
    <section
      className={`relative rounded-md border border-eclat-pedra/60 bg-eclat-blush-claro/45 px-5 pb-6 pt-7 small:px-6 ${className}`}
      {...rest}
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] rounded-t-md bg-eclat-terracota" />
      <span aria-hidden className="absolute inset-x-0 top-[6px] h-px bg-eclat-terracota/50" />
      <div className="mb-5 flex items-baseline justify-between">
        <h2 className="font-serif text-3xl leading-none text-eclat-grafite">{titulo}</h2>
        <span className="text-[10px] uppercase tracking-[0.25em] text-eclat-terracota">use.ÉCLAT</span>
      </div>
      {children}
    </section>
  )
}
