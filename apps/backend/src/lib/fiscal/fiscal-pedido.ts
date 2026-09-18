// Traduz um pedido do Medusa (fonte da verdade do comércio, Invariante 2) para a forma que a
// camada fiscal entende. Lê NCM de variant.hs_code e origem de variant.origin_country — campos
// NATIVOS do Medusa, então o dado fiscal do produto não é duplicado em lugar nenhum.
//
// Nota conhecida (spec §5): o Medusa não copia hs_code para a linha do pedido, então lemos o
// cadastro vigente. O histórico fica garantido pelo payload_enviado gravado na emissão.

import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ErroFiscal, type ItemPedido } from "./tipos"
import type { DestinatarioNF } from "./fiscal-payload"
import { formaPagamentoDoPedido, type PagamentoNF } from "./fiscal-pagamento"

// ISO 3166-1 alfa-2 -> código de origem da NF-e (0-8). Só BR->0 é uma leitura direta e
// inequívoca do cadastro. Para qualquer outro valor, o código NÃO pode decidir sozinho entre 1
// (importação direta), 2 (importação por terceiro/adquirida no mercado interno), 3/5/6/7/8
// (combinações com conteúdo nacional/importação) — ex.: peça fabricada fora e comprada de um
// importador brasileiro é 2, não 1. Isso é decisão do contador (perfil.origem_padrao), não um
// mapa país->origem (achado importante da revisão final de 2026-09-17, Invariante 6).
function origemDoPais(pais: string | null | undefined): number | null {
  if (!pais) return null
  return pais.toUpperCase() === "BR" ? 0 : null
}

export async function montarItensDoPedido(
  scope: MedusaContainer,
  orderId: string
): Promise<{ itens: ItemPedido[]; destinatario: DestinatarioNF; frete_centavos: number; pagamento: PagamentoNF }> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "order",
    filters: { id: orderId },
    fields: [
      "id", "email", "currency_code", "shipping_total",
      "items.id", "items.title", "items.variant_title", "items.quantity", "items.unit_price",
      "items.discount_total", "items.item_total",
      "items.variant_sku", "items.variant_id", "items.product_id",
      "items.variant.hs_code", "items.variant.origin_country",
      "items.product.categories.handle",
      "shipping_address.*", "billing_address.*",
      "payment_collections.payments.provider_id",
    ],
  })

  const order = data?.[0]
  if (!order) throw new ErroFiscal(`Pedido ${orderId} não encontrado.`)

  const a = order.shipping_address
  if (!a) throw new ErroFiscal(`Pedido ${orderId} não tem endereço de entrega.`)

  const cpf = String(
    (order.billing_address?.metadata as any)?.cpf ??
      (a.metadata as any)?.cpf ??
      (order.metadata as any)?.cpf ??
      ""
  ).replace(/\D/g, "")
  if (cpf.length !== 11) {
    throw new ErroFiscal(
      `Pedido ${orderId} está sem CPF da cliente. A NF-e ao consumidor exige CPF — cadastre-o no pedido antes de emitir.`
    )
  }

  const municipioIbge = String((a.metadata as any)?.municipio_ibge ?? "")
  if (!/^\d{7}$/.test(municipioIbge)) {
    throw new ErroFiscal(
      `Pedido ${orderId} está sem o código IBGE do município de entrega (7 dígitos). Sem ele a SEFAZ rejeita a nota.`
    )
  }

  const itens: ItemPedido[] = (order.items ?? []).map((i: any) => {
    const quantidade = Number(i.quantity)
    // Medusa guarda preço em unidades decimais; a camada fiscal trabalha em centavos.
    // valor_unitario_centavos é sempre o valor BRUTO (unit_price) — o desconto vai à parte
    // (Crítico da revisão de 2026-09-17): transmitir a NF-e pelo bruto quando há desconto
    // (ex.: Benefício Conjunto, em produção) cobraria da SEFAZ mais do que a cliente pagou.
    const valorUnitarioCentavos = Math.round(Number(i.unit_price) * 100)
    const descontoCentavos = Math.round(Number(i.discount_total ?? 0) * 100)
    const tituloItem = [i.title, i.variant_title].filter(Boolean).join(" ")

    // Conferência de segurança: nunca confiar só na nossa conta. Se o bruto menos o desconto
    // não bater com o total que o próprio Medusa calculou para o item, é sinal de que a leitura
    // do desconto (ou algum outro ajuste do pedido, ex. tax_lines) está incompleta — não se
    // adivinha valor tributário, então a emissão para AQUI com uma mensagem legível.
    const itemTotalCentavos = Math.round(Number(i.item_total ?? 0) * 100)
    const calculadoCentavos = valorUnitarioCentavos * quantidade - descontoCentavos
    if (calculadoCentavos !== itemTotalCentavos) {
      throw new ErroFiscal(
        `Pedido ${orderId}, item "${tituloItem || i.id}": valor calculado (bruto ${valorUnitarioCentavos} × ${quantidade} - desconto ${descontoCentavos} = ${calculadoCentavos} centavos) não bate com o total do item no Medusa (${itemTotalCentavos} centavos). Não é seguro emitir a NF-e com um valor que pode estar errado — confira o pedido antes de tentar de novo.`
      )
    }

    return {
      line_item_id: i.id,
      product_id: i.product_id,
      categoria_handle: i.product?.categories?.[0]?.handle ?? null,
      titulo: tituloItem,
      sku: i.variant_sku ?? null,
      ncm: i.variant?.hs_code ?? null,
      origem: origemDoPais(i.variant?.origin_country),
      quantidade,
      valor_unitario_centavos: valorUnitarioCentavos,
      desconto_centavos: descontoCentavos,
    }
  })

  const destinatario: DestinatarioNF = {
    cpf,
    nome: [a.first_name, a.last_name].filter(Boolean).join(" ") || order.email || "Consumidor",
    logradouro: a.address_1 ?? "",
    numero: String((a.metadata as any)?.numero ?? "S/N"),
    complemento: a.address_2 ?? null,
    bairro: String((a.metadata as any)?.bairro ?? ""),
    municipio: a.city ?? "",
    municipio_ibge: municipioIbge,
    uf: a.province ?? "",
    cep: (a.postal_code ?? "").replace(/\D/g, ""),
  }

  const providerIds: string[] = (order.payment_collections ?? [])
    .flatMap((pc: any) => pc?.payments ?? [])
    .map((p: any) => String(p?.provider_id ?? ""))
    .filter(Boolean)

  return {
    itens,
    destinatario,
    frete_centavos: Math.round(Number(order.shipping_total ?? 0) * 100),
    pagamento: formaPagamentoDoPedido(providerIds),
  }
}
