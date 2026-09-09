import { NextResponse } from "next/server"
import { conjuntoGetPares, conjuntoSetPares, MedusaHttpError } from "@/lib/medusa"
import { respostaErro } from "@/lib/api-erro"

export async function GET() {
  try {
    return NextResponse.json({ pares: await conjuntoGetPares() })
  } catch (e) {
    return respostaErro(e)
  }
}

export async function PUT(req: Request) {
  try {
    const { pares } = (await req.json().catch(() => {
      throw new MedusaHttpError(400, "Corpo da requisição inválido.")
    })) as {
      pares: { categoria_a: string; categoria_b: string; ativo?: boolean }[]
    }
    return NextResponse.json({ pares: await conjuntoSetPares(pares) })
  } catch (e) {
    return respostaErro(e)
  }
}
