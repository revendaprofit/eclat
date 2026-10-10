# -*- coding: utf-8 -*-
"""
Capa da Camiseta Raglan Dry (Grafitti) a partir da foto de praia (pedido da sócia, 2026-10-10):
a capa é o RECORTE da camiseta (ombros até abaixo da barra, 2:3, mesma régua de scripts/fotos-detalhe.py)
com o fundo de praia removido e trocado por branco. A foto de praia INTEIRA entra logo depois, do jeito que
está (as demais fotos ficam com o fundo de praia). Nenhuma foto existente é apagada.

Entrada: brand-assets/camiseta-raglan-dry/praia/<cor>-praia-NN.jpg (JPEG já convertido do HEIC, inteiro).
Saída no Storage:
  site/detalhes-pecas/camiseta-raglan-dry/<cor>-capa-<hash>.jpg   (capa recortada, fundo branco; vira thumbnail
                                                                   do produto e 1ª foto da cor — também é a foto
                                                                   do círculo "Masculino" na home)
  site/products/camiseta-raglan-dry/<cor>-praia-NN-<hash>.jpg     (foto inteira; variantes .w480/.w960 pelo
                                                                   scripts/gerar-variantes-fotos.py)
Uso:
  python -B scripts/capa-camiseta-praia.py            # simulação: prévia em brand-assets/camiseta-raglan-dry/praia/previa.jpg
  python -B scripts/capa-camiseta-praia.py --apply    # sobe, reordena as fotos da cor e grava a thumbnail
Requisitos: os mesmos de scripts/fotos-detalhe.py (pillow, numpy, opencv, onnxruntime, requests).
"""
import glob, hashlib, io, json, os, subprocess, sys, time
import numpy as np, cv2, onnxruntime as ort, requests
from PIL import Image, ImageFilter

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJ = os.path.dirname(RAIZ)
BASE = os.environ.get("MEDUSA_URL", "https://endearing-enthusiasm-production-775b.up.railway.app")
APPLY = "--apply" in sys.argv
HANDLE = "camiseta-raglan-dry"
COR = {"grafitti": "Grafitti", "telha": "Telha"}
PASTA = os.path.join(PROJ, "brand-assets", HANDLE, "praia")
MODELO = os.path.expanduser(r"~\.rembg\models\isnet-general-use\isnet-general-use.onnx")
RECORTE = (0.14, 0.58)      # fração da altura da silhueta: ombros → abaixo da barra (fotos-detalhe.py, "camisetas-regatas")
LADO_MAX = 2000
JPEG_Q = 88

_ses = None
def mascara(im):
    """Probabilidade de 'pessoa' por pixel (float 0..1) + caixa/eixo da silhueta, como em fotos-detalhe.py."""
    global _ses
    if _ses is None: _ses = ort.InferenceSession(MODELO, providers=["CPUExecutionProvider"])
    rgb = np.asarray(im.convert("RGB"))
    x = ((cv2.resize(rgb, (1024, 1024), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0) - 0.5).transpose(2, 0, 1)[None]
    y = _ses.run(None, {_ses.get_inputs()[0].name: x})[0][0, 0]
    y = (y - y.min()) / (y.max() - y.min() + 1e-8)
    prob = cv2.resize(y.astype(np.float32), (rgb.shape[1], rgb.shape[0]), interpolation=cv2.INTER_LINEAR)
    m = prob > 0.5
    ys, xs = np.where(m)
    y0, y1 = np.percentile(ys, 0.5), np.percentile(ys, 99.5)
    faixa = (ys > y0 + (y1 - y0) * 0.2) & (ys < y0 + (y1 - y0) * 0.7)
    eixo = np.median(xs[faixa]) if faixa.any() else np.median(xs)
    return prob, (float(np.percentile(xs, 0.5)), float(y0), float(np.percentile(xs, 99.5)), float(y1), float(eixo))

def fundo_branco(im, prob):
    """Pessoa sobre branco. A borda usa a probabilidade como alfa (0.35..0.75 → 0..1), suavizada, para não
    deixar serrilhado nem halo de areia/céu; um leve 'descontaminar' puxa a borda para o branco."""
    alfa = np.clip((prob - 0.35) / 0.40, 0, 1)
    alfa = cv2.GaussianBlur(alfa, (0, 0), 1.2)
    rgb = np.asarray(im.convert("RGB")).astype(np.float32)
    out = rgb * alfa[..., None] + 255.0 * (1 - alfa[..., None])
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))

def caixa_camiseta(im, prob):
    """Caixa (x0,y0,x1,y1) da CAMISETA: dentro da silhueta, o maior bloco de pixels escuros (a malha grafitti;
    boné e óculos são blocos menores, pele e short claros ficam de fora). None se não achar."""
    rgb = np.asarray(im.convert("RGB")); H, W = rgb.shape[:2]
    escuro = ((rgb.max(-1) < 110) & (prob > 0.5)).astype(np.uint8)
    escuro = cv2.morphologyEx(escuro, cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(escuro, connectivity=8)
    if n < 2: return None
    i = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    x, y, w, h, a = stats[i]
    if a < 0.02 * H * W: return None
    return (float(x), float(y), float(x + w), float(y + h))

def recorte_capa(im, caixa_c, prob):
    """Capa 2:3 em volta da camiseta: a largura é a da PESSOA na altura da camiseta (braços incluídos) com 12% de
    folga de cada lado, para o fundo branco aparecer; começa um pouco acima do pescoço (rosto não aparece) e a
    altura sai da largura (2:3), descendo pelo short."""
    W, H = im.size; x0, y0, x1, y1 = caixa_c; ch = y1 - y0
    faixa = prob[int(y0):int(y1)] > 0.5
    xs = np.where(faixa.any(0))[0]
    px0, px1 = (float(xs.min()), float(xs.max())) if len(xs) else (x0, x1)
    w = (px1 - px0) * 1.24; h = w * 1.5
    if h < ch * 1.14: h = ch * 1.14; w = h * 2 / 3
    if w > W: w = W; h = w * 1.5
    cx = (px0 + px1) / 2; cx0 = cx - w / 2; cy0 = y0 - ch * 0.06
    cx0 = min(max(0, cx0), W - w); cy0 = min(max(0, cy0), H - h)
    return im.crop((int(cx0), int(cy0), int(cx0 + w), int(cy0 + h)))

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
    fotos = sorted(glob.glob(os.path.join(PASTA, "*-praia-*.jpg")))
    fotos = [f for f in fotos if "previa" not in f]
    if not fotos: print("nenhuma foto em", PASTA); sys.exit(1)
    e = env(); sb = e["NEXT_PUBLIC_SUPABASE_URL"]; SH = {"apikey": e["SUPABASE_SERVICE_ROLE_KEY"], "Authorization": "Bearer " + e["SUPABASE_SERVICE_ROLE_KEY"]}
    pub = lambda dest: sb + "/storage/v1/object/public/site/" + dest

    por_cor = {}   # slug -> {"capa": (bytes, dest), "inteiras": [(bytes, dest)]}
    previas = []
    for f in fotos:
        nome = os.path.basename(f)[:-4]; slug = nome.split("-praia-")[0]
        if slug not in COR: print("cor desconhecida em", nome); continue
        im = Image.open(f).convert("RGB")
        prob, caixa = mascara(im)
        d = por_cor.setdefault(slug, {"capa": None, "inteiras": []})
        if d["capa"] is None:   # a 1ª foto da cor vira a capa recortada em fundo branco
            cc = caixa_camiseta(im, prob)
            branca = fundo_branco(im, prob)
            capa = recorte_capa(branca, cc, prob) if cc else recortar(branca, caixa, *RECORTE)
            print("  camiseta localizada:", "sim" if cc else "NÃO (recorte pela altura do corpo)")
            data = jpeg(capa)
            d["capa"] = (data, "detalhes-pecas/%s/%s-capa-%s.jpg" % (HANDLE, slug, hashlib.md5(data).hexdigest()[:8]))
            previas.append(("%s · capa (recorte, fundo branco)" % COR[slug], capa))
        data = jpeg(im)
        d["inteiras"].append((data, "products/%s/%s-%s.jpg" % (HANDLE, nome, hashlib.md5(data).hexdigest()[:8])))
        previas.append(("%s · %s (inteira, praia)" % (COR[slug], nome), im))

    # prévia local (vai para o Drive, a sócia vê no outro PC também)
    tw, th = 400, 600
    s = Image.new("RGB", (tw * len(previas), th), "white")
    for i, (lab, im) in enumerate(previas):
        t = im.copy(); t.thumbnail((tw, th)); s.paste(t, (i * tw + (tw - t.size[0]) // 2, (th - t.size[1]) // 2))
    os.makedirs(PASTA, exist_ok=True); s.save(os.path.join(PASTA, "previa.jpg"), quality=85)
    print("prévia:", os.path.join(PASTA, "previa.jpg"))
    for slug, d in por_cor.items():
        print("%s: capa %s + %d inteira(s)" % (COR[slug], d["capa"][1], len(d["inteiras"])))
    if not APPLY: print("modo: SIMULAÇÃO (use --apply)"); return

    api = Medusa(e)
    p = api.get("/admin/products?handle=%s&fields=id,thumbnail,*images,*variants,*variants.options" % HANDLE)["products"][0]
    # backup do estado atual (Drive)
    bk = os.path.join(PROJ, "brand-assets", "backup-camiseta-%s-antes-capa-praia.json" % time.strftime("%Y-%m-%d"))
    with io.open(bk, "w", encoding="utf-8") as f: json.dump({"thumbnail": p.get("thumbnail"), "images": p["images"]}, f, ensure_ascii=False, indent=1)
    print("backup:", bk)

    for slug, d in por_cor.items():
        for data, dest in [d["capa"]] + d["inteiras"]:
            up = requests.post("%s/storage/v1/object/site/%s" % (sb, dest), headers=dict(SH, **{"Content-Type": "image/jpeg", "x-upsert": "true", "cache-control": "max-age=31536000"}), data=data, timeout=180)
            if not up.ok: raise RuntimeError("upload %s -> %s" % (dest, up.status_code))
            print("  subiu", dest)

    # nova ordem: para cada cor, capa nova + inteiras novas ANTES das fotos que a cor já tinha
    ordem = [i["url"] for i in p["images"]]
    por_url = {i["url"]: i["id"] for i in p["images"]}
    nova = []
    for slug in COR:
        novas = [pub(dest) for data, dest in ([por_cor[slug]["capa"]] + por_cor[slug]["inteiras"])] if slug in por_cor else []
        antigas = [u for u in ordem if "/%s/%s-" % (HANDLE, slug) in u]
        nova += [u for u in novas if u not in ordem] + antigas
    nova += [u for u in ordem if u not in nova]
    thumb = pub(por_cor["grafitti"]["capa"][1]) if "grafitti" in por_cor else nova[0]
    api.post("/admin/products/%s" % p["id"], {"images": [({"id": por_url[u], "url": u} if u in por_url else {"url": u}) for u in nova], "thumbnail": thumb})
    prod = api.get("/admin/products/%s?fields=id,*images,*variants,*variants.options" % p["id"])["product"]
    ids_img = {i["url"]: i["id"] for i in prod["images"]}
    for slug, d in por_cor.items():
        vids = [v["id"] for v in prod["variants"] if any(o.get("value") == COR[slug] for o in v.get("options") or [])]
        for data, dest in [d["capa"]] + d["inteiras"]:
            api.post("/admin/products/%s/images/%s/variants/batch" % (p["id"], ids_img[pub(dest)]), {"add": vids})
    print("produto atualizado: %d fotos, thumbnail = %s" % (len(nova), thumb))
    subprocess.run([sys.executable, "-B", os.path.join(RAIZ, "scripts", "gerar-variantes-fotos.py"), "--apply"], check=False)
    print("link: /br/products/%s" % HANDLE)

if __name__ == "__main__":
    main()
