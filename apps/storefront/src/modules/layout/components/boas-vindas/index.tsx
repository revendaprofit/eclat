import { getSiteContent } from "@lib/data/site-content"
import { lerConfigBoasVindas } from "@lib/util/boas-vindas"
import AvisoBoasVindas from "./aviso-adiado"
import Envelopes from "../envelopes/adiado"
import { lerConfigEnvelopes } from "@lib/util/envelopes"
import { getPrevenda } from "@lib/data/prevenda"
import { lerPresenteDaBarra } from "@lib/util/condicoes"

// Aviso de boas-vindas: ligado/desligado pelo Cockpit (site_content "boas_vindas"). O código do
// cupom NÃO vai para o navegador aqui — só o percentual; o código volta depois do cadastro.
export default async function BoasVindas() {
  const bruto = await getSiteContent("boas_vindas")
  if (lerConfigEnvelopes(bruto)) return <Envelopes whatsappMarca={(await getPrevenda()).whatsapp} />
  const config = lerConfigBoasVindas(bruto)
  if (!config) return null
  if (config.modo === "presente") {
    const presente = lerPresenteDaBarra(await getSiteContent("brindes"))
    return <AvisoBoasVindas modo="presente" percentual={0} minimoPresente={presente?.minimo_centavos ?? null} />
  }
  return <AvisoBoasVindas modo="cupom" percentual={config.percentual} />
}
