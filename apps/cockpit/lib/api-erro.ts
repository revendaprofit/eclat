import { NextResponse } from "next/server"
import { MedusaHttpError } from "@/lib/medusa"

// Resposta de erro padrão das rotas /api/conjuntos/*: usa o status do backend quando é um erro
// conhecido da Admin API (MedusaHttpError), senão 502 (falha de rede / erro inesperado).
export function respostaErro(e: unknown) {
  if (e instanceof MedusaHttpError) return NextResponse.json({ error: e.message }, { status: e.status })
  return NextResponse.json({ error: (e as Error).message }, { status: 502 })
}
