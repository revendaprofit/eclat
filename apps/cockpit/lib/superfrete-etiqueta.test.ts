import { describe, expect, it } from "vitest"
import { montarCorpoDoCart, pacoteDoPedido, remetenteDoAmbiente, servicoDoPedido, type PedidoParaEtiqueta } from "./superfrete-etiqueta"

const REMETENTE = {
  name: "Loja Teste", document: "11222333000181", phone: "31999990000", address: "Rua Exemplo", number: "100",
  complement: "", district: "Centro", city: "Cidade Teste", state_abbr: "MG", postal_code: "01001000",
}
const pedido = (o: Partial<PedidoParaEtiqueta> = {}): PedidoParaEtiqueta => ({
  itens: [{ titulo: "Top Aura", quantidade: 1, preco_unitario: 189 }],
  endereco: { first_name: "Ana", last_name: "Silva", address_1: "Rua Um", address_2: "Apto 2", city: "Belo Horizonte", province: "mg", postal_code: "30130-010", country_code: "br", phone: "+55 31 98888-7777" },
  email: "ana@example.com",
  cpf: "52998224725",
  numero: "45",
  bairro: "Savassi",
  display_id: 1042,
  dados_do_frete: { servico: 2, pacote: { pecas: 1, largura: 15, altura: 4, comprimento: 15, peso_kg: 0.21 } },
  ...o,
})

describe("serviço e pacote lidos do pedido", () => {
  it("usa o serviço cotado; pedido antigo (Entrega Padrão) cai em PAC", () => {
    expect(servicoDoPedido({ servico: 17 })).toBe(17)
    expect(servicoDoPedido({ servico: 999 })).toBe(1)
    expect(servicoDoPedido(null)).toBe(1)
  })

  it("usa o pacote cotado quando a contagem de peças ainda bate", () => {
    expect(pacoteDoPedido({ pacote: { pecas: 1, largura: 15, altura: 4, comprimento: 15, peso_kg: 0.21 } }, 1)).toEqual({ width: 15, height: 4, length: 15, weight: 0.21 })
  })

  it("sem pacote gravado, ou com contagem divergente, cai na tabela da spec §4.3 (300 g por peça)", () => {
    expect(pacoteDoPedido(null, 1)).toEqual({ width: 15, height: 5, length: 15, weight: 0.31 })
    expect(pacoteDoPedido(null, 2)).toEqual({ width: 20, height: 5, length: 20, weight: 0.61 })
    expect(pacoteDoPedido({ pacote: { pecas: 1, largura: 15, altura: 4, comprimento: 15, peso_kg: 0.21 } }, 4)).toEqual({ width: 25, height: 10, length: 20, weight: 1.35 })
  })
})

describe("corpo do POST /api/v0/cart", () => {
  it("monta remetente, destinatário com CPF, serviço, volume e produtos", () => {
    // Telefone do destinatário: doc oficial da SuperFrete pede 11 dígitos NACIONAIS, sem
    // DDI — "+55 31 98888-7777" chega com 13 dígitos (55 + 11) e sai sem o "55".
    expect(montarCorpoDoCart(pedido(), REMETENTE, null)).toEqual({
      from: REMETENTE,
      to: {
        name: "Ana Silva", document: "52998224725", phone: "31988887777", email: "ana@example.com",
        address: "Rua Um", number: "45", complement: "Apto 2", district: "Savassi",
        city: "Belo Horizonte", state_abbr: "MG", postal_code: "30130010",
      },
      service: 2,
      volumes: { width: 15, height: 4, length: 15, weight: 0.21 },
      products: [{ name: "Top Aura", quantity: 1, unitary_value: 189 }],
      // options.tags identifica o pedido no painel da SuperFrete (display_id 1042 do pedido de exemplo).
      options: { insurance_value: 0, receipt: false, own_hand: false, non_commercial: true, tags: [{ tag: "1042" }] },
      platform: "use.ECLAT",
    })
  })

  it("com a chave da NFe, vai como nota e não como declaração de conteúdo", () => {
    const chave = "3".repeat(44)
    expect((montarCorpoDoCart(pedido(), REMETENTE, chave) as any).options).toEqual({
      insurance_value: 0, receipt: false, own_hand: false, non_commercial: false, invoice: { number: chave }, tags: [{ tag: "1042" }],
    })
  })

  it("chave malformada é ignorada (vira declaração de conteúdo)", () => {
    expect((montarCorpoDoCart(pedido(), REMETENTE, "123") as any).options.non_commercial).toBe(true)
  })

  it("sem display_id, não manda options.tags", () => {
    expect((montarCorpoDoCart(pedido({ display_id: null }), REMETENTE, null) as any).options).not.toHaveProperty("tags")
  })

  it("sem número, manda vazio — não 'S/N' (doc da SuperFrete)", () => {
    expect((montarCorpoDoCart(pedido({ numero: "" }), REMETENTE, null) as any).to.number).toBe("")
  })

  it("sem e-mail, manda null (não string vazia)", () => {
    expect((montarCorpoDoCart(pedido({ email: null }), REMETENTE, null) as any).to.email).toBeNull()
  })

  it("telefone fora do padrão nacional (nem 10 nem 11 dígitos) vira vazio", () => {
    const semTelefoneValido = pedido({ endereco: { ...pedido().endereco!, phone: "123" } })
    expect((montarCorpoDoCart(semTelefoneValido, REMETENTE, null) as any).to.phone).toBe("")
  })

  it("corta endereço e complemento nos limites da doc (nunca falha por campo comprido)", () => {
    const enderecoLongo = pedido({
      endereco: { ...pedido().endereco!, address_1: "A".repeat(70), address_2: "B".repeat(30) },
    })
    const corpo = montarCorpoDoCart(enderecoLongo, REMETENTE, null) as any
    expect(corpo.to.address).toBe("A".repeat(50))
    expect(corpo.to.complement).toBe("B".repeat(20))
  })

  it("erros claros para o operador", () => {
    expect(() => montarCorpoDoCart(pedido({ cpf: "" }), REMETENTE, null)).toThrow("CPF")
    expect(() => montarCorpoDoCart(pedido({ endereco: null }), REMETENTE, null)).toThrow("endereço")
    expect(() => montarCorpoDoCart(pedido({ endereco: { ...pedido().endereco!, postal_code: "123" } }), REMETENTE, null)).toThrow("CEP")
  })
})

describe("remetente do ambiente", () => {
  it("lê SUPERFRETE_FROM_* e limpa documento, telefone e CEP", () => {
    expect(
      remetenteDoAmbiente({
        SUPERFRETE_FROM_NAME: "Loja Teste", SUPERFRETE_FROM_DOCUMENT: "11.222.333/0001-81", SUPERFRETE_FROM_PHONE: "(31) 99999-0000",
        SUPERFRETE_FROM_ADDRESS: "Rua Exemplo", SUPERFRETE_FROM_NUMBER: "100", SUPERFRETE_FROM_DISTRICT: "Centro",
        SUPERFRETE_FROM_CITY: "Cidade Teste", SUPERFRETE_FROM_STATE: "mg", SUPERFRETE_FROM_POSTAL_CODE: "01001-000",
      } as unknown as NodeJS.ProcessEnv)
    ).toEqual(REMETENTE)
  })

  it("diz qual variável falta", () => {
    expect(() => remetenteDoAmbiente({} as NodeJS.ProcessEnv)).toThrow("SUPERFRETE_FROM_NAME")
  })

  it("SUPERFRETE_FROM_PHONE é opcional (a doc não lista from.phone)", () => {
    expect(
      remetenteDoAmbiente({
        SUPERFRETE_FROM_NAME: "Loja Teste", SUPERFRETE_FROM_DOCUMENT: "11.222.333/0001-81",
        SUPERFRETE_FROM_ADDRESS: "Rua Exemplo", SUPERFRETE_FROM_NUMBER: "100", SUPERFRETE_FROM_DISTRICT: "Centro",
        SUPERFRETE_FROM_CITY: "Cidade Teste", SUPERFRETE_FROM_STATE: "mg", SUPERFRETE_FROM_POSTAL_CODE: "01001-000",
      } as unknown as NodeJS.ProcessEnv)
    ).toEqual({ ...REMETENTE, phone: "" })
  })
})
