# -*- coding: utf-8 -*-
"""
Liga o presente por faixa (desenho: docs/superpowers/specs/2026-09-30-brindes-por-faixa-design.md).

O que grava (backup do valor anterior em brand-assets/ antes):
  1. site_content "brindes"      → faixa da meia (R$ 250, 30 reservadas). Com --com-oculos, também a do óculos
                                   (R$ 550, 15 reservados) — só se o produto `oculos-eclat` existir e estiver publicado.
  2. site_content "boas_vindas"  → { ativa: true, modo: "presente" } (aviso sem cupom; a barra do topo tira o BEMVINDA10).
  3. produto_custo               → custo da meia (e do óculos) por variante, para o DRE contar o presente.
     Os valores de custo NÃO ficam neste arquivo (repositório público): passe --custo-meia e --custo-oculos em centavos.
O código BEMVINDA10 continua valendo para quem já recebeu; desligue depois com --desligar-bemvinda (7 dias).

Uso:
  python scripts/ativar-brindes.py --custo-meia 2000                          # simulação
  python scripts/ativar-brindes.py --custo-meia 2000 --apply                  # PRODUÇÃO (só com "pode aplicar")
  python scripts/ativar-brindes.py --com-oculos --custo-meia 2000 --custo-oculos 8500 --apply
  python scripts/ativar-brindes.py --desligar-bemvinda --apply                # BEMVINDA10 deixa de valer
  python scripts/ativar-brindes.py --desligar --apply                         # tira o presente do ar (brindes.ativo=false)
Credenciais: apps/cockpit/.env.local (ou ECLAT_ENV_FILE): Supabase service role + MEDUSA_ADMIN_*.
"""
import io, os, sys, json, datetime, requests

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.environ.get("MEDUSA_URL", "https://endearing-enthusiasm-production-775b.up.railway.app")
APPLY = "--apply" in sys.argv
INICIO = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat()  # conta o estoque reservado a partir de agora
FAIXA_MEIA = {"id": "meia", "minimo_centavos": 25000, "product_handle": "meia-cano-medio", "limite": 30}
FAIXA_OCULOS = {"id": "oculos", "minimo_centavos": 55000, "product_handle": "oculos-eclat", "limite": 15}
CUPOM_ANTIGO = "BEMVINDA10"


def arg(nome):
    return sys.argv[sys.argv.index(nome) + 1] if nome in sys.argv else None


def env_cockpit():
    env = {}
    caminho = os.environ.get("ECLAT_ENV_FILE") or os.path.join(RAIZ, "apps", "cockpit", ".env.local")
    for line in io.open(caminho, encoding="utf-8"):
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"')
    return env


class Supa:
    def __init__(self, env):
        self.url = env["NEXT_PUBLIC_SUPABASE_URL"]
        k = env["SUPABASE_SERVICE_ROLE_KEY"]
        self.H = {"apikey": k, "Authorization": "Bearer " + k, "Content-Type": "application/json"}

    def ler(self, chave):
        r = requests.get("%s/rest/v1/site_content?key=eq.%s&select=value" % (self.url, chave), headers=self.H, timeout=30)
        r.raise_for_status()
        return r.json()[0]["value"] if r.json() else None

    def gravar(self, chave, valor):
        antes = self.ler(chave)
        backup = os.path.join(os.path.dirname(RAIZ), "brand-assets", "backup-site-content-%s-%s.json" % (chave.replace(".", "-"), datetime.date.today()))
        with io.open(backup, "w", encoding="utf-8") as f:
            json.dump({"key": chave, "value": antes}, f, ensure_ascii=False, indent=1)
        r = requests.post("%s/rest/v1/site_content?on_conflict=key" % self.url,
                          headers=dict(self.H, Prefer="resolution=merge-duplicates,return=minimal"),
                          json={"key": chave, "value": valor, "updated_at": datetime.datetime.utcnow().isoformat() + "Z"}, timeout=30)
        if not r.ok:
            raise RuntimeError("site_content %s -> %s %s" % (chave, r.status_code, r.text[:300]))
        print("  gravado %s (backup: %s)" % (chave, backup))

    def custo(self, variant_id, sku, centavos):
        r = requests.post("%s/rest/v1/produto_custo?on_conflict=medusa_variant_id" % self.url,
                          headers=dict(self.H, Prefer="resolution=merge-duplicates,return=minimal"),
                          json={"medusa_variant_id": variant_id, "sku": sku, "custo_centavos": centavos}, timeout=30)
        if not r.ok:
            raise RuntimeError("produto_custo %s -> %s %s" % (sku, r.status_code, r.text[:300]))


class Medusa:
    def __init__(self, env):
        r = requests.post(BASE + "/auth/user/emailpass", json={"email": env["MEDUSA_ADMIN_EMAIL"], "password": env["MEDUSA_ADMIN_PASSWORD"]}, timeout=30)
        assert r.ok, "login admin falhou: %s" % r.text[:200]
        self.H = {"Authorization": "Bearer " + r.json()["token"]}

    def get(self, path):
        r = requests.get(BASE + path, headers=self.H, timeout=60)
        r.raise_for_status()
        return r.json()

    def post(self, path, body):
        r = requests.post(BASE + path, headers=self.H, json=body, timeout=60)
        if not r.ok:
            raise RuntimeError("POST %s -> %s %s" % (path, r.status_code, r.text[:300]))
        return r.json()

    def produto(self, handle):
        ps = self.get("/admin/products?handle=%s&fields=id,handle,status,*variants" % handle)["products"]
        return ps[0] if ps else None


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    print("modo: %s\n" % ("APLICAR" if APPLY else "SIMULAÇÃO (use --apply para gravar)"))
    env = env_cockpit()
    supa, medusa = Supa(env), Medusa(env)

    if "--desligar" in sys.argv:
        atual = supa.ler("brindes") or {}
        print("brindes: ativo=false (faixas mantidas)")
        if APPLY:
            supa.gravar("brindes", dict(atual, ativo=False))
        return

    if "--desligar-bemvinda" in sys.argv:
        promos = medusa.get("/admin/promotions?code=%s&fields=id,code,status" % CUPOM_ANTIGO)["promotions"]
        if not promos:
            print("%s não existe." % CUPOM_ANTIGO)
            return
        p = promos[0]
        print("%s (%s): status %s -> inactive" % (p["code"], p["id"], p.get("status")))
        if APPLY:
            medusa.post("/admin/promotions/%s" % p["id"], {"status": "inactive"})
            print("  desligado")
        return

    custo_meia = arg("--custo-meia")
    custo_oculos = arg("--custo-oculos")
    faixas = [FAIXA_MEIA]
    meia = medusa.produto(FAIXA_MEIA["product_handle"])
    assert meia and meia["status"] == "published", "meia-cano-medio não está publicada"
    oculos = None
    if "--com-oculos" in sys.argv:
        oculos = medusa.produto(FAIXA_OCULOS["product_handle"])
        assert oculos and oculos["status"] == "published", "oculos-eclat não existe ou não está publicado: cadastre antes"
        faixas.append(FAIXA_OCULOS)

    brindes = {"ativo": True, "inicio": INICIO, "faixas": faixas}
    print("brindes     :", json.dumps(brindes, ensure_ascii=False))
    print("boas_vindas : antes %s -> depois %s" % (json.dumps(supa.ler("boas_vindas"), ensure_ascii=False), '{"ativa": true, "modo": "presente"}'))
    custos = []
    if custo_meia:
        custos += [(v["id"], v.get("sku"), int(custo_meia)) for v in meia["variants"]]
    if oculos and custo_oculos:
        custos += [(v["id"], v.get("sku"), int(custo_oculos)) for v in oculos["variants"]]
    print("produto_custo: %d variantes%s" % (len(custos), "" if custos else " (sem --custo-meia/--custo-oculos: nada)"))

    if not APPLY:
        print("\nNada gravado.")
        return
    supa.gravar("brindes", brindes)
    supa.gravar("boas_vindas", {"ativa": True, "modo": "presente"})
    for vid, sku, c in custos:
        supa.custo(vid, sku, c)
    print("  custos gravados: %d" % len(custos))


if __name__ == "__main__":
    main()
