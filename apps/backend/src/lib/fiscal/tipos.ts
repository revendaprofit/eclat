// Tipos compartilhados da integração fiscal (spec §6).
// Dinheiro sempre em centavos inteiros (Invariante 3).

export type Ambiente = "homologacao" | "producao"

export type StatusDocumento =
  | "montado"
  | "transmitido_sem_confirmacao"
  | "autorizado_nao_verificado"
  | "verificado"
  | "rejeitado"
  | "denegado"
  | "em_contingencia"

export type FiscalConfig = {
  id: number
  cnpj: string
  razao_social: string
  nome_fantasia: string | null
  ie: string
  im: string | null
  crt: number
  logradouro: string
  numero: string
  complemento: string | null
  bairro: string
  municipio: string
  municipio_ibge: string
  uf: string
  cep: string
  serie_nfe: number
  ambiente: Ambiente
  emissao_ativa: boolean
}

export type FiscalPerfil = {
  id: string
  escopo: "padrao" | "categoria" | "produto"
  alvo_id: string | null
  csosn: string
  cfop_dentro_uf: string
  cfop_fora_uf: string
  cfop_devolucao_dentro_uf: string
  cfop_devolucao_fora_uf: string
  origem_padrao: number
  ativo: boolean
  cst_pis_cofins?: string | null   // migration 0012 — CST espelhado de PIS e COFINS
  cest?: string | null             // migration 0012 — obrigatório quando há ICMS-ST
}

export type FiscalDocumento = {
  id: string
  medusa_order_id: string
  tipo: "venda" | "devolucao"
  modelo: number
  serie: number | null
  numero: number | null
  chave_acesso: string | null
  status: StatusDocumento
  ambiente: Ambiente
  idempotency_key: string
  payload_enviado: Record<string, unknown>
  resposta_bruta: Record<string, unknown> | null
  rejeicao_codigo: string | null
  rejeicao_motivo: string | null
  xml_url: string | null
  danfe_url: string | null
  documento_origem_id: string | null
  verificado_em: string | null
  xml_autorizado?: string | null   // migration 0012 — XML autorizado (Base64Xml decodificado)
  created_at?: string              // vem do select=*; usado para a janela de busca no fornecedor
}

export type FiscalDocumentoItem = {
  id: string
  fiscal_documento_id: string
  medusa_line_item_id: string
  ordem_enviada: number
  n_item_verificado: number | null
  codigo_enviado: string
  ncm: string
  quantidade: number
  valor_unitario_centavos: number
  desconto_centavos: number
}

// Item do pedido do Medusa, já enriquecido com os dados fiscais da variante.
export type ItemPedido = {
  line_item_id: string
  product_id: string
  categoria_handle: string | null
  titulo: string
  sku: string | null
  ncm: string | null          // variant.hs_code
  origem: number | null       // derivado de variant.origin_country
  quantidade: number
  valor_unitario_centavos: number   // valor BRUTO (unit_price), sem desconto — Invariante 3
  desconto_centavos: number         // desconto do item inteiro (todas as unidades), somado
}

// Erro de negócio da camada fiscal: sempre com mensagem legível para o operador.
export class ErroFiscal extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ErroFiscal"
  }
}
