import { NextResponse } from "next/server"
import { conjuntoListCurados, conjuntoCreateCurado, MedusaHttpError } from "@/lib/medusa"
import { respostaErro } from "@/lib/api-erro"

export async function GET() {
  try {
    return NextResponse.json({ curados: await conjuntoListCurados() })
  } catch (e) {
    return respostaErro(e)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => {
      throw new MedusaHttpError(400, "Corpo da requisição inválido.")
    })
    return NextResponse.json({ curado: await conjuntoCreateCurado(body) })
  } catch (e) {
    return respostaErro(e)
  }
}
