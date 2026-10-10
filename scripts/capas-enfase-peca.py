# -*- coding: utf-8 -*-
"""
Capa com ÊNFASE NA PEÇA para tops e shorts (pedido da sócia, 2026-10-10): o card do Short Aurora Grafitti
mostrava a modelo inteira com o Top Orvalho — a capa passa a ser o recorte que destaca a peça vendida, e a
outra peça pode ficar levemente cortada. A foto inteira NÃO sai: vira a 2ª foto da cor (a do hover no card).

A PEÇA é localizada pela PELE (o que separa as peças): na coluna central do corpo (silhueta ISNet), cada linha
é "pele" ou "tecido"; de cima para baixo vêm rosto (pele) → top (tecido) → barriga (pele) → short (tecido) →
pernas (pele). O recorte 2:3 envolve a peça com folga e deixa a outra aparecer cortada: top → do pescoço até
~1/4 do short; short → da barra do top até as coxas. Capa que já é recorte (sem a cabeça inteira) fica como está.

Sobe para `site/detalhes-pecas/<handle>/<cor>-capa-<hash>.jpg` e insere ANTES da capa antiga da cor; se a capa
antiga era a thumbnail do produto, a nova vira thumbnail. Idempotente (uma `<cor>-capa-` por cor).
scripts/import-lumiere.py preserva fotos fora de `site/products/`, mas as manda para o FIM da galeria: quem rodar
o importador depois precisa trazer a `-capa-` de volta para a frente (ou rodar este script de novo).

Uso:
  python -B scripts/capas-enfase-peca.py                    # simulação: prévia em brand-assets/detalhes-pecas/previa-capas.jpg
  python -B scripts/capas-enfase-peca.py --apply            # sobe e reordena
  python -B scripts/capas-enfase-peca.py --apply --handle short-aurora --cor Grafitti
Requisitos: os de scripts/fotos-detalhe.py (pillow, numpy, opencv, onnxruntime, requests).
"""
import hashlib, io, json, os, sys, time
import requests
from PIL import Image, ImageDraw, ImageFont

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RAIZ, "scripts"))
import importlib
fd = importlib.import_module("fotos-detalhe")   # silhueta, recortar, jpeg, env, Medusa, BASE

PROJ = os.path.dirname(RAIZ)
APPLY = "--apply" in sys.argv
SO = sys.argv[sys.argv.index("--handle") + 1] if "--handle" in sys.argv else None
SO_COR = sys.argv[sys.argv.index("--cor") + 1] if "--cor" in sys.argv else None
SAIDA = os.path.join(PROJ, "brand-assets", "detalhes-pecas")
CAPAS = ("tops", "shorts")

import cv2, numpy as np

def mascara(im):
    """Probabilidade de pessoa (float) + caixa/eixo, como fd.silhueta mas devolvendo também o mapa."""
    import onnxruntime as ort
    if fd._ses is None: fd._ses = ort.InferenceSession(fd.MODELO, providers=["CPUExecutionProvider"])
    rgb = np.asarray(im.convert("RGB"))
    x = ((cv2.resize(rgb, (1024, 1024), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0) - 0.5).transpose(2, 0, 1)[None]
    y = fd._ses.run(None, {fd._ses.get_inputs()[0].name: x})[0][0, 0]
    y = (y - y.min()) / (y.max() - y.min() + 1e-8)
    prob = cv2.resize(y.astype(np.float32), (rgb.shape[1], rgb.shape[0]), interpolation=cv2.INTER_LINEAR)
    m = (prob > 0.5) & (rgb.mean(-1) > 38)
    ys, xs = np.where(m)
    if len(ys) < 500: return prob, None
    y0, y1 = np.percentile(ys, 0.5), np.percentile(ys, 99.5)
    faixa = (ys > y0 + (y1 - y0) * 0.2) & (ys < y0 + (y1 - y0) * 0.7)
    eixo = np.median(xs[faixa]) if faixa.any() else np.median(xs)
    return prob, (float(np.percentile(xs, 0.5)), float(y0), float(np.percentile(xs, 99.5)), float(y1), float(eixo))

def perfil(im, prob, caixa):
    """Linhas do corpo classificadas pela coluna central: lista de (rotulo, y_ini, y_fim) com rotulo 'pele'/'tecido'."""
    rgb = np.asarray(im.convert("RGB")); H, W = rgb.shape[:2]
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32); L, a, b = lab[..., 0] * 100 / 255, lab[..., 1] - 128, lab[..., 2] - 128
    pessoa = (prob > 0.5) & (rgb.mean(-1) > 38)
    pele = pessoa & (b >= 16) & (a >= 4) & (a <= 0.62 * b + 2) & (L >= 35)
    x0, y0, x1, y1, eixo = caixa; meia = max(20, 0.10 * (x1 - x0))
    c0, c1 = int(max(0, eixo - meia)), int(min(W, eixo + meia)); larg = c1 - c0
    pp = pessoa[:, c0:c1].sum(1); sk = pele[:, c0:c1].sum(1)
    rot = np.zeros(H, np.int8)                      # 0 nada, 1 pele, 2 tecido
    tem = pp >= 0.5 * larg
    rot[tem & (sk >= 0.55 * np.maximum(pp, 1))] = 1
    rot[tem & (sk <= 0.30 * np.maximum(pp, 1))] = 2
    k = max(5, int(0.012 * (y1 - y0))) | 1
    rot = cv2.medianBlur(rot.astype(np.uint8), k).ravel()
    runs = []; i = 0
    while i < H:
        j = i
        while j < H and rot[j] == rot[i]: j += 1
        if rot[i]: runs.append(("pele" if rot[i] == 1 else "tecido", i, j))
        i = j
    return runs

def pecas(im, prob, caixa):
    """(top, short) como (y_ini, y_fim) ou None, a partir do perfil."""
    x0, y0, x1, y1, eixo = caixa; alt = y1 - y0
    runs = [r for r in perfil(im, prob, caixa) if r[2] - r[1] >= 0.04 * alt]
    i = next((k for k, r in enumerate(runs) if r[0] == "pele"), None)          # rosto/pescoço
    if i is None: return None, None
    tec = [r for r in runs[i + 1:] if r[0] == "tecido" and r[2] - r[1] >= 0.06 * alt]
    top = (tec[0][1], tec[0][2]) if tec else None
    short = (tec[-1][1], tec[-1][2]) if len(tec) >= 2 else None
    if top and short is None and top[0] > y0 + 0.40 * alt: top, short = None, top   # só o short apareceu
    return top, short

def recorte_peca(im, top, short, eixo, tipo):
    W, H = im.size
    if tipo == "top":
        th = top[1] - top[0]
        cy0 = top[0] - 0.26 * th      # folga para alças finas (halter do Orvalho): a coluna central só vê o top no busto
        cy1 = (short[0] + 0.25 * (short[1] - short[0])) if short else top[1] + 0.35 * th
    else:
        sh = short[1] - short[0]
        cy0 = (top[1] - 0.22 * (top[1] - top[0])) if top else short[0] - 0.20 * sh
        cy1 = short[1] + 0.45 * sh
    h = cy1 - cy0; w = h * 2 / 3
    if w > W: w = W; h = w * 1.5
    cx0 = min(max(0, eixo - w / 2), W - w); cy0 = min(max(0, cy0), H - h)
    return im.crop((int(cx0), int(cy0), int(cx0 + w), int(cy0 + h)))

def main():
    if hasattr(sys.stdout, "reconfigure"): sys.stdout.reconfigure(encoding="utf-8")
    e = fd.env(); api = fd.Medusa(e); sb = e["NEXT_PUBLIC_SUPABASE_URL"]
    SH = {"apikey": e["SUPABASE_SERVICE_ROLE_KEY"], "Authorization": "Bearer " + e["SUPABASE_SERVICE_ROLE_KEY"]}
    pub = lambda dest: sb + "/storage/v1/object/public/site/" + dest
    os.makedirs(SAIDA, exist_ok=True)
    prods = api.get("/admin/products?limit=50&fields=id,handle,status,thumbnail,*images,*variants,*variants.options,*categories,*options,*options.values")["products"]
    previas = []; backup = {}
    for p in prods:
        if p["status"] != "published" or (SO and p["handle"] != SO): continue
        cat = next((c["handle"] for c in p.get("categories") or [] if c["handle"] in CAPAS), None)
        if not cat: continue
        opt_cor = next((o for o in p.get("options") or [] if (o.get("title") or "").lower() == "cor"), None)
        cores = [v["value"] for v in (opt_cor or {}).get("values") or []] or [None]
        ordem = [i["url"] for i in p["images"]]; por_url = {i["url"]: i["id"] for i in p["images"]}
        novas = []   # (cor, url_capa_antiga, bytes, dest)
        for cor in cores:
            if SO_COR and cor != SO_COR: continue
            slug = (cor or "unica").lower().replace(" ", "-")
            if any("/detalhes-pecas/%s/%s-capa-" % (p["handle"], slug) in u for u in ordem):
                print("  %s/%s: já tem capa com ênfase" % (p["handle"], cor)); continue
            capa = next((u for u in ordem if "/products/%s/%s-" % (p["handle"], slug) in u), None)
            if not capa: print("  %s/%s: sem foto da cor" % (p["handle"], cor)); continue
            im = Image.open(io.BytesIO(requests.get(capa, timeout=120).content)); prob, c = mascara(im)
            if not c or (c[3] - c[1]) < 0.72 * im.size[1] or c[1] < 0.03 * im.size[1]:
                print("  %s/%s: capa atual já é recorte (sem a cabeça inteira), fica" % (p["handle"], cor)); continue
            top, short = pecas(im, prob, c); tipo = "top" if cat == "tops" else "short"
            if (tipo == "top" and not top) or (tipo == "short" and not short):
                print("  %s/%s: não achei a peça pelo perfil de pele (top=%s short=%s), pulo" % (p["handle"], cor, top, short)); continue
            rec = recorte_peca(im, top, short, c[4], tipo); data = fd.jpeg(rec)
            dest = "detalhes-pecas/%s/%s-capa-%s.jpg" % (p["handle"], slug, hashlib.md5(data).hexdigest()[:8])
            previas.append(("%s · %s" % (p["handle"], cor), rec.copy()))
            if "--debug" in sys.argv:
                over = np.asarray(im.convert("RGB")).copy(); W_, H_ = im.size
                for rot, y_a, y_b in perfil(im, prob, c):
                    cor_ = (255, 220, 0) if rot == "pele" else (0, 200, 255)
                    cv2.rectangle(over, (int(c[4]) - 12, y_a), (int(c[4]) + 12, y_b), cor_, -1)
                for faixa, col in ((top, (0, 255, 0)), (short, (255, 0, 0))):
                    if faixa: cv2.rectangle(over, (int(c[0]), faixa[0]), (int(c[2]), faixa[1]), col, 6)
                previas.append(("perfil %s/%s" % (p["handle"], cor), Image.fromarray(over)))
            novas.append((cor, capa, data, dest))
        print("== %s (%s): %d capa(s) nova(s)" % (p["handle"], cat, len(novas)))
        if not APPLY or not novas: continue
        backup[p["handle"]] = {"thumbnail": p.get("thumbnail"), "images": p["images"]}
        for cor, capa, data, dest in novas:
            up = requests.post("%s/storage/v1/object/site/%s" % (sb, dest), headers=dict(SH, **{"Content-Type": "image/jpeg", "x-upsert": "true", "cache-control": "max-age=31536000"}), data=data, timeout=180)
            if not up.ok: raise RuntimeError("upload %s -> %s" % (dest, up.status_code))
        nova_ordem = []; thumb = p.get("thumbnail")
        for u in ordem:
            for cor, capa, data, dest in novas:
                if capa == u:
                    nova_ordem.append(pub(dest))
                    if thumb and (thumb == u or thumb.split("?")[0] == u): thumb = pub(dest)
            nova_ordem.append(u)
        body = {"images": [({"id": por_url[u], "url": u} if u in por_url else {"url": u}) for u in nova_ordem]}
        if thumb: body["thumbnail"] = thumb
        api.post("/admin/products/%s" % p["id"], body)
        prod = api.get("/admin/products/%s?fields=id,*images,*variants,*variants.options" % p["id"])["product"]
        ids_img = {i["url"]: i["id"] for i in prod["images"]}
        for cor, capa, data, dest in novas:
            vids = [v["id"] for v in prod["variants"] if cor is None or any(o.get("value") == cor for o in v.get("options") or [])]
            api.post("/admin/products/%s/images/%s/variants/batch" % (p["id"], ids_img[pub(dest)]), {"add": vids})
        print("   aplicadas %d capa(s); thumbnail: %s" % (len(novas), thumb))
    if backup:
        bk = os.path.join(PROJ, "brand-assets", "backup-capas-enfase-%s.json" % time.strftime("%Y-%m-%d-%H%M"))
        with io.open(bk, "w", encoding="utf-8") as f: json.dump(backup, f, ensure_ascii=False, indent=1)
        print("backup:", bk)
    if previas:
        tw, th = 300, 450; cols = 4; rows = (len(previas) + cols - 1) // cols
        s = Image.new("RGB", (cols * tw, rows * (th + 26)), "white"); d = ImageDraw.Draw(s); font = ImageFont.truetype("arial.ttf", 16)
        for i, (lab, im) in enumerate(previas):
            im = im.convert("RGB"); im.thumbnail((tw, th)); x, y = (i % cols) * tw, (i // cols) * (th + 26)
            s.paste(im, (x, y + 26)); d.text((x + 4, y + 4), lab[:40], fill="black", font=font)
        s.save(os.path.join(SAIDA, "previa-capas.jpg"), quality=82); print("prévia:", os.path.join(SAIDA, "previa-capas.jpg"))
    print("modo:", "APLICADO" if APPLY else "SIMULAÇÃO (use --apply)")

if __name__ == "__main__":
    main()
