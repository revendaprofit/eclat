// Loja "em construção": única fonte da flag, usada pelo middleware (gate de
// rota) e pelo sitemap. Para reabrir a loja, mude COMING_SOON para false e
// faça o deploy. Em desenvolvimento, `COMING_SOON_BYPASS=1` no processo do
// dev server desliga o gate SÓ naquele processo (a Vercel não tem a variável).
const BYPASS = process.env.NODE_ENV !== "production" && process.env.COMING_SOON_BYPASS === "1"
export const COMING_SOON = !BYPASS
export const COMING_SOON_PATH = "/em-breve"
