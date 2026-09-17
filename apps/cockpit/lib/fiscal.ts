// Rótulos e cores dos status de documento fiscal (spec §9).

export type StatusDocumento =
  | "montado"
  | "transmitido_sem_confirmacao"
  | "autorizado_nao_verificado"
  | "verificado"
  | "rejeitado"
  | "denegado"
  | "em_contingencia"

const ROTULOS: Record<StatusDocumento, string> = {
  montado: "Montado",
  transmitido_sem_confirmacao: "Transmitido sem confirmação",
  autorizado_nao_verificado: "Autorizado (aguardando XML)",
  verificado: "Verificado",
  rejeitado: "Rejeitado",
  denegado: "Denegado",
  em_contingencia: "Em contingência",
}

export function rotuloStatus(status: StatusDocumento): string {
  return ROTULOS[status] ?? String(status)
}

// Só documento reconciliado pode ser referenciado numa NFD (spec §7.3).
export function statusBloqueiaDevolucao(status: StatusDocumento): boolean {
  return status !== "verificado"
}

export function corDoStatus(status: StatusDocumento): "verde" | "amarelo" | "vermelho" {
  if (status === "verificado") return "verde"
  if (status === "rejeitado" || status === "denegado") return "vermelho"
  return "amarelo"
}
