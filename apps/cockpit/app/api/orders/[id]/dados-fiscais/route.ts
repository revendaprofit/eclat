import { NextResponse } from "next/server"
import { medusaAdmin } from "@/lib/medusa"
import { faltamDadosFiscaisPedido, type DadosFiscaisPedido } from "@/lib/dados-fiscais"

// Completa os dados fiscais de um pedido que veio sem eles — pedidos anteriores à
// coleta no checkout, ou qualquer caso em que o dado chegou torto.
//
// Recusa gravar dado inválido: a alternativa seria descobrir na rejeição da SEFAZ,
// com a cliente esperando.
//
// Uma leitura + uma gravação, para não deixar o pedido em estado parcial se a segunda
// chamada falhasse (achado da revisão): lê metadata do pedido e dos dois endereços,
// mescla e manda tudo num único POST /admin/orders/{id}. O endpoint substitui cada
// objeto de metadata inteiro — por isso o merge manual em vez de um corpo com só as
// chaves novas, que apagaria `conferencia`, `fiscal` etc. já gravados ali.
//
// O CPF pode estar em três lugares (apps/backend/src/lib/fiscal/fiscal-pedido.ts:
// billing_address, depois shipping_address, depois o metadata do pedido) — pedidos
// antigos guardaram em endereços. Gravar só em order.metadata.cpf deixaria a correção
// do operador sendo ignorada em silêncio pela emissão, que prioriza os endereços. Por
// isso o CPF é sobrescrito também nos endereços — mas só onde a chave já existia, para
// não espalhar dado pessoal para um lugar que não tinha.

// IDs de pedido do Medusa: prefixo "order_" + sufixo alfanumérico (ULID). Validar antes
// de repassar evita chamar o Medusa com lixo e devolver 502 (falha de infra) para o que
// é, na verdade, entrada inválida do cliente.
const ID_VALIDO = /^order_[A-Za-z0-9]+$/

type MetaObj = Record<string, unknown> | null | undefined

function metaComChave(m: MetaObj, chave: string): m is Record<string, unknown> {
  return !!m && typeof m === "object" && chave in m
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params

  if (!ID_VALIDO.test(id)) {
    return NextResponse.json({ error: "Identificador de pedido inválido." }, { status: 400 })
  }

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
    const g = await medusaAdmin(
      `/admin/orders/${encodeURIComponent(id)}?fields=id,metadata,shipping_address.metadata,billing_address.metadata`
    )
    if (!g.ok) {
      return NextResponse.json(
        { error: `ler pedido falhou (HTTP ${g.status}).` },
        { status: g.status }
      )
    }
    const atual = ((await g.json()).order ?? {}) as {
      metadata?: Record<string, unknown> | null
      shipping_address?: { metadata?: Record<string, unknown> | null } | null
      billing_address?: { metadata?: Record<string, unknown> | null } | null
    }

    const shippingMeta = atual.shipping_address?.metadata
    const billingMeta = atual.billing_address?.metadata

    const novoShippingMeta: Record<string, unknown> = {
      ...(shippingMeta ?? {}),
      numero: dados.numero,
      bairro: dados.bairro,
      municipio_ibge: dados.municipio_ibge,
    }
    // Só sobrescreve o CPF do endereço se ele já vivia lá — não cria a chave onde não havia.
    if (metaComChave(shippingMeta, "cpf")) novoShippingMeta.cpf = dados.cpf

    const patch: Record<string, unknown> = {
      metadata: { ...(atual.metadata ?? {}), cpf: dados.cpf },
      shipping_address: { metadata: novoShippingMeta },
    }

    if (metaComChave(billingMeta, "cpf")) {
      patch.billing_address = { metadata: { ...billingMeta, cpf: dados.cpf } }
    }

    const r = await medusaAdmin(`/admin/orders/${encodeURIComponent(id)}`, {
      method: "POST",
      body: JSON.stringify(patch),
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
