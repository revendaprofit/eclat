"use client"

import { Suspense, useCallback } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import ConjuntoRegras from "@/components/conjunto-regras"
import ConjuntoCurados from "@/components/conjunto-curados"

const ABAS = [
  { value: "regras", label: "Regras" },
  { value: "curados", label: "Conjuntos curados" },
] as const

function ConjuntosPageInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const aba = searchParams.get("aba") === "curados" ? "curados" : "regras"

  const irPara = useCallback(
    (nova: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (nova === "regras") params.delete("aba")
      else params.set("aba", nova)
      const qs = params.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname)
    },
    [pathname, router, searchParams]
  )

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="font-serif text-3xl text-eclat-grafite">Conjuntos (benefício)</h1>
        <p className="text-sm text-eclat-grafite/60 mt-1">
          Desconto automático para pares de peças (ex.: Top + Legging) e conjuntos curados pela loja.
        </p>
      </div>

      <div className="flex gap-1 border-b border-eclat-pedra/30">
        {ABAS.map((a) => (
          <button
            key={a.value}
            onClick={() => irPara(a.value)}
            className={`px-4 py-2 text-sm uppercase tracking-wider transition-colors border-b-2 -mb-px ${
              aba === a.value
                ? "border-eclat-dourado text-eclat-grafite font-medium"
                : "border-transparent text-eclat-grafite/50 hover:text-eclat-grafite"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {aba === "regras" ? <ConjuntoRegras /> : <ConjuntoCurados />}
    </div>
  )
}

export default function ConjuntosPage() {
  return (
    <Suspense fallback={<p className="text-sm text-eclat-grafite/50">Carregando…</p>}>
      <ConjuntosPageInner />
    </Suspense>
  )
}
