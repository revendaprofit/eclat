import { describe, expect, it } from "vitest"
import { montarCorpoDoCart, pacoteDoPedido, remetenteDoAmbiente, servicoDoPedido, type PedidoParaEtiqueta, type Remetente } from "./superfrete-etiqueta"

// Forma exata do corpo devolvido por montarCorpoDoCart — usado para tipar os testes sem `any`
// (montarCorpoDoCart devolve Record<string, unknown> porque é o que vai literalmente no POST,
// mas nos testes queremos acessar `to.phone`, `options.tags` etc. com tipo).
type CorpoDoCart = {
  from: Remetente
  to: {
    name: string; document: string; phone: string; email: string | null
    address: string; number: string; complement: string; district: string
    city: string; state_abbr: string; postal_code: string
  }
  service: number
  volumes: { width: number; height: number; length: number; weight: number }
  products: { name: string; quantity: number; unitary_value: number }[]
  options: {
    insurance_value: number; receipt: boolean; own_hand: boolean; non_commercial: boolean
    invoice?: { number: string }
    tags?: { tag: string }[]
  }
  platform: string
}

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

  // Os pesos abaixo TÊM que bater com apps/backend/src/modules/superfrete/embalagem.ts (a fonte da
  // verdade): PESO_PADRAO_G = 300 por peça, SAQUINHO_G = 50 (1 ou 2 peças) e CAIXA_G = 115 (3 ou
  // mais). Este teste segura a CÓPIA do Cockpit nesses números — ele não enxerga o backend (não há
  // import entre os apps) e NÃO quebra se alguém mudar só o embalagem.ts. Quem mudar lá precisa vir
  // aqui e mudar a cópia e este teste juntos, senão a divergência passa em silêncio até a
  // transportadora cobrar a diferença.
  it("sem pacote gravado, ou com contagem divergente, cai na tabela da spec §4.3 (300 g por peça)", () => {
    expect(pacoteDoPedido(null, 1)).toEqual({ width: 15, height: 5, length: 15, weight: 0.35 })
    expect(pacoteDoPedido(null, 2)).toEqual({ width: 20, height: 5, length: 20, weight: 0.65 })
    expect(pacoteDoPedido({ pacote: { pecas: 1, largura: 15, altura: 4, comprimento: 15, peso_kg: 0.21 } }, 4)).toEqual({ width: 25, height: 10, length: 20, weight: 1.315 })
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
    expect((montarCorpoDoCart(pedido(), REMETENTE, chave) as CorpoDoCart).options).toEqual({
      insurance_value: 0, receipt: false, own_hand: false, non_commercial: false, invoice: { number: chave }, tags: [{ tag: "1042" }],
    })
  })

  it("chave malformada é ignorada (vira declaração de conteúdo)", () => {
    expect((montarCorpoDoCart(pedido(), REMETENTE, "123") as CorpoDoCart).options.non_commercial).toBe(true)
  })

  it("sem display_id, não manda options.tags", () => {
    expect((montarCorpoDoCart(pedido({ display_id: null }), REMETENTE, null) as CorpoDoCart).options).not.toHaveProperty("tags")
  })

  it("sem número, manda vazio — não 'S/N' (doc da SuperFrete)", () => {
    expect((montarCorpoDoCart(pedido({ numero: "" }), REMETENTE, null) as CorpoDoCart).to.number).toBe("")
  })

  it("sem e-mail, manda null (não string vazia)", () => {
    expect((montarCorpoDoCart(pedido({ email: null }), REMETENTE, null) as CorpoDoCart).to.email).toBeNull()
  })

  it("destinatário sem sobrenome não precisa (só o remetente exige nome e sobrenome)", () => {
    const semSobrenome = pedido({ endereco: { ...pedido().endereco!, last_name: null } })
    expect((montarCorpoDoCart(semSobrenome, REMETENTE, null) as CorpoDoCart).to.name).toBe("Ana")
  })

  it("CNPJ do destinatário (pessoa jurídica) também é aceito", () => {
    expect((montarCorpoDoCart(pedido({ cpf: "11222333000181" }), REMETENTE, null) as CorpoDoCart).to.document).toBe("11222333000181")
  })

  it("corta endereço e complemento nos limites da doc (nunca falha por campo comprido)", () => {
    const enderecoLongo = pedido({
      endereco: { ...pedido().endereco!, address_1: "A".repeat(70), address_2: "B".repeat(30) },
    })
    const corpo = montarCorpoDoCart(enderecoLongo, REMETENTE, null) as CorpoDoCart
    expect(corpo.to.address).toBe("A".repeat(50))
    expect(corpo.to.complement).toBe("B".repeat(20))
  })

  it("erros claros para o operador", () => {
    expect(() => montarCorpoDoCart(pedido({ cpf: "" }), REMETENTE, null)).toThrow("CPF")
    expect(() => montarCorpoDoCart(pedido({ endereco: null }), REMETENTE, null)).toThrow("endereço")
    expect(() => montarCorpoDoCart(pedido({ endereco: { ...pedido().endereco!, postal_code: "123" } }), REMETENTE, null)).toThrow("CEP")
  })
})

describe("telefone do destinatário (nacional, sem DDI)", () => {
  it.each([
    ["+55 31 98888-7777", "31988887777"], // 13 dígitos com formatação — já coberto no teste principal, explícito aqui
    ["5531988887777", "31988887777"], // 13 dígitos, celular com DDI
    ["553132224444", "3132224444"], // 12 dígitos, fixo com DDI
    ["31988887777", "31988887777"], // 11 dígitos, já nacional — inalterado
    ["3132224444", "3132224444"], // 10 dígitos, já nacional — inalterado
    ["123", ""], // nem 10 nem 11 dígitos — manda vazio, nunca inventa número
  ])("%s -> %s", (bruto, esperado) => {
    const comTelefone = pedido({ endereco: { ...pedido().endereco!, phone: bruto } })
    expect((montarCorpoDoCart(comTelefone, REMETENTE, null) as CorpoDoCart).to.phone).toBe(esperado)
  })
})

describe("UF do destinatário", () => {
  it("aceita sigla com prefixo BR- e normaliza para maiúsculas", () => {
    const corpo = montarCorpoDoCart(pedido({ endereco: { ...pedido().endereco!, province: "br-mg" } }), REMETENTE, null) as CorpoDoCart
    expect(corpo.to.state_abbr).toBe("MG")
  })

  it("UF por extenso é rejeitada antes de qualquer chamada à API", () => {
    expect(() => montarCorpoDoCart(pedido({ endereco: { ...pedido().endereco!, province: "Minas Gerais" } }), REMETENTE, null)).toThrow("UF")
  })
})

describe("remetente do ambiente", () => {
  const ENV_OBRIGATORIO = {
    SUPERFRETE_FROM_NAME: "Loja Teste", SUPERFRETE_FROM_DOCUMENT: "11.222.333/0001-81",
    SUPERFRETE_FROM_ADDRESS: "Rua Exemplo", SUPERFRETE_FROM_NUMBER: "100", SUPERFRETE_FROM_DISTRICT: "Centro",
    SUPERFRETE_FROM_CITY: "Cidade Teste", SUPERFRETE_FROM_STATE: "mg", SUPERFRETE_FROM_POSTAL_CODE: "01001-000",
  }
  const envValido = (o: Partial<Record<keyof typeof ENV_OBRIGATORIO, string>> = {}) =>
    ({ ...ENV_OBRIGATORIO, ...o } as unknown as NodeJS.ProcessEnv)

  it("lê SUPERFRETE_FROM_* e limpa documento, telefone e CEP", () => {
    expect(
      remetenteDoAmbiente({ ...ENV_OBRIGATORIO, SUPERFRETE_FROM_PHONE: "(31) 99999-0000" } as unknown as NodeJS.ProcessEnv)
    ).toEqual(REMETENTE)
  })

  it("diz qual variável falta", () => {
    expect(() => remetenteDoAmbiente({} as NodeJS.ProcessEnv)).toThrow("SUPERFRETE_FROM_NAME")
  })

  it("SUPERFRETE_FROM_PHONE é opcional (a doc não lista from.phone)", () => {
    expect(remetenteDoAmbiente(envValido())).toEqual({ ...REMETENTE, phone: "" })
  })

  it("SUPERFRETE_FROM_NAME precisa ter nome e sobrenome (a SuperFrete recusa remetente de uma palavra só)", () => {
    expect(() => remetenteDoAmbiente(envValido({ SUPERFRETE_FROM_NAME: "Loja" }))).toThrow("SUPERFRETE_FROM_NAME")
  })

  it("SUPERFRETE_FROM_POSTAL_CODE precisa ter 8 dígitos", () => {
    expect(() => remetenteDoAmbiente(envValido({ SUPERFRETE_FROM_POSTAL_CODE: "123" }))).toThrow("SUPERFRETE_FROM_POSTAL_CODE")
  })

  it("SUPERFRETE_FROM_STATE precisa ser a sigla de 2 letras", () => {
    expect(() => remetenteDoAmbiente(envValido({ SUPERFRETE_FROM_STATE: "Minas Gerais" }))).toThrow("SUPERFRETE_FROM_STATE")
  })
})
