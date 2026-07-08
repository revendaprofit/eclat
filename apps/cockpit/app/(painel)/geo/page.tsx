const STORE = "https://www.useeclat.com.br"
const code =
  "px-1.5 py-0.5 bg-eclat-areia/60 rounded text-[12px] font-mono text-eclat-grafite break-all"

function Done({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2 text-sm text-eclat-grafite/80 leading-relaxed">
      <span className="text-green-700 mt-0.5">✓</span>
      <span>{children}</span>
    </li>
  )
}
function Step({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2 text-sm text-eclat-grafite/80 leading-relaxed">
      <span className="text-eclat-dourado mt-0.5">☐</span>
      <span>{children}</span>
    </li>
  )
}

export default function GeoPage() {
  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div>
        <h1 className="font-serif text-3xl text-eclat-grafite">GEO — busca por IA</h1>
        <p className="text-sm text-eclat-grafite/60 mt-1">
          GEO (Generative Engine Optimization) é fazer a marca ser <strong>encontrada e citada</strong>{" "}
          por ChatGPT, Perplexity, Gemini, Claude e Google AI Overviews.
        </p>
      </div>

      {/* JÁ NO AR */}
      <section className="border border-eclat-dourado/40 rounded-lg bg-white/60 p-5 flex flex-col gap-3">
        <h2 className="font-serif text-xl text-eclat-grafite">O que já está no ar (técnico)</h2>
        <ul className="flex flex-col gap-1.5">
          <Done><strong>Dados estruturados (Schema.org)</strong>: Organization, WebSite, Product (preço/estoque) e Breadcrumb — a maior alavanca de citação.</Done>
          <Done><strong>FAQ</strong> answer-first + schema FAQPage (edite em <em>Vitrine → FAQ</em>).</Done>
          <Done><strong>llms.txt</strong> em <code className={code}>{STORE}/llms.txt</code> (mapa da marca + feed).</Done>
          <Done><strong>Crawlers de IA liberados</strong> no robots.txt (GPTBot, PerplexityBot, ClaudeBot, Google-Extended…).</Done>
          <Done><strong>Feed de produtos</strong> em <code className={code}>{STORE}/feed.xml</code> (dados precisos para IA de compras).</Done>
        </ul>
      </section>

      {/* MONITORAMENTO */}
      <section className="border border-eclat-pedra/40 rounded-lg bg-white/60 p-5 flex flex-col gap-3 text-sm text-eclat-grafite/75">
        <h2 className="font-serif text-lg text-eclat-grafite">Monitorar citações (ferramenta externa)</h2>
        <p className="leading-relaxed">
          Para <strong>medir</strong> quando/como a IA cita a Éclat, assine uma ferramenta de AI
          visibility. Elas rastreiam menções, share of voice e sentimento nos motores de IA:
        </p>
        <ul className="list-disc ml-5 flex flex-col gap-1 leading-relaxed">
          <li><strong>Peec AI</strong> — cobre ChatGPT, Perplexity e Google AI Overviews (bom custo-benefício).</li>
          <li><strong>Goodie AI</strong> — visibilidade em ChatGPT/Gemini/Perplexity/Claude + recomendações.</li>
          <li><strong>SE Ranking</strong> — AI visibility dentro de um SEO completo (cruza com rankings).</li>
          <li><strong>Profound / AthenaHQ / Brandi</strong> — enterprise, análise mais profunda.</li>
        </ul>
        <p className="leading-relaxed text-eclat-grafite/60">
          Comece rastreando prompts como &quot;melhores marcas de legging de compressão no Brasil&quot;,
          &quot;roupa fitness que não fica transparente&quot;, &quot;athleisure premium brasileiro&quot;.
        </p>
      </section>

      {/* OFF-SITE */}
      <section className="border border-eclat-dourado/40 rounded-lg bg-eclat-areia/20 p-5 flex flex-col gap-3">
        <h2 className="font-serif text-xl text-eclat-grafite">Fora do site (você / gestor)</h2>
        <p className="text-xs text-eclat-grafite/55">
          A IA cita quando há <strong>consenso entre fontes independentes</strong>. Isto o código
          não faz — é trabalho de marca/PR:
        </p>
        <ul className="flex flex-col gap-1.5">
          <Step><strong>Reddit</strong>: presença/menções (ChatGPT e Perplexity citam muito Reddit).</Step>
          <Step><strong>Wikipedia / Wikidata</strong>: criar/consolidar a entidade da marca quando houver notabilidade.</Step>
          <Step><strong>PR editorial</strong>: matérias em veículos de moda/fitness (fontes que a IA confia).</Step>
          <Step><strong>Reviews de terceiros</strong>: avaliações em Google, marketplaces, influenciadoras.</Step>
          <Step><strong>Conteúdo datado e recente</strong>: Perplexity favorece publicações novas com o ano visível.</Step>
          <Step><strong>YouTube / vídeo</strong>: reviews e try-ons reforçam o &quot;sinal de consenso&quot;.</Step>
        </ul>
      </section>
    </div>
  )
}
