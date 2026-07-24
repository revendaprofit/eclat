import { INDEXNOW_KEY } from "@lib/util/indexnow"

// Arquivo de verificação do IndexNow: /<chave>.txt deve conter a própria chave.
export function GET() {
  return new Response(INDEXNOW_KEY, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
