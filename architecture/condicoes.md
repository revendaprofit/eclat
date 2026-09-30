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
