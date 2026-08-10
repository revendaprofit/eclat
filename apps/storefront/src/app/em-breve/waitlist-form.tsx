"use client"

import { useState } from "react"

export default function WaitlistForm() {
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
        body: JSON.stringify({ email, source: "em-breve" }),
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

  if (state === "done") {
    return (
      <div
        className="border border-eclat-luz/25 bg-eclat-luz/5 px-6 py-5"
        role="status"
      >
        <p className="font-serif text-lg text-eclat-luz leading-snug">
          Pronto — seu lugar está guardado.
        </p>
        <p className="mt-1.5 text-sm text-eclat-luz/70 leading-relaxed">
          Em breve você recebe, em primeira mão, o convite para conhecer a
          Família Blackout.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="flex flex-col xsmall:flex-row gap-3">
        <label htmlFor="em-breve-email" className="sr-only">
          Seu e-mail
        </label>
        <input
          id="em-breve-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          className="flex-1 min-w-0 bg-transparent border border-eclat-luz/35 px-4 py-3.5 text-eclat-luz placeholder:text-eclat-luz/40 focus:outline-none focus:border-eclat-luz transition-colors"
        />
        <button
          type="submit"
          disabled={state === "loading"}
          className="shrink-0 bg-eclat-luz text-eclat-terracota-escuro uppercase tracking-widest text-xs font-semibold px-7 py-3.5 hover:bg-white transition-colors disabled:opacity-60"
        >
          {state === "loading" ? "Enviando…" : "Quero entrar na lista"}
        </button>
      </div>
      <p className="mt-3 text-xs text-eclat-luz/55">
        Um e-mail quando abrirmos, nada além disso.
      </p>
      {state === "error" && (
        <p className="mt-2 text-sm text-red-300">{msg}</p>
      )}
    </form>
  )
}
