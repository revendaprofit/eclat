import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { getNavigation } from "@lib/data/navigation"
import { listProducts } from "@lib/data/products"

// Categorias como "stories" (referência bechose.com.br, 2026-10-10): círculos com foto logo abaixo da
// capa. No celular é a navegação principal; no computador é um atalho. A foto dá ênfase à PEÇA que o
// nome do círculo anuncia (pedido da sócia, 2026-10-10): 1º a foto quadrada escolhida para a categoria
// (metadata menu_image_url, scripts/fotos-categorias.py: short inteiro, tronco do macaquinho de costas,
// camiseta); sem ela, o recorte de detalhe de um produto; por fim a 1ª foto de um produto, pelo meio.
const DETALHE = /\/detalhes-pecas\//

export default async function CategoriasStories({ countryCode }: { countryCode: string }) {
  const [nav, { response }] = await Promise.all([getNavigation(countryCode), listProducts({ countryCode, queryParams: { limit: 100 } })])
  const fotoDaCategoria = (ids: Set<string>) => {
    const produtos = response.products.filter((p) => (p.categories ?? []).some((c) => ids.has(c.id)))
    for (const p of produtos) {
      const detalhe = (p.images ?? []).find((i) => i.url && DETALHE.test(i.url))?.url
      if (detalhe) return { url: detalhe, detalhe: true }
    }
    const capa = produtos.find((p) => p.thumbnail)?.thumbnail
    return capa ? { url: capa, detalhe: false } : null
  }
  const itens = nav.roots
    .map((r) => {
      const ids = new Set([r.id, ...r.children.map((c) => c.id)])
      const daLoja = fotoDaCategoria(ids)
      // Foto escolhida à mão para a categoria (metadata menu_image_url, scripts/fotos-categorias.py) vence; depois o
      // recorte de detalhe de um produto; por fim a 1ª foto de um produto, pelo meio.
      const foto = r.image_url ? { url: r.image_url, detalhe: true } : daLoja
      return { id: r.id, nome: r.name, handle: r.handle, foto }
    })
    .filter((i): i is typeof i & { foto: { url: string; detalhe: boolean } } => !!i.foto)
  if (itens.length < 2) return null

  return (
    <nav aria-label="Categorias" className="content-container py-6 small:py-8" data-testid="categorias-stories">
      <ul className="flex gap-4 small:gap-8 overflow-x-auto no-scrollbar -mx-4 px-4 small:mx-0 small:px-0 small:justify-center snap-x">
        {itens.map((i) => (
          <li key={i.id} className="shrink-0 snap-start">
            {/* Retângulo 3:4 com moldura dupla (terracota + filete dourado), no lugar das bolinhas — escolha da
                sócia em 2026-10-10 ("mais original ÉCLAT"), sobre mock com as fotos reais. O filete é dourado de
                verdade (#C9A24C): o token `eclat-dourado` do Tailwind é só um apelido antigo do terracota. */}
            <LocalizedClientLink href={`/categories/${i.handle}`} className="group flex flex-col items-center gap-2.5 w-[88px] small:w-[112px]">
              <span className="relative block w-[84px] h-[112px] small:w-[104px] small:h-[138px] p-[3px] border border-eclat-terracota outline outline-1 outline-offset-[3px] outline-[#C9A24C] bg-eclat-luz">
                <span className="relative block w-full h-full overflow-hidden bg-eclat-areia/40">
                  <Image src={i.foto.url} alt="" fill sizes="104px" quality={72} priority className={`object-cover transition-transform duration-500 group-hover:scale-110 ${i.foto.detalhe ? "object-center" : "object-[50%_40%]"}`} />
                </span>
              </span>
              <span className="text-[10px] small:text-[11px] uppercase tracking-[0.15em] text-eclat-grafite text-center leading-tight">{i.nome}</span>
            </LocalizedClientLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
