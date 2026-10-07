# Parcerias com influencers — cupom da parceira e comissão (desenho)

> Rascunho de 2026-09-25 para aprovação do dono. Nada aqui está em código. Segue o método da constituição:
> schema aprovado antes de qualquer código, e Halt entre as partes.

## 1. O que é

Formato de parceria com influencer (definido pelo dono em 2026-09-25):
- a cliente que usa o cupom da parceira ganha **10% nas peças**, **sem acúmulo** com outro desconto;
- a parceira ganha **5%** sobre as vendas feitas com o cupom dela;
- a loja precisa **controlar** isso: quais parcerias existem, quanto cada uma vendeu, quanto deve, quanto já pagou.

Primeiro caso real: cupom `PATY10`.

Os cupons `NOME20` que já existem em produção (ERIKA20, ALANA20, POLLI20, LUANA20, GIGO20, AMABILE20, SIBELE20,
DOUGLAS20, OTAVIOGO20) são 20%, **1 uso no total** e sem comissão. **Decisão do dono (2026-09-25): ficam como estão,
mas entram no mesmo controle** — cada um vira uma linha em `parceria` com `desconto_percentual = 20`,
`comissao_percentual = 0` e o `medusa_campaign_id` do teto de 1 uso, para a tela mostrar quem usou e quando.

## 2. O que já existe e é reaproveitado

- **Cupom no Medusa** (`scripts/cupom.mjs`): promoção percentual só nas peças (`target_type: "items"`, frete nunca
  entra), campanha com teto de usos no total. O gancho `conjunto-cupom` põe a exclusão do Benefício Conjunto e, por
  peça, vale o MAIOR desconto entre cupom e conjunto (`conjunto-marcar`). **É exatamente o "sem acúmulo"**: já vale
  sozinho, sem código novo.
- **O pedido grava o cupom usado**: `order.promotions[].code` no Medusa (conferido em produção em 2026-09-25 no
  pedido #21, que gravou a promoção do conjunto). Logo a venda "com o cupom da PATY" é rastreável a partir do
  pedido, sem mexer em checkout, vitrine ou pagamento.
- **Cockpit** já lê pedidos pela Admin API (`/api/orders`) e já tem tela Marketing e tela Financeiro/DRE.
- **Supabase** é o lugar do dado de relacionamento e financeiro próprio (constituição, invariante 2): a parceria
  (quem é, contato, percentuais, repasses) mora lá; a venda mora no Medusa.

## 3. Regras propostas (confirmar cada uma)

| # | Regra | Proposta | Alternativa |
|---|-------|----------|-------------|
| R1 | Desconto da cliente | 10% nas peças, frete fora, sem somar com conjunto (maior desconto vence) | — |
| R2 | Base da comissão | **DECIDIDO pelo dono em 2026-09-25: valor das peças efetivamente pago** (depois do desconto, sem frete). Ex.: peça de R$ 259 → cliente paga R$ 233,10 → comissão R$ 11,66 | ~~5% sobre o preço cheio~~ |
| R3 | Quando a venda conta | pedido **pago** (Pix confirmado ou cartão aprovado) e **não cancelado**. Devolução/estorno tira a venda da conta | contar no fechamento do pedido |
| R4 | Teto de usos do cupom | **DECIDIDO (dono, 2026-09-25): sem teto.** A promoção é criada sem campanha (`scripts/cupom.mjs --sem-teto`) | ~~teto alto com aviso~~ |
| R5 | Um cupom por pedido | **CORRIGIDO em código (2026-09-25, `lib/util/cupom-unico.ts`)**: o código novo substitui o anterior e a sacola avisa. Antes a sacola ACUMULAVA códigos (`discount-code/index.tsx` faz `codes.push`): PATY10 + BEMVINDA10 entrariam juntos. Proposta: a vitrine passa a enviar só o último código (troca em vez de somar) — mudança pequena, com teste | trava no backend (gancho recusa carrinho com 2 cupons) |
| R6 | Cupom de parceria em primeira compra | não é cupom de primeira compra (qualquer cliente usa, quantas vezes quiser) | travar 1 por CPF |
| R7 | Fechamento do repasse | **DECIDIDO (dono, 2026-09-25): mensal, pago pela ÉCLAT** (dono/sócia) por Pix; no início do mês o Cockpit mostra o acumulado do mês anterior por parceira e a operadora marca "pago" com data e valor | ~~quinzenal / por pedido~~ |
| R8 | Dinheiro | centavos inteiros (invariante 3). O 5% arredonda por pedido, meio para cima | — |
| R9 | Padrão de código | `NOME10` (nome da parceira + percentual da cliente), maiúsculas, sem acento | livre |

## 4. Schema (Supabase, migration `0013_parcerias.sql`)

```sql
-- Parcerias com influencers (architecture/parcerias.md)
-- RLS: anon negado (sem policies); backend e Cockpit usam service_role.

create table if not exists public.parceria (
  codigo               text primary key,            -- = code da promoção no Medusa (PATY10)
  nome                 text not null,               -- nome da parceira
  instagram            text,                        -- @handle, sem o @
  whatsapp             text,                        -- dígitos com DDI 55, mesmo formato do CRM
  desconto_percentual  int  not null default 10 check (desconto_percentual between 1 and 100),
  comissao_percentual  int  not null default 5  check (comissao_percentual between 0 and 100),
  medusa_promotion_id  text not null,               -- promo_... criado junto
  medusa_campaign_id   text,                        -- procamp_... (null = sem teto)
  ativa                boolean not null default true,
  notas                text,
  criado_em            timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Repasse fechado e pago (um por parceria por período). Os pedidos que entraram ficam gravados
-- para o valor nunca mudar depois de pago, mesmo que um pedido seja cancelado mais tarde.
create table if not exists public.parceria_repasse (
  id               uuid primary key default gen_random_uuid(),
  codigo           text not null references public.parceria(codigo),
  periodo_inicio   date not null,
  periodo_fim      date not null,
  base_centavos    bigint not null,                 -- soma das peças pagas nos pedidos do período
  valor_centavos   bigint not null,                 -- comissão devida
  pedidos          jsonb not null,                  -- [{order_id, display_id, base_centavos, comissao_centavos}]
  status           text not null default 'aberto' check (status in ('aberto','pago')),
  pago_em          timestamptz,
  comprovante      text,                            -- texto livre: id do Pix, observação
  criado_em        timestamptz not null default now(),
  unique (codigo, periodo_inicio, periodo_fim)
);

alter table public.parceria         enable row level security;
alter table public.parceria_repasse enable row level security;

drop trigger if exists parceria_updated on public.parceria;
create trigger parceria_updated before update on public.parceria
  for each row execute function public.set_updated_at();
```

O que **não** vai para o banco: chave Pix da parceira (fica no WhatsApp/combinado, fora do sistema, até o dono
decidir o contrário), CPF, contrato.

## 5. Como fica no sistema

### Backend (Medusa) — nada novo
As regras de desconto já existem (§2). Só muda a criação do cupom: promoção sem campanha de teto (R4).

### Script `scripts/parceria.mjs` (simulação por padrão, `--aplicar` grava)
```
node scripts/parceria.mjs --codigo PATY10 --nome "Paty" --instagram paty --desconto 10 --comissao 5 [--aplicar]
```
1. cria a promoção no Medusa (mesmo corpo do `cupom.mjs`, sem campanha) e confere a regra de exclusão do conjunto;
2. grava a linha em `parceria` no Supabase (`SUPABASE_URL` + service role, mesmas variáveis do Cockpit);
3. imprime o que a operadora manda para a parceira (código, o que a cliente ganha, o que ela ganha).
`--desativar PATY10` põe a promoção como `inactive` no Medusa e `ativa=false` na tabela.

### Cockpit — tela **Marketing → Parcerias** (ou página própria `/parcerias`)
- Lista: código, nome, @, desconto, comissão, vendas no mês (qtde e R$), comissão do mês, acumulado em aberto.
- Criar parceria pelo formulário (mesma coisa que o script faz, via `/api/parcerias`).
- Ficha da parceria: pedidos com o cupom (nº, data, peças pagas, comissão), repasses fechados, botão
  "Fechar mês" → cria `parceria_repasse` com os pedidos pagos e não cancelados do período; botão "Marcar pago".
- Cálculo mora em módulo puro `apps/cockpit/lib/parcerias.ts` (testes unitários): entra a lista de pedidos do
  Medusa, sai base e comissão em centavos por pedido e por período.
- Fonte dos pedidos: Admin API `GET /admin/orders?fields=...,promotions.code,payment_status` filtrando o código.

### Financeiro / DRE
Comissão paga entra como despesa: linha "Comissão de parceria" no DRE do período, lida de `parceria_repasse`
com `status='pago'`. **Decidido (dono, 2026-09-25): pelo mês da venda** (compete com a receita), mostrando "a pagar" enquanto o repasse
está aberto e "pago" depois.

### Vitrine — nada
O campo de cupom da sacola já existe. Só conferir a R5 (um código por vez).

## 6. Fases (Halt entre cada uma)

| Fase | Entrega | Aceite |
|------|---------|--------|
| F0 | Este desenho aprovado + migration aplicada com "pode aplicar" | tabelas existem, RLS ligada |
| F1 | `scripts/parceria.mjs` + linha em `parceria` para PATY10 e para os NOME20 | PATY10 já existe (2026-09-25, `cupom.mjs --sem-teto`), provado em carrinho real: peça 259 → 233,10; conjunto Aurora 318 → 286,20 (não soma) |
| F2 | Cockpit: lista + ficha + cálculo puro com testes (**em código, 2026-09-25**: `lib/parcerias.ts` + teste, rotas `/api/parcerias`, tela `/parcerias`; vitrine: um cupom por sacola) | pedido de teste com PATY10 aparece na ficha com a comissão certa — validação de tela pendente do dono |
| F3 | Fechar mês / marcar pago + linha no DRE | repasse gravado, DRE mostra a despesa |
| F4 | SOP `architecture/parcerias.md` + `contexto-claude/eclat-parcerias-influencer.md` (quem são, como pagar) | — |

## 7. Perguntas abertas para o dono
1. ~~R2: comissão sobre o valor pago ou sobre o preço cheio?~~ **Decidido: sobre o valor pago** (dono, 2026-09-25).
2. ~~R4~~ **Decidido: sem teto.**
3. ~~R7~~ **Decidido: mensal, a ÉCLAT paga.**
4. ~~DRE~~ **Decidido: mês da venda.**
5. ~~NOME20~~ **Decidido: ficam como estão (20%, 1 uso, sem comissão) e entram no controle.**
6. ~~PATY10 antes?~~ **Decidido: sim.** PATY10 criado em produção em 2026-09-25 com `cupom.mjs --sem-teto`; o pedido
   já grava o cupom, a comissão entra retroativa quando a F2 existir.
