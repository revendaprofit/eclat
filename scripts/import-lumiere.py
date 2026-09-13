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
  python scripts/import-lumiere.py --modelo "Macaquinho Solaris"   # filtra um modelo
Requisitos: pip install requests pillow · Credenciais: apps/cockpit/.env.local
Exige backup prévio em brand-assets/backup-catalogo-*.json quando --wipe é usado.
"""
import os, re, sys, glob, json, argparse, unicodedata, io
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
PADRAO = re.compile(r"^Cole[çc][ãa]o (?P<col>.+?) - Modelo (?P<modelo>.+?) \((?P<n>\d+)\)-Cor (?P<cor>.+?)\s*\.jpe?g$", re.I)
LADO_MAX = 2000
JPEG_Q = 85

COLECOES = {"lumiere": {"title": "Lumière", "handle": "lumiere"}}

# Ficha comercial por modelo (chave = nome do modelo normalizado). Preço em REAIS decimais (Medusa v2).
MODELOS = {
    "macaquinho solaris": {
        "title": "Macaquinho Solaris",
        "handle": "macaquinho-solaris",
        "sku_tipo": "MS",
        "categoria": "macaquinhos",
        "tamanhos": ["P", "M", "G"],
        "estoque": {"P": 10, "M": 20, "G": 10},
        "preco": 299.00,          # provisório — precificação pendente (dono, 13/09/2026)
        "peso_g": 300,
        "description": (
            "Macaquinho canelado de alças cruzadas nas costas, decote redondo e short curto com "
            "lettering ÉCLAT na perna. Peça única: veste em segundos, sustenta o treino e segue o dia."
        ),
        "metadata": {
            "dsb_dor": "cós descendo, blusa subindo — no meio da série, de novo?",
            "dsb_solucao": (
                "O Macaquinho Solaris é a peça única que resolve: nada desalinha, nada precisa de ajuste. "
                "Canelado que abraça o corpo, alças cruzadas nas costas e o lettering ÉCLAT na perna."
            ),
            "dsb_beneficios": "Zero ajuste durante o treino — é uma peça só\nCanelado que modela sem apertar\nVai do treino ao café sem trocar de roupa",
            "quem_sim": "Cansou de alinhar conjunto no meio do treino\nQuer uma peça única com cara de look completo\nTreina e emenda compromisso depois",
            "quem_nao": "Prefere trocar só a parte de cima ao longo do dia\nProcura peça térmica para frio extremo",
            "faq": json.dumps([
                {"q": "É prático no dia a dia?", "a": "Sim — a peça é pensada para vestir e esquecer: nada desalinha no treino e o caimento segura o resto do dia."},
                {"q": "As costas são abertas?", "a": "As alças se cruzam nas costas em um recorte vazado — sustentação com respiro. Veja as fotos de costas na galeria."},
                {"q": "O canelado marca?", "a": "O canelado é encorpado e opaco: modela a silhueta sem transparecer quando estica."},
                {"q": "Como escolho meu tamanho?", "a": "Use a tabela de medidas acima, medindo busto na parte mais cheia, cintura na parte mais fina e quadril na parte mais cheia, sempre com a fita paralela ao chão. Entre dois tamanhos: o menor sustenta mais, o maior é mais confortável."},
                {"q": "Posso trocar ou devolver?", "a": "Sim. Você tem 7 dias corridos após o recebimento para desistir da compra com reembolso integral (CDC), peça sem uso e com etiquetas. Para troca de tamanho, chame no WhatsApp com o número do pedido. Defeito de fabricação: 30 dias, sem custo."},
            ], ensure_ascii=False),
        },
    },
}

# Ordem de vitrine por (handle, cor): números "(n)" do arquivo. Fora da lista → ordem numérica depois.
ORDEM = {("macaquinho-solaris", "telha"): [33, 29, 31, 24, 23, 25, 26, 27, 28, 37, 38, 39, 21, 22, 30, 32, 34, 35, 36, 40, 41]}

# Cores: código de SKU e hex (amostrado do tecido nas fotos do ensaio).
CORES = {"telha": {"nome": "Telha", "sku": "TEL", "hex": "#C27050"}}


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

def ler_fotos(filtro_modelo=None):
    """Agrupa as fotos renomeadas: {modelo_norm: {cor_norm: [(n, caminho)]}}; retorna também a coleção."""
    grupos = defaultdict(lambda: defaultdict(list)); colecao = None
    for arq in sorted(os.listdir(FOTOS)):
        m = PADRAO.match(arq)
        if not m: continue
        mod = norm(m["modelo"])
        if filtro_modelo and mod != norm(filtro_modelo): continue
        colecao = colecao or norm(m["col"])
        grupos[mod][norm(m["cor"])].append((int(m["n"]), os.path.join(FOTOS, arq)))
    return colecao, grupos

def ordenar(handle, cor, fotos):
    pref = ORDEM.get((handle, cor), [])
    por_n = dict(fotos)
    seq = [n for n in pref if n in por_n] + sorted(n for n in por_n if n not in pref)
    return [(n, por_n[n]) for n in seq]

def otimizar(caminho):
    im = ImageOps.exif_transpose(Image.open(caminho)).convert("RGB")
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


def main():
    if hasattr(sys.stdout, "reconfigure"): sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true"); ap.add_argument("--wipe", action="store_true"); ap.add_argument("--modelo")
    a = ap.parse_args(); dry = a.dry_run
    env = env_cockpit(); api = Medusa(env); st = Storage(env)

    colecao, grupos = ler_fotos(a.modelo)
    assert grupos, "nenhuma foto renomeada encontrada em %s" % FOTOS
    print("Fotos renomeadas: coleção=%s | modelos=%s" % (colecao, {m: {c: len(f) for c, f in cs.items()} for m, cs in grupos.items()}))
    faltam = [m for m in grupos if m not in MODELOS]
    assert not faltam, "modelo(s) sem ficha em MODELOS: %s" % faltam

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
    for mod, cores in grupos.items():
        f = MODELOS[mod]; handle = f["handle"]
        for c in cores: assert c in CORES, "cor sem cadastro em CORES: %s" % c
        nomes_cores = [CORES[c]["nome"] for c in cores]
        print("\n== %s | cores=%s | tamanhos=%s | R$ %.2f" % (f["title"], nomes_cores, f["tamanhos"], f["preco"]))

        # 1) fotos → Supabase
        urls_por_cor = {}
        for c, fotos in cores.items():
            urls = []
            for i, (n, caminho) in enumerate(ordenar(handle, c, fotos), 1):
                dest = "products/%s/%s-%02d.jpg" % (handle, c, i)
                if dry: urls.append(st.url + "/storage/v1/object/public/site/" + dest); continue
                urls.append(st.upload(dest, otimizar(caminho)))
            urls_por_cor[c] = urls
            print("  fotos %s: %d hospedadas em products/%s/" % (CORES[c]["nome"], len(urls), handle))
            cores_novas[CORES[c]["nome"]] = CORES[c]

        # 2) produto
        variants = [{
            "title": "%s / %s" % (t, CORES[c]["nome"]),
            "sku": "ECL-%s-%s-%s" % (f["sku_tipo"], CORES[c]["sku"], t),
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
            prod = existente[0]; print("  produto já existe (%s): refazendo vínculo de fotos e estoque" % prod["id"])
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
                    api.post("/admin/inventory-items/%s/location-levels/%s" % (iid, sloc), {"stocked_quantity": qtd})
                else:
                    api.post("/admin/inventory-items/%s/location-levels" % iid, {"location_id": sloc, "stocked_quantity": qtd})
        print("  estoque: %s" % f["estoque"])

    # 5) mapa de cores da vitrine
    if not dry:
        mapa = st.merge_cores(cores_novas); print("\nsite_content.cores: %s" % {k: v.get("hex") for k, v in mapa.items()})
    else:
        print("\n[dry-run] cores a registrar: %s" % cores_novas)
    print("\nConcluído. Rode: python scripts/check-catalog-options.py")

if __name__ == "__main__":
    main()
