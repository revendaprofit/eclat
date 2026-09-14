"""
Importa produtos da coleção Lumière a partir das fotos do ensaio renomeadas no padrão
"Coleção <col> - Modelo <modelo> (<n>)-Cor <cor> .jpg" (pasta brand-assets/ensaio-camila-2026-09-10).

Fluxo por modelo: otimiza as fotos (JPEG 2000px) → hospeda no Supabase Storage (bucket público
`site`, pasta products/<handle>/) → cria o produto na Medusa Admin API (opções Tamanho × Cor,
preço BRL decimal, categoria, coleção Lumière, canal de vendas) → liga cada foto às variantes da
sua cor → estoque por tamanho no CD Brasil → registra a cor em site_content.cores.

Uso:
  python scripts/import-lumiere.py --dry-run             # só mostra o que faria
  python scripts/import-lumiere.py --wipe                # exclui TODOS os produtos atuais antes
  python scripts/import-lumiere.py --modelo "Macaquinho Solaris"   # filtra um modelo (não mexe nos conjuntos)
  python scripts/import-lumiere.py --estoque             # também SOBRESCREVE estoque existente com a grade
Configuração: MODELOS (ficha), GALERIA (curadoria de fotos por produto/cor), CONJUNTOS (curados), CORES.
Requisitos: pip install requests pillow · Credenciais: apps/cockpit/.env.local
Exige backup prévio em brand-assets/backup-catalogo-*.json quando --wipe é usado.
"""
import os, re, sys, glob, json, argparse, unicodedata, io, hashlib
from collections import defaultdict

try:
    import requests
    from PIL import Image, ImageOps
except ImportError:
    print("Rode antes: pip install requests pillow"); sys.exit(1)

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))          # .../eclat
PROJ = os.path.dirname(RAIZ)                                                 # .../ECLAT
FOTOS = os.path.join(PROJ, "brand-assets", "ensaio-camila-2026-09-10")
BASE = os.environ.get("MEDUSA_URL", "https://endearing-enthusiasm-production-775b.up.railway.app")
# Aceita as variações que o dono já usou: "Modelo X (n)-Cor Y .jpg", "Modelo X - Cor Y (n).jpg",
# "X - Cor Y (n).jpg" (sem "Modelo"). O "(n)" pode vir antes ou depois da cor.
PADRAO = re.compile(
    r"^Cole[çc][ãa]o (?P<col>.+?) - (?:Modelo )?(?P<modelo>.+?)"
    r"(?: \((?P<n1>\d+)\))?\s*-\s*Cor (?P<cor>.+?)(?: \((?P<n2>\d+)\))?\s*\.jpe?g$", re.I)
LADO_MAX = 2000
JPEG_Q = 85

COLECOES = {"lumiere": {"title": "Lumière", "handle": "lumiere"}}

# Ficha comercial por modelo (chave = nome do modelo normalizado). Preço em REAIS decimais (Medusa v2).
# `cores` = chaves de CORES na ordem da vitrine (a 1ª cor dá a capa do produto).
# Ficha de produção "Família Canelado" (Telha e Grafitti), 25/08/2026.
# Aplicação e forro por cor conforme a planilha de SKUs (14/09): Telha = forro mousse + logo off-white;
# Grafitti = forro grafitti + logo holográfico.
COMPOSICAO_CANELADO = (
    "Tecido canelado: 79% poliamida, 13% poliéster, 8% elastano (385 g/m²).\n"
    "Forro: 91% poliamida, 9% elastano (mousse na cor Telha, grafitti na cor Grafitti).\n"
    "Logo termocolante: off-white na cor Telha, holográfico na cor Grafitti."
)

MODELOS = {
    "macaquinho solaris": {
        "title": "Macaquinho Solaris",
        "handle": "macaquinho-solaris",
        "refs": {"telha": 1005, "grafitti": 1006},   # REF da etiqueta (ECLAT-SKU-Lumina.xlsx, 14/09)
        "categoria": "macaquinhos",
        "cores": ["telha", "grafitti"],
        "tamanhos": ["P", "M", "G"],
        "estoque": {"P": 10, "M": 20, "G": 10},
        "preco": 299.00,          # provisório — precificação pendente (dono, 13/09/2026)
        "peso_g": 300,
    },
    "top aurora": {
        "title": "Top Aurora",
        "handle": "top-aurora",
        "refs": {"telha": 1001, "grafitti": 1002},   # REF da etiqueta (ECLAT-SKU-Lumina.xlsx, 14/09)
        "categoria": "tops",
        "cores": ["telha", "grafitti"],
        "tamanhos": ["P", "M", "G"],
        "estoque": {"P": 10, "M": 15, "G": 10},   # grade da ficha de produção (dono, 13/09)
        "preco": 169.00,          # provisório (dono, 13/09/2026)
        "peso_g": 200,
    },
    "short aurora": {
        "title": "Short Aurora",
        "handle": "short-aurora",
        "refs": {"telha": 1003, "grafitti": 1004},   # REF da etiqueta (ECLAT-SKU-Lumina.xlsx, 14/09)
        "categoria": "shorts",
        "cores": ["telha", "grafitti"],
        "tamanhos": ["P", "M", "G"],
        "estoque": {"P": 10, "M": 15, "G": 10},
        "preco": 169.00,
        "peso_g": 200,
    },
    "top orvalho": {
        "title": "Top Orvalho",
        "handle": "top-orvalho",
        "refs": {"telha": 1007, "grafitti": 1008},   # REF da etiqueta (ECLAT-SKU-Lumina.xlsx, 14/09)
        "categoria": "tops",
        "cores": ["grafitti", "telha"],
        "tamanhos": ["P", "M", "G"],
        "estoque": {"P": 10, "M": 15, "G": 10},
        "preco": 169.00,
        "peso_g": 200,
    },
    "short orvalho": {
        "title": "Short Orvalho",
        "handle": "short-orvalho",
        "refs": {"telha": 1009, "grafitti": 1010},   # REF da etiqueta (ECLAT-SKU-Lumina.xlsx, 14/09)
        "categoria": "shorts",
        "cores": ["grafitti", "telha"],
        "tamanhos": ["P", "M", "G"],
        "estoque": {"P": 10, "M": 15, "G": 10},
        "preco": 169.00,
        "peso_g": 200,
    },
}

# Textos da vitrine (descrição, "Informações do produto", "Feita pra você / Talvez não seja pra você", FAQ)
# vêm SÓ de scripts/lumiere-textos.json — textos oficiais do dono. Não escrever copy aqui.
TEXTOS = json.load(open(os.path.join(RAIZ, "scripts", "lumiere-textos.json"), encoding="utf-8"))
for _m in MODELOS.values():
    _t = TEXTOS["produtos"][_m["handle"]]
    _faq = _t["faq"] + [f for f in TEXTOS["faq_comum"] if not (_t.get("sem_conjunto") and "conjunto" in f["q"].lower())]
    _m["description"] = _t["description"]
    _m["metadata"] = {"composicao": COMPOSICAO_CANELADO, "informacoes": TEXTOS["informacoes"][_t["tipo"]],
                      "quem_sim": _t["quem_sim"], "quem_nao": _t["quem_nao"], "faq": json.dumps(_faq, ensure_ascii=False)}

# Galeria por (handle, cor): SELEÇÃO exata e ordem de vitrine. Cada item é
#   ("<modelo do arquivo renomeado>", n)  -> "Coleção Lumiere - [Modelo] <modelo> ... Cor <cor> (n)"
#   ("arquivo", "043")                     -> foto ainda não renomeada, pelo prefixo "043_"
# Fotos de conjunto servem ao top e ao short. Sem entrada: todas as fotos do próprio modelo e cor.
# Cor sem nenhuma foto é PULADA (não cria variante) até existir foto.
GALERIA = {
    # Revisão foto a foto (dono, 14/09/2026): nenhuma foto com a cabeça cortada pela metade (ou a cabeça
    # inteira no quadro, ou recorte limpo abaixo do busto), a peça vendida inteira (barra do short
    # visível), 1ª foto focada NA PEÇA do produto, no máximo 6 fotos por cor. 3º elemento = recorte 2:3
    # (x0, y0, x1, y1) em frações da foto original.
    ("macaquinho-solaris", "telha"): [("macaquinho solaris", n) for n in [33, 26, 23, 29, 27, 24]],
    ("macaquinho-solaris", "grafitti"): [("macaquinho solaris", n) for n in [105, 101, 104, 103, 102]],   # fotos refeitas na cor real (14/09)
    ("top-aurora", "telha"): [("conjunto aurora", 1), ("top aurora", 2), ("top aurora", 1), ("top aurora", 8), ("top aurora", 5), ("top aurora", 6)],
    ("top-aurora", "grafitti"): [("conjunto aurora", 9, (0.20, 0.08, 0.92, 0.80)), ("conjunto aurora", 5), ("conjunto aurora", 4), ("conjunto aurora", 10), ("conjunto aurora", 8), ("conjunto aurora", 1)],
    ("short-aurora", "telha"): [("conjunto aurora", 7), ("short aurora", 1), ("short aurora", 2), ("short aurora", 4), ("conjunto aurora", 2), ("conjunto aurora", 6)],
    ("short-aurora", "grafitti"): [("conjunto aurora", 3, (0.285, 0.45, 0.835, 1.0)), ("conjunto aurora", 7), ("conjunto aurora", 8), ("conjunto aurora", 5), ("conjunto aurora", 2), ("conjunto aurora", 1)],
    ("top-orvalho", "grafitti"): [("conjunto orvalho", 5, (0.195, 0.03, 0.865, 0.70)), ("conjunto orvalho", 8), ("top orvalho", 2), ("conjunto orvalho", 13), ("conjunto orvalho", 9), ("top orvalho", 1)],
    ("top-orvalho", "telha"): [("arquivo", "050"), ("arquivo", "060"), ("arquivo", "052"), ("arquivo", "056"), ("conjunto orvalho", 1), ("conjunto orvalho", 2)],   # 050/060/052/056: top Telha com short Grafitti
    ("short-orvalho", "grafitti"): [("short orvalho", 3), ("short orvalho", 1), ("conjunto orvalho", 9), ("conjunto orvalho", 6), ("conjunto orvalho", 12), ("conjunto orvalho", 4)],
    ("short-orvalho", "telha"): [("conjunto orvalho", 1, (0.285, 0.45, 0.755, 0.92)), ("conjunto orvalho", 1), ("conjunto orvalho", 2)],   # CO3 saiu: corta o short
}

# Conjuntos montados pelo admin (Benefício Conjunto, curados). Vale por PRODUTO, qualquer cor (dono, 13/09).
# `nome` SEM a palavra "Conjunto": a vitrine já prefixa ("Conjunto Aurora" no título, no aviso e no GA4).
CONJUNTOS = [
    {"nome": "Aurora", "handle": "conjunto-aurora", "produtos": ["top-aurora", "short-aurora"],
     "capa": ("conjunto aurora", "telha", 2), "tipo_desconto": "total_percentual", "valor": 10, "ordem": 0},
    {"nome": "Orvalho", "handle": "conjunto-orvalho", "produtos": ["top-orvalho", "short-orvalho"],
     "capa": ("conjunto orvalho", "grafitti", 5), "tipo_desconto": "total_percentual", "valor": 10, "ordem": 1},
]

# Cores: chave = como o dono escreve no arquivo (normalizado); nome = como aparece no site;
# código de SKU e hex amostrado do tecido nas fotos do ensaio.
CORES = {
    "telha": {"nome": "Telha", "sku": "TEL", "hex": "#C27050"},   # "sku" (3 letras) é só histórico: o SKU usa as REFs de MODELOS
    "grafitti": {"nome": "Grafitti", "sku": "GRA", "hex": "#3A363A"},   # reamostrado das fotos refeitas (14/09)   # nome escolhido pelo dono (13/09), não "Grafite"
}


def norm(s):
    return "".join(c for c in unicodedata.normalize("NFD", s or "") if unicodedata.category(c) != "Mn").lower().strip()

def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", norm(s)).strip("-")

def env_cockpit():
    env = {}
    with open(os.path.join(RAIZ, "apps", "cockpit", ".env.local"), encoding="utf-8") as f:
        for line in f:
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1); env[k.strip()] = v.strip()
    return env

def indexar_fotos():
    """Índice das fotos renomeadas: {(modelo_norm, cor_norm, n): caminho}; e a coleção do padrão."""
    idx = {}; colecao = None
    for arq in sorted(os.listdir(FOTOS)):
        m = PADRAO.match(arq)
        if not m: continue
        colecao = colecao or norm(m["col"])
        idx[(norm(m["modelo"]), norm(m["cor"]), int(m["n1"] or m["n2"] or 0))] = os.path.join(FOTOS, arq)
    return colecao, idx

MAX_FOTOS = 6   # teto combinado com o dono (14/09): no máximo 6 fotos por produto e cor (+ vídeo)

def galeria(f, cor, idx):
    """Lista ordenada de (caminho, recorte) das fotos de um produto numa cor (ver GALERIA).
    `recorte` = (x0, y0, x1, y1) em frações da foto original, ou None (foto inteira)."""
    itens = GALERIA.get((f["handle"], cor))
    if itens is None:
        mod = norm(f["title"])
        return [(idx[k], None) for k in sorted(k for k in idx if k[0] == mod and k[1] == cor)][:MAX_FOTOS]
    assert len(itens) <= MAX_FOTOS, "GALERIA[%s/%s]: %d fotos, máximo %d" % (f["handle"], cor, len(itens), MAX_FOTOS)
    fotos = []
    for item in itens:
        grupo, ref = item[0], item[1]
        recorte = item[2] if len(item) > 2 else None
        if grupo == "arquivo":
            achados = [x for x in os.listdir(FOTOS) if x.startswith("%s_" % ref)]
            assert len(achados) == 1, "GALERIA[%s/%s]: arquivo %s_ não encontrado" % (f["handle"], cor, ref)
            fotos.append((os.path.join(FOTOS, achados[0]), recorte))
        else:
            k = (norm(grupo), cor, ref)
            assert k in idx, "GALERIA[%s/%s]: foto inexistente %s" % (f["handle"], cor, k)
            fotos.append((idx[k], recorte))
    return fotos

def otimizar(caminho, recorte=None):
    im = ImageOps.exif_transpose(Image.open(caminho)).convert("RGB")
    if recorte:
        W, H = im.size
        x0, y0, x1, y1 = recorte
        caixa = (round(x0 * W), round(y0 * H), round(x1 * W), round(y1 * H))
        prop = (caixa[2] - caixa[0]) / (caixa[3] - caixa[1])
        assert 0 <= x0 < x1 <= 1 and 0 <= y0 < y1 <= 1, "recorte fora da foto: %s" % (recorte,)
        assert abs(prop - 2 / 3) < 0.02, "recorte %s não é 2:3 (%.3f) em %s" % (recorte, prop, os.path.basename(caminho))
        im = im.crop(caixa)
    im.thumbnail((LADO_MAX, LADO_MAX))
    buf = io.BytesIO(); im.save(buf, "JPEG", quality=JPEG_Q, optimize=True, progressive=True)
    return buf.getvalue()


class Medusa:
    def __init__(self, env):
        r = requests.post(BASE + "/auth/user/emailpass", json={"email": env["MEDUSA_ADMIN_EMAIL"], "password": env["MEDUSA_ADMIN_PASSWORD"]}, timeout=30)
        assert r.ok, "login admin falhou: %s" % r.text[:200]
        self.H = {"Authorization": "Bearer " + r.json()["token"]}
    def get(self, path, **kw):
        r = requests.get(BASE + path, headers=self.H, timeout=60, **kw); r.raise_for_status(); return r.json()
    def post(self, path, body):
        r = requests.post(BASE + path, headers=self.H, json=body, timeout=120)
        if not r.ok: raise RuntimeError("POST %s → %s %s" % (path, r.status_code, r.text[:500]))
        return r.json()
    def put(self, path, body):
        r = requests.put(BASE + path, headers=self.H, json=body, timeout=120)
        if not r.ok: raise RuntimeError("PUT %s → %s %s" % (path, r.status_code, r.text[:500]))
        return r.json()
    def delete(self, path):
        r = requests.delete(BASE + path, headers=self.H, timeout=120)
        if not r.ok: raise RuntimeError("DELETE %s → %s %s" % (path, r.status_code, r.text[:300]))
        return r.json()


class Storage:
    def __init__(self, env):
        self.url = env["NEXT_PUBLIC_SUPABASE_URL"]; k = env["SUPABASE_SERVICE_ROLE_KEY"]
        self.H = {"apikey": k, "Authorization": "Bearer " + k}
    def upload(self, dest, data, mime="image/jpeg"):
        r = requests.post(self.url + "/storage/v1/object/site/" + dest, headers=dict(self.H, **{"Content-Type": mime, "x-upsert": "true"}), data=data, timeout=120)
        if not r.ok: raise RuntimeError("upload %s → %s %s" % (dest, r.status_code, r.text[:300]))
        return self.url + "/storage/v1/object/public/site/" + dest
    def merge_cores(self, novas):
        r = requests.get(self.url + "/rest/v1/site_content?key=eq.cores&select=value", headers=self.H, timeout=30)
        atual = (r.json() or [{}])[0].get("value") or {} if r.ok else {}
        existentes = {norm(k): k for k in atual}
        for nome, info in novas.items():
            chave = existentes.get(norm(nome), nome)
            atual[chave] = dict(atual.get(chave) or {}, hex=info["hex"], swatch_url=(atual.get(chave) or {}).get("swatch_url"))
        h = dict(self.H, **{"Content-Type": "application/json", "Prefer": "resolution=merge-duplicates"})
        r = requests.post(self.url + "/rest/v1/site_content", headers=h, json={"key": "cores", "value": atual}, timeout=30)
        if not r.ok: raise RuntimeError("site_content.cores → %s %s" % (r.status_code, r.text[:300]))
        return atual


def wipe(api, dry):
    backups = glob.glob(os.path.join(PROJ, "brand-assets", "backup-catalogo-*.json"))
    assert backups, "sem backup em brand-assets/backup-catalogo-*.json — gere antes de excluir"
    prods = api.get("/admin/products?limit=200&fields=id,title,handle")["products"]
    print("\n== EXCLUSÃO de %d produto(s) (backup: %s)" % (len(prods), os.path.basename(sorted(backups)[-1])))
    for p in prods:
        print("  - %s (%s)" % (p["title"], p["handle"]))
        if not dry: api.delete("/admin/products/" + p["id"])
    print("  excluídos" if not dry else "  [dry-run] nada excluído")


def sincronizar_conjuntos(api, st, idx, dry):
    """Cria/atualiza os curados de CONJUNTOS: capa no Supabase (site/conjuntos/<handle>.jpg), produtos
    publicados pelo handle, desconto e ordem. Idempotente por handle (handle de curado é imutável)."""
    existentes = {c["handle"]: c for c in api.get("/admin/conjuntos/curados")["curados"]}
    for cj in CONJUNTOS:
        ids = []
        for h in cj["produtos"]:
            ps = api.get("/admin/products?handle=%s&fields=id,status" % h)["products"]
            if dry and not ps:
                ids.append("<%s: criado nesta rodada>" % h); continue
            assert ps and ps[0]["status"] == "published", "conjunto %s: produto %s não publicado" % (cj["handle"], h)
            ids.append(ps[0]["id"])
        mod, cor, n = cj["capa"]
        caminho = idx[(norm(mod), cor, n)]
        dest = "conjuntos/%s.jpg" % cj["handle"]
        capa = st.url + "/storage/v1/object/public/site/" + dest if dry else st.upload(dest, otimizar(caminho))
        corpo = {"nome": cj["nome"], "capa_url": capa, "product_ids": ids, "tipo_desconto": cj["tipo_desconto"],
                 "valor": cj["valor"], "ativo": True, "ordem": cj["ordem"]}
        atual = existentes.get(cj["handle"])
        if dry:
            print("\n[dry-run] conjunto %s (%s): %s" % (cj["nome"], "atualizar" if atual else "criar", corpo)); continue
        if atual:
            api.put("/admin/conjuntos/curados/%s" % atual["id"], corpo)
            print("\nconjunto atualizado: %s (%s)" % (cj["nome"], atual["id"]))
        else:
            novo = api.post("/admin/conjuntos/curados", dict(corpo, handle=cj["handle"]))
            print("\nconjunto criado: %s -> %s" % (cj["nome"], json.dumps(novo, ensure_ascii=False)[:160]))


def main():
    if hasattr(sys.stdout, "reconfigure"): sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true"); ap.add_argument("--wipe", action="store_true"); ap.add_argument("--modelo")
    ap.add_argument("--estoque", action="store_true", help="sobrescreve estoque JÁ existente com a grade de MODELOS (padrão: só cria o nível das variantes novas)")
    a = ap.parse_args(); dry = a.dry_run
    env = env_cockpit(); api = Medusa(env); st = Storage(env)

    colecao, idx = indexar_fotos()
    assert idx, "nenhuma foto renomeada encontrada em %s" % FOTOS
    alvo = [m for m in MODELOS if not a.modelo or m == norm(a.modelo)]
    assert alvo, "modelo %s sem ficha em MODELOS" % a.modelo
    print("Fotos renomeadas: %d | coleção=%s | modelos: %s" % (len(idx), colecao, [MODELOS[m]["title"] for m in alvo]))

    if a.wipe: wipe(api, dry)

    # referências
    col_spec = COLECOES[colecao]
    cols = api.get("/admin/collections?limit=100&fields=id,handle")["collections"]
    col_id = next((c["id"] for c in cols if c["handle"] == col_spec["handle"]), None)
    if not col_id:
        print("Criando coleção %s" % col_spec["title"])
        col_id = None if dry else api.post("/admin/collections", {"title": col_spec["title"], "handle": col_spec["handle"]})["collection"]["id"]
    cats = {c["handle"]: c["id"] for c in api.get("/admin/product-categories?limit=100&fields=id,handle")["product_categories"]}
    sc_id = api.get("/admin/sales-channels")["sales_channels"][0]["id"]
    sp_id = api.get("/admin/shipping-profiles")["shipping_profiles"][0]["id"]
    sloc = api.get("/admin/stock-locations")["stock_locations"][0]["id"]

    cores_novas = {}
    for mod in alvo:
        f = MODELOS[mod]; handle = f["handle"]
        fotos_por_cor = {c: galeria(f, c, idx) for c in f["cores"]}
        puladas = [CORES[c]["nome"] for c, fs in fotos_por_cor.items() if not fs]
        cores = [c for c in f["cores"] if fotos_por_cor[c]]
        nomes_cores = [CORES[c]["nome"] for c in cores]
        print("\n== %s | cores=%s | tamanhos=%s | R$ %.2f" % (f["title"], nomes_cores, f["tamanhos"], f["preco"]))
        if puladas: print("  AVISO: sem foto, cor(es) pulada(s): %s" % puladas)
        if not cores: print("  AVISO: nenhuma cor com foto — produto não criado"); continue

        # 1) fotos → Supabase
        urls_por_cor = {}
        for c in cores:
            urls = []
            for i, (caminho, recorte) in enumerate(fotos_por_cor[c], 1):
                # sufixo = hash do arquivo de origem + recorte: trocar a foto (ou o recorte) gera URL nova (sem cache velho)
                chave = os.path.basename(caminho) + ("|%s" % (recorte,) if recorte else "")
                dest = "products/%s/%s-%02d-%s.jpg" % (handle, c, i, hashlib.md5(chave.encode("utf-8")).hexdigest()[:8])
                if dry: urls.append(st.url + "/storage/v1/object/public/site/" + dest); continue
                urls.append(st.upload(dest, otimizar(caminho, recorte)))
            urls_por_cor[c] = urls
            print("  fotos %s: %d hospedadas em products/%s/" % (CORES[c]["nome"], len(urls), handle))
            cores_novas[CORES[c]["nome"]] = CORES[c]

        # 2) produto
        variants = [{
            "title": "%s / %s" % (t, CORES[c]["nome"]),
            # SKU da etiqueta = ECL-<REF do modelo+cor>-<TAM>; o código de barras (Code 128) carrega o mesmo texto
            "sku": "ECL-%d-%s" % (f["refs"][c], t),
            "barcode": "ECL-%d-%s" % (f["refs"][c], t),
            "options": {"Tamanho": t, "Cor": CORES[c]["nome"]},
            "manage_inventory": True,
            "prices": [{"amount": f["preco"], "currency_code": "brl"}],
        } for c in cores for t in f["tamanhos"]]
        todas_urls = [u for c in cores for u in urls_por_cor[c]]
        payload = {
            "title": f["title"], "handle": handle, "status": "published", "description": f["description"],
            "weight": f["peso_g"], "metadata": f["metadata"],
            "options": [{"title": "Tamanho", "values": f["tamanhos"]}, {"title": "Cor", "values": nomes_cores}],
            "variants": variants, "collection_id": col_id, "categories": [{"id": cats[f["categoria"]]}],
            "sales_channels": [{"id": sc_id}], "shipping_profile_id": sp_id,
            "images": [{"url": u} for u in todas_urls], "thumbnail": todas_urls[0],
        }
        if dry:
            print("  [dry-run] payload: %d variantes, %d imagens, SKUs %s" % (len(variants), len(todas_urls), [v["sku"] for v in variants])); continue
        existente = api.get("/admin/products?handle=%s&fields=id" % handle)["products"]
        if existente:
            pid = existente[0]["id"]
            prod = api.get("/admin/products/%s?fields=id,metadata,images.id,images.url,options.id,options.title,options.values.value,variants.id,variants.sku" % pid)["product"]
            print("  produto já existe (%s): completando cores/variantes/fotos" % pid)
            # metadata: só preenche chaves AUSENTES (textos editados no Cockpit são preservados)
            meta = dict(prod.get("metadata") or {})
            faltando = {k: v for k, v in f["metadata"].items() if not meta.get(k)}
            if faltando:
                api.post("/admin/products/%s" % pid, {"metadata": dict(meta, **faltando)})
                print("  metadata preenchida: %s" % sorted(faltando))
            # a) valores novos na opção Cor (Medusa: envia a lista completa)
            opt_cor = next(o for o in prod["options"] if norm(o["title"]) == "cor")
            atuais = [v["value"] for v in opt_cor["values"]]
            novos = [n for n in nomes_cores if n not in atuais]
            if novos:
                api.post("/admin/products/%s/options/%s" % (pid, opt_cor["id"]), {"values": atuais + novos})
                print("  opção Cor: + %s" % novos)
            # b) variantes que ainda não existem (por SKU)
            skus = {v["sku"] for v in prod["variants"]}
            criadas = [v for v in variants if v["sku"] not in skus]
            for v in criadas:
                api.post("/admin/products/%s/variants" % pid, v)
            if criadas: print("  variantes criadas: %s" % [v["sku"] for v in criadas])
            # c) fotos novas (Medusa substitui a lista inteira → reenvia as existentes com id+url; url é obrigatória)
            urls_exist = {i["url"] for i in prod["images"]}
            novas_urls = [u for u in todas_urls if u not in urls_exist]
            if novas_urls:
                api.post("/admin/products/%s" % pid, {"images": [{"id": i["id"], "url": i["url"]} for i in prod["images"]] + [{"url": u} for u in novas_urls]})
                print("  fotos adicionadas: %d" % len(novas_urls))
            # d) ordem final da galeria = ordem de todas_urls (cores na ordem do arquivo, fotos na ordem de ORDEM)
            imgs = api.get("/admin/products/%s?fields=id,images.id,images.url" % pid)["product"]["images"]
            por_url = {i["url"]: i["id"] for i in imgs}
            ordem = [{"id": por_url[u], "url": u} for u in todas_urls if u in por_url]
            # fotos fora da curadoria: as do próprio script (site/products/<handle>/) saem; as de outra origem (Cockpit) ficam
            gerenciada = "/storage/v1/object/public/site/products/%s/" % handle
            removidas = [i for i in imgs if i["url"] not in todas_urls and gerenciada in i["url"]]
            ordem += [{"id": i["id"], "url": i["url"]} for i in imgs if i["url"] not in todas_urls and gerenciada not in i["url"]]
            if removidas: print("  fotos antigas removidas da galeria: %d" % len(removidas))
            # capa = 1ª foto da curadoria (a capa antiga pode apontar para uma foto que saiu da galeria)
            api.post("/admin/products/%s" % pid, {"images": ordem, "thumbnail": todas_urls[0]})
        else:
            prod = api.post("/admin/products", payload)["product"]
            print("  produto criado: %s" % prod["id"])

        # 3) fotos ↔ variantes da cor
        prod = api.get("/admin/products/%s?fields=id,*images,*variants,*variants.options" % prod["id"])["product"]
        img_por_url = {i["url"]: i["id"] for i in prod["images"]}
        for c in cores:
            var_ids = [v["id"] for v in prod["variants"] if any(o["value"] == CORES[c]["nome"] for o in v["options"])]
            for u in urls_por_cor[c]:
                api.post("/admin/products/%s/images/%s/variants/batch" % (prod["id"], img_por_url[u]), {"add": var_ids})
            print("  %d fotos ligadas às %d variantes %s" % (len(urls_por_cor[c]), len(var_ids), CORES[c]["nome"]))

        # 4) estoque
        prod = api.get("/admin/products/%s?fields=id,variants.id,variants.sku,variants.inventory_items.inventory_item_id" % prod["id"])["product"]
        for v in prod["variants"]:
            tam = v["sku"].rsplit("-", 1)[-1]; qtd = f["estoque"].get(tam, 0)
            for ii in v.get("inventory_items") or []:
                iid = ii["inventory_item_id"]
                niveis = api.get("/admin/inventory-items/%s/location-levels" % iid).get("inventory_levels") or []
                if any(n["location_id"] == sloc for n in niveis):
                    # nível existente = estoque vivo (pode ter venda/ajuste no Cockpit): só sobrescreve com --estoque
                    if a.estoque:
                        api.post("/admin/inventory-items/%s/location-levels/%s" % (iid, sloc), {"stocked_quantity": qtd})
                else:
                    api.post("/admin/inventory-items/%s/location-levels" % iid, {"location_id": sloc, "stocked_quantity": qtd})
        print("  estoque: %s%s" % (f["estoque"], "" if a.estoque else " (só variantes novas; use --estoque para sobrescrever)"))

    # 5) mapa de cores da vitrine
    if not dry:
        mapa = st.merge_cores(cores_novas); print("\nsite_content.cores: %s" % {k: v.get("hex") for k, v in mapa.items()})
    else:
        print("\n[dry-run] cores a registrar: %s" % cores_novas)
    # 6) conjuntos montados pelo admin (curados do Benefício Conjunto)
    if not a.modelo:
        sincronizar_conjuntos(api, st, idx, dry)
    print("\nConcluído. Rode: python scripts/check-catalog-options.py")

if __name__ == "__main__":
    main()
