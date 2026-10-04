import {
  comissaoCentavos, cupomDeParceria, dentroDoHorario, destinoDoAviso, fraseSegundaPeca, inicioDoMes, limparApelido,
  limparNumeroDoVideo, paraCentavos, reais, textoAviso, type ParceriaDoAviso,
} from "../parceria-regras"

const paty: ParceriaDoAviso = { codigo: "PATY10", nome: "Paty Silvério", whatsapp: "5531900000000", comissao_percentual: 5, ativa: true, aceite_avisos: true }

describe("parceria-regras", () => {
  it("comissão de 5% sobre o valor pago, em centavos, meio para cima", () => {
    expect(comissaoCentavos(23310, 5)).toBe(1166) // Solaris com PATY10: R$ 233,10 → R$ 11,66 (11,655)
    expect(comissaoCentavos(28620, 5)).toBe(1431) // conjunto Aurora com PATY10
    expect(comissaoCentavos(0, 5)).toBe(0)
    expect(comissaoCentavos(23310, 0)).toBe(0)
  })

  it("converte o valor do Medusa para centavos", () => {
    expect(paraCentavos(233.1)).toBe(23310)
    expect(paraCentavos({ numeric: 286.2 })).toBe(28620)
    expect(paraCentavos({ value: "271.89" })).toBe(27189)
    expect(paraCentavos(undefined)).toBe(0)
  })

  it("acha o cupom de parceria entre os códigos do pedido (PIX5 e conjunto não são)", () => {
    expect(cupomDeParceria(["PIX5", "paty10"], ["PATY10", "NABELS10"])).toBe("PATY10")
    expect(cupomDeParceria(["PIX5", "CONJUNTO-creg_1"], ["PATY10"])).toBeNull()
    expect(cupomDeParceria([null, undefined], ["PATY10"])).toBeNull()
  })

  it("só avisa parceria ativa, com comissão, com WhatsApp e que aceitou", () => {
    expect(destinoDoAviso(paty)).toBe("avisar")
    expect(destinoDoAviso({ ...paty, aceite_avisos: false })).toBe("dispensado")
    expect(destinoDoAviso({ ...paty, comissao_percentual: 0 })).toBe("dispensado") // NOME20
    expect(destinoDoAviso({ ...paty, ativa: false })).toBe("dispensado")
    expect(destinoDoAviso({ ...paty, whatsapp: null })).toBe("sem_whatsapp")
  })

  it("horário de Brasília: 8h às 21h", () => {
    expect(dentroDoHorario(new Date("2026-10-05T11:00:00Z"))).toBe(true) // 8h
    expect(dentroDoHorario(new Date("2026-10-05T10:59:00Z"))).toBe(false) // 7h59
    expect(dentroDoHorario(new Date("2026-10-05T23:59:00Z"))).toBe(true) // 20h59
    expect(dentroDoHorario(new Date("2026-10-06T00:00:00Z"))).toBe(false) // 21h
    expect(dentroDoHorario(new Date("2026-10-06T02:30:00Z"))).toBe(false) // 23h30
  })

  it("mês corrente começa à meia-noite de Brasília", () => {
    expect(inicioDoMes(new Date("2026-10-05T12:00:00Z"))).toBe("2026-10-01T03:00:00.000Z")
    expect(inicioDoMes(new Date("2026-11-01T02:00:00Z"))).toBe("2026-10-01T03:00:00.000Z") // ainda 31/10 23h em Brasília
  })

  it("progresso para a 2ª peça", () => {
    expect(fraseSegundaPeca(1)).toBe("Faltam 4 vendas para a sua 2ª peça.")
    expect(fraseSegundaPeca(4)).toBe("Falta 1 venda para a sua 2ª peça.")
    expect(fraseSegundaPeca(5)).toContain("2ª peça está liberada")
    expect(fraseSegundaPeca(6)).toBe("")
  })

  it("mensagem: pedido, valor, comissão prevista, mês e progresso — sem dado da cliente", () => {
    const t = textoAviso({
      nome: "Paty Silvério", codigo: "PATY10", displayId: 37, baseCentavos: 23310, comissaoCentavos: 1166,
      vendasNoMes: 2, comissaoNoMesCentavos: 2597, vendasQueContam: 2,
    })
    expect(t).toBe(
      [
        "Oi, Paty! Saiu mais uma venda com o seu cupom PATY10 🎉",
        "Pedido #37 · peças R$ 233,10 · sua comissão prevista R$ 11,66.",
        "No mês: 2 vendas, R$ 25,97 previstos. O repasse é no início do mês que vem.",
        "Faltam 3 vendas para a sua 2ª peça.",
      ].join("\n")
    )
    expect(reais(123456)).toBe("R$ 1.234,56")
  })

  it("apelido e número do vídeo do link", () => {
    expect(limparApelido(" Paty ")).toBe("paty")
    expect(limparApelido("na-bels")).toBe("na-bels")
    expect(limparApelido("../admin")).toBe("")
    expect(limparApelido("a")).toBe("")
    expect(limparNumeroDoVideo("3")).toBe(3)
    expect(limparNumeroDoVideo("0")).toBeNull()
    expect(limparNumeroDoVideo("1000")).toBeNull()
    expect(limparNumeroDoVideo("3x")).toBeNull()
    expect(limparNumeroDoVideo(undefined)).toBeNull()
  })
})
