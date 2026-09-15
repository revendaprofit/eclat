import { getPrevenda, fraseEnvios, frasePagamento } from "@lib/data/prevenda"

// Aviso de pré-venda logo abaixo do botão "Adicionar à sacola" da PDP.
export default async function PrevendaNota() {
  const p = await getPrevenda()
  if (!p.ativa) return null
  return (
    <div
      className="mt-3 rounded-md border border-eclat-pedra/60 bg-eclat-areia/50 px-4 py-3 text-sm text-eclat-grafite leading-relaxed"
      data-testid="prevenda-nota"
    >
      <p className="font-semibold">{fraseEnvios(p)}.</p>
      <p className="text-eclat-grafite/80">
        {frasePagamento(p)}. Você reserva a peça agora e ela sai no primeiro lote.
      </p>
    </div>
  )
}
