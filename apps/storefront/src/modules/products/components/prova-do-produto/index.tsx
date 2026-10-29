import type { HttpTypes } from "@medusajs/types"
import { frasesDaProva, lerProva } from "@lib/util/prova"
import { getSiteContent } from "@lib/data/site-content"
import type { Testimonials as TestimonialsType } from "@modules/home/content"
import { depoimentosDaPeca, depoimentosReais } from "@lib/util/depoimentos"
import FrasesRotativas from "./frases-rotativas"

// Faixa de prova logo abaixo do nome (diagnóstico do funil, 2026-10-27): a promessa do anúncio e a
// frase da cliente na primeira rolagem, antes do tamanho e do preço. Some sem product.metadata.prova.
// 29/10 (sócia): as frases giram — a da prova mais as dos depoimentos marcados para a peça (até 5), só texto.
export default async function ProvaDoProduto({ product }: { product: HttpTypes.StoreProduct }) {
  const prova = lerProva(product.metadata?.prova)
  if (!prova) return null
  const content = await getSiteContent<TestimonialsType>("home.testimonials")
  const frases = frasesDaProva(prova, depoimentosDaPeca(depoimentosReais(content?.items), product.handle))
  return (
    <div
      className="lg:max-w-[500px] mx-auto w-full border-l-2 border-eclat-terracota bg-eclat-blush-claro/60 px-4 py-3"
      data-testid="prova-do-produto"
    >
      <p className="font-semibold text-eclat-grafite">{prova.titulo}</p>
      {prova.texto && <p className="mt-0.5 text-sm text-eclat-grafite/80">{prova.texto}</p>}
      {frases.length > 0 && <FrasesRotativas frases={frases} />}
    </div>
  )
}
