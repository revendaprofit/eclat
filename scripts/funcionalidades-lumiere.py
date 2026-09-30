# -*- coding: utf-8 -*-
"""
"Funcionalidades" da PDP da coleção Lumière (metadata.funcionalidades) — referência beatco.com.br, 2026-09-30.

Lista curta "nome do benefício: explicação" que a vitrine mostra abaixo da descrição
(apps/storefront/src/lib/util/funcionalidades.ts). Cada item repete um FATO que já está publicado
em metadata.informacoes / composicao / description do próprio produto (nada novo é prometido).
Silicone na barra: todos os shorts e o Solaris; tops NÃO têm (dono, 2026-09-30).

Uso:
  python scripts/funcionalidades-lumiere.py           # simulação: mostra o que gravaria
  python scripts/funcionalidades-lumiere.py --apply   # grava em PRODUÇÃO (só com "pode aplicar" do dono)
Reverter: rodar com --remover --apply (tira só a chave funcionalidades; o resto da metadata fica).

Requisitos: pip install requests · Credenciais: apps/cockpit/.env.local (MEDUSA_ADMIN_EMAIL/PASSWORD).
"""
import io, os, sys, json, requests

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.environ.get("MEDUSA_URL", "https://endearing-enthusiasm-production-775b.up.railway.app")

CANELADO = {"titulo": "Canelado de 385 g/m²", "texto": "79% poliamida, de alta compressão: envolve o corpo sem apertar."}
OPACO = {"titulo": "Transparência zero", "texto": "Fundo preto no tecido, em qualquer movimento."}
FLATLOCK = {"titulo": "Costura flatlock", "texto": "Não marca e não gera volume."}
SILICONE = {"titulo": "Silicone na barra", "texto": "Forte aderência ao corpo: não sobe durante o treino."}
DRYFIT = {"titulo": "Forro dry fit", "texto": "Toque macio, geladinho e respirável."}
BOJOS = {"titulo": "Bojos costurados no eixo", "texto": "Ficam sempre no lugar."}

FUNCIONALIDADES = {
    "top-aurora": [
        {"titulo": "Zíper frontal", "texto": "Você escolhe até onde abre: mais fechado no treino, mais aberto depois."},
        {"titulo": "Costas abertas", "texto": "Decote arredondado nas costas, assinatura da Éclat."},
        DRYFIT, BOJOS, CANELADO, OPACO,
    ],
    "top-orvalho": [
        {"titulo": "Reguladores nas alças", "texto": "Ajuste o top ao seu trapézio, na altura exata do seu corpo."},
        {"titulo": "Costas em tiras", "texto": "Detalhe vazado com respiro, assinatura da Éclat."},
        DRYFIT, BOJOS, CANELADO, OPACO,
    ],
    "short-aurora": [
        SILICONE,
        {"titulo": "Cós alto", "texto": "Abraça a cintura com firmeza, em faixa mais estreita."},
        {"titulo": "Sem costura no bumbum", "texto": "Desenho limpo e minimalista."},
        CANELADO, OPACO, FLATLOCK,
    ],
    "short-orvalho": [
        SILICONE,
        {"titulo": "Cós mais alto", "texto": "Segurança em todo movimento, do agachamento à corrida."},
        {"titulo": "Costura que valoriza o bumbum", "texto": "Desenhada para quem repara nos detalhes."},
        CANELADO, OPACO, FLATLOCK,
    ],
    "macaquinho-solaris": [
        {"titulo": "Alças cruzadas nas costas", "texto": "Alças medianas de grande sustentação."},
        {"titulo": "Costura na cintura", "texto": "Modela a silhueta e marca a cintura."},
        SILICONE, DRYFIT, BOJOS, CANELADO,
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
    remover = "--remover" in sys.argv
    env = env_local()
    r = requests.post(BASE + "/auth/user/emailpass",
                      json={"email": env["MEDUSA_ADMIN_EMAIL"], "password": env["MEDUSA_ADMIN_PASSWORD"]}, timeout=30)
    assert r.ok and r.json().get("token"), "login admin falhou (%s)" % r.status_code
    H = {"Authorization": "Bearer " + r.json()["token"]}

    for handle, itens in FUNCIONALIDADES.items():
        r = requests.get(BASE + "/admin/products?handle=" + handle + "&fields=id,title,metadata", headers=H, timeout=30)
        prods = r.json().get("products", [])
        if not prods:
            print("NAO ACHOU:", handle)
            continue
        p = prods[0]
        novo = dict(p.get("metadata") or {})  # preserva o resto da metadata (videos, faq, informacoes...)
        if remover:
            novo.pop("funcionalidades", None)
        else:
            novo["funcionalidades"] = json.dumps(itens, ensure_ascii=False)
        if apply:
            r = requests.post(BASE + "/admin/products/" + p["id"], headers=H, json={"metadata": novo}, timeout=60)
            print("GRAVADO" if r.ok else "ERRO %s" % r.status_code, handle, "(removido)" if remover else "(%d itens)" % len(itens))
        else:
            print("[simulação]", handle, "(%s)" % p["title"])
            for f in ([] if remover else itens):
                print("    - %s: %s" % (f["titulo"], f["texto"]))
    if not apply:
        print("\nNada gravado. Rode com --apply para gravar em produção.")


if __name__ == "__main__":
    main()
