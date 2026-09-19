// Fulfillment provider da SuperFrete (spec 2026-09-18-frete-superfrete-design.md §4).
// Só COTA. A etiqueta é comprada pelo Cockpit no despacho (spec §4.7) — por isso
// createFulfillment/cancelFulfillment não fazem nada, como no provider manual.
import { AbstractFulfillmentProviderService, MedusaError } from "@medusajs/framework/utils"
import type {
  CalculatedShippingOptionPrice,
  CalculateShippingOptionPriceDTO,
  CreateFulfillmentResult,
  CreateShippingOptionDTO,
  FulfillmentDTO,
  FulfillmentItemDTO,
  FulfillmentOption,
  FulfillmentOrderDTO,
  Logger,
  ValidateFulfillmentDataContext,
} from "@medusajs/framework/types"
import { buscarBaseDoCarrinho, calcularBase, type ItemDaBase } from "./base-carrinho"
import type { Cotacao } from "./cliente"
import { obterCotador, type Cotador } from "./cotador"
import { paraValorMedusa } from "./dinheiro"
import { cabeNoMiniEnvios, montarPacote, type Pacote } from "./embalagem"
import { parametrosDoAmbiente } from "./parametros"
import { aplicarFreteGratis, ID_SUPERFRETE, normalizaUf, precosNormais, SERVICOS, type Parametros, type Precos, type Servico } from "./preco"

export type OpcoesSuperfrete = {
  cotador?: Cotador
  buscarBase?: (cartId: string) => Promise<number>
  parametros?: Parametros
}

type InjectedDependencies = { logger: Logger }
type Contexto = CalculateShippingOptionPriceDTO["context"]
// calculatePrice e validateFulfillmentData recebem contextos com formas diferentes no Medusa
// real (o de calculatePrice inclui a variante de troca/devolução; o de validateFulfillmentData
// exige from_location). Os dois têm items e shipping_address (CartPropsForFulfillment), que é
// tudo que os helpers privados abaixo usam.
type ContextoComCarrinho = Contexto | ValidateFulfillmentDataContext

const NOMES: Record<Servico, string> = { mini: "Econômica (Mini Envios)", pac: "PAC", sedex: "SEDEX" }

export default class SuperfreteProviderService extends AbstractFulfillmentProviderService {
  static identifier = "superfrete"

  protected readonly logger_: Logger
  protected readonly opcoes_: OpcoesSuperfrete

  constructor({ logger }: InjectedDependencies, options: OpcoesSuperfrete = {}) {
    super()
    this.logger_ = logger
    this.opcoes_ = options
  }

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return SERVICOS.map((id) => ({ id, name: NOMES[id] }))
  }

  async validateOption(data: Record<string, unknown>): Promise<boolean> {
    return SERVICOS.includes(data.id as Servico)
  }

  // Assinatura alinhada à da classe base (CreateShippingOptionDTO) para aceitar os mesmos
  // argumentos que ela — sem isso, o parâmetro extra que o Medusa envia falha no typecheck.
  async canCalculate(_data?: CreateShippingOptionDTO): Promise<boolean> {
    return true
  }

  async calculatePrice(
    optionData: CalculateShippingOptionPriceDTO["optionData"],
    _data: CalculateShippingOptionPriceDTO["data"],
    context: Contexto
  ): Promise<CalculatedShippingOptionPrice> {
    const servico = this.servico_(optionData)
    const cep = this.cep_(context)
    const pacote = this.pacote_(context)
    const parametros = this.opcoes_.parametros ?? parametrosDoAmbiente()

    const normais = await this.precosNormais_(cep, pacote, parametros)
    const finais = aplicarFreteGratis(normais, await this.base_(context), normalizaUf(context.shipping_address?.province), parametros)
    const centavos = finais[servico]
    if (typeof centavos !== "number") {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `${NOMES[servico]} não está disponível para este pedido.`)
    }
    return { calculated_amount: paraValorMedusa(centavos), is_calculated_price_tax_inclusive: true }
  }

  /**
   * O que o pedido guarda sobre o frete (spec §4.5 e §4.8). Tudo é recalculado aqui no servidor:
   * `data` vem do navegador e não é confiável para serviço, pacote ou prazo.
   */
  async validateFulfillmentData(
    optionData: Record<string, unknown>,
    _data: Record<string, unknown>,
    context: ValidateFulfillmentDataContext
  ): Promise<Record<string, unknown>> {
    const servico = this.servico_(optionData)
    const pacote = this.pacote_(context)
    const gravado: Record<string, unknown> = { servico: ID_SUPERFRETE[servico], pacote }
    const cotacao = (await this.cotar_(this.cep_(context), pacote))?.find((c) => c.servico === servico)
    if (cotacao) {
      gravado.prazo_min = cotacao.prazoMin
      gravado.prazo_max = cotacao.prazoMax
    }
    return gravado
  }

  // Idem: assinaturas alinhadas à classe base para aceitar os argumentos que o Medusa envia
  // (e que os testes exercitam), embora nada deles seja usado — não compramos etiqueta aqui.
  async createFulfillment(
    _data?: Record<string, unknown>,
    _items?: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
    _order?: Partial<FulfillmentOrderDTO>,
    _fulfillment?: Partial<Omit<FulfillmentDTO, "provider_id" | "data" | "items">>
  ): Promise<CreateFulfillmentResult> {
    return { data: {}, labels: [] }
  }

  async cancelFulfillment(_data?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return {}
  }

  async createReturnFulfillment(_fulfillment?: Record<string, unknown>): Promise<CreateFulfillmentResult> {
    return { data: {}, labels: [] }
  }

  private servico_(optionData: Record<string, unknown>): Servico {
    const id = optionData.id as Servico
    if (!SERVICOS.includes(id)) throw new MedusaError(MedusaError.Types.INVALID_DATA, `Opção de frete desconhecida: ${String(optionData.id)}`)
    return id
  }

  private cep_(context: ContextoComCarrinho): string {
    const cep = String(context.shipping_address?.postal_code ?? "").replace(/\D/g, "")
    if (cep.length !== 8) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Informe o CEP para calcular o frete.")
    return cep
  }

  private pacote_(context: ContextoComCarrinho): Pacote {
    // Em produção o peso mora no PRODUTO; a variante só tem peso quando difere (ex.: produto de teste).
    return montarPacote(
      (context.items ?? []).map((i) => ({
        quantidade: Number(i.quantity),
        peso_g: i.variant?.weight ?? (i as { product?: { weight?: number | null } }).product?.weight ?? null,
      }))
    )
  }

  /** Cotações válidas para o pacote, ou `null` se a SuperFrete não respondeu (já logado). */
  private async cotar_(cep: string, pacote: Pacote): Promise<Cotacao[] | null> {
    try {
      const cotacoes = await (this.opcoes_.cotador ?? obterCotador()).cotar(cep, pacote)
      return cotacoes.filter((c) => c.servico !== "mini" || cabeNoMiniEnvios(pacote))
    } catch (e) {
      // Nunca logar token nem CPF: a mensagem do cliente HTTP já vem sem eles.
      this.logger_.error(`[superfrete] cotação falhou, usando valor de reserva: ${(e as Error).message}`)
      return null
    }
  }

  private async precosNormais_(cep: string, pacote: Pacote, parametros: Parametros): Promise<Precos> {
    const cotacoes = await this.cotar_(cep, pacote)
    // Reserva (spec §4.5): checkout não trava — só PAC, pelo valor fixo, já como preço final de vitrine.
    if (!cotacoes) return { pac: parametros.reservaPac }
    const crus: Precos = {}
    for (const c of cotacoes) crus[c.servico] = c.centavos
    return precosNormais(crus, parametros)
  }

  private async base_(context: Contexto): Promise<number> {
    const itens = (context.items ?? []) as unknown as ItemDaBase[]
    // O /calculate do Medusa não traz adjustments; outros fluxos trazem. Se vieram, confio neles.
    if (itens.length && itens.every((i) => Array.isArray(i.adjustments))) return calcularBase(itens)
    return (this.opcoes_.buscarBase ?? buscarBaseDoCarrinho)(String(context.id))
  }
}
