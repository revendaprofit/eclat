import { NextResponse } from "next/server"
import sitemap from "../../../sitemap"
import { getBaseURL } from "@lib/util/env"
import { pingIndexNow } from "@lib/util/indexnow"

// Submete todas as URLs públicas (as mesmas do sitemap) ao IndexNow.
// Chamar após publicar/alterar produto (manual, Cockpit ou cron).
// GET /api/seo/indexnow
export const dynamic = "force-dynamic"

export async function GET() {
  const base = getBaseURL()
  const host = new URL(base).host

  if (host.startsWith("localhost")) {
    return NextResponse.json(
      { ok: false, error: "IndexNow não roda em localhost" },
      { status: 400 }
    )
  }

  const entries = await sitemap()
  const urls = entries.map((e) => e.url)
  const result = await pingIndexNow(host, urls)

  // 200/202 = aceito pelo IndexNow
  const ok = result.status === 200 || result.status === 202
  return NextResponse.json({ ok, ...result })
}
