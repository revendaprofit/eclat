// ============================================================================================
// TEXTOS DOS AVISOS DE ENTREGA POR WHATSAPP (spec 2026-09-20-avisos-entrega-superfrete-design.md
// §4.5 e §9.3).
//
// PARA O DONO: é AQUI que se edita o que a cliente recebe no WhatsApp. Um arquivo só, de propósito
// — quando o mesmo texto vivia em dois lugares, as cópias divergiram. Pode mudar as frases à vontade;
// só não apague os `${...}` (é onde entram o nome, o número do pedido, o código e o link).
//   - `*texto*` vira NEGRITO no WhatsApp.
//   - `\n` é quebra de linha; `\n\n` deixa uma linha em branco.
// Depois de mudar um texto, o teste `src/lib/__tests__/superfrete-avisos.unit.spec.ts` acusa a
// diferença: atualize o texto esperado lá também (é assim que a mudança fica registrada).
//
// ATENÇÃO: o texto de DESPACHO também existe no Cockpit, no despacho MANUAL e no despacho com o
// interruptor SUPERFRETE_AVISO_PELO_BACKEND desligado (apps/cockpit/app/api/orders/[id]/dispatch/
// route.ts). Mudou aqui, mude lá — até o interruptor ficar ligado para sempre.
// ============================================================================================

export type DadosDoAviso = {
  /** Primeiro nome da cliente (vazio → "tudo bem"). */
  nome?: string | null
  /** Número do pedido que a cliente vê (display_id). */
  numero: number | string
  /** Código de rastreio; vazio quando ainda não existe. */
  codigo?: string | null
  /** Link de acompanhamento; vazio quando não há. */
  link?: string | null
}

function saudacao(nome?: string | null): string {
  return nome || "tudo bem"
}

// Bloco do rastreio, igual nos avisos de despacho e de postado. Sem código, some inteiro.
function blocoRastreio(codigo?: string | null, link?: string | null): string {
  return codigo ? `\n\n📦 Código de rastreio: *${codigo}*${link ? `\nAcompanhe: ${link}` : ""}` : ""
}

/** Pedido despachado (etiqueta comprada). É o MESMO texto que o Cockpit manda no despacho. */
export function textoDespacho(d: DadosDoAviso): string {
  return `Oi, ${saudacao(d.nome)}! 💛\nSeu pedido *#${d.numero}* da use.ÉCLAT acabou de ser enviado.${blocoRastreio(d.codigo, d.link)}\n\nQualquer dúvida, é só chamar por aqui. Obrigada por vestir a sua luz. ✨`
}

/** A transportadora recebeu o pacote (webhook `order.posted`). */
export function textoPostado(d: DadosDoAviso): string {
  return `Oi, ${saudacao(d.nome)}! 💛\nSeu pedido *#${d.numero}* da use.ÉCLAT já foi postado e está a caminho.${blocoRastreio(d.codigo, d.link)}\n\nQualquer dúvida, é só chamar por aqui. ✨`
}

/** Pacote entregue (webhook `order.delivered`). */
export function textoEntregue(d: DadosDoAviso): string {
  return `Oi, ${saudacao(d.nome)}! 💛\nSeu pedido *#${d.numero}* da use.ÉCLAT foi entregue.\n\nEsperamos que você ame. Obrigada por vestir a sua luz. ✨`
}

// Mesma regra da rota de despacho do Cockpit (app/api/orders/[id]/dispatch/route.ts): a Evolution
// espera o número com DDI e só dígitos. Replicada, não inventada — dois normalizadores diferentes
// para o mesmo número seria a origem de "a mensagem não chegou" sem explicação.
export function normalizaWhatsapp(phone: string): string {
  const d = phone.replace(/\D/g, "")
  if (d.startsWith("55")) return d
  if (d.length === 10 || d.length === 11) return "55" + d
  return d
}
