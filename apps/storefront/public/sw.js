/* use.ÉCLAT — service worker mínimo (network-first + fallback offline). */
const CACHE = "eclat-v2" // v2: purga caches antigos que podiam ter HTML truncado

self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })()
  )
})

// Network-first: sempre tenta a rede; usa cache só quando offline.
self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return
  // NUNCA interceptar navegações/documentos: o HTML da loja é streamado
  // (Suspense) e uma cópia truncada em cache deixa a página sem os scripts
  // de conclusão — botão de compra morto. SW só cuida de assets estáticos.
  if (req.mode === "navigate" || req.destination === "document") return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // não interfere em terceiros (tags, imagens externas)

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
        }
        return res
      })
      .catch(async () => {
        const cached = await caches.match(req)
        return cached || caches.match("/br")
      })
  )
})
