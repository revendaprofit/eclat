"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createSupabaseBrowser } from "@/lib/supabase/client"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createSupabaseBrowser()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError("E-mail ou senha inválidos.")
      return
    }
    router.push("/")
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-eclat-luz to-eclat-areia px-4">
      <div className="w-full max-w-sm bg-white/70 backdrop-blur border border-eclat-pedra/40 rounded-xl p-8 shadow-sm">
        <div className="text-center mb-8">
          <div className="font-serif text-3xl tracking-wide text-eclat-grafite">
            use.ÉCLAT
          </div>
          <div className="uppercase tracking-[0.3em] text-[10px] text-eclat-dourado mt-1">
            Cockpit
          </div>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-eclat-grafite/70">E-mail</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-eclat-pedra/50 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-eclat-dourado"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-eclat-grafite/70">Senha</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-eclat-pedra/50 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-eclat-dourado"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-xs py-3 rounded-md hover:bg-eclat-dourado hover:text-eclat-grafite transition-colors disabled:opacity-60"
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  )
}
