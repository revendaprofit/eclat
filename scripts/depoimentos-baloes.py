# -*- coding: utf-8 -*-
"""
Balões de mensagem para a faixa "Quem já veste" das peças (sócia, 2026-10-27: "reforçar nossos feedbacks").

Cada balão é uma fala REAL, tirada de áudio, vídeo, story ou mensagem (fontes em contexto-claude/diario/), com a
pessoa real e sem sobrenome. Quem é embaixadora ou parceira (ganhou a peça) aparece marcada no campo `origem`.
Não há fala inventada nem nome trocado: depoimento falso é propaganda enganosa (CDC art. 37) e fere a regra da marca.

O balão segue o modelo do print real do canal de onde a fala veio (WhatsApp ou Instagram), sem hora nem barra de
áudio inventadas. Rodar de novo troca a imagem do item que já existe.
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
    # Falas que entraram só em texto (scripts/depoimentos-por-peca.py): ganham o balão do canal de origem.
    ("alayse-camiseta", "Alayse", "WhatsApp", ["camiseta-raglan-dry"],
     "Que pacote lindo, cheiro maravilhoso, que sensação boa, o tecido da camiseta é perfeito."),
    ("samara-aprovado", "Samara", "Instagram", ["short-orvalho", "top-orvalho"],
     "APROVADO! Extremamente confortável, esse e os próximos."),
    ("alana-arraso", "Alana", "Instagram", ["macaquinho-solaris"],
     "Esse macaquinho é um arraso!! Super firme!!"),
    ("pollianna-nao-sobe", "Pollianna", "Instagram", ["macaquinho-solaris"],
     "Super aprovado! Não sobe, não enrola, macaquinho que garante sucesso no seu treino."),
]
THAIS = ("thais-conjunto-", ["top-aurora", "short-aurora"])
# Ordem da lista = ordem na home (os 8 primeiros prints) e dentro de cada peça: a prova mais forte na frente.
PRIMEIROS = ["samara-short-nao-sobe-", "audio-short-", "melka-pulos-forrado-", "andrea-bojo-", "balao-gabriel-camiseta-",
             "balao-fabi-tecido-", "impactada-", "luana-aurora-macaquinho-"]

# Modelos tirados dos prints reais: WhatsApp (fundo com desenhos de um print da Luana, balão branco com bico,
# letra escura) e Instagram (fundo branco, balão cinza). Sem hora, sem barra de áudio: só o que a fonte tem.
FUNDO_WA = os.path.join(PROJ, "brand-assets", "depoimentos-site", "baloes", "fundo-whatsapp.png")

def fonte(tam):
    for f in ("C:/Windows/Fonts/segoeui.ttf", "/System/Library/Fonts/SFNS.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        if os.path.exists(f): return ImageFont.truetype(f, tam)
    return ImageFont.load_default()

def ladrilho(W, H):
    t = Image.open(FUNDO_WA).convert("RGB"); im = Image.new("RGB", (W, H))
    for y in range(0, H, t.height):
        for x in range(0, W, t.width):
            v = t.transpose(Image.FLIP_LEFT_RIGHT) if (x // t.width + y // t.height) % 2 else t
            im.paste(v, (x, y))
    return im

def balao(fala, origem):
    whats = origem.startswith("WhatsApp"); audio = "áudio" in origem
    fn, fp = fonte(50), fonte(38)
    linhas = textwrap.wrap(("“%s”" % fala) if audio else fala, 30); lh = 66
    larg = max([fn.getlength(l) for l in linhas] + ([fp.getlength("Áudio transcrito")] if audio else []))
    topo = 58 if audio else 0
    bw, bh = int(larg) + 80, topo + len(linhas) * lh + 52
    W, H = 1170, bh + 70
    if whats:
        im = ladrilho(W, H); cor, raio = (255, 255, 255), 36
    else:
        im = Image.new("RGB", (W, H), (255, 255, 255)); cor, raio = (239, 239, 239), 46
    d = ImageDraw.Draw(im); x0, y0 = 40, 35
    d.rounded_rectangle((x0, y0, x0 + bw, y0 + bh), raio, fill=cor)
    if whats: d.polygon([(x0, y0), (x0 + 40, y0), (x0 - 16, y0 - 2)], fill=cor)  # bico, como no print
    y = y0 + 26
    if audio: d.text((x0 + 40, y), "Áudio transcrito", font=fp, fill=(102, 119, 129)); y += topo
    for l in linhas: d.text((x0 + 40, y), l, font=fn, fill=(17, 27, 33)); y += lh
    im = im.crop((0, 0, min(W, x0 + bw + 80), H))
    return im.resize((900, round(im.height * 900 / im.width)), Image.LANCZOS) if im.width > 900 else im

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
    uploads = []
    for ident, autora, origem, pecas, fala in BALOES:
        im = balao(fala, origem); b = io.BytesIO(); im.save(b, "JPEG", quality=88); data = b.getvalue()
        im.save(os.path.join(SAIDA, ident + ".jpg"), quality=88)
        dest = "depoimentos/balao-%s-%s.jpg" % (ident, hashlib.md5(data).hexdigest()[:8])
        uploads.append((dest, data))
        img = {"image_url": "%s/storage/v1/object/public/site/%s" % (url, dest), "image_width": im.width, "image_height": im.height}
        existente = next((t for t in itens if (t.get("author"), t.get("quote")) == (autora, fala)), None)
        if existente: existente.update(img); continue
        itens.append({"quote": fala, "author": autora, "origem": origem, "tipo": "print", "produtos": pecas, **img})

    def chave(t):
        url = t.get("image_url") or ""
        return next((i for i, k in enumerate(PRIMEIROS) if k in url), len(PRIMEIROS))
    itens.sort(key=chave)   # sort estável: o resto fica na ordem de antes

    por_peca = {}
    for t in itens:
        for p in t.get("produtos") or []: por_peca.setdefault(p, []).append(t["author"])
    for p, quem in sorted(por_peca.items()): print("%-22s %d · %s" % (p, len(quem), ", ".join(quem)))
    print("itens: %d → %d · balões em %s" % (len(antes["items"]), len(itens), SAIDA))
    if not APPLY: print("modo: SIMULAÇÃO (use --apply)"); return

    backup = os.path.join(PROJ, "brand-assets", "backup-site-content-testimonials-%s-antes-baloes.json" % datetime.datetime.now().strftime("%Y-%m-%d-%H%M"))
    with io.open(backup, "w", encoding="utf-8") as f: json.dump({"key": CHAVE, "value": antes}, f, ensure_ascii=False, indent=1)
    for dest, data in uploads:
        up = requests.post("%s/storage/v1/object/site/%s" % (url, dest), headers=dict(H, **{"Content-Type": "image/jpeg", "x-upsert": "true", "cache-control": "max-age=31536000"}), data=data, timeout=120)
        if not up.ok: raise RuntimeError("upload %s -> %s" % (dest, up.status_code))
    r = requests.post("%s/rest/v1/site_content?on_conflict=key" % url, headers=dict(H, **{"Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal"}),
                      json={"key": CHAVE, "value": novo, "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}, timeout=30)
    print("GRAVADO" if r.ok else "ERRO %s %s" % (r.status_code, r.text), "| backup:", os.path.basename(backup))

if __name__ == "__main__":
    main()
