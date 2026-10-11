import type { HttpTypes } from "@medusajs/types"
import { listProducts } from "@lib/data/products"
import { getListagemConfig } from "@lib/data/listagem"
import { getNavigation } from "@lib/data/navigation"
import { getSiteContent } from "@lib/data/site-content"
import { getVitrineConjuntos } from "@lib/data/conjuntos"
import { DEFAULT_FILTERS } from "@lib/util/catalog-filters"
import { entradasPorCor, entryKey, type ListingEntry } from "@lib/util/listagem-cores"
import { isProductAvailable, type StockVariant } from "@lib/util/availability"
import ProductPreview from "@modules/products/components/product-preview"
import CardConjunto from "@modules/conjuntos/components/card-conjunto"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Abas, { type Aba } from "../abas"

// Vitrine única da home com abas (referência bechose.com.br, 2026-10-10): Mais vendidos · Novidades ·
// Conjuntos · uma aba por categoria raiz. Substitui a lista longa da coleção (14 cards em coluna).
// "Mais vendidos" = handles em site_content `home.vitrine.mais_vendidos` (o Cockpit edita); sem lista,
// vale a ordem do catálogo. Cada aba mostra até MAX cards, um por cor (mesmo interruptor da listagem).
const MAX = 8

type Vitrine = { mais_vendidos?: string[]; heading?: string; subheading?: string }

function porCor(products: HttpTypes.StoreProduct[], cardsPorCor: boolean): ListingEntry[] {
  return entradasPorCor(products, DEFAULT_FILTERS, cardsPorCor).slice(0, MAX)
}

function Grade({ entradas, region, listName, prioridade = 0 }: { entradas: ListingEntry[]; region: HttpTypes.StoreRegion; listName: string; prioridade?: number }) {
  if (!entradas.length) return <p className="text-center text-sm text-eclat-grafite/60">Em breve.</p>
  return (
    <ul className="grid grid-cols-2 small:grid-cols-4 gap-x-4 gap-y-10 small:gap-x-6 small:gap-y-12">
      {entradas.map((e, i) => (
        <li key={entryKey(e)}>
          <ProductPreview product={e.product} cor={e.cor} region={region} listName={listName} prioridade={i < prioridade} />
        </li>
      ))}
    </ul>
  )
}

export default async function VitrineAbas({ region, countryCode }: { region: HttpTypes.StoreRegion; countryCode: string }) {
  const [{ response }, { cardsPorCor }, nav, vitrine, conjuntos] = await Promise.all([
    listProducts({ countryCode, regionId: region.id, queryParams: { limit: 100 } }),
    getListagemConfig(),
    getNavigation(countryCode),
    getSiteContent<Vitrine>("home.vitrine"),
    getVitrineConjuntos(countryCode).catch(() => ({ curados: [], colecoes: [] })),
  ])
  const todos = response.products.filter((p) => isProductAvailable((p.variants ?? []) as StockVariant[]))
  if (!todos.length) return null

  // Mais vendidos: a lista do Cockpit, na ordem gravada; sem lista, a ordem do catálogo.
  const handles = (vitrine?.mais_vendidos ?? []).map((h) => String(h).trim()).filter(Boolean)
  const porHandle = new Map(todos.map((p) => [p.handle, p]))
  const maisVendidos = handles.length ? handles.map((h) => porHandle.get(h)).filter((p): p is HttpTypes.StoreProduct => !!p) : todos
  const novidades = [...todos].sort((a, b) => Date.parse(b.created_at ?? "") - Date.parse(a.created_at ?? ""))
  const cardsConjunto = [...conjuntos.curados, ...conjuntos.colecoes.flatMap((c) => c.cards)].slice(0, MAX)

  const abas: Aba[] = [
    { id: "mais-vendidos", rotulo: "Mais vendidos", href: "/store", painel: <Grade entradas={porCor(maisVendidos, cardsPorCor)} region={region} listName="Home · Mais vendidos" prioridade={2} /> },
    { id: "novidades", rotulo: "Novidades", href: "/store?ordenar=novidades", painel: <Grade entradas={porCor(novidades, cardsPorCor)} region={region} listName="Home · Novidades" /> },
  ]
  if (cardsConjunto.length) {
    abas.push({
      id: "conjuntos",
      rotulo: "Conjuntos",
      href: "/conjuntos",
      painel: (
        <ul className="grid grid-cols-2 small:grid-cols-4 gap-x-4 gap-y-10 small:gap-x-6 small:gap-y-12">
          {cardsConjunto.map((c) => (
            <li key={`${c.handle}|${c.cor ?? ""}`}>
              <CardConjunto card={c} listName="Home · Conjuntos" />
            </li>
          ))}
        </ul>
      ),
    })
  }
  for (const raiz of nav.roots) {
    const ids = new Set([raiz.id, ...raiz.children.map((c) => c.id)])
    const daCategoria = todos.filter((p) => (p.categories ?? []).some((c) => ids.has(c.id)))
    if (!daCategoria.length) continue
    abas.push({ id: raiz.handle, rotulo: raiz.name, href: `/categories/${raiz.handle}`, painel: <Grade entradas={porCor(daCategoria, cardsPorCor)} region={region} listName={`Home · ${raiz.name}`} /> })
  }

  return (
    <section className="content-container py-12 small:py-20" data-testid="vitrine-abas">
      <div className="flex flex-col small:flex-row small:items-end small:justify-between gap-4 mb-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-eclat-terracota">{vitrine?.subheading || "A sua próxima favorita"}</p>
          <h2 className="font-serif text-3xl small:text-4xl text-eclat-grafite mt-1 text-balance">{vitrine?.heading || "Uma peça. A luz inteira."}</h2>
        </div>
        <LocalizedClientLink href="/store" className="text-xs uppercase tracking-[0.18em] text-eclat-grafite underline underline-offset-4 hover:text-eclat-terracota">
          Ver tudo →
        </LocalizedClientLink>
      </div>
      <Abas abas={abas} nomeDaLista="vitrine" />
    </section>
  )
}
