// Cache em memória da cotação (spec §4.5). O passo Entrega dispara um /calculate por opção, e os
// três chegam juntos: guardar a PROMESSA faz as três chamadas dividirem uma só ida à SuperFrete.
export class CacheDeCotacao<T> {
  private readonly entradas = new Map<string, { expira: number; valor: Promise<T> }>()

  constructor(
    private readonly ttlMs: number,
    private readonly agora: () => number = Date.now
  ) {}

  obter(chave: string, produzir: () => Promise<T>): Promise<T> {
    const atual = this.entradas.get(chave)
    if (atual && atual.expira > this.agora()) return atual.valor

    const valor = produzir()
    this.entradas.set(chave, { expira: this.agora() + this.ttlMs, valor })
    // Erro não é resposta: some do cache para a próxima tentativa ir à API de novo.
    valor.catch(() => {
      if (this.entradas.get(chave)?.valor === valor) this.entradas.delete(chave)
    })
    return valor
  }
}
