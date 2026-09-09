"use client"

import { useState } from "react"
import type { CardConjunto as CardConjuntoData } from "@lib/util/conjuntos"
import CardConjunto from "./card-conjunto"

export const CARDS_INICIAIS = 12
const LIMITE = CARDS_INICIAIS

// Grade de uma seção "por coleção" da vitrine de Conjuntos (spec §7.1, ruling 3): mostra até 12
// pares e revela o restante sob demanda (estado local, sem navegação/query — a coleção inteira já
// veio do servidor). Curados não passam por aqui: são sempre exibidos por completo.
export default function GradeColecao({
  cards,
  listName,
}: {
  cards: CardConjuntoData[]
  listName: string
}) {
  const [todos, setTodos] = useState(false)
  const visiveis = todos ? cards : cards.slice(0, LIMITE)

  return (
    <div>
      <ul
        className="grid grid-cols-2 w-full small:grid-cols-3 medium:grid-cols-4 gap-x-6 gap-y-8"
        data-testid="grade-colecao-list"
      >
        {visiveis.map((c) => (
          <li key={c.handle}>
            <CardConjunto card={c} listName={listName} />
          </li>
        ))}
      </ul>
      {!todos && cards.length > LIMITE && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setTodos(true)}
            className="underline text-eclat-terracota text-sm"
            data-testid="ver-todos-colecao"
          >
            Ver todos os conjuntos da coleção
          </button>
        </div>
      )}
    </div>
  )
}
