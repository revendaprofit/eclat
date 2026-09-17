import { NextResponse } from "next/server"
import { cepValido, normalizarCep, parseRespostaCep, urlProvedorCep } from "@lib/util/cep"

// Busca de CEP pelo nosso backend, não pelo navegador da cliente.
//
// Três razões: o CEP dela não vai para um terceiro sem passar por nós; o cache
// abaixo faz o segundo pedido do mesmo CEP não gerar chamada externa nenhuma
// (CEP -> IBGE é dado estável); e uma queda do provedor aparece no nosso log em
// vez de virar reclamação de cliente.
//
// Esta rota é casca fina: validar, buscar, parsear e mapear moram em
// src/lib/util/cep.ts, que tem teste. Aqui só há orquestração.

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ cep: string }> }
) {
  const { cep } = await ctx.params

  if (!cepValido(cep)) {
    return NextResponse.json({ error: "CEP deve ter 8 dígitos." }, { status: 400 })
  }

  let bruto: unknown
  try {
    const r = await fetch(urlProvedorCep(cep), {
      // CEP -> IBGE não muda. Cache permanente evita chamada externa repetida.
      cache: "force-cache",
      headers: { Accept: "application/json" },
    })
    if (!r.ok) {
      return NextResponse.json(
        { error: "Serviço de CEP indisponível. Preencha o endereço manualmente." },
        { status: 502 }
      )
    }
    bruto = await r.json()
  } catch {
    return NextResponse.json(
      { error: "Serviço de CEP indisponível. Preencha o endereço manualmente." },
      { status: 502 }
    )
  }

  const endereco = parseRespostaCep(bruto)
  if (!endereco) {
    return NextResponse.json(
      { error: "CEP não encontrado. Preencha o endereço manualmente." },
      { status: 404 }
    )
  }

  return NextResponse.json(endereco)
}
