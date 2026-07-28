// Selos de garantia ao lado da decisão de compra (spec PDP, Nota 08).
// Prazos REAIS da política — separados e honestos, sem promessa inflada.
export default function GuaranteeSeals() {
  const seals = [
    { b: "7 dias", s: "arrependimento (CDC)" },
    { b: "30 dias", s: "troca por defeito" },
    { b: "WhatsApp", s: "a gente organiza a troca" },
  ]
  return (
    <div className="grid grid-cols-3 gap-2 mt-4">
      {seals.map((x) => (
        <div
          key={x.b}
          className="border border-ui-border-base rounded-lg px-2 py-2.5 text-center"
        >
          <span className="block text-xs font-semibold text-eclat-grafite leading-tight">
            {x.b}
          </span>
          <span className="block text-[10px] text-eclat-grafite/60 mt-0.5 leading-tight">
            {x.s}
          </span>
        </div>
      ))}
    </div>
  )
}
