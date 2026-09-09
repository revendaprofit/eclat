import { NextResponse } from "next/server"
import { conjuntoUpdateCurado, conjuntoDeleteCurado, MedusaHttpError } from "@/lib/medusa"
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
    return NextResponse.json({ curado: await conjuntoUpdateCurado(id, body) })
  } catch (e) {
    return respostaErro(e)
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    await conjuntoDeleteCurado(id)
    return NextResponse.json({ id, deleted: true })
  } catch (e) {
    return respostaErro(e)
  }
}
