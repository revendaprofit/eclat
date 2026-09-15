// Loja "em construção": única fonte da flag, usada pelo middleware (gate de
// rota) e pelo sitemap.
//
// Controlada pela env `COMING_SOON` (lida em tempo de execução pela função
// serverless/edge — não precisa de código novo nem push para trocar):
//   - Não definida, ou "true"  → gate LIGADO (comportamento padrão, mais seguro).
//   - "false"                 → gate DESLIGADO, loja pública para todo mundo.
// Trocar na Vercel: Project → Settings → Environment Variables → COMING_SOON
// (Production) → depois "Redeploy" o último deployment (o valor só é lido no
// build/boot da função — mudar a env sem redeploy não tem efeito).
// Em desenvolvimento local, `COMING_SOON_BYPASS=1` no processo do dev server
// desliga o gate SÓ naquele processo, sem mexer na env de produção.
const BYPASS = process.env.NODE_ENV !== "production" && process.env.COMING_SOON_BYPASS === "1"
export const COMING_SOON = process.env.COMING_SOON === "false" ? false : !BYPASS
export const COMING_SOON_PATH = "/em-breve"

// Porta VIP (Clube Éclat): quem abre /clube?k=<chave> — ou digita a chave no campo
// "Tenho convite" da página Em breve — ganha o cookie abaixo e enxerga a loja mesmo
// com o gate ligado (acesso antecipado do lançamento). A comparação ignora
// maiúsculas/minúsculas e espaços nas pontas (teclado de celular capitaliza).
// A chave pode ser trocada por env (COMING_SOON_VIP_KEY) sem deploy de código.
export const VIP_PATH = "/clube"
export const VIP_COOKIE = "eclat_vip"
export const VIP_KEY = process.env.COMING_SOON_VIP_KEY || "brilha01"
export const VIP_INVALID_PARAM = "convite" // /em-breve?convite=invalido → mensagem de erro no campo
export function isVipKey(value: string | null | undefined): boolean {
  return (value ?? "").trim().toLowerCase() === VIP_KEY.trim().toLowerCase()
}
export const VIP_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 dias
