"use server"

import { sdk } from "@lib/config"
import { getSiteContent } from "@lib/data/site-content"
import { lerConfigBoasVindas, TEXTO_ACEITE } from "@lib/util/boas-vindas"
import { guardarContato, guardarEnvelope } from "@lib/data/cart"
import { ENVELOPES, TEXTO_ACEITE_ENVELOPE, lerConfigEnvelopes, lerEnvelopeId, type EnvelopeId } from "@lib/util/envelopes"
import { whatsappValido } from "@lib/util/contato-checkout"

// Cadastro do aviso de boas-vindas: o contato vira lead pelo backend (`POST /store/boas-vindas`,
// Supabase é do backend) e SÓ DEPOIS o cupom é devolvido — o código não viaja para o navegador
// antes do cadastro.
export async function cadastrarBoasVindas(dados: {
  whatsapp: string
  email?: string
  aceite: boolean
  site?: string
}): Promise<{ cupom: string | null; percentual: number } | { erro: string }> {
  const config = lerConfigBoasVindas(await getSiteContent("boas_vindas"))
  if (!config) return { erro: "Cadastro indisponível no momento." }
  try {
    await sdk.client.fetch("/store/boas-vindas", {
      method: "POST",
      body: { whatsapp: dados.whatsapp, email: dados.email || undefined, aceite: dados.aceite, texto_aceite: TEXTO_ACEITE, site: dados.site || undefined },
      cache: "no-store",
    })
    // Liga o contato ao carrinho (atual ou o próximo): sem isto o carrinho de quem deixou o
    // WhatsApp aparecia como "Só sacola" no Cockpit (caso real de 22/09).
    await guardarContato({ whatsapp: dados.whatsapp, email: dados.email })
    return { cupom: config.cupom, percentual: config.percentual }
  } catch (e) {
    const msg = (e as { message?: string })?.message
    return { erro: msg && msg.length < 120 ? msg : "Não foi possível cadastrar agora. Tenta de novo em instantes." }
  }
}

// Envelopes: o contato vira lead, com a escolha nas notas, e só o voucher devolve código, depois do cadastro.
export async function escolherEnvelope(dados: {
  whatsapp: string
  envelope: EnvelopeId
  site?: string
}): Promise<{ cupom: string | null } | { erro: string }> {
  const config = lerConfigEnvelopes(await getSiteContent("boas_vindas"))
  const id = lerEnvelopeId(dados.envelope)
  if (!config || !id) return { erro: "Indisponível no momento." }
  if (!whatsappValido(dados.whatsapp)) return { erro: "Confira o WhatsApp: DDD + número de celular, 11 dígitos." }
  const nota = ENVELOPES.find((e) => e.id === id)?.nota
  try {
    await sdk.client.fetch("/store/boas-vindas", {
      method: "POST",
      body: { whatsapp: dados.whatsapp, aceite: true, texto_aceite: `${TEXTO_ACEITE_ENVELOPE} Envelope: ${nota}`, site: dados.site },
      cache: "no-store",
    })
  } catch (e) {
    const msg = (e as { message?: string })?.message
    return { erro: msg && msg.length < 120 ? msg : "Não deu certo agora. Tente de novo em instantes." }
  }
  await guardarContato({ whatsapp: dados.whatsapp })
  await guardarEnvelope(id).catch(() => {})
  return { cupom: id === "voucher" ? config.cupom : null }
}
