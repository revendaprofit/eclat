import { listCategories } from "@lib/data/categories"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"

// Menu principal (desktop): linhas de topo (ex.: Treino, Casual) com dropdown
// das suas subcategorias. Dropdown puramente em CSS (hover) — sem JS.
export default async function MainMenu() {
  const categories = await listCategories().catch(
    () => [] as HttpTypes.StoreProductCategory[]
  )

  // linhas = categorias de topo (sem pai) que possuem subcategorias
  const lines = (categories || []).filter(
    (c) => !c.parent_category && (c.category_children?.length ?? 0) > 0
  )

  if (!lines.length) {
    // fallback: sem hierarquia configurada, mostra só "Loja"
    return (
      <LocalizedClientLink
        className="hover:text-eclat-terracota transition-colors"
        href="/store"
        data-testid="nav-store-all-link"
      >
        Loja
      </LocalizedClientLink>
    )
  }

  return (
    <>
      {lines.map((line) => (
        <div
          key={line.id}
          className="relative h-full flex items-center group/line"
        >
          <LocalizedClientLink
            href={`/categories/${line.handle}`}
            className="hover:text-eclat-terracota transition-colors uppercase tracking-wide"
            data-testid={`nav-line-${line.handle}`}
          >
            {line.name}
          </LocalizedClientLink>

          {/* dropdown de subcategorias */}
          <div className="invisible opacity-0 translate-y-1 group-hover/line:visible group-hover/line:opacity-100 group-hover/line:translate-y-0 transition-all duration-150 absolute top-full left-1/2 -translate-x-1/2 pt-3 z-50">
            <div className="min-w-[200px] bg-white border border-ui-border-base shadow-xl py-2">
              {line.category_children?.map((child) => (
                <LocalizedClientLink
                  key={child.id}
                  href={`/categories/${child.handle}`}
                  className="block px-5 py-2 text-eclat-grafite hover:text-eclat-terracota hover:bg-eclat-luz transition-colors whitespace-nowrap"
                >
                  {child.name}
                </LocalizedClientLink>
              ))}
              <div className="border-t border-ui-border-base mt-1 pt-1">
                <LocalizedClientLink
                  href={`/categories/${line.handle}`}
                  className="block px-5 py-2 text-eclat-terracota text-small-regular whitespace-nowrap"
                >
                  Ver tudo de {line.name} →
                </LocalizedClientLink>
              </div>
            </div>
          </div>
        </div>
      ))}
    </>
  )
}
