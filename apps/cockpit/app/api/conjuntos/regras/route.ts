import { NextResponse } from "next/server"
import { conjuntoListRegras, conjuntoCreateRegra } from "@/lib/medusa"
import { respostaErro } from "@/lib/api-erro"

export async function GET() {
  try {
    return NextResponse.json({ regras: await conjuntoListRegras() })
  } catch (e) {
    return respostaErro(e)
  }
}

export async function POST(req: Request) {
  const body = await req.json()
  try {
    return NextResponse.json({ regra: await conjuntoCreateRegra(body) })
  } catch (e) {
    return respostaErro(e)
  }
}
