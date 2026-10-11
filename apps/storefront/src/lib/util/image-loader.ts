// Loader do next/image da vitrine. As imagens do site ficam no Supabase Storage (bucket público `site`).
// Motivo (2026-09-20): a cota de otimização de imagens da Vercel estourou e toda imagem/tamanho ainda
// não cacheado passou a responder 402 — foto nova simplesmente não carregava (SOP: architecture/catalog.md).
//
// Dois modos, escolhidos por NEXT_PUBLIC_IMAGENS_MODO:
// - "direto" (PADRÃO, custo zero — pedido da sócia, 2026-09-21): o arquivo sai direto do Storage, sem
//   transformação paga em lugar nenhum. As fotos de produto subidas pelos scripts (`products/<handle>/
//   <nome>-<hash8>.jpg`) têm versões leves já prontas ao lado do original (`.w480.jpg` e `.w960.jpg`,
//   geradas por scripts/gerar-variantes-fotos.py); o loader escolhe a menor que cobre a largura pedida.
//   Desde 2026-10-10 vale também para `detalhes-pecas/<handle>/<nome>-<hash8>.jpg` (capas e recortes da peça).
//   Qualquer outra imagem (upload do Cockpit, banners, categorias) sai no original.
// - "supabase": redimensionamento pelo próprio Supabase (`/storage/v1/render/image/public/...`), que
//   devolve a largura exata, mas é cobrado por imagem de origem acima da franquia do plano.
// Imagem de outra origem (arquivo local em /public, thumbnail do YouTube, S3) passa sempre sem mexer.
const PUBLICO = "/storage/v1/object/public/"
const RENDER = "/storage/v1/render/image/public/"
const HOST_SUPABASE = /^https:\/\/[a-z0-9-]+\.supabase\.co\//
// Só estas têm variantes garantidas: fotos de produto com o hash de 8 dígitos que os scripts põem no nome.
const COM_VARIANTES = /\/site\/(?:products|detalhes-pecas)\/[^/?]+\/[^/?]+-[0-9a-f]{8}\.jpg$/
export const LARGURAS_VARIANTES = [480, 960] as const

const MESMA_ORIGEM = process.env.NEXT_PUBLIC_IMAGENS_ORIGEM !== "storage"

export type ModoImagens = "direto" | "supabase"
type Entrada = { src: string; width: number; quality?: number }

export function urlDaImagem({ src, width, quality }: Entrada, modo: ModoImagens): string {
  const i = src.indexOf(PUBLICO)
  if (i === -1 || !HOST_SUPABASE.test(src)) return src
  const [semQuery] = src.split("?")
  if (modo === "supabase") {
    // resize=contain: mantém a proporção da foto inteira (o padrão do Supabase, `cover`, exige altura e cortaria)
    return `${semQuery.slice(0, i)}${RENDER}${semQuery.slice(i + PUBLICO.length)}?width=${width}&quality=${quality ?? 75}&resize=contain`
  }
  // Mesma origem (2026-10-11): /midia/<caminho> é reescrito pelo next.config.js para o Storage. No celular,
  // abrir outra origem (DNS + TLS de *.supabase.co) era o que segurava as fotos; pela origem do site a
  // conexão da página é reaproveitada e a Vercel guarda a resposta na borda. NEXT_PUBLIC_IMAGENS_ORIGEM=storage
  // volta a apontar direto para o Storage.
  const caminho = semQuery.slice(i + PUBLICO.length)           // "site/products/..."
  const base = MESMA_ORIGEM && caminho.startsWith("site/") ? `/midia/${caminho.slice("site/".length)}` : semQuery
  if (!COM_VARIANTES.test(semQuery)) return base
  const largura = LARGURAS_VARIANTES.find((l) => l >= width)
  return largura ? base.replace(/\.jpg$/, `.w${largura}.jpg`) : base
}

const MODO: ModoImagens = process.env.NEXT_PUBLIC_IMAGENS_MODO === "supabase" ? "supabase" : "direto"

export default function eclatImageLoader(entrada: Entrada): string {
  return urlDaImagem(entrada, MODO)
}
