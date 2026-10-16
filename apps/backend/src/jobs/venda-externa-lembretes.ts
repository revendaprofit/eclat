import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { enviarLembretesDePagamento } from "../lib/venda-externa"

// Vendas fora do site a prazo (sócia, 2026-10-15): às 9h de Brasília, quem tem pagamento combinado para hoje (ou
// atrasado sem lembrete) recebe o lembrete pelo WhatsApp da marca — uma vez; depois é o botão do Cockpit.
export default async function vendaExternaLembretesJob(container: MedusaContainer) {
  if (process.env.NODE_ENV === "test") return
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    await enviarLembretesDePagamento({ info: (m) => logger.info(m), warn: (m) => logger.warn(m) })
  } catch (e) {
    logger.warn(`[venda-externa-lembretes] rodada falhou (${(e as Error)?.message ?? "erro"}) — tenta de novo amanhã`)
  }
}

export const config = {
  name: "venda-externa-lembretes",
  schedule: "0 12 * * *", // 12h UTC = 9h em Brasília
}
