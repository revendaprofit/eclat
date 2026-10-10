# -*- coding: utf-8 -*-
"""
Fotos de DETALHE da peça (pedido da sócia, 2026-10-10): recorte 2:3 com foco só no top, só no short
ou só na camiseta, gerado a partir da foto de capa de cada cor que já está na galeria em produção.
A foto inteira continua sendo a capa; o detalhe entra como 2ª foto da cor (vira a foto do hover no card).

A pessoa é localizada pela silhueta (ISNet, modelo já presente em ~/.rembg/models, o mesmo do banner)
e o recorte é uma fração da altura dela: top/camiseta = ombros até o quadril; short = cintura até o joelho;
macaquinho ganha os dois. Nada é removido nem alterado nas fotos existentes.

Sobe para `site/detalhes-pecas/<handle>/` (fora de `site/products/<handle>/`, que scripts/import-lumiere.py
limpa a cada rodada — ali as fotos de outra origem são preservadas, só vão para o fim da galeria).

Uso:
  python scripts/fotos-detalhe.py                 # simulação: gera a prévia em brand-assets/detalhes-pecas/previa.jpg
  python scripts/fotos-detalhe.py --apply         # sobe e insere nos produtos (idempotente: não duplica)
  python scripts/fotos-detalhe.py --apply --handle top-orvalho
Requisitos: pip install requests pillow numpy opencv-python onnxruntime
"""
import hashlib, io, os, sys
import numpy as np, cv2, onnxruntime as ort, requests
from PIL import Image, ImageDraw, ImageFont

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJ = os.path.dirname(RAIZ)
BASE = os.environ.get("MEDUSA_URL", "https://endearing-enthusiasm-production-775b.up.railway.app")
APPLY = "--apply" in sys.argv
SO = sys.argv[sys.argv.index("--handle") + 1] if "--handle" in sys.argv else None
MODELO = os.path.expanduser(r"~\.rembg\models\isnet-general-use\isnet-general-use.onnx")
SAIDA = os.path.join(PROJ, "brand-assets", "detalhes-pecas")
LADO_MAX = 1400
JPEG_Q = 88

# Recortes por categoria, em fração da ALTURA da silhueta (0 = topo da cabeça, 1 = pés).
# Cada recorte é 2:3; a largura sai da altura e fica centrada no eixo da pessoa.
RECORTES = {
    "tops": [("top", 0.20, 0.55)],
    "camisetas-regatas": [("camiseta", 0.14, 0.58)],
    "shorts": [("short", 0.42, 0.80)],
    "macaquinhos": [("top", 0.20, 0.55), ("short", 0.42, 0.80)],
}

_ses = None
def silhueta(im):
    """Caixa (x0,y0,x1,y1) e eixo x da pessoa, em pixels da imagem."""
    global _ses
    if _ses is None: _ses = ort.InferenceSession(MODELO, providers=["CPUExecutionProvider"])
    rgb = np.asarray(im.convert("RGB"))
    x = ((cv2.resize(rgb, (1024, 1024), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0) - 0.5).transpose(2, 0, 1)[None]
    y = _ses.run(None, {_ses.get_inputs()[0].name: x})[0][0, 0]
    y = (y - y.min()) / (y.max() - y.min() + 1e-8)
    m = cv2.resize((y > 0.5).astype(np.uint8), (rgb.shape[1], rgb.shape[0]), interpolation=cv2.INTER_NEAREST)
    # No estúdio de fundo preto a silhueta às vezes engole o pano: fica só o que não é quase-preto.
    m = m & (rgb.mean(-1) > 38)
    ys, xs = np.where(m > 0)
    if len(ys) < 500: return None
    y0, y1 = np.percentile(ys, 0.5), np.percentile(ys, 99.5)
    # eixo = mediana em x da faixa do tronco (evita braços abertos puxarem o centro)
    faixa = (ys > y0 + (y1 - y0) * 0.2) & (ys < y0 + (y1 - y0) * 0.7)
    eixo = np.median(xs[faixa]) if faixa.any() else np.median(xs)
    return (float(np.percentile(xs, 0.5)), float(y0), float(np.percentile(xs, 99.5)), float(y1), float(eixo))

def recortar(im, caixa, f0, f1):
    W, H = im.size; x0, y0, x1, y1, eixo = caixa; alt = y1 - y0
    cy0, cy1 = y0 + alt * f0, y0 + alt * f1
    h = cy1 - cy0; w = h * 2 / 3
    cx0 = min(max(0, eixo - w / 2), W - w)
    if w > W: w = W; h = w * 1.5; cx0 = 0; cy0 = max(0, min(cy0, H - h))
    return im.crop((int(cx0), int(cy0), int(cx0 + w), int(cy0 + h)))

def jpeg(im):
    im = im.convert("RGB"); im.thumbnail((LADO_MAX, LADO_MAX))
    b = io.BytesIO(); im.save(b, "JPEG", quality=JPEG_Q, optimize=True, progressive=True); return b.getvalue()

def env():
    e = {}
    with io.open(os.path.join(RAIZ, "apps", "cockpit", ".env.local"), encoding="utf-8") as f:
        for l in f:
            if "=" in l and not l.strip().startswith("#"): k, v = l.split("=", 1); e[k.strip()] = v.strip().strip('"')
    return e

class Medusa:
    def __init__(self, e):
        r = requests.post(BASE + "/auth/user/emailpass", json={"email": e["MEDUSA_ADMIN_EMAIL"], "password": e["MEDUSA_ADMIN_PASSWORD"]}, timeout=30); assert r.ok
        self.H = {"Authorization": "Bearer " + r.json()["token"]}
    def get(self, p): r = requests.get(BASE + p, headers=self.H, timeout=60); r.raise_for_status(); return r.json()
    def post(self, p, b):
        r = requests.post(BASE + p, headers=self.H, json=b, timeout=120)
        if not r.ok: raise RuntimeError("POST %s -> %s %s" % (p, r.status_code, r.text[:300]))
        return r.json()

def main():
    if hasattr(sys.stdout, "reconfigure"): sys.stdout.reconfigure(encoding="utf-8")
    e = env(); api = Medusa(e); sb = e["NEXT_PUBLIC_SUPABASE_URL"]; SH = {"apikey": e["SUPABASE_SERVICE_ROLE_KEY"], "Authorization": "Bearer " + e["SUPABASE_SERVICE_ROLE_KEY"]}
    os.makedirs(SAIDA, exist_ok=True)
    prods = api.get("/admin/products?limit=50&fields=id,handle,status,*images,*variants,*variants.options,*variants.images,*categories,*options,*options.values")["products"]
    previas = []
    for p in prods:
        if p["status"] != "published" or (SO and p["handle"] != SO): continue
        cat = next((c["handle"] for c in p.get("categories") or [] if c["handle"] in RECORTES), None)
        if not cat: continue
        opt_cor = next((o for o in p.get("options") or [] if (o.get("title") or "").lower() == "cor"), None)
        cores = [v["value"] for v in (opt_cor or {}).get("values") or []] or [None]
        imgs = p["images"]; ordem = [i["url"] for i in imgs]
        ja = {i["url"] for i in imgs if "/detalhes-pecas/" in i["url"]}
        novas = []   # (cor, url_capa, nome_recorte, bytes, dest)
        for cor in cores:
            slug = (cor or "unica").lower().replace(" ", "-")
            # Base do recorte: a 1ª foto da cor em que a pessoa aparece de corpo inteiro (silhueta com ≥ 72% da
            # altura da foto). Capa já recortada (ex.: short Telha do Orvalho) não serve de base.
            candidatas = [u for u in ordem if "/products/%s/%s-" % (p["handle"], slug) in u]
            capa = im = caixa = None
            for u in candidatas:
                im_u = Image.open(io.BytesIO(requests.get(u, timeout=120).content)); c = silhueta(im_u)
                if c and (c[3] - c[1]) >= 0.72 * im_u.size[1]: capa, im, caixa = u, im_u, c; break
            if not capa: print("  %s/%s: nenhuma foto de corpo inteiro na galeria, pulo" % (p["handle"], cor)); continue
            for nome, f0, f1 in RECORTES[cat]:
                rec = recortar(im, caixa, f0, f1); data = jpeg(rec)
                dest = "detalhes-pecas/%s/%s-%s-%s.jpg" % (p["handle"], slug, nome, hashlib.md5(data).hexdigest()[:8])
                url = sb + "/storage/v1/object/public/site/" + dest
                previas.append(("%s · %s · %s" % (p["handle"], cor, nome), rec.copy()))
                if url in ja: print("  já existe:", dest); continue
                novas.append((cor, capa, nome, data, dest, url))
        print("== %s (%s): %d recorte(s) novo(s)" % (p["handle"], cat, len(novas)))
        if not APPLY or not novas: continue
        for cor, capa, nome, data, dest, url in novas:
            up = requests.post("%s/storage/v1/object/site/%s" % (sb, dest), headers=dict(SH, **{"Content-Type": "image/jpeg", "x-upsert": "true", "cache-control": "max-age=31536000"}), data=data, timeout=180)
            if not up.ok: raise RuntimeError("upload %s -> %s" % (dest, up.status_code))
        # insere cada detalhe logo depois da capa da sua cor (o Medusa substitui a lista inteira)
        nova_ordem = []
        for u in ordem:
            nova_ordem.append(u)
            for cor, capa, nome, data, dest, url in novas:
                if capa == u: nova_ordem.append(url)
        por_url = {i["url"]: i["id"] for i in imgs}
        api.post("/admin/products/%s" % p["id"], {"images": [({"id": por_url[u], "url": u} if u in por_url else {"url": u}) for u in nova_ordem]})
        prod = api.get("/admin/products/%s?fields=id,*images,*variants,*variants.options" % p["id"])["product"]
        ids_img = {i["url"]: i["id"] for i in prod["images"]}
        for cor, capa, nome, data, dest, url in novas:
            vids = [v["id"] for v in prod["variants"] if cor is None or any(o.get("value") == cor for o in v.get("options") or [])]
            api.post("/admin/products/%s/images/%s/variants/batch" % (p["id"], ids_img[url]), {"add": vids})
        print("   inseridos %d detalhe(s)" % len(novas))
        # versões leves para o modo "direto" do loader: só valem para site/products/, então aqui sobe a própria foto
        # já em 2000 px (≈200 KB); o card mostra na largura do card.
    # prévia
    if previas:
        tw, th = 300, 450; cols = 6; rows = (len(previas) + cols - 1) // cols
        s = Image.new("RGB", (cols * tw, rows * (th + 26)), "white"); d = ImageDraw.Draw(s); font = ImageFont.truetype("arial.ttf", 16)
        for i, (lab, im) in enumerate(previas):
            im = im.convert("RGB"); im.thumbnail((tw, th)); x, y = (i % cols) * tw, (i // cols) * (th + 26)
            s.paste(im, (x, y + 26)); d.text((x + 4, y + 4), lab[:44], fill="black", font=font)
        s.save(os.path.join(SAIDA, "previa.jpg"), quality=82); print("prévia:", os.path.join(SAIDA, "previa.jpg"))
    print("modo:", "APLICADO" if APPLY else "SIMULAÇÃO (use --apply)")

if __name__ == "__main__":
    main()
