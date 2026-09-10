# PDP — Vídeo na galeria + Recomendação de tamanho — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na página de produto (PDP) da vitrine, (1) exibir um vídeo do YouTube como item da galeria a partir de `product.metadata.youtube_id`, e (2) oferecer um modal "Qual é o meu tamanho?" que recomenda o tamanho a partir de altura/peso (pré-preenchimento) e medidas de busto/cintura/quadril, comparando com a tabela de medidas da categoria já editável no Cockpit.

**Architecture:** Nada de fornecedor externo. O vídeo é um *facade* (thumbnail do YouTube + botão "Ver vídeo") que só carrega o iframe `youtube-nocookie` ao clique, inserido como 2º item da pilha da galeria; a 1ª foto continua sendo o hero (LCP/SEO). A recomendação de tamanho é uma função pura (`recommendSize`) que lê a `MeasureTable` de `site_content.medidas` (já existente, escolhida pelo caminho de handle da categoria do produto) e devolve tamanho recomendado, alternativa e caimento. Altura/peso só **pré-preenchem** as medidas por uma heurística isolada (`estimateMeasurements`); a cliente sempre vê e ajusta antes de calcular. Medidas e tamanho ficam salvos só no navegador (`eclat_prefs`, padrão "Minha ÉCLAT", LGPD-friendly). O botão "Selecionar M" do resultado seleciona a variante direto no `ProductActions`.

**Tech Stack:** Next 15.5 App Router · React 19 · Medusa 2.15.5 Store API (`product.metadata`, `product.categories`) · Supabase `site_content.medidas` via `getMeasureMap` · Headless UI `Modal` já existente · Vitest 3 (só `src/lib/util`, ambiente node) · Tailwind com tokens `eclat-*`.

**Spec:** Não há spec formal. A referência é a análise do site da Angè (useange.com.br, "Ver Vídeo" + DressOn) feita na sessão de 2026-09-07 e registrada na seção "Referência" no fim deste documento. A spec `docs/superpowers/specs/2026-09-07-navegacao-tipo-de-peca-design.md` (seção 4.5, tabela de medidas) define o formato de `site_content.medidas` que este plano consome.

## Global Constraints

- Nunca adivinhar business logic; em ambiguidade, perguntar (CLAUDE.md). As três decisões abaixo em **"Decisões a aprovar"** precisam de OK do usuário antes da Task 3.
- Todo texto de interface em pt-BR. Commits com prefixo `feat(...)`/`fix(...)`/`docs(...)` como no histórico. Comandos npm rodam da raiz `eclat/` com `--workspace=apps/storefront`.
- Vitest só cobre funções puras em `src/lib/util/**/*.test.ts` (ambiente node, sem React, sem `server-only`). Componentes são verificados no navegador (dev server porta 8000).
- Tamanhos de vestuário: exatamente `P`, `M`, `G`, `GG`. A tabela de medidas tem `rows[i][0]` = tamanho e células como `"82–88 cm"` (travessão, hífen, "a" ou valor único são aceitos pelo parser).
- Chave de metadata de produto criada aqui: `youtube_id` (string: ID de 11 caracteres **ou** URL do YouTube). É preenchida no Cockpit → Produto → "Ficha técnica (metadata)" sem nenhuma mudança no Cockpit.
- Chave de prefs no navegador estendida: `eclat_prefs.medidas` (`{ altura_cm, peso_kg, busto, cintura, quadril }`, todos opcionais, números em cm/kg). Nenhum dado pessoal vai ao servidor.
- Sem JSON-LD `VideoObject` nesta fase (Google exige `uploadDate`, que não temos). Anotar como follow-up em `progress.md`.
- Não tocar em preço, carrinho, checkout, Cockpit ou backend.

## Decisões a aprovar (Halt antes da Task 3)

1. **Posição do vídeo na galeria:** 2º item (após a foto hero). Alternativa: último item, como a Angè. Constante única `VIDEO_POSITION` na Task 1.
2. **Heurística de pré-preenchimento por altura/peso** (Task 3, `estimateMeasurements`): `IMC = peso / altura²`; `cintura ≈ 2,1·IMC + 27`; `quadril ≈ cintura + 25`; `busto ≈ quadril − 4` (cm, arredondado). Ex.: 1,65 m / 60 kg → busto 94, cintura 73, quadril 98 → cai em **M** na tabela padrão. É só um chute inicial editável pela cliente; pode ser recalibrado depois com dados reais. **Esta função é um bom ponto para o próprio usuário escrever/ajustar (5–10 linhas).**
3. **Regra de desempate:** entre dois tamanhos com a mesma distância, recomenda o **maior** (FAQ da vitrine: "na dúvida entre dois tamanhos, escolha o maior"). A alternativa só aparece se a diferença for ≤ 4 cm somados.

---

## Mapa de arquivos

**Storefront (`apps/storefront/`)**
- Create: `src/lib/util/product-video.ts` (+ `.test.ts`) — parse do `youtube_id`, URLs de thumb/embed, montagem dos itens da galeria.
- Create: `src/modules/products/components/product-video/index.tsx` — facade clicável → iframe.
- Create: `src/lib/util/size-recommendation.ts` (+ `.test.ts`) — `parseRange`, `columnToKey`, `measurableColumns`, `recommendSize`, `estimateMeasurements`.
- Create: `src/lib/util/category-path.ts` (+ `.test.ts`) — caminho `mae/filha` de uma categoria.
- Create: `src/modules/products/components/size-recommender/index.tsx` — modal em 3 passos.
- Modify: `next.config.js` (remotePattern `img.youtube.com`).
- Modify: `src/modules/products/components/image-gallery/index.tsx` (itens imagem|vídeo).
- Modify: `src/modules/personalization/persona-gallery.tsx` (repassa `youtubeId`/`productHandle`).
- Modify: `src/modules/products/templates/index.tsx` (lê metadata, busca tabela, passa props).
- Modify: `src/lib/data/products.ts` (campo `*categories` no fetch).
- Modify: `src/lib/data/measurements.ts` (`getMeasureTableForProduct`).
- Modify: `src/modules/personalization/prefs.ts` (tipo `medidas`).
- Modify: `src/modules/products/components/product-actions/index.tsx` (prop `measureTable`, botão + modal junto ao seletor de Tamanho).
- Modify: `src/modules/products/templates/product-actions-wrapper/index.tsx` (repassa `measureTable`).
- Modify: `src/modules/products/components/size-guide/index.tsx` (usa a tabela dinâmica, fallback nas ROWS atuais) — necessário para a tabela exibida na página ser a mesma usada na recomendação.

**Docs**
- Modify: `progress.md`.

---

### Task 1: Util de vídeo — `parseYoutubeId` + `buildGalleryItems`

**Files:**
- Create: `apps/storefront/src/lib/util/product-video.ts`
- Test: `apps/storefront/src/lib/util/product-video.test.ts`

**Interfaces:**
- Produces:
  - `parseYoutubeId(raw: unknown): string | null`
  - `youtubeThumbUrl(id: string): string`
  - `youtubeEmbedUrl(id: string): string`
  - `type GalleryItem = { kind: "image"; id: string; url: string } | { kind: "video"; id: string; youtubeId: string }`
  - `buildGalleryItems(images: { id: string; url?: string | null }[], youtubeId: string | null | undefined): GalleryItem[]`
  - `VIDEO_POSITION = 1`

- [ ] **Step 1: Escrever o teste que falha**

`apps/storefront/src/lib/util/product-video.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  buildGalleryItems,
  parseYoutubeId,
  youtubeEmbedUrl,
  youtubeThumbUrl,
} from "./product-video"

describe("parseYoutubeId", () => {
  it("aceita o ID puro de 11 caracteres", () => {
    expect(parseYoutubeId("p5hcJujKDEc")).toBe("p5hcJujKDEc")
    expect(parseYoutubeId("  p5hcJujKDEc  ")).toBe("p5hcJujKDEc")
  })
  it("extrai de URLs comuns do YouTube", () => {
    expect(parseYoutubeId("https://www.youtube.com/watch?v=p5hcJujKDEc&t=10s")).toBe("p5hcJujKDEc")
    expect(parseYoutubeId("https://youtu.be/p5hcJujKDEc")).toBe("p5hcJujKDEc")
    expect(parseYoutubeId("https://youtube.com/shorts/p5hcJujKDEc?feature=share")).toBe("p5hcJujKDEc")
    expect(parseYoutubeId("https://www.youtube-nocookie.com/embed/p5hcJujKDEc")).toBe("p5hcJujKDEc")
    expect(parseYoutubeId("https://m.youtube.com/watch?v=p5hcJujKDEc")).toBe("p5hcJujKDEc")
  })
  it("rejeita lixo, vazio e outros domínios", () => {
    expect(parseYoutubeId("")).toBeNull()
    expect(parseYoutubeId(null)).toBeNull()
    expect(parseYoutubeId(42)).toBeNull()
    expect(parseYoutubeId("abc")).toBeNull()
    expect(parseYoutubeId("https://vimeo.com/123456")).toBeNull()
    expect(parseYoutubeId("https://www.youtube.com/watch?v=curto")).toBeNull()
  })
})

describe("URLs", () => {
  it("thumb e embed usam o ID", () => {
    expect(youtubeThumbUrl("p5hcJujKDEc")).toBe("https://img.youtube.com/vi/p5hcJujKDEc/hqdefault.jpg")
    const embed = youtubeEmbedUrl("p5hcJujKDEc")
    expect(embed.startsWith("https://www.youtube-nocookie.com/embed/p5hcJujKDEc?")).toBe(true)
    expect(embed).toContain("autoplay=1")
    expect(embed).toContain("mute=1")
    expect(embed).toContain("loop=1")
    expect(embed).toContain("playlist=p5hcJujKDEc")
    expect(embed).toContain("controls=0")
    expect(embed).toContain("playsinline=1")
  })
})

describe("buildGalleryItems", () => {
  const imgs = [
    { id: "a", url: "https://x/a.jpg" },
    { id: "b", url: "https://x/b.jpg" },
    { id: "c", url: null },
  ]
  it("sem vídeo devolve só as imagens com url", () => {
    expect(buildGalleryItems(imgs, null)).toEqual([
      { kind: "image", id: "a", url: "https://x/a.jpg" },
      { kind: "image", id: "b", url: "https://x/b.jpg" },
    ])
  })
  it("com vídeo insere como 2º item (após o hero)", () => {
    const items = buildGalleryItems(imgs, "p5hcJujKDEc")
    expect(items.map((i) => i.kind)).toEqual(["image", "video", "image"])
    expect(items[1]).toEqual({ kind: "video", id: "video-p5hcJujKDEc", youtubeId: "p5hcJujKDEc" })
  })
  it("produto sem fotos: vídeo vira o único item", () => {
    expect(buildGalleryItems([], "p5hcJujKDEc")).toEqual([
      { kind: "video", id: "video-p5hcJujKDEc", youtubeId: "p5hcJujKDEc" },
    ])
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run (da raiz `eclat/`): `npm run test --workspace=apps/storefront -- src/lib/util/product-video.test.ts`
Expected: FAIL — `Failed to resolve import "./product-video"`.

- [ ] **Step 3: Implementar**

`apps/storefront/src/lib/util/product-video.ts`:

```ts
// Vídeo de produto na galeria da PDP. Fonte: product.metadata.youtube_id
// (Cockpit → Produto → Ficha técnica). Aceita o ID puro (11 chars) ou uma URL do
// YouTube (watch?v=, youtu.be/, shorts/, embed/, live/). Funções puras (Vitest).

const ID_RE = /^[A-Za-z0-9_-]{11}$/

export function parseYoutubeId(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const s = raw.trim()
  if (!s) return null
  if (ID_RE.test(s)) return s

  let url: URL
  try {
    url = new URL(s)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^(www|m)\./, "")
  let id: string | null = null
  if (host === "youtu.be") {
    id = url.pathname.slice(1).split("/")[0] || null
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") {
      id = url.searchParams.get("v")
    } else {
      const m = url.pathname.match(/^\/(?:embed|shorts|v|live)\/([^/?]+)/)
      id = m ? m[1] : null
    }
  }
  return id && ID_RE.test(id) ? id : null
}

export function youtubeThumbUrl(id: string): string {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`
}

// Loop mudo sem UI do YouTube — comportamento de "GIF de produto" (referência: Angè).
export function youtubeEmbedUrl(id: string): string {
  const q = new URLSearchParams({
    autoplay: "1",
    mute: "1",
    loop: "1",
    playlist: id, // loop=1 exige playlist com o próprio ID
    controls: "0",
    modestbranding: "1",
    rel: "0",
    playsinline: "1",
  })
  return `https://www.youtube-nocookie.com/embed/${id}?${q.toString()}`
}

export type GalleryItem =
  | { kind: "image"; id: string; url: string }
  | { kind: "video"; id: string; youtubeId: string }

// Vídeo entra como 2º item: a 1ª foto continua sendo o hero (LCP/SEO) e o vídeo
// aparece no 1º scroll. Decisão 1 do plano; mude aqui se optar por "último".
export const VIDEO_POSITION = 1

export function buildGalleryItems(
  images: { id: string; url?: string | null }[],
  youtubeId: string | null | undefined
): GalleryItem[] {
  const items: GalleryItem[] = images
    .filter((i) => !!i.url)
    .map((i) => ({ kind: "image" as const, id: i.id, url: i.url as string }))
  if (!youtubeId) return items
  const video: GalleryItem = { kind: "video", id: `video-${youtubeId}`, youtubeId }
  items.splice(Math.min(VIDEO_POSITION, items.length), 0, video)
  return items
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm run test --workspace=apps/storefront -- src/lib/util/product-video.test.ts`
Expected: PASS (3 describes, 8 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/storefront/src/lib/util/product-video.ts apps/storefront/src/lib/util/product-video.test.ts
git commit -m "feat(vitrine): util de vídeo da PDP — parse de youtube_id e itens da galeria (Vitest)"
```

---

### Task 2: Componente `ProductVideo` + galeria com vídeo

**Files:**
- Modify: `apps/storefront/next.config.js:30-57` (remotePatterns)
- Create: `apps/storefront/src/modules/products/components/product-video/index.tsx`
- Modify: `apps/storefront/src/modules/products/components/image-gallery/index.tsx`
- Modify: `apps/storefront/src/modules/personalization/persona-gallery.tsx`
- Modify: `apps/storefront/src/modules/products/templates/index.tsx:83-89`

**Interfaces:**
- Consumes (Task 1): `buildGalleryItems`, `parseYoutubeId`, `youtubeThumbUrl`, `youtubeEmbedUrl`, `GalleryItem`.
- Produces:
  - `ProductVideo({ youtubeId: string; productTitle?: string; productHandle?: string })`
  - `ImageGallery` ganha props opcionais `youtubeId?: string | null` e `productHandle?: string`.
  - `PersonaGallery` ganha as mesmas duas props e só repassa.

- [ ] **Step 1: Liberar a thumbnail do YouTube no `next/image`**

Em `apps/storefront/next.config.js`, dentro de `remotePatterns`, logo após o bloco do Supabase (`hostname: "*.supabase.co"`), adicionar:

```js
      {
        // thumbnail do vídeo de produto (PDP) — img.youtube.com/vi/{id}/hqdefault.jpg
        protocol: "https",
        hostname: "img.youtube.com",
      },
```

- [ ] **Step 2: Criar o componente facade**

`apps/storefront/src/modules/products/components/product-video/index.tsx`:

```tsx
"use client"

import { useState } from "react"
import Image from "next/image"
import { youtubeEmbedUrl, youtubeThumbUrl } from "@lib/util/product-video"

// Item de vídeo da galeria da PDP. "Facade": mostra só a thumbnail do YouTube e
// carrega o iframe (youtube-nocookie, mudo, em loop, sem controles) apenas ao clique —
// zero JS do YouTube no carregamento da página. O iframe é 16:9 com altura 100% e
// centralizado, então "cobre" o container retrato (mesma técnica da referência Angè);
// funciona para vídeo horizontal (corta as laterais) e vertical (fica com barras).

type Props = {
  youtubeId: string
  productTitle?: string
  productHandle?: string
}

export default function ProductVideo({ youtubeId, productTitle, productHandle }: Props) {
  const [playing, setPlaying] = useState(false)
  const title = productTitle ? `Vídeo — ${productTitle}` : "Vídeo do produto"

  function play() {
    setPlaying(true)
    // dataLayer: video_play (GTM → GA4) — mesmo padrão inline do add_to_cart
    try {
      const w = window as unknown as { dataLayer?: Record<string, unknown>[] }
      w.dataLayer = w.dataLayer || []
      w.dataLayer.push({
        event: "video_play",
        video_provider: "youtube",
        video_id: youtubeId,
        item_id: productHandle ?? null,
      })
    } catch {
      /* noop */
    }
  }

  if (playing) {
    return (
      <div className="absolute inset-0 overflow-hidden bg-black rounded-rounded">
        <iframe
          src={youtubeEmbedUrl(youtubeId)}
          title={title}
          className="absolute top-1/2 left-1/2 h-full aspect-video -translate-x-1/2 -translate-y-1/2"
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
        />
        <button
          type="button"
          onClick={() => setPlaying(false)}
          aria-label="Fechar vídeo"
          className="absolute top-3 right-3 z-10 rounded-full bg-white/90 text-eclat-grafite text-xs font-semibold px-3 py-1 shadow hover:bg-white"
        >
          Fechar
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={play}
      aria-label={`Ver vídeo: ${productTitle ?? "produto"}`}
      className="group absolute inset-0 w-full h-full text-left"
    >
      <Image
        src={youtubeThumbUrl(youtubeId)}
        alt={title}
        fill
        sizes="(max-width: 576px) 280px, (max-width: 768px) 360px, (max-width: 992px) 480px, 800px"
        style={{ objectFit: "cover" }}
        className="rounded-rounded"
      />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex items-center gap-2 rounded-full bg-white/90 text-eclat-grafite text-xs font-semibold uppercase tracking-wider px-4 py-2 shadow group-hover:bg-white transition-colors">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path d="M8 5v14l11-7z" fill="currentColor" />
          </svg>
          Ver vídeo
        </span>
      </span>
    </button>
  )
}
```

- [ ] **Step 3: Galeria passa a renderizar itens imagem|vídeo**

Substituir o conteúdo de `apps/storefront/src/modules/products/components/image-gallery/index.tsx` por:

```tsx
import { HttpTypes } from "@medusajs/types"
import { Container } from "@modules/common/components/ui"
import Image from "next/image"
import ProductVideo from "@modules/products/components/product-video"
import { buildGalleryItems } from "@lib/util/product-video"

type ImageGalleryProps = {
  images: HttpTypes.StoreProductImage[]
  productTitle?: string
  productHandle?: string
  // product.metadata.youtube_id já validado por parseYoutubeId (no template)
  youtubeId?: string | null
}

const ImageGallery = ({
  images,
  productTitle,
  productHandle,
  youtubeId,
}: ImageGalleryProps) => {
  const items = buildGalleryItems(images, youtubeId)
  let fotoN = 0

  return (
    <div className="flex items-start relative">
      <div className="flex flex-col flex-1 small:mx-16 gap-y-4">
        {items.map((item, index) => {
          if (item.kind === "video") {
            return (
              <Container
                key={item.id}
                className="relative aspect-[29/34] w-full overflow-hidden bg-ui-bg-subtle"
                id={item.id}
                data-testid="product-video"
              >
                <ProductVideo
                  youtubeId={item.youtubeId}
                  productTitle={productTitle}
                  productHandle={productHandle}
                />
              </Container>
            )
          }
          fotoN += 1
          return (
            <Container
              key={item.id}
              className="relative aspect-[29/34] w-full overflow-hidden bg-ui-bg-subtle"
              id={item.id}
            >
              <Image
                src={item.url}
                priority={index <= 2}
                className="absolute inset-0 rounded-rounded"
                alt={
                  productTitle
                    ? `${productTitle} — use.ÉCLAT — foto ${fotoN}`
                    : `Foto ${fotoN} do produto`
                }
                fill
                sizes="(max-width: 576px) 280px, (max-width: 768px) 360px, (max-width: 992px) 480px, 800px"
                style={{
                  objectFit: "cover",
                }}
              />
            </Container>
          )
        })}
      </div>
    </div>
  )
}

export default ImageGallery
```

- [ ] **Step 4: `PersonaGallery` repassa as novas props**

Em `apps/storefront/src/modules/personalization/persona-gallery.tsx`:

Trocar a assinatura:

```tsx
export default function PersonaGallery({
  images,
  personaMedia,
  productTitle,
  productHandle,
  youtubeId,
}: {
  images: HttpTypes.StoreProductImage[]
  personaMedia: PersonaMedia[]
  productTitle?: string
  productHandle?: string
  youtubeId?: string | null
}) {
```

E trocar a linha `<ImageGallery images={shown} productTitle={productTitle} />` por:

```tsx
      <ImageGallery
        images={shown}
        productTitle={productTitle}
        productHandle={productHandle}
        youtubeId={youtubeId}
      />
```

- [ ] **Step 5: Template lê a metadata e passa para a galeria**

Em `apps/storefront/src/modules/products/templates/index.tsx`:

Adicionar o import junto aos outros de `@lib`:

```tsx
import { parseYoutubeId } from "@lib/util/product-video"
```

Logo após `const productUrl = ...`, adicionar:

```tsx
  // vídeo da galeria: product.metadata.youtube_id (ID ou URL), preenchido no Cockpit
  const youtubeId = parseYoutubeId(product.metadata?.youtube_id)
```

E trocar o bloco `<PersonaGallery ... />` por:

```tsx
          <PersonaGallery
            images={images}
            personaMedia={personaMedia}
            productTitle={product.title}
            productHandle={product.handle ?? undefined}
            youtubeId={youtubeId}
          />
```

- [ ] **Step 6: Typecheck e lint**

Run: `cd apps/storefront && npx tsc --noEmit && npm run lint`
Expected: sem erros.

- [ ] **Step 7: Verificar no navegador**

1. No Cockpit (porta 7001) → Produtos → editar um produto publicado → "Ficha técnica (metadata)" → `+ adicionar campo` → campo `youtube_id`, valor `p5hcJujKDEc` (ID de teste; trocar pelo vídeo real depois) → Salvar.
2. `npm run dev --workspace=apps/storefront` e abrir `http://localhost:8000/br/products/<handle-do-produto>` (cache do Store API pode levar até ~30 s).
3. Conferir: 2º item da galeria mostra a thumbnail com "Ver vídeo"; clique carrega o iframe em loop mudo, botão "Fechar" volta para a thumb; sem erro no console; nenhuma request para `youtube.com` antes do clique (aba Network).
4. Produto **sem** `youtube_id`: galeria idêntica à anterior.
5. Remover o `youtube_id` de teste do produto se não for o vídeo real.

- [ ] **Step 8: Commit**

```bash
git add apps/storefront/next.config.js apps/storefront/src/modules/products/components/product-video/index.tsx apps/storefront/src/modules/products/components/image-gallery/index.tsx apps/storefront/src/modules/personalization/persona-gallery.tsx apps/storefront/src/modules/products/templates/index.tsx
git commit -m "feat(vitrine): vídeo do YouTube na galeria da PDP via metadata.youtube_id (facade, sem JS até o clique)"
```

---

### Task 3: Util de recomendação de tamanho (função pura)

> **Halt:** confirmar as Decisões 2 e 3 com o usuário antes de começar. A função `estimateMeasurements` é o lugar ideal para o usuário escrever a própria heurística se preferir.

**Files:**
- Create: `apps/storefront/src/lib/util/size-recommendation.ts`
- Test: `apps/storefront/src/lib/util/size-recommendation.test.ts`

**Interfaces:**
- Consumes: `MeasureTable` de `@lib/util/measurements` (`{ columns: string[]; rows: string[][] }`, `rows[i][0]` = tamanho).
- Produces:
  - `type MedidaKey = "busto" | "cintura" | "quadril"`
  - `type Medidas = Partial<Record<MedidaKey, number>>`
  - `type Caimento = "ideal" | "justo" | "folgado"`
  - `type Recomendacao = { recomendado: string; alternativa: string | null; caimento: Caimento; detalhes: { medida: MedidaKey; valor: number; faixa: { min: number; max: number }; fit: Caimento }[] }`
  - `parseRange(cell: string): { min: number; max: number } | null`
  - `columnToKey(header: string): MedidaKey | null`
  - `measurableColumns(table: MeasureTable): { index: number; key: MedidaKey; label: string }[]`
  - `recommendSize(table: MeasureTable | null | undefined, medidas: Medidas): Recomendacao | null`
  - `estimateMeasurements(altura_cm: number, peso_kg: number): Required<Medidas> | null`

- [ ] **Step 1: Escrever o teste que falha**

`apps/storefront/src/lib/util/size-recommendation.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  columnToKey,
  estimateMeasurements,
  measurableColumns,
  parseRange,
  recommendSize,
} from "./size-recommendation"

// Tabela padrão de macaquinhos (Cockpit, PADRAO.macaquinhos)
const MACAQUINHO = {
  columns: ["Busto", "Cintura", "Quadril"],
  rows: [
    ["P", "82–88 cm", "62–68 cm", "88–94 cm"],
    ["M", "88–94 cm", "68–74 cm", "94–100 cm"],
    ["G", "94–100 cm", "74–80 cm", "100–106 cm"],
    ["GG", "100–108 cm", "80–88 cm", "106–114 cm"],
  ],
}
// Tabela de camiseta masculina: só "Tórax" é comparável; "Comprimento" é ignorado
const CAMISETA = {
  columns: ["Tórax", "Comprimento"],
  rows: [
    ["P", "90-96", "68"],
    ["M", "96-102", "70"],
    ["G", "102-108", "72"],
  ],
}

describe("parseRange", () => {
  it("aceita travessão, hífen, 'a' e valor único", () => {
    expect(parseRange("82–88 cm")).toEqual({ min: 82, max: 88 })
    expect(parseRange("82-88")).toEqual({ min: 82, max: 88 })
    expect(parseRange("82 a 88 cm")).toEqual({ min: 82, max: 88 })
    expect(parseRange("88")).toEqual({ min: 88, max: 88 })
    expect(parseRange("88,5 – 90")).toEqual({ min: 88.5, max: 90 })
  })
  it("sem número devolve null", () => {
    expect(parseRange("")).toBeNull()
    expect(parseRange("—")).toBeNull()
  })
})

describe("columnToKey", () => {
  it("mapeia cabeçalhos em pt-BR (com e sem acento)", () => {
    expect(columnToKey("Busto")).toBe("busto")
    expect(columnToKey("Peito")).toBe("busto")
    expect(columnToKey("Tórax")).toBe("busto")
    expect(columnToKey("torax")).toBe("busto")
    expect(columnToKey("Cintura")).toBe("cintura")
    expect(columnToKey("Quadril")).toBe("quadril")
    expect(columnToKey("Comprimento")).toBeNull()
  })
  it("measurableColumns ignora colunas não comparáveis", () => {
    expect(measurableColumns(CAMISETA)).toEqual([{ index: 0, key: "busto", label: "Tórax" }])
  })
})

describe("recommendSize", () => {
  it("todas as medidas dentro da faixa → ideal, sem alternativa longe", () => {
    const r = recommendSize(MACAQUINHO, { busto: 90, cintura: 70, quadril: 96 })
    expect(r?.recomendado).toBe("M")
    expect(r?.caimento).toBe("ideal")
    expect(r?.detalhes).toHaveLength(3)
  })
  it("medida acima do máximo do tamanho → 'justo'", () => {
    // cintura 75 passa 1 cm do M (68–74); G ficaria 3 cm folgado no busto (94–100) e 2 no quadril
    const r = recommendSize(MACAQUINHO, { busto: 91, cintura: 75, quadril: 98 })
    expect(r?.recomendado).toBe("M")
    expect(r?.caimento).toBe("justo")
    expect(r?.alternativa).toBe("G")
  })
  it("medida abaixo do mínimo → 'folgado'", () => {
    const r = recommendSize(MACAQUINHO, { busto: 80, cintura: 60, quadril: 86 })
    expect(r?.recomendado).toBe("P")
    expect(r?.caimento).toBe("folgado")
    expect(r?.alternativa).toBeNull()
  })
  it("empate exato entre dois tamanhos → o maior (Decisão 3)", () => {
    // busto 94 está no limite de M (88–94) e de G (94–100): ambos ideais, distância 0
    const r = recommendSize(MACAQUINHO, { busto: 94 })
    expect(r?.recomendado).toBe("G")
    expect(r?.alternativa).toBe("M")
  })
  it("usa só as medidas informadas e só as colunas comparáveis", () => {
    const r = recommendSize(CAMISETA, { busto: 100, cintura: 80 })
    expect(r?.recomendado).toBe("M")
    expect(r?.detalhes.map((d) => d.medida)).toEqual(["busto"])
  })
  it("sem tabela, sem medida útil ou sem coluna comparável → null", () => {
    expect(recommendSize(null, { busto: 90 })).toBeNull()
    expect(recommendSize(MACAQUINHO, {})).toBeNull()
    expect(recommendSize({ columns: ["Comprimento"], rows: [["P", "68"]] }, { busto: 90 })).toBeNull()
  })
  it("alternativa só quando a diferença é ≤ 4 cm", () => {
    // busto 96: G ideal (94–100 → 0); M 2 acima (88–94); P 8 acima → G recomendado, M alternativa (diferença 2)
    expect(recommendSize(MACAQUINHO, { busto: 96 })?.recomendado).toBe("G")
    expect(recommendSize(MACAQUINHO, { busto: 96 })?.alternativa).toBe("M")
    // P: 20 acima; M: 14; G: 8; GG: 0 → GG, diferença para G = 8 > 4 → sem alternativa
    expect(recommendSize(MACAQUINHO, { busto: 108 })?.alternativa).toBeNull()
  })
})

describe("estimateMeasurements (Decisão 2 — heurística de pré-preenchimento)", () => {
  it("1,65 m / 60 kg cai em M na tabela padrão", () => {
    const est = estimateMeasurements(165, 60)
    expect(est).toEqual({ busto: 94, cintura: 73, quadril: 98 })
    expect(recommendSize(MACAQUINHO, est!)?.recomendado).toBe("M")
  })
  it("valores impossíveis → null", () => {
    expect(estimateMeasurements(0, 60)).toBeNull()
    expect(estimateMeasurements(165, 0)).toBeNull()
    expect(estimateMeasurements(NaN, 60)).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run test --workspace=apps/storefront -- src/lib/util/size-recommendation.test.ts`
Expected: FAIL — `Failed to resolve import "./size-recommendation"`.

- [ ] **Step 3: Implementar**

`apps/storefront/src/lib/util/size-recommendation.ts`:

```ts
import type { MeasureTable } from "./measurements"

// Recomendação de tamanho a partir de medidas do corpo (cm) × tabela de medidas da
// categoria (site_content.medidas, editada no Cockpit). Função pura, sem I/O.
//
// Regras (plano 2026-09-07, Decisões 2 e 3):
// - distância por medida = quanto o valor sai da faixa do tamanho (0 se está dentro);
// - recomendado = menor soma de distâncias; empate → o MAIOR tamanho (FAQ da marca);
// - alternativa = 2º melhor, só se a diferença de distâncias for ≤ 4 cm;
// - caimento do recomendado: "justo" se alguma medida passa do máximo, "folgado" se
//   alguma fica abaixo do mínimo, senão "ideal".

export type MedidaKey = "busto" | "cintura" | "quadril"
export type Medidas = Partial<Record<MedidaKey, number>>
export type Range = { min: number; max: number }
export type Caimento = "ideal" | "justo" | "folgado"
export type Recomendacao = {
  recomendado: string
  alternativa: string | null
  caimento: Caimento
  detalhes: { medida: MedidaKey; valor: number; faixa: Range; fit: Caimento }[]
}

const ALTERNATIVA_MAX_DIFF_CM = 4

// "82–88 cm" | "82-88" | "82 a 88" | "88" | "88,5 – 90" → {min,max}; sem número → null
export function parseRange(cell: string): Range | null {
  const nums = (cell.match(/\d+(?:[.,]\d+)?/g) || [])
    .slice(0, 2)
    .map((n) => Number(n.replace(",", ".")))
  if (nums.length === 0) return null
  return { min: Math.min(...nums), max: Math.max(...nums) }
}

export function columnToKey(header: string): MedidaKey | null {
  const h = header
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos (Tórax → torax)
  if (/busto|peito|torax/.test(h)) return "busto"
  if (/cintura/.test(h)) return "cintura"
  if (/quadril/.test(h)) return "quadril"
  return null
}

export function measurableColumns(
  table: MeasureTable
): { index: number; key: MedidaKey; label: string }[] {
  const out: { index: number; key: MedidaKey; label: string }[] = []
  table.columns.forEach((label, index) => {
    const key = columnToKey(label)
    if (key) out.push({ index, key, label })
  })
  return out
}

export function recommendSize(
  table: MeasureTable | null | undefined,
  medidas: Medidas
): Recomendacao | null {
  if (!table) return null
  const cols = measurableColumns(table).filter(
    (c) => typeof medidas[c.key] === "number" && Number.isFinite(medidas[c.key])
  )
  if (cols.length === 0) return null

  const scored = table.rows
    .map((row) => {
      const detalhes: Recomendacao["detalhes"] = []
      let score = 0
      for (const c of cols) {
        const faixa = parseRange(row[c.index + 1] ?? "")
        if (!faixa) continue
        const valor = medidas[c.key] as number
        const fit: Caimento =
          valor > faixa.max ? "justo" : valor < faixa.min ? "folgado" : "ideal"
        score += fit === "justo" ? valor - faixa.max : fit === "folgado" ? faixa.min - valor : 0
        detalhes.push({ medida: c.key, valor, faixa, fit })
      }
      return { tamanho: row[0], score, detalhes }
    })
    .filter((s) => s.tamanho && s.detalhes.length > 0)
  if (scored.length === 0) return null

  // "<=" faz o ÚLTIMO empate vencer → tamanho maior (linhas em ordem P→GG)
  const best = scored.reduce((a, b) => (b.score <= a.score ? b : a))
  const second = scored
    .filter((s) => s !== best)
    .sort((a, b) => a.score - b.score)[0]
  const alternativa =
    second && second.score - best.score <= ALTERNATIVA_MAX_DIFF_CM ? second.tamanho : null

  const caimento: Caimento = best.detalhes.some((d) => d.fit === "justo")
    ? "justo"
    : best.detalhes.some((d) => d.fit === "folgado")
    ? "folgado"
    : "ideal"

  return { recomendado: best.tamanho, alternativa, caimento, detalhes: best.detalhes }
}

// PRÉ-PREENCHIMENTO por altura/peso — heurística, NÃO regra final: a cliente sempre vê
// e ajusta os valores antes de calcular. Decisão 2 do plano; recalibrar com dados reais.
//   IMC = peso / altura²  ·  cintura ≈ 2,1·IMC + 27  ·  quadril ≈ cintura + 25  ·  busto ≈ quadril − 4
export function estimateMeasurements(
  altura_cm: number,
  peso_kg: number
): Required<Medidas> | null {
  if (!(altura_cm > 100 && altura_cm < 230) || !(peso_kg > 30 && peso_kg < 250)) return null
  const imc = peso_kg / (altura_cm / 100) ** 2
  const cintura = Math.round(2.1 * imc + 27)
  const quadril = cintura + 25
  const busto = quadril - 4
  return { busto, cintura, quadril }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run test --workspace=apps/storefront -- src/lib/util/size-recommendation.test.ts`
Expected: PASS (todos os testes). Se o teste "medida acima do máximo → justo" falhar no `alternativa`, recalcule à mão: M soma 1 (cintura 75−74); G soma 3 (busto 94−91) + 2 (quadril 100−98) = 5 → diferença 4 → alternativa "G". Não ajuste o teste; ajuste a implementação.

- [ ] **Step 5: Commit**

```bash
git add apps/storefront/src/lib/util/size-recommendation.ts apps/storefront/src/lib/util/size-recommendation.test.ts
git commit -m "feat(vitrine): recomendação de tamanho por medidas × tabela da categoria (função pura + Vitest)"
```

---

### Task 4: Tabela de medidas do produto (caminho da categoria + data helper)

**Files:**
- Create: `apps/storefront/src/lib/util/category-path.ts`
- Test: `apps/storefront/src/lib/util/category-path.test.ts`
- Modify: `apps/storefront/src/lib/data/products.ts:64-66` (campo `fields`)
- Modify: `apps/storefront/src/lib/data/measurements.ts`

**Interfaces:**
- Consumes: `pickMeasurements`, `MeasureTable` (`@lib/util/measurements`); `getMeasureMap` (mesmo arquivo); `listCategories` (`@lib/data/categories`, já expande `*parent_category, *parent_category.parent_category`).
- Produces:
  - `categoryPath(cat: CatLike, byId?: Map<string, CatLike>): string` com `type CatLike = { id: string; handle: string; parent_category?: CatLike | null; parent_category_id?: string | null }`
  - `getMeasureTableForProduct(product: HttpTypes.StoreProduct): Promise<MeasureTable | null>` (server-only)

- [ ] **Step 1: Escrever o teste que falha**

`apps/storefront/src/lib/util/category-path.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { categoryPath } from "./category-path"

const masculino = { id: "c1", handle: "masculino", parent_category: null }
const bermudas = { id: "c2", handle: "bermudas", parent_category: masculino }

describe("categoryPath", () => {
  it("categoria raiz devolve o próprio handle", () => {
    expect(categoryPath(masculino)).toBe("masculino")
  })
  it("segue parent_category expandido", () => {
    expect(categoryPath(bermudas)).toBe("masculino/bermudas")
  })
  it("resolve parent_category_id pelo mapa quando não veio expandido", () => {
    const byId = new Map([["c1", masculino]])
    expect(categoryPath({ id: "c2", handle: "bermudas", parent_category_id: "c1" }, byId)).toBe(
      "masculino/bermudas"
    )
  })
  it("não entra em loop com ciclo acidental", () => {
    const a: { id: string; handle: string; parent_category: unknown } = { id: "a", handle: "a", parent_category: null }
    const b = { id: "b", handle: "b", parent_category: a }
    a.parent_category = b
    expect(categoryPath(b as never)).toBe("a/b")
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run test --workspace=apps/storefront -- src/lib/util/category-path.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar o util**

`apps/storefront/src/lib/util/category-path.ts`:

```ts
// Caminho de handle "mae/filha" de uma categoria — é a chave de site_content.medidas
// (mesma convenção do Cockpit em components/medidas-editor.tsx). Aceita parent_category
// expandido (Store API com *parent_category) ou resolve parent_category_id por um mapa.

export type CatLike = {
  id: string
  handle: string
  parent_category?: CatLike | null
  parent_category_id?: string | null
}

export function categoryPath(cat: CatLike, byId?: Map<string, CatLike>): string {
  const parts: string[] = []
  const seen = new Set<string>()
  let cur: CatLike | null | undefined = cat
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    parts.unshift(cur.handle)
    cur =
      cur.parent_category ??
      (cur.parent_category_id && byId ? byId.get(cur.parent_category_id) : null)
  }
  return parts.join("/")
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run test --workspace=apps/storefront -- src/lib/util/category-path.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Store API passa a devolver as categorias do produto**

Em `apps/storefront/src/lib/data/products.ts`, trocar a linha do `fields`:

```ts
          fields:
            "*variants.calculated_price,+variants.inventory_quantity,*variants.images,+metadata,+tags,",
```

por:

```ts
          fields:
            "*variants.calculated_price,+variants.inventory_quantity,*variants.images,+metadata,+tags,*categories",
```

- [ ] **Step 6: Data helper que escolhe a tabela do produto**

Substituir o conteúdo de `apps/storefront/src/lib/data/measurements.ts` por:

```ts
import "server-only"

import type { HttpTypes } from "@medusajs/types"
import { getSiteContent } from "./site-content"
import { listCategories } from "./categories"
import { isMeasureTable, pickMeasurements, type MeasureMap, type MeasureTable } from "@lib/util/measurements"
import { categoryPath, type CatLike } from "@lib/util/category-path"

// Guia de medidas editado no Cockpit (Vitrine → Medidas). Descarta entradas malformadas.
export async function getMeasureMap(): Promise<MeasureMap> {
  const raw = await getSiteContent<Record<string, unknown>>("medidas")
  if (!raw || typeof raw !== "object") return {}
  const out: MeasureMap = {}
  for (const [k, v] of Object.entries(raw)) if (isMeasureTable(v)) out[k] = v
  return out
}

// Tabela de medidas de um produto: pela categoria mais específica que tiver tabela
// (subcategoria herda da mãe via pickMeasurements). null = sem tabela (ex.: acessórios).
export async function getMeasureTableForProduct(
  product: HttpTypes.StoreProduct
): Promise<MeasureTable | null> {
  const cats = (product.categories ?? []) as CatLike[]
  if (cats.length === 0) return null
  const [map, all] = await Promise.all([getMeasureMap(), listCategories().catch(() => [])])
  const byId = new Map<string, CatLike>((all ?? []).map((c) => [c.id, c as CatLike]))
  const paths = cats
    .map((c) => categoryPath(byId.get(c.id) ?? c, byId))
    .sort((a, b) => b.split("/").length - a.split("/").length)
  for (const p of paths) {
    const t = pickMeasurements(map, p)
    if (t) return t
  }
  return null
}
```

- [ ] **Step 7: Typecheck**

Run: `cd apps/storefront && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 8: Commit**

```bash
git add apps/storefront/src/lib/util/category-path.ts apps/storefront/src/lib/util/category-path.test.ts apps/storefront/src/lib/data/products.ts apps/storefront/src/lib/data/measurements.ts
git commit -m "feat(vitrine): tabela de medidas por produto — caminho da categoria + *categories no Store API"
```

---

### Task 5: Modal "Qual é o meu tamanho?" integrado ao seletor

**Files:**
- Modify: `apps/storefront/src/modules/personalization/prefs.ts:7-13` (tipo)
- Create: `apps/storefront/src/modules/products/components/size-recommender/index.tsx`
- Modify: `apps/storefront/src/modules/products/components/product-actions/index.tsx`
- Modify: `apps/storefront/src/modules/products/templates/product-actions-wrapper/index.tsx`
- Modify: `apps/storefront/src/modules/products/templates/index.tsx`

**Interfaces:**
- Consumes: `recommendSize`, `estimateMeasurements`, `measurableColumns`, tipos (Task 3); `MeasureTable`; `getMeasureTableForProduct` (Task 4); `Modal` (`@modules/common/components/modal`), `useToggleState`, `Button`; `getPrefs`/`setPrefs`.
- Produces:
  - `EclatPrefs.medidas?: { altura_cm?: number; peso_kg?: number; busto?: number; cintura?: number; quadril?: number }`
  - `SizeRecommender({ table: MeasureTable; availableSizes: string[]; onSelect: (size: string) => void; productHandle?: string })`
  - `ProductActions` ganha prop `measureTable?: MeasureTable | null`; `ProductActionsWrapper` ganha a mesma prop e repassa.

- [ ] **Step 1: Estender as prefs**

Em `apps/storefront/src/modules/personalization/prefs.ts`, no tipo `EclatPrefs`, adicionar após `wizard_done?: boolean`:

```ts
  // medidas informadas no "Qual é o meu tamanho?" (cm/kg) — só no navegador
  medidas?: {
    altura_cm?: number
    peso_kg?: number
    busto?: number
    cintura?: number
    quadril?: number
  }
```

- [ ] **Step 2: Criar o componente do modal**

`apps/storefront/src/modules/products/components/size-recommender/index.tsx`:

```tsx
"use client"

import { useState } from "react"
import Modal from "@modules/common/components/modal"
import useToggleState from "@lib/hooks/use-toggle-state"
import { Button } from "@modules/common/components/ui"
import type { MeasureTable } from "@lib/util/measurements"
import {
  estimateMeasurements,
  measurableColumns,
  recommendSize,
  type MedidaKey,
  type Medidas,
  type Recomendacao,
} from "@lib/util/size-recommendation"
import { getPrefs, setPrefs } from "@modules/personalization/prefs"

// "Qual é o meu tamanho?" — 3 passos: corpo (altura/peso → pré-preenche) → medidas
// (busto/cintura/quadril conforme colunas da tabela) → resultado (tamanho + caimento +
// alternativa + "Selecionar"). Tudo local: função pura + prefs no navegador.

const LABEL: Record<MedidaKey, string> = { busto: "Busto", cintura: "Cintura", quadril: "Quadril" }
const CAIMENTO: Record<Recomendacao["caimento"], string> = {
  ideal: "Caimento ideal",
  justo: "Fica mais justo — mais sustentação",
  folgado: "Fica mais folgado — mais conforto",
}
const FIT_CURTO: Record<Recomendacao["caimento"], string> = {
  ideal: "na faixa",
  justo: "acima da faixa",
  folgado: "abaixo da faixa",
}

type Props = {
  table: MeasureTable
  availableSizes: string[]
  onSelect: (size: string) => void
  productHandle?: string
}

type Step = "corpo" | "medidas" | "resultado"
type Form = Record<MedidaKey, string>

const inputCls =
  "w-full h-10 rounded-rounded border border-ui-border-base bg-white px-3 text-sm text-eclat-grafite focus:outline-none focus:border-eclat-terracota"

export default function SizeRecommender({ table, availableSizes, onSelect, productHandle }: Props) {
  const { state: isOpen, open, close } = useToggleState()
  const cols = measurableColumns(table)
  const [step, setStep] = useState<Step>("corpo")
  const [altura, setAltura] = useState("")
  const [peso, setPeso] = useState("")
  const [form, setForm] = useState<Form>({ busto: "", cintura: "", quadril: "" })
  const [resultado, setResultado] = useState<Recomendacao | null>(null)

  if (cols.length === 0) return null

  function abrir() {
    const saved = getPrefs().medidas
    if (saved) {
      setAltura(saved.altura_cm ? String(saved.altura_cm) : "")
      setPeso(saved.peso_kg ? String(saved.peso_kg) : "")
      setForm({
        busto: saved.busto ? String(saved.busto) : "",
        cintura: saved.cintura ? String(saved.cintura) : "",
        quadril: saved.quadril ? String(saved.quadril) : "",
      })
    }
    setResultado(null)
    setStep("corpo")
    open()
  }

  const corpoValido = Number(altura) > 100 && Number(peso) > 30

  function continuar() {
    const est = estimateMeasurements(Number(altura), Number(peso))
    if (est) {
      // só preenche o que a cliente ainda não informou
      setForm((prev) => ({
        busto: prev.busto || String(est.busto),
        cintura: prev.cintura || String(est.cintura),
        quadril: prev.quadril || String(est.quadril),
      }))
    }
    setStep("medidas")
  }

  const medidasInformadas = cols.some((c) => Number(form[c.key]) > 0)

  function calcular() {
    const m: Medidas = {}
    for (const c of cols) {
      const n = Number(form[c.key])
      if (n > 0) m[c.key] = n
    }
    const r = recommendSize(table, m)
    setResultado(r)
    setStep("resultado")
    setPrefs({
      medidas: {
        altura_cm: Number(altura) > 0 ? Number(altura) : undefined,
        peso_kg: Number(peso) > 0 ? Number(peso) : undefined,
        ...m,
      },
    })
    if (r) {
      try {
        const w = window as unknown as { dataLayer?: Record<string, unknown>[] }
        w.dataLayer = w.dataLayer || []
        w.dataLayer.push({
          event: "size_recommendation",
          item_id: productHandle ?? null,
          recommended_size: r.recomendado,
          fit: r.caimento,
        })
      } catch {
        /* noop */
      }
    }
  }

  function usar(size: string) {
    onSelect(size)
    setPrefs({ tamanho: size })
    close()
  }

  const disponivel = (size: string) => availableSizes.includes(size)

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="self-start text-xs underline underline-offset-2 text-eclat-terracota hover:text-eclat-terracota-claro"
        data-testid="size-recommender-open"
      >
        Qual é o meu tamanho?
      </button>

      <Modal isOpen={isOpen} close={close} size="small" data-testid="size-recommender-modal">
        <Modal.Title>Encontre seu tamanho</Modal.Title>

        {step === "corpo" && (
          <div className="flex flex-col gap-4 pt-4">
            <p className="text-sm text-eclat-grafite/70">
              Informe altura e peso para estimarmos suas medidas. Você confere e ajusta no
              próximo passo.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs text-eclat-grafite/60">
                Altura (cm)
                <input
                  type="number"
                  inputMode="numeric"
                  min={100}
                  max={230}
                  placeholder="165"
                  value={altura}
                  onChange={(e) => setAltura(e.target.value)}
                  className={inputCls}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-eclat-grafite/60">
                Peso (kg)
                <input
                  type="number"
                  inputMode="numeric"
                  min={30}
                  max={250}
                  placeholder="60"
                  value={peso}
                  onChange={(e) => setPeso(e.target.value)}
                  className={inputCls}
                />
              </label>
            </div>
            <Button variant="primary" className="w-full h-10" onClick={continuar} disabled={!corpoValido}>
              Continuar
            </Button>
            <button
              type="button"
              onClick={() => setStep("medidas")}
              className="text-xs underline text-eclat-grafite/60 self-center"
            >
              Já sei minhas medidas
            </button>
          </div>
        )}

        {step === "medidas" && (
          <div className="flex flex-col gap-4 pt-4">
            <p className="text-sm text-eclat-grafite/70">
              Meça com a fita paralela ao chão: busto na parte mais cheia, cintura na mais
              fina, quadril na mais cheia. Ajuste os valores se precisar.
            </p>
            <div className="grid grid-cols-3 gap-3">
              {cols.map((c) => (
                <label key={c.key} className="flex flex-col gap-1 text-xs text-eclat-grafite/60">
                  {LABEL[c.key]} (cm)
                  <input
                    type="number"
                    inputMode="numeric"
                    min={40}
                    max={200}
                    value={form[c.key]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [c.key]: e.target.value }))}
                    className={inputCls}
                  />
                </label>
              ))}
            </div>
            <Button variant="primary" className="w-full h-10" onClick={calcular} disabled={!medidasInformadas}>
              Encontrar meu tamanho
            </Button>
            <button
              type="button"
              onClick={() => setStep("corpo")}
              className="text-xs underline text-eclat-grafite/60 self-center"
            >
              Voltar
            </button>
          </div>
        )}

        {step === "resultado" && !resultado && (
          <div className="flex flex-col gap-4 pt-4">
            <p className="text-sm text-eclat-grafite/70">
              Não conseguimos calcular com essas medidas. Confira os valores e tente de novo.
            </p>
            <Button variant="secondary" className="w-full h-10" onClick={() => setStep("medidas")}>
              Voltar
            </Button>
          </div>
        )}

        {step === "resultado" && resultado && (
          <div className="flex flex-col gap-4 pt-4" data-testid="size-recommender-result">
            <div className="text-center">
              <p className="text-[11px] uppercase tracking-wider text-eclat-grafite/60">
                Seu tamanho ideal
              </p>
              <p className="font-serif text-5xl text-eclat-grafite leading-none mt-1">
                {resultado.recomendado}
              </p>
              <p className="text-sm text-eclat-grafite/70 mt-2">{CAIMENTO[resultado.caimento]}</p>
            </div>
            <ul className="text-xs text-eclat-grafite/70 divide-y divide-ui-border-base border-y border-ui-border-base">
              {resultado.detalhes.map((d) => (
                <li key={d.medida} className="flex justify-between py-2">
                  <span>
                    {LABEL[d.medida]} {d.valor} cm
                  </span>
                  <span>
                    faixa {d.faixa.min}–{d.faixa.max} · {FIT_CURTO[d.fit]}
                  </span>
                </li>
              ))}
            </ul>
            {resultado.alternativa && (
              <p className="text-xs text-eclat-grafite/70 text-center">
                Também pode servir: <strong>{resultado.alternativa}</strong>
                {resultado.caimento === "justo" && " (mais confortável)"}
                {resultado.caimento === "folgado" && " (mais sustentação)"}
              </p>
            )}
            {disponivel(resultado.recomendado) ? (
              <Button
                variant="primary"
                className="w-full h-10"
                onClick={() => usar(resultado.recomendado)}
                data-testid="size-recommender-select"
              >
                Selecionar {resultado.recomendado}
              </Button>
            ) : (
              <p className="text-xs text-eclat-terracota text-center">
                O tamanho {resultado.recomendado} não está disponível nesta peça.
              </p>
            )}
            {resultado.alternativa && disponivel(resultado.alternativa) && (
              <Button
                variant="secondary"
                className="w-full h-10"
                onClick={() => usar(resultado.alternativa as string)}
              >
                Selecionar {resultado.alternativa}
              </Button>
            )}
            <button
              type="button"
              onClick={() => setStep("corpo")}
              className="text-xs underline text-eclat-grafite/60 self-center"
            >
              Calcular novamente
            </button>
            <p className="text-[10px] text-eclat-grafite/50 text-center leading-relaxed">
              Estimativa com base na tabela de medidas desta peça. Nossos tecidos têm compressão
              com elasticidade — entre dois tamanhos, o menor sustenta mais e o maior é mais
              confortável.
            </p>
          </div>
        )}
      </Modal>
    </>
  )
}
```

- [ ] **Step 3: Integrar ao `ProductActions`**

Em `apps/storefront/src/modules/products/components/product-actions/index.tsx`:

Adicionar imports:

```tsx
import SizeRecommender from "@modules/products/components/size-recommender"
import type { MeasureTable } from "@lib/util/measurements"
```

Trocar o tipo de props:

```tsx
type ProductActionsProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  disabled?: boolean
  // tabela de medidas da categoria do produto (null = sem recomendação, ex.: acessórios)
  measureTable?: MeasureTable | null
}
```

Trocar a desestruturação `export default function ProductActions({ product, disabled }: ProductActionsProps) {` por:

```tsx
export default function ProductActions({
  product,
  disabled,
  measureTable,
}: ProductActionsProps) {
```

Adicionar, logo após a função `setOptionValue` (antes do `useMemo` de `isValidVariant`), o detector da opção de tamanho (mesma regex já usada no efeito de pré-seleção das prefs):

```tsx
  const isSizeOption = (o: HttpTypes.StoreProductOption) =>
    /tamanho|size/i.test(o.title ?? "")
```

E no JSX, dentro do `map` das opções, trocar:

```tsx
                  <div key={option.id}>
                    <OptionSelect
                      option={option}
                      current={options[option.id]}
                      updateOption={setOptionValue}
                      title={option.title ?? ""}
                      data-testid="product-options"
                      disabled={!!disabled || isAdding}
                    />
                  </div>
```

por:

```tsx
                  <div key={option.id} className="flex flex-col gap-y-2">
                    <OptionSelect
                      option={option}
                      current={options[option.id]}
                      updateOption={setOptionValue}
                      title={option.title ?? ""}
                      data-testid="product-options"
                      disabled={!!disabled || isAdding}
                    />
                    {isSizeOption(option) && measureTable && (
                      <SizeRecommender
                        table={measureTable}
                        availableSizes={(option.values ?? []).map((v) => v.value)}
                        onSelect={(size) => setOptionValue(option.id, size)}
                        productHandle={product.handle ?? undefined}
                      />
                    )}
                  </div>
```

- [ ] **Step 4: Wrapper e template repassam a tabela**

Substituir `apps/storefront/src/modules/products/templates/product-actions-wrapper/index.tsx` por:

```tsx
import { listProducts } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import ProductActions from "@modules/products/components/product-actions"
import type { MeasureTable } from "@lib/util/measurements"

/**
 * Fetches real time pricing for a product and renders the product actions component.
 */
export default async function ProductActionsWrapper({
  id,
  region,
  measureTable,
}: {
  id: string
  region: HttpTypes.StoreRegion
  measureTable?: MeasureTable | null
}) {
  const product = await listProducts({
    queryParams: { id: [id] },
    regionId: region.id,
  }).then(({ response }) => response.products[0])

  if (!product) {
    return null
  }

  return <ProductActions product={product} region={region} measureTable={measureTable} />
}
```

Em `apps/storefront/src/modules/products/templates/index.tsx`:

Adicionar import:

```tsx
import { getMeasureTableForProduct } from "@lib/data/measurements"
```

Tornar o componente assíncrono e buscar a tabela. Trocar:

```tsx
const ProductTemplate: React.FC<ProductTemplateProps> = ({
  product,
  region,
  countryCode,
  images,
  personaMedia = [],
}) => {
  if (!product || !product.id) {
    return notFound()
  }
```

por:

```tsx
const ProductTemplate = async ({
  product,
  region,
  countryCode,
  images,
  personaMedia = [],
}: ProductTemplateProps) => {
  if (!product || !product.id) {
    return notFound()
  }

  // tabela de medidas da categoria (site_content.medidas) — alimenta o "Qual é o meu
  // tamanho?" e a tabela exibida na página (mesma fonte, sem contradição)
  const measureTable = await getMeasureTableForProduct(product)
```

Trocar o `Suspense` das ações por:

```tsx
          <Suspense
            fallback={
              <ProductActions
                disabled={true}
                product={product}
                region={region}
                measureTable={measureTable}
              />
            }
          >
            <ProductActionsWrapper
              id={product.id}
              region={region}
              measureTable={measureTable}
            />
          </Suspense>
```

Deixar `<SizeGuide />` como está nesta task; a Task 6 cria a prop `table` e troca a chamada.

- [ ] **Step 5: Typecheck e lint**

Run: `cd apps/storefront && npx tsc --noEmit && npm run lint`
Expected: sem erros.

- [ ] **Step 6: Verificar no navegador**

1. Garantir que a categoria do produto tem tabela no Cockpit → Vitrine → "Guia de medidas por categoria" (ex.: `macaquinhos`, `leggings`). Se não tiver, criar com "+ criar tabela" e Salvar.
2. `npm run dev --workspace=apps/storefront`, abrir a PDP de um produto dessa categoria.
3. Abaixo do seletor "Escolha: Tamanho" aparece o link "Qual é o meu tamanho?". Clique → modal passo 1. Digitar 165 / 60 → Continuar → passo 2 pré-preenchido (94 / 73 / 98 se a tabela tem as três colunas) → "Encontrar meu tamanho" → resultado **M**, "Caimento ideal", botão "Selecionar M".
4. "Selecionar M" fecha o modal, marca `M` no seletor e a URL ganha `?v_id=...` da variante M. Recarregar a página: `M` continua pré-selecionado (prefs) e o modal reabre já preenchido.
5. Testar 1,55 / 45 → pré-preenche 87 / 66 / 91 → deve cair em **P** com "Caimento ideal" (todas as medidas dentro das faixas de P). Editar a cintura para 75 e recalcular → **M** com "Fica mais justo" e alternativa **G**.
6. Produto de acessório (sem tabela): link não aparece. Console sem erros.

- [ ] **Step 7: Commit**

```bash
git add apps/storefront/src/modules/personalization/prefs.ts apps/storefront/src/modules/products/components/size-recommender/index.tsx apps/storefront/src/modules/products/components/product-actions/index.tsx apps/storefront/src/modules/products/templates/product-actions-wrapper/index.tsx apps/storefront/src/modules/products/templates/index.tsx
git commit -m "feat(vitrine): modal 'Qual é o meu tamanho?' na PDP — altura/peso pré-preenche, medidas × tabela da categoria, seleciona a variante"
```

---

### Task 6: Tabela da página usa a mesma fonte + docs

**Files:**
- Modify: `apps/storefront/src/modules/products/components/size-guide/index.tsx`
- Modify: `apps/storefront/src/modules/products/templates/index.tsx` (se ainda `<SizeGuide />`)
- Modify: `progress.md`

**Interfaces:**
- Consumes: `MeasureTable`.
- Produces: `SizeGuide({ table }: { table?: MeasureTable | null })` — com `table`, renderiza `columns`/`rows` dinâmicos; sem, mantém as ROWS atuais.

- [ ] **Step 1: Tornar a seção dinâmica com fallback**

Substituir o conteúdo de `apps/storefront/src/modules/products/components/size-guide/index.tsx` por:

```tsx
import type { MeasureTable } from "@lib/util/measurements"

// Tabela de medidas DENTRO da PDP (spec, Nota 09) — tamanho errado é a causa
// nº 1 de troca; a tabela fica na página de decisão, não a dois cliques.
// Fonte: site_content.medidas (Cockpit → Vitrine → Medidas), escolhida pela categoria
// do produto. É a MESMA tabela usada pelo "Qual é o meu tamanho?". Fallback: padrão da marca.
const FALLBACK: MeasureTable = {
  columns: ["Busto", "Cintura", "Quadril"],
  rows: [
    ["P", "82–88 cm", "62–68 cm", "88–94 cm"],
    ["M", "88–94 cm", "68–74 cm", "94–100 cm"],
    ["G", "94–100 cm", "74–80 cm", "100–106 cm"],
    ["GG", "100–108 cm", "80–88 cm", "106–114 cm"],
  ],
}

export default function SizeGuide({ table }: { table?: MeasureTable | null }) {
  const t = table ?? FALLBACK
  return (
    <section id="medidas" className="scroll-mt-24">
      <h2 className="font-serif text-2xl text-eclat-grafite mb-4">
        Acerte o tamanho de primeira
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-ui-border-base rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-eclat-areia/30 text-left">
              {["Tamanho", ...t.columns].map((h) => (
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
            {t.rows.map((r) => (
              <tr key={r[0]} className="border-t border-ui-border-base">
                {r.map((cell, i) => (
                  <td key={i} className={i === 0 ? "px-3 py-2 font-semibold" : "px-3 py-2"}>
                    {cell}
                  </td>
                ))}
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
```

- [ ] **Step 2: Garantir que o template passa a prop**

Em `apps/storefront/src/modules/products/templates/index.tsx`, a linha deve ser `<SizeGuide table={measureTable} />` (feito na Task 5 ou agora).

- [ ] **Step 3: Typecheck, lint, suíte completa**

Run: `cd apps/storefront && npx tsc --noEmit && npm run lint && cd ../.. && npm run test --workspace=apps/storefront`
Expected: sem erros; todos os testes (availability, colors, measurements, product-video, size-recommendation, category-path) PASS.

- [ ] **Step 4: Verificar no navegador**

PDP de um produto de `leggings` (tabela com colunas Cintura/Quadril): a seção "Acerte o tamanho de primeira" mostra **2 colunas** de medida (sem Busto), e o modal pede só Cintura e Quadril. Produto sem categoria com tabela: seção mostra o fallback de 3 colunas e o link do modal não aparece.

- [ ] **Step 5: Registrar em `progress.md`**

Adicionar ao final de `progress.md`:

```markdown
## 2026-09-07 — PDP: vídeo na galeria + "Qual é o meu tamanho?"
- Referência estudada: useange.com.br (Angè). "Ver Vídeo" = YouTube em loop mudo como item da galeria; "Provador Virtual" = SaaS DressOn (try-on IA R$147/mês + recomendação de tamanho R$97/mês). Decisão: implementar em casa vídeo + recomendação por medidas; try-on IA fica como decisão comercial futura (contratar, não construir).
- VÍDEO: `product.metadata.youtube_id` (ID ou URL; preencher no Cockpit → Ficha técnica) → 2º item da galeria como facade (thumb + "Ver vídeo"); iframe youtube-nocookie só ao clique (autoplay/mute/loop/controls=0). `next.config.js` libera `img.youtube.com`. Evento dataLayer `video_play`.
- TAMANHO: `recommendSize` (função pura, Vitest) compara busto/cintura/quadril com a tabela da categoria (`site_content.medidas`, escolhida por `getMeasureTableForProduct` via caminho de handle). Empate → maior tamanho; alternativa se ≤ 4 cm. Altura/peso só pré-preenchem (`estimateMeasurements`, heurística IMC — recalibrar com dados reais). Prefs locais `eclat_prefs.medidas`. Botão "Selecionar M" escolhe a variante. Evento `size_recommendation`.
- `SizeGuide` da PDP passou a usar a mesma tabela dinâmica (fallback nas medidas padrão). Store API agora pede `*categories`.
- FOLLOW-UPS: JSON-LD `VideoObject` (precisa de `uploadDate`); vídeo real de cada produto (asset); calibrar heurística com trocas reais; considerar "Medidas da modelo" na ficha (DressOn faz).
```

- [ ] **Step 6: Commit**

```bash
git add apps/storefront/src/modules/products/components/size-guide/index.tsx apps/storefront/src/modules/products/templates/index.tsx progress.md
git commit -m "feat(vitrine): tabela de medidas da PDP dinâmica (mesma fonte da recomendação) + progress"
```

---

## Verificação final (após a Task 6)

- [ ] `npm run test --workspace=apps/storefront` → tudo PASS.
- [ ] `cd apps/storefront && npx tsc --noEmit && npm run lint` → limpo.
- [ ] `npm run build --workspace=apps/storefront` → build passa (o `img.youtube.com` no `remotePatterns` é validado aqui).
- [ ] Mobile (375 px): item de vídeo ocupa a largura da coluna; modal do tamanho cabe sem scroll horizontal; "Selecionar M" reflete também no `MobileActions` (o estado de opções é o mesmo `options` do `ProductActions`).
- [ ] Produto sem `youtube_id` e sem tabela: PDP idêntica à anterior (regressão zero).

## Fora de escopo (decidido)

- Try-on com IA (DressOn ou similar): decisão comercial, não de código.
- Carrossel/thumbnails na galeria (a spec de navegação já deixou fora).
- JSON-LD `VideoObject`, "Medidas da modelo", tabela de medidas em polegadas.
- Mudanças no Cockpit: o campo `youtube_id` entra pela "Ficha técnica" genérica; a tabela de medidas já tem editor.

## Referência (análise de 2026-09-07 — useange.com.br)

- **Ver Vídeo:** `<button class="youtube-mobile" data-video="{id}">`; thumbnail `img.youtube.com/vi/{id}/0.jpg` como último slide; desktop cria `YT.Player` com `autoplay:1, mute:1, loop:1, controls:0, modestbranding:1, rel:0, fs:0, disablekb:1` no lugar da foto (iframe 2560×1440 cortado por CSS); mobile abre em lightbox. Play/pause próprio via `postMessage`.
- **Provador Virtual (DressOn):** `<script src="https://api.dresson.com.br/d.js" data-api-key=... data-theme-*>` injeta 3 botões (Experimentar / Provador Virtual / Tabela de medidas) em Shadow DOM. Fluxo de tamanho: altura, peso, idade → ajuste visual de busto/cintura/quadril (ou manual) → "Tamanho recomendado" + "Alternativa" + rótulo de caimento ("Caimento ideal", "Fica mais justo", "Fica mais folgado", "Pequeno demais", "Grande demais"). Foto e medidas salvas para a próxima visita. Planos: R$97 (tamanho), R$147 (IA), R$240 (completo); créditos de IA à parte; webhook HMAC de compra para ROI.
