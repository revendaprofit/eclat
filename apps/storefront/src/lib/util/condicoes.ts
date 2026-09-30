// Condições comerciais da loja (parcelamento, juros, desconto no Pix, frete grátis, cupom de boas-vindas).
// Fonte única de TODO texto sobre "como pagar": barra do topo, faixa da home, card, PDP e conjunto.
// Valores gravados em site_content key "condicoes" (Cockpit); sem registro valem os padrões abaixo.
//
// Os padrões são os que já são verdade hoje. "Sem juros" e "desconto no Pix" só aparecem quando
// estiverem ligados de fato: sem_juros depende da configuração da conta Mercado Pago (a loja absorve
// os juros) e pix_percentual depende do desconto entrar no carrinho (backend). Ligar antes disso
// faria o site prometer um valor diferente do cobrado.

export type Condicoes = {
  parcelas: number // máximo de parcelas no cartão (o checkout trava no mesmo número)
  sem_juros: boolean // true só com a conta Mercado Pago configurada para absorver os juros
  pix_percentual: number // desconto no Pix, em %; 0 = sem desconto
}

export const CONDICOES_PADRAO: Condicoes = { parcelas: 4, sem_juros: false, pix_percentual: 0 }

/** Lê o registro do Cockpit com tolerância: campo ausente ou inválido cai no padrão. */
export function lerCondicoes(salvo: unknown): Condicoes {
  const s = (salvo && typeof salvo === "object" ? salvo : {}) as Record<string, unknown>
  const parcelas = Number(s.parcelas)
  const pix = Number(s.pix_percentual)
  return {
    parcelas: Number.isInteger(parcelas) && parcelas >= 1 && parcelas <= 12 ? parcelas : CONDICOES_PADRAO.parcelas,
    sem_juros: s.sem_juros === true,
    pix_percentual: Number.isFinite(pix) && pix > 0 && pix < 50 ? pix : 0,
  }
}

/** Preço do Medusa (reais) → centavos inteiros. Toda conta abaixo é em centavos (CLAUDE.md: nunca float). */
export const emCentavos = (reais: number) => Math.round(reais * 100)

/** Valor de cada parcela, em centavos, arredondado ao centavo. */
export function parcelaEmCentavos(precoCentavos: number, parcelas: number): number {
  return Math.round(precoCentavos / parcelas)
}

/** Preço no Pix, em centavos. Sem desconto configurado, devolve o próprio preço. */
export function pixEmCentavos(precoCentavos: number, percentual: number): number {
  if (!(percentual > 0)) return precoCentavos
  return precoCentavos - Math.round((precoCentavos * percentual) / 100)
}

/** Recebe centavos e devolve o texto em reais. */
export type Formatar = (centavos: number) => string

/** "4x de R$ 74,75 sem juros" — só quando for sem juros (parcela com juros não tem valor fixo). */
export function linhaParcelamento(precoCentavos: number, c: Condicoes, fmt: Formatar): string | null {
  if (!c.sem_juros || c.parcelas < 2 || !(precoCentavos > 0)) return null
  return `${c.parcelas}x de ${fmt(parcelaEmCentavos(precoCentavos, c.parcelas))} sem juros`
}

/** "R$ 284,05 no Pix" — só com desconto no Pix ligado. */
export function linhaPix(precoCentavos: number, c: Condicoes, fmt: Formatar): string | null {
  if (!(c.pix_percentual > 0) || !(precoCentavos > 0)) return null
  return `${fmt(pixEmCentavos(precoCentavos, c.pix_percentual))} no Pix`
}

/** Como falar do cartão sem prometer o que não existe. */
export function fraseCartao(c: Condicoes): string {
  if (c.parcelas < 2) return "Cartão de crédito"
  return c.sem_juros ? `${c.parcelas}x sem juros no cartão` : `Até ${c.parcelas}x no cartão`
}

export function frasePix(c: Condicoes): string {
  return c.pix_percentual > 0 ? `${formatarPercentual(c.pix_percentual)} de desconto no Pix` : "Pagamento por Pix"
}

function formatarPercentual(p: number): string {
  return `${Number.isInteger(p) ? p : p.toLocaleString("pt-BR")}%`
}

/** Pisos em centavos (rota /store/frete/regras) → "Frete grátis a partir de R$ 499 em MG e R$ 599 nos demais estados". */
export function fraseFreteGratis(
  pisos: { piso_mg: number; piso_brasil: number } | null,
  fmt: Formatar,
  opcoes: { curta?: boolean } = {}
): string | null {
  if (!pisos) return null
  const mg = pisos.piso_mg
  const br = pisos.piso_brasil
  if (br <= 0 && mg <= 0) return "Frete grátis para todo o Brasil"
  if (mg === br) return `Frete grátis a partir de ${fmt(br)}`
  // curta: cabe numa linha da barra do topo no celular (375 px)
  if (opcoes.curta) return `Frete grátis: ${fmt(mg)} em MG, ${fmt(br)} no Brasil`
  return `Frete grátis a partir de ${fmt(mg)} em MG e ${fmt(br)} nos demais estados`
}

/** Frases da barra do topo, na ordem em que aparecem (no celular, uma por vez). */
export function frasesDaBarra(args: {
  condicoes: Condicoes
  cupom: { codigo: string; percentual: number } | null
  pisos: { piso_mg: number; piso_brasil: number } | null
  fmt: Formatar
}): string[] {
  const { condicoes, cupom, pisos, fmt } = args
  const frases: string[] = []
  if (cupom) frases.push(`${formatarPercentual(cupom.percentual)} OFF na 1ª compra com o cupom ${cupom.codigo}`)
  frases.push(fraseCartao(condicoes))
  if (condicoes.pix_percentual > 0) frases.push(frasePix(condicoes))
  const frete = fraseFreteGratis(pisos, fmt, { curta: true })
  if (frete) frases.push(frete)
  return frases
}

/** Centavos → reais no padrão brasileiro. Valor redondo sai sem centavos ("R$ 499") só com `curto`. */
export function reais(centavos: number, opcoes: { curto?: boolean } = {}): string {
  const redondo = centavos % 100 === 0 && opcoes.curto
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: redondo ? 0 : 2,
    maximumFractionDigits: redondo ? 0 : 2,
  }).format(centavos / 100)
}
