# Custo real da Lumière (fonte: planilha "CUSTO POR PEÇA - LUMIÈRE" da Camila)

> Lido em 15/09/2026 direto do Google Sheets (aba Resumo + abas por modelo). Substitui toda estimativa
> anterior de custo usada em `acao-1010-avalanche.md` e nas respostas sobre "% ideal de custo".

## Custo por peça (produção completa: matéria-prima + aviamentos + tag + rateios + facção + acompanhamento)

| Modelo | Custo/peça | Preço de venda (planilha) | Custo ÷ preço | Margem líquida* |
|---|---|---|---|---|
| Top Aurora | R$ 47,71–47,76 | R$ 169,00 | **28,2%** | 53,8–63,7% |
| Shorts Aurora | R$ 53,44 | R$ 169,00 | **31,6%** | 60,4% |
| Top Orvalho | R$ 47,98–48,07 | R$ 169,00 | **28,4%** | 63,6% |
| Shorts Orvalho | R$ 58,14 | R$ 169,00 | **34,4%** | 57,6% |
| Macaquinho Solaris | R$ 81,49–81,59 | R$ 259,00 (planilha) | **31,5%** | 60,5% |
| Camiseta Raglan Dry (masc., fora da ação) | R$ 31,40 | R$ 129,00 | 24,3% | 67,7% |

\* Margem líquida da planilha já desconta imposto (Simples, 8% do preço); taxa de cartão e comissão de
embaixadoras estão zeradas em quase todos os modelos (só o Top Aurora tem uma coluna de cenário com 5%+5%
para simular venda por cartão/cupom — hoje não se aplica, pagamento é Pix manual sem taxa).

**Achado importante: o preço do Macaquinho Solaris está divergente.** A planilha de custo usa R$ 259,00;
o feed do Google e a Medusa em produção cobram **R$ 299,00** (`feed.xml`, 15/09). Se R$ 299 for o preço
real (o que a loja está cobrando hoje), a margem do Solaris é ainda melhor do que a tabela acima mostra —
custo cai para 27,3% do preço e a margem líquida sobe. **Confirmar com a Camila qual dos dois é o preço
vigente** e corrigir o lado que estiver errado (planilha ou Medusa).

## Resposta à pergunta "qual o % de custo ideal para anúncios lucrativos"

Os números reais já respondem: **hoje o custo de produção está entre 24% e 34% do preço de venda**, dentro
da faixa saudável (o teto seguro para anúncio pago é por volta de 35–40%, dependendo do custo por venda dos
anúncios). Não é preciso mudar preço nem cortar custo de produção para os anúncios serem lucrativos — o
que decide se cada venda vinda de anúncio dá lucro é o **custo por venda dos anúncios (CAC)**, que varia com
a conversão, não com o preço da peça.

### Margem por unidade vendida via anúncio, com CPL R$ 5 e conversão real do grupo (imposto 8%, sem taxa de cartão — Pix manual)

| Cenário (conversão) | CAC por venda | **Conjunto Aurora/Orvalho** (R$ 304,20, custo ≈ R$ 101–106) | **Peça avulsa** (R$ 169, custo ≈ R$ 48–58) | **Solaris** (R$ 299, custo ≈ R$ 82) |
|---|---|---|---|---|
| Pessimista (5%) | ≈ R$ 187 | **prejuízo de ≈ R$ 9** (−3%) | **prejuízo de ≈ R$ 66 a 79** | quase zero (≈ R$ 6, 2%) |
| Moderado (10%) | ≈ R$ 89 | **lucro de ≈ R$ 90** (30%) | lucro de ≈ R$ 12 a 18 (7–11%) | lucro de ≈ R$ 105 (35%) |
| Otimista (20%) | ≈ R$ 45 | **lucro de ≈ R$ 133** (44%) | lucro de ≈ R$ 57 a 62 (34–37%) | lucro de ≈ R$ 148 (49%) |

Conclusão prática:
- **O conjunto é a unidade que sustenta o anúncio em qualquer cenário exceto o pior.** Mesmo no pessimista,
  o prejuízo é pequeno (R$ 9) porque o custo de produção é baixo — não é a peça que aperta a conta, é o CAC.
- **A peça avulsa só é confortavelmente lucrativa no cenário moderado pra cima.** No pessimista ela dá
  prejuízo real (o CAC de R$ 187 é maior que a margem disponível de R$ 108). Reforça a decisão já tomada:
  empurrar conjunto na oferta e nos anúncios, não peça isolada.
- **O teto de custo da peça para manter 20% de margem líquida** (considerando CAC moderado ≈ R$ 89 e
  imposto 8%) é de **43% do preço no conjunto** e de só **19% do preço na peça avulsa**. Os custos reais
  (28–34%) folgam confortavelmente no conjunto e ficam justos na peça avulsa — outro motivo para o Benefício
  Conjunto ficar ativo antes da ação.
- **O que decide lucro ou prejuízo não é o custo da peça — já está bom — é a conversão dos anúncios.**
  Cair de 10% para 5% de conversão é o que passa a ação para o vermelho, não um custo de produção mais alto.
  Por isso a leitura diária de CPL e taxa de entrada no grupo (já prevista no plano) é mais importante do
  que qualquer ajuste de preço.

## Diferença em relação às contas anteriores desta conversa

As respostas anteriores (antes de ver a planilha) tinham usado R$ 50–90 por peça como hipótese e chegaram
à mesma faixa seguros — o real confirma e refina: custo de peça já está OK (24–34%), a embalagem por envio
é muito mais barata do que eu tinha suposto (**R$ 5,21 por pedido até 2 peças, R$ 8,48 acima disso** —
não R$ 20–30 como eu tinha estimado), e a taxa de cartão/comissão da planilha (5%+5%) não se aplica hoje
porque o pagamento é Pix manual sem gateway. Isso deixa mais folga na conta do que eu tinha calculado antes.

## Dois buracos na fórmula da planilha (achado em 15/09/2026, a pedido da Camila)

A Camila reparou, olhando a linha "Preço de venda → Imposto → Taxa do site/cartão → Comissão/cupom →
Custo da peça" (Shorts Aurora, print), que falta custo de vender a peça, não só de fazer a peça. Conferi:
tem razão, faltam dois.

### 1. Embalagem por envio — a própria planilha calcula e não usa
A aba Catálogo tem os dois valores prontos (`Embalagem por envio - até 2 peças R$ 5,21` · `acima de 2
peças R$ 8,48`), marcados como "custo por pedido, não por peça" — mas nenhuma aba de modelo subtrai isso
na "LUCRO POR PEÇA". O subtotal de cada modelo soma matéria-prima + aviamentos + tag + rateios + serviços
e para por aí. Embalagem fica de fora do cálculo, sempre, em toda peça vendida.

Efeito real (Shorts Aurora, R$ 169, lucro hoje mostrado R$ 102,04):
- Vendida sozinha (1 peça por envio): lucro cai para **R$ 96,83** (57,3%, não 60,4%).
- Vendida dentro de um conjunto (2 peças dividem 1 embalagem): lucro cai para **R$ 99,43** (58,8%).

No conjunto Top + Shorts Aurora inteiro (R$ 304,20, 1 envio): soma o custo das duas peças (R$ 101,17),
imposto (R$ 24,34) e agora a embalagem inteira do pedido (R$ 5,21, não dividida por peça porque é 1 envio
só): lucro orgânico (sem anúncio) cai de R$ 178,71 para **R$ 173,48** (57%, antes eu tinha calculado 58,7%
sem esse desconto).

### 2. Custo de aquisição (anúncio) — não existe em lugar nenhum da planilha
Esse é o buraco grande. A planilha calcula "lucro por peça" como se a venda tivesse acontecido de graça —
uma amiga que viu no grupo e comprou sem custo nenhum de atrair ela. Isso é verdade pra venda orgânica, mas
nenhuma linha da planilha pergunta "e se essa venda veio de um anúncio que custou R$ 45, R$ 89 ou R$ 187?".
Rodando de novo com o desconto de embalagem incluído:

| Cenário | CAC por venda | Margem no **conjunto** (R$ 304,20, já com embalagem) | Margem na **peça avulsa** (R$ 169, já com embalagem) |
|---|---|---|---|
| Pessimista (5%) | ≈ R$ 187 | prejuízo de ≈ R$ 14 (−4,4%) | prejuízo de ≈ R$ 71–85 |
| Moderado (10%) | ≈ R$ 89 | lucro de ≈ R$ 84 (27,8%) | lucro de ≈ R$ 7–13 (4–8%) |
| Otimista (20%) | ≈ R$ 45 | lucro de ≈ R$ 128 (42,2%) | lucro de ≈ R$ 52–57 (31–34%) |

(Tabela substitui a do topo deste arquivo, que ainda não descontava a embalagem — a diferença é pequena,
1 a 4 pontos de margem, mas real.)

### O que a planilha já modela mas está zerado — não é buraco, é interruptor desligado
- **Taxa do site/cartão** e **Comissão/cupom**: colunas existem (só o Top Aurora tem uma comparação com
  5%+5%), mas estão em 0% em todo o resto porque hoje não há gateway de cartão (Pix manual, sem taxa) nem
  programa de comissão ativo. Isso muda no dia em que a Getnet entrar (Parte 4 do projeto) — nesse dia,
  atualizar a % em todas as abas, não só na de Top Aurora.

## Atualização (15/09/2026) — Camila informou os % médios reais: taxa 5%, cupom/comissão 10%

Com os três descontos sobre o preço somados (imposto 8% + taxa 5% + cupom médio 10% = **23%**), sobra 77%
do preço antes de custo da peça, embalagem e anúncio. Isso é mais conservador do que a planilha mostra hoje
(0% em taxa e comissão) e muda o veredito da ação 10/10: a peça avulsa deixa de ser viável via anúncio na
maioria dos cenários, e o conjunto perde margem mas continua de pé.

### Margem líquida de venda por anúncio, com os % reais informados

| Peça / conjunto | Sobra sem anúncio (%) | Conversão fraca (CAC ≈ R$ 187) | Conversão moderada (CAC ≈ R$ 89) | Conversão boa (CAC ≈ R$ 45) |
|---|---|---|---|---|
| Top Aurora (R$ 169) | 45,7% | prejuízo de R$ 110 | prejuízo de R$ 12 | lucro de R$ 32 (19%) |
| Shorts Aurora (R$ 169) | 42,3% | prejuízo de R$ 116 | prejuízo de R$ 18 | lucro de R$ 26 (16%) |
| Top Orvalho (R$ 169) | 45,5% | prejuízo de R$ 110 | prejuízo de R$ 12 | lucro de R$ 32 (19%) |
| Shorts Orvalho (R$ 169) | 39,5% | prejuízo de R$ 120 | prejuízo de R$ 22 | lucro de R$ 22 (13%) |
| **Conjunto Aurora** (R$ 304,20) | 42,0% | prejuízo de R$ 59 (−19%) | **lucro de R$ 39 (13%)** | lucro de R$ 83 (27%) |
| **Conjunto Orvalho** (R$ 304,20) | 40,4% | prejuízo de R$ 64 (−21%) | **lucro de R$ 34 (11%)** | lucro de R$ 78 (26%) |
| Solaris a R$ 299 (preço real do site) | 48,0% | prejuízo de R$ 44 (−15%) | lucro de R$ 54 (18%) | lucro de R$ 98 (33%) |
| Solaris a R$ 259 (preço da planilha) | 43,5% | prejuízo de R$ 74 (−29%) | lucro de R$ 24 (9%) | lucro de R$ 68 (26%) |

### O que muda na prática
- **Peça avulsa vendida por anúncio só dá lucro no cenário de conversão boa.** No moderado, todas as peças
  avulsas dão prejuízo (R$ 12 a R$ 22). Reforça, agora com mais força ainda, que anúncio tem que empurrar
  conjunto ou Solaris — nunca peça isolada.
- **O conjunto continua de pé, mas com margem mais magra:** 11 a 13% no cenário moderado, não os 28-30%
  calculados antes de entrar a taxa e o cupom. Ainda positivo, ainda vale rodar, mas com menos folga.
- **O cenário de conversão fraca deixa de ser "quase empate" e vira prejuízo real** em tudo: R$ 59 a R$ 120
  por venda, dependendo do item. Isso eleva a importância do plano de recuo do §7 do plano da ação (cortar
  região/criativo se o CPL passar de R$ 8) — com esses % reais, não dá pra sustentar 3 dias de conversão
  fraca sem cortar.
- **Teto de custo da peça para não dar prejuízo mesmo sem contar anúncio** (só imposto+taxa+cupom+
  embalagem): 74% do preço na peça avulsa, 76% no conjunto. Os custos reais (24-34%) folgam bastante aqui —
  o aperto só aparece quando o anúncio entra na conta.
- **Teto de custo da peça para manter positivo com CAC moderado (R$ 89)**: 21% na peça avulsa (custo real
  28-34% já ultrapassa — daí o prejuízo) e 46% no conjunto (custo real ≈ 33% ainda cabe, mas com pouca
  sobra — daí a margem cair para 11-13%).

Um adendo honesto: hoje o pagamento é Pix manual (sem taxa de gateway) e não há programa de cupom ativo,
então a taxa de 5% e o cupom de 10% são uma **premissa conservadora para planejar à frente** (Getnet
entrando, ou cupom de campanha usado com frequência) — não o custo que está saindo agora mesmo. Se hoje
realmente ninguém está usando cupom e o pagamento continuar 100% manual, a margem real de hoje é a da
tabela anterior (sem esses 15 pontos). Vale a Camila confirmar se "cupom médio 10%" é uma meta de
planejamento ou já reflete uso real de cupom nas vendas atuais.

## O que ainda falta (não está nesta planilha)

- **Frete real de envio** (Correios/transportadora) — não entra no custo por peça da Camila, é custo do
  pedido, e é diferente de embalagem (embalagem é a caixa/aviamento; frete é o transporte). Necessário
  para a conta do "frete por nossa conta" da ação 10/10 — hoje esse custo é zero na planilha e zero no
  meu cálculo, o que só é verdade se o frete continuar sendo cobrado à parte do cliente fora da J1/J2.
- **Custo da pulseira da coleção e do kit de mãos** (brindes da J1) — não estão no catálogo de insumos.
- Confirmar o preço real do Solaris (R$ 259 ou R$ 299) para fechar a tabela de margem.

## Recomendação de ajuste na planilha (para a Camila aplicar quando quiser)
Adicionar duas linhas no bloco "PRECIFICAÇÃO" de cada modelo, entre "Custo da peça" e "LUCRO POR PEÇA":
- `Embalagem (rateada por peça no envio)` — puxando do Catálogo os R$ 5,21/R$ 8,48 já cadastrados.
- `Custo de aquisição (quando a venda vem de anúncio)` — em branco por padrão (venda orgânica = R$ 0),
  preenchido à mão com o CAC do período quando for analisar uma campanha específica.
Isso faz o "LUCRO POR PEÇA" da planilha bater com a realidade de uma venda vinda de anúncio, não só da
venda de grupo/orgânica que ela reflete hoje.

## Ação tomada nesta sessão
`docs/marketing/acao-1010-avalanche.md` §1 e §2 foram atualizados com o custo real (substitui "PERGUNTAR")
e a projeção "cobre custo?" foi recalculada com o custo de produção total da coleção (R$ 21.037 para as
220 unidades, sem a camiseta masculina) — ver §2 desse arquivo para o resultado por verba.
