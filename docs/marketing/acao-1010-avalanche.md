# Ação 10/10 — "Primeira Remessa" (plano pela skill lancamento-avalanche)

> Montado em 15/09/2026. Fonte: estoque real da Medusa (30 variações), `architecture/ads.md` §7–8,
> `architecture/clube.md`, `roteiro-clube-eclat-prevenda.txt`, `site_content.prevenda`.
> Regra da casa: nada aqui é ligado sem "pode aplicar" do dono; anúncios nascem PAUSED.

## 0. Passo zero — vale a avalanche completa?

| Conta | Valor |
|---|---|
| Capacidade (unidades de venda) | 140 conjuntos (70 Aurora + 70 Orvalho) + 80 macaquinhos Solaris = **220** |
| Ticket da unidade | conjunto R$ 304,20 (R$ 169 + R$ 169 − 10% Benefício Conjunto) · macaquinho R$ 299 |
| Faturamento se esgotar tudo | R$ 66.508 |
| Potencial da largada (× 20%) | **≈ R$ 13.300** |

Veredito da skill: potencial < R$ 25 mil **e** pré-venda já aberta desde 15/09 (1 pedido). Não se
relança nem se monta a avalanche cheia. Monta-se **ação menor com gatilho verdadeiro**: **10/10**, data
dupla e o dia em que os envios começam de fato. A ação concentra em 48h (10/10 10h → 12/10 10h) a
venda que hoje está diluída na pré-venda.

## 1. Diagnóstico

### Produto
- Coleção: **Lumière** (Top Aurora, Short Aurora, Top Orvalho, Short Orvalho, Macaquinho Solaris; cores Telha e Grafitti).
- Entrega: envios a partir de **10/10/2026** (`site_content.prevenda.envios_a_partir`).
- Abertura da ação: **10/10 10h** (J1 24h) · virada 11/10 10h (J2) · fim 12/10 10h.
- Capacidade real: 360 peças (Solaris 80; Aurora 70+70; Orvalho 70+70). Já em pré-venda: 1 pedido.
- **Custo de realização: RESPONDIDO** (planilha real da Camila, "CUSTO POR PEÇA - LUMIÈRE", lida em
  15/09/2026 — detalhe completo em `custo-real-lumiere.md`). Custo por peça: Top Aurora R$ 47,71–47,76 ·
  Shorts Aurora R$ 53,44 · Top Orvalho R$ 47,98–48,07 · Shorts Orvalho R$ 58,14 · Solaris R$ 81,49–81,59.
  Isso é 24–34% do preço de venda — dentro da faixa saudável para anúncio pago. Custo total de produção
  das 220 unidades da ação (sem a camiseta masculina, que não entra nesta coleção): **R$ 21.037**.
  Achado: o preço do Solaris na planilha (R$ 259) diverge do preço real cobrado no site (R$ 299) —
  confirmar com a Camila qual está certo.
- Ticket: peça R$ 169 · macaquinho R$ 299 · conjunto R$ 304,20 (regra padrão do Benefício Conjunto,
  `total_percentual` 10% — **hoje INATIVA em produção**; ativar no Cockpit → Conjuntos antes do D-1).
- Lotes: não há. Reposição só por fila (enquete do grupo).

### Checkout
- Plataforma: Medusa com provedor manual `pp_system_default` rotulado "Pix pelo WhatsApp". O pedido
  nasce reservado; cobrança manual no WhatsApp. **Gargalo para 48h de pico** (ver §7, item 1).
- Link direto: sim — `/br/store`, `/br/conjuntos` e PDP por handle. Aguenta pico (Vercel + Railway).
- Pixel/CAPI: Purchase dispara na página de pedido concluído (antes do Pix) → contar como RESERVAS.
  UTM da ação: `utm_source=whatsapp&utm_medium=clube&utm_campaign=acao_1010`.

### Base e prova
- Grupo CLUB ÉCLAT: 96 membros (só admin publica). Leads no Cockpit (interesse "Clube Éclat").
- IG @eclat.use ≈ 6,1 mil. Sem influenciadoras/sócias mapeadas. Sem parceiro de brinde.
- Prova real: sem edição anterior. Prova disponível = bastidor, peça no corpo (Camila), embalagem, caixas saindo 10/10.

### Verba
- Hoje: R$ 50/dia (Clube WhatsApp R$ 20 · Aquecimento Reels R$ 20 · Catálogo R$ 10). Recarga combinada até 10/10.
- **Verba de mídia da ação: PERGUNTAR.** Plano abaixo em duas hipóteses: R$ 1.500 (piso realista, ≈ o que já está
  previsto até 10/10) e R$ 3.000. A skill pede piso R$ 5 mil para a avalanche cheia; para a ação menor, R$ 1.500 fecha.
- HRZ: não (potencial < 300 vendas).

### Público
- BR, mulheres 25–45 (públicos atuais). **Regiões que não convertem: PERGUNTAR** — sugestão de corte para a
  captação paga: Norte e parte do Nordeste (frete e prazo matam o conjunto); manter Sudeste + Sul + DF/GO.
- Objeções previstas: "tamanho" (respondida pela página "Qual é o meu tamanho?"), "só chega em outubro"
  (respondida pelo gatilho: quem compra 10/10 sai no primeiro lote), "Pix na mão" (respondida pelo Pix
  copia-e-cola com valor pronto).
- Frase do público (das enquetes do grupo): a preencher após a pesquisa do dia 04/10.

### Gatilho
- **10/10 — dia dos primeiros envios.** Verdadeiro, verificável, já está no roteiro (Dia 13 "caixas saíram hoje").

## 2. Go/no-go com número (`scripts/projecao.mjs`, CPL R$ 5, ticket R$ 302, capacidade 220, **custo real R$ 21.037**)

| Verba | Cadastros / no grupo | Pessimista 5% | Moderado 10% | Otimista 20% | Cobre o custo total da coleção? |
|---|---|---|---|---|---|
| R$ 1.500 | 165 / 132 | 8 vendas · R$ 2.416 · 1,6x | 17 · R$ 5.134 · 3,4x | 33 · R$ 9.966 · 6,6x | Não em nenhum cenário — falta R$ 11 mil a R$ 19 mil |
| R$ 3.000 | 330 / 264 | 17 · R$ 5.134 · 1,7x | 33 · R$ 9.966 · 3,3x | 66 · R$ 19.932 · 6,6x | Quase (falta R$ 1.105 no otimista) |

Meta "evento pago" = 70 vendas (32% da capacidade) para cobrir o custo total de produzir a coleção inteira.
Isso é *esperado e não é motivo pra não rodar*: a ação de 48h não precisa pagar sozinha a produção inteira —
a pré-venda continua depois do 10/10 e a fila de reposição também vende. O teste certo por venda (não pelo
evento inteiro) é a margem unitária, calculada em `custo-real-lumiere.md`:

| Cenário | CAC por venda | Margem no **conjunto** (R$ 304,20) | Margem na **peça avulsa** (R$ 169) |
|---|---|---|---|
| Pessimista (5%) | ≈ R$ 187 | prejuízo de ≈ R$ 59–64 (−19 a −21%) | prejuízo de ≈ R$ 110–120 |
| Moderado (10%) | ≈ R$ 89 | lucro de ≈ R$ 34–39 (11–13%) | prejuízo de ≈ R$ 12–22 |
| Otimista (20%) | ≈ R$ 45 | lucro de ≈ R$ 78–83 (26–27%) | lucro de ≈ R$ 22–32 (13–19%) |

Números atualizados em 15/09 com os % reais que a Camila informou (taxa de site/cartão 5%, cupom/comissão
médio 10%, além do imposto de 8% já usado) e a embalagem por envio (R$ 5,21/R$ 8,48) somada ao custo —
ver detalhe e ressalva sobre esses % em `custo-real-lumiere.md`. A base atual (96 no grupo + leads +
seguidoras) entra por cima dos cadastros novos, sem custo de anúncio — a 10% de conversão ela sozinha vale
≈ 10 vendas com margem orgânica cheia (sem CAC nem cupom, se a compra não usar cupom).

**Veredito revisado: RODAR a ação 10/10, mas só empurrando conjunto ou Solaris — nunca peça avulsa.**
Com os % reais, a peça avulsa dá prejuízo em quase todo cenário vindo de anúncio; só o conjunto sustenta
o cenário moderado (11–13% de margem, mais magro do que os 28–30% calculados antes de somar taxa e cupom).
O cenário de conversão fraca deixou de ser "quase empate" e virou prejuízo real (R$ 59 a R$ 120 por venda)
— reforça que o plano de recuo do item 9 abaixo (cortar região/criativo se o CPL passar de R$ 8) precisa
ser levado a sério nos primeiros 3 dias de captação, sem esperar a semana toda para agir.

## 3. Oferta avalanche

### Inventário de bônus (antes de qualquer desconto)
| Fonte | Item | Custo real | Valor percebido | Janela |
|---|---|---|---|---|
| Próprio | **Frete grátis** (Sudeste/Sul) | ≈ R$ 20–30/pedido (confirmar) | alto, mensurável | J1 + J2 |
| Próprio | **Pulseira da coleção** | PERGUNTAR (existe? quantas?) | alto (peça de identidade) | J1 |
| Próprio | **Kit de mãos** (10 primeiras) | PERGUNTAR (existe? 10 unidades?) | alto | J1 |
| Próprio | Caixa-gaveta com aroma + embalagem de presente | já é o padrão de toda entrega | prova, não bônus | todas |
| Experiência | **Sai no primeiro lote de 10/10** (rastreio no mesmo dia) | R$ 0 | alto — é o gatilho | J1 |
| Experiência | Live 09/10 com a Camila provando as peças, pergunta ao vivo | R$ 0 | médio | D-1 |
| Sorteio | 1 Macaquinho Solaris entre as compradoras da J1 | 1 peça (custo) | alto | J1 |
| Comunidade | Prioridade na fila de reposição (cor/tamanho que esgotar) | R$ 0 | médio | J1 + J2 |
| Parceiro | nenhum mapeado | — | — | — |

### Escada de janelas
| Janela | Quem | Preço | Bônus | Sorteio | Escassez real (número no sistema) |
|---|---|---|---|---|---|
| **J1 — 10/10 10h → 11/10 10h** | todas; 10 primeiras extra | tabela + Benefício Conjunto 10% (permanente, não é desconto da ação) | frete grátis + pulseira + primeiro lote; 10 primeiras: kit de mãos | 1 Solaris | kit de mãos = 10 unidades; pulseiras = N cadastrado; estoque por cor/tamanho (marcador `{{ultimas_unidades}}`) |
| **J2 — 11/10 10h → 12/10 10h** | todas | tabela + Benefício Conjunto | frete grátis | — | fim da janela (hora fixa) |
| **Normal — 12/10 10h em diante** | todas | tabela, frete pago | — | — | estoque; reposição só por fila |

Sem desconto seco em nenhuma janela: o Benefício Conjunto já é a condição de preço da marca e o Pix já é o
único pagamento (não há "desconto no Pix" para dar). Se o dono quiser desconto real na J1, teto de 5% e só no conjunto.

### Dois públicos
| | Premium — **Conjunto** (top + short) ou Solaris | Básica — peça avulsa |
|---|---|---|
| Preço | R$ 304,20 · Solaris R$ 299 | R$ 169 |
| Bônus J1 | frete grátis + pulseira + kit de mãos (10 primeiras) + sorteio | frete grátis (1 brinde só) |
| Bônus J2 | frete grátis | — |

### Ancoragem (uma frase, para o D-1)
"Top + short de tabela dá R$ 338, mais frete, mais a pulseira da coleção. Na abertura de 10/10: R$ 304, frete por nossa conta, pulseira na caixa, e sua peça sai no primeiro lote."
(valores da pulseira/kit entram na frase quando o dono informar.)

### Teste final
- Sem desconto a oferta segura a compra na primeira hora? Sim: primeiro lote + frete grátis + pulseira resolvem o "só chega em outubro".
- Cada escassez tem número: kit de mãos 10 (contar por pedido no Cockpit), pulseiras N (informar), estoque por variação (snapshot do Clube).
- Serve para qualquer nicho? Não — fala de Lumière, Solaris, primeiro lote e caixa-gaveta.

## 4. Verba e projeção (55 / 25 / 20)

| Bloco | R$ 1.500 | R$ 3.000 | Onde |
|---|---|---|---|
| Captação 55% (25/09 → 08/10, 14 dias) | R$ 825 ≈ R$ 59/dia | R$ 1.650 ≈ R$ 118/dia | conjunto Clube WhatsApp 120250160265150107 (Conversas → WhatsApp → robô → grupo). Só ele. |
| Aquecimento 25% (25/09 → 09/10) | R$ 375 ≈ R$ 25/dia | R$ 750 ≈ R$ 50/dia | conjunto Aquecimento Reels 120250160320680107 (ThruPlay; seguidoras + IG 365d) |
| Disparos + vendas 20% (10/10 → 12/10) | R$ 300 = R$ 100/dia | R$ 600 = R$ 200/dia | campanha F1 catálogo 120250224901140107 (remarketing: engajou + clube + site) |

Mudança em relação ao reequilíbrio de 15/09: o catálogo F1 (R$ 10/dia) **fica pausado durante a captação**
(regra da skill: anúncio → cadastro → grupo, nunca → checkout) e volta só no D0 com o bloco de 20%.
Os três indicadores a acompanhar todo dia no Gerenciador: **custo por conversa iniciada** (meta ≤ R$ 6),
**taxa de entrada no grupo** (leads "Clube Éclat" no Cockpit ÷ conversas; meta ≥ 70%), e na venda,
**ticket médio** (meta ≥ R$ 280 → conjunto, não peça).

Disparo 1x1: a skill prevê API oficial a R$ 0,24/msg. A ÉCLAT está na Evolution (não oficial) e **disparo em
massa é proibido** (protege o número). Substituto nesta ação: follow-up individual pelo Cockpit → Leads
(quem virou lead e não entrou no grupo), no máximo 40/h, texto curto, feito por pessoa, em D-1 e H0.
Para a próxima ação: WhatsApp Cloud API oficial (~2 dias), aí o 1x1 entra de verdade.

## 5. Cronograma em D-dias (D0 = sexta 10/10 10h)

| Quando | D | O quê | Quem |
|---|---|---|---|
| 16–24/09 | D-24 → D-16 | Roteiro Dias 1–5 como está. Setup: Pix copia-e-cola por valor, ativar regra padrão do Conjunto, opção de frete grátis 10/10 no Medusa, cadastrar N de pulseiras/kits, artes D-5…D-1, campanhas 10/10 criadas PAUSED | Camila (Pix, brindes) · agente (Cockpit/Medusa/Meta) |
| 25/09 | D-15 | **Captação liga** (Clube WhatsApp no valor do bloco 55%; catálogo pausado). Aquecimento no valor do bloco 25% | dono liga ("pode ativar") |
| 26/09–02/10 | D-14 → D-8 | Roteiro Dias 6–9 (shorts, tamanho, caixa, bastidor). Leitura diária: CPL, entradas, `connectionState` | agente lê, Camila posta |
| 04/10 10h | D-6 | Dia 10 vira **pesquisa de necessidade** (tamanho, cor, cidade, o que pesa) — abastece a oferta e a fila | Clube (agenda) |
| 05/10 | D-5 | Feed: contagem regressiva D-5…D-1. Stories diários: bastidor + "entra no grupo" (único CTA) | Camila |
| 06/10 19h30 | D-4 | Dia 11: unboxing real (só com as peças na mão) | Camila |
| 07/10 19h30 | D-3 | Tensão: "quinta 09/10 às 19h30 revelo a condição do 10/10. Só aqui." | Clube (agenda) |
| 08/10 | D-2 | **Captação desliga** (fim 08/10 23:59). Segurança: Pix testado, frete grátis testado no carrinho, foto de cada peça pronta | agente + Camila |
| 09/10 19h30 | **D-1** | **OFERTA REVELADA** (arte + mensagem §6). 20h live no IG: Camila prova as peças, mostra pulseira/kit, responde. Follow-up individual para leads fora do grupo | Camila · Clube (agenda) |
| 10/10 08h | H-2 | "Abre às 10h em ponto. Link cai aqui." | Clube (agenda) |
| 10/10 10h | **H0** | **ABRIU** — link `/br/conjuntos?utm_campaign=acao_1010`. Remarketing (bloco 20%) liga | Clube (agenda) · dono liga o anúncio |
| 10/10 13h | H+3 | Prova social com número real: `{{reservas_hoje}}` reservas; "faltam N kits de mãos" | Clube (gatilho `marco_reservas` ou manual) |
| 10/10 19h30 | H+9 | Dia 13: caixas do primeiro lote saindo (foto real) — prova do gatilho | Camila |
| 11/10 10h | +24h | Virada: J1 fechou, J2 até 12/10 10h (frete grátis). Sorteio do Solaris entre as compradoras da J1 (print) | Clube (agenda) |
| 12/10 10h | +48h | Fechamento: condição encerrada, tabela + frete; fila de reposição por cor/tamanho | Clube (agenda) |
| 13/10 | pós | Relatório projetado × realizado (CPL, entrada, conversão, ticket, faturamento 48h) → `playbook.md` Casos. Grupo continua com a Camila | agente |

## 6. Sequência do grupo (substitui Dias 10–14 do roteiro; Dias 1–9 ficam)

Horário fixo 19h30 (enquetes às 10h). Frases curtas. Marcadores `{{…}}` são preenchidos pelo Clube
(automação) na hora do envio — frase com marcador vazio some sozinha. `[PREENCHER]` bloqueia a aprovação.

**D-6 · sábado 04/10 · 10h · pesquisa (abrir o grupo por 1h)**
Bom dia. Antes de fechar a ordem das caixas, me ajuda em 1 minuto: qual seu tamanho, qual cor você quer (Telha ou Grafitti), sua cidade, e o que mais pesa na hora de decidir. Responde aqui mesmo. É isso que define a fila de reposição.

**D-3 · terça 07/10 · 19h30 · tensão**
Quinta, 09/10, às 19h30, eu conto aqui a condição de 10/10. Não vai para o Instagram. Só para quem está neste grupo.

**D-1 · quinta 09/10 · 19h30 · OFERTA REVELADA · anexar: arte "10/10 — Primeira Remessa"**
Sexta 10/10, às 10h, começam os envios da Lumière. Quem garantir a peça nas primeiras 24h sai no primeiro lote, com frete por nossa conta e a pulseira da coleção na caixa. As 10 primeiras levam também o kit de mãos. Entre as compradoras das 24h, sorteio de um Macaquinho Solaris. Até domingo 10h: frete continua por nossa conta. Depois, tabela. O link cai aqui às 10h em ponto. Às 20h estou ao vivo no Instagram provando as peças.

**D0 · sexta 10/10 · 08h**
Abre às 10h em ponto. O link cai aqui. Separa o seu tamanho na cabeça: {{ultimas_unidades}}.

**D0 · sexta 10/10 · 10h · ABRIU · anexar: {{foto:top-aurora:telha}}**
ABRIU. https://www.useeclat.com.br/br/conjuntos?utm_source=whatsapp&utm_medium=clube&utm_campaign=acao_1010
Nas próximas 24h: primeiro lote, frete por nossa conta, pulseira na caixa. As 10 primeiras levam o kit de mãos. Pedido feito, o Pix chega no seu WhatsApp em seguida.

**D0 · sexta 10/10 · 13h · prova social (só sai se houver número)**
{{reservas_hoje}} peças já garantidas hoje. {{ultimas_unidades}}. Quem ainda quer entrar no primeiro lote: o link está na mensagem de cima.

**D0 · sexta 10/10 · 19h30 · anexar: foto real das caixas saindo (Dia 13 do roteiro)**
[PREENCHER com o número real, ex.: "23 caixas"] saíram hoje. O rastreio de cada pedido vai no privado assim que a transportadora registrar. Quem garantir até amanhã 10h ainda pega a pulseira e o frete por nossa conta.

**+24h · sábado 11/10 · 10h · virada**
Fechou a janela das 24h. Até amanhã, domingo, 10h: frete continua por nossa conta. {{ultimas_unidades}}. {{esgotados}}. Sorteio do Solaris entre as compradoras de ontem sai hoje às 19h30, aqui, com print.

**+48h · domingo 12/10 · 10h · fechamento (substitui o Dia 14)**
Encerrou a condição de 10/10. A partir de agora é tabela, com frete calculado no site. {{esgotados}}. Quem ficou sem a sua cor ou tamanho: responde aqui com "fila + cor + tamanho" e você é a primeira a saber da reposição. Obrigada por estarem aqui desde o começo.

**Sorteio · sábado 11/10 · 19h30**
[PREENCHER com o print do sorteio e o primeiro nome da ganhadora]. Solaris vai com o pedido dela, sem custo. Obrigada, meninas.

Fora do grupo (Camila grava e posta): stories diários 05–09/10 com bastidor + "entra no grupo" (único CTA);
3 vídeos de 15–30 s para o anúncio de captação: "o que é a Lumière", "pra quem é", "10/10 começam os envios —
entra no Clube". Sem preço, sem condição.

## 7. Checklist de execução

1. **Checkout Pix (gargalo).** Camila gera no banco 3 Pix copia-e-cola com valor fixo: R$ 304,20 (conjunto),
   R$ 299,00 (Solaris), R$ 169,00 (peça); mais um sem valor para combinações. Salvar como respostas rápidas no
   WhatsApp Business. Fluxo: pedido no site → página "Sua peça está reservada" já manda para o WhatsApp com o
   número do pedido → Camila responde com o Pix do valor → confirma → Cockpit → Pedidos → marcar pago.
   Meta de atendimento na J1: Pix enviado em até 10 min. Getnet (Parte 4) fica para depois da ação.
2. **Benefício Conjunto**: ativar a regra padrão (10%) no Cockpit → Conjuntos e testar top + short no carrinho = R$ 304,20.
3. **Frete grátis J1/J2**: criar opção de frete "Frete por nossa conta — 10/10" no Medusa Admin (R$ 0, Sudeste/Sul),
   ligar 10/10 10h e desligar 12/10 10h; testar no checkout antes do D-1.
4. **Capacidade cadastrada**: 10 kits de mãos (contagem por pedido no Cockpit); N pulseiras (informar); estoque por
   cor/tamanho já no snapshot do Clube. Sem número, o bônus sai da mensagem.
5. **Pixel/UTM**: links da ação com `utm_campaign=acao_1010`; conferir Purchase (reserva) no Events Manager no D0.
6. **Anúncios (PAUSED até o dono ligar)**: captação = conjunto Clube WhatsApp no valor do bloco 55% (25/09–08/10);
   aquecimento no bloco 25%; F1 catálogo pausado até 10/10 10h e ligado com o bloco 20% até 12/10 10h.
   Cortar regiões que não convertem antes de ligar.
7. **Clube (automação)**: agenda acima cadastrada e aprovada (Cockpit → Clube → Agenda); regras `ultima_unidade`
   e `esgotado` ligadas durante as 48h; `marco_reservas` ligada a cada 5 pedidos; master switch ON; `connectionState`
   conferido às 09h de 09/10, 10/10, 11/10, 12/10.
8. **Quem grava / quem posta**: Camila grava 3 vídeos de captação (até 24/09) e faz a live de 09/10 20h; agenda do
   grupo sai pelo Clube; stories manuais.
9. **Plano de recuo**: CPL > R$ 8 por 3 dias → cortar região/criativo, não aumentar verba. Grupo < 150 em 05/10 →
   mantém a ação, corta o sorteio. Sessão do WhatsApp cair → Clube pausa sozinho e avisa; enviar pelo celular.
   Pix travar (> 15 min de fila) → mensagem no grupo "Pix chega em ordem de pedido, ninguém perde a janela".
10. **Pós (13/10)**: projetado × realizado em `playbook.md` (Casos); pedidos pagos, CPL real, entrada no grupo,
    conversão da base, ticket médio, frete gasto.

## Perguntas em aberto (sem elas o plano não fecha)
1. ~~Custo de realização do lote~~ — **respondido** com a planilha real (`custo-real-lumiere.md`).
2. Verba de mídia para 25/09 → 12/10: R$ 1.500 ou R$ 3.000?
3. Pulseira da coleção e kit de mãos: existem, quantos, custo unitário?
4. Frete médio real (Sudeste/Sul) para bancar o "frete por nossa conta" — e quais regiões cortar.
5. Confirmar D0 = 10/10 10h e as duas janelas (11/10 10h · 12/10 10h).
6. Confirmar o preço real do Macaquinho Solaris: R$ 259 (planilha de custo) ou R$ 299 (site/feed)?
