# -*- coding: utf-8 -*-
"""
Fotos Telha trocadas entre Short Orvalho e Short Aurora (sócia, 28/10/2026).

Regra da Camila: Short Orvalho = cós mais curto (no ensaio, usado com o top de zíper); Short Aurora = pala do cós larga
(usado com o top de tiras). Na Grafitti as fotos estavam certas; na Telha estavam trocadas entre os dois produtos.
Ficam de fora as fotos que repetem foto de top ou do banner do conjunto (regra: nunca a mesma foto em top, short,
conjunto e categoria). Aprovado pela Camila na prancha brand-assets/detalhes-pecas/prancha-telha-numerada.jpg
(5 a 11 → Orvalho; 1 a 4 → Aurora).

Uso:
  python -B scripts/trocar-telha-shorts.py           # simulação
  python -B scripts/trocar-telha-shorts.py --apply   # grava em PRODUÇÃO; backup antes
"""
import io, json, os, sys, time

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJ = os.path.dirname(RAIZ)
sys.path.insert(0, os.path.join(RAIZ, "scripts"))
import importlib
fd = importlib.import_module("fotos-detalhe")   # env, Medusa

APPLY = "--apply" in sys.argv
COR = "Telha"
# Final do nome do arquivo (hash) → ordem na galeria da cor; a 1ª é a capa (recorte com ênfase no short).
PLANO = {
    "short-orvalho": ["telha-01-3d29354a", "telha-short-91be6de5", "telha-02-49df6f29", "telha-03-bcbd0ae2", "telha-04-044a20a5", "telha-06-b10df252"],
    "short-aurora": ["telha-01-d0f79e84", "telha-short-cae0c512"],
}
FORA = {"telha-05-c643dc3d": "banner do Conjunto Aurora Telha", "telha-02-f753736e": "Top Orvalho", "telha-03-44d4af58": "Top Orvalho e banner do conjunto"}

def main():
    if hasattr(sys.stdout, "reconfigure"): sys.stdout.reconfigure(encoding="utf-8")
    e = fd.env(); api = fd.Medusa(e)
    prods = {h: api.get("/admin/products?handle=%s&fields=id,handle,thumbnail,*images,*variants,*variants.options" % h)["products"][0] for h in PLANO}
    todas = {i["url"].rsplit("/", 1)[1].rsplit(".", 1)[0]: i["url"] for p in prods.values() for i in p["images"]}
    for h, lst in PLANO.items():
        faltam = [n for n in lst if n not in todas]
        if faltam: raise SystemExit("foto não encontrada: %s" % faltam)
        print("%s Telha: %s" % (h, ", ".join(lst)))
    print("fora:", "; ".join("%s (%s)" % kv for kv in FORA.items()))
    if not APPLY: print("modo: SIMULAÇÃO (use --apply)"); return

    bk = os.path.join(PROJ, "brand-assets", "backup-telha-shorts-%s.json" % time.strftime("%Y-%m-%d-%H%M"))
    with io.open(bk, "w", encoding="utf-8") as f:
        json.dump({h: {"thumbnail": p.get("thumbnail"), "images": p["images"]} for h, p in prods.items()}, f, ensure_ascii=False, indent=1)
    for h, lst in PLANO.items():
        p = prods[h]
        outras = [i for i in p["images"] if not i["url"].rsplit("/", 1)[1].startswith("telha-")]
        por_url = {i["url"]: i["id"] for i in p["images"]}
        novas = [todas[n] for n in lst]
        corpo = [{"id": i["id"], "url": i["url"]} for i in outras] + [({"id": por_url[u], "url": u} if u in por_url else {"url": u}) for u in novas]
        api.post("/admin/products/%s" % p["id"], {"images": corpo})
        prod = api.get("/admin/products/%s?fields=id,*images,*variants,*variants.options" % p["id"])["product"]
        ids = {i["url"]: i["id"] for i in prod["images"]}
        vids = [v["id"] for v in prod["variants"] if any(o.get("value") == COR for o in v.get("options") or [])]
        for u in novas:
            api.post("/admin/products/%s/images/%s/variants/batch" % (p["id"], ids[u]), {"add": vids})
        print("gravado:", h)
    print("backup:", os.path.basename(bk))
    import subprocess
    subprocess.run([sys.executable, "-B", os.path.join(RAIZ, "scripts", "gerar-variantes-fotos.py"), "--apply"], check=False, stdout=subprocess.DEVNULL)

if __name__ == "__main__":
    main()
