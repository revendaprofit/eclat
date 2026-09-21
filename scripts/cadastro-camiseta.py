# -*- coding: utf-8 -*-
"""
Cadastra a "Camiseta Raglan Dry" (categoria Masculino > Camisetas / Regatas) no Medusa de produção:
fotos -> Supabase Storage, produto com variantes Cor x Tamanho, preço BRL, fotos ligadas às variantes de
cada cor e estoque no CD Brasil. A aba "Masculino" aparece sozinha no menu quando a categoria ganha
produto (apps/storefront/src/lib/util/navigation.ts: a raiz só entra com hasProducts).

Padrão = SIMULAÇÃO (não grava nada). Grava só com:  python scripts/cadastro-camiseta.py --apply
Idempotente: se o produto já existe (por handle), só confere as fotos; NÃO regrava estoque.

Requisitos: pip install requests pillow
Credenciais: apps/cockpit/.env.local
Fotos: <raiz>/brand-assets/camiseta-raglan-dry/<cor>-NN.jpg (NN = ordem na galeria), convertidas do HEIC
do celular, INTEIRAS (regra da sócia: sem recorte de cabeça, peça, logo nem fundo). São 3:4; o card da
vitrine (9:16) mostra ~75% da largura e a PDP (2:3) ~89%, então a 1ª foto de cada cor é a de frente.
"""
import glob, hashlib, io, os, sys

try:
    import requests
    from PIL import Image
except ImportError:
    print("Rode antes: pip install requests pillow"); sys.exit(1)

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))          # .../eclat
PROJ = os.path.dirname(RAIZ)                                                 # raiz do projeto
FOTOS = os.path.join(PROJ, "brand-assets", "camiseta-raglan-dry")
BASE = os.environ.get("MEDUSA_URL", "https://endearing-enthusiasm-production-775b.up.railway.app")
APPLY = "--apply" in sys.argv
LADO_MAX = 2000
JPEG_Q = 88

HANDLE = "camiseta-raglan-dry"
TITULO = "Camiseta Raglan Dry"          # nome da planilha de custos e dos vídeos de marketing
CATEGORIA = "camisetas-regatas"         # filha de "masculino"
PRECO = 129.00                          # reais cheios (Medusa v2) — sócia, 2026-09-21
TAMANHOS = ["P", "M", "G"]              # a ficha técnica prevê GG, mas a produção foi 0 GG
ESTOQUE = {"P": 10, "M": 10, "G": 10}   # por cor — aba "Camiseta Raglan Dry" de CUSTO POR PEÇA - LUMIÈRE.xlsx (30 por cor)
COMPOSICAO = "Malha Micro Ar: 91% poliamida, 9% elastano (152 g/m²)."   # ficha técnica CAMISETA DRY (Verão 26)
PESO_G = 160                            # ESTIMATIVA pelo tecido: pesar a peça embalada e corrigir no Cockpit (entra na cotação do frete)

# Cores já existem em site_content.cores (mesmas bolinhas da Lumière). `ref` = REF do SKU: continua a
# sequência ECL-1001..1010 da Lumière. A etiqueta Zebra da camiseta ainda não foi comprada (planilha de
# custos): se a etiqueta física sair com outra REF, acertar o SKU no Cockpit ANTES da primeira venda.
CORES = [
    {"nome": "Telha", "slug": "telha", "ref": 1011},          # a planilha chama de "Mousse" (nome da malha); no site é Telha (sócia)
    {"nome": "Grafitti", "slug": "grafitti", "ref": 1012},
]


def descricao():
    return (
        "Camiseta masculina de manga raglan em malha Micro Ar, leve. Recortes laterais e gola com pesponto, "
        "ÉCLAT aplicado no peito e monograma nas costas."
    )


def informacoes():
    """Aba "Informações do produto" da PDP (metadata.informacoes; parágrafos separados por linha em branco)."""
    return "Composição: %s\n\nModelagem masculina, manga raglan. Tamanhos: %s." % (COMPOSICAO, ", ".join(TAMANHOS))


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
    """Foto inteira (sem recorte), só redimensionada e recomprimida."""
    im = Image.open(caminho).convert("RGB")
    im.thumbnail((LADO_MAX, LADO_MAX))
    buf = io.BytesIO(); im.save(buf, "JPEG", quality=JPEG_Q, optimize=True, progressive=True)
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
        r = requests.post(self.url + "/storage/v1/object/site/" + dest, headers=dict(self.H, **{"Content-Type": mime, "x-upsert": "true"}), data=data, timeout=180)
        if not r.ok: raise RuntimeError("upload %s -> %s %s" % (dest, r.status_code, r.text[:300]))
        return self.publica(dest)


def main():
    if hasattr(sys.stdout, "reconfigure"): sys.stdout.reconfigure(encoding="utf-8")
    print("backend: %s\nmodo: %s" % (BASE, "APLICAR" if APPLY else "SIMULAÇÃO (use --apply para gravar)"))
    fotos = {c["slug"]: sorted(glob.glob(os.path.join(FOTOS, "%s-*.jpg" % c["slug"]))) for c in CORES}
    faltam = [c["nome"] for c in CORES if not fotos[c["slug"]]]
    if faltam:
        print("PENDÊNCIA: sem foto para %s em %s" % (faltam, FOTOS)); sys.exit(1)

    env = env_cockpit(); api = Medusa(env); st = Storage(env)
    cats = api.get("/admin/product-categories?handle=%s&fields=id,name,handle,is_active" % CATEGORIA)["product_categories"]
    assert cats, "categoria %s não existe — rode scripts/setup-categorias.py" % CATEGORIA
    sc = api.get("/admin/sales-channels")["sales_channels"][0]
    sp = api.get("/admin/shipping-profiles")["shipping_profiles"][0]
    sloc = api.get("/admin/stock-locations")["stock_locations"][0]
    existente = api.get("/admin/products?handle=%s&fields=id,status" % HANDLE)["products"]

    variants = [{
        "title": "%s / %s" % (t, c["nome"]),
        "sku": "ECL-%d-%s" % (c["ref"], t), "barcode": "ECL-%d-%s" % (c["ref"], t),
        "options": {"Tamanho": t, "Cor": c["nome"]},
        "manage_inventory": True, "allow_backorder": False,
        "weight": PESO_G,   # o frete da SuperFrete lê variant.weight e só depois o peso do produto
        "prices": [{"amount": PRECO, "currency_code": "brl"}],
    } for c in CORES for t in TAMANHOS]

    print("\nproduto: \"%s\" /%s | R$ %.2f | categoria %s (%s) | canal %s | estoque em \"%s\"" % (
        TITULO, HANDLE, PRECO, cats[0]["name"], "ativa" if cats[0].get("is_active") else "INATIVA", sc["name"], sloc["name"]))
    print("já existe em produção: %s" % ("sim (%s, %s)" % (existente[0]["id"], existente[0]["status"]) if existente else "não"))
    print("descrição: %s" % descricao())
    print("aba Informações do produto: %s | peso %s g" % (informacoes().replace("\n\n", " | "), PESO_G))
    print("variantes (%d), %d peças no total:" % (len(variants), sum(ESTOQUE.values()) * len(CORES)))
    for v in variants: print("  %-12s %-14s estoque %d" % (v["sku"], v["title"], ESTOQUE[v["options"]["Tamanho"]]))

    # 1) fotos -> Supabase (sufixo = hash do arquivo: trocar a foto gera URL nova, sem cache velho)
    urls = {}
    for c in CORES:
        urls[c["slug"]] = []
        for i, p in enumerate(fotos[c["slug"]], 1):
            dest = "products/%s/%s-%02d-%s.jpg" % (HANDLE, c["slug"], i, hashlib.md5(open(p, "rb").read()).hexdigest()[:8])
            urls[c["slug"]].append(st.upload(dest, foto_jpeg(p), "image/jpeg") if APPLY else st.publica(dest))
        print("cor %-9s %d foto(s): %s" % (c["nome"], len(fotos[c["slug"]]), ", ".join(os.path.basename(p) for p in fotos[c["slug"]])))

    if not APPLY:
        print("\nSIMULAÇÃO: nada foi gravado."); return

    # 2) produto
    todas = [u for c in CORES for u in urls[c["slug"]]]
    if existente:
        pid = existente[0]["id"]; print("produto já existe (%s): confiro as fotos" % pid)
        atuais_img = [i["url"] for i in api.get("/admin/products/%s?fields=id,images.url" % pid)["product"]["images"]]
        if atuais_img != todas:
            api.post("/admin/products/%s" % pid, {"images": [{"url": u} for u in todas], "thumbnail": todas[0]})   # o Medusa substitui a lista inteira
            print("fotos trocadas: %d -> %d" % (len(atuais_img), len(todas)))
    else:
        prod = api.post("/admin/products", {
            "title": TITULO, "handle": HANDLE, "status": "published", "description": descricao(),
            "weight": PESO_G, "metadata": {"composicao": COMPOSICAO, "informacoes": informacoes()},
            "options": [{"title": "Tamanho", "values": TAMANHOS}, {"title": "Cor", "values": [c["nome"] for c in CORES]}],
            "variants": variants, "categories": [{"id": cats[0]["id"]}],
            "sales_channels": [{"id": sc["id"]}], "shipping_profile_id": sp["id"],
            "images": [{"url": u} for u in todas], "thumbnail": todas[0],
        })["product"]
        pid = prod["id"]; print("produto criado: %s" % pid)

    # 3) fotos <-> variantes da cor
    prod = api.get("/admin/products/%s?fields=id,*images,*variants,*variants.options,*variants.inventory_items" % pid)["product"]
    img = {i["url"]: i["id"] for i in prod["images"]}
    for c in CORES:
        ids = [v["id"] for v in prod["variants"] if any(o["value"] == c["nome"] for o in v["options"])]
        for u in urls[c["slug"]]:
            if u in img: api.post("/admin/products/%s/images/%s/variants/batch" % (pid, img[u]), {"add": ids})

    # 4) estoque: só na criação (num produto que já estava no ar, regravar apagaria as vendas do estoque)
    if not existente:
        for v in prod["variants"]:
            qtd = ESTOQUE[v["sku"].rsplit("-", 1)[-1]]
            for ii in v.get("inventory_items") or []:
                iid = ii["inventory_item_id"]
                try:
                    api.post("/admin/inventory-items/%s/location-levels" % iid, {"location_id": sloc["id"], "stocked_quantity": qtd})
                except RuntimeError:
                    api.post("/admin/inventory-items/%s/location-levels/%s" % (iid, sloc["id"]), {"stocked_quantity": qtd})
        print("estoque lançado em \"%s\": %s por cor" % (sloc["name"], ESTOQUE))
    print("link: /br/products/%s" % HANDLE)


if __name__ == "__main__":
    main()
