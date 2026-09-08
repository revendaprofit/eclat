"use client"

import { Dialog, DialogPanel, Transition, TransitionChild } from "@headlessui/react"
import { Fragment, useState } from "react"
import type { FilterState } from "@lib/util/catalog-filters"
import { hasActiveFilters } from "@lib/util/catalog-filters"
import type { Facets } from "@lib/util/catalog-facets"
import type { ColorMap } from "@lib/util/colors"
import FilterPanel from "./filter-panel"

export default function FilterDrawer({ facets, filters, colorMap, count }: { facets: Facets; filters: FilterState; colorMap: ColorMap; count: number }) {
  const [open, setOpen] = useState(false)
  const ativos = filters.tamanho.length + filters.cor.length + (filters.preco ? 1 : 0) + (filters.disponivel ? 1 : 0)
  return (
    <div className="small:hidden">
      <button onClick={() => setOpen(true)} className="h-9 px-4 border border-eclat-grafite rounded-full text-xs uppercase tracking-wider" data-testid="filter-open">
        Filtrar{ativos ? ` (${ativos})` : ""}
      </button>
      <Transition show={open} as={Fragment}>
        <Dialog onClose={() => setOpen(false)} className="relative z-[70]">
          <TransitionChild as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/40" />
          </TransitionChild>
          <TransitionChild as={Fragment} enter="ease-out duration-200" enterFrom="translate-y-full" enterTo="translate-y-0" leave="ease-in duration-150" leaveFrom="translate-y-0" leaveTo="translate-y-full">
            <DialogPanel className="fixed inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto bg-eclat-luz rounded-t-2xl p-6 flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <p className="font-serif text-xl text-eclat-grafite">Filtrar</p>
                <button onClick={() => setOpen(false)} aria-label="Fechar" className="text-2xl leading-none">×</button>
              </div>
              <FilterPanel facets={facets} filters={filters} colorMap={colorMap} />
              <button onClick={() => setOpen(false)} className="sticky bottom-0 h-12 bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-xs rounded">
                Ver {count} {count === 1 ? "peça" : "peças"}{hasActiveFilters(filters) ? " com os filtros" : ""}
              </button>
            </DialogPanel>
          </TransitionChild>
        </Dialog>
      </Transition>
    </div>
  )
}
