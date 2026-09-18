// E-mail "pedido confirmado" — sai quando o pedido nasce (order.placed), ou seja, com o
// pagamento já aprovado (D1 da spec de pagamento: pedido só existe depois do Pix/cartão pagos).
import type { DadosPedido } from "../dados-pedido"
import { COR, SERIFA, esc, layout } from "./layout"

export type EmailPronto = { subject: string; html: string; text: string }

function linhaTotal(rotulo: string, valor: string, forte = false): string {
  const peso = forte ? "font-weight:bold;font-size:16px;" : ""
  return `<tr>
<td style="padding:4px 0;${peso}">${esc(rotulo)}</td>
<td align="right" style="padding:4px 0;${peso}">${esc(valor)}</td>
</tr>`
}

export function pedidoConfirmado(d: DadosPedido): EmailPronto {
  const titulo = d.primeiroNome ? `${d.primeiroNome}, seu pedido está confirmado` : "Seu pedido está confirmado"

  const itens = d.itens
    .map(
      (i) => `<tr>
<td width="72" valign="top" style="padding:12px 0;border-bottom:1px solid ${COR.areia};">
${i.foto ? `<img src="${esc(i.foto)}" width="60" alt="" style="display:block;border:0;width:60px;height:80px;object-fit:cover;">` : ""}
</td>
<td valign="top" style="padding:12px 0;border-bottom:1px solid ${COR.areia};">
<strong>${esc(i.nome)}</strong><br>
<span style="color:#8A8378;font-size:13px;">${i.variante ? `${esc(i.variante)} · ` : ""}Qtd. ${esc(i.quantidade)}</span>
</td>
<td valign="top" align="right" style="padding:12px 0;border-bottom:1px solid ${COR.areia};white-space:nowrap;">${esc(i.total)}</td>
</tr>`
    )
    .join("\n")

  const corpo = `<h1 style="margin:0 0 12px;font-family:${SERIFA};font-weight:normal;font-size:28px;line-height:1.2;color:${COR.terracota};">${esc(titulo)}</h1>
<p style="margin:0 0 24px;">Recebemos o pagamento e já estamos cuidando de tudo. Este é o resumo do pedido <strong>#${esc(d.numero)}</strong>.</p>
${d.avisoEnvio ? `<p style="margin:0 0 24px;padding:14px 16px;background:${COR.blushClaro};">${esc(d.avisoEnvio)} Avisamos por aqui assim que o seu sair.</p>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;">
${itens}
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 28px;font-size:15px;">
${linhaTotal("Subtotal", d.subtotal)}
${d.desconto ? linhaTotal("Desconto", `- ${d.desconto}`) : ""}
${linhaTotal("Frete", d.frete)}
${linhaTotal("Total", d.total, true)}
</table>
${
  d.endereco.length
    ? `<p style="margin:0 0 6px;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#8A8378;">Entrega</p>
<p style="margin:0 0 28px;">${d.endereco.map(esc).join("<br>")}</p>`
    : ""
}
<p style="margin:0 0 28px;"><a href="${esc(d.pedidoUrl)}" style="display:inline-block;padding:14px 28px;background:${COR.terracota};color:${COR.luz};text-decoration:none;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;">Ver meu pedido</a></p>`

  const text = [
    titulo + ".",
    `Pedido #${d.numero}`,
    d.avisoEnvio,
    "",
    ...d.itens.map((i) => `${i.quantidade}x ${i.nome}${i.variante ? ` (${i.variante})` : ""}: ${i.total}`),
    "",
    `Subtotal: ${d.subtotal}`,
    d.desconto ? `Desconto: - ${d.desconto}` : null,
    `Frete: ${d.frete}`,
    `Total: ${d.total}`,
    "",
    d.endereco.length ? `Entrega: ${d.endereco.join(", ")}` : null,
    `Ver pedido: ${d.pedidoUrl}`,
    `WhatsApp: https://wa.me/${d.whatsapp}`,
  ]
    .filter((l) => l !== null && l !== undefined)
    .join("\n")

  return {
    subject: `Pedido #${d.numero} confirmado · use.ÉCLAT`,
    html: layout({
      previa: `Pedido #${d.numero} confirmado. Total ${d.total}.`,
      corpo,
      lojaUrl: d.lojaUrl,
      whatsapp: d.whatsapp,
    }),
    text,
  }
}
