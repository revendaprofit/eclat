// Acesso à Medusa Admin API a partir do cockpit (server-side).
// Login programático (jeito mais simples) com token em cache curto.

const URL = process.env.MEDUSA_ADMIN_URL
const EMAIL = process.env.MEDUSA_ADMIN_EMAIL
const PASSWORD = process.env.MEDUSA_ADMIN_PASSWORD

let cachedToken: string | null = null
let tokenAt = 0

export async function medusaAdminToken(): Promise<string> {
  if (cachedToken && Date.now() - tokenAt < 10 * 60 * 1000) return cachedToken
  const r = await fetch(`${URL}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!r.ok) throw new Error(`login Medusa falhou (HTTP ${r.status})`)
  const { token } = await r.json()
  cachedToken = token
  tokenAt = Date.now()
  return token
}

export async function medusaCreateCustomer(input: {
  email: string
  first_name?: string
  last_name?: string
  phone?: string
}): Promise<{ id: string }> {
  const token = await medusaAdminToken()
  const r = await fetch(`${URL}/admin/customers`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!r.ok) throw new Error(`criar cliente falhou (HTTP ${r.status}): ${await r.text()}`)
  const { customer } = await r.json()
  return customer
}
