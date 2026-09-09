// "Feche mais um conjunto" (spec §7.5, ruling 4): uma seção por oportunidade devolvida por
// GET /store/conjuntos/oportunidades, já hidratada pelo leitor (`getCarrinhoConjunto`). Sem
// dados → nada renderizado. Só na página do carrinho (ruling 4/5).
import { type Gatilho, tituloGatilho } from "@lib/util/carrinho-conjunto"
import Candidata from "./candidata"

export default function GatilhosConjunto({ gatilhos, countryCode }: { gatilhos: Gatilho[]; countryCode: string }) {
  if (!gatilhos.length) return null
  return (
    <section className="mt-10" data-testid="gatilhos-conjunto">
      <h2 className="font-serif text-2xl text-eclat-grafite">Feche mais um conjunto</h2>
      {gatilhos.map((g) => (
        <div key={`${g.collection_id}:${g.categoria_faltante}`} className="mt-6" data-testid="gatilho">
          <p className="text-sm text-eclat-grafite/70" data-testid="gatilho-titulo">
            {tituloGatilho(g)}
          </p>
          <ul className="mt-4 grid grid-cols-2 small:grid-cols-3 gap-x-6 gap-y-8">
            {g.candidatas.map((p) => (
              <li key={p.id}>
                <Candidata produto={p} gatilho={g} countryCode={countryCode} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
