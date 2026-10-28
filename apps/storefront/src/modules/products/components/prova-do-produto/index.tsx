import type { HttpTypes } from "@medusajs/types"
import { lerProva } from "@lib/util/prova"

// Faixa de prova logo abaixo do nome (diagnóstico do funil, 2026-10-27): a promessa do anúncio e a
// frase da cliente na primeira rolagem, antes do tamanho e do preço. Some sem product.metadata.prova.
export default function ProvaDoProduto({ product }: { product: HttpTypes.StoreProduct }) {
  const prova = lerProva(product.metadata?.prova)
  if (!prova) return null
  return (
    <div
      className="lg:max-w-[500px] mx-auto w-full border-l-2 border-eclat-terracota bg-eclat-blush-claro/60 px-4 py-3"
      data-testid="prova-do-produto"
    >
      <p className="font-semibold text-eclat-grafite">{prova.titulo}</p>
      {prova.texto && <p className="mt-0.5 text-sm text-eclat-grafite/80">{prova.texto}</p>}
      {prova.frase && (
        <figure className="mt-2">
          <blockquote className="text-sm italic text-eclat-grafite">“{prova.frase}”</blockquote>
          <figcaption className="mt-0.5 text-xs text-eclat-grafite/70">{prova.autora}</figcaption>
        </figure>
      )}
    </div>
  )
}
