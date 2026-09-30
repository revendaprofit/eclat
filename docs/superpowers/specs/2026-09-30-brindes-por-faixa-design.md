# Presente por faixa de compra (meia e óculos) — desenho (2026-09-30)

> Decisão do dono em 2026-09-30. CLAUDE.md é lei (Data-First: este desenho precisa de aprovação antes do código).
> Custos e estoque reservado ficam em `contexto-claude/eclat-brindes-por-faixa.md` (repositório público).

## Regras aprovadas pelo dono (2026-09-30)
1. **A partir de R$ 250 em peças: meia Éclat de presente. A partir de R$ 550: óculos Éclat de presente.** Um presente
   por pedido (no R$ 550 é o óculos, não óculos + meia).
2. O valor que conta é **o que a cliente paga pelas peças já com cupom ou Benefício Conjunto, sem frete e sem o
   desconto do Pix** — a mesma base do frete grátis (`calcularBase`, `modules/superfrete/base-carrinho.ts`).
3. **Cupom de parceira (NOME10, NOME20) e presente valem juntos.** O cupom baixa a base e por isso sobe a exigência.
   Cupom não soma com conjunto (maior desconto por peça, como hoje); Pix 5% soma com tudo (como hoje).
4. A comissão da parceira não muda: o presente entra a R$ 0 e não mexe no `item_total`.
5. **BEMVINDA10 sai** do pop-up e da barra do topo; o código segue ativo 7 dias para quem já recebeu e depois é
   desligado.
6. Óculos à venda por **R$ 129** (produto novo, categoria Acessórios), sem anúncio próprio.

## Como a cliente vê
- **Sacola e resumo do checkout:** barra de progresso no molde da `FreteGratisBarra`:
  "Faltam R$ 41,00 para ganhar uma meia Éclat" → "Você ganhou uma meia Éclat! Escolha a sua" → (acima de R$ 250)
  "Faltam R$ 32,00 para trocar pelo óculos Éclat".
- **Escolha do presente:** meia = cor + tamanho (34–38 / 39–43); óculos = modelo. Só aparecem variantes com estoque.
  A linha entra na sacola como **"Presente — Meia Éclat (Cinza & Grafitti, 34–38) · R$ 0,00"**, sem seletor de
  quantidade; tem "trocar" e "remover".
- A partir de R$ 550 ela pode ficar com a meia ou trocar pelo óculos (um presente só). Se o óculos esgotar, a faixa
  de R$ 550 some e continua valendo a meia.
- **Se a sacola cair abaixo da faixa** (tirou peça, trocou cupom), o presente sai sozinho e aparece o aviso
  "Seu presente saiu porque a sacola ficou abaixo de R$ 250". Óculos abaixo de R$ 550 sai; se ainda passar de R$ 250,
  volta o convite para escolher a meia.
- Quem não escolhe não ganha (o tamanho da meia depende dela). No checkout, antes do pagamento, um lembrete não
  bloqueante: "Você tem um presente para escolher".
- **Barra do topo:** a frase do cupom vira "Meia de presente a partir de R$ 250". Pop-up: ver "Pergunta em aberto 1".

## Dados (Data-First) — PRECISA DE APROVAÇÃO
Sem tabela nova. Configuração em `site_content` key **`brindes`** (editável depois no Cockpit → Marketing):
```json
{
  "ativo": true,
  "inicio": "2026-10-01T00:00:00-03:00",
  "faixas": [
    { "id": "meia",   "minimo_centavos": 25000, "product_handle": "meia-cano-medio", "limite": 30 },
    { "id": "oculos", "minimo_centavos": 55000, "product_handle": "oculos-eclat",   "limite": 15 }
  ]
}
```
- `limite` = quantos presentes daquela faixa podem sair desde `inicio` (estoque reservado para presente; o resto da
  meia/óculos segue à venda). Sem a key ou com `ativo: false`, não existe presente (a vitrine não mostra nada).
- **Linha do presente no carrinho/pedido:** produto e variante normais (o estoque baixa de verdade), `unit_price = 0`
  (preço fixado pelo backend, `is_custom_price`), `quantity = 1`, `metadata = { "brinde": "meia" | "oculos" }`.
- **Contagem do limite:** subscriber de `order.placed` grava `order.metadata.brinde = "meia" | "oculos"`; o backend
  conta os pedidos não cancelados desde `inicio` com essa marca (volume pequeno, leitura direta).

## Onde vai no código
### Backend
- `src/modules/brinde/regra.ts` (puro, testado): faixa atingida pela base; presente permitido; linha válida (1 só,
  quantidade 1, preço 0, produto da faixa, base ≥ mínimo, limite não atingido).
- **Rota nova** `POST /store/carts/:id/brinde` `{ variant_id }` → valida pela regra, remove presente anterior e
  adiciona a linha com preço 0 (`addToCartWorkflow` com `unit_price`). `DELETE /store/carts/:id/brinde` remove.
  `GET /store/brindes` → faixas ativas e se ainda há presente (para a vitrine).
  O cliente nunca manda preço: a loja padrão não aceita `unit_price` do navegador; só esta rota põe preço 0.
- **Trava** (mesmo lugar do pedido mínimo): middleware em `POST /store/payment-collections` e
  `completeCartWorkflow.hooks.validate` recusam carrinho com presente inválido (base abaixo, quantidade > 1, dois
  presentes, limite estourado). Fecha a brecha de alguém mudar a quantidade da linha de R$ 0 pela API padrão.
- Nada muda no Benefício Conjunto (`linhasDoCarrinho` já ignora linha de preço ≤ 0), no pedido mínimo (linha 0 soma 0)
  nem na base do frete grátis.
- **Nota fiscal:** `lib/fiscal/fiscal-payload.ts` hoje poria o presente como item de venda a R$ 0. Ver "Pergunta em
  aberto 2" — até o contador responder, a linha de presente usa o CFOP de `FISCAL_CFOP_BRINDE` se existir; sem ela, a
  emissão automática do pedido com presente para e cai para emissão manual (nunca emite com CFOP errado).
- Meta CAPI: `contents` sem a linha de presente (o `value` já é o total do pedido e não muda).

### Vitrine
- `lib/util/brinde.ts` (puro, testado, espelho da regra) + `lib/data/brinde.ts` (chamadas às rotas).
- `modules/cart/components/brinde-barra` (progresso + escolha), usado em `cart/templates/summary.tsx` e no resumo do
  checkout; `cart/components/item` mostra a linha de presente sem quantidade.
- `ajustarBrinde(cart)` depois de cada mudança de sacola (mesmo ponto de `ajustarDescontoPix`): tira o presente que
  ficou inválido e devolve o aviso.
- **Um cupom por sacola** (pendência R5 das parcerias): o código novo substitui o anterior (PIX5 continua oculto e
  mantido). Sem isso, PATY10 + ERIKA20 somariam 30%.
- Barra do topo e pop-up (textos); GA4 sem a linha de presente nos `items`.
- Óculos fora dos feeds do Google e do catálogo da Meta (como as meias).

### Cockpit
- Pedido e Envios mostram a etiqueta **"Presente"** na linha; o despacho confere o código de barras como qualquer
  item (o presente precisa estar na caixa).
- DRE: o custo do presente entra sozinho pelo `produto_custo` da variante — cadastrar o custo da meia e do óculos.

### Dados de produção (script, só com "pode aplicar")
- Produto **Óculos Éclat** (`oculos-eclat`, R$ 129, Acessórios, estoque 30, modelos como variantes) — depende de
  fotos e nomes (sócia).
- `site_content.brindes` com as faixas; custo da meia e do óculos no `produto_custo`.
- BEMVINDA10: desligar o convite (pop-up/barra) no dia 1; desativar o código 7 dias depois (`scripts/cupom.mjs`).

## Fases (Halt entre elas)
- **F0 — prova de conceito em produção** (carrinho de teste `@eclat.local`, sem pagamento): linha com preço 0 via
  rota, e conferir que continua a R$ 0 depois de mudar quantidade de outra peça, aplicar PATY10, aplicar PIX5 e
  recalcular frete. Critério: preço da linha segue 0, total certo, conjunto e cupom intactos.
- **F1 — backend:** regra + testes, rotas, travas, subscriber, CAPI. `railway up`.
- **F2 — vitrine:** barra, escolha, linha, `ajustarBrinde`, um cupom por sacola, textos, GA4, feeds. Push.
- **F3 — Cockpit e fiscal:** etiqueta, custos, CFOP (depois da resposta do contador).
- **F4 — ligar:** óculos cadastrado, `site_content.brindes`, BEMVINDA10 fora; conferir com carrinhos de teste
  (conjunto sem cupom, conjunto com PATY10, Solaris com PATY10 = sem presente, 2 conjuntos = óculos).
  A meia pode ligar antes do óculos (faixa do óculos só entra no `site_content` quando o produto existir).

## Perguntas em aberto
1. **Pop-up de captação.** Sem o cupom, o que oferecer em troca do WhatsApp? Proposta: "Presente na sua compra: meia
   Éclat a partir de R$ 250. Deixe seu WhatsApp e receba lançamentos e reposições antes de todo mundo." Pode baixar a
   captação; medir 14 dias (contatos por visita) contra o período do BEMVINDA10.
2. **Contador:** presente sai na mesma NF-e da venda como bonificação (CFOP 5.910/6.910, com valor do produto) ou
   como item a R$ 0? Só ele define; o desenho não emite nota de presente sem essa resposta.
3. **Estoque reservado para presente:** proposta 30 meias (de 60) e 15 óculos (de 30).
4. **Óculos:** fotos, nomes dos modelos e quantidade por modelo (sócia).
