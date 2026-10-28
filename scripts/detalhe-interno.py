# -*- coding: utf-8 -*-
"""
Foto de DETALHE INTERNO (forro, silicone, costura por dentro) no fim das fotos de uma cor (padrão fixo de mídias,
sócia, 28/10/2026). O detalhe interno pode repetir entre os shorts: o material por dentro é o mesmo.
Sobe em site/detalhes-pecas/<handle>/<cor>-<nome>-<hash>.jpg (até 200 KB), liga às variantes da cor e gera as versões
leves. Rodar de novo com a mesma foto não duplica.

Uso:
  python -B scripts/detalhe-interno.py --handle short-aurora --cor Telha --nome silicone --foto <jpg>            # simulação
  python -B scripts/detalhe-interno.py --handle short-aurora --cor Telha --nome silicone --foto <jpg> --apply    # PRODUÇÃO
Caminho da foto relativo à pasta raiz.
"""
import hashlib, io, json, os, sys, time
import requests

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJ = os.path.dirname(RAIZ)
sys.path.insert(0, os.path.join(RAIZ, "scripts"))
import importlib
fd = importlib.import_module("fotos-detalhe")   # env, Medusa

def arg(n):
    if n not in sys.argv: raise SystemExit("falta %s (veja o uso no topo do arquivo)" % n)
    return sys.argv[sys.argv.index(n) + 1]

APPLY = "--apply" in sys.argv

def main():
    if hasattr(sys.stdout, "reconfigure"): sys.stdout.reconfigure(encoding="utf-8")
    handle, cor, nome = arg("--handle"), arg("--cor"), arg("--nome")
    b = open(os.path.join(PROJ, arg("--foto")), "rb").read()
    if len(b) > 200 * 1024: raise SystemExit("foto com %d KB: acima do site leve" % (len(b) // 1024))
    dest = "detalhes-pecas/%s/%s-%s-%s.jpg" % (handle, cor.lower(), nome, hashlib.md5(b).hexdigest()[:8])
    print("subiria site/%s (%d KB) no fim das fotos %s de %s" % (dest, len(b) // 1024, cor, handle))
    if not APPLY: print("modo: SIMULAÇÃO (use --apply)"); return
    e = fd.env(); api = fd.Medusa(e); sb = e["NEXT_PUBLIC_SUPABASE_URL"]
    SH = {"apikey": e["SUPABASE_SERVICE_ROLE_KEY"], "Authorization": "Bearer " + e["SUPABASE_SERVICE_ROLE_KEY"]}
    p = api.get("/admin/products?handle=%s&fields=id,thumbnail,*images" % handle)["products"][0]
    url = sb + "/storage/v1/object/public/site/" + dest
    if any(i["url"] == url for i in p["images"]): print("já está no produto: nada a fazer"); return
    bk = os.path.join(PROJ, "brand-assets", "backup-detalhe-interno-%s-%s.json" % (handle, time.strftime("%Y-%m-%d-%H%M")))
    with io.open(bk, "w", encoding="utf-8") as f: json.dump({"thumbnail": p.get("thumbnail"), "images": p["images"]}, f, ensure_ascii=False, indent=1)
    up = requests.post("%s/storage/v1/object/site/%s" % (sb, dest), headers=dict(SH, **{"Content-Type": "image/jpeg", "x-upsert": "true", "cache-control": "max-age=31536000"}), data=b, timeout=120)
    if not up.ok: raise RuntimeError("upload %s -> %s" % (dest, up.status_code))
    # Entra logo depois da última foto da cor (as fotos de cada cor ficam juntas na lista).
    lista = [{"id": i["id"], "url": i["url"]} for i in p["images"]]
    da_cor = [k for k, i in enumerate(lista) if i["url"].rsplit("/", 1)[1].startswith(cor.lower() + "-")]
    pos = (da_cor[-1] + 1) if da_cor else len(lista)
    lista.insert(pos, {"url": url})
    api.post("/admin/products/%s" % p["id"], {"images": lista})
    prod = api.get("/admin/products/%s?fields=id,*images,*variants,*variants.options" % p["id"])["product"]
    id_img = {i["url"]: i["id"] for i in prod["images"]}[url]
    vids = [v["id"] for v in prod["variants"] if any(o.get("value") == cor for o in v.get("options") or [])]
    api.post("/admin/products/%s/images/%s/variants/batch" % (p["id"], id_img), {"add": vids})
    print("gravado | backup:", os.path.basename(bk))
    import subprocess
    subprocess.run([sys.executable, "-B", os.path.join(RAIZ, "scripts", "gerar-variantes-fotos.py"), "--apply"], check=False, stdout=subprocess.DEVNULL)

if __name__ == "__main__":
    main()
