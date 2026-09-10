import { NextResponse } from "next/server"
import { fireCapiTest } from "@modules/analytics/capi"

// Diagnóstico da API de Conversões da Meta (server-side).
//   GET /api/marketing/capi-test            → só diz se pixel (Cockpit) e token (env) existem
//   GET /api/marketing/capi-test?code=TESTxxxx → envia um PageView de teste; o evento aparece
//     em Gerenciador de Eventos → conjunto de dados → aba "Eventos de teste" (não vira conversão).
// Nunca expõe o token nem o ID completo — só booleanos e a resposta bruta da Meta.
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code")?.trim() || undefined
  const result = await fireCapiTest(code)
  return NextResponse.json(
    { ok: result.configured.pixel && result.configured.token, ...result },
    { status: 200 }
  )
}
