import { NextResponse } from "next/server"
import { conjuntoListCurados, conjuntoCreateCurado } from "@/lib/medusa"
import { respostaErro } from "@/lib/api-erro"

export async function GET() {
  try {
    return NextResponse.json({ curados: await conjuntoListCurados() })
  } catch (e) {
    return respostaErro(e)
  }
}

export async function POST(req: Request) {
  const body = await req.json()
  try {
    return NextResponse.json({ curado: await conjuntoCreateCurado(body) })
  } catch (e) {
    return respostaErro(e)
  }
}
