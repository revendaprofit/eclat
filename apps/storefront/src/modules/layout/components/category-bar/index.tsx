import { listCategories } from "@lib/data/categories"
import { getSiteContent } from "@lib/data/site-content"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"

// Barra de categorias (desktop): segunda linha do header expondo as categorias
// que têm produto publicado — sem hover, sem sanduíche. "Nova Coleção" entra
// fixa em destaque, apontando para a coleção configurada no Cockpit (Vitrine →
// Coleção em destaque); sem configuração, cai em /store.
export default async function CategoryBar() {
  const [categories, featured] = await Promise.all([
    listCategories().catch(() => [] as HttpTypes.StoreProductCategory[]),
    getSiteContent<{ collection_handle?: string }>("home.featured").catch(
      () => null
    ),
  ])

  const comProdutos = (categories || []).filter(
    (c) =>
      ((c as { products?: unknown[] }).products?.length ?? 0) > 0
  )

  const colecaoHref = featured?.collection_handle
    ? `/collections/${featured.collection_handle}`
    : "/store"

  return (
    <div className="hidden small:block bg-white border-b border-ui-border-base">
      <nav
        className="content-container flex items-center justify-center gap-x-10 h-11 text-xsmall-regular uppercase tracking-[0.18em]"
        aria-label="Categorias"
      >
        <LocalizedClientLink
          href={colecaoHref}
          className="text-eclat-terracota hover:text-eclat-terracota-escuro transition-colors font-semibold"
          data-testid="nav-nova-colecao"
        >
          Nova Coleção
        </LocalizedClientLink>
        {comProdutos.map((c) => (
          <LocalizedClientLink
            key={c.id}
            href={`/categories/${c.handle}`}
            className="text-eclat-grafite/80 hover:text-eclat-terracota transition-colors"
            data-testid={`nav-cat-${c.handle}`}
          >
            {c.name}
          </LocalizedClientLink>
        ))}
        <LocalizedClientLink
          href="/store"
          className="text-eclat-grafite/60 hover:text-eclat-terracota transition-colors"
          data-testid="nav-ver-tudo"
        >
          Ver tudo
        </LocalizedClientLink>
      </nav>
    </div>
  )
}
