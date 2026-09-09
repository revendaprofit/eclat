import { NextResponse } from "next/server"
import { conjuntoListRegras, conjuntoCreateRegra, MedusaHttpError } from "@/lib/medusa"
import { respostaErro } from "@/lib/api-erro"

export async function GET() {
  try {
    return NextResponse.json({ regras: await conjuntoListRegras() })
  } catch (e) {
    return respostaErro(e)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => {
      throw new MedusaHttpError(400, "Corpo da requisição inválido.")
    })
    return NextResponse.json({ regra: await conjuntoCreateRegra(body) })
  } catch (e) {
    return respostaErro(e)
  }
}
