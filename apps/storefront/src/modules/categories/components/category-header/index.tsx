import Image from "next/image"
import { HttpTypes } from "@medusajs/types"
import { listCategories } from "@lib/data/categories"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { clx } from "@modules/common/components/ui"

type Meta = { image_url?: string | null; descricao_curta?: string | null }
type Rankable = { rank: number | null; name: string }

const byRank = (a: Rankable, b: Rankable) => (a.rank ?? 0) - (b.rank ?? 0) || a.name.localeCompare(b.name, "pt-BR")

// Cabeçalho da listagem por categoria (spec §6.3): capa, descrição curta, chips para trocar rápido.
export default async function CategoryHeader({ category }: { category: HttpTypes.StoreProductCategory }) {
  const meta = (category.metadata ?? {}) as Meta

  // Filhas: estrutura da categoria (category_children — a Store API só retorna ativas),
  // independente de ter produto hoje: uma categoria "vazia" (ex.: Masculino) ainda
  // precisa navegar para as subcategorias.
  const filhas = [...(category.category_children ?? [])].sort(byRank)

  // Irmãs: só quando a categoria não tem filhas. Mesmo parent_category_id (raiz = null conta
  // como grupo) e com produto publicado — evita chip para link vazio.
  let irmas: HttpTypes.StoreProductCategory[] = []
  if (filhas.length === 0) {
    const all = (await listCategories().catch(() => [])) as HttpTypes.StoreProductCategory[]
    irmas = all
      .filter((c) => (c.products?.length ?? 0) > 0)
      .filter((c) => c.parent_category_id === category.parent_category_id)
      .sort(byRank)
  }

  const chips: { handle: string; name: string; atual: boolean }[] = filhas.length
    ? filhas.map((c) => ({ handle: c.handle, name: c.name, atual: false }))
    : irmas.map((c) => ({ handle: c.handle, name: c.name, atual: c.id === category.id }))

  return (
    <header className="mb-8" data-testid="category-header">
      {meta.image_url && (
        <div className="relative w-full aspect-[2/1] small:aspect-[3/1] overflow-hidden rounded-lg mb-6 bg-eclat-areia/40">
          <Image src={meta.image_url} alt={`${category.name} — use.ÉCLAT`} fill priority quality={80} sizes="100vw" className="object-cover" />
        </div>
      )}
      <h1 className="font-serif text-3xl text-eclat-grafite" data-testid="category-page-title">{category.name}</h1>
      {meta.descricao_curta && <p className="mt-2 text-eclat-grafite/70 max-w-2xl">{meta.descricao_curta}</p>}
      {chips.length > 0 && (
        <nav className="mt-5 flex flex-wrap gap-2" aria-label={filhas.length ? "Subcategorias" : "Categorias"}>
          {filhas.length > 0 && (
            <span className="h-9 px-4 rounded-full border border-eclat-grafite bg-eclat-grafite text-eclat-luz text-xs uppercase tracking-wider flex items-center">Tudo de {category.name}</span>
          )}
          {chips.map((c) => (
            <LocalizedClientLink
              key={c.handle}
              href={`/categories/${c.handle}`}
              className={clx("h-9 px-4 rounded-full border text-xs uppercase tracking-wider flex items-center", c.atual ? "border-eclat-grafite bg-eclat-grafite text-eclat-luz" : "border-eclat-pedra/60 hover:border-eclat-grafite")}
              aria-current={c.atual ? "page" : undefined}
            >
              {c.name}
            </LocalizedClientLink>
          ))}
        </nav>
      )}
    </header>
  )
}
