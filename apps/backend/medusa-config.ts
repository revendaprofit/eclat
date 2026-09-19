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
                pixExpiraMin: process.env.MERCADOPAGO_PIX_EXPIRA_MIN
                  ? Number(process.env.MERCADOPAGO_PIX_EXPIRA_MIN)
                  : 30,
                descricaoFatura: 'USEECLAT',
              },
            },
          ],
        },
      },
    ]
  : []

// E-mail transacional (architecture/email.md): o Notification Module só ganha o provider do
// Resend se a chave existir no ambiente. Sem RESEND_API_KEY o backend sobe normal e o
// subscriber de pedido simplesmente não envia.
const modulosDeNotificacao = process.env.RESEND_API_KEY
  ? [
      {
        resolve: '@medusajs/medusa/notification',
        options: {
          providers: [
            {
              resolve: './src/modules/resend',
              id: 'resend',
              options: {
                channels: ['email'],
                apiKey: process.env.RESEND_API_KEY,
                from: process.env.RESEND_FROM || 'use.ÉCLAT <pedidos@useeclat.com.br>',
                replyTo: process.env.RESEND_REPLY_TO || undefined,
              },
            },
          ],
        },
      },
    ]
  : []

// Frete — spec docs/superpowers/specs/2026-09-18-frete-superfrete-design.md §4.1: o provider da
// SuperFrete só é registrado se o token existir. Ao declarar o módulo de fulfillment à mão, o
// provider manual deixa de vir por padrão — por isso ele é listado junto (pedidos antigos e o modo
// manual do Cockpit dependem dele).
const modulosDeFrete = process.env.SUPERFRETE_TOKEN
  ? [
      {
        resolve: '@medusajs/medusa/fulfillment',
        options: {
          providers: [
            { resolve: '@medusajs/medusa/fulfillment-manual', id: 'manual' },
            { resolve: './src/modules/superfrete', id: 'superfrete' },
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
  modules: [{ resolve: "./src/modules/beneficio-conjunto" }, ...modulosDePagamento, ...modulosDeNotificacao, ...modulosDeFrete],
})
