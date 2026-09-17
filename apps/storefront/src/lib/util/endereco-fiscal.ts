// O contrato com a camada fiscal do backend. Funções PURAS.
//
// As chaves aqui NÃO são escolha nossa: apps/backend/src/lib/fiscal/fiscal-pedido.ts
// lê exatamente `numero`, `bairro` e `municipio_ibge` do metadata do endereço.
// Mudar um nome aqui quebra a emissão de nota sem quebrar teste nenhum do checkout.

export type MetadataFiscal = {
  numero: string
  bairro: string
  municipio_ibge: string
}

export function montarMetadataFiscal(args: {
  numero: string
  bairro: string
  ibge: string
}): MetadataFiscal {
  return {
    // Imóvel sem número existe, e a NF-e aceita "S/N". Deixar vazio faria o
    // despacho recusar por um dado que a cliente não tem como fornecer.
    numero: args.numero.trim() || "S/N",
    bairro: args.bairro.trim(),
    municipio_ibge: args.ibge.trim(),
  }
}
