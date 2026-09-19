// F0 da spec 2026-09-18-frete-superfrete-design.md — sonda da cotação da SuperFrete.
// Ambiente: SUPERFRETE_SANDBOX=true usa o sandbox; qualquer outro valor usa a API real (decisão do dono em
// 2026-09-18: sem conta sandbox). Cotar é só consulta: não gera etiqueta e não gasta saldo.
// Não grava nada: só chama o calculator e imprime o que volta. Responde duas perguntas:
//  1) o formato da resposta (id, price, delivery_range, has_error) é o que a spec assume?
//  2) medidas abaixo do mínimo dos Correios (16x4x24 p/ PAC/SEDEX) são aceitas ou recusadas?
//
//   node --env-file=.env f0-superfrete.mjs <cep-origem> <cep-destino>
const TOKEN = process.env.SUPERFRETE_TOKEN
const CONTATO = process.env.SUPERFRETE_CONTACT_EMAIL
const BASE = process.env.SUPERFRETE_SANDBOX === "true" ? "https://sandbox.superfrete.com" : "https://api.superfrete.com"
const [origem, destino] = process.argv.slice(2)
if (!TOKEN || !CONTATO || !origem || !destino) {
  console.error("✗ defina SUPERFRETE_TOKEN e SUPERFRETE_CONTACT_EMAIL no .env e passe <cep-origem> <cep-destino>.")
  process.exit(1)
}
const pacotes = {
  "1 peça (15x15x4, 0.21 kg)": { width: 15, height: 4, length: 15, weight: 0.21 },
  "2 peças (20x20x5, 0.51 kg)": { width: 20, height: 5, length: 20, weight: 0.51 },
  "caixa (25x10x20, 0.95 kg)": { width: 25, height: 10, length: 20, weight: 0.95 },
}
for (const [nome, pacote] of Object.entries(pacotes)) {
  const r = await fetch(`${BASE}/api/v0/calculator`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "User-Agent": `use.ECLAT (${CONTATO})`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      from: { postal_code: origem },
      to: { postal_code: destino },
      services: "1,2,17",
      options: { own_hand: false, receipt: false, insurance_value: 0, use_insurance_value: false },
      package: pacote,
    }),
  })
  console.log(`\n=== ${nome} → HTTP ${r.status}`)
  console.log(JSON.stringify(await r.json().catch(() => null), null, 2))
}
