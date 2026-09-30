"use client"

import { Button } from "@modules/common/components/ui"
import { descricaoRegra, formatarReais, fraseEconomia, type RegraStore } from "@lib/util/conjuntos"
import { CONDICOES_PADRAO, fraseCartao, linhaParcelamento, linhaPix, reais, type Condicoes } from "@lib/util/condicoes"

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
  pendente = null,
  condicoes = CONDICOES_PADRAO,
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
  // Peça que ainda está sem tamanho (diagnóstico 2026-09-25): no celular o seletor do short ficava
  // a ~1.760 px de rolagem e o botão ficava cinza sem dizer por quê. Com pendente, o botão diz o que
  // falta e rola até a peça.
  pendente?: { indice: number; titulo: string } | null
  // Condições da loja (site_content "condicoes"): parcela e Pix só aparecem quando ligadas.
  condicoes?: Condicoes
}) {
  const pix = linhaPix(precoComBeneficio, condicoes, (c) => reais(c))
  const parcela = linhaParcelamento(precoComBeneficio, condicoes, (c) => reais(c))
  const irParaPendente = () => {
    if (!pendente) return
    document
      .getElementById(`peca-conjunto-${pendente.indice}-selecao`)
      ?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "center",
      })
  }
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
      <p className="text-xs text-eclat-grafite/70" data-testid="rodape-conjunto-regra">
        {fraseEconomia(precoCheio, precoComBeneficio) ?? descricaoRegra(regra, numPecas)}
      </p>
      {pix && (
        <p className="text-sm font-medium text-eclat-terracota" data-testid="rodape-conjunto-pix">
          {pix}
        </p>
      )}
      <p className="text-[11px] text-eclat-grafite/60" data-testid="rodape-conjunto-pagamento">
        {parcela ? `ou ${parcela}` : fraseCartao(condicoes)} · envio para todo o Brasil
      </p>
      {erro && (
        <p className="text-xs text-red-600" role="alert" data-testid="rodape-conjunto-erro">
          {erro}
        </p>
      )}
      {pendente && !isAdding ? (
        <Button
          onClick={irParaPendente}
          variant="secondary"
          className="w-full h-11"
          data-testid="escolher-tamanho-conjunto-button"
        >
          Escolher tamanho: {pendente.titulo}
        </Button>
      ) : (
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
      )}
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
