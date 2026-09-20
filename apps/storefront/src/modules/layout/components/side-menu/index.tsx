"use client"

import { Popover, PopoverPanel, Transition } from "@headlessui/react"
import useToggleState from "@lib/hooks/use-toggle-state"
import { ArrowRightMini } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { clx } from "@modules/common/components/ui"
import { Fragment } from "react"
import CountrySelect from "../country-select"
import LanguageSelect from "../language-select"
import { Locale } from "@lib/data/locales"
import type { NavData } from "@lib/util/navigation"

// Menu do celular. Antes era o painel escuro translúcido do starter do Medusa, com um quadrado
// cinza e a inicial da categoria no lugar da foto que não existe (pedido do dono, 2026-09-20:
// "continua sem design e feio"). Agora é a mesma linguagem do resto do site: papel quente,
// nomes em serifa e um fio terracota que nasce da esquerda quando o menu abre — um fio por
// linha, em cascata. É o único movimento; quem pede menos animação recebe o fio já inteiro.

const GRUPO = "font-sans text-[10px] uppercase tracking-[0.28em] text-eclat-terracota"
const ITEM_RAIZ = "font-serif text-[22px] leading-tight text-eclat-grafite"
const ITEM_FILHO = "font-sans text-[15px] leading-7 text-eclat-grafite/70 hover:text-eclat-terracota"
const FOCO = "focus:outline-none focus-visible:ring-2 focus-visible:ring-eclat-terracota focus-visible:ring-offset-2 focus-visible:ring-offset-eclat-luz"

/** Fio terracota que cresce da esquerda; `ordem` dá a cascata (40 ms entre as linhas). */
const Fio = ({ ordem }: { ordem: number }) => (
  <span
    aria-hidden
    className="menu-fio block h-px w-full origin-left bg-eclat-terracota/30"
    style={{ animationDelay: `${120 + ordem * 40}ms` }}
  />
)

const SideMenu = ({
  regions,
  locales,
  currentLocale,
  nav,
}: {
  regions: HttpTypes.StoreRegion[] | null
  locales: Locale[] | null
  currentLocale: string | null
  nav: NavData
}) => {
  const countryToggleState = useToggleState()
  const languageToggleState = useToggleState()

  return (
    <div className="h-full">
      <div className="flex items-center h-full">
        <Popover className="h-full flex">
          {({ open, close }) => (
            <>
              <div className="relative flex h-full">
                <Popover.Button
                  data-testid="nav-menu-button"
                  aria-label="Abrir menu"
                  className={clx(
                    "relative h-full flex items-center text-eclat-terracota transition-colors hover:text-eclat-terracota-escuro",
                    FOCO
                  )}
                >
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <line x1="3" y1="7" x2="21" y2="7" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="17" x2="21" y2="17" />
                  </svg>
                </Popover.Button>
              </div>

              {open && (
                <div
                  className="fixed inset-0 z-[50] bg-eclat-grafite/45 backdrop-blur-[2px]"
                  onClick={close}
                  data-testid="side-menu-backdrop"
                />
              )}

              <Transition
                show={open}
                as={Fragment}
                enter="transition ease-out duration-200"
                enterFrom="opacity-0 -translate-x-4"
                enterTo="opacity-100 translate-x-0"
                leave="transition ease-in duration-150"
                leaveFrom="opacity-100 translate-x-0"
                leaveTo="opacity-0 -translate-x-4"
              >
                <PopoverPanel className="fixed left-0 top-0 z-[51] h-[100dvh] w-[88%] max-w-[400px] motion-reduce:transform-none">
                  <div
                    data-testid="nav-menu-popup"
                    className="flex h-full flex-col bg-eclat-luz shadow-[0_0_60px_rgba(43,42,40,0.25)]"
                  >
                    {/* topo: marca + fechar escrito (rótulo diz o que o botão faz) */}
                    <div className="flex items-center justify-between border-b border-eclat-pedra/40 px-6 py-4">
                      <LocalizedClientLink href="/" onClick={close} className={clx("flex items-center gap-2", FOCO)} aria-label="use.ÉCLAT, início">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/brand/mark.png" alt="" aria-hidden className="h-7 w-auto" />
                        <span className="font-serif text-xl tracking-wide text-eclat-terracota">ÉCLAT</span>
                      </LocalizedClientLink>
                      <button
                        data-testid="close-menu-button"
                        onClick={close}
                        className={clx("font-sans text-[11px] uppercase tracking-[0.2em] text-eclat-grafite/60 hover:text-eclat-terracota", FOCO)}
                      >
                        Fechar
                      </button>
                    </div>

                    <nav className="flex-1 overflow-y-auto px-6 py-6" aria-label="Menu principal">
                      <p className={GRUPO}>Peças</p>
                      <ul className="mt-3 flex flex-col" data-testid="mobile-nav">
                        {nav.roots.map((r, i) => (
                          <li key={r.id}>
                            {r.children.length === 0 ? (
                              <LocalizedClientLink
                                href={`/categories/${r.handle}`}
                                onClick={close}
                                className={clx("flex items-center py-3.5 hover:text-eclat-terracota", ITEM_RAIZ, FOCO)}
                                data-testid={`mobile-cat-${r.handle}`}
                              >
                                {r.name}
                              </LocalizedClientLink>
                            ) : (
                              <details className="group/acc">
                                <summary
                                  className={clx(
                                    "flex cursor-pointer list-none items-center py-3.5 hover:text-eclat-terracota [&::-webkit-details-marker]:hidden",
                                    ITEM_RAIZ,
                                    FOCO
                                  )}
                                  data-testid={`mobile-cat-${r.handle}`}
                                >
                                  <span className="flex-1">{r.name}</span>
                                  <ArrowRightMini className="text-eclat-terracota transition-transform group-open/acc:rotate-90 motion-reduce:transition-none" />
                                </summary>
                                <ul className="mb-2 flex flex-col gap-1 rounded-base bg-eclat-areia/40 px-4 py-3">
                                  {r.children.map((ch) => (
                                    <li key={ch.id}>
                                      <LocalizedClientLink href={`/categories/${ch.handle}`} onClick={close} className={clx(ITEM_FILHO, FOCO)}>
                                        {ch.name}
                                      </LocalizedClientLink>
                                    </li>
                                  ))}
                                  <li>
                                    <LocalizedClientLink
                                      href={`/categories/${r.handle}`}
                                      onClick={close}
                                      className={clx("font-sans text-[13px] uppercase tracking-[0.14em] text-eclat-terracota", FOCO)}
                                    >
                                      Ver tudo de {r.name}
                                    </LocalizedClientLink>
                                  </li>
                                </ul>
                              </details>
                            )}
                            <Fio ordem={i} />
                          </li>
                        ))}
                        <li>
                          <LocalizedClientLink
                            href="/store"
                            onClick={close}
                            className={clx("flex items-center py-3.5 hover:text-eclat-terracota", ITEM_RAIZ, FOCO)}
                            data-testid="loja-link"
                          >
                            Toda a loja
                          </LocalizedClientLink>
                          <Fio ordem={nav.roots.length} />
                        </li>
                      </ul>

                      {nav.collections.length > 0 && (
                        <>
                          <p className={clx(GRUPO, "mt-8")}>Coleções</p>
                          <ul className="mt-3 flex flex-col">
                            {nav.collections.map((c, i) => (
                              <li key={c.id}>
                                <LocalizedClientLink
                                  href={`/collections/${c.handle}`}
                                  onClick={close}
                                  className={clx("flex items-center py-3.5 hover:text-eclat-terracota", ITEM_RAIZ, FOCO)}
                                  data-testid={`mobile-col-${c.handle}`}
                                >
                                  {c.title}
                                </LocalizedClientLink>
                                <Fio ordem={nav.roots.length + 1 + i} />
                              </li>
                            ))}
                          </ul>
                        </>
                      )}

                      <p className={clx(GRUPO, "mt-8")}>Sua conta</p>
                      <ul className="mt-3 flex flex-col">
                        <li>
                          <LocalizedClientLink
                            href="/account"
                            onClick={close}
                            className={clx("flex items-center py-3.5 hover:text-eclat-terracota", ITEM_RAIZ, FOCO)}
                            data-testid="conta-link"
                          >
                            Minha conta
                          </LocalizedClientLink>
                          <Fio ordem={nav.roots.length + nav.collections.length + 2} />
                        </li>
                      </ul>
                    </nav>

                    <div className="border-t border-eclat-pedra/40 px-6 py-4 text-eclat-grafite/60">
                      {!!locales?.length && (
                        <div
                          className="flex items-center justify-between py-1"
                          onMouseEnter={languageToggleState.open}
                          onMouseLeave={languageToggleState.close}
                        >
                          <LanguageSelect toggleState={languageToggleState} locales={locales} currentLocale={currentLocale} />
                          <ArrowRightMini className={clx("transition-transform duration-150", languageToggleState.state ? "-rotate-90" : "")} />
                        </div>
                      )}
                      <div
                        className="flex items-center justify-between py-1"
                        onMouseEnter={countryToggleState.open}
                        onMouseLeave={countryToggleState.close}
                      >
                        {regions && <CountrySelect toggleState={countryToggleState} regions={regions} />}
                        <ArrowRightMini className={clx("transition-transform duration-150", countryToggleState.state ? "-rotate-90" : "")} />
                      </div>
                      <p className="mt-3 font-sans text-[11px] leading-5">
                        © {new Date().getFullYear()} use.ÉCLAT. Todos os direitos reservados.
                      </p>
                    </div>
                  </div>
                </PopoverPanel>
              </Transition>
            </>
          )}
        </Popover>
      </div>
    </div>
  )
}

export default SideMenu
