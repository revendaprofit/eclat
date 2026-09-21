// O ÚNICO remetente da mensagem de despacho (spec 2026-09-20-avisos-entrega-superfrete-design.md §9,
// itens 2, 3 e 3a — decisão do dono em 2026-09-21).
//
// Quando a etiqueta da SuperFrete sai sem código de rastreio, o Cockpit despacha mas SEGURA o
// WhatsApp e grava `metadata.frete.aviso_despacho = { status: "pendente", desde }`. A mensagem sai
// daqui, uma vez, completa (número + código + link), chamada de TRÊS lugares:
//   - a rota admin que o Cockpit chama logo depois do despacho ("cockpit");
//   - o webhook `order.generated` da SuperFrete ("webhook");
//   - a verificação a cada 5 minutos ("job").
// Dois chamadores ao mesmo tempo NUNCA podem mandar duas vezes. A trava é uma reserva atômica no
// Postgres (`pendente → enviando` numa instrução condicional só): quem muda a linha envia; quem
// encontra a linha já mudada não envia.
//
// ESTADOS de `metadata.frete.aviso_despacho.status`:
//   pendente      — esperando o código de rastreio (gravado pelo Cockpit, com `desde`).
//   enviando      — reservado por um chamador (`desde_envio`, `por`). Transitório.
//   enviado       — saiu (`em`, `por`). Final.
//   dispensado    — o operador não quis avisar (Cockpit). Final.
//   sem_telefone  — pedido sem telefone. Final.
//   sem_whatsapp  — a Evolution disse que o número não tem WhatsApp. Final.
//   expirado      — 24 h pendente sem código; o operador age. Final.
//   incerto       — ficou em `enviando` mais de 10 min, ou o envio estourou o tempo: a mensagem
//                   PODE ter saído. Final; o operador confere. Nunca reenviar a partir daqui.
//
// DUPLICAR É PIOR QUE FALTAR MARCA. Todas as decisões ambíguas abaixo pendem para "não reenviar".
//
// DADO PESSOAL: nenhum log leva telefone, nome, e-mail ou corpo de resposta. Só número do pedido,
// status, origem e o status HTTP / tipo do erro.
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ClienteSuperfrete } from "../modules/superfrete/cliente"
import { EvolutionHttpError, evolutionConfigured, sendWhatsappText } from "./evolution"
import { normalizaWhatsapp, textoDespacho } from "./superfrete-avisos"

export type OrigemDoAviso = "cockpit" | "webhook" | "job"
export type AvisoDespacho = Record<string, unknown> & { status?: string }

// Timeout do WhatsApp. Estourar é AMBÍGUO (a Evolution pode ter entregado e respondido tarde) e
// por isso vira `incerto`, não retentativa.
const TIMEOUT_WHATSAPP_MS = 15_000
const PENDENTE_MAX_MS = 24 * 60 * 60 * 1000
const ENVIANDO_MAX_MS = 10 * 60 * 1000

// O mínimo do knex (ContainerRegistrationKeys.PG_CONNECTION) que usamos: `raw` com bindings `?`.
export type Pg = { raw: (sql: string, bindings?: readonly unknown[]) => PromiseLike<{ rows: Record<string, unknown>[] }> }

function pgDo(container: MedusaContainer): Pg {
  return container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as unknown as Pg
}

function objeto(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

// Mesma regra do Cockpit (apps/cockpit/lib/shipping.ts, carrierPagarFrete/carrierConsultarFrete):
// os serviços da SuperFrete que usamos (Mini Envios, PAC, SEDEX) são dos Correios, e o link de
// acompanhamento é o rastreamento dos Correios com o código.
export function linkDeRastreio(codigo: string): string {
  return codigo ? `https://rastreamento.correios.com.br/app/index.php?objetos=${encodeURIComponent(codigo)}` : ""
}

// ---------------------------------------------------------------------------------------------
// Gravação no `metadata.frete` SEM "ler, alterar e gravar".
//
// O `updateOrders` do Medusa faz merge RASO do metadata: gravar `frete` substitui o objeto inteiro
// pelo que foi lido antes. Entre essa leitura e a gravação, uma reserva `pendente → enviando` feita
// por outro chamador seria desfeita — e a mensagem poderia sair duas vezes. Aqui a junção acontece
// DENTRO do Postgres, numa instrução só: o que outro escritor gravou em outras chaves fica.
//
// `campos` nunca contém `aviso_despacho`: quem mexe no aviso são só as transições condicionais
// (`mudarAvisoDespacho`). Passar essa chave é erro de programação e lança.
//
// Opções:
//   em: "eventos" | "avisos" — mescla `campos` DENTRO de `frete[em]` (um objeto), em vez de na raiz
//       de `frete`. É uma concatenação aninhada e não um `jsonb_set` no caminho `{frete,avisos,x}`
//       porque o `jsonb_set` não cria o objeto intermediário: se `avisos` ainda não existe, ele
//       devolve o documento sem mudança nenhuma, e a marca se perderia em silêncio.
//   seSemRastreio — só grava se o pedido ainda não tem `tracking_number` (nunca sobrescreve um
//       código que já existe, nem um gravado por outro caminho no meio-tempo).
// Devolve o `frete` como ficou no banco (ou null se nenhuma linha mudou).
// ---------------------------------------------------------------------------------------------
export async function mesclarNoFrete(
  pg: Pg,
  orderId: string,
  campos: Record<string, unknown>,
  opcoes: { em?: "eventos" | "avisos"; seSemRastreio?: boolean } = {}
): Promise<Record<string, unknown> | null> {
  if (!opcoes.em && Object.prototype.hasOwnProperty.call(campos, "aviso_despacho")) {
    throw new Error("mesclarNoFrete: `aviso_despacho` só muda por mudarAvisoDespacho (transição condicional)")
  }
  const json = JSON.stringify(campos)
  const novoFrete = opcoes.em
    ? `coalesce(metadata->'frete','{}'::jsonb) || jsonb_build_object(?::text, coalesce(metadata->'frete'->?,'{}'::jsonb) || ?::jsonb)`
    : `coalesce(metadata->'frete','{}'::jsonb) || ?::jsonb`
  const bindings: unknown[] = opcoes.em ? [opcoes.em, opcoes.em, json, orderId] : [json, orderId]
  const { rows } = await pg.raw(
    `UPDATE "order"
     SET metadata = jsonb_set(coalesce(metadata,'{}'::jsonb), '{frete}', ${novoFrete}), updated_at = now()
     WHERE id = ? AND deleted_at IS NULL${opcoes.seSemRastreio ? ` AND coalesce(metadata->'frete'->>'tracking_number','') = ''` : ""}
     RETURNING metadata->'frete' AS frete`,
    bindings
  )
  return rows[0] ? objeto(rows[0].frete) : null
}

// Transição CONDICIONAL de `aviso_despacho`: só muda se o status atual é `de`. Mescla `campos` e
// remove as chaves de `remover`. Devolve o aviso como ficou, ou null se a condição não bateu (outro
// chamador chegou antes). É a mesma instrução da reserva — um padrão só, no banco, sem janela entre
// ler e gravar.
export async function mudarAvisoDespacho(
  pg: Pg,
  orderId: string,
  de: string,
  campos: Record<string, unknown>,
  remover: string[] = []
): Promise<AvisoDespacho | null> {
  const menos = remover.map(() => " - ?::text").join("")
  const { rows } = await pg.raw(
    `UPDATE "order"
     SET metadata = jsonb_set(metadata, '{frete,aviso_despacho}', ((metadata->'frete'->'aviso_despacho')${menos}) || ?::jsonb), updated_at = now()
     WHERE id = ? AND deleted_at IS NULL AND metadata->'frete'->'aviso_despacho'->>'status' = ?
     RETURNING metadata->'frete'->'aviso_despacho' AS aviso`,
    [...remover, JSON.stringify(campos), orderId, de]
  )
  return rows[0] ? (objeto(rows[0].aviso) as AvisoDespacho) : null
}

type PedidoLido = {
  id: string
  display_id: number | null
  metadata: Record<string, unknown>
  shipping_address: { first_name?: string | null; phone?: string | null } | null
}

async function lerPedido(container: MedusaContainer, orderId: string): Promise<PedidoLido | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [pedido],
  } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "metadata", "shipping_address.first_name", "shipping_address.phone"],
    filters: { id: orderId },
  })
  if (!pedido) return null
  return {
    id: pedido.id,
    display_id: (pedido.display_id as number | null) ?? null,
    metadata: objeto(pedido.metadata),
    shipping_address: (pedido.shipping_address as PedidoLido["shipping_address"]) ?? null,
  }
}

function avisoDe(pedido: PedidoLido): AvisoDespacho | null {
  const a = objeto(pedido.metadata.frete).aviso_despacho
  return a && typeof a === "object" && !Array.isArray(a) ? (a as AvisoDespacho) : null
}

async function avisoAtual(container: MedusaContainer, orderId: string): Promise<AvisoDespacho | null> {
  const pedido = await lerPedido(container, orderId)
  return pedido ? avisoDe(pedido) : null
}

// Instante em ms de um ISO do metadata; inválido/ausente → NaN.
function instante(v: unknown): number {
  return typeof v === "string" ? Date.parse(v) : NaN
}

function clienteSuperfreteDoAmbiente(): ClienteSuperfrete | null {
  const token = process.env.SUPERFRETE_TOKEN
  const contato = process.env.SUPERFRETE_CONTACT_EMAIL
  if (!token || !contato) return null
  return new ClienteSuperfrete({
    token,
    contato,
    cepOrigem: process.env.SUPERFRETE_FROM_POSTAL_CODE ?? "",
    sandbox: process.env.SUPERFRETE_SANDBOX === "true",
    baseUrl: process.env.SUPERFRETE_BASE_URL || undefined,
  })
}

/**
 * Tenta mandar a mensagem de despacho pendente de um pedido. Retorna o `aviso_despacho` final (ou
 * null se o pedido não existe ou não tem aviso). Nunca manda duas vezes, nem com chamadores
 * simultâneos. Só lança em erro do NOSSO banco antes de qualquer envio.
 */
export async function tentarAvisoDeDespacho(
  container: MedusaContainer,
  orderId: string,
  origem: OrigemDoAviso
): Promise<AvisoDespacho | null> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const pg = pgDo(container)

  // 1. Ler o pedido.
  const pedido = await lerPedido(container, orderId)
  if (!pedido) {
    logger.warn(`[aviso-despacho] pedido ${orderId} não encontrado (${origem})`)
    return null
  }
  const n = pedido.display_id ?? "?"
  const aviso = avisoDe(pedido)
  if (!aviso) return null

  if (aviso.status === "enviando") {
    // Reservado por alguém. Se a reserva é velha demais (ou ilegível), o chamador que a fez morreu
    // no meio do envio: a mensagem PODE ter saído. Vira `incerto` e o operador confere.
    const desdeEnvio = instante(aviso.desde_envio)
    if (!(Date.now() - desdeEnvio <= ENVIANDO_MAX_MS)) {
      const incerto = await mudarAvisoDespacho(pg, orderId, "enviando", {
        status: "incerto",
        incerto_em: new Date().toISOString(),
        motivo: "reserva de envio sem conclusão há mais de 10 minutos",
      })
      if (incerto) {
        logger.error(`[aviso-despacho] pedido #${n}: aviso de despacho ficou INCERTO (reserva sem conclusão há mais de 10 min) — conferir se a cliente recebeu`)
        return incerto
      }
      return avisoAtual(container, orderId)
    }
    return aviso
  }
  if (aviso.status !== "pendente") return aviso

  // 2. Pendente há mais de 24 h → para de tentar. `desde` ilegível não expira (não há como contar);
  // o Cockpit sempre grava `desde`.
  const desde = instante(aviso.desde)
  if (Date.now() - desde > PENDENTE_MAX_MS) {
    const expirado = await mudarAvisoDespacho(pg, orderId, "pendente", { status: "expirado", expirado_em: new Date().toISOString() })
    if (expirado) {
      logger.warn(`[aviso-despacho] pedido #${n}: 24 h sem código de rastreio — aviso de despacho EXPIRADO, avisar a cliente à mão`)
      return expirado
    }
    return avisoAtual(container, orderId)
  }

  // 3. O código de rastreio. Se falta, pergunta à SuperFrete pela etiqueta.
  const frete = objeto(pedido.metadata.frete)
  let codigo = typeof frete.tracking_number === "string" ? frete.tracking_number.trim() : ""
  let link = typeof frete.tracking_url === "string" ? frete.tracking_url : ""
  if (!codigo) {
    const superfreteId = typeof frete.superfrete_id === "string" ? frete.superfrete_id : ""
    const cliente = superfreteId ? clienteSuperfreteDoAmbiente() : null
    if (!cliente) {
      logger.info(`[aviso-despacho] pedido #${n}: sem código de rastreio e sem como consultar a SuperFrete — segue pendente (${origem})`)
      return aviso
    }
    try {
      const info = await cliente.consultarEtiqueta(superfreteId)
      if (!info.tracking) {
        logger.info(`[aviso-despacho] pedido #${n}: SuperFrete ainda sem código de rastreio (status ${info.status || "?"}) — segue pendente (${origem})`)
        return aviso
      }
      // Grava o código (e o link) no `frete` — dentro do banco, sem desfazer a gravação de mais ninguém,
      // e só se ninguém gravou um código no meio-tempo.
      const gravado = await mesclarNoFrete(pg, orderId, { tracking_number: info.tracking, tracking_url: linkDeRastreio(info.tracking) }, { seSemRastreio: true })
      const freteAgora = gravado ?? objeto((await lerPedido(container, orderId))?.metadata.frete)
      codigo = String(freteAgora.tracking_number ?? info.tracking)
      link = String(freteAgora.tracking_url ?? "")
    } catch (e) {
      logger.warn(`[aviso-despacho] pedido #${n}: consulta da etiqueta na SuperFrete falhou (${(e as Error)?.name ?? "erro"}) — segue pendente (${origem})`)
      return aviso
    }
  }
  if (!link) link = linkDeRastreio(codigo)

  if (!evolutionConfigured()) {
    // Sem Evolution neste ambiente não há como enviar — e não reservar é o que deixa o job tentar
    // quando ela voltar (ou o aviso expirar em 24 h, com log para o operador).
    logger.warn(`[aviso-despacho] pedido #${n}: Evolution não configurada — aviso de despacho segue pendente (${origem})`)
    return aviso
  }

  // 4. A TRAVA: reserva atômica `pendente → enviando`. Uma instrução só no Postgres; com dois
  // chamadores, o segundo UPDATE espera o bloqueio da linha, reavalia o WHERE sobre a versão nova
  // (já "enviando") e muda zero linhas. Não usa pg_advisory_lock — nada de conexão presa durante o envio.
  const reservado = await mudarAvisoDespacho(pg, orderId, "pendente", { status: "enviando", desde_envio: new Date().toISOString(), por: origem })
  if (!reservado) {
    // Outro chamador ganhou (ou o operador mudou o aviso). Não envia.
    return avisoAtual(container, orderId)
  }

  // 5. Sem telefone (defesa: o Cockpit normalmente não grava "pendente" sem telefone).
  const telefone = pedido.shipping_address?.phone?.trim()
  if (!telefone) {
    const sem = await mudarAvisoDespacho(pg, orderId, "enviando", { status: "sem_telefone", em: new Date().toISOString() }, ["desde_envio"])
    logger.warn(`[aviso-despacho] pedido #${n}: pedido sem telefone — aviso de despacho não enviado (${origem})`)
    return sem ?? avisoAtual(container, orderId)
  }

  // 6. Envia.
  const texto = textoDespacho({ nome: pedido.shipping_address?.first_name, numero: n, codigo, link })
  try {
    await sendWhatsappText(normalizaWhatsapp(telefone), texto, 0, { timeoutMs: TIMEOUT_WHATSAPP_MS })
  } catch (e) {
    // 7b. Falhou. Três desfechos, todos condicionais em "enviando".
    if (e instanceof EvolutionHttpError && e.numeroInexistente) {
      const sem = await mudarAvisoDespacho(pg, orderId, "enviando", { status: "sem_whatsapp", em: new Date().toISOString() }, ["desde_envio"])
      logger.warn(`[aviso-despacho] pedido #${n}: número da cliente não tem WhatsApp — aviso de despacho não enviado (${origem})`)
      return sem ?? avisoAtual(container, orderId)
    }
    if ((e as Error)?.name === "TimeoutError" || (e as Error)?.name === "AbortError") {
      // A Evolution pode ter entregado e respondido tarde. Reenviar arriscaria duplicar: `incerto`.
      const incerto = await mudarAvisoDespacho(pg, orderId, "enviando", {
        status: "incerto",
        incerto_em: new Date().toISOString(),
        motivo: "tempo esgotado no envio do WhatsApp",
      })
      logger.error(`[aviso-despacho] pedido #${n}: envio do WhatsApp estourou o tempo — aviso INCERTO, conferir se a cliente recebeu (${origem})`)
      return incerto ?? avisoAtual(container, orderId)
    }
    // Qualquer outro erro (401/403/404/429/5xx/rede): a mensagem NÃO saiu. Volta para pendente e o
    // job tenta de novo em 5 min.
    const motivo = e instanceof EvolutionHttpError ? `HTTP ${e.status}` : "erro de rede"
    const devolvido = await mudarAvisoDespacho(pg, orderId, "enviando", { status: "pendente" }, ["desde_envio", "por"])
    logger.error(`[aviso-despacho] pedido #${n}: WhatsApp falhou (${motivo}) — aviso de despacho volta para pendente (${origem})`)
    return devolvido ?? avisoAtual(container, orderId)
  }

  // 7a. Saiu. Marca "enviado". Se ESTA gravação falhar, NÃO relança e devolve "enviado" para quem
  // chamou: no banco fica "enviando", que vira "incerto" em 10 min — e ninguém reenvia. De propósito.
  const enviado = { ...reservado, status: "enviado", em: new Date().toISOString(), por: origem }
  try {
    const marcado = await mudarAvisoDespacho(pg, orderId, "enviando", { status: "enviado", em: enviado.em, por: origem })
    logger.info(`[aviso-despacho] pedido #${n}: aviso de despacho enviado (${origem})`)
    return marcado ?? (await avisoAtual(container, orderId)) ?? enviado
  } catch (e) {
    logger.error(
      `[aviso-despacho] pedido #${n}: mensagem de despacho SAIU, mas a marca não foi gravada (${(e as Error)?.name ?? "erro"}) — ` +
        `fica "enviando" e vira "incerto" em 10 min; ninguém reenvia (${origem})`
    )
    return enviado
  }
}
