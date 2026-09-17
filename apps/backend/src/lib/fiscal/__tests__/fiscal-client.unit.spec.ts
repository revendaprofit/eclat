// Formato das respostas: SDK oficial brasilnfe@3.1.3 — NotaFiscalRetorno, BuscarNotaFiscalRetorno,
// PreVisualizarNotaFiscalRetorno; ObterArquivoNotaFiscal devolve uma string JSON em base64.

import { interpretarResposta } from "../fiscal-client"
import { ErroFiscal } from "../tipos"

const CHAVE = "31260968673407000113550010000000011000000017"
const XML = `<nfeProc><NFe><infNFe Id="NFe${CHAVE}"><det nItem="1"><prod><cProd>TOP-P</cProd><NCM>61091000</NCM></prod></det></infNFe></NFe></nfeProc>`
const XML_B64 = Buffer.from(XML, "utf8").toString("base64")

function autorizada(over: Record<string, unknown> = {}) {
  return {
    ReturnNF: {
      Numero: 7, Serie: 1, ChaveNF: CHAVE, NumeroProtocolo: "131260000000001",
      CodTipoAmbiente: 2, DsTipoAmbiente: "Homologação",
      CodStatusRespostaSefaz: 100, DsStatusRespostaSefaz: "Autorizado o uso da NF-e", Ok: true,
      ...over,
    },
    Base64Xml: XML_B64,
    Base64File: "JVBERi0xLjQK",
  }
}

describe("interpretarResposta", () => {
  it("Ok + 100 é autorizado, com chave, número, série e XML decodificado", () => {
    const r = interpretarResposta(autorizada(), 2)
    expect(r.desfecho).toBe("autorizado")
    expect(r.chave_acesso).toBe(CHAVE)
    expect(r.numero).toBe(7)
    expect(r.serie).toBe(1)
    expect(r.codigo_sefaz).toBe("100")
    expect(r.xml).toBe(XML)
    expect(r.ambiente_divergente).toBe(false)
  })

  it("150 (autorizado fora do prazo) também é autorizado", () => {
    expect(interpretarResposta(autorizada({ CodStatusRespostaSefaz: 150 }), 2).desfecho).toBe("autorizado")
  })

  it("rejeição da SEFAZ: Ok false + código de rejeição", () => {
    const r = interpretarResposta(
      { ReturnNF: { Ok: false, CodStatusRespostaSefaz: 225, DsStatusRespostaSefaz: "Falha no Schema XML" } }, 2
    )
    expect(r.desfecho).toBe("rejeitado")
    expect(r.codigo_sefaz).toBe("225")
    expect(r.motivo).toBe("Falha no Schema XML")
    expect(r.chave_acesso).toBeNull()
  })

  it("códigos de denegação viram denegado", () => {
    for (const cod of [110, 301, 302, 303]) {
      const r = interpretarResposta({ ReturnNF: { Ok: false, CodStatusRespostaSefaz: cod, DsStatusRespostaSefaz: "Uso denegado" } }, 2)
      expect(r.desfecho).toBe("denegado")
    }
  })

  it("erro de validação do fornecedor (sem ReturnNF, com Error) é rejeitado — não chegou à SEFAZ", () => {
    const r = interpretarResposta({ Error: "NCM inválido no item 1" }, 2)
    expect(r.desfecho).toBe("rejeitado")
    expect(r.motivo).toBe("NCM inválido no item 1")
    expect(r.codigo_sefaz).toBeNull()
  })

  it("INCOERÊNCIA nunca é adivinhada: Ok true com código de rejeição é indefinido", () => {
    expect(interpretarResposta(autorizada({ CodStatusRespostaSefaz: 225 }), 2).desfecho).toBe("indefinido")
  })

  it("INCOERÊNCIA: Ok false com código 100 é indefinido", () => {
    expect(interpretarResposta(autorizada({ Ok: false }), 2).desfecho).toBe("indefinido")
  })

  it("autorizado sem chave de 44 dígitos é indefinido", () => {
    expect(interpretarResposta(autorizada({ ChaveNF: "123" }), 2).desfecho).toBe("indefinido")
  })

  it("resposta vazia ou sem ReturnNF e sem Error é indefinido", () => {
    expect(interpretarResposta({}, 2).desfecho).toBe("indefinido")
    expect(interpretarResposta({ Avisos: ["x"] }, 2).desfecho).toBe("indefinido")
  })

  it("O BUG DA REVISÃO 1: o formato antigo (status na raiz) NÃO é reconhecido como autorizado", () => {
    const r = interpretarResposta({ status: "autorizado", chave: CHAVE, numero: 1 }, 2)
    expect(r.desfecho).toBe("indefinido")
  })

  it("sinaliza ambiente divergente: esperávamos homologação (2), veio produção (1)", () => {
    const r = interpretarResposta(autorizada({ CodTipoAmbiente: 1 }), 2)
    expect(r.desfecho).toBe("autorizado")
    expect(r.ambiente_divergente).toBe(true)
  })

  it("o bruto guardado NÃO carrega os base64 (XML tem coluna própria; PDF é reobtido)", () => {
    const r = interpretarResposta(autorizada(), 2)
    expect(r.bruto).not.toHaveProperty("Base64Xml")
    expect(r.bruto).not.toHaveProperty("Base64File")
    expect((r.bruto as any).ReturnNF.ChaveNF).toBe(CHAVE)
  })
})

describe("fiscal-client — HTTP", () => {
  const OLD = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...OLD, BRASILNFE_USER_TOKEN: "user-token", BRASILNFE_COMPANY_TOKEN: "company-token" }
    delete process.env.BRASILNFE_BASE_URL
  })

  afterEach(() => {
    process.env = OLD
    jest.restoreAllMocks()
  })

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status })
  }

  it("transmite em POST /services/fiscal/EnviarNotaFiscal com os dois headers", async () => {
    const spy = jest.fn().mockResolvedValueOnce(json(autorizada()))
    global.fetch = spy as unknown as typeof fetch
    const { transmitir } = await import("../fiscal-client.js")
    const r = await transmitir({ TipoAmbiente: 2, ModeloDocumento: 55 })

    expect(spy.mock.calls[0][0]).toBe("https://api.brasilnfe.com.br/services/fiscal/EnviarNotaFiscal")
    const init = spy.mock.calls[0][1]
    expect(init.method).toBe("POST")
    expect(init.headers.UserToken).toBe("user-token")
    expect(init.headers.Token).toBe("company-token")
    expect(JSON.parse(init.body)).toEqual({ TipoAmbiente: 2, ModeloDocumento: 55 })
    expect(r.desfecho).toBe("autorizado")
  })

  it("usa o TipoAmbiente do PAYLOAD como ambiente esperado", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(json(autorizada({ CodTipoAmbiente: 2 }))) as unknown as typeof fetch
    const { transmitir } = await import("../fiscal-client.js")
    const r = await transmitir({ TipoAmbiente: 1 })
    expect(r.ambiente_divergente).toBe(true)
  })

  it("4xx com corpo JSON é interpretado — recusa do fornecedor vira rejeitado, não exceção", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(json({ Error: "CPF inválido" }, 400)) as unknown as typeof fetch
    const { transmitir } = await import("../fiscal-client.js")
    const r = await transmitir({ TipoAmbiente: 2 })
    expect(r.desfecho).toBe("rejeitado")
    expect(r.motivo).toBe("CPF inválido")
  })

  it("4xx sem JSON vira rejeitado com código HTTP", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(new Response("Unauthorized", { status: 401 })) as unknown as typeof fetch
    const { transmitir } = await import("../fiscal-client.js")
    const r = await transmitir({ TipoAmbiente: 2 })
    expect(r.desfecho).toBe("rejeitado")
    expect(r.codigo_sefaz).toBe("HTTP_401")
  })

  it("5xx LANÇA Error comum (não ErroFiscal): não sabemos se a nota saiu", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(new Response("erro interno", { status: 502 })) as unknown as typeof fetch
    const { transmitir } = await import("../fiscal-client.js")
    const erro = await transmitir({ TipoAmbiente: 2 }).catch((e) => e)
    expect(erro).toBeInstanceOf(Error)
    expect(erro).not.toBeInstanceOf(ErroFiscal)
  })

  it("408 também lança: timeout do lado deles é tão ambíguo quanto o nosso", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(new Response("timeout", { status: 408 })) as unknown as typeof fetch
    const { transmitir } = await import("../fiscal-client.js")
    await expect(transmitir({ TipoAmbiente: 2 })).rejects.toThrow()
  })

  it("falha de rede propaga como Error comum", async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new TypeError("fetch failed")) as unknown as typeof fetch
    const { transmitir } = await import("../fiscal-client.js")
    const erro = await transmitir({ TipoAmbiente: 2 }).catch((e) => e)
    expect(erro).not.toBeInstanceOf(ErroFiscal)
  })

  it("a transmissão usa timeout de 5 minutos (o mesmo do SDK oficial)", async () => {
    const timeoutSpy = jest.spyOn(AbortSignal, "timeout")
    global.fetch = jest.fn().mockResolvedValueOnce(json(autorizada())) as unknown as typeof fetch
    const { transmitir } = await import("../fiscal-client.js")
    await transmitir({ TipoAmbiente: 2 })
    expect(timeoutSpy).toHaveBeenCalledWith(300000)
  })

  it("redaciona o token LITERAL se o servidor o ecoar no corpo de erro", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(
      new Response("token company-token recusado", { status: 500 })
    ) as unknown as typeof fetch
    const { transmitir } = await import("../fiscal-client.js")
    const erro = (await transmitir({ TipoAmbiente: 2 }).catch((e) => e)) as Error
    expect(erro.message).toContain("***")
    expect(erro.message).not.toContain("company-token")
    expect(erro.message).not.toContain("user-token")
  })

  it("sem credenciais, recusa com ErroFiscal antes de qualquer rede", async () => {
    delete process.env.BRASILNFE_COMPANY_TOKEN
    const spy = jest.fn()
    global.fetch = spy as unknown as typeof fetch
    const { transmitir } = await import("../fiscal-client.js")
    // jest.resetModules() no beforeEach força um módulo "tipos" novo a cada import dinâmico
    // (é assim que fiscal-client relê as credenciais do .env por teste) — então o ErroFiscal
    // usado no instanceof precisa vir do MESMO ciclo de import que gerou o erro, não do estático
    // do topo do arquivo (que aponta para a classe da primeira carga, já obsoleta aqui).
    const { ErroFiscal: ErroFiscalDoCiclo } = await import("../tipos.js")
    await expect(transmitir({ TipoAmbiente: 2 })).rejects.toBeInstanceOf(ErroFiscalDoCiclo)
    expect(spy).not.toHaveBeenCalled()
  })

  it("previsualizar embrulha a nota no envelope de lote e devolve o XML decodificado", async () => {
    const spy = jest.fn().mockResolvedValueOnce(json({ Status: true, Base64File: XML_B64 }))
    global.fetch = spy as unknown as typeof fetch
    const { previsualizar } = await import("../fiscal-client.js")
    const r = await previsualizar({ TipoAmbiente: 2, ModeloDocumento: 55, Finalidade: 1 })

    expect(spy.mock.calls[0][0]).toBe("https://api.brasilnfe.com.br/services/fiscal/PreVisualizarNotaFiscal")
    expect(JSON.parse(spy.mock.calls[0][1].body)).toEqual({
      notaFiscal: { TipoAmbiente: 2, ModeloDocumento: 55, nFInfos: [{ TipoAmbiente: 2, ModeloDocumento: 55, Finalidade: 1 }] },
      TipoArquivo: 0,
      TipoEnvio: 1,
    })
    expect(r.xml).toBe(XML)
  })

  it("previsualizar com Status false é ErroFiscal com o motivo do fornecedor", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(json({ Status: false, Error: "CFOP inválido" })) as unknown as typeof fetch
    const { previsualizar } = await import("../fiscal-client.js")
    await expect(previsualizar({ TipoAmbiente: 2 })).rejects.toThrow(/CFOP inválido/)
  })

  it("localizarPorIdentificador acha a nota pelo IdentificadorInterno EXATO", async () => {
    const spy = jest.fn().mockResolvedValueOnce(json({
      Notas: [
        { Chave: "9".repeat(44), IdentificadorInterno: "order_1:venda:homologacao:r1", Status: 1, Numero: 8, Serie: "1" },
        { Chave: CHAVE, IdentificadorInterno: "order_1:venda:homologacao", Status: 1, Numero: 7, Serie: "1" },
      ],
    }))
    global.fetch = spy as unknown as typeof fetch
    const { localizarPorIdentificador } = await import("../fiscal-client.js")
    const r = await localizarPorIdentificador({
      identificador: "order_1:venda:homologacao", ambiente: 2, desde: "2026-09-17T10:00:00Z",
    })

    expect(spy.mock.calls[0][0]).toBe("https://api.brasilnfe.com.br/services/fiscal/ObterNotasFiscais")
    const body = JSON.parse(spy.mock.calls[0][1].body)
    expect(body.TipoAmbiente).toBe(2)
    expect(body.TipoDocumentoFiscal).toBe(1)
    expect(body.IdentificadorInterno).toBe("order_1:venda:homologacao")
    expect(r).toEqual({ chave_acesso: CHAVE, status: 1, numero: 7, serie: 1 })
  })

  it("localizarPorIdentificador devolve null quando não há nota", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(json({ Notas: [] })) as unknown as typeof fetch
    const { localizarPorIdentificador } = await import("../fiscal-client.js")
    expect(await localizarPorIdentificador({ identificador: "x", ambiente: 2, desde: "2026-09-17T10:00:00Z" })).toBeNull()
  })

  it("baixarArquivo pede XML (1) ou DANFE (2) e decodifica o base64 do corpo JSON", async () => {
    const spy = jest.fn()
      .mockResolvedValueOnce(json(XML_B64))
      .mockResolvedValueOnce(json("JVBERi0xLjQK"))
    global.fetch = spy as unknown as typeof fetch
    const { baixarArquivo } = await import("../fiscal-client.js")

    const xml = await baixarArquivo(CHAVE, "xml")
    expect(xml.toString("utf8")).toBe(XML)
    expect(spy.mock.calls[0][0]).toBe("https://api.brasilnfe.com.br/services/fiscal/ObterArquivoNotaFiscal")
    expect(JSON.parse(spy.mock.calls[0][1].body)).toEqual({ ChaveNF: CHAVE, FileType: 1, TipoDocumentoFiscal: 1 })

    const pdf = await baixarArquivo(CHAVE, "danfe")
    expect(pdf.subarray(0, 4).toString("latin1")).toBe("%PDF")
    expect(JSON.parse(spy.mock.calls[1][1].body).FileType).toBe(2)
  })

  it("baixarArquivo com corpo vazio é ErroFiscal", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(json("")) as unknown as typeof fetch
    const { baixarArquivo } = await import("../fiscal-client.js")
    // Mesmo motivo do teste "sem credenciais" acima: instanceof precisa do ErroFiscal do
    // mesmo ciclo de módulo do import dinâmico, não do estático do topo do arquivo.
    const { ErroFiscal: ErroFiscalDoCiclo } = await import("../tipos.js")
    await expect(baixarArquivo(CHAVE, "xml")).rejects.toBeInstanceOf(ErroFiscalDoCiclo)
  })
})
