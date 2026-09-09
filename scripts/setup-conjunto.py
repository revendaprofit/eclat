# -*- coding: utf-8 -*-
"""
Seed/reconciliação de produção do Benefício Conjunto no Medusa (spec 2, F1 — Task 8).
Idempotente. Padrão = simulação; grave com: python scripts/setup-conjunto.py --apply
Requisitos: pip install requests
Credenciais: apps/cockpit/.env.local -> MEDUSA_ADMIN_EMAIL / MEDUSA_ADMIN_PASSWORD
Aceita --base http://localhost:9000 para rodar contra `medusa develop` local (senão usa
MEDUSA_URL do ambiente, senão o backend de produção no Railway).

Ações (spec §4.4, §4.2, §6.2, §6.4):
  1) GET /admin/conjuntos/regras — se não houver regra `padrao`, cria
     { nome: "Padrão da marca", escopo: "padrao", tipo_desconto: "total_percentual",
       valor: 10, ativa: false } (o dono ativa depois, no Cockpit ou via PUT).
  2) GET/PUT /admin/conjuntos/pares — garante (leggings, tops) e (shorts, tops) ativos,
     preservando qualquer outro par já cadastrado (PUT substitui a lista inteira — o corpo
     enviado sempre inclui os pares existentes intactos).
  3) POST /admin/conjuntos/reconciliar — recria/atualiza a promoção automática de cada
     regra e converte cupons pré-existentes (pedido → itens + regra de exclusão). Imprime
     as contagens { regras, cupons }.
  4) GET /admin/promotions — lista (melhor esforço; não bloqueia o script se falhar) os
     cupons não-CONJUNTO-* que já têm target_type "items" e a regra de exclusão
     `items.conjunto_desconto eq nenhum`, ou seja, já convertidos.
"""
import os, sys

try:
    import requests
except ImportError:
    print("Rode antes: pip install requests"); sys.exit(1)

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.environ.get("MEDUSA_URL", "https://endearing-enthusiasm-production-775b.up.railway.app")
for _i, _arg in enumerate(sys.argv):
    if _arg == "--base" and _i + 1 < len(sys.argv):
        BASE = sys.argv[_i + 1]
APPLY = "--apply" in sys.argv

# Já em ordem alfabética (categoria_a < categoria_b), como o backend normaliza (spec §4.2).
PARES_SEED = [("leggings", "tops"), ("shorts", "tops")]


def env_cockpit():
    env = {}
    p = os.path.join(RAIZ, "apps", "cockpit", ".env.local")
    with open(p, encoding="utf-8") as f:
        for line in f:
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


def login():
    env = env_cockpit()
    email, senha = env.get("MEDUSA_ADMIN_EMAIL"), env.get("MEDUSA_ADMIN_PASSWORD")
    assert email and senha, "MEDUSA_ADMIN_EMAIL/PASSWORD ausentes no apps/cockpit/.env.local"
    r = requests.post(BASE + "/auth/user/emailpass", json={"email": email, "password": senha}, timeout=30)
    assert r.ok and r.json().get("token"), "login admin falhou (%s)" % r.status_code
    return {"Authorization": "Bearer " + r.json()["token"]}


def chave_par(a, b):
    x, y = sorted((a, b))
    return "%s::%s" % (x, y)


def passo_regra_padrao(H):
    print("\n1) regra padrão")
    r = requests.get(BASE + "/admin/conjuntos/regras", headers=H, timeout=30)
    r.raise_for_status()
    regras = r.json()["regras"]
    padrao = next((x for x in regras if x["escopo"] == "padrao"), None)
    if padrao:
        print("  = já existe (%s, ativa=%s) — nada a fazer" % (padrao["id"], padrao["ativa"]))
        return
    body = {"nome": "Padrão da marca", "escopo": "padrao", "tipo_desconto": "total_percentual", "valor": 10, "ativa": False}
    print("  + criar regra padrão:", body)
    if APPLY:
        rr = requests.post(BASE + "/admin/conjuntos/regras", headers=H, json=body, timeout=30)
        assert rr.ok, "falhou criar regra padrão: %s" % rr.text
        print("  criada:", rr.json()["regra"]["id"])


def passo_pares(H):
    print("\n2) pares leggings+tops, shorts+tops")
    r = requests.get(BASE + "/admin/conjuntos/pares", headers=H, timeout=30)
    r.raise_for_status()
    existentes = r.json()["pares"]
    por_chave = {chave_par(p["categoria_a"], p["categoria_b"]): p for p in existentes}
    print("  pares existentes:", ", ".join(sorted(por_chave)) or "(nenhum)")

    corpo = [{"categoria_a": p["categoria_a"], "categoria_b": p["categoria_b"], "ativo": p["ativo"]} for p in existentes]
    faltando = []
    for a, b in PARES_SEED:
        k = chave_par(a, b)
        if k in por_chave:
            continue
        ca, cb = sorted((a, b))
        corpo.append({"categoria_a": ca, "categoria_b": cb, "ativo": True})
        faltando.append(k)

    if not faltando:
        print("  = já cadastrados — nada a fazer")
        return
    print("  + adicionar:", ", ".join(faltando), "(preservando os %d par(es) existente(s))" % len(existentes))
    if APPLY:
        rr = requests.put(BASE + "/admin/conjuntos/pares", headers=H, json={"pares": corpo}, timeout=30)
        assert rr.ok, "falhou PUT pares: %s" % rr.text
        print("  pares agora:", len(rr.json()["pares"]))


def passo_reconciliar(H):
    print("\n3) reconciliar (promoções das regras + conversão de cupons antigos)")
    if not APPLY:
        print("  (simulação — rode com --apply para chamar POST /admin/conjuntos/reconciliar)")
        return
    rr = requests.post(BASE + "/admin/conjuntos/reconciliar", headers=H, json={}, timeout=60)
    assert rr.ok, "falhou reconciliar: %s" % rr.text
    resultado = rr.json()
    print("  regras sincronizadas:", resultado.get("regras"))
    print("  cupons convertidos:", resultado.get("cupons"))


def passo_listar_cupons_convertidos(H):
    print("\n4) cupons já convertidos (leitura, melhor esforço)")
    try:
        campos = "id,code,application_method.target_type,application_method.target_rules.attribute,application_method.target_rules.values.value"
        r = requests.get(BASE + "/admin/promotions", headers=H, params={"limit": 100, "fields": campos}, timeout=30)
        r.raise_for_status()
        promos = r.json().get("promotions", [])
    except Exception as e:
        print("  (não foi possível listar promoções:", e, ")")
        return

    convertidos = []
    for p in promos:
        code = p.get("code") or ""
        if code.startswith("CONJUNTO-"):
            continue
        am = p.get("application_method") or {}
        if am.get("target_type") != "items":
            continue
        regras_alvo = am.get("target_rules") or []
        tem_exclusao = any(
            (rg.get("attribute") == "items.conjunto_desconto")
            and any((v.get("value") if isinstance(v, dict) else v) == "nenhum" for v in (rg.get("values") or []))
            for rg in regras_alvo
        )
        if tem_exclusao:
            convertidos.append(code or p.get("id"))
    print("  %d de %d promoção(ões) não-CONJUNTO já convertida(s):" % (len(convertidos), len(promos)), ", ".join(convertidos) or "(nenhuma)")


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    print("base:", BASE)
    print("modo:", "APLICAR" if APPLY else "SIMULAÇÃO (use --apply para gravar)")
    H = login()
    passo_regra_padrao(H)
    passo_pares(H)
    passo_reconciliar(H)
    passo_listar_cupons_convertidos(H)
    print("\npronto.")


if __name__ == "__main__":
    main()
