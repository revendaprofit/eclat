"use client"

import { useEffect, useState } from "react"

export type FraseDaProva = { frase: string; autora: string }

// Frases de clientes girando abaixo do nome da peça (sócia, 29/10/2026). Só texto, já na página: nada baixa a mais.
// Troca a cada 6 s com fade; pausa com o mouse em cima; com "reduzir movimento" ligado no aparelho, fica parada.
const INTERVALO_MS = 6000

export default function FrasesRotativas({ frases }: { frases: FraseDaProva[] }) {
  const [i, setI] = useState(0)
  const [visivel, setVisivel] = useState(true)
  const [pausado, setPausado] = useState(false)

  useEffect(() => {
    if (frases.length < 2 || pausado) return
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return
    const t = setInterval(() => {
      setVisivel(false)
      setTimeout(() => {
        setI((k) => (k + 1) % frases.length)
        setVisivel(true)
      }, 350)
    }, INTERVALO_MS)
    return () => clearInterval(t)
  }, [frases.length, pausado])

  const f = frases[i] ?? frases[0]
  if (!f) return null
  return (
    <figure
      className="mt-2"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      aria-live="polite"
      data-testid="prova-frases"
    >
      <div className={`transition-opacity duration-300 ${visivel ? "opacity-100" : "opacity-0"}`}>
        <blockquote className="text-sm italic text-eclat-grafite">“{f.frase}”</blockquote>
        <figcaption className="mt-0.5 text-xs text-eclat-grafite/70">{f.autora}</figcaption>
      </div>
      {frases.length > 1 && (
        <div className="mt-1.5 flex gap-1" aria-hidden>
          {frases.map((_, k) => (
            <span key={k} className={`h-1 w-1 rounded-full ${k === i ? "bg-eclat-terracota" : "bg-eclat-grafite/20"}`} />
          ))}
        </div>
      )}
    </figure>
  )
}
