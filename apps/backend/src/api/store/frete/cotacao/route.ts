// Frete e prazo de UMA peça pelo CEP, para a página do produto (referência bechose.com.br, pedido da
// sócia em 2026-10-10): a cliente vê preço e prazo antes de pôr na sacola. Mesmo cotador/cache do
// checkout (cotador.ts); peso = da variante, senão do produto, senão o padrão da embalagem.
// Nunca derruba a PDP: sem CEP válido, sem token ou com a API fora do ar, devolve `{ opcoes: [] }`.
// O frete grátis NÃO é aplicado aqui (depende do UF e do total da sacola): a vitrine mostra a régua.
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { obterCotador } from "../../../../modules/superfrete/cotador"
import { cabeNoMiniEnvios, montarPacote } from "../../../../modules/superfrete/embalagem"
import { parametrosDoAmbiente } from "../../../../modules/superfrete/parametros"
import { precosDeVitrine } from "../../../../modules/superfrete/preco"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  res.setHeader("Cache-Control", "no-store")
  const cep = String(req.query.cep ?? "").replace(/\D/g, "")
  const variantId = typeof req.query.variant_id === "string" ? req.query.variant_id.trim() : ""
  if (cep.length !== 8) throw new MedusaError(MedusaError.Types.INVALID_DATA, "cep precisa ter 8 dígitos.")
  if (!variantId) throw new MedusaError(MedusaError.Types.INVALID_DATA, "variant_id é obrigatório.")

  const query: any = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product_variant",
    fields: ["id", "weight", "product.weight"],
    filters: { id: variantId },
  })
  const variante = data?.[0]
  if (!variante) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Variante não encontrada.")

  const opcoes: { servico: string; centavos: number; prazo_min: number; prazo_max: number }[] = []
  try {
    const pacote = montarPacote([{ quantidade: 1, peso_g: variante.weight ?? variante.product?.weight ?? null }])
    const cotacoes = (await obterCotador().cotar(cep, pacote)).filter((c) => c.servico !== "mini" || cabeNoMiniEnvios(pacote))
    const visiveis = precosDeVitrine(cotacoes, parametrosDoAmbiente())
    for (const c of cotacoes) {
      const preco = visiveis[c.servico]
      if (typeof preco === "number") opcoes.push({ servico: c.servico, centavos: preco, prazo_min: c.prazoMin, prazo_max: c.prazoMax })
    }
    opcoes.sort((a, b) => a.centavos - b.centavos || a.prazo_max - b.prazo_max)
  } catch (e) {
    const logger: any = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
    logger.error(`[superfrete] cotação da peça indisponível: ${(e as Error).message}`)
  }
  res.json({ opcoes })
}
