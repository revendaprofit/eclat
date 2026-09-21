import type { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import GuaranteeSeals from "@modules/products/components/guarantee-seals"
import { DEFAULT_FAQ, FaqLista, type QA } from "@modules/products/components/product-faq"

// O que a página do conjunto não tinha e a PDP tem: o texto de cada peça, as garantias e as
// dúvidas. Quem chega por anúncio cai direto aqui, sem passar pela PDP — sem isto a página era
// só foto, tamanho e botão. Tudo vem de dado real: a descrição é a do produto no Medusa, os
// prazos são os da política (GuaranteeSeals) e o FAQ é o da marca + as regras do conjunto.
const FAQ_DO_CONJUNTO: QA[] = [
  {
    q: "Como escolho meu tamanho?",
    a: "Cada peça tem o link “Guia de medidas” logo abaixo dos tamanhos, com a tabela dela. Meça busto, cintura e quadril com a fita paralela ao chão. Entre dois tamanhos: o menor sustenta mais, o maior é mais confortável.",
  },
  {
    q: "Posso escolher um tamanho para cada peça?",
    a: "Sim. Cada peça do conjunto tem o seu seletor de tamanho e de cor — o desconto vale do mesmo jeito.",
  },
  {
    q: "O desconto do conjunto soma com cupom?",
    a: "Não somam: em cada peça vale o maior desconto entre o do conjunto e o do cupom. Você nunca paga mais por ter usado um cupom.",
  },
]

export default function InformacoesConjunto({ produtos }: { produtos: HttpTypes.StoreProduct[] }) {
  const comTexto = produtos.filter((p) => p.description?.trim())
  return (
    <div className="flex flex-col gap-y-12 mt-12 small:mt-16 max-w-3xl pb-32 small:pb-0" data-testid="conjunto-informacoes">
      {comTexto.length > 0 && (
        <section>
          <h2 className="font-serif text-2xl text-eclat-grafite mb-6 after:block after:w-10 after:h-0.5 after:bg-eclat-terracota after:mt-3">
            Sobre as peças
          </h2>
          <div className="flex flex-col gap-y-8">
            {comTexto.map((p) => (
              <article key={p.id} data-testid="conjunto-peca-descricao">
                <h3 className="font-serif text-lg text-eclat-grafite mb-2">{p.title}</h3>
                <p className="text-sm text-eclat-grafite/80 leading-relaxed whitespace-pre-line">{p.description}</p>
                <LocalizedClientLink
                  href={`/products/${p.handle}`}
                  className="inline-block mt-2 text-xs underline text-eclat-grafite/70"
                >
                  Ver composição, medidas e cuidados
                </LocalizedClientLink>
              </article>
            ))}
          </div>
        </section>
      )}
      <section>
        <h2 className="font-serif text-2xl text-eclat-grafite mb-2 after:block after:w-10 after:h-0.5 after:bg-eclat-terracota after:mt-3">
          Compra sem risco
        </h2>
        <GuaranteeSeals />
      </section>
      {/* a 1ª pergunta do FAQ da marca fala da "tabela acima", que só existe na PDP — aqui entra a versão do conjunto */}
      <FaqLista items={[...FAQ_DO_CONJUNTO, ...DEFAULT_FAQ.slice(1)]} />
    </div>
  )
}
