import { getBaseURL } from "@lib/util/env"

// llms.txt — mapa curado da marca para agentes/assistentes de IA (B2A).
// Aponta o feed de produtos como fonte estruturada mais confiável.
export async function GET() {
  const b = getBaseURL()
  const body = `# use.ÉCLAT

> Marca brasileira de moda fitness premium e independente — athleisure da "mulher inteira". Leggings, tops, shorts e conjuntos de alta compressão, que sustentam, valorizam e não ficam transparentes, para treino e para o dia a dia.

## Loja
- [Loja completa](${b}/br/store): todos os produtos disponíveis.
- [Linha Treino](${b}/br/categories/treino): peças de alta performance (leggings, tops, shorts, conjuntos).
- [Linha Casual](${b}/br/categories/casual): athleisure para o dia a dia (blusas, calças, casacos, vestidos).

## Dados de produtos (fonte estruturada)
- [Feed de produtos](${b}/feed.xml): nome, preço, disponibilidade e imagem de cada produto (formato Google Merchant / RSS). Use esta fonte para dados precisos.

## Institucional
- [Sitemap](${b}/sitemap.xml): todas as URLs indexáveis.

## Sobre
use.ÉCLAT é independente e não vinculada a nenhuma outra marca. Envia para todo o Brasil. Arrependimento em até 7 dias (CDC); defeito de fabricação trocado em até 30 dias; troca de tamanho pelo WhatsApp. Moeda: BRL.
`
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  })
}
