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

// ISO 3166-1 alfa-2 -> código de origem da NF-e. 0 = nacional, 1 = importação direta.
function origemDoPais(pais: string | null | undefined): number | null {
  if (!pais) return null
  return pais.toUpperCase() === "BR" ? 0 : 1
}

export async function montarItensDoPedido(
  scope: MedusaContainer,
  orderId: string
): Promise<{ itens: ItemPedido[]; destinatario: DestinatarioNF; frete_centavos: number }> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "order",
    filters: { id: orderId },
    fields: [
      "id", "email", "currency_code", "shipping_total",
      "items.id", "items.title", "items.variant_title", "items.quantity", "items.unit_price",
      "items.variant_sku", "items.variant_id", "items.product_id",
      "items.variant.hs_code", "items.variant.origin_country",
      "items.product.categories.handle",
      "shipping_address.*", "billing_address.*",
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

  const itens: ItemPedido[] = (order.items ?? []).map((i: any) => ({
    line_item_id: i.id,
    product_id: i.product_id,
    categoria_handle: i.product?.categories?.[0]?.handle ?? null,
    titulo: [i.title, i.variant_title].filter(Boolean).join(" "),
    sku: i.variant_sku ?? null,
    ncm: i.variant?.hs_code ?? null,
    origem: origemDoPais(i.variant?.origin_country),
    quantidade: Number(i.quantity),
    // Medusa guarda preço em unidades decimais; a camada fiscal trabalha em centavos.
    valor_unitario_centavos: Math.round(Number(i.unit_price) * 100),
  }))

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

  return {
    itens,
    destinatario,
    frete_centavos: Math.round(Number(order.shipping_total ?? 0) * 100),
  }
}
