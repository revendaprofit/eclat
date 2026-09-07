# -*- coding: utf-8 -*-
"""
Cria/ajusta a ÁRVORE FINAL de categorias da ÉCLAT no Medusa (spec 4.1).
Idempotente. Padrão = simulação; grave com:  python scripts/setup-categorias.py --apply
Requisitos: pip install requests
Credenciais: apps/cockpit/.env.local -> MEDUSA_ADMIN_EMAIL / MEDUSA_ADMIN_PASSWORD
Desativa (não apaga) as antigas raízes de modalidade treino/casual e as filhas de casual.
"""
import os, sys

try:
    import requests
except ImportError:
    print("Rode antes: pip install requests"); sys.exit(1)

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.environ.get("MEDUSA_URL", "https://endearing-enthusiasm-production-775b.up.railway.app")
APPLY = "--apply" in sys.argv

# (nome exibido, handle, handle da mãe ou None, rank)
ARVORE = [
    ("Top", "tops", None, 0),
    ("Short", "shorts", None, 1),
    ("Legging", "leggings", None, 2),
    ("Macaquinho / Macacão", "macaquinhos", None, 3),
    ("Conjuntos", "conjuntos", None, 4),
    ("Acessórios", "acessorios", None, 5),
    ("Óculos", "oculos", "acessorios", 0),
    ("Meias", "meias", "acessorios", 1),
    ("Masculino", "masculino", None, 6),
    ("Bermudas", "bermudas", "masculino", 0),
    ("Camisetas / Regatas", "camisetas-regatas", "masculino", 1),
]

# handles das antigas raízes de modalidade (treino/casual) e filhas de casual: DESATIVAR (nunca apagar)
DESATIVAR = ["treino", "casual", "blusas-cropped", "calcas", "casacos-jaquetas", "vestidos"]

def env_cockpit():
    env = {}
    p = os.path.join(RAIZ, "apps", "cockpit", ".env.local")
    with open(p, encoding="utf-8") as f:
        for line in f:
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env

def main():
    env = env_cockpit()
    email, senha = env.get("MEDUSA_ADMIN_EMAIL"), env.get("MEDUSA_ADMIN_PASSWORD")
    assert email and senha, "MEDUSA_ADMIN_EMAIL/PASSWORD ausentes no apps/cockpit/.env.local"
    r = requests.post(BASE + "/auth/user/emailpass", json={"email": email, "password": senha}, timeout=30)
    assert r.ok and r.json().get("token"), "login admin falhou (%s)" % r.status_code
    H = {"Authorization": "Bearer " + r.json()["token"]}

    r = requests.get(BASE + "/admin/product-categories?limit=200&fields=id,name,handle,rank,parent_category_id,is_active", headers=H, timeout=30)
    r.raise_for_status()
    existentes = {c["handle"]: c for c in r.json()["product_categories"]}
    print("categorias existentes:", ", ".join(sorted(existentes)) or "(nenhuma)")
    print("modo:", "APLICAR" if APPLY else "SIMULAÇÃO (use --apply para gravar)")

    for nome, handle, pai, rank in ARVORE:
        parent_id = existentes.get(pai, {}).get("id") if pai else None
        if pai and not parent_id:
            print("  !! mãe %s ainda não existe para %s" % (pai, handle)); continue
        atual = existentes.get(handle)
        if atual:
            mudancas = {}
            if atual["name"] != nome: mudancas["name"] = nome
            if (atual.get("rank") or 0) != rank: mudancas["rank"] = rank
            if (atual.get("parent_category_id") or None) != parent_id: mudancas["parent_category_id"] = parent_id
            if not mudancas:
                print("  = %-22s ok" % handle); continue
            print("  ~ %-22s atualizar %s" % (handle, mudancas))
            if APPLY:
                rr = requests.post(BASE + "/admin/product-categories/" + atual["id"], headers=H, json=mudancas, timeout=30)
                assert rr.ok, "falhou %s: %s" % (handle, rr.text)
        else:
            body = {"name": nome, "handle": handle, "is_active": True, "is_internal": False, "rank": rank, "parent_category_id": parent_id}
            print("  + %-22s criar (mãe=%s, rank=%s)" % (handle, pai, rank))
            if APPLY:
                rr = requests.post(BASE + "/admin/product-categories", headers=H, json=body, timeout=30)
                assert rr.ok, "falhou %s: %s" % (handle, rr.text)
                existentes[handle] = rr.json()["product_category"]

    for handle in DESATIVAR:
        atual = existentes.get(handle)
        if not atual:
            continue
        if atual.get("is_active", True):
            print("  ~ %-22s desativar" % handle)
            if APPLY:
                rr = requests.post(BASE + "/admin/product-categories/" + atual["id"], headers=H, json={"is_active": False}, timeout=30)
                assert rr.ok, "falhou %s: %s" % (handle, rr.text)
        else:
            print("  = %-22s inativo" % handle)
    print("pronto.")

if __name__ == "__main__":
    main()
