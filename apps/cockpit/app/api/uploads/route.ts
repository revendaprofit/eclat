import { NextResponse } from "next/server"
import { medusaAdminToken } from "@/lib/medusa"

// Recebe a imagem do cockpit e repassa ao Medusa (POST /admin/uploads),
// devolvendo a URL pública do arquivo.
export async function POST(req: Request) {
  const form = await req.formData()
  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "arquivo não enviado" }, { status: 400 })
  }
  // Trava de peso (03/11): a tela já reduz a foto antes de enviar; o que chega grande aqui é o que ela não conseguiu abrir.
  if (file.type.startsWith("image/") && file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "Foto acima de 2 MB. Salve em JPG e envie de novo." }, { status: 413 })
  }
  try {
    const token = await medusaAdminToken()
    const fd = new FormData()
    fd.append("files", file, file.name)
    const r = await fetch(`${process.env.MEDUSA_ADMIN_URL}/admin/uploads`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data?.message || `upload falhou (HTTP ${r.status})`)
    const url = data?.files?.[0]?.url
    if (!url) throw new Error("upload sem URL de retorno")
    return NextResponse.json({ url })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
