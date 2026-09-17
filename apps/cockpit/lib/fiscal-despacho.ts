// Decide se o despacho pode prosseguir depois da tentativa de emitir a NF-e de venda (Task 14).
//
// Extraído de app/api/orders/[id]/dispatch/route.ts para o Vitest alcançar. Essa é a regra
// fiscal/legal de maior risco do projeto ("nunca despachar sem nota") — viver só dentro de uma
// route.ts, sem teste (como toda route.ts do Cockpit hoje), deixava um refactor futuro capaz de
// reordenar os blocos (ex.: mover a emissão para depois do fulfillment) e passar despachando sem
// nota, em silêncio, com tsc e os outros testes verdes. Achado da revisão de código.

export type ResultadoEmissao = {
  ok: boolean
  documento?: {
    id: string
    status: string
    chave_acesso: string | null
    numero: number | null
    rejeicao_codigo: string | null
    rejeicao_motivo: string | null
  } | null
  // Interruptor mestre desligado (spec §6.1, Bloco 1 / achados C1+C2): o backend respondeu 200
  // com documento null de propósito — não é erro, é modo seguro. `motivo` vem do backend para
  // mostrar ao operador.
  emissao_desligada?: boolean
  motivo?: string
  error?: string
}

export type DecisaoDespacho =
  | { prosseguir: true; fiscal: { documento_id: string; chave_acesso: string | null; numero: number | null } }
  | { prosseguir: true; fiscal: null; aviso: string }
  | { prosseguir: false; status: number; mensagem: string }

// Falha de emissão ABORTA o despacho: despachar sem nota é pior que não despachar. Nota rejeitada
// ou denegada também aborta, com código e motivo visíveis ao operador. Nunca assume sucesso pela
// simples ausência de erro — exige `documento` presente mesmo quando `ok` é true.
//
// Exceção deliberada: emissão DESLIGADA (emissao_ativa=false, o padrão de fábrica) não é falha —
// é o interruptor mestre da spec fazendo o que ele diz que faz. O despacho prossegue sem nota,
// com aviso visível ao operador (Bloco 1). Isso não afrouxa o caso de emissão LIGADA e falha, que
// continua abortando abaixo.
export function decidirDespacho(r: ResultadoEmissao): DecisaoDespacho {
  if (r.ok && r.emissao_desligada) {
    return {
      prosseguir: true,
      fiscal: null,
      aviso: r.motivo ?? "Emissão fiscal desligada — pedido despachado sem nota.",
    }
  }
  if (!r.ok || !r.documento) {
    return { prosseguir: false, status: 422, mensagem: `NF-e não emitida: ${r.error ?? "erro desconhecido"}` }
  }
  if (r.documento.status === "rejeitado" || r.documento.status === "denegado") {
    return {
      prosseguir: false,
      status: 422,
      mensagem: `NF-e ${r.documento.status}: ${r.documento.rejeicao_motivo ?? "sem motivo informado"} (código ${r.documento.rejeicao_codigo ?? "?"})`,
    }
  }
  return {
    prosseguir: true,
    fiscal: {
      documento_id: r.documento.id,
      chave_acesso: r.documento.chave_acesso,
      numero: r.documento.numero,
    },
  }
}
