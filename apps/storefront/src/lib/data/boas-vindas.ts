"use server"

import { sdk } from "@lib/config"
import { getSiteContent } from "@lib/data/site-content"
import { lerConfigBoasVindas, TEXTO_ACEITE } from "@lib/util/boas-vindas"

// Cadastro do aviso de boas-vindas: o contato vira lead pelo backend (`POST /store/boas-vindas`,
// Supabase é do backend) e SÓ DEPOIS o cupom é devolvido — o código não viaja para o navegador
// antes do cadastro.
export async function cadastrarBoasVindas(dados: {
  whatsapp: string
  email?: string
  aceite: boolean
  site?: string
}): Promise<{ cupom: string; percentual: number } | { erro: string }> {
  const config = lerConfigBoasVindas(await getSiteContent("boas_vindas"))
  if (!config) return { erro: "Cupom indisponível no momento." }
  try {
    await sdk.client.fetch("/store/boas-vindas", {
      method: "POST",
      body: { whatsapp: dados.whatsapp, email: dados.email || undefined, aceite: dados.aceite, texto_aceite: TEXTO_ACEITE, site: dados.site || undefined },
      cache: "no-store",
    })
    return { cupom: config.cupom, percentual: config.percentual }
  } catch (e) {
    const msg = (e as { message?: string })?.message
    return { erro: msg && msg.length < 120 ? msg : "Não foi possível cadastrar agora. Tenta de novo em instantes." }
  }
}
