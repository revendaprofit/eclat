# -*- coding: utf-8 -*-
"""
Capa de uma cor escolhida À MÃO: recorte 2:3 de uma foto que já está no Storage, com caixa em frações.
Serve para os pedidos pontuais da sócia (ex.: 2026-10-10, "capa do Top Aurora Grafitti de costas", "Top
Orvalho Telha de costas") sem mexer na régua automática de scripts/capas-enfase-peca.py.

A capa anterior da cor (`detalhes-pecas/<handle>/<cor>-capa-*.jpg`) sai da lista; a nova entra como 1ª foto da
cor e vira thumbnail do produto se a antiga era. Nenhuma foto de `products/` é apagada.

Uso:
  python -B scripts/capa-manual.py --handle top-aurora --cor Grafitti --foto products/top-aurora/grafitti-02-6b063398.jpg --caixa 0.10,0.12,0.90,0.62
  ... --apply       # sem --apply só gera a prévia em brand-assets/detalhes-pecas/previa-manual.jpg
A caixa é x0,y0,x1,y1 em frações da foto; a altura é ajustada para 2:3 a partir da largura (centro mantido).
"""
import hashlib, io, json, os, sys, time
import requests
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RAIZ, "scripts"))
import importlib
fd = importlib.import_module("fotos-detalhe")   # env, Medusa, jpeg

PROJ = os.path.dirname(RAIZ)
def arg(n, d=None): return sys.argv[sys.argv.index(n) + 1] if n in sys.argv else d
APPLY = "--apply" in sys.argv
HANDLE, COR, FOTO = arg("--handle"), arg("--cor"), arg("--foto")
CAIXA = tuple(float(v) for v in arg("--caixa").split(","))
STORAGE = "https://hqphayoyusbzfhyrxjga.supabase.co/storage/v1/object/public/site/"

def recorte(im, caixa):
    W, H = im.size; x0, y0, x1, y1 = caixa
    w = (x1 - x0) * W; h = w * 1.5
    cx, cy = (x0 + x1) / 2 * W, (y0 + y1) / 2 * H
    if h > H: h = H; w = h * 2 / 3
    cx0 = max(0, min(cx - w / 2, W - w)); cy0 = max(0, min(cy - h / 2, H - h))
    return im.crop((int(cx0), int(cy0), int(cx0 + w), int(cy0 + h)))

def main():
    if hasattr(sys.stdout, "reconfigure"): sys.stdout.reconfigure(encoding="utf-8")
    assert HANDLE and COR and FOTO and len(CAIXA) == 4, "use --handle --cor --foto --caixa x0,y0,x1,y1"
    slug = COR.lower().replace(" ", "-")
    im = Image.open(io.BytesIO(requests.get(STORAGE + FOTO, timeout=120).content)).convert("RGB")
    rec = recorte(im, CAIXA); data = fd.jpeg(rec)
    dest = "detalhes-pecas/%s/%s-capa-%s.jpg" % (HANDLE, slug, hashlib.md5(data).hexdigest()[:8])
    pasta = os.path.join(PROJ, "brand-assets", "detalhes-pecas"); os.makedirs(pasta, exist_ok=True)
    rec.copy().reduce(2).save(os.path.join(pasta, "previa-manual.jpg"), quality=85)
    print("%s / %s: %s  (%d KB) — prévia em brand-assets/detalhes-pecas/previa-manual.jpg" % (HANDLE, COR, dest, len(data) // 1024))
    if not APPLY: print("modo: SIMULAÇÃO (use --apply)"); return

    e = fd.env(); api = fd.Medusa(e); sb = e["NEXT_PUBLIC_SUPABASE_URL"]
    SH = {"apikey": e["SUPABASE_SERVICE_ROLE_KEY"], "Authorization": "Bearer " + e["SUPABASE_SERVICE_ROLE_KEY"]}
    p = api.get("/admin/products?handle=%s&fields=id,thumbnail,*images,*variants,*variants.options" % HANDLE)["products"][0]
    bk = os.path.join(PROJ, "brand-assets", "backup-capa-manual-%s-%s-%s.json" % (HANDLE, slug, time.strftime("%Y-%m-%d-%H%M")))
    with io.open(bk, "w", encoding="utf-8") as f: json.dump({"thumbnail": p.get("thumbnail"), "images": p["images"]}, f, ensure_ascii=False, indent=1)
    up = requests.post("%s/storage/v1/object/site/%s" % (sb, dest), headers=dict(SH, **{"Content-Type": "image/jpeg", "x-upsert": "true", "cache-control": "max-age=31536000"}), data=data, timeout=180)
    if not up.ok: raise RuntimeError("upload %s -> %s" % (dest, up.status_code))
    nova_url = sb + "/storage/v1/object/public/site/" + dest
    ordem = [i["url"] for i in p["images"]]; por_url = {i["url"]: i["id"] for i in p["images"]}
    antiga = [u for u in ordem if "/detalhes-pecas/%s/%s-capa-" % (HANDLE, slug) in u]
    primeira = next((u for u in ordem if "/%s/%s-" % (HANDLE, slug) in u), None)
    nova = []
    for u in ordem:
        if u in antiga: continue
        if u == primeira: nova.append(nova_url)
        nova.append(u)
    if nova_url not in nova: nova.append(nova_url)
    thumb = p.get("thumbnail")
    if thumb and (thumb in antiga or thumb == primeira): thumb = nova_url
    body = {"images": [({"id": por_url[u], "url": u} if u in por_url else {"url": u}) for u in nova]}
    if thumb: body["thumbnail"] = thumb
    api.post("/admin/products/%s" % p["id"], body)
    prod = api.get("/admin/products/%s?fields=id,*images,*variants,*variants.options" % p["id"])["product"]
    ids_img = {i["url"]: i["id"] for i in prod["images"]}
    vids = [v["id"] for v in prod["variants"] if any(o.get("value") == COR for o in v.get("options") or [])]
    api.post("/admin/products/%s/images/%s/variants/batch" % (p["id"], ids_img[nova_url]), {"add": vids})
    print("aplicado: capa antiga removida (%d), nova na frente da cor; thumbnail: %s; backup: %s" % (len(antiga), "trocada" if thumb == nova_url else "mantida", os.path.basename(bk)))
    import subprocess
    subprocess.run([sys.executable, "-B", os.path.join(RAIZ, "scripts", "gerar-variantes-fotos.py"), "--apply"], check=False, stdout=subprocess.DEVNULL)

if __name__ == "__main__":
    main()
