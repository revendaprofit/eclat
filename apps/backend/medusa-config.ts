import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

// Pagamento — Parte 4 (docs/superpowers/specs/2026-09-17-pagamento-mercadopago-design.md §4):
// o provider só é registrado se a credencial existir no ambiente. Deploy sem
// MERCADOPAGO_ACCESS_TOKEN não quebra o backend — o checkout segue com o provider manual.
const modulosDePagamento = process.env.MERCADOPAGO_ACCESS_TOKEN
  ? [
      {
        resolve: '@medusajs/medusa/payment',
        options: {
          providers: [
            {
              resolve: './src/modules/mercadopago',
              id: 'mercadopago',
              options: {
                accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
                webhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET,
                maxParcelas: process.env.MERCADOPAGO_MAX_PARCELAS
                  ? Number(process.env.MERCADOPAGO_MAX_PARCELAS)
                  : 4,
                descricaoFatura: 'USEECLAT',
              },
            },
          ],
        },
      },
    ]
  : []

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    }
  },
  // Em produção (Railway), desabilita o BUILD do painel admin (Vite) — pesado demais
  // p/ o builder. A Store/Admin API seguem normais; o Cockpit usa a Admin API.
  // Local continua com admin (DISABLE_ADMIN não definido).
  admin: {
    disable: process.env.DISABLE_ADMIN === "true",
  },
  modules: [{ resolve: "./src/modules/beneficio-conjunto" }, ...modulosDePagamento],
})
