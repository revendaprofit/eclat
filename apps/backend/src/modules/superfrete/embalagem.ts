// Qual embalagem um carrinho usa (spec §4.3, decisão 6 do dono em 2026-09-18).
// Medidas em cm, peso em gramas até a saída (a SuperFrete quer kg).
export type ItemParaEmbalagem = { quantidade: number; peso_g?: number | null }
export type Pacote = { pecas: number; largura: number; altura: number; comprimento: number; peso_kg: number }

const PESO_PADRAO_G = 300 // peça sem peso cadastrado (margem de segurança: a peça mais pesada é o macaquinho, 222 g)
// Pesados pelo dono em 2026-09-19: saquinho 50 g (1 ou 2 peças), caixa 115 g (3 peças ou mais).
const SAQUINHO_G = 50
const CAIXA_G = 115
// Mini Envios (SuperFrete/Correios): até 0,3 kg, altura 1–4, largura 10–16, comprimento 15–24.
const MINI = { peso_g: 300, altura: 4, largura: [10, 16], comprimento: [15, 24] } as const

export function montarPacote(itens: ItemParaEmbalagem[]): Pacote {
  const pecas = itens.reduce((n, i) => n + i.quantidade, 0)
  if (pecas <= 0) throw new Error("Carrinho sem peças: não há o que embalar.")
  const pesoPecas = itens.reduce((g, i) => g + i.quantidade * (i.peso_g || PESO_PADRAO_G), 0)

  if (pecas === 1) {
    const total = pesoPecas + SAQUINHO_G
    // O saquinho P é flexível: com uma peça leve fecha em 4 cm (o que habilita o Mini Envios).
    return { pecas, largura: 15, altura: total <= MINI.peso_g ? 4 : 5, comprimento: 15, peso_kg: total / 1000 }
  }
  if (pecas === 2) {
    return { pecas, largura: 20, altura: 5, comprimento: 20, peso_kg: (pesoPecas + SAQUINHO_G) / 1000 }
  }
  return { pecas, largura: 25, altura: 10, comprimento: 20, peso_kg: (pesoPecas + CAIXA_G) / 1000 }
}

export function cabeNoMiniEnvios(p: Pacote): boolean {
  return (
    p.peso_kg * 1000 <= MINI.peso_g &&
    p.altura <= MINI.altura &&
    p.largura >= MINI.largura[0] &&
    p.largura <= MINI.largura[1] &&
    p.comprimento >= MINI.comprimento[0] &&
    p.comprimento <= MINI.comprimento[1]
  )
}
