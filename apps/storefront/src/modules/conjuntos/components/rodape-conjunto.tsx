"use client"

import { Button } from "@modules/common/components/ui"
import { descricaoRegra, formatarReais, type RegraStore } from "@lib/util/conjuntos"

// Rodapé de compra do conjunto (spec §7.2, ruling 4): preço cheio riscado + total com benefício,
// texto da regra e o botão "Adicionar o conjunto". Fixo (rodapé) no mobile, painel lateral
// `sticky` no desktop — mesmo conteúdo nos dois, só a moldura muda (mesmo padrão de
// `ProductActions`/`MobileActions` na PDP, mas num componente só em vez de dois).
export default function RodapeConjunto({
  nome,
  precoCheio,
  precoComBeneficio,
  regra,
  numPecas,
  disabled,
  isAdding,
  erro,
  onAdicionar,
}: {
  nome: string
  precoCheio: number
  precoComBeneficio: number
  regra: RegraStore
  numPecas: number
  disabled: boolean
  isAdding: boolean
  erro: string | null
  onAdicionar: () => void
}) {
  const conteudo = (
    <>
      <div className="flex items-baseline gap-x-2 flex-wrap">
        <span className="line-through text-eclat-grafite/50 text-sm" data-testid="rodape-conjunto-preco-cheio">
          {formatarReais(precoCheio)}
        </span>
        <span className="text-eclat-terracota text-xl font-medium" data-testid="rodape-conjunto-preco-beneficio">
          {formatarReais(precoComBeneficio)}
        </span>
      </div>
      <p className="text-xs text-eclat-grafite/70">{descricaoRegra(regra, numPecas)}</p>
      {erro && (
        <p className="text-xs text-red-600" role="alert" data-testid="rodape-conjunto-erro">
          {erro}
        </p>
      )}
      <Button
        onClick={onAdicionar}
        disabled={disabled || isAdding}
        isLoading={isAdding}
        variant="primary"
        className="w-full h-11"
        data-testid="adicionar-conjunto-button"
      >
        Adicionar o conjunto
      </Button>
    </>
  )

  return (
    <>
      {/* desktop: painel lateral, acompanha o scroll das peças */}
      <div
        className="hidden small:flex small:sticky small:top-48 small:flex-col small:w-[300px] small:shrink-0 gap-y-4 border border-ui-border-base rounded-large p-6 h-fit"
        data-testid="rodape-conjunto-desktop"
      >
        <h2 className="font-serif text-lg text-eclat-grafite">{nome}</h2>
        {conteudo}
      </div>
      {/* mobile: rodapé fixo */}
      <div
        className="small:hidden fixed inset-x-0 bottom-0 z-40 bg-white border-t border-gray-200 p-4 flex flex-col gap-y-2"
        data-testid="rodape-conjunto-mobile"
      >
        {conteudo}
      </div>
    </>
  )
}
