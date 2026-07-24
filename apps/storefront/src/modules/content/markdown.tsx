import React from "react"

// Renderizador Markdown mínimo e seguro (sem dependência externa, sem HTML cru):
// suporta ## / ### títulos, parágrafos, listas (- ), **negrito**, *itálico*
// e [links](url). Todo texto vira React node — nunca innerHTML.

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  // links, negrito, itálico — processados na ordem em que aparecem
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    if (m[1] && m[2]) {
      const external = /^https?:\/\//.test(m[2])
      nodes.push(
        <a
          key={`${keyPrefix}-a${i}`}
          href={m[2]}
          className="underline decoration-eclat-dourado underline-offset-4 hover:text-eclat-terracota"
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {m[1]}
        </a>
      )
    } else if (m[3]) {
      nodes.push(<strong key={`${keyPrefix}-b${i}`}>{m[3]}</strong>)
    } else if (m[4]) {
      nodes.push(<em key={`${keyPrefix}-i${i}`}>{m[4]}</em>)
    }
    last = re.lastIndex
    i++
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

export default function Markdown({ source }: { source: string }) {
  const blocks = source.replace(/\r\n/g, "\n").split(/\n{2,}/)
  return (
    <div className="flex flex-col gap-5 text-eclat-grafite/90 leading-relaxed">
      {blocks.map((block, bi) => {
        const b = block.trim()
        if (!b) return null
        if (b.startsWith("### ")) {
          return (
            <h3 key={bi} className="font-serif text-xl text-eclat-grafite mt-2">
              {renderInline(b.slice(4), `h3-${bi}`)}
            </h3>
          )
        }
        if (b.startsWith("## ")) {
          return (
            <h2 key={bi} className="font-serif text-2xl text-eclat-grafite mt-4">
              {renderInline(b.slice(3), `h2-${bi}`)}
            </h2>
          )
        }
        const lines = b.split("\n")
        if (lines.every((l) => l.trim().startsWith("- "))) {
          return (
            <ul key={bi} className="list-disc ml-6 flex flex-col gap-1.5">
              {lines.map((l, li) => (
                <li key={li}>{renderInline(l.trim().slice(2), `li-${bi}-${li}`)}</li>
              ))}
            </ul>
          )
        }
        return <p key={bi}>{renderInline(b, `p-${bi}`)}</p>
      })}
    </div>
  )
}
