import { NextResponse } from "next/server"
import { medusaVariantePorCodigo } from "@/lib/medusa"
import { normalizarCodigo } from "@/lib/leitor"

// Leitor de código de barras (F0): devolve a peça (produto, cor, tamanho) de um código bipado.
// GET /api/leitor/variante?codigo=ECL-1001-P  →  200 { variante } | 404 { error } | 400 { error }
export async function GET(req: Request) {
  const codigo = normalizarCodigo(new URL(req.url).searchParams.get("codigo") ?? "")
  if (!codigo) return NextResponse.json({ error: "Código vazio." }, { status: 400 })
  try {
    const variante = await medusaVariantePorCodigo(codigo)
    if (!variante) return NextResponse.json({ error: `Código ${codigo} não encontrado no catálogo.`, codigo }, { status: 404 })
    return NextResponse.json({ variante, codigo })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
