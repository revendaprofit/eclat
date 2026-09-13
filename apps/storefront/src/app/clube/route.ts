import { NextRequest, NextResponse } from "next/server"
import {
  COMING_SOON_PATH,
  VIP_COOKIE,
  VIP_COOKIE_MAX_AGE,
  VIP_INVALID_PARAM,
  VIP_KEY,
  isVipKey,
} from "@lib/coming-soon"

// Porta VIP do Clube Éclat.
//   GET /clube?k=<chave>  → grava o cookie de acesso antecipado e manda para a loja.
//   GET /clube (sem chave) → volta para "Em breve".
//   GET /clube?k=<errada> → volta para "Em breve" com ?convite=invalido (campo mostra o erro).
// O link com a chave é enviado só no grupo do Clube (D0, 24h antes da abertura); o campo
// "Tenho convite" da página Em breve envia para esta mesma rota (form GET, sem JS).
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("k")
  const origin = req.nextUrl.origin

  if (!isVipKey(key)) {
    const back = new URL(COMING_SOON_PATH, origin)
    if (key?.trim()) back.searchParams.set(VIP_INVALID_PARAM, "invalido")
    return NextResponse.redirect(back)
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
