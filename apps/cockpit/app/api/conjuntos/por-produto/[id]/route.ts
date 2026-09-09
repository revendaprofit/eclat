import { NextResponse } from "next/server"
import { conjuntoPorProduto } from "@/lib/medusa"
import { respostaErro } from "@/lib/api-erro"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    return NextResponse.json(await conjuntoPorProduto(id))
  } catch (e) {
    return respostaErro(e)
  }
}
