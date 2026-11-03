// Foto enviada pelo Cockpit entra leve no site (03/11): lado maior até 1600 px e no máximo ~250 KB, só compressão, sem
// mexer em cor nem tom. Sem isso, foto do celular (3 a 8 MB) entrava inteira e pesava para quem compra no 4G.
export const LADO_MAXIMO = 1600
export const BYTES_ALVO = 250 * 1024
const QUALIDADES = [0.85, 0.75, 0.65, 0.55]

export function medidasReduzidas(largura: number, altura: number, lado = LADO_MAXIMO) {
  const fator = Math.min(1, lado / Math.max(largura, altura))
  return { largura: Math.round(largura * fator), altura: Math.round(altura * fator) }
}

// Arquivo que o navegador não sabe abrir (HEIC, por exemplo) volta como veio: a rota de envio recusa se for grande.
export async function reduzirImagem(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml" || file.type === "image/gif") return file
  if (file.size <= BYTES_ALVO) return file
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }
  const { largura, altura } = medidasReduzidas(bitmap.width, bitmap.height)
  const canvas = document.createElement("canvas")
  canvas.width = largura
  canvas.height = altura
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, largura, altura)
  bitmap.close()
  // PNG pode ter fundo transparente (logo): WebP preserva, JPEG pintaria de preto.
  const tipo = file.type === "image/png" ? "image/webp" : "image/jpeg"
  const ext = tipo === "image/webp" ? "webp" : "jpg"
  let melhor: Blob | null = null
  for (const q of QUALIDADES) {
    melhor = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, tipo, q))
    if (melhor && melhor.size <= BYTES_ALVO) break
  }
  if (!melhor || melhor.size >= file.size) return file
  return new File([melhor], file.name.replace(/\.[^.]+$/, "") + "." + ext, { type: tipo })
}
