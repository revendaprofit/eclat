// URL pública canônica do site. Ordem: env explícita > domínio de produção
// do projeto na Vercel > localhost (dev). Sem barra final.
export const getBaseURL = () => {
  const explicit = process.env.NEXT_PUBLIC_BASE_URL
  if (explicit) {
    return explicit.replace(/\/$/, "")
  }
  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (vercelProd) {
    return `https://${vercelProd}`
  }
  return "http://localhost:8000"
}
