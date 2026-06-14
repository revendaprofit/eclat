// Acesso ao Supabase com service_role — SOMENTE no servidor (route handlers).
// O browser nunca usa esta chave; leitura no browser é via sessão autenticada (RLS SELECT).

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function sb(path: string, init: RequestInit = {}) {
  return fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY as string,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  })
}
