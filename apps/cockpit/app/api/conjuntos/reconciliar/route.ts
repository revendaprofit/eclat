import { NextResponse } from "next/server"
import { conjuntoReconciliar } from "@/lib/medusa"
import { respostaErro } from "@/lib/api-erro"

export async function POST() {
  try {
    return NextResponse.json(await conjuntoReconciliar())
  } catch (e) {
    return respostaErro(e)
  }
}
