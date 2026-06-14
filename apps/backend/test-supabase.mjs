// Teste de conexão com o Supabase (sem dependências — usa fetch nativo do Node 18+).
// Uso: a partir de eclat/apps/backend ->  node --env-file=.env test-supabase.mjs
// Valida que o projeto responde e que as chaves anon/service_role autenticam.
// NÃO cria nem lê tabelas de negócio (Fundação: apenas "conexão testável").
//
// Obs.: o endpoint raiz /rest/v1/ só aceita a service_role; a anon é validada
// no endpoint público /auth/v1/settings (comportamento atual do Supabase).

const url = process.env.SUPABASE_URL?.replace(/\/$/, "")
const anon = process.env.SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY

let ok = true

async function check(label, endpoint, key) {
  if (!key) {
    console.log(`- ${label}: (chave ausente, pulado)`)
    return
  }
  try {
    const res = await fetch(`${url}${endpoint}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    if (res.status === 200) {
      console.log(`✓ ${label}: conexão OK (HTTP 200 em ${endpoint})`)
    } else {
      ok = false
      console.error(`✗ ${label}: HTTP ${res.status} em ${endpoint} — verifique a chave`)
    }
  } catch (e) {
    ok = false
    console.error(`✗ ${label}: falha de rede — ${e.message}`)
  }
}

if (!url) {
  console.error("✗ SUPABASE_URL não definido no .env")
  process.exitCode = 1
} else {
  console.log(`Testando Supabase em: ${url}`)
  await check("anon key", "/auth/v1/settings", anon)
  await check("service_role key", "/rest/v1/", service)
  if (ok) {
    console.log("✓ Supabase acessível. (Nenhuma tabela criada/lida — apenas conectividade.)")
  } else {
    process.exitCode = 1
  }
}
