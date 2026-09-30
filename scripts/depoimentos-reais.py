# -*- coding: utf-8 -*-
"""
Depoimentos reais da home e da PDP (site_content "home.testimonials").

Falas copiadas dos prints enviados pelo dono em 2026-09-30, sem edição. As 4 clientes autorizaram o uso
(dono, 2026-09-30). Guarda o valor anterior em brand-assets/ antes de gravar.

Uso:
  python scripts/depoimentos-reais.py           # simulação
  python scripts/depoimentos-reais.py --apply   # grava em PRODUÇÃO (só com "pode aplicar")
Credenciais: apps/cockpit/.env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
"""
import io, os, sys, json, datetime, requests

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHAVE = "home.testimonials"

# Ordem = ordem na PDP (mostra as 3 primeiras): dor resolvida, reação ao receber, peça no corpo.
VALOR = {
    "heading": "O que elas dizem",
    "items": [
        {
            "quote": "Bom dia pra quem treinou hoje o dia inteiro sem ter que puxar short que não tava embolado de mim.",
            "author": "Cliente Lumière",
            "origem": "WhatsApp",
        },
        {"quote": "Chocada!!! Ficaram muuuuiiito bonitos! Só bençãos neste novo nível!", "author": "Amabile", "origem": "WhatsApp"},
        {"quote": "Amei viu! Super aprovado!", "author": "Pollianna", "origem": "Instagram"},
        {"quote": "Estão lindas tuas roupas 💗", "author": "Jamile", "origem": "Instagram"},
    ],
}


def env_local():
    env = {}
    for line in io.open(os.path.join(RAIZ, "apps", "cockpit", ".env.local"), encoding="utf-8").read().splitlines():
        if "=" in line and not line.startswith("#"):
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip().strip('"')
    return env


def main():
    apply = "--apply" in sys.argv
    env = env_local()
    url, chave = env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"]
    H = {"apikey": chave, "Authorization": "Bearer " + chave, "Content-Type": "application/json"}
    r = requests.get("%s/rest/v1/site_content?key=eq.%s&select=value" % (url, CHAVE), headers=H, timeout=30)
    r.raise_for_status()
    antes = (r.json() or [{}])[0].get("value") if r.json() else None
    print("ATUAL:", json.dumps(antes, ensure_ascii=False)[:400])
    print("NOVO :", json.dumps(VALOR, ensure_ascii=False))
    if not apply:
        print("\nNada gravado. Rode com --apply para gravar em produção.")
        return
    backup = os.path.join(os.path.dirname(RAIZ), "brand-assets", "backup-site-content-testimonials-%s.json" % datetime.date.today())
    with io.open(backup, "w", encoding="utf-8") as f:
        json.dump({"key": CHAVE, "value": antes}, f, ensure_ascii=False, indent=1)
    r = requests.post("%s/rest/v1/site_content?on_conflict=key" % url, headers={**H, "Prefer": "resolution=merge-duplicates,return=minimal"},
                      json={"key": CHAVE, "value": VALOR, "updated_at": datetime.datetime.utcnow().isoformat() + "Z"}, timeout=30)
    print("GRAVADO" if r.ok else "ERRO %s %s" % (r.status_code, r.text), "| backup:", backup)


if __name__ == "__main__":
    main()
