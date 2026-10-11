import { getSiteContent } from "@lib/data/site-content"
import type { Testimonials as TestimonialsType } from "@modules/home/content"
import Testimonials from "@modules/home/components/testimonials"

// Depoimentos na PDP (spec, Nota 05): a prova social da home na página de decisão. Desde 2026-10-11 é o
// mesmo bloco da home (prints reais em moldura), limitado a 6.
export default async function PdpTestimonials() {
  const content = await getSiteContent<TestimonialsType>("home.testimonials")
  return <Testimonials content={content} max={6} compacto />
}
