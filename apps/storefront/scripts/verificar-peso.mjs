// Trava de peso do site (03/11): roda logo depois do `next build`. Se a página passar do teto, o build falha,
// a Vercel não publica e o site continua na versão anterior. Tetos em KB comprimidos, medidos em 03/11 com folga
// pequena: para subir um teto é preciso editar este arquivo, de propósito, sabendo o que está pesando.
// Urgência real (conserto que não pode esperar): PESO_SEM_TRAVA=1 no ambiente da Vercel, e retirar depois.
import fs from "node:fs"
import path from "node:path"
import zlib from "node:zlib"

const TETOS = {
  "Página de produto": {
    rotas: ["/layout", "/[countryCode]/(main)/layout", "/[countryCode]/(main)/products/[handle]/page"],
    js: 230,
    css: 25,
  },
  Capa: {
    rotas: ["/layout", "/[countryCode]/(main)/layout", "/[countryCode]/(main)/page"],
    js: 205,
    css: 25,
  },
}
// Arquivos em public/, em KB. HTML fica de fora: catálogo e links são páginas à parte, não entram na vitrine.
const TETO_FOTO = 300
const TETO_VIDEO = 1536
const FOTO = /\.(jpe?g|png|webp|avif|gif)$/i
const VIDEO = /\.(mp4|webm|mov)$/i

const raiz = process.cwd()
const next = path.join(raiz, ".next")
const ler = (f) => JSON.parse(fs.readFileSync(path.join(next, f), "utf8"))
const gzipKb = (f) => zlib.gzipSync(fs.readFileSync(path.join(next, f))).length / 1024

const paginas = ler("app-build-manifest.json").pages
const base = ler("build-manifest.json").rootMainFiles
const problemas = []
const medido = {}

for (const [nome, teto] of Object.entries(TETOS)) {
  for (const rota of teto.rotas) {
    // Rota renomeada não pode desligar a trava em silêncio.
    if (!paginas[rota]) problemas.push(`${nome}: a rota ${rota} não existe mais; atualize scripts/verificar-peso.mjs`)
  }
  const arquivos = new Set([...base, ...teto.rotas.flatMap((r) => paginas[r] ?? [])])
  const soma = (fim) => Math.round([...arquivos].filter((f) => f.endsWith(fim)).reduce((t, f) => t + gzipKb(f), 0))
  const js = soma(".js")
  const css = soma(".css")
  medido[nome] = { js, css }
  console.log(`[peso] ${nome}: JS ${js} KB (teto ${teto.js}) · CSS ${css} KB (teto ${teto.css})`)
  if (js > teto.js) problemas.push(`${nome}: JS com ${js} KB, teto ${teto.js} KB`)
  if (css > teto.css) problemas.push(`${nome}: CSS com ${css} KB, teto ${teto.css} KB`)
}

const percorrer = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? percorrer(p) : [p]
  })
for (const f of percorrer(path.join(raiz, "public"))) {
  const kb = Math.round(fs.statSync(f).size / 1024)
  const nome = path.relative(raiz, f).replaceAll("\\", "/")
  if (FOTO.test(f) && kb > TETO_FOTO) problemas.push(`${nome}: foto com ${kb} KB, teto ${TETO_FOTO} KB`)
  if (VIDEO.test(f) && kb > TETO_VIDEO) problemas.push(`${nome}: vídeo com ${kb} KB, teto ${TETO_VIDEO} KB`)
}

// Fica publicado em /_next/static/peso-build.json: a conferência diária lê daqui e confirma que a trava rodou.
fs.writeFileSync(
  path.join(next, "static", "peso-build.json"),
  JSON.stringify({ medido, tetos: TETOS, problemas, semTrava: process.env.PESO_SEM_TRAVA === "1" }, null, 2)
)

if (problemas.length) {
  console.error(`\n[peso] SITE ACIMA DO LIMITE:\n${problemas.map((p) => `  - ${p}`).join("\n")}\n`)
  if (process.env.PESO_SEM_TRAVA === "1") {
    console.error("[peso] PESO_SEM_TRAVA=1: publicando mesmo assim. Retire a variável depois do conserto.")
  } else {
    console.error("[peso] Publicação barrada. O site segue na versão anterior.")
    process.exit(1)
  }
}
