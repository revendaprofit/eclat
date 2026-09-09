import { NextResponse } from "next/server"
import { conjuntoGetPares, conjuntoSetPares } from "@/lib/medusa"
import { respostaErro } from "@/lib/api-erro"

export async function GET() {
  try {
    return NextResponse.json({ pares: await conjuntoGetPares() })
  } catch (e) {
    return respostaErro(e)
  }
}

export async function PUT(req: Request) {
  const { pares } = (await req.json()) as {
    pares: { categoria_a: string; categoria_b: string; ativo?: boolean }[]
  }
  try {
    return NextResponse.json({ pares: await conjuntoSetPares(pares) })
  } catch (e) {
    return respostaErro(e)
  }
}
