# -*- coding: utf-8 -*-
"""
Gera as versões leves das fotos de produto (custo zero: são arquivos comuns no Supabase Storage).

A vitrine, no modo "direto" do loader (apps/storefront/src/lib/util/image-loader.ts), pede
`<foto>.w480.jpg` ou `<foto>.w960.jpg` para toda foto `site/products/<handle>/<nome>-<hash8>.jpg`.
Este script garante que essas duas versões existem ao lado de cada original. A foto inteira é só
redimensionada (nunca recortada). Rode depois de QUALQUER cadastro/troca de foto de produto — foto com
hash no nome e sem variante aparece quebrada nos cards.

Uso:
  python scripts/gerar-variantes-fotos.py            # simulação: lista o que falta
  python scripts/gerar-variantes-fotos.py --apply    # gera e sobe o que falta
  python scripts/gerar-variantes-fotos.py --apply --refazer   # regera tudo (ex.: mudou a qualidade)
Requisitos: pip install requests pillow · Credenciais: apps/cockpit/.env.local
"""
import io, os, re, sys

try:
    import requests
    from PIL import Image
except ImportError:
    print("Rode antes: pip install requests pillow"); sys.exit(1)

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.environ.get("MEDUSA_URL", "https://endearing-enthusiasm-production-775b.up.railway.app")
APPLY = "--apply" in sys.argv
REFAZER = "--refazer" in sys.argv
LARGURAS = [480, 960]        # as mesmas de LARGURAS_VARIANTES no image-loader.ts
JPEG_Q = 80
COM_VARIANTES = re.compile(r"/site/(products/[^/?]+/[^/?]+-[0-9a-f]{8})\.jpg$")   # a mesma regra do loader


def env_cockpit():
    env = {}
    caminho = os.environ.get("ECLAT_ENV_FILE") or os.path.join(RAIZ, "apps", "cockpit", ".env.local")
    with io.open(caminho, encoding="utf-8") as f:
        for line in f:
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"')
    return env


def main():
    if hasattr(sys.stdout, "reconfigure"): sys.stdout.reconfigure(encoding="utf-8")
    env = env_cockpit()
    r = requests.post(BASE + "/auth/user/emailpass", json={"email": env["MEDUSA_ADMIN_EMAIL"], "password": env["MEDUSA_ADMIN_PASSWORD"]}, timeout=30)
    assert r.ok, "login admin falhou"
    H = {"Authorization": "Bearer " + r.json()["token"]}
    sb = env["NEXT_PUBLIC_SUPABASE_URL"]; k = env["SUPABASE_SERVICE_ROLE_KEY"]
    SH = {"apikey": k, "Authorization": "Bearer " + k}

    prods = requests.get(BASE + "/admin/products?limit=200&fields=handle,thumbnail,images.url", headers=H, timeout=60).json()["products"]
    urls = sorted({u for p in prods for u in [p.get("thumbnail")] + [i["url"] for i in p.get("images") or []] if u and COM_VARIANTES.search(u.split("?")[0])})
    print("modo: %s | fotos de produto com hash: %d" % ("APLICAR" if APPLY else "SIMULAÇÃO", len(urls)))

    feitas = faltam = 0; antes = depois = 0
    for u in urls:
        u = u.split("?")[0]; caminho = COM_VARIANTES.search(u).group(1)
        pendentes = [l for l in LARGURAS if REFAZER or requests.head("%s.w%d.jpg" % (u[:-4], l), timeout=30).status_code != 200]
        if not pendentes: continue
        faltam += len(pendentes)
        if not APPLY:
            print("  falta %s para %s" % (pendentes, caminho)); continue
        bruto = requests.get(u, timeout=120); bruto.raise_for_status(); antes += len(bruto.content)
        original = Image.open(io.BytesIO(bruto.content)).convert("RGB")
        for l in pendentes:
            im = original.copy()
            if im.width > l: im.thumbnail((l, l * 10), Image.LANCZOS)      # só reduz a largura; a foto continua inteira
            buf = io.BytesIO(); im.save(buf, "JPEG", quality=JPEG_Q, optimize=True, progressive=True)
            up = requests.post("%s/storage/v1/object/site/%s.w%d.jpg" % (sb, caminho, l), headers=dict(SH, **{"Content-Type": "image/jpeg", "x-upsert": "true", "cache-control": "max-age=31536000"}), data=buf.getvalue(), timeout=180)
            if not up.ok: raise RuntimeError("upload %s.w%d.jpg -> %s %s" % (caminho, l, up.status_code, up.text[:200]))
            feitas += 1; depois += len(buf.getvalue())
        print("  ok %s %s" % (caminho, pendentes))
    if APPLY: print("variantes geradas: %d (originais lidos: %.1f MB -> variantes: %.1f MB)" % (feitas, antes / 1e6, depois / 1e6))
    else: print("variantes faltando: %d%s" % (faltam, " — rode com --apply" if faltam else ""))


if __name__ == "__main__":
    main()
