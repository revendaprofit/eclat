import { Metadata } from "next"

import FeaturedProducts from "@modules/home/components/featured-products"
import Hero, { HeroContent } from "@modules/home/components/hero"
import Manifesto from "@modules/home/components/manifesto"
import FeaturedLines from "@modules/home/components/featured-lines"
import EditorialBanner from "@modules/home/components/editorial-banner"
import Benefits from "@modules/home/components/benefits"
import Newsletter from "@modules/home/components/newsletter"
import { listCollections } from "@lib/data/collections"
import { getRegion } from "@lib/data/regions"
import { getSiteContent } from "@lib/data/site-content"
import {
  isVisible,
  Manifesto as ManifestoType,
  FeaturedLines as FeaturedLinesType,
  FeaturedCollection as FeaturedCollectionType,
  EditorialBanner as EditorialBannerType,
  Benefits as BenefitsType,
  Newsletter as NewsletterType,
  HOME_DEFAULTS,
} from "@modules/home/content"

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSiteContent<{
    title?: string
    description?: string
    og_image_url?: string
  }>("seo.home")
  const title = seo?.title || "use.ÉCLAT — athleisure da mulher inteira"
  const description =
    seo?.description ||
    "Moda fitness premium e independente. Leggings, tops e conjuntos que sustentam, valorizam e resplandecem."
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: seo?.og_image_url ? [{ url: seo.og_image_url }] : undefined,
    },
  }
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await props.params

  const [
    region,
    collectionsRes,
    heroContent,
    manifesto,
    lines,
    featured,
    banner,
    benefits,
    newsletter,
  ] = await Promise.all([
    getRegion(countryCode),
    listCollections({ fields: "id, handle, title" }),
    getSiteContent<HeroContent>("hero"),
    getSiteContent<ManifestoType>("home.manifesto"),
    getSiteContent<FeaturedLinesType>("home.lines"),
    getSiteContent<FeaturedCollectionType>("home.featured"),
    getSiteContent<EditorialBannerType>("home.banner"),
    getSiteContent<BenefitsType>("home.benefits"),
    getSiteContent<NewsletterType>("home.newsletter"),
  ])

  const collections = collectionsRes?.collections

  if (!collections || !region) {
    return null
  }

  // coleção em destaque: a escolhida no cockpit ou a primeira
  const featuredCollection =
    collections.find((c) => c.handle === featured?.collection_handle) ||
    collections[0]

  return (
    <>
      <Hero
        content={heroContent}
        fallbackCollection={{
          title: collections[0]?.title,
          handle: collections[0]?.handle,
        }}
      />

      {isVisible(manifesto) && <Manifesto content={manifesto} />}

      {isVisible(lines) && <FeaturedLines content={lines} />}

      {isVisible(featured) && featuredCollection && (
        <section className="content-container">
          <h2 className="font-serif text-3xl small:text-4xl text-eclat-grafite text-center pt-4">
            {featured?.heading || HOME_DEFAULTS.featured.heading}
          </h2>
          <ul className="flex flex-col gap-x-6">
            <FeaturedProducts
              collections={[featuredCollection]}
              region={region}
            />
          </ul>
        </section>
      )}

      {isVisible(banner) && <EditorialBanner content={banner} />}

      {isVisible(benefits) && <Benefits content={benefits} />}

      {isVisible(newsletter) && <Newsletter content={newsletter} />}
    </>
  )
}
