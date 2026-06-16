import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

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
})
