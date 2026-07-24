// IndexNow (Bing/Copilot, Seznam, Naver…): protocolo de push de URLs.
// A chave é PÚBLICA por design (prova de posse do domínio) — servida em
// /<chave>.txt. Ping: POST https://api.indexnow.org/indexnow
export const INDEXNOW_KEY = "b513bfa6acd53fb1d42216ee643ff524"

export async function pingIndexNow(host: string, urls: string[]) {
  if (!urls.length) return { submitted: 0, status: 0 }
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host,
      key: INDEXNOW_KEY,
      keyLocation: `https://${host}/${INDEXNOW_KEY}.txt`,
      urlList: urls.slice(0, 10000),
    }),
  })
  return { submitted: urls.length, status: res.status }
}
