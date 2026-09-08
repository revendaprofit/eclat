"use client"

import { Popover, PopoverPanel, Transition } from "@headlessui/react"
import Image from "next/image"
import useToggleState from "@lib/hooks/use-toggle-state"
import { ArrowRightMini, XMark } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Text, clx } from "@modules/common/components/ui"
import { Fragment } from "react"
import CountrySelect from "../country-select"
import LanguageSelect from "../language-select"
import { Locale } from "@lib/data/locales"
import type { NavData } from "@lib/util/navigation"


type SideMenuProps = {
  regions: HttpTypes.StoreRegion[] | null
  locales: Locale[] | null
  currentLocale: string | null
  nav: NavData
}

const SideMenu = ({ regions, locales, currentLocale, nav }: SideMenuProps) => {
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
                  className="relative h-full flex items-center text-eclat-terracota transition-all ease-out duration-200 focus:outline-none hover:text-eclat-terracota-escuro"
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
                  className="fixed inset-0 z-[50] bg-black/0 pointer-events-auto"
                  onClick={close}
                  data-testid="side-menu-backdrop"
                />
              )}

              <Transition
                show={open}
                as={Fragment}
                enter="transition ease-out duration-150"
                enterFrom="opacity-0"
                enterTo="opacity-100 backdrop-blur-2xl"
                leave="transition ease-in duration-150"
                leaveFrom="opacity-100 backdrop-blur-2xl"
                leaveTo="opacity-0"
              >
                <PopoverPanel className="flex flex-col absolute w-full pr-4 sm:pr-0 sm:w-1/3 2xl:w-1/4 sm:min-w-min h-[calc(100vh-1rem)] z-[51] inset-x-0 text-sm text-ui-fg-on-color m-2 backdrop-blur-2xl">
                  <div
                    data-testid="nav-menu-popup"
                    className="flex flex-col h-full bg-[rgba(3,7,18,0.5)] rounded-rounded justify-between p-6"
                  >
                    <div className="flex justify-end" id="xmark">
                      <button data-testid="close-menu-button" onClick={close}>
                        <XMark />
                      </button>
                    </div>
                    <ul className="flex flex-col gap-3 items-stretch justify-start overflow-y-auto" data-testid="mobile-nav">
                      <li>
                        <LocalizedClientLink href="/" className="text-2xl leading-10 hover:text-ui-fg-disabled" onClick={close} data-testid="início-link">Início</LocalizedClientLink>
                      </li>
                      {nav.roots.map((r) => {
                        const Thumb = (
                          <span className="w-12 h-12 rounded-md overflow-hidden bg-white/10 shrink-0 flex items-center justify-center font-serif text-lg">
                            {r.image_url ? <Image src={r.image_url} alt="" width={48} height={48} className="w-12 h-12 object-cover" /> : r.name.charAt(0)}
                          </span>
                        )
                        if (r.children.length === 0) {
                          return (
                            <li key={r.id}>
                              <LocalizedClientLink href={`/categories/${r.handle}`} onClick={close} className="flex items-center gap-3 text-xl leading-tight hover:text-ui-fg-disabled" data-testid={`mobile-cat-${r.handle}`}>
                                {Thumb}<span>{r.name}</span>
                              </LocalizedClientLink>
                            </li>
                          )
                        }
                        return (
                          <li key={r.id}>
                            <details className="group/acc">
                              <summary className="flex items-center gap-3 text-xl leading-tight cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:text-ui-fg-disabled" data-testid={`mobile-cat-${r.handle}`}>
                                {Thumb}<span className="flex-1">{r.name}</span><ArrowRightMini className="transition-transform group-open/acc:rotate-90" />
                              </summary>
                              <ul className="flex flex-col gap-1 mt-2 ml-[60px]">
                                {r.children.map((ch) => (
                                  <li key={ch.id}><LocalizedClientLink href={`/categories/${ch.handle}`} onClick={close} className="text-base leading-7 text-ui-fg-on-color/80 hover:text-ui-fg-on-color">{ch.name}</LocalizedClientLink></li>
                                ))}
                                <li><LocalizedClientLink href={`/categories/${r.handle}`} onClick={close} className="text-sm underline underline-offset-4">Ver tudo de {r.name}</LocalizedClientLink></li>
                              </ul>
                            </details>
                          </li>
                        )
                      })}
                      {nav.collections.length > 0 && (
                        <li>
                          <details className="group/acc">
                            <summary className="flex items-center gap-3 text-xl leading-tight cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:text-ui-fg-disabled" data-testid="mobile-colecoes">
                              <span className="w-12 h-12 rounded-md bg-white/10 flex items-center justify-center font-serif text-lg">C</span><span className="flex-1">Coleções</span><ArrowRightMini className="transition-transform group-open/acc:rotate-90" />
                            </summary>
                            <ul className="flex flex-col gap-1 mt-2 ml-[60px]">
                              {nav.collections.map((c) => (
                                <li key={c.id}><LocalizedClientLink href={`/collections/${c.handle}`} onClick={close} className="text-base leading-7 text-ui-fg-on-color/80 hover:text-ui-fg-on-color">{c.title}</LocalizedClientLink></li>
                              ))}
                            </ul>
                          </details>
                        </li>
                      )}
                      <li><LocalizedClientLink href="/store" className="text-2xl leading-10 hover:text-ui-fg-disabled" onClick={close} data-testid="loja-link">Toda a loja</LocalizedClientLink></li>
                      <li><LocalizedClientLink href="/account" className="text-2xl leading-10 hover:text-ui-fg-disabled" onClick={close} data-testid="conta-link">Conta</LocalizedClientLink></li>
                    </ul>
                    <div className="flex flex-col gap-y-6">
                      {!!locales?.length && (
                        <div
                          className="flex justify-between"
                          onMouseEnter={languageToggleState.open}
                          onMouseLeave={languageToggleState.close}
                        >
                          <LanguageSelect
                            toggleState={languageToggleState}
                            locales={locales}
                            currentLocale={currentLocale}
                          />
                          <ArrowRightMini
                            className={clx(
                              "transition-transform duration-150",
                              languageToggleState.state ? "-rotate-90" : ""
                            )}
                          />
                        </div>
                      )}
                      <div
                        className="flex justify-between"
                        onMouseEnter={countryToggleState.open}
                        onMouseLeave={countryToggleState.close}
                      >
                        {regions && (
                          <CountrySelect
                            toggleState={countryToggleState}
                            regions={regions}
                          />
                        )}
                        <ArrowRightMini
                          className={clx(
                            "transition-transform duration-150",
                            countryToggleState.state ? "-rotate-90" : ""
                          )}
                        />
                      </div>
                      <Text className="flex justify-between txt-compact-small">
                        © {new Date().getFullYear()} use.ÉCLAT. Todos os
                        direitos reservados.
                      </Text>
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
