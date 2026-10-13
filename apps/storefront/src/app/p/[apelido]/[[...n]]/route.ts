import { NextRequest, NextResponse } from "next/server"
import { codigoDoApelido } from "@lib/data/parceira"
import {
  COOKIE_PARCEIRA,
  COOKIE_PARCEIRA_MAX_AGE,
  destinoDoLink,
  limparApelido,
  limparNumeroDoVideo,
  serializarParceira,
} from "@lib/util/parceira"

// Link da creator (desenho 2026-09-29-programa-creators-design.md, C6 e C11).
//   GET /p/paty     → link geral: grava o cookie da creator e manda para a loja.
//   GET /p/paty/3   → vídeo número 3 dela: o mesmo, guardando o número.
//   GET /p/paty?produto=macaquinho-solaris&cor=Grafitti → o mesmo, mas abrindo direto na peça (e na cor).
// O cupom entra na sacola quando a cliente põe a primeira peça (lib/data/parceira.ts). Apelido que não existe
// (ou parceria desativada) → mesmo destino, sem cookie e sem cupom. O último link clicado vence.
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest, ctx: { params: Promise<{ apelido: string; n?: string[] }> }) {
  const { apelido, n } = await ctx.params
  const { searchParams } = req.nextUrl
  const destino = new URL(destinoDoLink(searchParams.get("produto"), searchParams.get("cor")), req.nextUrl.origin)
  const res = NextResponse.redirect(destino)

  const a = limparApelido(apelido)
  const codigo = a ? await codigoDoApelido(a) : null
  if (!a || !codigo) return res

  const conteudo = n?.length === 1 ? limparNumeroDoVideo(n[0]) : null
  res.cookies.set(COOKIE_PARCEIRA, serializarParceira({ apelido: a, codigo, conteudo }), {
    maxAge: COOKIE_PARCEIRA_MAX_AGE,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
  return res
}
