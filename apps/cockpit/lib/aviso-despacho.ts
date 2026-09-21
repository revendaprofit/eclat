// Aviso de despacho à cliente, quando o pedido sai com etiqueta da SuperFrete (spec
// 2026-09-20-avisos-entrega-superfrete-design.md §9, adendo de 2026-09-21).
//
// Por que existe: na primeira etiqueta real (pedido #21) o código de rastreio levou ~24 s para
// existir, e o WhatsApp saiu sem ele. Regra do dono: a mensagem de despacho ESPERA o código.
// Quem manda essa mensagem é UM remetente só — o backend (webhook `order.generated` + verificação a
// cada 5 min). Com o interruptor `avisoPeloBackend` ligado, o Cockpit não manda esse WhatsApp: ele
// grava o estado em `metadata.frete.aviso_despacho`, pede ao backend que tente na hora e mostra o
// estado na tela. Desligado (padrão), o Cockpit avisa na hora como antes.
//
// O despacho MANUAL (código digitado ou sem código) não passa por aqui: continua avisando na hora.

/**
 * Interruptor `SUPERFRETE_AVISO_PELO_BACKEND` (ambiente do Cockpit). Desligado — o PADRÃO — o
 * Cockpit avisa a cliente na hora também no despacho com etiqueta, como antes desta mudança; ligado,
 * o aviso passa para o backend. Existe porque o Cockpit vai ao ar sozinho no push (Vercel) e o
 * backend só com `railway up`: sem o interruptor, "Cockpit novo + backend velho" deixaria todo aviso
 * pendente para sempre. Só liga com o texto `true` (espaço e maiúscula tolerados, para um espaço
 * colado no painel do Vercel não desligar em silêncio); qualquer outra coisa desliga.
 */
export function avisoPeloBackend(env: Record<string, string | undefined> = process.env): boolean {
  return (env.SUPERFRETE_AVISO_PELO_BACKEND ?? "").trim().toLowerCase() === "true"
}

// Os estados de `metadata.frete.aviso_despacho.status`. Os três últimos só o remetente único do
// backend grava (apps/backend/src/lib/aviso-despacho.ts, que documenta cada um):
//   enviando     — o backend reservou e está mandando agora (transitório);
//   sem_whatsapp — a Evolution disse que o número não tem WhatsApp (final);
//   incerto      — o envio pode ter saído ou não; o operador confere antes de mandar de novo (final).
export type StatusAviso =
  | "pendente"
  | "enviado"
  | "dispensado"
  | "sem_telefone"
  | "expirado"
  | "enviando"
  | "sem_whatsapp"
  | "incerto"
// `motivo`: o backend grava `dispensado` sozinho em dois casos, com o motivo em texto fixo
// (apps/backend/src/lib/aviso-despacho.ts): "etiqueta cancelada" e "coberto pelo aviso de postado".
export type AvisoDespacho = { status: StatusAviso; desde?: string; desde_envio?: string; em?: string; por?: string; motivo?: string }

const STATUS: ReadonlySet<string> = new Set<StatusAviso>([
  "pendente",
  "enviado",
  "dispensado",
  "sem_telefone",
  "expirado",
  "enviando",
  "sem_whatsapp",
  "incerto",
])

/** O que gravar logo depois de despachar com etiqueta da SuperFrete. */
export function avisoAoDespacharComEtiqueta(p: { notificar: boolean; temTelefone: boolean; agora: string }): AvisoDespacho {
  if (!p.notificar) return { status: "dispensado", em: p.agora }
  if (!p.temTelefone) return { status: "sem_telefone", em: p.agora }
  return { status: "pendente", desde: p.agora }
}

const ehObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)

/** Lê `metadata.frete.aviso_despacho`. Qualquer coisa fora do formato → null (nunca inventa estado). */
export function lerAvisoDespacho(metadata: unknown): AvisoDespacho | null {
  if (!ehObjeto(metadata) || !ehObjeto(metadata.frete)) return null
  const a = metadata.frete.aviso_despacho
  if (!ehObjeto(a) || typeof a.status !== "string" || !STATUS.has(a.status)) return null
  const aviso: AvisoDespacho = { status: a.status as StatusAviso }
  for (const k of ["desde", "desde_envio", "em", "por", "motivo"] as const) {
    if (typeof a[k] === "string") aviso[k] = a[k] as string
  }
  return aviso
}

// Os dois motivos de `dispensado` que o backend grava (mesmo texto de lá, letra por letra).
const MOTIVO_ETIQUETA_CANCELADA = "etiqueta cancelada"
const MOTIVO_COBERTO_PELO_POSTADO = "coberto pelo aviso de postado"

// Hora de Brasília, fixa: a operação é no Brasil e o texto não pode depender do fuso do navegador.
function horaMinuto(iso: string | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })
}

/** Frase para a tela do pedido. */
export function textoDoAviso(a: AvisoDespacho | null): string | null {
  if (!a) return null
  switch (a.status) {
    case "pendente":
      return "Aviso à cliente: aguardando o código de rastreio."
    case "enviado": {
      const hora = horaMinuto(a.em)
      return hora ? `Aviso à cliente enviado às ${hora}.` : "Aviso à cliente enviado."
    }
    case "dispensado":
      if (a.motivo === MOTIVO_ETIQUETA_CANCELADA) return "Etiqueta cancelada na SuperFrete: o aviso de despacho não foi enviado."
      if (a.motivo === MOTIVO_COBERTO_PELO_POSTADO) return "A cliente recebeu o aviso de postado, com o código, no lugar do aviso de despacho."
      return "Aviso à cliente desligado no despacho."
    case "sem_telefone":
      return "Pedido sem telefone: a cliente não será avisada pelo WhatsApp."
    case "expirado":
      return "O código de rastreio não apareceu em 24 h. Avise a cliente à mão."
    case "enviando":
      return "Aviso à cliente sendo enviado agora."
    case "sem_whatsapp":
      return "O número da cliente não tem WhatsApp. Avise por outro canal."
    case "incerto":
      return "Não deu para confirmar se o aviso saiu. Confira na conversa antes de mandar de novo."
  }
}

// Tom de atenção na tela (caixa âmbar, não selo). Quatro estados pedem ação do operador: avisar a
// cliente à mão (expirado, sem_telefone, sem_whatsapp) ou conferir a conversa antes de reenviar
// (incerto). O pendente também vai na caixa — decisão da Task 5: a frase é longa demais para o
// selo, que não quebra linha. enviando, enviado e dispensado são selo.
const PEDE_ATENCAO: ReadonlySet<StatusAviso> = new Set<StatusAviso>(["pendente", "expirado", "sem_telefone", "sem_whatsapp", "incerto"])

/** True quando a tela mostra o aviso com tom de atenção (caixa âmbar) em vez de selo. */
export function avisoPedeAtencao(a: AvisoDespacho | null): boolean {
  return !!a && PEDE_ATENCAO.has(a.status)
}

/**
 * Lê a resposta da rota do backend (`POST /admin/frete/aviso-despacho/{id}` → `{ aviso_despacho }`).
 * `aviso_despacho: null` é resposta VÁLIDA (o pedido não tem aviso) e não pode virar log de "fora do
 * formato". Inválida só quando não é `{ aviso_despacho: null | aviso conhecido }`.
 */
export function lerRespostaDoBackend(dados: unknown): { valida: true; aviso: AvisoDespacho | null } | { valida: false } {
  if (!ehObjeto(dados) || !("aviso_despacho" in dados)) return { valida: false }
  if (dados.aviso_despacho === null) return { valida: true, aviso: null }
  const aviso = lerAvisoDespacho({ frete: dados })
  return aviso ? { valida: true, aviso } : { valida: false }
}

/**
 * O aviso lido do pedido é o que NÓS gravamos (ou um estado posterior dele, escrito pelo backend)?
 *  - `pendente`: vale qualquer estado com o MESMO `desde` — o backend muda o aviso só por mescla
 *    (`mudarAvisoDespacho`), então `desde` atravessa enviando/enviado/incerto/expirado/dispensado…
 *    O `desde` é o instante do despacho, com milissegundos: outro aviso com o mesmo valor não existe.
 *  - `dispensado` / `sem_telefone` (o Cockpit grava com `em`, e o backend não mexe neles): mesmo
 *    status e mesmo `em`.
 */
export function ehONossoAviso(escrito: AvisoDespacho, lido: AvisoDespacho | null): boolean {
  if (!lido) return false
  if (escrito.status === "pendente") return !!escrito.desde && lido.desde === escrito.desde
  return lido.status === escrito.status && !!escrito.em && lido.em === escrito.em
}

export type ResultadoDaGravacao =
  | { estado: "gravado"; aviso: AvisoDespacho }
  | { estado: "ausente" }
  | { estado: "desconhecido" }

/**
 * Grava `metadata.frete.aviso_despacho` SEM perder o resto de `metadata.frete` (id do frete, status
 * da etiqueta, rastreio…): a mescla do Medusa só junta no nível de cima, então gravar `frete`
 * substitui o objeto inteiro. Por isso o pedido é relido AGORA, logo antes de gravar, e o `frete`
 * relido é espalhado por baixo do aviso.
 *
 * I-1 (revisão final de 2026-09-21): uma gravação pode DAR CERTO e mesmo assim responder erro (a
 * resposta se perde, estoura o tempo). Dizer ao operador "avise à mão" nesse caso faria a cliente
 * receber duas mensagens — a dele e a do backend, que acha o `pendente` no banco. Então, no erro, o
 * pedido é relido:
 *   - o nosso aviso está lá (ou um estado posterior dele) → "gravado", com o estado REAL;
 *   - não está → "ausente": aí sim o operador avisa à mão;
 *   - nem a releitura funcionou → "desconhecido": não dá para afirmar nada.
 * `deps` são o `medusaGetOrder` e o `medusaMergeOrderMetadata` (lib/medusa.ts), injetados para o teste.
 */
export async function gravarAvisoDespacho(
  id: string,
  aviso: AvisoDespacho,
  deps: {
    lerPedido: (id: string) => Promise<{ metadata?: Record<string, unknown> | null }>
    mesclarMetadata: (id: string, patch: Record<string, unknown>) => Promise<unknown>
  }
): Promise<ResultadoDaGravacao> {
  try {
    const frete = (await deps.lerPedido(id)).metadata?.frete
    await deps.mesclarMetadata(id, { frete: { ...(ehObjeto(frete) ? frete : {}), aviso_despacho: aviso } })
    return { estado: "gravado", aviso }
  } catch (e) {
    // Só texto fixo + id + status HTTP: a mensagem do erro pode trazer o corpo da resposta do Medusa,
    // que pode ecoar o metadata do pedido (ex.: e-mail do operador na conferência).
    const http = /HTTP (\d{3})/.exec((e as Error)?.message ?? "")?.[1]
    console.error(`[aviso-despacho] pedido ${id}: a gravação do aviso no pedido respondeu erro${http ? ` (HTTP ${http})` : ""} — relendo o pedido`)
  }
  try {
    const lido = lerAvisoDespacho((await deps.lerPedido(id)).metadata)
    if (lido && ehONossoAviso(aviso, lido)) {
      console.warn(`[aviso-despacho] pedido ${id}: a gravação respondeu erro, mas o aviso está no pedido (${lido.status})`)
      return { estado: "gravado", aviso: lido }
    }
    console.error(`[aviso-despacho] pedido ${id}: o aviso NÃO foi gravado no pedido`)
    return { estado: "ausente" }
  } catch {
    console.error(`[aviso-despacho] pedido ${id}: não deu para reler o pedido — estado do aviso desconhecido`)
    return { estado: "desconhecido" }
  }
}
