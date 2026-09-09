import { Metadata } from "next"
import { notFound } from "next/navigation"

import { getConjunto } from "@lib/data/conjuntos"
import { getRegion } from "@lib/data/regions"
import ConjuntoTemplate from "@modules/conjuntos/templates/conjunto"

type Props = {
  params: Promise<{ countryCode: string; handle: string }>
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const resultado = await getConjunto(params.handle, params.countryCode)

  if (!resultado) {
    notFound()
  }

  const { card } = resultado
  const description = `Conjunto ${card.nome}: ${card.pecas
    .map((p) => p.title)
    .join(" + ")}. Benefício exclusivo use.ÉCLAT ao levar as peças juntas.`
  const path = `/${params.countryCode}/conjuntos/${params.handle}`
  const imagem = card.capa ?? card.pecas[0]?.thumbnail ?? null

  return {
    // o template do layout raiz acrescenta "· use.ÉCLAT"
    title: `Conjunto ${card.nome}`,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: `Conjunto ${card.nome} | use.ÉCLAT`,
      description,
      url: path,
      images: imagem ? [imagem] : [],
    },
  }
}

export default async function ConjuntoPage(props: Props) {
  const params = await props.params
  const region = await getRegion(params.countryCode)

  if (!region) {
    notFound()
  }

  const resultado = await getConjunto(params.handle, params.countryCode)

  if (!resultado) {
    notFound()
  }

  return (
    <ConjuntoTemplate
      card={resultado.card}
      produtos={resultado.produtos}
      countryCode={params.countryCode}
    />
  )
}
