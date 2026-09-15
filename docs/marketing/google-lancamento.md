# Google no lançamento ÉCLAT — Merchant Center, Shopping e Search (14/09/2026)

> Pré-requisito de tudo: a loja PÚBLICA. Enquanto o gate "Em breve" estiver ligado, toda URL de produto
> devolve a página "Em breve" (HTTP 200), o sitemap lista só `/em-breve` e o Merchant Center reprova
> cada item por "página de destino não corresponde". Preparar tudo agora; enviar o feed e ligar as
> campanhas no dia da abertura pública (D+1 do VIP).

## O que já está pronto no site
- Feed `https://www.useeclat.com.br/feed.xml` (RSS 2.0 do Google, nível variante): 30 itens da Lumière,
  `item_group_id`, preço, estoque real, cor, tamanho, `identifier_exists=no` (marca própria sem GTIN),
  até 10 imagens extras por item. Commit `ee800d4` acrescentou `google_product_category`
  (Activewear › Sports Bras / Active Shorts / Active Pants), `gender=female`, `age_group=adult`.
- Verificação do Search Console via meta tag (Cockpit → Marketing), sitemap.xml, robots.txt, JSON-LD
  Product/Organization, GTM `GTM-55868KTG` com GA4 `G-SMNTL1HG1J`, Google Ads `AW-18320132694`
  (tag global + vinculador de conversões disparando).
- Feed do Merchant também alimenta o catálogo da Meta (sincronização diária 03:00, última: 30/30 itens OK).

## Merchant Center — passo a passo (dono)
1. merchants.google.com → Criar conta → País Brasil, nome "use.ÉCLAT". Usar o mesmo Google do Search Console.
2. Informações da empresa: nome, site `https://www.useeclat.com.br`, endereço comercial (não aparece na loja).
3. **Reivindicar o site**: o Merchant herda a verificação do Search Console (mesma conta) → "Reivindicar".
4. **Frete**: Configurações → Frete e devoluções → criar serviço "Brasil" com prazo e valor (tabela por CEP ou
   valor fixo; o que estiver no checkout). Sem isso, nenhum item é aprovado.
5. **Devoluções**: política de devolução com prazo (mínimo 7 dias, CDC) e link `/br/trocas-e-devolucoes`.
6. **Feed**: Produtos → Adicionar produtos → "Adicionar produtos de um arquivo" → URL programada
   `https://www.useeclat.com.br/feed.xml`, diária, 04:00 (depois da sincronização de estoque). Idioma pt, país BR.
7. Aguardar a análise (1 a 3 dias úteis). Corrigir avisos em Produtos → Diagnóstico.
8. **Listagens gratuitas** ficam ligadas por padrão (aparece na aba Shopping sem pagar).
9. Vincular ao Google Ads: Configurações → Contas vinculadas → Google Ads (ID da conta AW-18320132694).

Checklist de aprovação de vestuário no BR: título com modelo + cor + tamanho ✓, imagem sem texto/marca d'água ✓
(fotos do ensaio), preço igual ao site ✓, `gender`/`age_group`/`color`/`size` ✓, frete configurado (passo 4),
política de devolução (passo 5), site público (gate desligado).

## Google Ads — o que ligar, em ordem (dono, com o material abaixo)

**Antes de qualquer campanha:** conferir em Google Ads → Metas → Conversões se existe a ação "Compra"
(evento `purchase` do dataLayer via GTM). Se não existir: criar conversão "Compra" tipo Site com valor,
gerar o rótulo e adicionar a tag de conversão no GTM disparando no evento `purchase` (mesmo padrão da tag
do Pixel). Sem isso, Shopping e PMax otimizam às cegas.

### Etapa 1 (dia da abertura pública): Marca + Shopping padrão — R$40/dia
| Campanha | Tipo | Diária | Lance | Para quê |
|---|---|---|---|---|
| ECLAT_Search_Marca | Pesquisa, só palavras da marca | R$10 | Maximizar cliques (teto R$1,50) | quem viu no Instagram e pesquisa "eclat" |
| ECLAT_Shopping_Lumiere | Shopping padrão (não PMax), todos os produtos | R$30 | CPC manual R$0,80 → Maximizar cliques na 2ª semana | aparecer com foto e preço em "macaquinho fitness", "short fitness cós alto" |

Configurações: Brasil, "Presença" (pessoas no Brasil), sem Parceiros de pesquisa, sem Rede de Display,
idioma português. Shopping: prioridade média, um grupo de anúncios "Todos os produtos" subdividido por
`product_type` (Macaquinho / Top / Short) para ver o que vende.

### Etapa 2 (após ~30 dias ou 30 compras): não-marca e PMax
- Pesquisa não-marca (exata + frase): "macaquinho fitness", "macaquinho academia feminino", "short fitness
  cós alto", "top fitness sustentação", "moda fitness premium", "roupa de treino feminina premium".
- Performance Max com feed + exclusão de marca (senão canibaliza a campanha de marca), públicos: visitantes
  do site, lista de e-mails/WhatsApp do Clube, e "moda fitness" como sinal.
- Só ligar com a conversão de compra funcionando e estoque reposto: PMax com 30 unidades esgota e segue
  gastando em página "esgotado".

## Material da campanha de Pesquisa (marca) — pronto para colar

Ad group structure:
- AG1 [marca ÉCLAT]: [eclat] (exata), [use eclat] (exata), [useeclat] (exata), "eclat fitness" (frase),
  "eclat moda fitness" (frase), "eclat use" (frase), [eclat lumière] (exata), "eclat macaquinho" (frase) → RSA1
- AG2 [marca + intenção]: "eclat loja" (frase), "eclat site" (frase), "eclat comprar" (frase),
  "eclat preço" (frase), "eclat tamanho" (frase) → RSA2

Negative keywords:
  Campaign-level:
    - eclat cosméticos
    - eclat perfume
    - eclat maquiagem
    - eclat restaurante
    - eclat significado
    - eclat francês
    - team wod
    - grátis
  Ad-group level:
    - AG1: vagas, trabalhe conosco, revenda, atacado
    - AG2: reclamação, reclame aqui, cupom, desconto

Sitelinks (≥4):
  - Macaquinho Solaris | Peça única, do treino ao café | Telha ou Grafitti, P ao G | https://www.useeclat.com.br/br/products/macaquinho-solaris
  - Tops Aurora e Orvalho | Sustentação de verdade | Dois recortes, duas atitudes | https://www.useeclat.com.br/br/store
  - Shorts Aurora e Orvalho | Cós alto, sem enrolar | Costura que valoriza | https://www.useeclat.com.br/br/store
  - Guia de medidas | Descubra o seu tamanho | P, M ou G em 1 minuto | https://www.useeclat.com.br/br/guia-de-medidas
  - Trocas e devoluções | Regras claras da loja | Sem letra miúda | https://www.useeclat.com.br/br/trocas-e-devolucoes

Callouts (≥4, each ≤25 chars):
  - Marca 100% brasileira
  - Envio para todo o Brasil
  - Coleção Lumière
  - Modelagem P, M e G
  - Compra direta da marca
  - Embalagem premium

Structured snippet: Tipos: Macaquinho, Tops, Shorts

RSA1 — AG1 marca ÉCLAT
  Final URL: https://www.useeclat.com.br/?utm_source=google&utm_medium=cpc&utm_campaign=search_marca
  Path1: loja   Path2: lumiere
  Headlines (15, each ≤30 chars):
    1. ÉCLAT | Loja Oficial (20)
    2. use.ÉCLAT Moda Fitness (22)
    3. Coleção Lumière ÉCLAT (21)
    4. Athleisure da Mulher Inteira (28)
    5. Marca Brasileira Independente (29)
    6. Macaquinho Solaris ÉCLAT (24)
    7. Tops e Shorts Aurora (20)
    8. Tops e Shorts Orvalho (21)
    9. Cores Telha e Grafitti (22)
    10. Compre na Loja Oficial (22)
    11. Enviamos para Todo o Brasil (27)
    12. Sustentação Real no Treino (26)
    13. Do Treino ao Dia Inteiro (24)
    14. Peças em P, M e G (17)
    15. A Caixa É o Primeiro Produto (28)
  Descriptions (4, each ≤90 chars):
    1. Loja oficial ÉCLAT: macaquinho, tops e shorts da Coleção Lumière. Envio para o Brasil. (87)
    2. Moda fitness premium e independente. Peças que sustentam no treino e seguem o dia inteiro. (90)
    3. Coleção Lumière nas cores Telha e Grafitti. Tamanhos P, M e G. Compre direto da marca. (86)
    4. Athleisure da mulher inteira. Modelagem de quem treina e embalagem que você guarda. (83)
  Pinning: H1 "ÉCLAT | Loja Oficial" fixado na posição 1; demais livres.

RSA2 — AG2 marca + intenção
  Final URL: https://www.useeclat.com.br/br/store?utm_source=google&utm_medium=cpc&utm_campaign=search_marca_intencao
  Path1: loja   Path2: colecao
  Headlines: reutilizar as 15 de RSA1 trocando a 10 por "Ver Toda a Coleção" (19) e a 14 por "Guia de Medidas Online" (22).
  Descriptions: as mesmas 4 de RSA1.
  Pinning: nenhum.

## Medição semanal (8 números)
Gasto · cliques · compras (conversão "Compra") · custo por compra · receita · ROAS · parcela de impressão da
marca · termos de pesquisa desperdiçados (negativar). Alvo inicial: marca com parcela de impressão > 90%;
Shopping com custo por compra abaixo de R$120 (ticket médio ~R$200).
