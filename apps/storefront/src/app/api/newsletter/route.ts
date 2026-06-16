import { NextResponse } from "next/server"

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  try {
    const { email } = await request.json()
    if (!email || typeof email !== "string" || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "E-mail inválido." }, { status: 400 })
    }
    if (!URL || !ANON) {
      return NextResponse.json(
        { error: "Inscrição indisponível no momento." },
        { status: 503 }
      )
    }

    const r = await fetch(`${URL}/rest/v1/newsletter_signup`, {
      method: "POST",
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${ANON}`,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify({ email: email.toLowerCase().trim(), source: "home" }),
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
