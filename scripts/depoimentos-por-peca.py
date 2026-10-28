# -*- coding: utf-8 -*-
"""
Depoimentos por peça (sócia, 2026-10-27: "reforçar nossos feedbacks" na página de cada peça).

SÓ falas reais, de clientes que autorizaram (contexto-claude/diario/pessoas.md), conferidas no print, no áudio
(transcrito) ou no post de origem. Nada inventado: o campo `origem` diz de onde veio cada fala.
- Marca os prints que já estão no site nas peças que a cliente comprou (pedidos #21, #28, #29, #30) ou citou.
- Acrescenta no FIM da lista (a home continua igual):
  * print da Samara (áudio de 1:03 no WhatsApp + transcrição): short e top Orvalho, que ela comprou no #30;
  * recorte do print da Luana "O top orvalho que perfeição" (versão com a frase sensível coberta, 24/10);
  * falas em texto: Samara no Instagram, Alana e Poli (macaquinho), Alayse (camiseta).
Fora de propósito: Thais (conjunto não identificado), Bruno (áudio sem fala clara), áudio da Fabi (corta numa crítica).

Imagens novas: brand-assets/depoimentos-site/samara-short-nao-sobe.jpg e luana-top-orvalho.jpg.

Uso:
  python -B scripts/depoimentos-por-peca.py           # simulação
  python -B scripts/depoimentos-por-peca.py --apply   # grava em PRODUÇÃO (só com "pode aplicar"); backup antes
"""
import copy, datetime, hashlib, io, json, os, sys
import requests
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJ = os.path.dirname(RAIZ)
PASTA = os.path.join(PROJ, "brand-assets", "depoimentos-site")
CHAVE = "home.testimonials"
APPLY = "--apply" in sys.argv

# Prints que já estão no site: arquivo → (autora nova ou None, peças)
MARCAR = {
    "audio-short-": ("Paty", ["short-orvalho"]),
    "andrea-bojo-": (None, ["top-orvalho"]),
    "andrea-qualidade-": (None, ["top-orvalho", "short-aurora"]),
    "luana-aurora-macaquinho-": (None, ["macaquinho-solaris", "top-aurora", "short-aurora"]),
    "heverton-camiseta-": (None, ["camiseta-raglan-dry"]),
}

NOVOS_PRINTS = [
    ("samara-short-nao-sobe.jpg", {
        "quote": "É o meu primeiro conjunto que eu compro de short, porque eu só uso calça comprida, não me sinto confortável de short justamente por essa questão de subir. Pelo que eu já vesti aqui, andei dentro de casa, não sobe nada, perfeito.",
        "author": "Samara", "origem": "WhatsApp (áudio)", "produtos": ["short-orvalho", "top-orvalho"]}),
    ("luana-top-orvalho.jpg", {
        "quote": "O top orvalho que perfeição. Gostaria muito de ficar com ele.",
        "author": "Luana", "origem": "WhatsApp", "produtos": ["top-orvalho"]}),
]

NOVOS_TEXTOS = [
    {"quote": "APROVADO! Extremamente confortável, esse e os próximos.", "author": "Samara", "origem": "Instagram", "produtos": ["short-orvalho", "top-orvalho"]},
    {"quote": "Esse macaquinho é um arraso!! Super firme!!", "author": "Alana", "origem": "Instagram", "produtos": ["macaquinho-solaris"]},
    {"quote": "Super aprovado! Não sobe, não enrola, macaquinho que garante sucesso no seu treino.", "author": "Poli", "origem": "Instagram", "produtos": ["macaquinho-solaris"]},
    {"quote": "Que pacote lindo, cheiro maravilhoso, que sensação boa, o tecido da camiseta é perfeito.", "author": "Alayse", "origem": "WhatsApp", "produtos": ["camiseta-raglan-dry"]},
]

def env_local():
    e = {}
    for l in io.open(os.path.join(RAIZ, "apps", "cockpit", ".env.local"), encoding="utf-8").read().splitlines():
        if "=" in l and not l.startswith("#"):
            k, _, v = l.partition("="); e[k.strip()] = v.strip().strip('"')
    return e

def main():
    if hasattr(sys.stdout, "reconfigure"): sys.stdout.reconfigure(encoding="utf-8")
    e = env_local(); url, chave = e["NEXT_PUBLIC_SUPABASE_URL"], e["SUPABASE_SERVICE_ROLE_KEY"]
    H = {"apikey": chave, "Authorization": "Bearer " + chave}
    r = requests.get("%s/rest/v1/site_content?key=eq.%s&select=value" % (url, CHAVE), headers=H, timeout=30); r.raise_for_status()
    antes = r.json()[0]["value"]
    novo = copy.deepcopy(antes); itens = novo["items"]

    for t in itens:
        for chave_arq, (autora, pecas) in MARCAR.items():
            if chave_arq in (t.get("image_url") or ""):
                if autora: t["author"] = autora
                t["produtos"] = sorted(set(t.get("produtos") or []) | set(pecas))
    ja = {(t.get("author"), t.get("quote")) for t in itens}

    uploads = []
    for arq, item in NOVOS_PRINTS:
        data = open(os.path.join(PASTA, arq), "rb").read()
        w, h = Image.open(io.BytesIO(data)).size
        dest = "depoimentos/%s-%s.jpg" % (arq[:-4], hashlib.md5(data).hexdigest()[:8])
        uploads.append((dest, data))
        if (item["author"], item["quote"]) not in ja:
            itens.append(dict(item, tipo="print", image_url="%s/storage/v1/object/public/site/%s" % (url, dest), image_width=w, image_height=h))
    for item in NOVOS_TEXTOS:
        if (item["author"], item["quote"]) not in ja: itens.append(dict(item, tipo="print"))

    por_peca = {}
    for t in itens:
        for p in t.get("produtos") or []: por_peca.setdefault(p, []).append(t["author"])
    for p, quem in sorted(por_peca.items()): print("%-22s %s" % (p, ", ".join(quem)))
    print("itens: %d → %d" % (len(antes["items"]), len(itens)))
    if not APPLY: print("modo: SIMULAÇÃO (use --apply)"); return

    backup = os.path.join(PROJ, "brand-assets", "backup-site-content-testimonials-%s-antes-por-peca.json" % datetime.date.today())
    with io.open(backup, "w", encoding="utf-8") as f: json.dump({"key": CHAVE, "value": antes}, f, ensure_ascii=False, indent=1)
    for dest, data in uploads:
        up = requests.post("%s/storage/v1/object/site/%s" % (url, dest), headers=dict(H, **{"Content-Type": "image/jpeg", "x-upsert": "true", "cache-control": "max-age=31536000"}), data=data, timeout=120)
        if not up.ok: raise RuntimeError("upload %s -> %s" % (dest, up.status_code))
    r = requests.post("%s/rest/v1/site_content?on_conflict=key" % url, headers=dict(H, **{"Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal"}),
                      json={"key": CHAVE, "value": novo, "updated_at": datetime.datetime.utcnow().isoformat() + "Z"}, timeout=30)
    print("GRAVADO" if r.ok else "ERRO %s %s" % (r.status_code, r.text), "| backup:", os.path.basename(backup))

if __name__ == "__main__":
    main()
