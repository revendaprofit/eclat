# -*- coding: utf-8 -*-
"""
Carrossel "Detalhes que fazem a diferença" (site_content "home.detalhes"), na home e na página do produto.

Fotos de perto enviadas pelo dono em 2026-09-30 (pasta "Detalhes peças" do Drive da ÉCLAT), baixadas em
brand-assets/detalhes-pecas-2026-09-30/ (HEIC original + .jpg). Cada foto é cortada em 4:5, reduzida para 720 px de
largura e guardada no Storage `site/detalhes/<nome>-<hash8>.jpg`. Textos: só o que é fato da peça (DNA do produto).

Uso:
  python scripts/detalhes-pecas.py           # simulação
  python scripts/detalhes-pecas.py --apply   # grava em PRODUÇÃO (só com "pode aplicar")
Credenciais: apps/cockpit/.env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
"""
import io, os, sys, json, hashlib, datetime, requests
from PIL import Image, ImageOps

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASTA = os.path.join(os.path.dirname(RAIZ), "brand-assets", "detalhes-pecas-2026-09-30")
CHAVE = "home.detalhes"

# (arquivo, nome no Storage, título, texto)
ITENS = [
    ("IMG_6654.jpg", "silicone-barra", "Silicone na barra", "Faixa de silicone que segura o short no lugar: não sobe e não enrola no treino."),
    ("IMG_6656.jpg", "cos-alto", "Cós alto", "Modela a cintura e dá segurança para agachar e saltar. Com o monograma Éclat."),
    ("IMG_6658.jpg", "ziper-tratorado", "Zíper tratorado", "No top Aurora: abre ou fecha e muda o look para o momento."),
    ("IMG_6662.jpg", "forro-dry", "Forrado em dry", "Por dentro, tecido dry: geladinho e respirável onde toca o corpo."),
    ("IMG_6663.jpg", "alcas-regulaveis", "Alças reguláveis", "Ajuste fino das alças para o top ficar do jeito certo no seu corpo."),
    ("IMG_6655.jpg", "entreperna", "Entreperna em losango", "Recorte que acompanha o movimento no agachamento."),
    ("IMG_6667.jpg", "canelado", "Canelado premium", "O tecido canelado da coleção Lumière, com a assinatura Éclat."),
]


def env_local():
    env = {}
    for line in io.open(os.path.join(RAIZ, "apps", "cockpit", ".env.local"), encoding="utf-8").read().splitlines():
        if "=" in line and not line.startswith("#"):
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip().strip('"')
    return env


def preparar(caminho):
    im = ImageOps.exif_transpose(Image.open(caminho)).convert("RGB")
    im = ImageOps.fit(im, (720, 900), Image.LANCZOS, centering=(0.5, 0.5))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=76, optimize=True, progressive=True)
    return buf.getvalue()


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    apply = "--apply" in sys.argv
    env = env_local()
    url, chave = env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"]
    H = {"apikey": chave, "Authorization": "Bearer " + chave}

    itens = []
    for arq, nome, titulo, texto in ITENS:
        dados = preparar(os.path.join(PASTA, arq))
        dest = "detalhes/%s-%s.jpg" % (nome, hashlib.sha1(dados).hexdigest()[:8])
        print("%s -> %s (%d KB)" % (arq, dest, len(dados) // 1024))
        if apply:
            r = requests.post("%s/storage/v1/object/site/%s" % (url, dest),
                              headers=dict(H, **{"Content-Type": "image/jpeg", "x-upsert": "true"}), data=dados, timeout=120)
            if not r.ok:
                raise RuntimeError("upload %s -> %s %s" % (dest, r.status_code, r.text[:300]))
        itens.append({"image_url": "%s/storage/v1/object/public/site/%s" % (url, dest), "title": titulo, "text": texto})

    valor = {"heading": "Detalhes que fazem a diferença", "items": itens}
    r = requests.get("%s/rest/v1/site_content?key=eq.%s&select=value" % (url, CHAVE), headers=H, timeout=30)
    r.raise_for_status()
    antes = r.json()[0]["value"] if r.json() else None
    print("ATUAL:", json.dumps(antes, ensure_ascii=False)[:300])
    if not apply:
        print("\nNada gravado. Rode com --apply para gravar em produção.")
        return
    backup = os.path.join(os.path.dirname(RAIZ), "brand-assets", "backup-site-content-detalhes-%s.json" % datetime.date.today())
    with io.open(backup, "w", encoding="utf-8") as f:
        json.dump({"key": CHAVE, "value": antes}, f, ensure_ascii=False, indent=1)
    r = requests.post("%s/rest/v1/site_content?on_conflict=key" % url,
                      headers=dict(H, **{"Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal"}),
                      json={"key": CHAVE, "value": valor, "updated_at": datetime.datetime.utcnow().isoformat() + "Z"}, timeout=30)
    print("GRAVADO" if r.ok else "ERRO %s %s" % (r.status_code, r.text), "| backup:", backup)


if __name__ == "__main__":
    main()
