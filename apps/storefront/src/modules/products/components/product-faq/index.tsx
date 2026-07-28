import { FaqJsonLd } from "@modules/seo/jsonld"
import { HttpTypes } from "@medusajs/types"

// FAQ answer-first DENTRO da PDP com schema FAQPage (spec, seção 10 + GEO).
// Perguntas específicas do produto vêm de product.metadata.faq (JSON [{q,a}]);
// sem metadata, usa o FAQ padrão da marca. <details> nativo = zero JS.

type QA = { q: string; a: string }

const DEFAULT_FAQ: QA[] = [
  {
    q: "Como escolho meu tamanho?",
    a: "Use a tabela de medidas acima, medindo busto na parte mais cheia, cintura na parte mais fina e quadril na parte mais cheia, sempre com a fita paralela ao chão. Entre dois tamanhos: o menor sustenta mais, o maior é mais confortável.",
  },
  {
    q: "Serve para usar fora do treino?",
    a: "Sim — é a proposta da ÉCLAT. O caimento foi pensado para sair do estúdio direto para a rua, sem parecer roupa de ginástica.",
  },
  {
    q: "Posso trocar ou devolver?",
    a: "Sim. Você tem 7 dias corridos após o recebimento para desistir da compra com reembolso integral (CDC), com a peça sem uso e com etiquetas. Para troca de tamanho, chame no WhatsApp com o número do pedido. Defeito de fabricação: troca sem custo em até 30 dias.",
  },
  {
    q: "Qual o prazo de entrega?",
    a: "Enviamos para todo o Brasil, com rastreio. O prazo aparece no checkout de acordo com o seu CEP.",
  },
]

function parseMetaFaq(meta: Record<string, unknown> | null | undefined): QA[] | null {
  const raw = meta?.faq
  if (!raw) return null
  try {
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw
    if (Array.isArray(arr)) {
      const items = arr.filter((x) => x && x.q && x.a) as QA[]
      return items.length > 0 ? items : null
    }
  } catch {
    /* metadata malformada: cai no padrão */
  }
  return null
}

export default function ProductFaq({
  product,
}: {
  product: HttpTypes.StoreProduct
}) {
  const items = parseMetaFaq(product.metadata) ?? DEFAULT_FAQ
  return (
    <section className="mt-10">
      <FaqJsonLd items={items} />
      <h2 className="font-serif text-2xl text-eclat-grafite mb-2">
        Dúvidas frequentes
      </h2>
      <div className="divide-y divide-ui-border-base border-t border-ui-border-base">
        {items.map((it) => (
          <details key={it.q} className="group py-1">
            <summary className="flex justify-between items-center gap-3 cursor-pointer list-none py-3 text-sm font-semibold text-eclat-grafite min-h-[48px]">
              {it.q}
              <span className="text-eclat-terracota font-mono group-open:hidden">+</span>
              <span className="text-eclat-terracota font-mono hidden group-open:inline">−</span>
            </summary>
            <p className="pb-4 text-sm text-eclat-grafite/70 leading-relaxed">
              {it.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  )
}
