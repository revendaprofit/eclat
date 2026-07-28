import { HttpTypes } from "@medusajs/types"

// Bloco DSB (Dor → Solução → Benefício) da PDP — spec, Nota 01.
// Vem de product.metadata: dsb_dor, dsb_solucao, dsb_beneficios (uma por linha).
// Sem metadata, não renderiza nada (a descrição padrão continua).

function lines(v: unknown): string[] {
  return typeof v === "string"
    ? v.split(String.fromCharCode(10)).map((s) => s.trim()).filter(Boolean)
    : []
}

export default function DsbHero({
  product,
}: {
  product: HttpTypes.StoreProduct
}) {
  const meta = product.metadata ?? {}
  const dor = typeof meta.dsb_dor === "string" ? meta.dsb_dor : null
  const solucao = typeof meta.dsb_solucao === "string" ? meta.dsb_solucao : null
  const beneficios = lines(meta.dsb_beneficios)

  if (!dor && !solucao && beneficios.length === 0) return null

  return (
    <div className="flex flex-col gap-y-3 mt-2">
      {dor && (
        <p className="font-serif text-2xl leading-snug text-eclat-grafite">
          {dor}
        </p>
      )}
      {solucao && (
        <p className="text-sm text-eclat-grafite/75 leading-relaxed border-l-2 border-eclat-terracota pl-3">
          {solucao}
        </p>
      )}
      {beneficios.length > 0 && (
        <ul className="flex flex-col gap-2 mt-1">
          {beneficios.map((b) => (
            <li key={b} className="flex gap-2.5 items-start text-[13.5px] leading-snug">
              <span className="flex-none w-[18px] h-[18px] rounded-full bg-[#3E7A55] text-white flex items-center justify-center text-[10px] font-extrabold mt-0.5">
                ✓
              </span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
