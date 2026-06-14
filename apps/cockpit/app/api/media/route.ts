import { NextResponse } from "next/server"

// Proxy de mídia: baixa do Supabase Storage (bucket privado) com service_role e
// devolve o arquivo. Protegido pelo middleware (só operador autenticado chega aqui).
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function GET(req: Request) {
  const path = new URL(req.url).searchParams.get("path")
  if (!path || path.includes("..")) {
    return new NextResponse("path inválido", { status: 400 })
  }

  const res = await fetch(`${SB_URL}/storage/v1/object/whatsapp/${path}`, {
    headers: { apikey: SB_KEY as string, Authorization: `Bearer ${SB_KEY}` },
  })
  if (!res.ok) {
    return new NextResponse("mídia não encontrada", { status: 404 })
  }

  const buf = await res.arrayBuffer()
  return new NextResponse(buf, {
    headers: {
      "Content-Type": res.headers.get("content-type") || "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    },
  })
}
