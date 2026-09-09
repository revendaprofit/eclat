// Normalização pura de um par de categorias raiz (spec §4.2): guarda `a !== b`, ordena `a < b`.
// Fix round 1, achado "PUT /pares duplica a normalização de criarPar" — extraída para cá e usada
// tanto por `service.criarPar` quanto pela rota `PUT /admin/conjuntos/pares`, para que as duas
// únicas portas de escrita de um `ConjuntoPar` nunca divirjam sobre o que conta como "o mesmo par"
// (o CHECK `conjunto_par_ordem` do banco também exige `categoria_a < categoria_b`).
import { MedusaError } from "@medusajs/framework/utils"

export function normalizarPar(categoriaA: string, categoriaB: string): { categoria_a: string; categoria_b: string } {
  if (categoriaA === categoriaB) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Um par precisa de duas categorias diferentes.")
  }
  const [categoria_a, categoria_b] = [categoriaA, categoriaB].sort()
  return { categoria_a, categoria_b }
}
