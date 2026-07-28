"use client"

import { useState } from "react"

// "Avise-me quando chegar" (spec, Nota 02): produto esgotado sem captura
// evapora o tráfego no momento de maior intenção. Insere direto no Supabase
// via anon (RLS: só INSERT). E-mail OU WhatsApp, um dos dois basta.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export default function NotifyMe({
  productId,
  variantLabel,
}: {
  productId: string
  variantLabel?: string
}) {
  const [email, setEmail] = useState("")
  const [whats, setWhats] = useState("")
  const [state, setState] = useState<"idle" | "saving" | "ok" | "err">("idle")

  async function submit() {
    if (!email.trim() && !whats.trim()) return
    if (!URL || !ANON) return
    setState("saving")
    try {
      const r = await fetch(URL + "/rest/v1/avise_me", {
        method: "POST",
        headers: {
          apikey: ANON,
          Authorization: "Bearer " + ANON,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          product_id: productId,
          variant: variantLabel || null,
          email: email.trim() || null,
          whatsapp: whats.trim() || null,
        }),
      })
      setState(r.ok ? "ok" : "err")
    } catch {
      setState("err")
    }
  }

  if (state === "ok") {
    return (
      <div className="mt-4 rounded-xl border border-[#3E7A55] bg-[#E7F0E9] px-4 py-3 text-sm text-eclat-grafite">
        Prontinho — te avisamos assim que chegar. ✨
      </div>
    )
  }

  return (
    <div className="mt-4 rounded-xl border border-eclat-terracota/40 bg-eclat-areia/20 p-4">
      <p className="text-sm font-semibold text-eclat-grafite">
        Esgotou — mas volta. Quer ser avisada primeiro?
      </p>
      <div className="flex flex-col gap-2 mt-3">
        <input
          type="email"
          inputMode="email"
          placeholder="seu e-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border border-ui-border-base rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-eclat-terracota"
        />
        <input
          type="tel"
          inputMode="tel"
          placeholder="ou seu WhatsApp (com DDD)"
          value={whats}
          onChange={(e) => setWhats(e.target.value)}
          className="border border-ui-border-base rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-eclat-terracota"
        />
        <button
          onClick={submit}
          disabled={state === "saving" || (!email.trim() && !whats.trim())}
          className="rounded-full bg-eclat-terracota text-white text-sm font-semibold py-2.5 disabled:opacity-40 min-h-[44px]"
        >
          {state === "saving" ? "Enviando…" : "Quero ser avisada"}
        </button>
        {state === "err" && (
          <p className="text-xs text-red-700">
            Não foi possível salvar agora — tente de novo em instantes.
          </p>
        )}
      </div>
    </div>
  )
}
