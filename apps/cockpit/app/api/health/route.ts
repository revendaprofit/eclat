import { NextResponse } from "next/server"

type Check = { ok: boolean; detail: string }

async function checkMedusa(): Promise<Check> {
  try {
    const url = process.env.MEDUSA_ADMIN_URL
    const email = process.env.MEDUSA_ADMIN_EMAIL
    const password = process.env.MEDUSA_ADMIN_PASSWORD
    if (!url || !email || !password) return { ok: false, detail: "config ausente" }

    const auth = await fetch(`${url}/auth/user/emailpass`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
    if (!auth.ok) return { ok: false, detail: `login falhou (HTTP ${auth.status})` }
    const { token } = await auth.json()

    const r = await fetch(`${url}/admin/products?limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!r.ok) return { ok: false, detail: `admin API HTTP ${r.status}` }
    const data = await r.json()
    return { ok: true, detail: `conectado · ${data.count ?? 0} produtos` }
  } catch (e) {
    return { ok: false, detail: (e as Error).message }
  }
}

async function checkSupabase(): Promise<Check> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return { ok: false, detail: "config ausente" }
    const r = await fetch(`${url}/rest/v1/lead?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    if (!r.ok) return { ok: false, detail: `HTTP ${r.status}` }
    return { ok: true, detail: "conectado · tabela lead acessível" }
  } catch (e) {
    return { ok: false, detail: (e as Error).message }
  }
}

async function checkEvolution(): Promise<Check> {
  try {
    const url = process.env.EVOLUTION_API_URL
    const key = process.env.EVOLUTION_API_KEY
    const instance = process.env.EVOLUTION_INSTANCE || "eclat"
    if (!url || !key) return { ok: false, detail: "config ausente" }
    const r = await fetch(`${url}/instance/connectionState/${instance}`, {
      headers: { apikey: key },
    })
    if (!r.ok) return { ok: false, detail: `HTTP ${r.status}` }
    const data = await r.json()
    const state = data?.instance?.state ?? "?"
    return { ok: true, detail: `instância ${instance} · estado: ${state}` }
  } catch (e) {
    return { ok: false, detail: (e as Error).message }
  }
}

export async function GET() {
  const [medusa, supabase, evolution] = await Promise.all([
    checkMedusa(),
    checkSupabase(),
    checkEvolution(),
  ])
  return NextResponse.json({ medusa, supabase, evolution })
}
