"""
Semeia site_content.cores (nomes vindos do catálogo, hex vazio p/ preencher no Cockpit)
e site_content.medidas (tabelas padrão femininas) SEM sobrescrever o que já existe.
Padrão = simulação; grave com --apply.
Requisitos: pip install requests
Credenciais: apps/cockpit/.env.local -> MEDUSA_ADMIN_EMAIL/PASSWORD, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
"""
import json, os, sys

try:
    import requests
except ImportError:
    print("Rode antes: pip install requests"); sys.exit(1)

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.environ.get("MEDUSA_URL", "https://endearing-enthusiasm-production-775b.up.railway.app")
APPLY = "--apply" in sys.argv

TAB_CQ = {"columns": ["Cintura", "Quadril"], "rows": [["P", "62–68 cm", "88–94 cm"], ["M", "68–74 cm", "94–100 cm"], ["G", "74–80 cm", "100–106 cm"], ["GG", "80–88 cm", "106–114 cm"]]}
MEDIDAS_PADRAO = {
    "tops": {"columns": ["Busto", "Cintura"], "rows": [["P", "82–88 cm", "62–68 cm"], ["M", "88–94 cm", "68–74 cm"], ["G", "94–100 cm", "74–80 cm"], ["GG", "100–108 cm", "80–88 cm"]]},
    "shorts": TAB_CQ,
    "leggings": TAB_CQ,
    "macaquinhos": {"columns": ["Busto", "Cintura", "Quadril"], "rows": [["P", "82–88 cm", "62–68 cm", "88–94 cm"], ["M", "88–94 cm", "68–74 cm", "94–100 cm"], ["G", "94–100 cm", "74–80 cm", "100–106 cm"], ["GG", "100–108 cm", "80–88 cm", "106–114 cm"]]},
}

def env_cockpit():
    env = {}
    with open(os.path.join(RAIZ, "apps", "cockpit", ".env.local"), encoding="utf-8") as f:
        for line in f:
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1); env[k.strip()] = v.strip()
    return env

def sb_get(env, key):
    r = requests.get(env["NEXT_PUBLIC_SUPABASE_URL"] + "/rest/v1/site_content?key=eq." + key + "&select=value",
                     headers={"apikey": env["SUPABASE_SERVICE_ROLE_KEY"], "Authorization": "Bearer " + env["SUPABASE_SERVICE_ROLE_KEY"]}, timeout=30)
    r.raise_for_status()
    rows = r.json()
    return rows[0]["value"] if rows else {}

def sb_put(env, key, value):
    r = requests.post(env["NEXT_PUBLIC_SUPABASE_URL"] + "/rest/v1/site_content?on_conflict=key",
                      headers={"apikey": env["SUPABASE_SERVICE_ROLE_KEY"], "Authorization": "Bearer " + env["SUPABASE_SERVICE_ROLE_KEY"],
                               "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal"},
                      json={"key": key, "value": value}, timeout=30)
    assert r.ok, "gravar %s falhou: %s" % (key, r.text)

def cores_do_catalogo(env):
    r = requests.post(BASE + "/auth/user/emailpass", json={"email": env["MEDUSA_ADMIN_EMAIL"], "password": env["MEDUSA_ADMIN_PASSWORD"]}, timeout=30)
    assert r.ok, "login admin falhou"
    H = {"Authorization": "Bearer " + r.json()["token"]}
    r = requests.get(BASE + "/admin/products?limit=200&fields=options.title,options.values.value", headers=H, timeout=30)
    r.raise_for_status()
    cores = set()
    for p in r.json()["products"]:
        for o in p.get("options") or []:
            if (o.get("title") or "").strip().lower() == "cor":
                for v in o.get("values") or []:
                    if (v.get("value") or "").strip(): cores.add(v["value"].strip())
    return sorted(cores)

def main():
    env = env_cockpit()
    print("modo:", "APLICAR" if APPLY else "SIMULAÇÃO (use --apply para gravar)")

    cores = sb_get(env, "cores") or {}
    novas = [c for c in cores_do_catalogo(env) if c.lower() not in {k.lower() for k in cores}]
    for c in novas: cores[c] = {"hex": None, "swatch_url": None}
    print("cores: %d existentes, %d novas: %s" % (len(cores) - len(novas), len(novas), ", ".join(novas) or "-"))

    medidas = sb_get(env, "medidas") or {}
    faltam = [k for k in MEDIDAS_PADRAO if k not in medidas]
    for k in faltam: medidas[k] = MEDIDAS_PADRAO[k]
    print("medidas: chaves existentes %s; semeando %s" % (sorted(set(medidas) - set(faltam)) or "-", faltam or "-"))

    if APPLY:
        if novas: sb_put(env, "cores", cores)
        if faltam: sb_put(env, "medidas", medidas)
        print("gravado.")
    else:
        print(json.dumps({"cores": cores, "medidas": list(medidas)}, ensure_ascii=False, indent=1))

if __name__ == "__main__":
    main()
