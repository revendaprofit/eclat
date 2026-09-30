# Condições comerciais na vitrine (parcelas, juros, Pix, frete, cupom)

Desde 2026-09-30 (referência de layout: beatco.com.br). Tudo que o site fala sobre **como pagar** sai de um só
lugar: `apps/storefront/src/lib/util/condicoes.ts` (parte pura, testada em `condicoes.test.ts`) e
`src/lib/data/condicoes.ts` (lê as fontes).

## Fontes de verdade
| Condição | Fonte | Onde aparece |
|---|---|---|
| Parcelas e "sem juros" | `site_content` key **`condicoes`** `{ parcelas, sem_juros, pix_percentual }` | barra do topo, faixa da home, card, PDP, conjunto |
| Desconto no Pix | `condicoes.pix_percentual` | idem |
| Cupom de 1ª compra | `site_content` key `boas_vindas` (o mesmo do aviso) | barra do topo, faixa da home |
| Frete grátis | `GET /store/frete/regras` (pisos do backend, `FRETE_GRATIS_*_CENTAVOS`) | barra, faixa, "Compra segura" da PDP |

Sem a key `condicoes`, vale o padrão seguro `{ parcelas: 4, sem_juros: false, pix_percentual: 0 }`: o site diz
"Até 4x no cartão" e não mostra valor de parcela nem preço no Pix.

## Regra: nunca ligar antes de ser verdade
- `sem_juros: true` **só depois** de configurar a conta Mercado Pago para a loja absorver os juros até 4x.
  Antes disso a cliente paga juros e "4x de R$ X sem juros" seria falso.
- `pix_percentual: 5` **só depois** do desconto entrar no carrinho (Etapa 3: backend). Se só o texto mudar, o
  preço mostrado não bate com o cobrado (e `pixVigente` compara `valor_total` com `cart.total`).
- Toda conta é em centavos inteiros (`emCentavos`, `parcelaEmCentavos`, `pixEmCentavos`).

## Pré-visualizar localmente
`ECLAT_CONDICOES_PREVIEW='{"parcelas":4,"sem_juros":true,"pix_percentual":5}'` no ambiente do `next dev`
(ignorado com `NODE_ENV=production`). Launch da raiz: `storefront-vitrine` (porta 8005).

## Desconto no Pix (Etapa 3, 2026-09-30)
Decisões do dono: **5%**, **soma com cupom e com o Benefício Conjunto**, **não conta para o frete grátis**.
- É a promoção comum `PIX5` (percentual, itens, `across`, sem teto de usos) criada por `scripts/desconto-pix.mjs`.
- Backend (`apps/backend/src/modules/desconto-pix/regra.ts`, procure por `ehCodigoPix`):
  - `beneficio-conjunto/sincronizar-promocao.ts`: o gancho de cupom IGNORA o PIX5 (não ganha a regra de exclusão).
  - `workflows/hooks/conjunto-marcar.ts`: PIX5 fora da disputa "maior desconto por peça".
  - `superfrete/base-carrinho.ts`: o ajuste do PIX5 não reduz a base do frete grátis (e `service.base_` só confia nos
    adjustments do contexto quando eles trazem `code`).
  - `api/middlewares/desconto-pix.ts`: `POST /store/payment-collections/:id/payment-sessions` com `metodo: "cartao"` e
    PIX5 no carrinho → 400 (NOT_ALLOWED).
- Vitrine: `ajustarDescontoPix` (`lib/data/cart.ts`) põe/tira o PIX5 ao seguir para a revisão, antes de gerar o Pix e
  antes de cobrar o cartão (se precisou tirar, não cobra: pede para a cliente conferir o novo total). Só age com
  `condicoes.pix_percentual > 0`. O PIX5 não aparece na lista de cupons, é preservado quando a cliente mexe nos cupons e
  tem linha própria "Desconto Pix" no resumo. A barra de frete grátis da sacola também ignora o PIX5.

### Ordem de ligar (não pular)
1. `railway up` do backend (regras acima). Sem isso, o PIX5 ganharia a regra de exclusão e cartão com PIX5 passaria.
2. `node scripts/desconto-pix.mjs --aplicar` (com "pode aplicar"). O script avisa se a regra de exclusão aparecer.
3. Push da vitrine (Vercel).
4. Conferir em produção com carrinho de teste, sem pagar: conjunto + BEMVINDA10 + Pix → linhas "Benefício Conjunto",
   "Cupom" e "Desconto Pix"; frete grátis não muda ao escolher Pix; cobrança de cartão com PIX5 → recusada.
5. Cockpit → `site_content` `condicoes` = `{ "parcelas": 4, "sem_juros": <true só com o MP configurado>, "pix_percentual": 5 }`.
