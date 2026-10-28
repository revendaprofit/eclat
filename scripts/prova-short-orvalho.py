# -*- coding: utf-8 -*-
"""
Página do Short Orvalho com a prova do anúncio da Paty (diagnóstico do funil, sócia, 2026-10-27).

Três mudanças de DADO no produto `short-orvalho` (o código da vitrine já sabe mostrar cada uma):
  1. Vídeo da cor Grafitti = Paty fazendo burpee no box (no lugar da caminhada na praia). A Telha não muda.
  2. Foto do silicone da barra da perna, por dentro, como 2ª foto da cor Grafitti (logo depois da capa).
     O quadro é do vídeo da sócia no calçadão (IMG_8577, macaquinho Solaris grafitti): o silicone é o mesmo.
  3. `metadata.prova` = faixa "Não sobe no treino" + frase da Paty (componente prova-do-produto).

Arquivos (já prontos, na pasta raiz): brand-assets/detalhes-pecas/short-orvalho-prova/
  paty-burpee-pdp.mp4 (576x864, 6 s, sem som, 0,9 MB) · paty-burpee-pdp-poster.jpg · silicone-barra-short.jpg

Uso:
  python -B scripts/prova-short-orvalho.py            # simulação: confere os arquivos e mostra o que gravaria
  python -B scripts/prova-short-orvalho.py --apply    # grava em PRODUÇÃO (só com "pode aplicar" da sócia)
Antes de gravar, salva backup de metadata.videos, metadata.prova e da galeria em brand-assets/.
"""
import hashlib, io, json, os, sys, time
import requests

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RAIZ, "scripts"))
import importlib
fd = importlib.import_module("fotos-detalhe")   # env, Medusa

PROJ = os.path.dirname(RAIZ)
PASTA = os.path.join(PROJ, "brand-assets", "detalhes-pecas", "short-orvalho-prova")
APPLY = "--apply" in sys.argv
HANDLE, COR = "short-orvalho", "Grafitti"

PROVA = {
    "titulo": "Não sobe no treino",
    "texto": "Silicone na barra da perna segura o short no lugar: no agachamento, no afundo e no burpee.",
    "frase": "Bom dia pra quem treinou hoje o dia inteiro sem ter que puxar short que não tava embolado de mim.",
    "autora": "Paty, cliente Éclat",
}

def ler(nome):
    with open(os.path.join(PASTA, nome), "rb") as f: return f.read()

def destino(pasta, base, data, ext):
    return "%s/%s-%s.%s" % (pasta, base, hashlib.md5(data).hexdigest()[:8], ext)

def main():
    if hasattr(sys.stdout, "reconfigure"): sys.stdout.reconfigure(encoding="utf-8")
    video, poster, silicone = ler("paty-burpee-pdp.mp4"), ler("paty-burpee-pdp-poster.jpg"), ler("silicone-barra-short.jpg")
    arquivos = [
        (destino("videos-pdp", "orvalho-grafitti-paty-burpee", video, "mp4"), video, "video/mp4"),
        (destino("videos-pdp", "orvalho-grafitti-paty-burpee", poster, "jpg"), poster, "image/jpeg"),
        (destino("detalhes-pecas/%s" % HANDLE, "grafitti-silicone", silicone, "jpg"), silicone, "image/jpeg"),
    ]
    for dest, data, _ in arquivos: print("subiria site/%s (%d KB)" % (dest, len(data) // 1024))
    print("metadata.prova =", json.dumps(PROVA, ensure_ascii=False))
    if not APPLY: print("modo: SIMULAÇÃO (use --apply)"); return

    e = fd.env(); api = fd.Medusa(e); sb = e["NEXT_PUBLIC_SUPABASE_URL"]
    SH = {"apikey": e["SUPABASE_SERVICE_ROLE_KEY"], "Authorization": "Bearer " + e["SUPABASE_SERVICE_ROLE_KEY"]}
    p = api.get("/admin/products?handle=%s&fields=id,thumbnail,metadata,*images" % HANDLE)["products"][0]
    meta = p.get("metadata") or {}
    bk = os.path.join(PROJ, "brand-assets", "backup-prova-%s-%s.json" % (HANDLE, time.strftime("%Y-%m-%d-%H%M")))
    with io.open(bk, "w", encoding="utf-8") as f:
        json.dump({"videos": meta.get("videos"), "prova": meta.get("prova"), "thumbnail": p.get("thumbnail"), "images": p["images"]}, f, ensure_ascii=False, indent=1)

    urls = []
    for dest, data, tipo in arquivos:
        up = requests.post("%s/storage/v1/object/site/%s" % (sb, dest), headers=dict(SH, **{"Content-Type": tipo, "x-upsert": "true", "cache-control": "max-age=31536000"}), data=data, timeout=180)
        if not up.ok: raise RuntimeError("upload %s -> %s" % (dest, up.status_code))
        urls.append(sb + "/storage/v1/object/public/site/" + dest)
    url_video, url_poster, url_silicone = urls

    videos = meta.get("videos") or {}
    if isinstance(videos, str): videos = json.loads(videos)
    videos[COR] = {"src": url_video, "poster": url_poster}
    # metadata inteira (mesmo cuidado do seed-videos-pdp.py): as outras chaves (faq, funcionalidades...) ficam.
    novo = dict(meta, videos=json.dumps(videos, ensure_ascii=False), prova=json.dumps(PROVA, ensure_ascii=False))
    api.post("/admin/products/%s" % p["id"], {"metadata": novo})

    # Silicone como 2ª foto da cor: logo depois da 1ª foto da Grafitti (a capa). Rodar de novo não duplica.
    slug = COR.lower()
    ordem = [i["url"] for i in p["images"] if "/%s/%s-silicone-" % (HANDLE, slug) not in i["url"]]
    por_url = {i["url"]: i["id"] for i in p["images"]}
    primeira = next(u for u in ordem if "/%s/%s-" % (HANDLE, slug) in u)
    nova = []
    for u in ordem:
        nova.append(u)
        if u == primeira: nova.append(url_silicone)
    api.post("/admin/products/%s" % p["id"], {"images": [({"id": por_url[u], "url": u} if u in por_url else {"url": u}) for u in nova]})
    prod = api.get("/admin/products/%s?fields=id,*images,*variants,*variants.options" % p["id"])["product"]
    id_img = {i["url"]: i["id"] for i in prod["images"]}[url_silicone]
    vids = [v["id"] for v in prod["variants"] if any(o.get("value") == COR for o in v.get("options") or [])]
    api.post("/admin/products/%s/images/%s/variants/batch" % (p["id"], id_img), {"add": vids})
    print("aplicado: vídeo da Grafitti = burpee da Paty; foto do silicone em 2º na Grafitti; prova gravada; backup: %s" % os.path.basename(bk))
    import subprocess
    subprocess.run([sys.executable, "-B", os.path.join(RAIZ, "scripts", "gerar-variantes-fotos.py"), "--apply"], check=False, stdout=subprocess.DEVNULL)

if __name__ == "__main__":
    main()
