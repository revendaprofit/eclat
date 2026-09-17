import { describe, it, expect } from "vitest"
import { normalizarCep, cepValido, urlProvedorCep, parseRespostaCep } from "./cep"

describe("normalizarCep", () => {
  it("tira máscara e espaços", () => {
    expect(normalizarCep("32604-182")).toBe("32604182")
    expect(normalizarCep(" 32604 182 ")).toBe("32604182")
  })
})

describe("cepValido", () => {
  it("aceita 8 dígitos", () => {
    expect(cepValido("32604182")).toBe(true)
    expect(cepValido("32604-182")).toBe(true)
  })

  it("rejeita tamanho errado, vazio e lixo", () => {
    expect(cepValido("3260418")).toBe(false)
    expect(cepValido("326041820")).toBe(false)
    expect(cepValido("")).toBe(false)
    expect(cepValido("abcdefgh")).toBe(false)
  })
})

describe("urlProvedorCep", () => {
  it("monta a URL com o CEP normalizado", () => {
    expect(urlProvedorCep("32604-182")).toBe("https://viacep.com.br/ws/32604182/json/")
  })
})

describe("parseRespostaCep", () => {
  const respostaReal = {
    cep: "32604-182",
    logradouro: "Rua Norte",
    complemento: "",
    bairro: "Angola",
    localidade: "Betim",
    uf: "MG",
    ibge: "3106705",
  }

  it("mapeia a resposta real para a nossa forma", () => {
    expect(parseRespostaCep(respostaReal)).toEqual({
      logradouro: "Rua Norte",
      bairro: "Angola",
      cidade: "Betim",
      uf: "MG",
      ibge: "3106705",
    })
  })

  it("devolve null quando o provedor sinaliza CEP inexistente", () => {
    // O ViaCEP responde HTTP 200 com { erro: true } — não um status de erro.
    // Quem olha só o status acha que deu certo e preenche o endereço com campos vazios.
    expect(parseRespostaCep({ erro: true })).toBeNull()
    expect(parseRespostaCep({ erro: "true" })).toBeNull()
  })

  it("devolve null quando falta o ibge, que é o campo que a nota exige", () => {
    const { ibge: _ibge, ...semIbge } = respostaReal
    expect(parseRespostaCep(semIbge)).toBeNull()
  })

  it("devolve null quando o ibge não tem 7 dígitos", () => {
    expect(parseRespostaCep({ ...respostaReal, ibge: "310670" })).toBeNull()
    expect(parseRespostaCep({ ...respostaReal, ibge: "" })).toBeNull()
  })

  it("devolve null para entrada que não é objeto", () => {
    expect(parseRespostaCep(null)).toBeNull()
    expect(parseRespostaCep("texto")).toBeNull()
    expect(parseRespostaCep(undefined)).toBeNull()
  })

  it("aceita logradouro e bairro vazios — CEP de cidade inteira ainda serve", () => {
    const geral = { ...respostaReal, logradouro: "", bairro: "" }
    expect(parseRespostaCep(geral)).toEqual({
      logradouro: "",
      bairro: "",
      cidade: "Betim",
      uf: "MG",
      ibge: "3106705",
    })
  })
})
