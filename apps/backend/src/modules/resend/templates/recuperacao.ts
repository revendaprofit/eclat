// E-mail da recuperação automática (lib/recuperacao.ts, architecture/recuperacao.md). Um template,
// três textos: carrinho parado, Pix que expirou e lead do aviso de 10% do site. Mesmo layout dos
// e-mails de pedido. Tom de conversa, um botão, sem pressão.
import { COR, SERIFA, esc, layout } from "./layout"
import type { EmailPronto } from "./pedido-confirmado"

export type DadosRecuperacaoEmail = {
  gatilho: "carrinho" | "pix" | "lead_site" | "anuncio"
  primeiroNome: string | null
  /** Resumo pronto: "o Macaquinho Solaris (Telha / M) e mais 1 peça". */
  itens: string
  cupom: string | null
  link: string
  lojaUrl: string
  whatsapp: string
}

type Texto = { assunto: string; titulo: string; paragrafos: string[]; botao: string; previa: string }

function textos(d: DadosRecuperacaoEmail): Texto {
  const nome = d.primeiroNome ? `${d.primeiroNome}, ` : ""
  const cupom = d.cupom?.trim()
  const linhaCupom = cupom ? `Se for a sua primeira compra, use o cupom ${cupom} e ganhe 10% de desconto.` : null
  switch (d.gatilho) {
    case "pix":
      return {
        assunto: "Seu Pix expirou, mas suas peças continuam separadas",
        titulo: `${nome}seu Pix expirou`,
        paragrafos: [
          `O Pix do seu pedido (${d.itens}) venceu antes do pagamento. Acontece!`,
          "É só voltar à sacola que o site gera um Pix novo na hora.",
        ],
        botao: "Gerar um Pix novo",
        previa: "Volte à sacola e gere um Pix novo em um clique.",
      }
    case "lead_site":
      return {
        assunto: cupom ? `Seu cupom ${cupom} está esperando por você` : "Seu desconto está esperando por você",
        titulo: `${nome}seus 10% estão guardados`,
        paragrafos: [
          "Você deixou seu contato no nosso site para ganhar desconto na primeira compra.",
          cupom ? `Seu cupom é ${cupom}. É só usar na finalização do pedido.` : "O desconto entra na finalização do pedido.",
        ],
        botao: "Ver a coleção",
        previa: cupom ? `Use ${cupom} e ganhe 10% na primeira compra.` : "10% na primeira compra.",
      }
    default:
      return {
        assunto: "Você esqueceu algo na sua sacola",
        titulo: `${nome}suas peças continuam separadas`,
        paragrafos: [
          `Vimos que você escolheu ${d.itens} e não chegou a finalizar.`,
          "Ficou alguma dúvida de tamanho ou de frete? Responda este e-mail ou chame a gente no WhatsApp.",
          ...(linhaCupom ? [linhaCupom] : []),
        ],
        botao: "Voltar para a sacola",
        previa: "Suas peças continuam na sacola.",
      }
  }
}

// O link é montado pelo backend a partir do STOREFRONT_URL; mesmo assim só vira href se for http(s).
function linkSeguro(v: string, reserva: string): string {
  return /^https?:\/\//i.test(v) ? v : reserva
}

// "suas peças…" sem nome na frente vira "Suas peças…".
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function recuperacao(d: DadosRecuperacaoEmail): EmailPronto {
  const bruto = textos(d)
  const t = { ...bruto, titulo: maiuscula(bruto.titulo) }
  const link = linkSeguro(d.link, d.lojaUrl)
  const corpo = `<h1 style="margin:0 0 16px;font-family:${SERIFA};font-weight:normal;font-size:28px;line-height:1.2;color:${COR.terracota};">${esc(t.titulo)}</h1>
${t.paragrafos.map((p) => `<p style="margin:0 0 16px;">${esc(p)}</p>`).join("\n")}
<p style="margin:12px 0 28px;"><a href="${esc(link)}" style="display:inline-block;padding:14px 28px;background:${COR.terracota};color:${COR.luz};text-decoration:none;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;">${esc(t.botao)}</a></p>
<p style="margin:0 0 28px;font-size:12px;color:#8A8378;">Não quer mais receber este tipo de e-mail? Responda com "sair".</p>`

  const text = [
    t.titulo + ".",
    ...t.paragrafos,
    "",
    `${t.botao}: ${link}`,
    "",
    `WhatsApp: https://wa.me/${d.whatsapp}`,
    'Não quer mais receber este tipo de e-mail? Responda com "sair".',
  ].join("\n")

  return {
    subject: `${t.assunto} · use.ÉCLAT`,
    html: layout({ previa: t.previa, corpo, lojaUrl: d.lojaUrl, whatsapp: d.whatsapp }),
    text,
  }
}
