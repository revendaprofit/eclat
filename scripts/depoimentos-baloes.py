# -*- coding: utf-8 -*-
"""
Balões de mensagem para a faixa "Quem já veste" das peças (sócia, 2026-10-27: "reforçar nossos feedbacks").

Cada balão é uma fala REAL, tirada de áudio, vídeo, story ou mensagem (fontes em contexto-claude/diario/), com a
pessoa real e sem sobrenome. Quem é embaixadora ou parceira (ganhou a peça) aparece marcada no campo `origem`.
Não há fala inventada nem nome trocado: depoimento falso é propaganda enganosa (CDC art. 37) e fere a regra da marca.

O balão é só o desenho da fala (fundo e balão no tom do WhatsApp), sem hora nem ícones inventados.
Saída: brand-assets/depoimentos-site/baloes/<id>.jpg, subidas em site/depoimentos/ e acrescentadas no FIM de
site_content "home.testimonials" (a home continua igual). Rodar de novo não duplica. Também marca o print da Thais
no conjunto Aurora telha (top e short Aurora), confirmado pela sócia em 27/10.

Uso:
  python -B scripts/depoimentos-baloes.py           # gera os balões e mostra o que gravaria
  python -B scripts/depoimentos-baloes.py --apply   # grava em PRODUÇÃO (só com "pode aplicar"); backup antes
"""
import copy, datetime, hashlib, io, json, os, sys, textwrap
import requests
from PIL import Image, ImageDraw, ImageFont

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJ = os.path.dirname(RAIZ)
SAIDA = os.path.join(PROJ, "brand-assets", "depoimentos-site", "baloes")
CHAVE = "home.testimonials"
APPLY = "--apply" in sys.argv
EMB = "embaixadora Éclat"

# id, autora, origem, peças, fala (literal; "…" marca trecho cortado)
BALOES = [
    ("bruno-camisetas", "Bruno", "WhatsApp (áudio)", ["camiseta-raglan-dry"],
     "Peguei as camisas aqui no box. Muito bonitas, viu? Gostei muito do tecido, dos detalhes. Eu ia ficar só com aquela clara, mas vou ficar com a outra também."),
    ("gabriel-camiseta", "Gabriel", "WhatsApp (áudio)", ["camiseta-raglan-dry"],
     "Treinei num dia abafado, transpirei… fiquei super confortável. Marca de suor não ficou."),
    ("samara-pedido", "Samara", "WhatsApp (áudio)", ["short-orvalho"],
     "Camila, meu pedido chegou. Apaixonada, que lindeza. Nossa, que carinho… Tudo perfeito, viu?"),
    ("andrea-conjunto", "Andrea", "Instagram", ["top-orvalho", "short-aurora"],
     "Detalhe das costas, confortável, modelável, lindo."),
    ("andrea-macaquinho", "Andrea", "Instagram", ["macaquinho-solaris"],
     "Zero filtro, aprovado."),
    ("fabi-macaquinho", "Fabi", "Instagram · " + EMB, ["macaquinho-solaris"],
     "Achei ele muito lindo. Esse decote das costas ficou muito bonito mesmo. Para quem tem muito seio, vai ser muito bom, porque segura mesmo essa parte da frente."),
    ("fabi-tecido", "Fabi", "Instagram · " + EMB, ["macaquinho-solaris"],
     "Vocês não têm noção da qualidade desse tecido."),
    ("alana-detalhe", "Alana", "Instagram · " + EMB, ["macaquinho-solaris"],
     "Isso sim é pré-treino! Amei cada detalhe."),
    ("du-retorno", "Du", "Instagram · " + EMB, ["top-aurora", "short-aurora"],
     "Que seja o primeiro de muitos nesse retorno."),
]
THAIS = ("thais-conjunto-", ["top-aurora", "short-aurora"])

FUNDO, BALAO, TEXTO = (239, 234, 226), (255, 255, 255), (32, 33, 36)

def fonte(tam):
    for f in ("C:/Windows/Fonts/segoeui.ttf", "/System/Library/Fonts/SFNS.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        if os.path.exists(f): return ImageFont.truetype(f, tam)
    return ImageFont.load_default()

def balao(fala):
    fn = fonte(42); linhas = textwrap.wrap("“%s”" % fala, 34); lh = 58
    larg = max(fn.getlength(l) for l in linhas)
    bw, bh = int(larg) + 72, len(linhas) * lh + 60
    W, H = 900, bh + 60
    im = Image.new("RGB", (W, H), FUNDO); d = ImageDraw.Draw(im)
    d.rounded_rectangle((30, 30, 30 + bw, 30 + bh), 32, fill=BALAO)
    d.polygon([(30, 30), (30 + 34, 30), (12, 22)], fill=BALAO)  # bico do balão
    y = 30 + 28
    for l in linhas: d.text((30 + 36, y), l, font=fn, fill=TEXTO); y += lh
    return im

def env_local():
    e = {}
    for l in io.open(os.path.join(RAIZ, "apps", "cockpit", ".env.local"), encoding="utf-8").read().splitlines():
        if "=" in l and not l.startswith("#"):
            k, _, v = l.partition("="); e[k.strip()] = v.strip().strip('"')
    return e

def main():
    if hasattr(sys.stdout, "reconfigure"): sys.stdout.reconfigure(encoding="utf-8")
    os.makedirs(SAIDA, exist_ok=True)
    e = env_local(); url, chave = e["NEXT_PUBLIC_SUPABASE_URL"], e["SUPABASE_SERVICE_ROLE_KEY"]
    H = {"apikey": chave, "Authorization": "Bearer " + chave}
    r = requests.get("%s/rest/v1/site_content?key=eq.%s&select=value" % (url, CHAVE), headers=H, timeout=30); r.raise_for_status()
    antes = r.json()[0]["value"]; novo = copy.deepcopy(antes); itens = novo["items"]

    for t in itens:
        if THAIS[0] in (t.get("image_url") or ""): t["produtos"] = sorted(set(t.get("produtos") or []) | set(THAIS[1]))
    ja = {(t.get("author"), t.get("quote")) for t in itens}
    uploads = []
    for ident, autora, origem, pecas, fala in BALOES:
        im = balao(fala); b = io.BytesIO(); im.save(b, "JPEG", quality=88); data = b.getvalue()
        im.save(os.path.join(SAIDA, ident + ".jpg"), quality=88)
        dest = "depoimentos/balao-%s-%s.jpg" % (ident, hashlib.md5(data).hexdigest()[:8])
        uploads.append((dest, data))
        if (autora, fala) not in ja:
            itens.append({"quote": fala, "author": autora, "origem": origem, "tipo": "print", "produtos": pecas,
                          "image_url": "%s/storage/v1/object/public/site/%s" % (url, dest), "image_width": im.width, "image_height": im.height})

    por_peca = {}
    for t in itens:
        for p in t.get("produtos") or []: por_peca.setdefault(p, []).append(t["author"])
    for p, quem in sorted(por_peca.items()): print("%-22s %d · %s" % (p, len(quem), ", ".join(quem)))
    print("itens: %d → %d · balões em %s" % (len(antes["items"]), len(itens), SAIDA))
    if not APPLY: print("modo: SIMULAÇÃO (use --apply)"); return

    backup = os.path.join(PROJ, "brand-assets", "backup-site-content-testimonials-%s-antes-baloes.json" % datetime.date.today())
    with io.open(backup, "w", encoding="utf-8") as f: json.dump({"key": CHAVE, "value": antes}, f, ensure_ascii=False, indent=1)
    for dest, data in uploads:
        up = requests.post("%s/storage/v1/object/site/%s" % (url, dest), headers=dict(H, **{"Content-Type": "image/jpeg", "x-upsert": "true", "cache-control": "max-age=31536000"}), data=data, timeout=120)
        if not up.ok: raise RuntimeError("upload %s -> %s" % (dest, up.status_code))
    r = requests.post("%s/rest/v1/site_content?on_conflict=key" % url, headers=dict(H, **{"Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal"}),
                      json={"key": CHAVE, "value": novo, "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}, timeout=30)
    print("GRAVADO" if r.ok else "ERRO %s %s" % (r.status_code, r.text), "| backup:", os.path.basename(backup))

if __name__ == "__main__":
    main()
