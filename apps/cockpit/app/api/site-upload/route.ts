import { NextResponse } from "next/server"

// Upload de imagem do SITE para o Supabase Storage (bucket público 'site').
// URL pública (https://<proj>.supabase.co/...) acessível de qualquer dispositivo — inclusive o celular.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(req: Request) {
  const form = await req.formData()
  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "arquivo não enviado" }, { status: 400 })
  }
  try {
    const ext = file.name.split(".").pop() || "jpg"
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const buf = Buffer.from(await file.arrayBuffer())
    const up = await fetch(`${URL}/storage/v1/object/site/${path}`, {
      method: "POST",
      headers: {
        apikey: SR as string,
        Authorization: `Bearer ${SR}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "true",
      },
      body: buf,
    })
    if (!up.ok) throw new Error(`upload falhou (HTTP ${up.status}): ${await up.text()}`)
    const publicUrl = `${URL}/storage/v1/object/public/site/${path}`
    return NextResponse.json({ url: publicUrl })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
