# -*- coding: utf-8 -*-
"""
2º vídeo de uma cor, no FIM da galeria da página do produto (metadata.videos[cor].fim; sócia, 28/10/2026).
O vídeo principal da cor (o que abre a galeria) não muda. Regra do site leve: vídeo até 1,3 MB e capa até 200 KB.

Uso:
  python -B scripts/video-fim.py --handle short-orvalho --cor Grafitti --video <mp4> --capa <jpg>            # simulação
  python -B scripts/video-fim.py --handle short-orvalho --cor Grafitti --video <mp4> --capa <jpg> --apply    # PRODUÇÃO
Caminhos de arquivo relativos à pasta raiz (ex.: brand-assets/detalhes-pecas/detalhes-internos-2026-10-28/IMG_7775.mp4).
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
LIMITE_VIDEO, LIMITE_CAPA = int(1.3 * 1024 * 1024), 200 * 1024

def main():
    if hasattr(sys.stdout, "reconfigure"): sys.stdout.reconfigure(encoding="utf-8")
    handle, cor = arg("--handle"), arg("--cor")
    video = open(os.path.join(PROJ, arg("--video")), "rb").read()
    capa = open(os.path.join(PROJ, arg("--capa")), "rb").read()
    if len(video) > LIMITE_VIDEO: raise SystemExit("vídeo com %.2f MB: acima do site leve" % (len(video) / 1048576))
    if len(capa) > LIMITE_CAPA: raise SystemExit("capa com %d KB: acima do site leve" % (len(capa) // 1024))
    base = "videos-pdp/%s-%s-fim" % (handle, cor.lower())
    dv = "%s-%s.mp4" % (base, hashlib.md5(video).hexdigest()[:8]); dc = "%s-%s.jpg" % (base, hashlib.md5(capa).hexdigest()[:8])
    print("subiria site/%s (%.2f MB) e site/%s (%d KB)" % (dv, len(video) / 1048576, dc, len(capa) // 1024))
    e = fd.env(); api = fd.Medusa(e); sb = e["NEXT_PUBLIC_SUPABASE_URL"]
    SH = {"apikey": e["SUPABASE_SERVICE_ROLE_KEY"], "Authorization": "Bearer " + e["SUPABASE_SERVICE_ROLE_KEY"]}
    p = api.get("/admin/products?handle=%s&fields=id,metadata" % handle)["products"][0]
    meta = p.get("metadata") or {}
    videos = meta.get("videos") or {}
    if isinstance(videos, str): videos = json.loads(videos)
    if cor not in videos: raise SystemExit("a cor %s não tem vídeo principal; o do fim precisa de um principal" % cor)
    if not APPLY: print("modo: SIMULAÇÃO (use --apply)"); return
    bk = os.path.join(PROJ, "brand-assets", "backup-video-fim-%s-%s.json" % (handle, time.strftime("%Y-%m-%d-%H%M")))
    with io.open(bk, "w", encoding="utf-8") as f: json.dump({"videos": meta.get("videos")}, f, ensure_ascii=False, indent=1)
    for dest, data, tipo in ((dv, video, "video/mp4"), (dc, capa, "image/jpeg")):
        up = requests.post("%s/storage/v1/object/site/%s" % (sb, dest), headers=dict(SH, **{"Content-Type": tipo, "x-upsert": "true", "cache-control": "max-age=31536000"}), data=data, timeout=180)
        if not up.ok: raise RuntimeError("upload %s -> %s" % (dest, up.status_code))
    pub = sb + "/storage/v1/object/public/site/"
    principal = videos[cor] if isinstance(videos[cor], dict) else {"src": videos[cor], "poster": None}
    videos[cor] = dict(principal, fim={"src": pub + dv, "poster": pub + dc})
    api.post("/admin/products/%s" % p["id"], {"metadata": dict(meta, videos=json.dumps(videos, ensure_ascii=False))})
    print("gravado: %s %s ganhou o vídeo do fim | backup: %s" % (handle, cor, os.path.basename(bk)))

if __name__ == "__main__":
    main()
