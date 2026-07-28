// Tabela de medidas DENTRO da PDP (spec, Nota 09) — tamanho errado é a causa
// nº 1 de troca; a tabela fica na página de decisão, não a dois cliques.
const ROWS = [
  ["P", "82–88 cm", "62–68 cm", "88–94 cm"],
  ["M", "88–94 cm", "68–74 cm", "94–100 cm"],
  ["G", "94–100 cm", "74–80 cm", "100–106 cm"],
  ["GG", "100–108 cm", "80–88 cm", "106–114 cm"],
]

export default function SizeGuide() {
  return (
    <section id="medidas" className="scroll-mt-24">
      <h2 className="font-serif text-2xl text-eclat-grafite mb-4">
        Acerte o tamanho de primeira
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-ui-border-base rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-eclat-areia/30 text-left">
              {["Tamanho", "Busto", "Cintura", "Quadril"].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2 text-[11px] uppercase tracking-wider text-eclat-grafite/60 font-medium"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r[0]} className="border-t border-ui-border-base">
                <td className="px-3 py-2 font-semibold">{r[0]}</td>
                <td className="px-3 py-2">{r[1]}</td>
                <td className="px-3 py-2">{r[2]}</td>
                <td className="px-3 py-2">{r[3]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-eclat-grafite/60 mt-3 leading-relaxed">
        <strong>Dica ÉCLAT:</strong> nossos tecidos têm compressão com
        elasticidade — entre dois tamanhos, escolha o menor para mais
        sustentação ou o maior para mais conforto. Na dúvida, chame no WhatsApp
        que a gente ajuda a acertar de primeira.
      </p>
    </section>
  )
}
