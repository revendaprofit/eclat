"""
Audita o catálogo contra a spec 4.2/4.5: opções Tamanho/Cor, tamanhos P/M/G/GG em vestuário,
cores fora do mapa (site_content.cores), fotos por cor ausentes. Só lê. Saída: relatório.
Requisitos: pip install requests · Credenciais: apps/cockpit/.env.local
"""
import os, sys, unicodedata

try:
    import requests
except ImportError:
    print("Rode antes: pip install requests"); sys.exit(1)

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.environ.get("MEDUSA_URL", "https://endearing-enthusiasm-production-775b.up.railway.app")
TAM = {"P", "M", "G", "GG"}

def norm(s):
    return "".join(c for c in unicodedata.normalize("NFD", s or "") if unicodedata.category(c) != "Mn").lower().strip()

def env_cockpit():
    env = {}
    with open(os.path.join(RAIZ, "apps", "cockpit", ".env.local"), encoding="utf-8") as f:
        for line in f:
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1); env[k.strip()] = v.strip()
    return env

def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    env = env_cockpit()
    r = requests.post(BASE + "/auth/user/emailpass", json={"email": env["MEDUSA_ADMIN_EMAIL"], "password": env["MEDUSA_ADMIN_PASSWORD"]}, timeout=30)
    assert r.ok, "login admin falhou"
    H = {"Authorization": "Bearer " + r.json()["token"]}

    sbh = {"apikey": env["SUPABASE_SERVICE_ROLE_KEY"], "Authorization": "Bearer " + env["SUPABASE_SERVICE_ROLE_KEY"]}
    rr = requests.get(env["NEXT_PUBLIC_SUPABASE_URL"] + "/rest/v1/site_content?key=eq.cores&select=value", headers=sbh, timeout=30)
    cores_mapa = {norm(k) for k in ((rr.json() or [{}])[0].get("value") or {})} if rr.ok and rr.json() else set()

    fields = "id,title,handle,status,categories.handle,categories.parent_category.handle,options.id,options.title,options.values.value,variants.id,variants.options.option_id,variants.options.value,variants.images.id"
    r = requests.get(BASE + "/admin/products?limit=200&fields=" + fields, headers=H, timeout=60)
    r.raise_for_status()
    problemas = 0
    for p in r.json()["products"]:
        if p.get("status") != "published": continue
        cats = []
        for c in p.get("categories") or []:
            h = c.get("handle") or ""
            pai = (c.get("parent_category") or {}).get("handle")
            cats.append((pai + "/" + h) if pai else h)
        acessorio = bool(cats) and all(c.split("/")[0] == "acessorios" for c in cats)
        opts = {norm(o["title"]): o for o in (p.get("options") or [])}
        erros = []
        if "cor" not in opts: erros.append("sem opção Cor")
        if not acessorio and "tamanho" not in opts: erros.append("vestuário sem opção Tamanho")
        for t in opts:
            if t not in ("cor", "tamanho"): erros.append("opção não permitida: %s" % opts[t]["title"])
        if not acessorio and "tamanho" in opts:
            ruins = [v["value"] for v in opts["tamanho"].get("values") or [] if v["value"] not in TAM]
            if ruins: erros.append("tamanhos fora do padrão: %s" % ", ".join(ruins))
        if "cor" in opts:
            fora = [v["value"] for v in opts["cor"].get("values") or [] if norm(v["value"]) not in cores_mapa]
            if fora: erros.append("cores fora do mapa: %s" % ", ".join(fora))
            cor_id = opts["cor"]["id"]
            sem_foto = set()
            for v in p.get("variants") or []:
                cor = next((o["value"] for o in v.get("options") or [] if o["option_id"] == cor_id), None)
                if cor and not (v.get("images") or []): sem_foto.add(cor)
            if sem_foto: erros.append("sem foto por cor: %s" % ", ".join(sorted(sem_foto)))
        if not cats: erros.append("sem categoria")
        if erros:
            problemas += 1
            print("✗ %s (%s) [%s]" % (p["title"], p["handle"], ", ".join(cats) or "-"))
            for e in erros: print("    - " + e)
        else:
            print("✓ %s" % p["title"])
    print("\n%d produto(s) com pendências." % problemas)
    sys.exit(1 if problemas else 0)

if __name__ == "__main__":
    main()
