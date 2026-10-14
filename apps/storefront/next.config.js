const checkEnvVariables = require("./check-env-variables")

checkEnvVariables()

/**
 * Medusa Cloud-related environment variables
 */
const S3_HOSTNAME = process.env.MEDUSA_CLOUD_S3_HOSTNAME
const S3_PATHNAME = process.env.MEDUSA_CLOUD_S3_PATHNAME
// Storage do site (bucket público `site`); o fallback é o projeto de produção.
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hqphayoyusbzfhyrxjga.supabase.co").replace(/\/$/, "")

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      // Catálogo digital da coleção: página estática em public/catalogo/index.html.
      // O middleware libera /catalogo antes do redirecionamento de região.
      { source: "/catalogo", destination: "/catalogo/index.html" },
      // Link da bio do Instagram (sócia, 2026-10-14: link com o nome da marca, não claude.ai). Página estática
      // em public/links/index.html — a mesma do artifact anterior. O middleware libera /links.
      { source: "/links", destination: "/links/index.html" },
      // Imagens do site pela MESMA origem (2026-10-11, sócia: fotos não carregavam no celular). O
      // navegador do celular deixa de abrir DNS + TLS para *.supabase.co e reaproveita a conexão da
      // página; a Vercel repassa e guarda no cache da borda (Cache-Control vem do Storage, 1 ano).
      // O loader (src/lib/util/image-loader.ts) troca a URL pública do Storage por /midia/<caminho>.
      // (2026-10-11: a Vercel não recebeu o aviso do commit 61b305e e pulou o commit vazio como "não afetado";
      // este comentário existe só para o deploy seguinte enxergar mudança em apps/storefront.)
      { source: "/midia/:path*", destination: `${SUPABASE_URL}/storage/v1/object/public/site/:path*` },
    ]
  },
  async headers() {
    return [
      {
        source: "/midia/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ]
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    // Loader próprio (src/lib/util/image-loader.ts), não o otimizador da Vercel: a cota da Vercel estourou em
    // 2026-09-20 e imagem nova passou a responder 402. Padrão = modo "direto" (arquivo do Storage + variantes
    // .w480/.w960 prontas, custo zero); NEXT_PUBLIC_IMAGENS_MODO=supabase usa o redimensionamento pago do Supabase.
    // Para voltar ao otimizador da Vercel sem mexer em código: IMAGENS_OTIMIZADOR=vercel no ambiente.
    ...(process.env.IMAGENS_OTIMIZADOR === "vercel"
      ? {}
      : { loader: "custom", loaderFile: "./src/lib/util/image-loader.ts" }),
    formats: ["image/avif", "image/webp"],
    // 80 = quality dos cards/PDP (product-card, image-gallery); 50/75 = defaults do Next mantidos
    // como fallback para outros usos de <Image>. Sem isso o Next avisa em build/dev.
    qualities: [50, 75, 80],
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "*.s3.*.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "*.s3.amazonaws.com",
      },
      {
        // imagens do site (Supabase Storage, bucket público 'site')
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        // thumbnail do vídeo de produto (PDP) — img.youtube.com/vi/{id}/hqdefault.jpg
        protocol: "https",
        hostname: "img.youtube.com",
      },
      ...(S3_HOSTNAME && S3_PATHNAME
        ? [
            {
              protocol: "https",
              hostname: S3_HOSTNAME,
              pathname: S3_PATHNAME,
            },
          ]
        : []),
    ],
  },
}

module.exports = nextConfig
