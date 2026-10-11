"use client"

import { useState } from "react"
import { HOME_DEFAULTS, Newsletter as NewsletterType } from "@modules/home/content"

export default function Newsletter({
  content,
}: {
  content?: NewsletterType | null
}) {
  const c = { ...HOME_DEFAULTS.newsletter, ...(content || {}) }
  const [email, setEmail] = useState("")
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  )
  const [msg, setMsg] = useState("")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setState("loading")
    try {
      const r = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        throw new Error(d.error || "Não foi possível inscrever agora.")
      }
      setState("done")
    } catch (err) {
      setMsg((err as Error).message)
      setState("error")
    }
  }

  return (
    // Bloco claro, separado do rodapé escuro por cor e por uma linha (sócia, 2026-10-10: "e-mail" quebrava
    // no meio e a newsletter se fundia com o rodapé). No computador: texto à esquerda, formulário à direita.
    <section className="bg-eclat-areia/40 border-t border-b border-eclat-pedra/40 text-eclat-grafite" data-testid="newsletter">
      <div className="content-container py-12 small:py-16 grid grid-cols-1 small:grid-cols-[1.1fr_1fr] gap-8 small:gap-16 items-center">
        <div className="flex flex-col gap-3 text-center small:text-left">
          <span className="uppercase tracking-[0.25em] text-xs text-eclat-terracota">Newsletter</span>
          <h2 className="font-serif text-3xl small:text-4xl text-balance">{c.title}</h2>
          {c.text && <p className="text-eclat-grafite/70 max-w-md mx-auto small:mx-0 text-sm small:text-base text-balance">{c.text}</p>}
        </div>
        <div className="flex flex-col items-center small:items-stretch gap-3">

        {state === "done" ? (
          <p className="text-eclat-terracota text-lg text-center">
            Pronto! Você faz parte da Éclat. ✨
          </p>
        ) : (
          <form
            onSubmit={submit}
            className="w-full max-w-md small:max-w-none flex flex-col sm:flex-row gap-3"
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              aria-label="Seu e-mail"
              className="flex-1 min-w-0 bg-white border border-eclat-pedra px-4 py-3 text-eclat-grafite placeholder:text-eclat-grafite/40 focus:outline-none focus:border-eclat-terracota"
            />
            <button
              type="submit"
              disabled={state === "loading"}
              className="bg-eclat-terracota text-eclat-luz uppercase tracking-widest text-xs px-7 py-3 hover:bg-eclat-terracota-claro transition-colors disabled:opacity-60"
            >
              {state === "loading" ? "Enviando…" : c.button_label}
            </button>
          </form>
        )}
          {state === "error" && <p className="text-sm text-red-600 text-center">{msg}</p>}
          <p className="text-[11px] text-eclat-grafite/50 text-center small:text-left">Sem spam. Você sai quando quiser.</p>
        </div>
      </div>
    </section>
  )
}
