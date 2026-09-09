import { NextResponse } from "next/server"
import { conjuntoUpdateRegra, MedusaHttpError } from "@/lib/medusa"
import { respostaErro } from "@/lib/api-erro"

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await req.json().catch(() => {
      throw new MedusaHttpError(400, "Corpo da requisição inválido.")
    })
    return NextResponse.json({ regra: await conjuntoUpdateRegra(id, body) })
  } catch (e) {
    return respostaErro(e)
  }
}
