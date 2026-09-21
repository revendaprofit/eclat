// Compra segura da etiqueta SuperFrete — a orquestração que garante que uma retentativa de despacho
// NUNCA paga a mesma etiqueta duas vezes (achados 1–3 da revisão de 2026-09-19: retentativa pós-
// pagamento comprava de novo; sem timeout a ambiguidade "foi cobrado?" alimentava isso; sem trava,
// um duplo clique disparava duas compras ao mesmo tempo).
//
// Revisão de 2026-09-19 com a API REAL (etiqueta comprada e cancelada pelo dono): o status da
// SuperFrete é EVENTUALMENTE CONSISTENTE — `GET /api/v0/order/info/{id}` respondeu "pending" por
// alguns segundos logo depois de um `/checkout` que JÁ tinha sido aceito (e o `/checkout` em si
// devolveu o PDF com `tracking` vazio). Duas consequências:
//   1) Uma etiqueta que NÓS já registramos como paga (`status: "paga"`) NUNCA volta a chamar `pagar`
//      nem `criar`, não importa o que `consultar` diga — só procura o rastreio, e se `consultar`
//      disser "pending" isso é lido como atraso do status, não como "não foi pago" (regra A).
//   2) Antes de pagar um frete "pendente", espera e confere DE NOVO — um único "pending" não prova
//      que não foi pago (regra B).
// E, como o rastreio pode vir vazio na hora do pagamento, toda compra bem-sucedida busca o rastreio
// por alguns segundos (regra C) — mas grava "paga" IMEDIATAMENTE, mesmo sem rastreio: nunca deixar
// uma etiqueta paga registrada só como "pendente" enquanto espera.
//
// Dependências injetadas (Deps) em vez de chamar lib/shipping.ts direto: permite testar toda a
// lógica de decisão sem `fetch`, sem stub de rede, e sem qualquer chance de bater na API real.
//
// O estado do frete vive em metadata.frete do pedido (gravado via `salvar`), lido de volta com
// `lerEstadoDoFrete`. `status`:
//   "iniciando" → decidiu comprar, ainda não tem id da SuperFrete (não gasta saldo).
//   "pendente"  → tem id (POST /api/v0/cart feito), pagamento incerto — pode ter falhado, pode ter
//                 sido só lentidão/timeout. NUNCA assume pago nem assume não pago: consulta (regra B).
//   "paga"      → pagamento confirmado. Fonte da verdade final — nunca mais paga nem cria (regra A).
import type { CarrierLabel } from "./shipping"

export type EstadoDoFrete = {
  transportadora: "superfrete"
  status: "iniciando" | "pendente" | "paga"
  superfrete_id?: string
  tracking_number?: string
  tracking_url?: string
  label_url?: string
  em: string // ISO
}

export type Deps = {
  criar: () => Promise<string>
  pagar: (id: string) => Promise<CarrierLabel>
  consultar: (id: string) => Promise<{ status: string; label: CarrierLabel | null }>
  salvar: (estado: EstadoDoFrete) => Promise<void>
  agora?: () => Date
  // Espera real entre tentativas (status/rastreio da SuperFrete são eventualmente consistentes).
  // Default: setTimeout de verdade. Testes injetam um `vi.fn()` que resolve na hora.
  esperar?: (ms: number) => Promise<void>
}

const DOIS_MINUTOS_MS = 120_000
// Data propositalmente "impossível de ser recente": grava aqui quando `criar` falha, pra uma
// retentativa logo em seguida (ex.: operador corrigiu o CEP e clicou de novo) não ficar bloqueada
// pelos 2 minutos da regra 3 — o erro foi instantâneo, não uma compra em andamento de verdade.
const EPOCH_ZERO = "1970-01-01T00:00:00.000Z"

// Regra B: quanto esperar antes de conferir uma 2ª vez se um frete "pendente" foi mesmo pago, antes
// de arriscar pagar de novo. Regra C: quanto esperar entre tentativas de achar o rastreio depois de
// pagar, e quantas tentativas (a API real mostrou o rastreio demorando alguns segundos a mais que o
// pagamento em si).
const ESPERA_STATUS_MS = 8_000
const ESPERA_RASTREIO_MS = 4_000
const TENTATIVAS_RASTREIO = 3

const STATUS_VALIDOS = new Set(["iniciando", "pendente", "paga"])

const esperarPadrao = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

// Lê metadata.frete do pedido de volta em EstadoDoFrete — defensivo: qualquer coisa fora do
// esperado (ausente, de outra transportadora, status desconhecido, sem `em`) vira null, e o chamador
// trata como "nenhum estado aproveitável" (regra 4, compra do zero).
export function lerEstadoDoFrete(metadata: unknown): EstadoDoFrete | null {
  const m = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {}
  const f = m.frete
  if (!f || typeof f !== "object") return null
  const o = f as Record<string, unknown>
  if (o.transportadora !== "superfrete") return null
  const status = o.status
  if (typeof status !== "string" || !STATUS_VALIDOS.has(status)) return null
  const em = o.em
  if (typeof em !== "string" || !em) return null

  const estado = { transportadora: "superfrete", status, em } as EstadoDoFrete
  if (typeof o.superfrete_id === "string") estado.superfrete_id = o.superfrete_id
  if (typeof o.tracking_number === "string") estado.tracking_number = o.tracking_number
  if (typeof o.tracking_url === "string") estado.tracking_url = o.tracking_url
  if (typeof o.label_url === "string") estado.label_url = o.label_url
  return estado
}

function labelDoEstado(estado: { superfrete_id?: string; tracking_number?: string; tracking_url?: string; label_url?: string }): CarrierLabel {
  return {
    tracking_number: estado.tracking_number ?? "",
    tracking_url: estado.tracking_url ?? "",
    label_url: estado.label_url ?? "",
    carrier_order_id: estado.superfrete_id ?? "",
  }
}

async function salvarPaga(deps: Deps, agora: () => Date, id: string, label: CarrierLabel): Promise<void> {
  await deps.salvar({
    transportadora: "superfrete",
    status: "paga",
    superfrete_id: id,
    tracking_number: label.tracking_number,
    tracking_url: label.tracking_url,
    label_url: label.label_url,
    em: agora().toISOString(),
  })
}

// Regra C: procura o rastreio depois de uma compra confirmada (pagamento já registrado como "paga",
// com ou sem rastreio). Nunca falha a compra: se `consultar` der erro, para de procurar e devolve o
// que já tem (o dinheiro já foi gasto — o operador precisa conseguir terminar o despacho). O `salvar`
// que grava o rastreio encontrado AQUI DENTRO é MELHOR-ESFORÇO — se falhar, devolve o rastreio pro
// operador do mesmo jeito (achado 1, revisão round 5): o dinheiro já foi gasto e o rastreio já foi
// encontrado, então perder só a gravação não pode virar um 502 no meio de um despacho que já deu
// certo. Isso é DIFERENTE do `salvarPaga` logo depois de `pagar` (em `pagarComRastreio`) e do
// `salvarPaga` na regra B depois de uma consulta positiva: aqueles SEMPRE propagam o erro, porque são
// o único registro de que o id existe e foi pago — perdê-los silenciosamente esconderia o gasto.
// `lancarSeCancelada`: só a regra A usa (uma etiqueta já paga que a SuperFrete diz ter cancelado é
// uma situação que precisa de atenção manual, nunca uma compra automática de outra por cima).
async function buscarRastreio(
  deps: Deps,
  agora: () => Date,
  esperar: (ms: number) => Promise<void>,
  id: string,
  labelAtual: CarrierLabel,
  opts: { lancarSeCancelada?: boolean } = {}
): Promise<CarrierLabel> {
  let resultado = labelAtual
  for (let tentativa = 0; tentativa < TENTATIVAS_RASTREIO; tentativa++) {
    await esperar(ESPERA_RASTREIO_MS)
    let consulta: { status: string; label: CarrierLabel | null }
    try {
      consulta = await deps.consultar(id)
    } catch {
      break // consultar falhou: para de procurar, mantém o que já tem — nunca falha a compra por isso.
    }
    if (opts.lancarSeCancelada && consulta.status === "canceled") {
      throw new Error(
        `A etiqueta ${id} consta como CANCELADA na SuperFrete. Confira o painel antes de tentar de novo; para comprar outra, limpe o frete do pedido.`
      )
    }
    if (consulta.label?.tracking_number) {
      resultado = {
        tracking_number: consulta.label.tracking_number,
        tracking_url: consulta.label.tracking_url,
        label_url: consulta.label.label_url || resultado.label_url,
        carrier_order_id: id,
      }
      try {
        await salvarPaga(deps, agora, id, resultado)
      } catch {
        // Melhor-esforço (ver comentário da função): não falha o despacho por causa disso.
      }
      break
    }
    // Sem rastreio ainda (status "pending", "released" sem tracking, ou qualquer outro) — tenta de
    // novo; o status é eventualmente consistente, não é prova de nada ainda.
  }
  return resultado
}

// Paga um frete já criado e garante que "paga" fica gravado ANTES de procurar o rastreio — nunca
// deixa uma etiqueta paga registrada só como "pendente" enquanto espera a SuperFrete preencher o
// rastreio (a API real devolveu `tracking` vazio na resposta do /checkout).
async function pagarComRastreio(deps: Deps, agora: () => Date, esperar: (ms: number) => Promise<void>, id: string): Promise<CarrierLabel> {
  const label = await deps.pagar(id)
  await salvarPaga(deps, agora, id, label)
  if (label.tracking_number) return label
  return buscarRastreio(deps, agora, esperar, id, label)
}

// Garante que existe uma etiqueta paga para o pedido, comprando o mínimo necessário — nunca mais
// que uma vez por frete. Cada branch abaixo corresponde a uma regra de segurança contra pagar em
// dobro; ver lib/etiqueta-segura.test.ts para o teste de cada uma.
export async function garantirEtiqueta(deps: Deps, atual: EstadoDoFrete | null): Promise<CarrierLabel> {
  const agora = deps.agora ?? (() => new Date())
  const esperar = deps.esperar ?? esperarPadrao

  // Regra 1: já paga e com rastreio — nada a fazer. Cobre a retentativa pós-pagamento (achado 1):
  // se o fulfillment/shipment falhar DEPOIS da etiqueta comprada, o próximo clique em Despachar cai
  // aqui e devolve a etiqueta já paga, sem tocar na SuperFrete de novo.
  if (atual?.status === "paga" && atual.superfrete_id && atual.tracking_number) {
    return labelDoEstado(atual)
  }

  // Regra A: já paga (checkout confirmado por NÓS), mas ainda sem rastreio. NUNCA chama `pagar` nem
  // `criar` aqui — o pagamento já é fato consumado; só procura o rastreio (regra C), com a exceção
  // de "canceled" (única forma de escapar de um registro "paga").
  if (atual?.status === "paga" && atual.superfrete_id) {
    return buscarRastreio(deps, agora, esperar, atual.superfrete_id, labelDoEstado(atual), { lancarSeCancelada: true })
  }

  // Guarda (round 5, achado 2): "paga" ou "pendente" SEM superfrete_id não deveria acontecer vindo
  // das próprias gravações desta função — mas se o metadata foi editado à mão ou corrompido de outra
  // forma, essa é a ÚNICA forma de um "paga" virar silenciosamente uma compra nova por cima. Nunca
  // compra: pede conferência manual.
  if ((atual?.status === "paga" || atual?.status === "pendente") && !atual.superfrete_id) {
    throw new Error(
      `O pedido tem um frete marcado como "${atual.status}" mas sem o id da SuperFrete. Confira o painel da SuperFrete antes de gerar outra etiqueta.`
    )
  }

  // Regra B: já existe um frete criado na SuperFrete (id presente, ainda "pendente") — confere o
  // status, e se disser "pending" espera e confere de NOVO antes de decidir pagar (o status é
  // eventualmente consistente: um único "pending" não prova que o pagamento não foi feito).
  if (atual?.superfrete_id) {
    const id = atual.superfrete_id
    let consulta = await deps.consultar(id)
    if (consulta.label) {
      await salvarPaga(deps, agora, id, consulta.label)
      return consulta.label
    }
    if (consulta.status === "pending") {
      await esperar(ESPERA_STATUS_MS)
      consulta = await deps.consultar(id)
      if (consulta.label) {
        await salvarPaga(deps, agora, id, consulta.label)
        return consulta.label
      }
      if (consulta.status === "pending") {
        // Duas consultas "pending" com 8s de intervalo é um sinal forte, mas NÃO é prova — é uma
        // aposta probabilística sobre um atraso de poucos segundos observado em UMA verificação
        // real. Se a resposta do /checkout tiver se perdido (ex.: timeout) E o atraso do status
        // passar dos 8s de espera, isto paga uma SEGUNDA vez. Na prática, quando chegamos aqui o
        // pedido já esperou os 20s de timeout de carrierPagarFrete/carrierConsultarFrete
        // (lib/shipping.ts) MAIS o tempo até o operador clicar de novo — normalmente 20-30s ou mais,
        // contra o atraso de poucos segundos observado. As constantes (ESPERA_STATUS_MS etc.) estão
        // centralizadas no topo do arquivo pra recalibrar se a SuperFrete se mostrar mais lenta que
        // isso em produção. (O dono está avaliando webhooks da SuperFrete, o que mudaria esse
        // desenho — não mexer nisso agora.) Paga com o MESMO id (não cria outro frete).
        return pagarComRastreio(deps, agora, esperar, id)
      }
    }
    if (consulta.status !== "canceled") {
      // Status que este fluxo não sabe interpretar com segurança (ex.: em disputa, erro da
      // SuperFrete) — não tenta pagar nem criar outro; manda o operador conferir manualmente.
      throw new Error(`A etiqueta ${id} está com status "${consulta.status}" na SuperFrete. Confira no painel da SuperFrete antes de tentar de novo.`)
    }
    // "canceled" (na 1ª ou na 2ª consulta): o saldo já voltou pra carteira — comprar um frete novo é
    // legítimo (cai na regra 4).
  } else if (atual?.status === "iniciando") {
    // Regra 3: decidiu comprar mas ainda não tem id — pode ser uma compra em andamento (outra aba,
    // duplo clique) ou uma tentativa anterior que falhou antes de chegar no /cart. Só bloqueia por
    // uma janela curta; achado 3 (duplo clique) é resolvido aqui pro caso entre duas instâncias do
    // Cockpit (a trava em memória da rota cobre o caso na mesma instância).
    const desde = Date.parse(atual.em)
    const idade = agora().getTime() - (Number.isFinite(desde) ? desde : 0)
    if (idade < DOIS_MINUTOS_MS) {
      throw new Error("Já existe uma compra de etiqueta em andamento para este pedido. Aguarde 2 minutos e tente de novo.")
    }
    // Mais velho que 2 minutos: considera abandonada (cai na regra 4).
  }

  // Regra 4: nenhum estado aproveitável — compra do zero. Grava "iniciando" ANTES de chamar `criar`
  // para que uma retentativa concorrente veja o estado e não dispare outra compra (regra 3).
  await deps.salvar({ transportadora: "superfrete", status: "iniciando", em: agora().toISOString() })
  let id: string
  try {
    id = await deps.criar()
  } catch (e) {
    // `criar` falhou (dado inválido, timeout etc.) — SEM isso, a próxima tentativa ficaria travada
    // pelos 2 minutos da regra 3 por causa de um erro que não gastou saldo nem levou tempo real.
    await deps.salvar({ transportadora: "superfrete", status: "iniciando", em: EPOCH_ZERO })
    throw e
  }
  try {
    await deps.salvar({ transportadora: "superfrete", status: "pendente", superfrete_id: id, em: agora().toISOString() })
  } catch (e) {
    // Este é o único ponto em que uma falha de gravação perde o rastro do frete: "iniciando" já foi
    // salvo, mas SEM o id — se essa gravação também falhar, ninguém mais sabe que `id` existe. O
    // frete não foi pago (não custou nada), mas o operador precisa do id pra achar e, se quiser,
    // cancelar essa etiqueta órfã no painel da SuperFrete.
    throw new Error(
      `Frete criado na SuperFrete (id ${id}), mas não consegui gravar no pedido: ${(e as Error).message}. Nada foi cobrado. Tente de novo em 2 minutos; se sobrar um frete pendente no painel da SuperFrete, ele não tem custo.`
    )
  }
  // Se `pagar` falhar daqui pra baixo (achado 2: sem saldo, timeout), o estado fica "pendente" com o
  // id gravado — a próxima chamada cai na regra B e conserta sozinha (consulta antes de pagar de novo).
  return pagarComRastreio(deps, agora, esperar, id)
}
