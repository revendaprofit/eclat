// "Complete o conjunto" (spec §7.3, §7.4, rulings 5–6): bloco da PDP com as parceiras vendáveis
// do produto (até 6) e os curados que o incluem. Server: busca os dados (`getConjuntosDoProduto`)
// e delega a apresentação — parceiras precisam da seleção da PÁGINA via `useProductSelection`
// (hook), então viram um client component (`Parceira`); curados são só links, reaproveitam o
// `CardConjunto` da vitrine (Task 3). Sem parceiras e sem curados → `null` (nada a mostrar).
import type { HttpTypes } from "@medusajs/types"
import type { ColorMap } from "@lib/util/colors"
import { getConjuntosDoProduto } from "@lib/data/conjuntos"
import { MAX_PARCEIRAS, descricaoRegra } from "@lib/util/conjuntos"
import CardConjunto from "@modules/conjuntos/components/card-conjunto"
import Parceira from "./parceira"

// `colorMap` entra na assinatura por paridade com o resto da PDP (`ProductTemplate` já o busca e
// passa adiante) — `Parceira` não usa swatch de cor (a cor da parceira é derivada, não escolhida
// pela cliente), então não é repassado.
export default async function CompleteSet({
  product,
  countryCode,
  colorMap: _colorMap,
}: {
  product: HttpTypes.StoreProduct
  countryCode: string
  colorMap: ColorMap
}) {
  const { parceiras, regra, curados } = await getConjuntosDoProduto(product.id, countryCode)
  if (!parceiras.length && !curados.length) return null

  const parceirasLimitadas = parceiras.slice(0, MAX_PARCEIRAS)

  return (
    <div className="content-container my-16 small:my-24" data-testid="complete-set">
      {parceirasLimitadas.length > 0 && (
        <section className="mb-16" data-testid="complete-set-parceiras">
          <h2 className="font-serif text-2xl text-eclat-grafite">Complete o conjunto</h2>
          {regra && (
            <p className="mt-1 text-sm text-eclat-grafite/70" data-testid="complete-set-regra">
              Leve as duas com {descricaoRegra(regra, 2)}
            </p>
          )}
          <ul className="mt-6 grid grid-cols-2 small:grid-cols-3 medium:grid-cols-4 large:grid-cols-6 gap-x-6 gap-y-10">
            {parceirasLimitadas.map((parceira) => (
              <li key={parceira.id}>
                <Parceira parceira={parceira} countryCode={countryCode} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {curados.length > 0 && (
        <section data-testid="complete-set-curados">
          <h2 className="font-serif text-2xl text-eclat-grafite mb-6">Looks com essa peça</h2>
          <ul className="grid grid-cols-2 small:grid-cols-3 medium:grid-cols-4 gap-x-6 gap-y-8">
            {curados.map((c) => (
              <li key={c.handle}>
                <CardConjunto card={c} listName="Complete o conjunto" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
