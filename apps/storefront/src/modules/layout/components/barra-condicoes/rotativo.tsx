"use client"

import { useEffect, useState } from "react"

// Celular: uma frase por vez, trocando a cada 4 s. Com "reduzir movimento" ligado, não gira:
// mostra só a primeira (o cupom). Toque na barra avança manualmente.
const INTERVALO_MS = 4000

export default function Rotativo({ frases, destaquePrimeira }: { frases: string[]; destaquePrimeira: boolean }) {
  const [i, setI] = useState(0)

  useEffect(() => {
    if (frases.length < 2) return
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return
    const t = window.setInterval(() => setI((n) => (n + 1) % frases.length), INTERVALO_MS)
    return () => window.clearInterval(t)
  }, [frases.length])

  return (
    <button
      type="button"
      onClick={() => setI((n) => (n + 1) % frases.length)}
      className="small:hidden block w-full text-center px-4 py-2 min-h-[32px]"
      aria-live="polite"
      aria-label={`${frases[i]}. Toque para a próxima condição.`}
    >
      <span key={i} className={`inline-block animate-[eclat-fade-up_300ms_ease-out] ${i === 0 && destaquePrimeira ? "font-semibold" : ""}`}>
        {frases[i]}
      </span>
    </button>
  )
}
