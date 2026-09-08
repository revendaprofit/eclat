"use client"

import { useCallback, useEffect, useState } from "react"
import type { GroupedImages } from "@/lib/color-images"

// Editor de fotos por COR do produto (spec 4.5). Cada cor lista as fotos vinculadas a
// todas as suas variantes; "Sem cor" são fotos do produto ainda não atribuídas.
export default function ColorImages({ productId }: { productId: string }) {
  const [data, setData] = useState<GroupedImages | null>(null)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`/api/products/${productId}/images`, { cache: "no-store" })
      const d = await r.json()
      if (!r.ok) return setErro(d.error || "Falha ao carregar fotos")
      setErro(null)
      setData(d)
    } catch {
      setErro("Falha ao carregar fotos")
    }
  }, [productId])
  useEffect(() => {
    carregar()
  }, [carregar])

  async function call(url: string, init: RequestInit) {
    setBusy(true)
    setErro(null)
    try {
      const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init.headers || {}) } })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || "Falha na operação")
      setData(d)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function upload(files: FileList, color: string | null) {
    setBusy(true)
    try {
      const urls: string[] = []
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append("file", file)
        const r = await fetch("/api/uploads", { method: "POST", body: fd })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || "Falha no upload")
        urls.push(d.url)
      }
      await call(`/api/products/${productId}/images`, { method: "POST", body: JSON.stringify({ urls, color: color ?? undefined }) })
    } catch (e) {
      setErro((e as Error).message)
      setBusy(false)
    }
  }
  const mover = (imageId: string, color: string | null) =>
    call(`/api/products/${productId}/images/${imageId}`, { method: "PATCH", body: JSON.stringify({ color }) })
  const remover = (imageId: string) =>
    confirm("Remover esta foto do produto?") && call(`/api/products/${productId}/images/${imageId}`, { method: "DELETE" })
  const capa = (url: string) => call(`/api/products/${productId}/images`, { method: "POST", body: JSON.stringify({ thumbnail: url }) })

  if (erro && !data)
    return (
      <div className="text-xs text-red-700 flex items-center gap-2">
        <span>{erro}</span>
        <button onClick={() => carregar()} className="underline">tentar novamente</button>
      </div>
    )
  if (!data) return <p className="text-xs text-eclat-grafite/50">Carregando fotos…</p>

  const cores = data.groups.map((g) => g.color)
  const Bloco = ({ titulo, color, images }: { titulo: string; color: string | null; images: { id: string; url: string }[] }) => (
    <div className="border border-eclat-pedra/40 rounded-md p-3 bg-white flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{titulo} <span className="text-xs text-eclat-grafite/40">({images.length})</span></span>
        <label className="text-xs text-eclat-dourado underline cursor-pointer">
          + fotos
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files?.length && upload(e.target.files, color)} />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        {images.map((img) => (
          <div key={img.id} className="w-24 flex flex-col gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt="" className={`w-24 h-24 object-cover rounded border ${data.thumbnail === img.url ? "border-eclat-dourado ring-2 ring-eclat-dourado/40" : "border-eclat-pedra/40"}`} />
            <select value={color ?? ""} onChange={(e) => mover(img.id, e.target.value || null)} className="text-[11px] border border-eclat-pedra/50 rounded px-1 py-0.5 bg-white">
              <option value="">Sem cor</option>
              {cores.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="flex justify-between text-[11px]">
              <button onClick={() => capa(img.url)} className="underline" title="Usar como capa do produto">{data.thumbnail === img.url ? "capa ✓" : "capa"}</button>
              <button onClick={() => remover(img.id)} className="text-red-700 underline">remover</button>
            </div>
          </div>
        ))}
        {!images.length && <p className="text-xs text-eclat-grafite/40">Nenhuma foto.</p>}
      </div>
    </div>
  )

  return (
    <div className={`flex flex-col gap-3 ${busy ? "opacity-60 pointer-events-none" : ""}`}>
      {erro && <p className="text-xs text-red-700">{erro}</p>}
      {!cores.length && <p className="text-xs text-amber-700">Este produto não tem a opção &quot;Cor&quot;; as fotos ficam sem agrupamento.</p>}
      {data.groups.map((g) => <Bloco key={g.color} titulo={g.color} color={g.color} images={g.images} />)}
      <Bloco titulo="Sem cor" color={null} images={data.unassigned} />
      <p className="text-xs text-eclat-grafite/50">
        A vitrine mostra as fotos da cor escolhida; a capa é a foto do card. Foto em &quot;Sem cor&quot; aparece em todas as cores.
      </p>
    </div>
  )
}
