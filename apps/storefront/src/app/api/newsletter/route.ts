import { NextResponse } from "next/server"

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SOURCES_PERMITIDAS = new Set(["home", "em-breve"])

export async function POST(request: Request) {
  try {
    const { email, source } = await request.json()
    if (!email || typeof email !== "string" || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "E-mail inválido." }, { status: 400 })
    }
    if (!URL || !ANON) {
      return NextResponse.json(
        { error: "Inscrição indisponível no momento." },
        { status: 503 }
      )
    }

    const origem =
      typeof source === "string" && SOURCES_PERMITIDAS.has(source)
        ? source
        : "home"

    // Sem "resolution=ignore-duplicates": esse modo faz o Postgres resolver
    // via ON CONFLICT, que exige policy de SELECT para checar a linha
    // existente — e o anon não tem (e-mails não são legíveis por design,
    // só o backend/service_role lê). Sem ignore-duplicates, um e-mail
    // repetido vira 23505 (unique_violation) → 409 simples, já tratado
    // abaixo como sucesso silencioso.
    const r = await fetch(`${URL}/rest/v1/newsletter_signup`, {
      method: "POST",
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${ANON}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ email: email.toLowerCase().trim(), source: origem }),
    })

    if (!r.ok && r.status !== 409) {
      return NextResponse.json(
        { error: "Não foi possível inscrever agora." },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 })
  }
}
