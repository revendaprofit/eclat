import type { FilterState } from "@lib/util/catalog-filters"
import type { Facets } from "@lib/util/catalog-facets"
import type { ColorMap } from "@lib/util/colors"
import ActiveChips from "./active-chips"
import FilterDrawer from "./filter-drawer"
import SortSelect from "./sort-select"

export default function ListingToolbar({ count, total, filters, facets, colorMap }: { count: number; total: number; filters: FilterState; facets: Facets; colorMap: ColorMap }) {
  return (
    <>
      <div className="flex items-center justify-between gap-4 mb-4 text-sm text-eclat-grafite/70" data-testid="listing-toolbar">
        <span data-testid="result-count">{count === total ? `${total} ${total === 1 ? "peça" : "peças"}` : `${count} de ${total} peças`}</span>
        <div className="flex items-center gap-3">
          <FilterDrawer facets={facets} filters={filters} colorMap={colorMap} count={count} />
          <SortSelect filters={filters} />
        </div>
      </div>
      <ActiveChips filters={filters} />
    </>
  )
}
