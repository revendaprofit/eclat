import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { getNavigation } from "@lib/data/navigation"
import { listProducts } from "@lib/data/products"

// Categorias como "stories" (referência bechose.com.br, 2026-10-10): círculos com foto logo abaixo da
// capa. No celular é a navegação principal; no computador é um atalho. Foto = capa da categoria
// (metadata menu_image_url/image_url) ou, sem ela, a 1ª foto de um produto da categoria.
export default async function CategoriasStories({ countryCode }: { countryCode: string }) {
  const [nav, { response }] = await Promise.all([getNavigation(countryCode), listProducts({ countryCode, queryParams: { limit: 100 } })])
  const fotoDaCategoria = (ids: Set<string>) => response.products.find((p) => p.thumbnail && (p.categories ?? []).some((c) => ids.has(c.id)))?.thumbnail ?? null
  const itens = nav.roots
    .map((r) => ({ id: r.id, nome: r.name, handle: r.handle, foto: r.image_url ?? fotoDaCategoria(new Set([r.id, ...r.children.map((c) => c.id)])) }))
    .filter((i) => i.foto)
  if (itens.length < 2) return null

  return (
    <nav aria-label="Categorias" className="content-container py-6 small:py-8" data-testid="categorias-stories">
      <ul className="flex gap-4 small:gap-8 overflow-x-auto no-scrollbar -mx-4 px-4 small:mx-0 small:px-0 small:justify-center snap-x">
        {itens.map((i) => (
          <li key={i.id} className="shrink-0 snap-start">
            <LocalizedClientLink href={`/categories/${i.handle}`} className="group flex flex-col items-center gap-2 w-[76px] small:w-[96px]">
              <span className="relative block w-[72px] h-[72px] small:w-[92px] small:h-[92px] rounded-full p-[3px] bg-gradient-to-br from-eclat-terracota via-eclat-dourado to-eclat-terracota">
                <span className="relative block w-full h-full rounded-full overflow-hidden bg-eclat-areia/40 ring-2 ring-eclat-luz">
                  <Image src={i.foto as string} alt="" fill sizes="92px" quality={70} className="object-cover object-top transition-transform duration-500 group-hover:scale-110" />
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
