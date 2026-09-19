// Etiqueta SuperFrete — a parte PURA (spec 2026-09-18-frete-superfrete-design.md §4.7–4.8).
// O backend grava no shipping method o serviço e o pacote usados na cotação; a etiqueta é comprada
// com os mesmos, para o valor debitado bater com o frete cobrado da cliente.
//
// Ajustado em 2026-09-19 conforme a doc oficial do POST /api/v0/cart: telefone do destinatário
// SEM DDI (nunca prefixar "55"), limites de tamanho por corte (nunca falhar por campo comprido),
// número vazio quando o pedido não tem número, e `options.tags` com o display_id do pedido.
import type { OrderAddress } from "./medusa"

export type Remetente = {
  name: string; document: string; phone: string; address: string; number: string
  complement: string; district: string; city: string; state_abbr: string; postal_code: string
}
export type PedidoParaEtiqueta = {
  itens: { titulo: string; quantidade: number; preco_unitario: number }[]
  endereco: OrderAddress | null
  email: string | null
  cpf: string
  numero: string
  bairro: string
  // Identifica o pedido no painel da SuperFrete (options.tags) — null em chamada que não o tenha.
  display_id: number | null
  dados_do_frete: Record<string, unknown> | null
}
type Volume = { width: number; height: number; length: number; weight: number }

const digitos = (s: unknown) => String(s ?? "").replace(/\D/g, "")
// A doc do POST /api/v0/cart trunca em vez de rejeitar campo comprido: nunca falhar por isso.
const cortar = (s: string, n: number) => s.slice(0, n)
const SERVICOS = [1, 2, 17] as const

// Telefone do destinatário: a doc pede 11 (ou 10) dígitos NACIONAIS, sem DDI e sem formatação —
// diferente do que o texto original da task supunha (que prefixava "55"). Fora desse formato,
// manda vazio em vez de inventar um número. Celular com DDI tem 13 dígitos (55 + 11); fixo com
// DDI tem 12 (55 + 10) — os dois perdem o "55" antes de validar o tamanho final.
function telefoneNacional(raw: unknown): string {
  let d = digitos(raw)
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2)
  return d.length === 10 || d.length === 11 ? d : ""
}

// Sigla de estado válida para a SuperFrete: exatamente 2 letras. Falha ANTES de qualquer
// chamada à API — melhor um erro claro pro operador do que um 400 da SuperFrete sem contexto.
const UF_VALIDA = /^[A-Z]{2}$/

export function servicoDoPedido(dados: Record<string, unknown> | null): 1 | 2 | 17 {
  const s = Number(dados?.servico)
  // Pedido antigo ("Entrega Padrão", sem serviço gravado) sai como PAC — spec §4.7.
  return (SERVICOS as readonly number[]).includes(s) ? (s as 1 | 2 | 17) : 1
}

// Cópia mínima da tabela da spec §4.3 (a fonte é apps/backend/src/modules/superfrete/embalagem.ts).
// Só vale para pedido sem `data.pacote` ou cujo pacote ficou velho; sem o peso real, 300 g por peça.
function pacoteDaTabela(pecas: number): Volume {
  const gramas = pecas * 300
  if (pecas <= 1) return { width: 15, height: 5, length: 15, weight: (gramas + 10) / 1000 }
  if (pecas === 2) return { width: 20, height: 5, length: 20, weight: (gramas + 10) / 1000 }
  return { width: 25, height: 10, length: 20, weight: (gramas + 150) / 1000 }
}

export function pacoteDoPedido(dados: Record<string, unknown> | null, pecas: number): Volume {
  const p = dados?.pacote as { pecas?: number; largura?: number; altura?: number; comprimento?: number; peso_kg?: number } | undefined
  const completo = p && [p.largura, p.altura, p.comprimento, p.peso_kg].every((n) => typeof n === "number" && n > 0)
  // O Medusa refaz o PREÇO do método quando o carrinho muda, mas não o `data`: se a contagem de
  // peças divergiu, o pacote gravado é de outro carrinho.
  if (completo && p.pecas === pecas) return { width: p.largura!, height: p.altura!, length: p.comprimento!, weight: p.peso_kg! }
  return pacoteDaTabela(pecas)
}

// Remetente ou destinatário cortado nos limites da doc (name/address/district/city 50,
// complement 20, number 10) — vale para os dois lados do POST /api/v0/cart.
function pessoaCortada(p: Remetente): Remetente {
  return {
    ...p,
    name: cortar(p.name, 50),
    address: cortar(p.address, 50),
    number: cortar(p.number, 10),
    complement: cortar(p.complement, 20),
    district: cortar(p.district, 50),
    city: cortar(p.city, 50),
  }
}

export function montarCorpoDoCart(pedido: PedidoParaEtiqueta, remetente: Remetente, chaveNfe: string | null): Record<string, unknown> {
  const a = pedido.endereco
  if (!a?.address_1) throw new Error("Pedido sem endereço de entrega: não dá para gerar a etiqueta.")
  const cep = digitos(a.postal_code)
  if (cep.length !== 8) throw new Error("CEP do pedido inválido: corrija o endereço antes de gerar a etiqueta.")
  const documento = digitos(pedido.cpf)
  if (documento.length !== 11 && documento.length !== 14) {
    throw new Error("Pedido sem CPF da cliente: a SuperFrete exige o documento do destinatário. Preencha os dados fiscais do pedido ou use o rastreio manual.")
  }
  const uf = (a.province ?? "").trim().toUpperCase().replace(/^BR-/, "")
  if (!UF_VALIDA.test(uf)) {
    throw new Error(`UF do endereço inválida ("${uf}"): corrija o endereço do pedido (sigla de 2 letras) antes de gerar a etiqueta.`)
  }
  const chave = digitos(chaveNfe)
  const comNota = chave.length === 44
  const pecas = pedido.itens.reduce((n, i) => n + i.quantidade, 0)

  // Só o REMETENTE precisa de nome e sobrenome (exigência da doc oficial); o destinatário não —
  // o checkout da vitrine já obriga sobrenome, mas não vale a pena travar a etiqueta por isso aqui.
  const destinatario = pessoaCortada({
    name: [a.first_name, a.last_name].filter(Boolean).join(" ") || "Cliente",
    document: documento,
    phone: telefoneNacional(a.phone),
    address: a.address_1,
    // Sem número, a doc pede vazio — não "S/N".
    number: pedido.numero || "",
    complement: a.address_2 ?? "",
    district: pedido.bairro || "NA",
    city: a.city ?? "",
    state_abbr: uf,
    postal_code: cep,
  })

  const options: Record<string, unknown> = {
    insurance_value: 0,
    receipt: false,
    own_hand: false,
    non_commercial: !comNota,
    ...(comNota ? { invoice: { number: chave } } : {}),
    // Como o painel da SuperFrete mostra de qual pedido é a etiqueta.
    ...(pedido.display_id != null ? { tags: [{ tag: String(pedido.display_id) }] } : {}),
  }

  return {
    from: pessoaCortada(remetente),
    to: { ...destinatario, email: pedido.email },
    service: servicoDoPedido(pedido.dados_do_frete),
    volumes: pacoteDoPedido(pedido.dados_do_frete, pecas),
    products: pedido.itens.map((i) => ({ name: i.titulo, quantity: i.quantidade, unitary_value: i.preco_unitario })),
    options,
    platform: "use.ECLAT",
  }
}

export function remetenteDoAmbiente(env: NodeJS.ProcessEnv = process.env): Remetente {
  const obrigatoria = (nome: string) => {
    const v = env[nome]?.trim()
    if (!v) throw new Error(`Etiqueta SuperFrete: defina ${nome} no ambiente do Cockpit (ver architecture/envios.md).`)
    return v
  }

  const name = obrigatoria("SUPERFRETE_FROM_NAME")
  // A doc oficial exige nome E sobrenome no remetente (não exige no destinatário) — sem isso a
  // SuperFrete recusa a etiqueta na hora de comprar, já com o pagamento debitado.
  if (name.split(/\s+/).filter(Boolean).length < 2) {
    throw new Error("Etiqueta SuperFrete: SUPERFRETE_FROM_NAME precisa ter nome e sobrenome (a SuperFrete recusa remetente com uma palavra só).")
  }

  const postalCode = digitos(obrigatoria("SUPERFRETE_FROM_POSTAL_CODE"))
  if (postalCode.length !== 8) {
    throw new Error("Etiqueta SuperFrete: SUPERFRETE_FROM_POSTAL_CODE precisa ter 8 dígitos (CEP inválido).")
  }

  const stateAbbr = obrigatoria("SUPERFRETE_FROM_STATE").toUpperCase()
  if (!UF_VALIDA.test(stateAbbr)) {
    throw new Error(`Etiqueta SuperFrete: SUPERFRETE_FROM_STATE precisa ser a sigla de 2 letras do estado (valor lido: "${stateAbbr}").`)
  }

  return pessoaCortada({
    name,
    document: digitos(obrigatoria("SUPERFRETE_FROM_DOCUMENT")),
    // Opcional: a doc do POST /api/v0/cart não lista `from.phone`.
    phone: env.SUPERFRETE_FROM_PHONE ? digitos(env.SUPERFRETE_FROM_PHONE) : "",
    address: obrigatoria("SUPERFRETE_FROM_ADDRESS"),
    number: obrigatoria("SUPERFRETE_FROM_NUMBER"),
    complement: env.SUPERFRETE_FROM_COMPLEMENT?.trim() ?? "",
    district: obrigatoria("SUPERFRETE_FROM_DISTRICT"),
    city: obrigatoria("SUPERFRETE_FROM_CITY"),
    state_abbr: stateAbbr,
    postal_code: postalCode,
  })
}
