"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import { getPrefs, setPrefs, type EclatPrefs } from "./prefs"
import type { Persona } from "@lib/data/personas"

// Wizard "Minha ÉCLAT" — modal de 3 passos, pulável, 1ª visita.
// Renderiza nada no SSR (não afeta SEO/CWV); abre após hidratar, com atraso.

const TAMANHOS = ["P", "M", "G", "GG"]
const ESTILOS = [
  { id: "legging", label: "Leggings & Flare" },
  { id: "top", label: "Tops & Blusas" },
  { id: "conjunto", label: "Conjuntos" },
  { id: "macacao", label: "Macacões" },
]

export default function Wizard({ personas }: { personas: Persona[] }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<EclatPrefs>({})

  useEffect(() => {
    const prefs = getPrefs()
    setDraft(prefs)
    if (!prefs.wizard_done && personas.length > 0) {
      const t = setTimeout(() => setOpen(true), 2500)
      return () => clearTimeout(t)
    }
  }, [personas.length])

  useEffect(() => {
    const reopen = () => {
      setDraft(getPrefs())
      setStep(0)
      setOpen(true)
    }
    window.addEventListener("eclat:wizard-open", reopen)
    return () => window.removeEventListener("eclat:wizard-open", reopen)
  }, [])

  if (!open) return null

  const close = (done: boolean) => {
    setPrefs({ ...draft, wizard_done: done || getPrefs().wizard_done || false })
    setOpen(false)
  }
  const finish = () => {
    setPrefs({ ...draft, wizard_done: true })
    setOpen(false)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end small:items-center justify-center">
      <div className="absolute inset-0 bg-eclat-grafite/50" onClick={() => close(false)} />
      <div className="relative bg-eclat-luz w-full small:max-w-lg small:rounded-2xl rounded-t-2xl p-6 small:p-8 shadow-xl">
        <button
          onClick={() => close(false)}
          className="absolute top-4 right-5 text-eclat-grafite/50 hover:text-eclat-grafite text-sm"
          aria-label="Fechar"
        >
          pular ✕
        </button>

        <p className="text-[11px] uppercase tracking-[0.25em] text-eclat-terracota mb-1">
          Minha ÉCLAT
        </p>

        {step === 0 && (
          <>
            <h2 className="font-serif text-2xl text-eclat-grafite mb-1">
              Quem veste para você?
            </h2>
            <p className="text-sm text-eclat-grafite/60 mb-5">
              Escolha a modelo — as fotos da loja se ajustam a você.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {personas.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setDraft({ ...draft, persona_id: p.id, persona_slug: p.slug })}
                  className={`rounded-xl overflow-hidden border-2 text-left transition-colors ${
                    draft.persona_id === p.id
                      ? "border-eclat-terracota"
                      : "border-transparent hover:border-eclat-pedra"
                  }`}
                >
                  {p.avatar_url && (
                    <div className="relative aspect-square w-full bg-eclat-areia/50">
                      <Image src={p.avatar_url} alt={`Modelo ${p.nome}`} fill sizes="220px" className="object-cover" />
                    </div>
                  )}
                  <div className="p-2.5 bg-white/70">
                    <p className="text-sm font-medium text-eclat-grafite">{p.nome}</p>
                    {p.descricao && (
                      <p className="text-xs text-eclat-grafite/60">{p.descricao}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-eclat-grafite/40 mt-3">
              Imagens de modelos criadas com IA.
            </p>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="font-serif text-2xl text-eclat-grafite mb-1">Seu tamanho</h2>
            <p className="text-sm text-eclat-grafite/60 mb-5">
              Todo produto já abre no seu tamanho.
            </p>
            <div className="flex gap-3">
              {TAMANHOS.map((t) => (
                <button
                  key={t}
                  onClick={() => setDraft({ ...draft, tamanho: t })}
                  className={`h-12 w-12 rounded-full border text-sm font-medium transition-colors ${
                    draft.tamanho === t
                      ? "bg-eclat-terracota text-white border-eclat-terracota"
                      : "border-eclat-pedra text-eclat-grafite hover:border-eclat-terracota"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="font-serif text-2xl text-eclat-grafite mb-1">Seu estilo</h2>
            <p className="text-sm text-eclat-grafite/60 mb-5">
              O que você mais ama vestir? (pode marcar várias)
            </p>
            <div className="flex flex-wrap gap-2.5">
              {ESTILOS.map((e) => {
                const on = draft.estilos?.includes(e.id)
                return (
                  <button
                    key={e.id}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        estilos: on
                          ? (draft.estilos || []).filter((x) => x !== e.id)
                          : [...(draft.estilos || []), e.id],
                      })
                    }
                    className={`px-4 py-2 rounded-full border text-sm transition-colors ${
                      on
                        ? "bg-eclat-terracota text-white border-eclat-terracota"
                        : "border-eclat-pedra text-eclat-grafite hover:border-eclat-terracota"
                    }`}
                  >
                    {e.label}
                  </button>
                )
              })}
            </div>
          </>
        )}

        <div className="flex items-center justify-between mt-7">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`h-1.5 w-6 rounded-full ${i <= step ? "bg-eclat-terracota" : "bg-eclat-pedra/50"}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 text-sm text-eclat-grafite/60 hover:text-eclat-grafite"
              >
                voltar
              </button>
            )}
            {step < 2 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="px-5 py-2 rounded-full bg-eclat-grafite text-eclat-luz text-sm hover:bg-eclat-terracota transition-colors"
              >
                continuar
              </button>
            ) : (
              <button
                onClick={finish}
                className="px-5 py-2 rounded-full bg-eclat-terracota text-white text-sm hover:opacity-90"
              >
                ver minha loja ✨
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
