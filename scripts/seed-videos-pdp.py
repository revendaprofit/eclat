# -*- coding: utf-8 -*-
"""
Vídeos das peças na galeria da PDP (metadata.videos, por cor).

Reaproveita os MP4 do banner interativo (site/hero/giro/ no Supabase Storage, já recodificados,
mudos, com capa). Grava em cada produto da Lumière `metadata.videos` = JSON cor → {src, poster}
que a vitrine lê em lib/util/product-video.ts (parseProductVideos). Os vídeos de "conjunto"
valem para o top e o short da mesma linha.

Uso:
  python scripts/seed-videos-pdp.py           # simulação: mostra o que gravaria
  python scripts/seed-videos-pdp.py --apply   # grava em PRODUÇÃO (só com "pode aplicar" do dono)

Requisitos: pip install requests · Credenciais: apps/cockpit/.env.local (MEDUSA_ADMIN_EMAIL/PASSWORD).
"""
import io, os, sys, json, requests

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.environ.get("MEDUSA_URL", "https://endearing-enthusiasm-production-775b.up.railway.app")
STORAGE = "https://hqphayoyusbzfhyrxjga.supabase.co/storage/v1/object/public/site/hero/giro"

# handle do produto → nome do arquivo (sem a cor). Cores: Telha e Grafitti (grafia do catálogo).
PECAS = {
    "top-aurora": "aurora",
    "short-aurora": "aurora",
    "top-orvalho": "orvalho",
    "short-orvalho": "orvalho",
    "macaquinho-solaris": "solaris",
}
CORES = {"Telha": "telha", "Grafitti": "grafitti"}


def videos_de(arquivo):
    return {
        cor: {"src": "%s/%s-%s.mp4" % (STORAGE, arquivo, slug), "poster": "%s/%s-%s.jpg" % (STORAGE, arquivo, slug)}
        for cor, slug in CORES.items()
    }


def env_local():
    env = {}
    for line in io.open(os.path.join(RAIZ, "apps", "cockpit", ".env.local"), encoding="utf-8").read().splitlines():
        if "=" in line and not line.startswith("#"):
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip().strip('"')
    return env


def main():
    apply = "--apply" in sys.argv
    env = env_local()
    r = requests.post(BASE + "/auth/user/emailpass",
                      json={"email": env["MEDUSA_ADMIN_EMAIL"], "password": env["MEDUSA_ADMIN_PASSWORD"]}, timeout=30)
    assert r.ok and r.json().get("token"), "login admin falhou (%s)" % r.status_code
    H = {"Authorization": "Bearer " + r.json()["token"]}

    # confere que os 12 arquivos existem antes de apontar metadata para eles
    for arquivo in sorted(set(PECAS.values())):
        for slug in CORES.values():
            for ext in ("mp4", "jpg"):
                url = "%s/%s-%s.%s" % (STORAGE, arquivo, slug, ext)
                h = requests.head(url, timeout=30)
                assert h.ok, "arquivo ausente no Storage: %s (HTTP %s)" % (url, h.status_code)
    print("Storage OK: 6 vídeos + 6 capas em site/hero/giro/")

    for handle, arquivo in PECAS.items():
        r = requests.get(BASE + "/admin/products?handle=" + handle + "&fields=id,title,metadata", headers=H, timeout=30)
        prods = r.json().get("products", [])
        if not prods:
            print("NAO ACHOU:", handle)
            continue
        p = prods[0]
        novo = dict(p.get("metadata") or {})
        # o Cockpit salva metadata como string; a vitrine aceita string JSON ou objeto
        novo["videos"] = json.dumps(videos_de(arquivo), ensure_ascii=False)
        if apply:
            r = requests.post(BASE + "/admin/products/" + p["id"], headers=H, json={"metadata": novo}, timeout=60)
            print("GRAVADO" if r.ok else "ERRO %s" % r.status_code, handle, "->", list(videos_de(arquivo).keys()))
        else:
            print("[simulação]", handle, "(%s)" % p["title"], "-> metadata.videos =", json.dumps(videos_de(arquivo), ensure_ascii=False)[:120], "...")
    if not apply:
        print("\nNada gravado. Rode com --apply para gravar em produção.")


if __name__ == "__main__":
    main()
