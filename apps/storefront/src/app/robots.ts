import { MetadataRoute } from "next"
import { getBaseURL } from "@lib/util/env"

// robots.txt — permite indexação, bloqueia áreas privadas/transacionais e aponta o sitemap.
export default function robots(): MetadataRoute.Robots {
  const base = getBaseURL()
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/*/account", "/*/cart", "/*/checkout", "/*/order", "/*/busca"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
