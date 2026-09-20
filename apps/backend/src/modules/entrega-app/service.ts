import { AbstractFulfillmentProviderService, MedusaError } from "@medusajs/framework/utils"
import type { Logger } from "@medusajs/framework/types"
import type {
  CalculateShippingOptionPriceDTO,
  CalculatedShippingOptionPrice,
  CreateFulfillmentResult,
  CreateShippingOptionDTO,
  FulfillmentDTO,
  FulfillmentItemDTO,
  FulfillmentOption,
  FulfillmentOrderDTO,
  ValidateFulfillmentDataContext,
} from "@medusajs/framework/types"
import { dentroDaArea, faixasDoAmbiente } from "./area"

// "Entrega por aplicativo": a cliente chama e paga o carro (Uber, 99, motoboy) e combina a
// retirada por WhatsApp depois do pagamento. A loja não cobra frete e não contrata transporte.
//
// Duas guardas, as duas no servidor:
// 1. fora da área atendida, a opção nem aparece (calculatePrice recusa — é assim que a vitrine
//    esconde opção indisponível, mesmo caminho do provider da SuperFrete);
// 2. sem o aceite da cliente, o método de entrega não é gravado no carrinho — o texto do aceite
//    vai junto no pedido, para valer como registro.

export const OPCAO = "app"
export const NOME = "Entrega por aplicativo"

export const TEXTO_ACEITE =
  "Você chama e paga o carro (Uber, 99, motoboy). A use.ÉCLAT entrega a sacola ao motorista no " +
  "endereço e horário combinados por WhatsApp; a contratação e o transporte são de sua responsabilidade."

type Contexto = CalculateShippingOptionPriceDTO["context"] & {
  shipping_address?: { postal_code?: string | null } | null
}

export default class EntregaAppProviderService extends AbstractFulfillmentProviderService {
  static identifier = "entrega-app"

  protected readonly logger_: Logger

  constructor({ logger }: { logger: Logger }) {
    super()
    this.logger_ = logger
  }

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return [{ id: OPCAO, name: NOME }]
  }

  async validateOption(data: Record<string, unknown>): Promise<boolean> {
    return data.id === OPCAO
  }

  async canCalculate(_data?: CreateShippingOptionDTO): Promise<boolean> {
    return true
  }

  async calculatePrice(
    _optionData: CalculateShippingOptionPriceDTO["optionData"],
    _data: CalculateShippingOptionPriceDTO["data"],
    context: Contexto
  ): Promise<CalculatedShippingOptionPrice> {
    const cep = context?.shipping_address?.postal_code
    if (!dentroDaArea(cep, faixasDoAmbiente())) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "A entrega por aplicativo atende Betim e a Região Metropolitana de BH."
      )
    }
    return { calculated_amount: 0, is_calculated_price_tax_inclusive: true }
  }

  /**
   * O aceite chega do navegador (`data.aceite`) e é a ÚNICA coisa que o navegador decide aqui —
   * sem ele o método não é gravado. O que fica no pedido é escrito por este servidor: o texto da
   * versão aceita e a hora, para o Cockpit e o e-mail mostrarem depois.
   */
  async validateFulfillmentData(
    _optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    context: ValidateFulfillmentDataContext
  ): Promise<Record<string, unknown>> {
    const cep = (context as Contexto)?.shipping_address?.postal_code
    if (!dentroDaArea(cep, faixasDoAmbiente())) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "A entrega por aplicativo atende Betim e a Região Metropolitana de BH."
      )
    }
    if (data?.aceite !== true) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Para escolher a entrega por aplicativo, confirme que a contratação do transporte é sua."
      )
    }
    return {
      tipo: "entrega_app",
      aceite_texto: TEXTO_ACEITE,
      aceite_em: new Date().toISOString(),
      combinar_por: "whatsapp",
    }
  }

  async createFulfillment(
    _data?: Record<string, unknown>,
    _items?: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
    _order?: Partial<FulfillmentOrderDTO>,
    _fulfillment?: Partial<Omit<FulfillmentDTO, "provider_id" | "data" | "items">>
  ): Promise<CreateFulfillmentResult> {
    // Não há etiqueta nem transportadora: a retirada é combinada por WhatsApp.
    return { data: {}, labels: [] }
  }

  async cancelFulfillment(_data?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return {}
  }

  async createReturnFulfillment(_fulfillment?: Record<string, unknown>): Promise<CreateFulfillmentResult> {
    return { data: {}, labels: [] }
  }
}
