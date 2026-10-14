import {
  aniversariaHoje,
  aniversarioPorExtenso,
  candidataAosParabens,
  candidataAPergunta,
  chaveMesDia,
  codigoDoCupom,
  ehCupomDeAniversario,
  interpretarAniversario,
  textoParabens,
} from "../aniversario"

describe("aniversário: interpretar a resposta da cliente", () => {
  it.each([
    ["14/10", { mes: 10, dia: 14, ano: null }],
    ["14-10", { mes: 10, dia: 14, ano: null }],
    ["14.10.1990", { mes: 10, dia: 14, ano: 1990 }],
    ["14/10/90", { mes: 10, dia: 14, ano: 1990 }],
    ["3/2", { mes: 2, dia: 3, ano: null }],
    ["14 de outubro", { mes: 10, dia: 14, ano: null }],
    ["14 de Outubro de 1990", { mes: 10, dia: 14, ano: 1990 }],
    ["dia 14 de março", { mes: 3, dia: 14, ano: null }],
    ["14 out", { mes: 10, dia: 14, ano: null }],
    ["29/02", { mes: 2, dia: 29, ano: null }],
    ["1410", { mes: 10, dia: 14, ano: null }],
    ["meu aniversário é 05/07 💛", { mes: 7, dia: 5, ano: null }],
  ])("%s", (texto, esperado) => {
    expect(interpretarAniversario(texto)).toEqual(esperado)
  })
  it.each(["oi", "obrigada!", "32/10", "14/13", "31/04", "", "amei as peças"])("não é data: %s", (texto) => {
    expect(interpretarAniversario(texto)).toBeNull()
  })
  it("chave e extenso", () => {
    expect(chaveMesDia(10, 14)).toBe("10-14")
    expect(aniversarioPorExtenso("10-14")).toBe("14 de outubro")
    expect(aniversarioPorExtenso("x")).toBe("")
  })
})

describe("aniversário: quem recebe o quê", () => {
  const hoje = { ano: 2026, chave: "10-14" }
  it("aniversaria hoje, com 29/02 caindo em 28/02 fora de bissexto", () => {
    expect(aniversariaHoje("10-14", hoje)).toBe(true)
    expect(aniversariaHoje("10-15", hoje)).toBe(false)
    expect(aniversariaHoje("02-29", { ano: 2027, chave: "02-28" })).toBe(true)
    expect(aniversariaHoje("02-29", { ano: 2028, chave: "02-28" })).toBe(false)
  })
  it("pergunta: uma vez, só para quem não tem a data e tem telefone", () => {
    expect(candidataAPergunta({ id: "c1", email: "a@x.com", metadata: null }, "5531999990000")).toEqual({ telefone: "5531999990000" })
    expect(candidataAPergunta({ id: "c1", email: "a@x.com", metadata: { aniversario: "10-14" } }, "5531999990000")).toEqual({ fora: "ja_tem" })
    expect(candidataAPergunta({ id: "c1", email: "a@x.com", metadata: { aniversario_pedido_em: "2026-10-14" } }, "5531999990000")).toEqual({ fora: "ja_perguntado" })
    expect(candidataAPergunta({ id: "c1", email: "gestor@eclat.local" }, "5531999990000")).toEqual({ fora: "teste" })
    expect(candidataAPergunta({ id: "c1", email: "a@x.com" }, null)).toEqual({ fora: "sem_telefone" })
  })
  it("parabéns: hoje, uma vez por ano", () => {
    expect(candidataAosParabens({ id: "c1", email: "a@x.com", metadata: { aniversario: "10-14" } }, "5531999990000", hoje)).toEqual({ telefone: "5531999990000" })
    expect(candidataAosParabens({ id: "c1", email: "a@x.com", metadata: { aniversario: "10-14", aniversario_parabens: { ano: 2026 } } }, "5531999990000", hoje)).toEqual({ fora: "ja_enviado" })
    expect(candidataAosParabens({ id: "c1", email: "a@x.com", metadata: { aniversario: "10-14", aniversario_parabens: { ano: "2025" } } }, "5531999990000", hoje)).toEqual({ telefone: "5531999990000" })
    expect(candidataAosParabens({ id: "c1", email: "a@x.com", metadata: { aniversario: "03-01" } }, "5531999990000", hoje)).toEqual({ fora: "nao_e_hoje" })
  })
  it("cupom: primeiro nome sem acento + ANIV + ano", () => {
    expect(codigoDoCupom("Andréa Alves", 2026)).toBe("ANDREAANIV26")
    expect(codigoDoCupom(null, 2026)).toBe("CLIENTEANIV26")
    expect(ehCupomDeAniversario("ANDREAANIV26")).toBe(true)
    expect(ehCupomDeAniversario("ANDREA10")).toBe(false)
    expect(textoParabens("Andrea", "ANDREAANIV26")).toContain("ANDREAANIV26")
    expect(textoParabens("Andrea", "ANDREAANIV26")).toContain("Aurora")
  })
})
