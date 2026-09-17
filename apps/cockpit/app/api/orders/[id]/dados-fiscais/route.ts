import { NextResponse } from "next/server"
import { medusaAdmin, medusaMergeOrderMetadata } from "@/lib/medusa"
import { faltamDadosFiscaisPedido, type DadosFiscaisPedido } from "@/lib/dados-fiscais"

// Completa os dados fiscais de um pedido que veio sem eles — pedidos anteriores à
// coleta no checkout, ou qualquer caso em que o dado chegou torto.
//
// Recusa gravar dado inválido: a alternativa seria descobrir na rejeição da SEFAZ,
// com a cliente esperando.
//
// Grava em duas chamadas: `medusaMergeOrderMetadata` para o metadata do PEDIDO (o
// endpoint substitui o objeto inteiro — por isso o merge, não um POST direto com só
// `{ cpf }`, que apagaria `conferencia`, `fiscal` etc. já gravados ali); e um POST
// para `shipping_address.metadata`, que só guarda estas três chaves fiscais neste
// projeto (ver endereco-fiscal.ts), então substituir o objeto inteiro é seguro.

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const body = (await req.json()) as Partial<DadosFiscaisPedido>

  const dados: DadosFiscaisPedido = {
    cpf: String(body.cpf ?? "").replace(/\D/g, ""),
    numero: String(body.numero ?? "").trim(),
    bairro: String(body.bairro ?? "").trim(),
    municipio_ibge: String(body.municipio_ibge ?? "").trim(),
  }

  const faltam = faltamDadosFiscaisPedido(dados)
  if (faltam.length > 0) {
    return NextResponse.json(
      { error: `Ainda inválido ou faltando: ${faltam.join(", ")}.` },
      { status: 422 }
    )
  }

  try {
    await medusaMergeOrderMetadata(id, { cpf: dados.cpf })

    const r = await medusaAdmin(`/admin/orders/${encodeURIComponent(id)}`, {
      method: "POST",
      body: JSON.stringify({
        shipping_address: {
          metadata: {
            numero: dados.numero,
            bairro: dados.bairro,
            municipio_ibge: dados.municipio_ibge,
          },
        },
      }),
    })
    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { message?: string; error?: string }
      return NextResponse.json(
        { error: d.message || d.error || `Falha ao gravar (HTTP ${r.status}).` },
        { status: r.status }
      )
    }
    return NextResponse.json({ ok: true, dados })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
