import { ErroFiscal, type FiscalPerfil } from "./tipos"

export function resolverPerfil(
  perfis: FiscalPerfil[],
  productId: string,
  categoriaHandle: string | null
): FiscalPerfil {
  const ativos = perfis.filter((p) => p.ativo)

  const doProduto = ativos.find((p) => p.escopo === "produto" && p.alvo_id === productId)
  if (doProduto) return doProduto

  if (categoriaHandle) {
    const daCategoria = ativos.find(
      (p) => p.escopo === "categoria" && p.alvo_id === categoriaHandle
    )
    if (daCategoria) return daCategoria
  }

  const padrao = ativos.find((p) => p.escopo === "padrao")
  if (padrao) return padrao

  throw new ErroFiscal(
    "Nenhum perfil fiscal padrão ativo cadastrado. Cadastre o perfil padrão em Fiscal → Perfis antes de emitir."
  )
}
