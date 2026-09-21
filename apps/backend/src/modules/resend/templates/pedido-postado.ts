// E-mail "pedido postado" — sai quando a transportadora recebe o pacote (webhook `order.posted` da
// SuperFrete, spec 2026-09-20-avisos-entrega-superfrete-design.md §4.5). Mesmo layout do "pedido
// confirmado". Os dados chegam prontos da rota do webhook (src/api/webhooks/superfrete/route.ts).
import { COR, SERIFA, esc, layout } from "./layout"
import type { EmailPronto } from "./pedido-confirmado"

export type DadosPostado = {
  numero: string
  primeiroNome: string | null
  /** Código de rastreio; vazio/null quando ainda não existe. */
  codigo: string | null
  /** Link de acompanhamento; vazio/null quando não há. */
  link: string | null
  lojaUrl: string
  whatsapp: string
}

// O link vem de fora (SuperFrete / Correios): só vira href se for http(s).
function linkSeguro(v: string | null): string | null {
  return v && /^https?:\/\//i.test(v) ? v : null
}

export function pedidoPostado(d: DadosPostado): EmailPronto {
  const titulo = d.primeiroNome ? `${d.primeiroNome}, seu pedido está a caminho` : "Seu pedido está a caminho"
  const codigo = d.codigo?.trim() || null
  const link = linkSeguro(d.link)

  const corpo = `<h1 style="margin:0 0 12px;font-family:${SERIFA};font-weight:normal;font-size:28px;line-height:1.2;color:${COR.terracota};">${esc(titulo)}</h1>
<p style="margin:0 0 24px;">O pedido <strong>#${esc(d.numero)}</strong> foi postado e já está com a transportadora.</p>
${
  codigo
    ? `<p style="margin:0 0 6px;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#8A8378;">Código de rastreio</p>
<p style="margin:0 0 28px;font-size:18px;letter-spacing:1px;"><strong>${esc(codigo)}</strong></p>`
    : ""
}
${
  link
    ? `<p style="margin:0 0 28px;"><a href="${esc(link)}" style="display:inline-block;padding:14px 28px;background:${COR.terracota};color:${COR.luz};text-decoration:none;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;">Acompanhar entrega</a></p>`
    : ""
}
<p style="margin:0 0 28px;">Obrigada por vestir a sua luz.</p>`

  const text = [
    titulo + ".",
    `Pedido #${d.numero} postado.`,
    codigo ? `Código de rastreio: ${codigo}` : null,
    link ? `Acompanhe: ${link}` : null,
    "",
    "Obrigada por vestir a sua luz.",
    `WhatsApp: https://wa.me/${d.whatsapp}`,
  ]
    .filter((l) => l !== null)
    .join("\n")

  return {
    subject: `Seu pedido #${d.numero} foi postado · use.ÉCLAT`,
    html: layout({
      previa: codigo ? `Pedido #${d.numero} postado. Rastreio ${codigo}.` : `Pedido #${d.numero} postado.`,
      corpo,
      lojaUrl: d.lojaUrl,
      whatsapp: d.whatsapp,
    }),
    text,
  }
}
