import { HttpTypes } from "@medusajs/types"

// "É pra você se… / Talvez não seja pra você" — spec, seção 02.
// Dizer para quem NÃO é aumenta a credibilidade de tudo que vem antes.
// Vem de product.metadata.quem_sim / quem_nao (um item por linha).

function lines(v: unknown): string[] {
  return typeof v === "string"
    ? v.split(String.fromCharCode(10)).map((s) => s.trim()).filter(Boolean)
    : []
}

export default function QuemE({
  product,
}: {
  product: HttpTypes.StoreProduct
}) {
  const sim = lines(product.metadata?.quem_sim)
  const nao = lines(product.metadata?.quem_nao)
  if (sim.length === 0 && nao.length === 0) return null

  return (
    <section className="mt-10">
      <h2 className="font-serif text-2xl text-eclat-grafite mb-4">
        É pra você se…
      </h2>
      <div className="grid grid-cols-1 small:grid-cols-2 gap-4">
        {sim.length > 0 && (
          <div className="rounded-xl border-2 border-[#3E7A55] p-4 bg-white/60">
            <h3 className="font-serif text-lg text-eclat-grafite mb-2.5">
              Feita pra você
            </h3>
            <ul className="flex flex-col gap-2">
              {sim.map((s) => (
                <li key={s} className="flex gap-2 text-[13px] leading-snug">
                  <span className="text-[#3E7A55] font-extrabold flex-none">✓</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {nao.length > 0 && (
          <div className="rounded-xl border border-ui-border-base p-4 bg-white/40">
            <h3 className="font-serif text-lg text-eclat-grafite mb-2.5">
              Talvez não seja pra você
            </h3>
            <ul className="flex flex-col gap-2 text-eclat-grafite/55">
              {nao.map((s) => (
                <li key={s} className="flex gap-2 text-[13px] leading-snug">
                  <span className="font-extrabold flex-none">×</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}
