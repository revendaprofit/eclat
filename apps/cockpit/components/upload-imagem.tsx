"use client"

import { useState } from "react"

// Upload genérico de imagem via /api/site-upload — usado na Vitrine e em Conjuntos curados.
export default function UploadImagem({
  url,
  onChange,
}: {
  url?: string
  onChange: (url: string | undefined) => void
}) {
  const [enviando, setEnviando] = useState(false)
  async function enviar(file: File) {
    setEnviando(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const r = await fetch("/api/site-upload", { method: "POST", body: fd })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || "Falha no upload")
      onChange(d.url)
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }
  return (
    <div className="flex items-center gap-3">
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="prévia" className="w-24 h-16 object-cover rounded border border-eclat-pedra/40" />
      )}
      <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && enviar(e.target.files[0])} className="text-xs" />
      {enviando && <span className="text-xs text-eclat-grafite/50">enviando…</span>}
      {url && (
        <button onClick={() => onChange(undefined)} className="text-xs text-red-700 underline">remover</button>
      )}
    </div>
  )
}
