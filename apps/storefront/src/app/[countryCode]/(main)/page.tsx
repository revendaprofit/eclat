import { Metadata } from "next"
import { imagensOg } from "@lib/util/og"

import Hero, { HeroContent } from "@modules/home/components/hero"
import EditorialBanner from "@modules/home/components/editorial-banner"
import FaixaCondicoes from "@modules/home/components/faixa-condicoes"
import CategoriasStories from "@modules/home/components/categorias-stories"
import VitrineAbas from "@modules/home/components/vitrine-abas"
import Testimonials from "@modules/home/components/testimonials"
import Newsletter from "@modules/home/components/newsletter"
import ClubeEclat from "@modules/home/components/clube-eclat"
import BannerMomentos from "@modules/home/components/banner-momentos"
import Universos from "@modules/home/components/universos"
import Fundadora from "@modules/home/components/fundadora"
import Instagram from "@modules/home/components/instagram"
import AvisoFrete from "@modules/home/components/aviso-frete"
import { getCondicoesDaLoja } from "@lib/data/condicoes"
import { fraseFreteGratis, reais } from "@lib/util/condicoes"
import { listCollections } from "@lib/data/collections"
import { getRegion } from "@lib/data/regions"
import { getSiteContent } from "@lib/data/site-content"
import {
  isVisible,
  EditorialBanner as EditorialBannerType,
  Testimonials as TestimonialsType,
  Newsletter as NewsletterType,
  Clube as ClubeType,
  Instagram as InstagramType,
  BannerMomentos as BannerMomentosType,
  Universos as UniversosType,
  Fundadora as FundadoraType,
} from "@modules/home/content"

export async function generateMetadata(props: {
  params: Promise<{ countryCode: string }>
}): Promise<Metadata> {
  const { countryCode } = await props.params
  const seo = await getSiteContent<{
    title?: string
    description?: string
    og_image_url?: string
  }>("seo.home")
  const title = seo?.title || "use.ÉCLAT — athleisure da mulher inteira"
  const description =
    seo?.description ||
    "Moda fitness premium e independente. Leggings, tops e conjuntos que sustentam, valorizam e resplandecem."
  const path = `/${countryCode}`
  return {
    // absolute: título da home já contém a marca — não passar pelo template "%s · use.ÉCLAT"
    title: { absolute: title },
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      url: path,
      images: imagensOg(seo?.og_image_url),
    },
  }
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await props.params

  const [region, collectionsRes, heroContent, banner, newsletter, testimonials, clube, instagram, momentos, universos, fundadora] = await Promise.all([
    getRegion(countryCode),
    listCollections({ fields: "id, handle, title" }),
    getSiteContent<HeroContent>("hero"),
    getSiteContent<EditorialBannerType>("home.banner"),
    getSiteContent<NewsletterType>("home.newsletter"),
    getSiteContent<TestimonialsType>("home.testimonials"),
    getSiteContent<ClubeType>("home.clube"),
    getSiteContent<InstagramType>("home.instagram"),
    getSiteContent<BannerMomentosType>("home.momentos"),
    getSiteContent<UniversosType>("home.universos"),
    getSiteContent<FundadoraType>("home.fundadora"),
  ])

  const collections = collectionsRes?.collections

  if (!collections || !region) {
    return null
  }

  // Aviso de frete na capa (sócia, 30/10): a mesma frase da barra do topo, num cartão discreto no pé da tela.
  const { pisos } = await getCondicoesDaLoja()
  const fraseFrete = fraseFreteGratis(pisos, (c) => reais(c, { curto: true }))

  return (
    <>
      <Hero
        content={heroContent}
        fallbackCollection={{
          title: collections[0]?.title,
          handle: collections[0]?.handle,
        }}
      />

      <FaixaCondicoes />
      <AvisoFrete titulo="Envio para todo o Brasil" texto={fraseFrete} />

      {/* Home de 2026-10-10 (sócia, referência bechose.com.br): metade da altura de antes. Ordem:
          capa → condições → categorias (stories) → vitrine com abas → Conjuntos → vitrine por cor →
          banner "todos os momentos" (praia) → Clube → depoimentos → Instagram (reels) → newsletter. Manifesto, "Nossas linhas", "Detalhes que fazem
          a diferença", benefícios e FAQ saíram da home (os dois últimos continuam na página do produto). */}
      <CategoriasStories countryCode={countryCode} />

      <VitrineAbas region={region} countryCode={countryCode} />

      {/* Depoimentos logo depois da vitrine (diagnóstico do funil, 2026-10-27): prova social perto do topo,
          não no fim da página. */}
      {isVisible(testimonials) && <Testimonials content={testimonials} />}

      {isVisible(universos) && <Universos content={universos} />}

      {isVisible(banner) && <EditorialBanner content={banner} />}

      {/* "Escolha a cor" (VitrineCores) saiu da home em 2026-10-11 (sócia): com só Telha e Grafitti o bloco
          repete a vitrine. O componente fica em modules/home/components/vitrine-cores — volta quando houver
          mais cores. */}

      {isVisible(momentos) && <BannerMomentos content={momentos} />}

      {isVisible(clube) && <ClubeEclat content={clube} />}

      {isVisible(fundadora) && <Fundadora content={fundadora} />}

      {isVisible(instagram) && <Instagram content={instagram} />}

      {isVisible(newsletter) && <Newsletter content={newsletter} />}
    </>
  )
}
