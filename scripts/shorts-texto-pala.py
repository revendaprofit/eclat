# -*- coding: utf-8 -*-
"""
Texto do cós nos Shorts Orvalho e Aurora (sócia, 28/10/2026; aprovado em
contexto-claude/eclat-shorts-orvalho-aurora-texto-proposta.md).

Fato de produto: os DOIS shorts são de cós alto; o que muda é a pala. Orvalho = pala mais ESTREITA (e costura que
valoriza o bumbum); Aurora = pala mais LARGA (sem costura no bumbum). Até 28/10 o site dizia o contrário. Só os trechos
do cós mudam: descrição, item de Funcionalidades, uma linha de "É pra você se" e "Talvez não seja" e, no Orvalho, a
resposta "Sobe durante o treino?". Troca exata de texto: se o texto de origem não estiver lá, o script para.

Uso:
  python -B scripts/shorts-texto-pala.py           # simulação
  python -B scripts/shorts-texto-pala.py --apply   # grava em PRODUÇÃO (só com "pode aplicar"); backup antes
"""
import io, json, os, sys, time

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJ = os.path.dirname(RAIZ)
sys.path.insert(0, os.path.join(RAIZ, "scripts"))
import importlib
fd = importlib.import_module("fotos-detalhe")   # env, Medusa

APPLY = "--apply" in sys.argv

# campo → [(texto de hoje, texto novo)]; "description" é o campo do produto, o resto é metadata
TROCAS = {
    "short-orvalho": {
        "description": [("O cós mais alto abraça a cintura e dá segurança em todo movimento, do agachamento à corrida.",
                         "O cós alto, de pala mais estreita, abraça a cintura sem marcar e acompanha todo movimento, do agachamento à corrida.")],
        "funcionalidades": [('{"titulo": "Cós mais alto", "texto": "Segurança em todo movimento, do agachamento à corrida."}',
                             '{"titulo": "Cós alto, pala estreita", "texto": "Abraça a cintura sem marcar."}')],
        "quem_sim": [("Quer cós mais alto para segurança em todo movimento", "Quer cós alto com pala estreita, que segura sem marcar a cintura")],
        "quem_nao": [("Quer cós mais estreito e discreto", "Prefere a pala do cós larga e bem marcada")],
        "faq": [("e o cós mais alto dá segurança em todo movimento.", "e o cós alto abraça a cintura sem sair do lugar.")],
    },
    "short-aurora": {
        "description": [("e o cós alto abraça a cintura com firmeza, em uma faixa mais estreita que segura sem chamar atenção para si.",
                         "e o cós alto, de pala larga, abraça a cintura com firmeza.")],
        "funcionalidades": [('{"titulo": "Cós alto", "texto": "Abraça a cintura com firmeza, em faixa mais estreita."}',
                             '{"titulo": "Cós alto, pala larga", "texto": "Abraça a cintura com firmeza."}')],
        "quem_sim": [("Quer cós alto que segura, mas sem faixa larga marcando a cintura", "Quer cós alto com pala larga, que segura bem a cintura")],
        "quem_nao": [("Prefere cós largo e bem marcado", "Prefere a pala do cós estreita e discreta")],
    },
}

def como_texto(v):
    return v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)

def main():
    if hasattr(sys.stdout, "reconfigure"): sys.stdout.reconfigure(encoding="utf-8")
    e = fd.env(); api = fd.Medusa(e)
    prods = {h: api.get("/admin/products?handle=%s&fields=id,handle,description,metadata" % h)["products"][0] for h in TROCAS}
    novos = {}
    for h, campos in TROCAS.items():
        p = prods[h]; meta = dict(p.get("metadata") or {}); desc = p.get("description") or ""
        for campo, pares in campos.items():
            atual = desc if campo == "description" else como_texto(meta.get(campo))
            for velho, novo in pares:
                if velho not in atual: raise SystemExit("%s/%s: texto de hoje não encontrado: %s" % (h, campo, velho[:60]))
                atual = atual.replace(velho, novo)
                print("%s · %s: \"%s\"" % (h, campo, novo[:80]))
            if campo == "description": desc = atual
            else: meta[campo] = atual if isinstance(meta.get(campo), str) else json.loads(atual)
        novos[h] = {"description": desc, "metadata": meta}
    if not APPLY: print("modo: SIMULAÇÃO (use --apply)"); return
    bk = os.path.join(PROJ, "brand-assets", "backup-shorts-texto-%s.json" % time.strftime("%Y-%m-%d-%H%M"))
    with io.open(bk, "w", encoding="utf-8") as f:
        json.dump({h: {"description": p.get("description"), "metadata": p.get("metadata")} for h, p in prods.items()}, f, ensure_ascii=False, indent=1)
    for h, corpo in novos.items():
        api.post("/admin/products/%s" % prods[h]["id"], corpo); print("gravado:", h)
    print("backup:", os.path.basename(bk))

if __name__ == "__main__":
    main()
