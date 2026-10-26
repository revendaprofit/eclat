import { CLUBE_APRESENTACAO, CLUBE_BOAS_VINDAS, ehGatilhoDoClube } from "../clube"

describe("resposta automática do Clube (sócia, 26/10/2026)", () => {
  it("é só apresentação e agradecimento: sem link do grupo, sem cupom, sem coleção", () => {
    expect(CLUBE_APRESENTACAO).toMatch(/^Oi! Aqui é a Camila, da ÉCLAT/)
    expect(CLUBE_APRESENTACAO).toContain("Obrigada")
    expect(CLUBE_APRESENTACAO).not.toMatch(/chat\.whatsapp\.com|cupom|CLUBE10|10%|Lumière|useeclat\.com\.br/i)
    expect(CLUBE_BOAS_VINDAS).toBe(CLUBE_APRESENTACAO)
  })
  it("gatilho continua o mesmo (texto do clube ou anúncio)", () => {
    expect(ehGatilhoDoClube("Quero entrar no Clube Éclat", {})).toBe(true)
    expect(ehGatilhoDoClube("oi", { contextInfo: { externalAdReply: {} } })).toBe(true)
    expect(ehGatilhoDoClube("oi, qual o tamanho?", {})).toBe(false)
  })
})
