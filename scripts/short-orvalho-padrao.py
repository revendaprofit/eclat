# -*- coding: utf-8 -*-
"""
Short Orvalho no padrão fixo de mídias (sócia, 28/10/2026; prancha aprovada:
brand-assets/detalhes-pecas/prancha-short-orvalho-padrao.jpg).

Regras: capa = UMA foto de corpo, de frente; as outras = só o short recortado (nunca cortar logo/monograma); ordem
capa → lado → costas → outdoor → detalhe interno; detalhe interno pode repetir entre os shorts (mesmo material por dentro).
A Grafitti continua abrindo com o vídeo da Paty (metadata.videos, não muda aqui).
Recortes prontos (2:3, até 720 px, ~150 KB) em brand-assets/detalhes-pecas/short-orvalho-padrao/.

Uso:
  python -B scripts/short-orvalho-padrao.py           # simulação
  python -B scripts/short-orvalho-padrao.py --apply   # grava em PRODUÇÃO (só com "pode aplicar"); backup antes
"""
import hashlib, io, json, os, sys, time
import requests

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJ = os.path.dirname(RAIZ)
sys.path.insert(0, os.path.join(RAIZ, "scripts"))
import importlib
fd = importlib.import_module("fotos-detalhe")   # env, Medusa

APPLY = "--apply" in sys.argv
HANDLE = "short-orvalho"
BA = os.path.join(PROJ, "brand-assets", "detalhes-pecas")
NOVOS = {   # nome no site → arquivo local
    "grafitti-lado": os.path.join(BA, "short-orvalho-padrao", "grafitti-lado.jpg"),
    "grafitti-costas": os.path.join(BA, "short-orvalho-padrao", "grafitti-costas.jpg"),
    "grafitti-outdoor": os.path.join(BA, "short-orvalho-padrao", "grafitti-outdoor.jpg"),
    "grafitti-cos": os.path.join(BA, "detalhes-internos-2026-10-28", "IMG_7774.jpg"),
    "telha-costas": os.path.join(BA, "short-orvalho-padrao", "telha-costas.jpg"),
    "telha-frente": os.path.join(BA, "short-orvalho-padrao", "telha-frente.jpg"),
    # 28/10: silicone em tecido Telha (quadro do vídeo do macaquinho telha IMG_7780; mesmo silicone dos shorts)
    "telha-silicone": os.path.join(BA, "detalhes-internos-2026-10-28", "silicone-barra-telha.jpg"),
}
# Ordem por cor; "=nome" = foto que já está no produto (pelo início do nome do arquivo).
ORDEM = {
    "Grafitti": ["=grafitti-01-6e3fd7e2", "grafitti-lado", "grafitti-costas", "grafitti-outdoor", "=grafitti-silicone-", "grafitti-cos"],
    "Telha": ["=telha-06-b10df252", "telha-costas", "telha-silicone", "telha-frente"],
}
LIMITE = 200 * 1024

def main():
    if hasattr(sys.stdout, "reconfigure"): sys.stdout.reconfigure(encoding="utf-8")
    dados = {}
    for nome, arq in NOVOS.items():
        b = open(arq, "rb").read()
        if len(b) > LIMITE: raise SystemExit("%s tem %d KB: acima do site leve" % (nome, len(b) // 1024))
        dados[nome] = (b, "detalhes-pecas/%s/%s-%s.jpg" % (HANDLE, nome, hashlib.md5(b).hexdigest()[:8]))
    e = fd.env(); api = fd.Medusa(e); sb = e["NEXT_PUBLIC_SUPABASE_URL"]
    SH = {"apikey": e["SUPABASE_SERVICE_ROLE_KEY"], "Authorization": "Bearer " + e["SUPABASE_SERVICE_ROLE_KEY"]}
    p = api.get("/admin/products?handle=%s&fields=id,thumbnail,*images,*variants,*variants.options" % HANDLE)["products"][0]
    existentes = {i["url"].rsplit("/", 1)[1]: i for i in p["images"]}
    def url_de(item):
        if item.startswith("="):
            achou = [i["url"] for n, i in existentes.items() if n.startswith(item[1:])]
            if len(achou) != 1: raise SystemExit("foto existente %s: %d encontradas" % (item, len(achou)))
            return achou[0]
        return sb + "/storage/v1/object/public/site/" + dados[item][1]
    plano = {cor: [url_de(x) for x in lst] for cor, lst in ORDEM.items()}
    for cor, urls in plano.items(): print(cor + ":", ", ".join(u.rsplit("/", 1)[1] for u in urls))
    if not APPLY: print("modo: SIMULAÇÃO (use --apply)"); return

    bk = os.path.join(PROJ, "brand-assets", "backup-short-orvalho-padrao-%s.json" % time.strftime("%Y-%m-%d-%H%M"))
    with io.open(bk, "w", encoding="utf-8") as f: json.dump({"thumbnail": p.get("thumbnail"), "images": p["images"]}, f, ensure_ascii=False, indent=1)
    for nome, (b, dest) in dados.items():
        up = requests.post("%s/storage/v1/object/site/%s" % (sb, dest), headers=dict(SH, **{"Content-Type": "image/jpeg", "x-upsert": "true", "cache-control": "max-age=31536000"}), data=b, timeout=120)
        if not up.ok: raise RuntimeError("upload %s -> %s" % (dest, up.status_code))
    por_url = {i["url"]: i["id"] for i in p["images"]}
    todas = [u for cor in ("Grafitti", "Telha") for u in plano[cor]]
    corpo = {"images": [({"id": por_url[u], "url": u} if u in por_url else {"url": u}) for u in todas], "thumbnail": plano["Grafitti"][0]}
    api.post("/admin/products/%s" % p["id"], corpo)
    prod = api.get("/admin/products/%s?fields=id,*images,*variants,*variants.options" % p["id"])["product"]
    ids = {i["url"]: i["id"] for i in prod["images"]}
    for cor, urls in plano.items():
        vids = [v["id"] for v in prod["variants"] if any(o.get("value") == cor for o in v.get("options") or [])]
        for u in urls: api.post("/admin/products/%s/images/%s/variants/batch" % (p["id"], ids[u]), {"add": vids})
    print("aplicado | miniatura = capa Grafitti | backup:", os.path.basename(bk))
    import subprocess
    subprocess.run([sys.executable, "-B", os.path.join(RAIZ, "scripts", "gerar-variantes-fotos.py"), "--apply"], check=False, stdout=subprocess.DEVNULL)

if __name__ == "__main__":
    main()
