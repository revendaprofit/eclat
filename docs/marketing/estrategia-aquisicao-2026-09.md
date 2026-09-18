# Estratégia de aquisição ÉCLAT — preço novo, funil "sempre aberto" e análise dos anúncios

> 17/09/2026. Base: planilha real de custo (`custo-real-lumiere.md`), conta Meta `act_1730969517306822`
> (dados de 10 a 17/09), skills `lancamento-avalanche` e `anuncio-resposta-direta`.
> Premissas do dono: imposto 8%, taxa de cartão 5%, cupom médio 10%, embalagem R$ 5,21 por pedido.
> **Aplicado em 17/09/2026 à noite** com "pode aplicar tudo" do dono: preços, conjunto a R$ 299, cupom CLUBE10 e ajustes na conta Meta. Registro em `architecture/ads.md`.

## 1. Top e short a R$ 159, macaquinho a R$ 259 — dá?

**Dá.** O custo de produção não muda, e a margem antes de anúncio continua entre 37% e 44%.

| Item | Preço | Sobra por venda sem anúncio | Markup | Anúncio máximo p/ sobrar 20% | Anúncio máximo p/ empatar |
|---|---|---|---|---|---|
| Top Aurora | R$ 159 | R$ 69 (43,7%) | 3,3x | R$ 38 | R$ 69 |
| Shorts Aurora | R$ 159 | R$ 64 (40,1%) | 3,0x | R$ 32 | R$ 64 |
| Top Orvalho | R$ 159 | R$ 69 (43,5%) | 3,3x | R$ 37 | R$ 69 |
| Shorts Orvalho | R$ 159 | R$ 59 (37,2%) | 2,7x | R$ 27 | R$ 59 |
| Macaquinho Solaris | R$ 259 | R$ 113 (43,5%) | 3,2x | R$ 61 | R$ 113 |
| **Conjunto a R$ 299** (recomendado) | R$ 299 | R$ 119–124 (40–41%) | 2,9x | R$ 59–64 | R$ 119–124 |
| Conjunto a R$ 318 (sem benefício) | R$ 318 | R$ 133–138 (42–43%) | 3,1x | R$ 70–75 | R$ 133–138 |
| Conjunto a R$ 286,20 (10% atual) | R$ 286,20 | R$ 109–114 (38–40%) | 2,8x | R$ 52–57 | R$ 109–114 |

O que a mudança custa: R$ 7,70 por peça e R$ 30,80 por macaquinho. No lote inteiro vendido, cerca de
R$ 4.600 a menos de sobra (receita cai de R$ 71.240 para R$ 65.240).

### Três regras para o preço novo não virar prejuízo
1. **Não empilhar três descontos.** Preço menor + Benefício Conjunto 10% + cupom 10% na mesma venda leva o
   conjunto a R$ 257 líquido de desconto. Recomendo: **conjunto a R$ 299** (regra `total_valor` de R$ 19 no
   Cockpit → Conjuntos, no lugar dos 10%) e **cupom que não acumula com conjunto**. A escada fica redonda:
   159 · 259 · 299. Sem cupom no conjunto, a sobra sobe para R$ 154 (51%).
2. **Cupom só como ferramenta de entrada.** Cupom de primeira compra, uso único, entregue dentro do grupo.
   Vira custo de aquisição controlado, não desconto permanente.
3. **Pix como padrão no checkout do Mercado Pago.** Pix custa cerca de 1% contra 5% do cartão. No conjunto a
   R$ 299 são R$ 12 a mais por venda. Cartão continua disponível em até 4x.

A peça avulsa continua sem espaço para anúncio: só aguenta R$ 27 a R$ 38 de custo de aquisição. Anúncio vende
conjunto e macaquinho. Peça avulsa se vende dentro do grupo e no site, de graça.

Conferido em produção em 17/09: o único pedido da base era um teste cancelado de junho. Ninguém comprou no preço antigo, então não há diferença a devolver.

## 2. Funil "sempre aberto": anúncio compra a cliente uma vez, o grupo vende para sempre

Lógica: o custo de aquisição é pago uma única vez. Cada lançamento seguinte vende para a mesma pessoa com custo
zero de anúncio. Hipótese a medir (ainda sem dado de recompra): uma cliente que compra 1 conjunto agora e 1 na
próxima coleção deixa R$ 240 de sobra. Pagar até R$ 64 para trazê-la é bom negócio mesmo que a primeira venda
sobre pouco.

### As quatro camadas
| Camada | O que roda | Destino | Meta |
|---|---|---|---|
| 1. Descoberta | Vídeos por ângulo (seção 4), só Instagram e Facebook Reels, público frio BR F 25–45 Sudeste/Sul + semelhante a quem iniciou conversa | WhatsApp da marca | conversa iniciada ≤ R$ 6 |
| 2. Cadastro | Robô já existente: saudação + convite do grupo + lead "Clube Éclat" no Cockpit. Entrega o cupom de primeira compra (uso único) | Grupo CLUB ÉCLAT | ≥ 70% das conversas entram no grupo |
| 3. Venda | Remarketing de catálogo para quem viu vídeo, visitou o site ou virou lead. Janelas do grupo (ação 10/10, reposições) | Página do conjunto / Solaris | custo por venda ≤ R$ 64 |
| 4. Recompra | Cada coleção ou reposição abre 24–48h antes no grupo, no formato avalanche, com o Clube automatizado | Grupo → site | 10% do grupo compra por lançamento, anúncio zero |

Regras herdadas do avalanche: anúncio frio nunca aponta para o checkout; oferta de lançamento só aparece no
grupo; escassez só com número do estoque; um CTA por peça.

### Verba (mantendo R$ 50/dia)
| Bloco | Hoje | Proposto |
|---|---|---|
| Captação para o grupo (WhatsApp) | R$ 20 | **R$ 30** |
| Remarketing de venda (catálogo) | R$ 10, parado por erro | **R$ 12** |
| Aquecimento de vídeo | R$ 20 | **R$ 8**, só Instagram |

Nas janelas de lançamento (10/10 é a primeira) o bloco de venda sobe por 48h conforme `acao-1010-avalanche.md`.

### Painel de controle semanal
Custo por conversa · % que entra no grupo · tamanho do grupo · custo por venda · ticket médio (meta ≥ R$ 280) ·
% de pedidos com conjunto. Corte: custo por conversa acima de R$ 8 por 3 dias troca o criativo ou o público,
não aumenta a verba.

## 3. Análise dos anúncios (10 a 17/09, R$ 129 gastos)

| Anúncio | Gasto | Resultado | Leitura |
|---|---|---|---|
| Reel "um novo ciclo" → WhatsApp Clube | R$ 47,39 | 5 conversas a R$ 9,48 · 10 cliques no link · 3 seguidoras novas · CPM R$ 62 | Só 15% passam de 25% do vídeo, tempo médio 8s. A pessoa não para. Público quente é minúsculo (alcance 471), por isso o CPM alto |
| Reel "seja qual for o seu estilo" | R$ 49,93 | 834 visualizações completas · 11 cliques · CTR 0,39% | R$ 25,51 foram para Audience Network e R$ 7,27 para Marketplace. No Instagram ficaram R$ 10 |
| Reel "ponto de virada" | R$ 26,58 | 751 visualizações completas · 0 cliques | **R$ 26,57 de R$ 26,58 foram para vídeo recompensado do Audience Network**: gente assistindo para ganhar vida em joguinho. Verba perdida |
| Catálogo Lumière → loja | R$ 5,34 | 4 cliques a R$ 1,34 · CTR 2,92% | **Parado com erro**: o conjunto de produtos filtra "em estoque" e o feed passou para "pré-venda". Conjunto ficou vazio |

### Diagnóstico
1. **Dois terços da verba de aquecimento foram para fora do Instagram.** Otimizar por visualização completa com
   posicionamento automático empurra o anúncio para vídeo recompensado, onde a visualização é forçada. Não cria
   público de remarketing no Instagram nem percepção de marca premium. Correção: posicionamento manual só em
   Instagram (feed, stories, reels) e Facebook Reels.
2. **O catálogo era o clique mais barato da conta e está desligado por um filtro.** Correção: trocar o filtro do
   conjunto de produtos 1076107274890077 para aceitar "preorder" (ou tirar o filtro).
3. **O anúncio do Clube falha na primeira microdecisão (parar).** Os Reels são institucionais: bonitos, sem
   promessa, sem motivo para agir. Falham no corte da skill: sem o logo, não sobra uma ideia. Custo por conversa
   de R$ 9,48 com 5 resultados ainda é amostra pequena, não é conclusão, mas a retenção de 15% aponta o hook.
4. **O público quente acabou.** Alcance de 471 pessoas com frequência 1,6 em uma semana. Para o grupo crescer
   de 96 para mil, a captação precisa de público frio com criativo de resposta direta.

## 4. Criativos novos de captação (skill anuncio-resposta-direta)

Oferta em cinco perguntas. O que é: Lumière, primeira coleção de treino da use.ÉCLAT, lote pequeno. Para quem:
mulher de 25 a 45 que treina e resolve o dia com a mesma roupa. Transformação: treinar sem ficar ajeitando a
roupa e sair do treino arrumada. Mecanismo: malha canelada encorpada, cós alto, tira gripfit na barra do short
e do macaquinho, alças que cruzam nas costas, forro respirável `[CONFIRMAR com a Camila o que cada detalhe
entrega no corpo]`. Por que agora: 35 peças por cor, envios a partir de 10/10, o grupo recebe tudo antes.

```
ÂNGULO: dor
HIPÓTESE: quem treina reconhece na hora o incômodo de ajeitar o short, e isso faz parar o dedo.

HOOK
  Visual:        close de mão puxando a barra do short no meio do agachamento; corte para o short Lumière parado no lugar
  Falado:        "Se você ajeita o short a cada série, o problema não é o seu corpo."
  Texto na tela: o short que fica

HEADLINE (campo Título): O short que não sobe no agachamento

TEXTO PRINCIPAL:
Você puxa a barra, ajeita o cós, e o treino vira uma sequência de interrupções.
A Lumière foi desenhada para ficar onde você veste: cós alto firme e tira gripfit na barra [CONFIRMAR].
São 35 peças por cor nesta primeira coleção. Os envios começam em 10/10.
No Clube Éclat você vê tudo antes e recebe a condição de primeira compra.

CTA: Entre no Clube Éclat pelo WhatsApp e receba antes de todo mundo · Botão: Enviar mensagem

A PÁGINA PRECISA CONFIRMAR: a saudação do robô fala do grupo e da condição de primeira compra.
```

```
ÂNGULO: desejo
HIPÓTESE: a promessa "do treino ao café sem trocar de roupa" vende o conjunto como solução de dia inteiro.

HOOK
  Visual:        a mesma mulher, mesmo conjunto: barra fixa, corte seco, mesa de café com casaco por cima
  Falado:        "Uma roupa. Treino das sete, café das nove."
  Texto na tela: do treino ao café

HEADLINE (campo Título): Um conjunto para o treino e para o resto do dia

TEXTO PRINCIPAL:
Tem roupa de treino que só funciona na academia.
O conjunto Lumière tem malha canelada encorpada e modelagem que segura no movimento e veste bem parada.
Top e short formam conjunto com condição especial.
Lote pequeno, envios a partir de 10/10. O Clube Éclat vê primeiro.

CTA: Chame no WhatsApp e entre no Clube Éclat · Botão: Enviar mensagem

A PÁGINA PRECISA CONFIRMAR: o grupo mostra o conjunto no corpo e o preço do conjunto.
```

```
ÂNGULO: mecanismo
HIPÓTESE: mostrar o detalhe de construção dá razão concreta para acreditar em marca nova.

HOOK
  Visual:        macro da alça cruzando nas costas e da costura na cintura do Macaquinho Solaris; mão estica a malha
  Falado:        "Olha de perto antes de decidir."
  Texto na tela: feito para segurar

HEADLINE (campo Título): Macaquinho Solaris: alças cruzadas, cintura marcada

TEXTO PRINCIPAL:
Marca nova precisa mostrar, não prometer.
As alças do Solaris cruzam nas costas e sustentam. A costura na cintura marca a silhueta. Uma peça, visual inteiro.
80 unidades nesta coleção.
Quem está no Clube Éclat acompanha a produção e recebe antes.

CTA: Entre no Clube pelo WhatsApp para ver de perto · Botão: Enviar mensagem

A PÁGINA PRECISA CONFIRMAR: no grupo há foto real de detalhe e de bastidor.
```

```
ÂNGULO: objeção
HIPÓTESE: o que trava a compra de marca nova online é tamanho e confiança; enfrentar isso de frente converte.

HOOK
  Visual:        Camila falando para a câmera, fita métrica na mão
  Falado:        "Comprar roupa de treino online de marca que você nunca vestiu dá medo. Eu sei."
  Texto na tela: e se não servir?

HEADLINE (campo Título): Não serviu, você troca. Simples assim.

TEXTO PRINCIPAL:
Eu sou a Camila, fundadora da use.ÉCLAT.
No site tem o "Qual é o meu tamanho?", que indica o seu pela sua medida. Se ainda assim não servir, a troca é garantida [CONFIRMAR prazo da política].
[PRECISA: depoimento real de cliente sobre caimento, quando as primeiras entregas chegarem]
No Clube Éclat eu respondo dúvida de tamanho pessoalmente.

CTA: Me chama no WhatsApp e entra no Clube · Botão: Enviar mensagem

A PÁGINA PRECISA CONFIRMAR: o robô responde e a Camila atende dúvidas de tamanho no privado.
```

Teste: os quatro ângulos no mesmo conjunto de anúncios frio, mesma verba, 7 dias. Métrica de hook: % que passa
de 3 segundos e de 25%. Métrica de ângulo: custo por conversa iniciada. Com menos de 20 conversas por anúncio
não se elege vencedor.

## 5. O que depende de "pode aplicar"
1. Preços na Medusa: 159 / 259 e regra do conjunto em R$ 299. O feed do Google e o catálogo Meta acompanham sozinhos.
2. Meta: corrigir o filtro do conjunto de produtos; posicionamento manual no aquecimento; pausar "ponto de virada";
   redistribuir verba 30/12/8; criar o conjunto frio com os 4 criativos (PAUSED) quando os vídeos existirem.
3. Cupom de primeira compra de uso único, que não acumula com conjunto.
4. Da Camila: gravar os 4 vídeos (celular, 15 a 30s), confirmar os pontos `[CONFIRMAR]`, atualizar a planilha de custo.
