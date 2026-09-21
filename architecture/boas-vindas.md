# Aviso de boas-vindas (cupom de primeira compra em troca do WhatsApp)

SOP técnico. Código do cupom, teto de usos e números ficam em `contexto-claude/` (repositório público).

## O que é
Na primeira visita a vitrine abre um aviso: a visitante deixa o WhatsApp (obrigatório), o e-mail (opcional) e
marca o aceite de comunicação. O contato vira **lead** no Supabase (Kanban do Cockpit) e o cupom aparece na tela.

## Interruptor (sem deploy)
`site_content`, key `boas_vindas`: `{ "ativa": true, "cupom": "<CODIGO>", "percentual": 10 }`.
Sem a chave, com `ativa: false` ou com valor inválido o aviso não renderiza (`lerConfigBoasVindas`).
O cupom precisa existir no Medusa (`scripts/cupom.mjs`). **Ordem de publicação: backend primeiro** — a vitrine
chama `POST /store/boas-vindas`; com a rota fora do ar o formulário mostra erro.

## Regras de exibição (`apps/storefront/src/lib/util/boas-vindas.ts`)
- Nunca em `/cart`, `/checkout`, `/order`, `/account` (quem está comprando não é interrompido).
- Abre 8 s depois do carregamento e só depois que a visitante respondeu o aviso de cookies (mesmo canto da tela).
- Fechou, recusou ou cadastrou → cookie `eclat_bv` por 60 dias; não reaparece.
- O código do cupom NÃO vai para o navegador antes do cadastro (o componente de servidor passa só o percentual;
  a ação `cadastrarBoasVindas` devolve o código depois que o backend confirma o lead).
- Depois do cadastro o código fica em `localStorage` (`eclat_cupom_boas_vindas`): o campo de cupom da sacola
  (`modules/checkout/components/discount-code`) abre sozinho, já preenchido.
- Evento `generate_lead` (`lead_source: boas_vindas`) no dataLayer.

## Backend (`apps/backend`)
- `src/lib/boas-vindas.ts` — validação pura: celular BR → dígitos com DDI 55 (mesmo formato do webhook do
  WhatsApp), e-mail opcional, aceite obrigatório, campo-isca contra robô.
- `src/api/store/boas-vindas/route.ts` — idempotente pelo WhatsApp: lead existente não duplica (ganha o e-mail
  se faltava e a nota do aceite); lead novo entra com `origem: "site"`, `interesse: "boas-vindas"`.
- LGPD: o aceite fica nas `notas` do lead com data/hora ISO e o texto exato que a pessoa viu.
- **A marca não manda mensagem para quem só deixou o contato**: o lead não dispara robô nenhum. Contato ativo
  é decisão da operadora, dentro das regras de proteção do número (`architecture/whatsapp.md`).

## Regras de cupom que continuam valendo
Cupom nunca soma com o Benefício Conjunto (por peça vale o maior desconto) e é limitado por usos no total,
nunca por cliente (CLAUDE.md, "Regras de venda"). "Primeira compra" é o convite do texto, não uma trava técnica.

## Testes
`apps/backend/src/lib/__tests__/boas-vindas.unit.spec.ts` · `apps/storefront/src/lib/util/boas-vindas.test.ts`.
