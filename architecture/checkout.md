# Checkout — passos, contato e cotação na sacola

SOP criado em 2026-09-25, a partir do diagnóstico de carrinhos abandonados (todas as clientes desconhecidas
paravam antes de deixar contato; a primeira tela pedia endereço e CPF antes do e-mail).

## Passos (`?step=`)
1. `contato` — WhatsApp + e-mail (`modules/checkout/components/contato`, ação `salvarContato` em
   `lib/data/cart.ts`). Grava `cart.email` e `cart.metadata.whatsapp` NA HORA, mais o cookie `eclat_contato`.
   Abre também quando o carrinho não tem e-mail (link sem `step`).
2. `address` — começa pelo CEP (autopreenche rua/bairro/cidade/UF), depois nome e CPF. Sem "Empresa" e sem
   seletor de país quando a região tem um país só (código vai escondido). Telefone e e-mail NÃO são pedidos de
   novo: `setAddresses` usa `cart.email` e `metadata.whatsapp` como telefone, e PRESERVA o metadata existente
   (mescla `{...atual, cpf, sinais do Meta}` — antes o metadata era substituído).
3. `delivery`, 4. `payment`, 5. `review` — sem mudança.

A sacola escolhe o passo com `etapaDoCheckout` (`lib/util/contato-checkout.ts`, com teste).

## Contato guardado (`eclat_contato`)
Cookie httpOnly, 60 dias, JSON `{w, e}` (só valores válidos). Gravado pelo passo 1 e pelo aviso de boas-vindas.
`getOrSetCart` cria o carrinho novo já com e-mail e `metadata.whatsapp` (`contatoParaCarrinho` nunca sobrescreve
o que o carrinho já tem).

## Cotação de frete na sacola
`modules/cart/components/calcular-frete` + ação `cotarFreteDaSacola` (`lib/data/cotacao-sacola.ts`). Grava no
carrinho só CEP, cidade e UF (ViaCEP no servidor) e usa as mesmas rotas do checkout (`/store/shipping-options`,
`.../calculate`, `/store/frete/prazos`). Se o carrinho já tem endereço completo, não mexe nele e cota o CEP dele.
Lista montada por `montarCotacao` (`lib/util/cotacao-sacola.ts`, com teste): opção calculada sem preço = backend
recusou para o CEP e some.

## Cockpit
`/admin/carrinhos-abandonados` devolve `metadata`; `apps/cockpit/lib/carrinhos.ts` usa `metadata.whatsapp` como
telefone quando não há endereço. Só aparece depois do `railway up` do backend; sem ele, o e-mail do passo 1 já
tira o carrinho de "Só sacola".

## Outros ajustes do mesmo diagnóstico
- Foto da linha da sacola/checkout/mini-sacola = 1ª foto da VARIANTE (`lib/util/foto-do-item.ts`); antes era a
  capa do produto e o Grafitti aparecia Telha.
- Página do conjunto: com peça sem tamanho, o botão do rodapé vira "Escolher tamanho: <peça>" e rola até ela.
