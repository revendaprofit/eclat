import { EvolutionHttpError } from "../evolution"

// `numeroInexistente` decide se uma recusa da Evolution é PERMANENTE e só daquela cliente (número
// sem WhatsApp) ou uma falha que atinge todas — errar para "permanente" faria um aviso sumir em
// silêncio. Por isso cada forma estranha de corpo precisa dar `false`.
const erro = (status: number, corpo: string) => new EvolutionHttpError(`Evolution sendText falhou: ${status}`, status, corpo)

describe("EvolutionHttpError.numeroInexistente", () => {
  it("verdadeiro no formato real da Evolution v2: 400 com response.message[].exists === false", () => {
    const corpo = JSON.stringify({ status: 400, error: "Bad Request", response: { message: [{ exists: false, jid: "000@s.whatsapp.net", number: "000" }] } })
    expect(erro(400, corpo).numeroInexistente).toBe(true)
  })

  it("verdadeiro também quando a lista vem direto em message[]", () => {
    expect(erro(400, JSON.stringify({ message: [{ exists: false }] })).numeroInexistente).toBe(true)
  })

  it("falso com status diferente de 400, mesmo com exists: false no corpo", () => {
    const corpo = JSON.stringify({ response: { message: [{ exists: false }] } })
    for (const status of [401, 403, 404, 429, 500, 503]) {
      expect(erro(status, corpo).numeroInexistente).toBe(false)
    }
  })

  it("falso com corpo vazio, não-JSON ou null", () => {
    expect(erro(400, "").numeroInexistente).toBe(false)
    expect(erro(400, "<html>Bad Gateway</html>").numeroInexistente).toBe(false)
    expect(erro(400, "null").numeroInexistente).toBe(false)
    expect(new EvolutionHttpError("x", 400).numeroInexistente).toBe(false)
  })

  it("falso quando message não é lista ou não traz exists: false", () => {
    expect(erro(400, JSON.stringify({ response: { message: "Connection Closed" } })).numeroInexistente).toBe(false)
    expect(erro(400, JSON.stringify({ response: { message: { exists: false } } })).numeroInexistente).toBe(false)
    expect(erro(400, JSON.stringify({ response: { message: ["Connection Closed"] } })).numeroInexistente).toBe(false)
    expect(erro(400, JSON.stringify({ response: { message: [{ exists: true }] } })).numeroInexistente).toBe(false)
    expect(erro(400, JSON.stringify({ response: { message: [null, { exists: "false" }] } })).numeroInexistente).toBe(false)
  })

  it("o corpo não aparece ao serializar nem ao espalhar o erro (ecoa o número da cliente)", () => {
    const e = erro(400, JSON.stringify({ response: { message: [{ exists: false, number: "NUMERO-SECRETO" }] } }))
    expect(JSON.stringify(e)).not.toContain("NUMERO-SECRETO")
    expect(JSON.stringify({ ...e })).not.toContain("NUMERO-SECRETO")
  })
})
