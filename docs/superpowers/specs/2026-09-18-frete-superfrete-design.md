# Frete e etiquetas — SuperFrete

Data: 2026-09-18 · Status: **desenho aprovado pelo dono em 2026-09-18; aguardando revisão desta spec** · Branch `feat/frete-superfrete` (worktree `../eclat-wt-frete`) · SOP a atualizar: `architecture/envios.md` · Relaciona-se com: Fiscal Brasil NFe (chave da nota na etiqueta), Benefício Conjunto e cupons (base do frete grátis), DRE (linha Frete).

## 1. Contexto e objetivo

Hoje o checkout cobra um frete fixo ("Entrega Padrão", `price_type: flat`, provider `manual_manual`) e o Cockpit despacha em modo manual: o operador compra a etiqueta fora do sistema e digita o rastreio. A integração com transportadora em `apps/cockpit/lib/shipping.ts` foi preparada para o Melhor Envio e nunca foi ligada.

Em 2026-09-18 o dono decidiu usar a **SuperFrete**. Esta spec entrega duas coisas:

1. **Cotação real no checkout**: preço e prazo por CEP, com a regra comercial da ÉCLAT (margem, arredondamento, frete grátis).
2. **Etiqueta pelo Cockpit**: o botão "Gerar etiqueta" compra a etiqueta na SuperFrete, grava o rastreio no Medusa e avisa a cliente.

## 2. Decisões já tomadas (não reabrir)

1. **Transportadora: SuperFrete.** Substitui o Melhor Envio preparado. Sem segundo agregador.
2. **Serviços na vitrine: Mini Envios (17), PAC (1) e SEDEX (2).** Jadlog, Loggi e J&T ficam fora.
3. **Preço para a cliente** = cotação + margem de embalagem, arredondado para cima até o próximo final `,90`. Margem inicial: R$ 2,00.
4. **Frete grátis** quando o valor das peças **já com descontos** (cupom e Benefício Conjunto), sem o frete, atinge o piso: um piso para destino MG e outro para o resto do Brasil. Valores iniciais: R$ 499,00 (MG) e R$ 599,00 (demais UFs).
5. **O que fica grátis:** a opção mais barata disponível sai por R$ 0. O SEDEX cobra só a diferença entre o preço normal dele e o preço normal da opção mais barata.
6. **Embalagens:** 1 peça → saquinho 15×15; 2 peças → saquinho 20×20×5; 3 peças ou mais → caixa 25×20×10 (cm).
7. **Segredos e endereço de origem só em `.env`/Railway/ambiente do Cockpit, colocados pelo dono.** Nunca por chat, em log, no banco ou neste repositório (que é público). Isso inclui o token, o CNPJ do remetente e o endereço completo de origem.
8. **Dinheiro em centavos inteiros** (Invariante 3). A SuperFrete devolve `price` em reais com decimais; a conversão acontece uma única vez, na borda do cliente da API.

## 3. Escopo

**Entra:** módulo `superfrete` no backend (fulfillment provider, cliente da API, regra de preço, escolha de embalagem, cache de cotação, valor de reserva); três opções de entrega calculadas na região Brasil e script para ativá-las; ajustes no passo Entrega do checkout (prazo por opção, rótulo "Grátis"); barra "faltam R$ X para frete grátis" no carrinho; troca do Melhor Envio pela SuperFrete em `apps/cockpit/lib/shipping.ts` e na rota de despacho; testes de unidade e integração; roteiro de validação em sandbox; atualização de `architecture/envios.md`.

**Não entra:** Jadlog, Loggi e J&T; webhook da SuperFrete (status "postado"/"entregue" automático); cálculo de CEP na página do produto (fica para depois do checkout validado, reaproveitando o mesmo cliente); seguro e aviso de recebimento; logística reversa pela SuperFrete; mais de um volume por pedido.

## 4. Arquitetura

```
Vitrine (Next.js)                         Backend (Medusa 2.15.5)                       SuperFrete
─────────────────                         ───────────────────────                       ──────────
Passo "Entrega" ─ lista opções ─────────▶ /store/shipping-options?cart_id
  para cada opção calculada ────────────▶ /store/shipping-options/{id}/calculate
                                            └▶ provider.calculatePrice(optionData, data, context)
                                                 1. embalagem(itens)  → pacote
                                                 2. cotar(cep, pacote) ─ cache ────────▶ POST /api/v0/calculator
                                                 3. regraDePreco(cotações, base, UF) → centavos
Carrinho: barra de frete grátis ────────▶ GET /store/frete/regras (pisos públicos)

Cockpit › Pedidos › Despachar             apps/cockpit/lib/shipping.ts
  "Gerar etiqueta (SuperFrete)" ────────▶ carrierCreateLabel ─────────────────────────▶ POST /api/v0/cart
                                                                                        POST /api/v0/checkout (paga com saldo)
                                          grava shipment + labels na Medusa Admin API
                                          aviso WhatsApp (Evolution)
```

Medusa continua a fonte da verdade do comércio (Invariante 2): o pedido guarda a opção escolhida e o valor cobrado; o Cockpit lê o serviço escolhido do próprio pedido.

### 4.1 Módulo `apps/backend/src/modules/superfrete`

Mesmo padrão do `mercadopago`: arquivos pequenos, regra de negócio em funções puras.

| Arquivo | Responsabilidade |
|---|---|
| `index.ts` | `ModuleProvider(Modules.FULFILLMENT, { services: [SuperfreteProviderService] })` |
| `service.ts` | Provider: `getFulfillmentOptions`, `validateOption`, `validateFulfillmentData`, `canCalculate`, `calculatePrice`; `createFulfillment`/`cancelFulfillment` sem efeito (como o manual) |
| `cliente.ts` | HTTP da SuperFrete: base por ambiente, headers, timeout, conversão reais→centavos |
| `embalagem.ts` | Função pura: itens do carrinho → `{ largura, altura, comprimento, peso_kg }` |
| `preco.ts` | Função pura: cotações + base + UF + parâmetros → preço final por serviço, em centavos |
| `cache.ts` | Cache em memória da cotação por chave `cep + pacote`, TTL 10 min |
| `__tests__/` | Unidade de `embalagem`, `preco`, `cliente` (fetch simulado) e `service` |

Registro em `medusa-config.ts`: o módulo de fulfillment só recebe o provider `superfrete` **se `SUPERFRETE_TOKEN` existir**; o provider manual continua registrado sempre. Deploy sem token não quebra o backend.

### 4.2 Opções de entrega

`getFulfillmentOptions` devolve três opções: `{ id: "mini", service: 17 }`, `{ id: "pac", service: 1 }`, `{ id: "sedex", service: 2 }`.

Na região Brasil são criadas três shipping options `price_type: "calculated"`, `provider_id: "superfrete_superfrete"`, na service zone e no shipping profile já existentes:

| Nome na vitrine | `data.id` | Código do tipo |
|---|---|---|
| Econômica (Mini Envios) | `mini` | `mini` |
| PAC | `pac` | `pac` |
| SEDEX | `sedex` | `sedex` |

O stock location "CD Brasil" ganha o vínculo com o provider `superfrete_superfrete`.

**Opção que não se aplica ao carrinho** (Mini Envios fora do limite, serviço com `has_error` na resposta): `calculatePrice` lança `MedusaError` do tipo `NOT_ALLOWED`. A vitrine trata erro de cálculo de uma opção **escondendo** essa opção (ajuste em `modules/checkout/components/shipping`), em vez de mostrar erro.

### 4.3 Embalagem (`embalagem.ts`)

Entrada: `context.items` (quantidade e peso em gramas). Peso da peça = `variant.weight`, senão `product.weight`, senão 300 g. Em produção (consulta de 2026-09-18) o peso está cadastrado no produto e nenhuma variante tem peso próprio.

| Peças no carrinho | Embalagem | Dimensões enviadas (cm) | Peso da embalagem |
|---|---|---|---|
| 1 | saquinho P | 15 × 15 × 4 se `peso total ≤ 300 g`; senão 15 × 15 × 5 | 10 g |
| 2 | saquinho M | 20 × 20 × 5 | 10 g |
| 3 ou mais | caixa | 25 × 20 × 10 | 150 g |

Peso enviado = soma das peças + embalagem, em kg.

**Mini Envios** (limites da SuperFrete/Correios: até 0,3 kg, altura 1–4 cm, largura 10–16 cm, comprimento 15–24 cm) só é elegível no primeiro caso da tabela, com peso total ≤ 300 g. Na prática: uma peça de até 290 g. Pendência de confirmação física do dono: o saquinho P com uma peça fecha em 4 cm de altura. Se não fechar, basta trocar a constante e o Mini Envios deixa de aparecer.

Para PAC e SEDEX, medidas abaixo do mínimo dos Correios (16 × 4 × 24) são enviadas como estão: a sonda F0 (2026-09-18, API real) confirmou que a SuperFrete aceita e tarifa pelo mínimo (eleva o comprimento a 24 cm quando precisa).

### 4.4 Regra de preço (`preco.ts`)

Parâmetros (padrões no código, sobrescritos por env): `margem = 200`, `piso_mg = 49900`, `piso_brasil = 59900`, `reserva_pac = 2490`.

```
normal(servico) = arredonda90( cotacao_centavos(servico) + margem )
arredonda90(v)  = menor valor ≥ v cujo resto por 100 é 90      (1630 → 1690; 1690 → 1690; 1691 → 1790)

base = Σ itens ( unit_price × quantidade − Σ adjustments do item ), em centavos   (sem frete)
piso = piso_mg se UF do endereço = "MG", senão piso_brasil
gratis = base ≥ piso

mais_barata = serviço disponível com o menor normal() (na prática, Mini Envios ou PAC)
preço final:
  não grátis → normal(servico)
  grátis     → 0 para a mais_barata; para os demais: max(0, normal(servico) − normal(mais_barata))
```

Exemplo (MG, base R$ 520,00; PAC cotado 14,30; SEDEX cotado 22,10): normal PAC = 1690, normal SEDEX = 2490. Com frete grátis: PAC = 0, SEDEX = 800. Com base R$ 480,00: PAC = 1690, SEDEX = 2490.

**Opção dominada (decisão do dono em 2026-09-18, depois da sonda F0):** uma opção que é mais cara **e** mais lenta que outra não aparece. A sonda mostrou que dentro de MG o SEDEX sai mais barato e mais rápido que PAC e Mini Envios (BH, 1 peça: PAC 18,71 em 5 dias; SEDEX 11,91 em 1 dia; Mini 14,52 em 8 dias). Regra: o serviço `s` some quando existe outro `t` com `normal(t) ≤ normal(s)` e `prazo_max(t) ≤ prazo_max(s)`, sendo pelo menos uma das duas comparações estrita. A comparação usa o preço normal de vitrine (depois da margem e do `,90`) e acontece **antes** do frete grátis — a "mais barata" do frete grátis é escolhida só entre as opções que sobraram. Empate nos dois quesitos mantém as duas. Sem prazo conhecido não há como comparar, e a opção fica. No modo de reserva (só PAC) não há o que comparar.

Observações:
- Quando Mini Envios e PAC estão disponíveis e o pedido é grátis, **só a mais barata** zera; a outra cobra a diferença (normalmente PAC − Mini).
- A `base` sai dos itens do carrinho. Verificado no core-flows do Medusa 2.15.5: o `context` do `calculatePrice` **não** traz `items.adjustments`, e provider de módulo não recebe o Query da aplicação. O provider busca os descontos pelo container global do framework (`import { container } from "@medusajs/framework"`). Coberto por teste de integração (carrinho com cupom).
- `is_calculated_price_tax_inclusive: true` (a região Brasil não soma imposto ao frete).
- O Medusa recalcula métodos de envio calculados quando o carrinho muda; se a cliente cair abaixo do piso, o grátis some. Coberto por teste de integração.

### 4.5 Cotação, cache e valor de reserva

`POST /api/v0/calculator` com `from.postal_code` (env), `to.postal_code` (CEP do carrinho, só dígitos), `services: "1,2,17"`, `package` (da embalagem), `options: { own_hand: false, receipt: false, use_insurance_value: false }`.

Uma chamada devolve os três serviços; o resultado fica em cache 10 min por `cep|largura|altura|comprimento|peso`. As três chamadas de `calculatePrice` de uma mesma tela usam uma só requisição externa (requisições simultâneas compartilham a mesma promessa).

Resposta usada por serviço: `id`, `price`, `delivery_range.min/max`, `has_error`.

**Prazo:** `calculatePrice` não devolve prazo. A rota `GET /store/frete/prazos?cart_id=` devolve `{ mini?, pac?, sedex? : { min, max } }` a partir do mesmo cache, e o passo Entrega mostra "chega em X a Y dias úteis" sob cada opção. Ao escolher a opção, a vitrine não envia nada além do id da opção: é o backend, em `validateFulfillmentData`, que grava no `data` do shipping method `servico` (1, 2 ou 17), `pacote` (seção 4.8) e `prazo_min`/`prazo_max` lidos do cache — dado vindo do navegador não é confiável para isso. O pedido guarda assim o prazo prometido.

**SuperFrete fora do ar, timeout (5 s) ou token inválido:** PAC responde com `reserva_pac` (R$ 24,90, o fixo atual) e a regra de frete grátis continua valendo; Mini Envios e SEDEX ficam indisponíveis; o erro vai para o log com `[superfrete]` (sem token, sem CPF). Sem CEP válido no carrinho: as opções lançam erro de validação com mensagem "Informe o CEP para calcular o frete".

### 4.6 Rota `GET /store/frete/regras`

Devolve `{ piso_mg, piso_brasil }` em centavos. A barra do carrinho usa a UF do endereço quando já informada; sem endereço, mostra o piso do Brasil ("Frete grátis a partir de R$ 599 · MG a partir de R$ 499"). A base exibida na barra é a mesma da regra: subtotal dos itens menos descontos.

### 4.7 Etiqueta no Cockpit (`apps/cockpit/lib/shipping.ts`)

`carrierCreateLabel` troca de Melhor Envio para SuperFrete; a assinatura passa a receber o pedido resumido:

```
entrada: destino (nome, CPF/CNPJ, telefone, endereço, número, complemento, bairro, cidade, UF, CEP),
         servico (1 | 2 | 17, lido de order.shipping_methods[0].data.servico),
         itens (nome, quantidade, valor unitário em centavos, peso),
         chave_nfe? (44 dígitos, do passo fiscal do despacho)
```

1. `POST /api/v0/cart` — `from` (env `SUPERFRETE_FROM_*`, com `document` = CNPJ), `to` (com `document` = CPF do pedido), `service`, `volumes` (mesma função de embalagem — ver 4.8), `products` (nome, quantidade, valor unitário em reais), `platform: "use.ECLAT"`, `options`: com `chave_nfe` → `invoice: { number: chave }`; sem ela → `non_commercial: true` (declaração de conteúdo).
2. `POST /api/v0/checkout` `{ orders: [id] }` — paga com saldo; devolve `tracking` e `print.url`.
3. Retorno `{ tracking_number, tracking_url, label_url }` (contrato atual, a rota de despacho não muda de forma). `tracking_url` = rastreio dos Correios.

Erros com mensagem clara para o operador: saldo insuficiente ("Sem saldo na SuperFrete. Recarregue a carteira e tente de novo."), CPF ausente no pedido, serviço indisponível para o pacote. Em qualquer erro o despacho **não** é criado e o modo manual continua disponível. Pedido cujo método de envio é o antigo "Entrega Padrão" (sem serviço): o Cockpit usa PAC.

`carrierConfigured()` passa a olhar `SUPERFRETE_TOKEN`; `CARRIER_NAME = "SuperFrete"`. As variáveis `MELHOR_ENVIO_*` e o código do Melhor Envio são removidos.

### 4.8 Embalagem compartilhada

A regra de embalagem precisa ser a mesma na cotação (backend) e na etiqueta (Cockpit), senão a etiqueta custa diferente do cotado. Os dois apps não compartilham pacote hoje. Decisão: **o backend grava o pacote usado no `data` do shipping method** (`data.pacote = { pecas, largura, altura, comprimento, peso_kg }`, via `validateFulfillmentData`), e o Cockpit lê esse pacote do pedido. O Medusa refaz o preço do método quando o carrinho muda, mas não o `data`; por isso o Cockpit só confia no pacote gravado se `pecas` bater com o pedido. Pedidos sem `data.pacote` (antigos) ou com contagem divergente usam uma cópia mínima da tabela da seção 4.3 em `apps/cockpit/lib/shipping.ts`.

## 5. Variáveis de ambiente (nomes; valores são do dono)

| Onde | Variável | Observação |
|---|---|---|
| Backend (Railway e `.env` local) | `SUPERFRETE_TOKEN` | produção no Railway; sandbox no local |
| Backend | `SUPERFRETE_SANDBOX` | `true` usa `https://sandbox.superfrete.com`; padrão `false` → `https://api.superfrete.com` |
| Backend | `SUPERFRETE_FROM_POSTAL_CODE` | CEP de origem, só dígitos |
| Backend (opcionais) | `FRETE_MARGEM_CENTAVOS`, `FRETE_GRATIS_MG_CENTAVOS`, `FRETE_GRATIS_BRASIL_CENTAVOS`, `FRETE_RESERVA_PAC_CENTAVOS` | sobrescrevem os padrões da seção 4.4 |
| Backend e Cockpit | `SUPERFRETE_CONTACT_EMAIL` | e-mail do header `User-Agent` exigido pela SuperFrete |
| Cockpit | `SUPERFRETE_TOKEN`, `SUPERFRETE_SANDBOX` | mesmos valores do backend |
| Cockpit | `SUPERFRETE_FROM_NAME`, `_DOCUMENT`, `_PHONE`, `_ADDRESS`, `_NUMBER`, `_COMPLEMENT`, `_DISTRICT`, `_CITY`, `_STATE`, `_POSTAL_CODE` | remetente completo da etiqueta |

Header obrigatório em toda chamada: `User-Agent: use.ECLAT (<e-mail de contato>)`, com o e-mail vindo de `SUPERFRETE_CONTACT_EMAIL`.

## 6. Ativação em produção

Script `apps/backend/ativar-superfrete.mjs` (idempotente, via Admin API, no padrão do `ativar-mercadopago-regiao.mjs`: sem argumento só simula, `--aplicar` grava): vincula o provider ao CD Brasil, cria as três opções calculadas e marca a "Entrega Padrão" como `enabled_in_store = false` (não apaga — pedidos antigos apontam para ela, e ela volta a ser ligada se for preciso desfazer). **Só roda em produção com o "pode aplicar" do dono**, depois do `railway up` com o módulo novo.

Desfazer: religar a "Entrega Padrão" e desligar as três opções (`--aplicar --desfazer` no mesmo script).

## 7. Testes

**Unidade (backend):** `arredonda90` (limites 1689/1690/1691); `preco` — abaixo do piso, no piso exato, MG × outras UFs, grátis com e sem Mini Envios, SEDEX nunca negativo, modo reserva; `embalagem` — 1/2/3+ peças, peça sem peso, limite de 300 g do Mini Envios; `cliente` — conversão reais→centavos sem float (`"17.43"` → 1743), `has_error`, timeout.

**Integração (backend, SuperFrete simulada):** carrinho com CEP → três opções com preço; carrinho com cupom abaixo/acima do piso (valida a `base` com descontos); remover item derruba o frete grátis; SuperFrete fora do ar → só PAC pelo valor de reserva; pedido concluído guarda `data.pacote` e o prazo.

**Unidade (Cockpit):** montagem do corpo do `cart` (com chave da NFe × declaração de conteúdo; CPF ausente → erro), leitura do serviço e do pacote do pedido, mensagens de erro.

**Validação manual (roteiro no `progress.md`):** sandbox — checkout com CEP de MG e de outra UF, abaixo e acima do piso; etiqueta de teste pelo Cockpit. Produção — um pedido real de ponta a ponta, conferindo valor cobrado × valor debitado da carteira.

## 8. Fases (Halt entre elas)

- **F0 — Verificação:** teste que confirma o que o `context` do `calculatePrice` traz (adjustments, UF, peso) e uma chamada real ao `calculator` do sandbox. Saída: ajustes nesta spec, se houver.
- **F1 — Backend:** módulo `superfrete`, rotas `/store/frete/*`, script de ativação, testes. Aceite: integração verde e cotação real em sandbox local.
- **F2 — Vitrine:** passo Entrega (prazo, "Grátis", opção indisponível escondida) e barra de frete grátis no carrinho. Aceite: checkout local completo com frete calculado.
- **F3 — Cockpit:** etiqueta SuperFrete no despacho. Aceite: etiqueta de sandbox gerada e rastreio gravado no pedido.
- **F4 — Go-live (dono):** variáveis em produção, `railway up`, "pode aplicar" no script, saldo na carteira, pedido real. Atualizar `architecture/envios.md`, `CLAUDE.md` (Estado atual) e `contexto-claude/eclat-frete-superfrete.md`.

## 9. Riscos e pendências

0. **Sem conta sandbox (decisão do dono em 2026-09-18).** A cotação é testada na API real (consulta, sem custo). O token de produção fica no `.env` local da worktree, fora do git. A verificação da etiqueta (F3) é uma etiqueta real cancelada em seguida; confirmar na documentação da SuperFrete a regra de reembolso do cancelamento antes de emitir.
1. **Altura do saquinho P (4 cm)** — confirmação física do dono; define se o Mini Envios existe na prática.
2. **Pesos de embalagem (10 g / 150 g) e capacidade da caixa** — suposições aprovadas no desenho; pedido com muitas peças pode não caber em uma caixa. Fora do escopo tratar mais de um volume; o operador resolve no modo manual.
3. **Divergência cotado × cobrado na etiqueta** — mitigada por `data.pacote` (seção 4.8); a validação em produção confere os dois valores.
4. **Remetente pessoa física × CNPJ** — a conta SuperFrete tem CNPJ cadastrado; a etiqueta sai com o CNPJ como `from.document`. Quando a NFe entrar em produção, o emitente da nota e o remetente precisam ser o mesmo CNPJ.
5. **Conta sandbox** é separada da de produção: cadastro e token próprios, feitos pelo dono.
