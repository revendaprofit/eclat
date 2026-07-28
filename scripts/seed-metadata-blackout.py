# -*- coding: utf-8 -*-
"""
Metadata de conversão da PDP v2 para a Família Blackout (DSB + quem é + FAQ),
adaptado do spec aprovado do wireframe. Roda após o import-lancamento.py.
Uso: python scripts/seed-metadata-blackout.py
"""
import io, os, json, requests

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.environ.get("MEDUSA_URL", "https://endearing-enthusiasm-production-775b.up.railway.app")
NL = chr(10)

FAQ_PADRAO = [
    {"q": "Como escolho meu tamanho?",
     "a": "Use a tabela de medidas acima, medindo busto na parte mais cheia, cintura na parte mais fina e quadril na parte mais cheia, sempre com a fita paralela ao chão. Entre dois tamanhos: o menor sustenta mais, o maior é mais confortável."},
    {"q": "Posso trocar ou devolver?",
     "a": "Sim. Você tem 7 dias corridos após o recebimento para desistir da compra com reembolso integral (CDC), peça sem uso e com etiquetas. Para troca de tamanho, chame no WhatsApp com o número do pedido. Defeito de fabricação: 30 dias, sem custo."},
]

def meta_legging():
    return {
        "dsb_dor": "você ainda confere no espelho antes de agachar?",
        "dsb_solucao": "A Legging Vértice tem tecido encorpado e opaco, com compressão firme que sustenta e recortes diagonais que desenham a perna. Não é promessa de rótulo — é gramatura.",
        "dsb_beneficios": NL.join([
            "Você agacha, levanta e não confere mais",
            "Sustenta na série pesada e continua bonita na rua",
            "Cintura alta que não enrola no meio do treino",
        ]),
        "quem_sim": NL.join([
            "Treina de verdade e precisa de peça que sustente a série pesada",
            "Quer sair do estúdio direto para a rua sem trocar de roupa",
            "Já checou no espelho antes de agachar — e não quer mais",
            "Valoriza caimento e acabamento, não só preço",
        ]),
        "quem_nao": NL.join([
            "Procura a legging mais barata do mercado — não somos",
            "Quer compressão médica ou terapêutica",
            "Busca estampa — a Vértice é lisa, em Blackout, Verde Exército e Licor",
        ]),
        "faq": json.dumps([
            {"q": "Fica transparente no agachamento?",
             "a": "Não. O tecido é encorpado e opaco: a gramatura foi escolhida para a trama não abrir quando o tecido estica. É a pergunta que mais recebemos — e a razão de a Vértice existir do jeito que é."},
            {"q": "A cintura enrola no treino?",
             "a": "Não. A cintura é alta e trabalha junto com a compressão firme para ficar no lugar do aquecimento ao último exercício."},
            {"q": "Serve para usar fora do treino?",
             "a": "Sim — é exatamente a proposta. Os recortes diagonais e o caimento foram pensados para sair do estúdio direto para a rua."},
        ] + FAQ_PADRAO, ensure_ascii=False),
    }

def meta_top(nome, detalhe):
    return {
        "dsb_dor": "top que afrouxa no meio do treino não é top, é distração.",
        "dsb_solucao": "O %s sustenta sem apertar: elástico firme sob o busto, alças que ficam no lugar e o toque premium ÉCLAT. %s" % (nome, detalhe),
        "dsb_beneficios": NL.join([
            "Sustentação que aguenta o treino inteiro",
            "Alças que não caem nem marcam",
            "Bonito o bastante para aparecer no look",
        ]),
        "quem_sim": NL.join([
            "Treina e cansou de ajustar alça no meio da série",
            "Quer um top que funcione sozinho ou sob a blusa",
            "Valoriza acabamento premium no básico",
        ]),
        "quem_nao": NL.join([
            "Precisa de sustentação máxima para impacto extremo (corrida longa) — indicamos sobrepor",
            "Procura o top mais barato do mercado — não somos",
        ]),
        "faq": json.dumps([
            {"q": "Sustenta treino de impacto?",
             "a": "Sustentação média: perfeita para musculação, funcional, pilates e yoga. Para corrida longa ou salto intenso, recomendamos sobrepor a um top de alta compressão."},
            {"q": "Tem bojo?",
             "a": "Confira a ficha do produto acima — os modelos da família acompanham forro/bojo removível para você decidir."},
        ] + FAQ_PADRAO, ensure_ascii=False),
    }

def meta_shorts(nome, detalhe):
    return {
        "dsb_dor": "shorts que sobe a cada agachamento estraga qualquer treino.",
        "dsb_solucao": "O %s tem cós alto firme e modelagem que fica no lugar — sem subir, sem enrolar, sem puxar. %s" % (nome, detalhe),
        "dsb_beneficios": NL.join([
            "Fica no lugar do primeiro ao último exercício",
            "Cós alto que sustenta e valoriza",
            "Tecido encorpado que não marca nem transparece",
        ]),
        "quem_sim": NL.join([
            "Treina agachamento e cansou de ajustar a barra do shorts",
            "Prefere shorts a legging no calor",
            "Quer conjunto: combina com os tops da família",
        ]),
        "quem_nao": NL.join([
            "Procura shorts de corrida com fenda — este é de compressão",
            "Busca estampa — a família é lisa, em três cores",
        ]),
        "faq": json.dumps([
            {"q": "Sobe ou enrola no agachamento?",
             "a": "Não. A modelagem e o cós alto foram desenhados para ficar no lugar — é o motivo de existir deste shorts."},
            {"q": "Marca ou transparece?",
             "a": "O tecido é encorpado e opaco, escolhido para não abrir a trama quando estica."},
        ] + FAQ_PADRAO, ensure_ascii=False),
    }

def meta_macaquinho():
    return {
        "dsb_dor": "cós descendo, blusa subindo — no meio da série, de novo?",
        "dsb_solucao": "O Macaquinho Prisma é a peça única que resolve: nada desalinha, nada precisa de ajuste. Decote quadrado, costas nadador e o lettering ÉCLAT no peito.",
        "dsb_beneficios": NL.join([
            "Zero ajuste durante o treino — é uma peça só",
            "Silhueta esculpida do decote à barra",
            "Vai do treino ao café sem trocar de roupa",
        ]),
        "quem_sim": NL.join([
            "Cansou de alinhar conjunto no meio do treino",
            "Quer uma peça única com cara de look completo",
            "Treina e emenda compromisso depois",
        ]),
        "quem_nao": NL.join([
            "Prefere trocar só a parte de cima ao longo do dia",
            "Procura peça térmica para frio extremo",
        ]),
        "faq": json.dumps([
            {"q": "É prático no dia a dia?",
             "a": "Sim — a peça é pensada para vestir e esquecer: nada desalinha no treino e o caimento segura o resto do dia."},
            {"q": "As costas são abertas?",
             "a": "Sim, costas nadador com recorte vazado — sustentação com respiro. Veja as fotos de costas na galeria."},
        ] + FAQ_PADRAO, ensure_ascii=False),
    }

METAS = {
    "legging-vertice": meta_legging(),
    "top-radiance": meta_top("Top Radiance", "As alças finas cruzadas nas costas são a assinatura do modelo."),
    "top-lumina": meta_top("Top Lumina", "O decote suave com keyhole faz dele o mais elegante da família."),
    "top-prisma": meta_top("Top Prisma", "O bicolor com lettering ÉCLAT é a cara da coleção."),
    "shorts-radiance": meta_shorts("Shorts Radiance", "O vivo em contraste na lateral alonga a perna."),
    "shorts-lumina": meta_shorts("Shorts Lumina", "Monocromático, com o nó ÉCLAT discreto na barra."),
    "shorts-prisma": meta_shorts("Shorts Prisma", "Com o lettering ÉCLAT no cós."),
    "macaquinho-prisma": meta_macaquinho(),
}

def main():
    env = {}
    for line in io.open(os.path.join(RAIZ, "apps", "cockpit", ".env.local"), encoding="utf-8").read().splitlines():
        if "=" in line and not line.startswith("#"):
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip()
    r = requests.post(BASE + "/auth/user/emailpass",
                      json={"email": env["MEDUSA_ADMIN_EMAIL"], "password": env["MEDUSA_ADMIN_PASSWORD"]}, timeout=30)
    H = {"Authorization": "Bearer " + r.json()["token"]}
    for handle, meta in METAS.items():
        r = requests.get(BASE + "/admin/products?handle=" + handle + "&fields=id,metadata", headers=H, timeout=30)
        prods = r.json().get("products", [])
        if not prods:
            print("NAO ACHOU:", handle)
            continue
        p = prods[0]
        novo = dict(p.get("metadata") or {})
        novo.update(meta)
        r = requests.post(BASE + "/admin/products/" + p["id"], headers=H, json={"metadata": novo}, timeout=60)
        print("metadata", handle, "->", r.status_code)

if __name__ == "__main__":
    main()
