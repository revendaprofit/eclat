import { getSiteContent } from "@lib/data/site-content"
import { lerConfigBoasVindas } from "@lib/util/boas-vindas"
import AvisoBoasVindas from "./aviso"

// Aviso de boas-vindas: ligado/desligado pelo Cockpit (site_content "boas_vindas"). O código do
// cupom NÃO vai para o navegador aqui — só o percentual; o código volta depois do cadastro.
export default async function BoasVindas() {
  const config = lerConfigBoasVindas(await getSiteContent("boas_vindas"))
  if (!config) return null
  return <AvisoBoasVindas percentual={config.percentual} />
}
