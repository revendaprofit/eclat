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
    <section className="bg-eclat-grafite text-eclat-luz">
      <div className="content-container py-16 small:py-20 text-center flex flex-col items-center gap-4">
        <h2 className="font-serif text-3xl small:text-4xl">{c.title}</h2>
        {c.text && (
          <p className="text-eclat-luz/75 max-w-lg text-sm small:text-base">
            {c.text}
          </p>
        )}

        {state === "done" ? (
          <p className="mt-2 text-eclat-dourado text-lg">
            Pronto! Você faz parte da Éclat. ✨
          </p>
        ) : (
          <form
            onSubmit={submit}
            className="mt-2 w-full max-w-md flex flex-col sm:flex-row gap-3"
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              aria-label="Seu e-mail"
              className="flex-1 bg-transparent border border-eclat-luz/40 px-4 py-3 text-eclat-luz placeholder:text-eclat-luz/40 focus:outline-none focus:border-eclat-dourado"
            />
            <button
              type="submit"
              disabled={state === "loading"}
              className="bg-eclat-dourado text-eclat-grafite uppercase tracking-widest text-xs px-7 py-3 hover:bg-eclat-luz transition-colors disabled:opacity-60"
            >
              {state === "loading" ? "Enviando…" : c.button_label}
            </button>
          </form>
        )}
        {state === "error" && (
          <p className="text-sm text-red-300">{msg}</p>
        )}
      </div>
    </section>
  )
}
