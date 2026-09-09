import { NextResponse } from "next/server"
import { conjuntoUpdateRegra } from "@/lib/medusa"
import { respostaErro } from "@/lib/api-erro"

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  try {
    return NextResponse.json({ regra: await conjuntoUpdateRegra(id, body) })
  } catch (e) {
    return respostaErro(e)
  }
}
