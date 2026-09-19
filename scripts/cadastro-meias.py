# -*- coding: utf-8 -*-
"""
Cadastra a "Meia Cano Médio" (categoria Acessórios > Meias) no Medusa de produção:
fotos -> Supabase Storage, produto com variantes Cor x Tamanho, preço BRL, fotos ligadas às
variantes de cada cor, estoque no CD Brasil e bolinha de cor "metade de cada cor" em site_content.cores.

Padrão = SIMULAÇÃO (não grava nada). Grava só com:  python scripts/cadastro-meias.py --apply
Idempotente: se o produto já existe (por handle), só confere fotos, estoque e cores.

Requisitos: pip install requests pillow
Credenciais: apps/cockpit/.env.local (MEDUSA_ADMIN_EMAIL/PASSWORD, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
Fotos: <raiz>/brand-assets/meias/editadas/<cor>-perfil.png (foto inteira, sem recorte)
"""
import hashlib, io, os, sys

try:
    import requests
    from PIL import Image, ImageDraw
except ImportError:
    print("Rode antes: pip install requests pillow"); sys.exit(1)

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))          # .../eclat
PROJ = os.path.dirname(RAIZ)                                                 # raiz do projeto
FOTOS = os.path.join(PROJ, "brand-assets", "meias", "editadas")
BASE = os.environ.get("MEDUSA_URL", "https://endearing-enthusiasm-production-775b.up.railway.app")
APPLY = "--apply" in sys.argv
LADO_MAX = 2000
JPEG_Q = 88

HANDLE = "meia-cano-medio"
TITULO = "Meia Cano Médio"
CATEGORIA = "meias"
PRECO = 34.90            # reais cheios (Medusa v2) — sócia, 2026-09-19
TAMANHOS = ["34-38", "39-43"]
ESTOQUE = 10             # pares por cor e tamanho (20 por cor, 60 no total) — sócia, 2026-09-19
COMPOSICAO = "95% poliamida, 3% elastano, 2% outras fibras"   # sócia, 2026-09-19
PESO_G = 46              # gramas por par (sócia, 2026-09-19); entra na cotação do frete

# Cores: nome na vitrine; slug = prefixo do arquivo de foto; sku = 3 letras; a/b = as duas metades da bolinha (corpo, punho).
CORES = [
    {"nome": "Cinza & Grafitti", "slug": "cinza-grafitti", "sku": "CGR", "a": "#434750", "b": "#BCC0C9"},
    {"nome": "Branco & Brown", "slug": "branco-brown", "sku": "BBR", "a": "#F4F4F2", "b": "#3A2621"},
    {"nome": "Exército & Brown", "slug": "exercito-brown", "sku": "EBR", "a": "#2F4A3E", "b": "#5A4036"},
]

def descricao():
    return (
        "Meia de cano médio em malha fina de poliamida, leve e de toque macio, com punho canelado que segura sem apertar. "
        "Calcanhar e ponta em cor de contraste e ÉCLAT tecido na lateral. Unissex. Vendida por par."
    )

def informacoes():
    """Aba "Informações do produto" da PDP (metadata.informacoes; parágrafos separados por linha em branco)."""
    return "Composição: %s.\n\nCano médio. Unissex. Tamanhos: %s (numeração do calçado). Vendida por par." % (COMPOSICAO, " e ".join(TAMANHOS))

def env_cockpit():
    env = {}
    # num worktree o .env.local não existe: aponte ECLAT_ENV_FILE para o do clone principal
    caminho = os.environ.get("ECLAT_ENV_FILE") or os.path.join(RAIZ, "apps", "cockpit", ".env.local")
    with io.open(caminho, encoding="utf-8") as f:
        for line in f:
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"')
    return env

def foto_jpeg(caminho):
    """Foto inteira (sem recorte), só redimensionada e convertida para JPEG."""
    im = Image.open(caminho).convert("RGB")
    im.thumbnail((LADO_MAX, LADO_MAX))
    buf = io.BytesIO(); im.save(buf, "JPEG", quality=JPEG_Q, optimize=True, progressive=True)
    return buf.getvalue()

def bolinha_png(a, b, lado=96):
    """Bolinha de cor: metade de cada cor (esquerda = corpo, direita = punho)."""
    im = Image.new("RGB", (lado, lado), a)
    ImageDraw.Draw(im).rectangle([lado // 2, 0, lado, lado], fill=b)
    buf = io.BytesIO(); im.save(buf, "PNG", optimize=True)
    return buf.getvalue()

class Medusa:
    def __init__(self, env):
        r = requests.post(BASE + "/auth/user/emailpass", json={"email": env["MEDUSA_ADMIN_EMAIL"], "password": env["MEDUSA_ADMIN_PASSWORD"]}, timeout=30)
        assert r.ok, "login admin falhou: %s" % r.text[:200]
        self.H = {"Authorization": "Bearer " + r.json()["token"]}
    def get(self, path):
        r = requests.get(BASE + path, headers=self.H, timeout=60); r.raise_for_status(); return r.json()
    def post(self, path, body):
        r = requests.post(BASE + path, headers=self.H, json=body, timeout=120)
        if not r.ok: raise RuntimeError("POST %s -> %s %s" % (path, r.status_code, r.text[:500]))
        return r.json()

class Storage:
    def __init__(self, env):
        self.url = env["NEXT_PUBLIC_SUPABASE_URL"]; k = env["SUPABASE_SERVICE_ROLE_KEY"]
        self.H = {"apikey": k, "Authorization": "Bearer " + k}
    def publica(self, dest):
        return self.url + "/storage/v1/object/public/site/" + dest
    def upload(self, dest, data, mime):
        r = requests.post(self.url + "/storage/v1/object/site/" + dest, headers=dict(self.H, **{"Content-Type": mime, "x-upsert": "true"}), data=data, timeout=120)
        if not r.ok: raise RuntimeError("upload %s -> %s %s" % (dest, r.status_code, r.text[:300]))
        return self.publica(dest)
    def cores(self):
        r = requests.get(self.url + "/rest/v1/site_content?key=eq.cores&select=value", headers=self.H, timeout=30)
        r.raise_for_status()
        return ((r.json() or [{}])[0].get("value")) or {}
    def grava_cores(self, valor):
        h = dict(self.H, **{"Content-Type": "application/json", "Prefer": "resolution=merge-duplicates"})
        r = requests.post(self.url + "/rest/v1/site_content", headers=h, json={"key": "cores", "value": valor}, timeout=30)
        if not r.ok: raise RuntimeError("site_content.cores -> %s %s" % (r.status_code, r.text[:300]))

def main():
    print("backend: %s\nmodo: %s" % (BASE, "APLICAR" if APPLY else "SIMULAÇÃO (use --apply para gravar)"))
    pendencias = []
    if not COMPOSICAO: pendencias.append("COMPOSICAO")
    if not PESO_G: pendencias.append("PESO_G (peso do par embalado, em gramas)")
    fotos = {}
    for c in CORES:
        p = os.path.join(FOTOS, "%s-perfil.png" % c["slug"])
        if os.path.exists(p): fotos[c["slug"]] = p
        else: pendencias.append("foto ausente: %s" % p)
    if pendencias:
        print("\nPENDÊNCIAS (travam o --apply):"); [print("  - " + x) for x in pendencias]
    if APPLY and pendencias: sys.exit(1)

    env = env_cockpit(); api = Medusa(env); st = Storage(env)
    cats = api.get("/admin/product-categories?handle=%s&fields=id,name,handle,is_active" % CATEGORIA)["product_categories"]
    assert cats, "categoria %s não existe — rode scripts/setup-categorias.py" % CATEGORIA
    sc = api.get("/admin/sales-channels")["sales_channels"][0]
    sp = api.get("/admin/shipping-profiles")["shipping_profiles"][0]
    sloc = api.get("/admin/stock-locations")["stock_locations"][0]
    existente = api.get("/admin/products?handle=%s&fields=id,status" % HANDLE)["products"]

    variants = [{
        "title": "%s / %s" % (t, c["nome"]),
        "sku": "ECL-MEIA-%s-%s" % (c["sku"], t.replace("-", "")),
        "options": {"Tamanho": t, "Cor": c["nome"]},
        "manage_inventory": True, "allow_backorder": False,
        "weight": PESO_G,   # o frete da SuperFrete lê variant.weight e só depois o peso do produto
        "prices": [{"amount": PRECO, "currency_code": "brl"}],
    } for c in CORES for t in TAMANHOS]

    print("\nproduto: \"%s\" /%s | R$ %.2f | categoria %s (%s) | canal %s | estoque em \"%s\"" % (
        TITULO, HANDLE, PRECO, cats[0]["name"], "ativa" if cats[0].get("is_active") else "INATIVA", sc["name"], sloc["name"]))
    print("já existe em produção: %s" % ("sim (%s, %s)" % (existente[0]["id"], existente[0]["status"]) if existente else "não"))
    print("descrição: %s" % descricao())
    print("composição: %s | peso: %s g" % (COMPOSICAO or "PENDENTE", PESO_G or "PENDENTE"))
    print("aba Informações do produto: %s" % informacoes().replace("\n\n", " | "))
    print("variantes (%d), %d pares cada = %d pares:" % (len(variants), ESTOQUE, len(variants) * ESTOQUE))
    for v in variants: print("  %-22s %s" % (v["sku"], v["title"]))

    # 1) fotos e bolinhas -> Supabase
    urls, cores_novas = {}, {}
    for c in CORES:
        p = fotos.get(c["slug"])
        if p:
            dest = "products/%s/%s-01-%s.jpg" % (HANDLE, c["slug"], hashlib.md5(open(p, "rb").read()).hexdigest()[:8])
            urls[c["slug"]] = st.upload(dest, foto_jpeg(p), "image/jpeg") if APPLY else st.publica(dest)
        sw = "cores/%s.png" % c["slug"]
        cores_novas[c["nome"]] = {"hex": c["a"], "swatch_url": st.upload(sw, bolinha_png(c["a"], c["b"]), "image/png") if APPLY else st.publica(sw)}
        print("cor %-18s foto: %s | bolinha %s + %s" % (c["nome"], os.path.basename(p) if p else "AUSENTE", c["a"], c["b"]))

    atuais = st.cores()
    novas = [n for n in cores_novas if n not in atuais]
    print("site_content.cores: %d cores hoje; entram %s" % (len(atuais), novas or "nenhuma (já existem)"))

    if not APPLY:
        print("\nSIMULAÇÃO: nada foi gravado."); return

    st.grava_cores(dict(atuais, **{n: cores_novas[n] for n in novas}))

    # 2) produto
    todas = [urls[c["slug"]] for c in CORES]
    if existente:
        pid = existente[0]["id"]; print("produto já existe (%s): confiro fotos e estoque" % pid)
    else:
        prod = api.post("/admin/products", {
            "title": TITULO, "handle": HANDLE, "status": "published", "description": descricao(),
            "weight": PESO_G, "metadata": {"composicao": COMPOSICAO, "informacoes": informacoes()},
            "options": [{"title": "Cor", "values": [c["nome"] for c in CORES]}, {"title": "Tamanho", "values": TAMANHOS}],
            "variants": variants, "categories": [{"id": cats[0]["id"]}],
            "sales_channels": [{"id": sc["id"]}], "shipping_profile_id": sp["id"],
            "images": [{"url": u} for u in todas], "thumbnail": todas[0],
        })["product"]
        pid = prod["id"]; print("produto criado: %s" % pid)

    # 3) foto <-> variantes da cor
    prod = api.get("/admin/products/%s?fields=id,*images,*variants,*variants.options,*variants.inventory_items" % pid)["product"]
    img = {i["url"]: i["id"] for i in prod["images"]}
    for c in CORES:
        ids = [v["id"] for v in prod["variants"] if any(o["value"] == c["nome"] for o in v["options"])]
        if urls[c["slug"]] in img:
            api.post("/admin/products/%s/images/%s/variants/batch" % (pid, img[urls[c["slug"]]]), {"add": ids})

    # 4) estoque (cria o nível; se já existe, acerta a quantidade)
    for v in prod["variants"]:
        for ii in v.get("inventory_items") or []:
            iid = ii["inventory_item_id"]
            try:
                api.post("/admin/inventory-items/%s/location-levels" % iid, {"location_id": sloc["id"], "stocked_quantity": ESTOQUE})
            except RuntimeError:
                api.post("/admin/inventory-items/%s/location-levels/%s" % (iid, sloc["id"]), {"stocked_quantity": ESTOQUE})
    print("estoque: %d pares por variante em \"%s\"\nlink: /br/products/%s" % (ESTOQUE, sloc["name"], HANDLE))

if __name__ == "__main__":
    main()
