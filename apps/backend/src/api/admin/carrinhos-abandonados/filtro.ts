// Quais carrinhos entram na lista de abandonados.
//
// Decisão do dono em 2026-09-21: tudo que existia até ali era teste (conferências de pagamento
// e frete feitas em produção, e compras de teste do próprio dono e da sócia) e sai da lista —
// com UMA exceção, a única cliente real que deixou contato. A lista recomeça do "marco zero".
//
// Os carrinhos não são apagados do banco, só deixam de aparecer: vários têm cobrança Pix
// ligada, e apagar carrinho por fora deixaria registro de pagamento órfão para a reconciliação
// do Mercado Pago. Tudo aqui é reversível mexendo nas variáveis do Railway.
//
// Configuração (Railway, fora do git — o repositório é público e aqui entram e-mails):
// - CARRINHOS_ABANDONADOS_DESDE        ISO 8601; carrinho criado antes disso não aparece
// - CARRINHOS_ABANDONADOS_MANTER       ids separados por vírgula que aparecem mesmo antes do marco
// - CARRINHOS_ABANDONADOS_IGNORAR      e-mails da equipe separados por vírgula (testes futuros)

export type ConfigDoFiltro = {
  desde: number | null
  manter: Set<string>
  ignorarEmails: Set<string>
}

/** E-mails de teste que o próprio sistema usa — nunca são clientes. */
const DOMINIOS_INTERNOS = ["@useeclat.com.br", "@eclat.local"]

const lista = (v: string | undefined) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

export function configDoAmbiente(env: NodeJS.ProcessEnv = process.env): ConfigDoFiltro {
  const desde = Date.parse(env.CARRINHOS_ABANDONADOS_DESDE ?? "")
  return {
    desde: Number.isFinite(desde) ? desde : null,
    manter: new Set(lista(env.CARRINHOS_ABANDONADOS_MANTER)),
    ignorarEmails: new Set(lista(env.CARRINHOS_ABANDONADOS_IGNORAR).map((e) => e.toLowerCase())),
  }
}

type CarrinhoParaFiltro = {
  id: string
  created_at: string | Date
  email?: string | null
  customer?: { email?: string | null } | null
}

export function entraNaLista(c: CarrinhoParaFiltro, cfg: ConfigDoFiltro): boolean {
  if (cfg.manter.has(c.id)) return true

  const email = (c.email ?? c.customer?.email ?? "").trim().toLowerCase()
  if (email && DOMINIOS_INTERNOS.some((d) => email.endsWith(d))) return false
  if (email && cfg.ignorarEmails.has(email)) return false

  if (cfg.desde !== null && new Date(c.created_at).getTime() < cfg.desde) return false
  return true
}
