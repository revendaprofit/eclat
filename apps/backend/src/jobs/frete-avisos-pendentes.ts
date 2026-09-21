import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { verificarAvisosPendentes } from "../lib/aviso-despacho"

// Rede de segurança do aviso de despacho (spec 2026-09-20-avisos-entrega-superfrete-design.md §9):
// a cada 5 min, tenta de novo os avisos "pendente" (o código de rastreio pode ter saído e o webhook
// da SuperFrete se perdido; a Evolution pode ter voltado) e dá como "incerto" a reserva presa em
// "enviando". A lógica e os logs ficam em `verificarAvisosPendentes`; aqui só a agenda.
//
// SEM token da SuperFrete ou sem Evolution o job NÃO é pulado, de propósito: é ele que expira o
// pendente de 24 h e transforma a reserva presa em "incerto" — pular congelaria esses estados. O
// custo é pequeno: sem candidatos o SELECT volta vazio e nada é logado; com candidatos, a função loga
// `info`/`warn` por pedido (nunca `error`) até o aviso sair ou expirar em 24 h.
//
// NODE_ENV=test: não roda. O Medusa carrega os jobs também nas suítes de integração (inApp), e um
// disparo no meio de um teste mexeria nos pedidos "pendente" de lá. Os testes chamam
// `verificarAvisosPendentes` diretamente.
export default async function freteAvisosPendentesJob(container: MedusaContainer) {
  if (process.env.NODE_ENV === "test") return
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    await verificarAvisosPendentes(container)
  } catch (e) {
    // Só o tipo do erro: a mensagem de um erro do banco pode ecoar dados do pedido.
    logger.error(`[aviso-despacho] verificação a cada 5 min falhou (${(e as Error)?.name ?? "erro"}) — tenta de novo na próxima rodada`)
  }
}

export const config = {
  name: "frete-avisos-pendentes",
  schedule: "*/5 * * * *",
}
