"use client"

import { useId, useState, type ReactNode } from "react"
import { clx } from "@modules/common/components/ui"

// Abas de vitrine (referência bechose.com.br, 2026-10-10): todos os painéis vêm prontos do servidor
// (cards já com preço e estoque) e o cliente só troca qual está visível. Sem busca no clique, sem
// skeleton: a troca é instantânea e a primeira aba já está na tela ao carregar.
export type Aba = { id: string; rotulo: string; href?: string; painel: ReactNode }

export default function Abas({ abas, nomeDaLista }: { abas: Aba[]; nomeDaLista: string }) {
  const [ativa, setAtiva] = useState(0)
  const base = useId()
  if (!abas.length) return null
  return (
    <div data-testid={`abas-${nomeDaLista}`}>
      <div role="tablist" aria-label={nomeDaLista} className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 small:mx-0 small:px-0 small:justify-center">
        {abas.map((a, i) => (
          <button
            key={a.id}
            id={`${base}-aba-${a.id}`}
            role="tab"
            type="button"
            aria-selected={i === ativa}
            aria-controls={`${base}-painel-${a.id}`}
            onClick={() => setAtiva(i)}
            className={clx(
              "shrink-0 rounded-full border px-4 py-2 text-[11px] uppercase tracking-[0.18em] transition-colors",
              i === ativa ? "border-eclat-grafite bg-eclat-grafite text-eclat-luz" : "border-eclat-pedra/60 text-eclat-grafite/70 hover:border-eclat-grafite hover:text-eclat-grafite"
            )}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
      {abas.map((a, i) => (
        <div key={a.id} id={`${base}-painel-${a.id}`} role="tabpanel" aria-labelledby={`${base}-aba-${a.id}`} hidden={i !== ativa} className="mt-8">
          {a.painel}
        </div>
      ))}
    </div>
  )
}
