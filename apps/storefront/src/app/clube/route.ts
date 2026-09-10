import { NextRequest, NextResponse } from "next/server"
import {
  COMING_SOON_PATH,
  VIP_COOKIE,
  VIP_COOKIE_MAX_AGE,
  VIP_KEY,
} from "@lib/coming-soon"

// Porta VIP do Clube Éclat.
//   GET /clube?k=<chave>  → grava o cookie de acesso antecipado e manda para a loja.
//   GET /clube (sem chave ou chave errada) → volta para "Em breve".
// O link com a chave é enviado só no grupo do Clube (D0, 24h antes da abertura).
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("k")?.trim()
  const origin = req.nextUrl.origin

  if (!key || key !== VIP_KEY) {
    return NextResponse.redirect(new URL(COMING_SOON_PATH, origin))
  }

  const res = NextResponse.redirect(new URL("/br?vip=1", origin))
  res.cookies.set(VIP_COOKIE, VIP_KEY, {
    maxAge: VIP_COOKIE_MAX_AGE,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
  return res
}
