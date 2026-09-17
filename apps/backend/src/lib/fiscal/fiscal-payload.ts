// Monta o payload da NF-e de venda a partir do pedido do Medusa + perfil tributário (spec §7.1).
// Função PURA: não faz rede, não lê banco. Isso a torna testável sem credencial.
//
// Dinheiro: entra em centavos inteiros (Invariante 3) e só vira string decimal na fronteira
// com a API, que espera reais. A conversão é feita com aritmética inteira — nunca somando floats.

import { resolverPerfil } from "./fiscal-perfil"
import { ErroFiscal, type FiscalConfig, type FiscalPerfil, type ItemPedido } from "./tipos"

export type DestinatarioNF = {
  cpf: string
  nome: string
  logradouro: string
  numero: string
  complemento: string | null
  bairro: string
  municipio: string
  municipio_ibge: string
  uf: string
  cep: string
}

// Centavos inteiros -> "1234.56". Sem float em nenhum ponto.
function reais(centavos: number): string {
  const sinal = centavos < 0 ? "-" : ""
  const abs = Math.abs(centavos)
  return `${sinal}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`
}

export function montarPayloadVenda(args: {
  config: FiscalConfig
  perfis: FiscalPerfil[]
  itens: ItemPedido[]
  destinatario: DestinatarioNF
  frete_centavos: number
}): { payload: Record<string, unknown>; itens_ordenados: ItemPedido[] } {
  const { config, perfis, itens, destinatario, frete_centavos } = args

  if (itens.length === 0) {
    throw new ErroFiscal("Pedido sem itens: não há o que emitir.")
  }

  const ufDestino = destinatario.uf.trim().toUpperCase()
  const ufEmitente = config.uf.trim().toUpperCase()
  const interestadual = ufDestino !== ufEmitente

  for (const it of itens) {
    if (!it.ncm) {
      throw new ErroFiscal(
        `Produto "${it.titulo}" está sem NCM. Cadastre o NCM da variante (campo hs_code) em Produtos antes de emitir.`
      )
    }
  }

  // valor_desconto: nome de campo é a nossa melhor leitura da API da Brasil NFe — ainda não
  // confrontado com a documentação real (mesma situação de outros nomes já marcados como
  // pendentes de confirmação neste módulo).
  const linhas = itens.map((it, idx) => {
    const perfil = resolverPerfil(perfis, it.product_id, it.categoria_handle)
    // valor_unitario/produtos ficam no BRUTO; o desconto vai em campo próprio e é subtraído
    // só no total da linha e da nota — nunca escondido dentro do valor unitário.
    const totalCentavos = it.valor_unitario_centavos * it.quantidade - it.desconto_centavos
    return {
      numero_item: idx + 1,
      codigo: it.sku ?? it.line_item_id,
      descricao: it.titulo,
      ncm: it.ncm,
      cfop: interestadual ? perfil.cfop_fora_uf : perfil.cfop_dentro_uf,
      csosn: perfil.csosn,
      origem: it.origem != null ? it.origem : perfil.origem_padrao,
      unidade: "UN",
      quantidade: it.quantidade,
      valor_unitario: reais(it.valor_unitario_centavos),
      valor_desconto: reais(it.desconto_centavos),
      valor_total: reais(totalCentavos),
    }
  })

  const produtosCentavos = itens.reduce(
    (acc, it) => acc + it.valor_unitario_centavos * it.quantidade,
    0
  )
  const descontoCentavos = itens.reduce((acc, it) => acc + it.desconto_centavos, 0)

  const payload: Record<string, unknown> = {
    modelo: 55,
    serie: config.serie_nfe,
    ambiente: config.ambiente,
    finalidade: 1,
    tipo_nf: 1,
    ind_final: 1,
    ind_presenca: 2,
    ind_ie_destinatario: 9,
    natureza_operacao: "VENDA DE MERCADORIA",
    emitente: {
      cnpj: config.cnpj,
      razao_social: config.razao_social,
      nome_fantasia: config.nome_fantasia,
      ie: config.ie,
      crt: config.crt,
      logradouro: config.logradouro,
      numero: config.numero,
      complemento: config.complemento,
      bairro: config.bairro,
      municipio: config.municipio,
      municipio_ibge: config.municipio_ibge,
      // Normalizada (trim + maiúsculas), a MESMA variável usada acima para decidir o CFOP —
      // achado 5.5: gravar config.uf cru deixava a UF do emitente potencialmente diferente da
      // UF usada para decidir interestadual, o que é pior que qualquer um dos dois estados puros.
      uf: ufEmitente,
      cep: config.cep,
    },
    destinatario: {
      cpf: destinatario.cpf,
      nome: destinatario.nome,
      logradouro: destinatario.logradouro,
      numero: destinatario.numero,
      complemento: destinatario.complemento,
      bairro: destinatario.bairro,
      municipio: destinatario.municipio,
      municipio_ibge: destinatario.municipio_ibge,
      uf: ufDestino,
      cep: destinatario.cep,
    },
    itens: linhas,
    total: {
      valor_produtos: reais(produtosCentavos),
      valor_desconto: reais(descontoCentavos),
      valor_frete: reais(frete_centavos),
      valor_nota: reais(produtosCentavos - descontoCentavos + frete_centavos),
    },
  }

  return { payload, itens_ordenados: itens }
}
