const checkEnvVariables = require("./check-env-variables")

checkEnvVariables()

/**
 * Medusa Cloud-related environment variables
 */
const S3_HOSTNAME = process.env.MEDUSA_CLOUD_S3_HOSTNAME
const S3_PATHNAME = process.env.MEDUSA_CLOUD_S3_PATHNAME

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
    // Redimensionamento pelo Supabase (src/lib/util/image-loader.ts), não pelo otimizador da Vercel:
    // a cota da Vercel estourou em 2026-09-20 e imagem nova passou a responder 402.
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
