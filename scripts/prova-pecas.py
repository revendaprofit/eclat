# -*- coding: utf-8 -*-
"""
Faixa de prova logo abaixo do nome (componente prova-do-produto) nas outras peças (sócia, 2026-10-27, pacote "site que
vende"). Mesmo formato do Short Orvalho (scripts/prova-short-orvalho.py): a promessa da peça e uma fala REAL de quem
comprou ou veste, com nome e sem sobrenome (fontes em contexto-claude/diario/pessoas.md e nos prints do site).

Uso:
  python -B scripts/prova-pecas.py           # simulação
  python -B scripts/prova-pecas.py --apply   # grava em PRODUÇÃO (só com "pode aplicar"); backup antes
"""
import datetime, io, json, os, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJ = os.path.dirname(RAIZ)
sys.path.insert(0, os.path.join(RAIZ, "scripts"))
import importlib
fd = importlib.import_module("fotos-detalhe")   # env, Medusa

APPLY = "--apply" in sys.argv

PROVAS = {
    "macaquinho-solaris": {
        "titulo": "Fica no lugar, até nos pulos",
        "texto": "Todo forrado e com silicone na barra da perna: não sobe e não enrola no treino.",
        "frase": "Muito confortável. Testei os pulos de Cross. Tudo certo. Amei pq ele é todo forrado.",
        "autora": "Melka, cliente Éclat",
    },
    "top-orvalho": {
        "titulo": "Sustenta de verdade",
        "texto": "Tronco forrado, bojo removível e tiras que se ajustam às costas.",
        "frase": "Todo top eu preciso colocar bojo, esse aqui não precisa.",
        "autora": "Andrea, cliente Éclat",
    },
    "top-aurora": {
        "titulo": "Do treino para a rua",
        "texto": "Canelado que não transparece, forro dry e bojo removível.",
        "frase": "O conjunto Aurora sem dúvida. Vou usar muito, sem contar que vou usar o top para sair.",
        "autora": "Luana, cliente Éclat",
    },
    "short-aurora": {
        "titulo": "Não sobe no treino",
        "texto": "Silicone na barra da perna segura o short no lugar: no agachamento, na corrida e no salto.",
        "frase": "O conjunto Aurora sem dúvida. Vou usar muito.",
        "autora": "Luana, cliente Éclat",
    },
    "camiseta-raglan-dry": {
        "titulo": "Confortável até no treino abafado",
        "texto": "Malha dry, leve e macia, que acompanha o movimento.",
        "frase": "Treinei num dia abafado, transpirei… fiquei super confortável. Marca de suor não ficou.",
        "autora": "Gabriel, treina de Éclat",
    },
}

def main():
    if hasattr(sys.stdout, "reconfigure"): sys.stdout.reconfigure(encoding="utf-8")
    e = fd.env(); api = fd.Medusa(e)
    produtos = {p["handle"]: p for p in api.get("/admin/products?limit=200&fields=id,handle,metadata")["products"]}
    for h, prova in PROVAS.items(): print("%-20s %s — \"%s\" (%s)" % (h, prova["titulo"], prova["frase"][:50], prova["autora"]))
    faltando = [h for h in PROVAS if h not in produtos]
    if faltando: raise SystemExit("produto não encontrado: %s" % faltando)
    if not APPLY: print("modo: SIMULAÇÃO (use --apply)"); return
    bk = os.path.join(PROJ, "brand-assets", "backup-prova-pecas-%s.json" % datetime.datetime.now().strftime("%Y-%m-%d-%H%M"))
    with io.open(bk, "w", encoding="utf-8") as f:
        json.dump({h: (produtos[h].get("metadata") or {}).get("prova") for h in PROVAS}, f, ensure_ascii=False, indent=1)
    for h, prova in PROVAS.items():
        meta = produtos[h].get("metadata") or {}
        api.post("/admin/products/%s" % produtos[h]["id"], {"metadata": dict(meta, prova=json.dumps(prova, ensure_ascii=False))})
        print("gravado:", h)
    print("backup:", os.path.basename(bk))

if __name__ == "__main__":
    main()
