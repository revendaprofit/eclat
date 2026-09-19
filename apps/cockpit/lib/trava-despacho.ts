// Trava de despacho — evita que dois cliques (ou duas requisições concorrentes, ex.: duas abas) no
// mesmo pedido rodem o despacho ao mesmo tempo. Cobre a rota INTEIRA (conferência + emissão de NF-e
// + compra da etiqueta), não só a compra: uma checagem feita cedo mas só lida bem depois (ex.: um
// `Set.has` num bloco que só roda minutos de código async depois) deixa uma janela de segundos —
// tempo de sobra para um segundo clique passar pela mesma checagem antes da primeira trava ser
// gravada. Por isso a checagem e a gravação da trava aqui são SÍNCRONAS (sem `await` entre elas):
// a segunda chamada, não importa quando chegue, sempre vê a trava que a primeira acabou de gravar.
const emAndamento = new Set<string>()

export class DespachoEmAndamento extends Error {
  constructor() {
    super("Este pedido já está sendo despachado em outra aba ou por outra pessoa. Aguarde terminar e atualize a página.")
    this.name = "DespachoEmAndamento"
  }
}

// Executa `fn` sob a trava de `chave`. Se já houver uma execução em andamento para essa chave,
// rejeita IMEDIATAMENTE com DespachoEmAndamento — `fn` nem chega a ser chamada. A trava é liberada
// no `finally`, com sucesso ou erro, então uma falha nunca deixa o pedido travado para sempre.
//
// Cobre só esta instância do processo (um `Set` em memória, por servidor). Duas instâncias do
// Cockpit rodando ao mesmo tempo não se veem — nesse caso quem protege o dinheiro é a regra 3 de
// `garantirEtiqueta` (lib/etiqueta-segura.ts), alimentada por uma leitura fresca do pedido (ver
// app/api/orders/[id]/dispatch/route.ts).
export async function executarComTrava<T>(chave: string, fn: () => Promise<T>): Promise<T> {
  if (emAndamento.has(chave)) throw new DespachoEmAndamento()
  emAndamento.add(chave)
  try {
    return await fn()
  } finally {
    emAndamento.delete(chave)
  }
}
