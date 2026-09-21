// Loader do next/image da vitrine. As imagens do site ficam no Supabase Storage (bucket público `site`);
// em vez do otimizador da Vercel (`/_next/image`), o redimensionamento é feito pelo próprio Supabase
// (`/storage/v1/render/image/public/...`), que devolve WebP já na largura pedida.
// Motivo (2026-09-20): a cota de otimização de imagens da Vercel estourou e toda imagem/tamanho ainda
// não cacheado passou a responder 402 — foto nova simplesmente não carregava (SOP: architecture/catalog.md).
// Imagem de outra origem (arquivo local em /public, thumbnail do YouTube, S3) segue sem transformação.
const PUBLICO = "/storage/v1/object/public/"
const RENDER = "/storage/v1/render/image/public/"
const HOST_SUPABASE = /^https:\/\/[a-z0-9-]+\.supabase\.co\//

export default function eclatImageLoader({ src, width, quality }: { src: string; width: number; quality?: number }): string {
  const i = src.indexOf(PUBLICO)
  if (i === -1 || !HOST_SUPABASE.test(src)) return src
  const [caminho] = src.slice(i + PUBLICO.length).split("?")
  // resize=contain: mantém a proporção da foto inteira (o padrão do Supabase, `cover`, exige altura e cortaria)
  return `${src.slice(0, i)}${RENDER}${caminho}?width=${width}&quality=${quality ?? 75}&resize=contain`
}
