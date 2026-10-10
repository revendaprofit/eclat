# -*- coding: utf-8 -*-
"""
Foto quadrada de cada categoria-raiz para os círculos da home (pedido da sócia, 2026-10-10): o círculo
precisa mostrar a peça inteira que o nome anuncia — short inteiro (de costas, com o logo no cós), tronco
completo do macaquinho de costas, camiseta masculina no tronco, top inteiro. Caixas escolhidas à mão sobre
fotos que já estão no Storage (frações x0, y0, x1, y1 da foto; a caixa é quadrada).

Sobe para `site/categorias/<handle>-<hash>.jpg` (720 px) e grava `metadata.menu_image_url` da categoria —
a mesma chave que o menu usa para o quadradinho (lib/util/navigation.ts) e que a home lê primeiro para o
círculo (modules/home/components/categorias-stories).

Uso:
  python -B scripts/fotos-categorias.py            # prévia em brand-assets/categorias/previa.jpg
  python -B scripts/fotos-categorias.py --apply    # sobe e grava nas categorias
"""
import hashlib, io, os, sys
import requests
from PIL import Image, ImageDraw, ImageFont

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RAIZ, "scripts"))
import importlib
fd = importlib.import_module("fotos-detalhe")   # env, Medusa

PROJ = os.path.dirname(RAIZ)
APPLY = "--apply" in sys.argv
SAIDA = os.path.join(PROJ, "brand-assets", "categorias")
LADO = 720
STORAGE = "https://hqphayoyusbzfhyrxjga.supabase.co/storage/v1/object/public/site/"

# handle da categoria-raiz -> (caminho no Storage, caixa quadrada em frações da foto)
FOTOS = {
    "tops": ("detalhes-pecas/top-aurora/telha-capa-682e0568.jpg", (0.00, 0.10, 1.00, 0.767)),            # top inteiro, zíper
    "shorts": ("products/short-aurora/telha-02-49df6f29.jpg", (0.03, 0.37, 0.93, 0.97)),                # short inteiro de costas, logo no cós
    "macaquinhos": ("products/macaquinho-solaris/telha-02-11f4a088.jpg", (0.17, 0.30, 0.83, 0.74)),  # tronco de costas, alças cruzadas
    "masculino": ("detalhes-pecas/camiseta-raglan-dry/grafitti-capa-e5260feb.jpg", (0.05, 0.06, 0.95, 0.66)),  # camiseta no tronco, fundo branco
}

def quadrado(im, caixa):
    W, H = im.size; x0, y0, x1, y1 = caixa
    cx0, cy0, cx1, cy1 = x0 * W, y0 * H, x1 * W, y1 * H
    lado = min(cx1 - cx0, cy1 - cy0)                      # garante 1:1 mesmo se as frações não baterem exato
    cx = (cx0 + cx1) / 2; cy = (cy0 + cy1) / 2
    cx0, cy0 = max(0, min(cx - lado / 2, W - lado)), max(0, min(cy - lado / 2, H - lado))
    rec = im.crop((int(cx0), int(cy0), int(cx0 + lado), int(cy0 + lado)))
    return rec.resize((LADO, LADO), Image.LANCZOS)

def main():
    if hasattr(sys.stdout, "reconfigure"): sys.stdout.reconfigure(encoding="utf-8")
    e = fd.env(); sb = e["NEXT_PUBLIC_SUPABASE_URL"]
    SH = {"apikey": e["SUPABASE_SERVICE_ROLE_KEY"], "Authorization": "Bearer " + e["SUPABASE_SERVICE_ROLE_KEY"]}
    os.makedirs(SAIDA, exist_ok=True)
    prontas = {}
    for handle, (caminho, caixa) in FOTOS.items():
        im = Image.open(io.BytesIO(requests.get(STORAGE + caminho, timeout=120).content)).convert("RGB")
        q = quadrado(im, caixa)
        b = io.BytesIO(); q.save(b, "JPEG", quality=86, optimize=True, progressive=True); data = b.getvalue()
        dest = "categorias/%s-%s.jpg" % (handle, hashlib.md5(data).hexdigest()[:8])
        prontas[handle] = (q, data, dest)
        print("%-20s %s  (%d KB)" % (handle, dest, len(data) // 1024))
    # prévia
    s = Image.new("RGB", (len(prontas) * 320, 350), "white"); d = ImageDraw.Draw(s); font = ImageFont.truetype("arial.ttf", 16)
    for i, (h, (q, data, dest)) in enumerate(prontas.items()):
        t = q.copy(); t.thumbnail((300, 300)); s.paste(t, (i * 320 + 10, 36)); d.text((i * 320 + 10, 10), h, fill="black", font=font)
    s.save(os.path.join(SAIDA, "previa.jpg"), quality=85); print("prévia:", os.path.join(SAIDA, "previa.jpg"))
    if not APPLY: print("modo: SIMULAÇÃO (use --apply)"); return

    api = fd.Medusa(e)
    cats = api.get("/admin/product-categories?limit=100&fields=id,handle,name,metadata")["product_categories"]
    por_handle = {c["handle"]: c for c in cats}
    for h, (q, data, dest) in prontas.items():
        c = por_handle.get(h)
        if not c: print("categoria %s não existe, pulo" % h); continue
        up = requests.post("%s/storage/v1/object/site/%s" % (sb, dest), headers=dict(SH, **{"Content-Type": "image/jpeg", "x-upsert": "true", "cache-control": "max-age=31536000"}), data=data, timeout=180)
        if not up.ok: raise RuntimeError("upload %s -> %s" % (dest, up.status_code))
        meta = dict(c.get("metadata") or {}); meta["menu_image_url"] = sb + "/storage/v1/object/public/site/" + dest
        api.post("/admin/product-categories/%s" % c["id"], {"metadata": meta})
        print("  %s (%s): menu_image_url gravada" % (c["name"], h))
    print("modo: APLICADO")

if __name__ == "__main__":
    main()
