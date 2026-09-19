# SOP — Envios / Despacho (Fase 4, Bloco 3)

O cockpit despacha pedidos pela **Medusa Admin API** (comércio = fonte da verdade) e avisa o
cliente por **WhatsApp** (Evolution). A integração com transportadora é a **SuperFrete**; sem
credenciais, opera-se no **modo manual**.

## Fluxo de despacho (no cockpit → Pedidos → abrir pedido → "Despachar")
1. Cria o **fulfillment** de todos os itens: `POST /admin/orders/{id}/fulfillments`
   `{ items:[{id,quantity}], location_id }` (location = CD Brasil).
2. Marca o **envio** (shipment): `POST /admin/orders/{id}/fulfillments/{fid}/shipments`
   `{ items:[{id,quantity}], labels?:[{tracking_number, tracking_url, label_url}] }`.
   - Os 3 campos do label são obrigatórios quando há label (envie "" quando não tiver).
3. **Aviso WhatsApp** (se "avisar cliente" + telefone no endereço do pedido): texto na voz da Éclat
   com o código de rastreio. Telefone normalizado p/ E.164 (prefixo 55).

Estados (fulfillment_status): `not_fulfilled` → `fulfilled`/`shipped` → `delivered`.
Endpoints auxiliares: cancelar `.../fulfillments/{fid}/cancel`; entregue `.../fulfillments/{fid}/mark-as-delivered`.

## Modo manual (ativo agora, sem dependências)
Operador digita o código de rastreio (e URL, opcional) e clica **Despachar**. Sem código → despacha sem rastreio.

## Frete calculado no checkout (SuperFrete)
Spec: `docs/superpowers/specs/2026-09-18-frete-superfrete-design.md`. Provider `superfrete_superfrete`
(`apps/backend/src/modules/superfrete`), só registrado se `SUPERFRETE_TOKEN` existir no ambiente
(o provider manual continua registrado sempre — pedido antigo e o modo manual dependem dele).
- Três opções `calculated`: Econômica (Mini Envios, `mini`), PAC (`pac`), SEDEX (`sedex`).
- Peso da peça = `variant.weight`, senão `product.weight`, senão 300 g (em produção o peso está
  cadastrado no produto, não na variante).
- Preço = cotação + margem, arredondado para cima até o próximo `,90`. Frete grátis por piso (MG × Brasil)
  sobre o valor das peças já com desconto (cupom e Benefício Conjunto), sem o frete: a mais barata zera,
  as outras cobram a diferença.
- Opção DOMINADA (mais cara E mais lenta que outra) não aparece (`semDominadas`/`precosDeVitrine` em
  `preco.ts`; compara o preço de vitrine, antes do frete grátis). Dentro de MG o SEDEX costuma ser o mais
  barato e o único exibido.
- Embalagem por quantidade de peças (`embalagem.ts`); Mini Envios só quando o pacote cabe no limite dos
  Correios.
- Sem conta sandbox (decisão do dono): a cotação é testada direto na API real da SuperFrete;
  `SUPERFRETE_SANDBOX=true` continua suportado.
- SuperFrete fora do ar, timeout ou token inválido: só PAC, pelo valor de reserva. O erro vai para o log
  com `[superfrete]` (nunca token nem CPF).
- Rotas `GET /store/frete/regras` (pisos, para a barra do carrinho) e `GET /store/frete/prazos?cart_id=`
  (prazo por opção, lido do mesmo cache da cotação). A rota de prazos nunca derruba o checkout: sem CEP,
  sem token ou com a API fora do ar devolve `{ prazos: {} }`, logando `[superfrete] prazos indisponíveis: …`.
- O pedido guarda em `shipping_methods.data`: `servico`, `pacote`, `prazo_min`, `prazo_max` — sempre
  recalculado e gravado no servidor (`validateFulfillmentData`); o que vem do navegador não é confiável.
- Vitrine: passo Entrega mostra o prazo por opção e "Grátis" quando o frete é 0; opção recusada pelo
  provider fica escondida (nunca aparece como erro). Barra no carrinho ("Faltam R$ X para o frete
  grátis." / "Você ganhou frete grátis.") usa preço × quantidade menos os descontos de cada peça — nunca
  `discount_total` do carrinho, que também inclui desconto de método de frete.
- Variáveis do backend: `SUPERFRETE_TOKEN`, `SUPERFRETE_SANDBOX`, `SUPERFRETE_FROM_POSTAL_CODE`,
  `SUPERFRETE_CONTACT_EMAIL`; opcionais `FRETE_MARGEM_CENTAVOS`, `FRETE_GRATIS_MG_CENTAVOS`,
  `FRETE_GRATIS_BRASIL_CENTAVOS`, `FRETE_RESERVA_PAC_CENTAVOS`.
- Ligar/desligar na região: `node apps/backend/ativar-superfrete.mjs` (simula) · `--aplicar` ·
  `--aplicar --desfazer`. Preserva as regras que a opção já tinha e aborta sem gravar nada se houver mais
  de um candidato (local, zona ou opção fixa "Entrega Padrão" — o script nunca adivinha). Em produção, só
  com o "pode aplicar" do dono, depois do `railway up` com o módulo novo.
- Teste de integração: `apps/backend/integration-tests/http/frete-superfrete.spec.ts` (13 casos, SuperFrete
  simulada por um servidor HTTP local; precisa do contêiner `eclat-pg-test`, `npm run test:db:up`).

## Etiqueta pelo Cockpit (SuperFrete)
Botão **"Gerar etiqueta (SuperFrete)"** no despacho: `POST /api/v0/cart` (cria o frete, não gasta saldo) →
`POST /api/v0/checkout` (paga com o saldo da carteira) → grava rastreio + PDF no Medusa → aviso WhatsApp.
Código: `apps/cockpit/lib/shipping.ts` (`carrierCriarFrete`/`carrierPagarFrete`/`carrierConsultarFrete`,
timeout de 20 s cobrindo a leitura do corpo da resposta; "sem saldo" só quando a SuperFrete devolve HTTP
402 ou o texto "saldo insuficiente") e `lib/superfrete-etiqueta.ts` (monta o corpo e valida CPF/CEP/UF
antes de qualquer chamada — erro de dado não gasta saldo).
- Usa o serviço e o pacote gravados no pedido; pedido antigo ("Entrega Padrão", sem serviço) sai como PAC.
  Pedido sem `data.pacote` ou com contagem de peças divergente usa uma cópia mínima da tabela de
  embalagem (peso padrão 300 g/peça).
- Regras da API da SuperFrete conferidas na doc oficial: telefone do destinatário com 10/11 dígitos
  NACIONAIS, sem o "55"; limites de tamanho por corte, nunca por rejeição — nome/endereço/bairro/cidade
  50, complemento 20, número 10; número vazio (não "S/N") quando o pedido não tem número; bairro vazio
  vira "NA"; UF com 2 letras; `options.tags` leva o número do pedido (`display_id`); CEP de origem com 8
  dígitos. `SUPERFRETE_FROM_NAME` precisa de nome E sobrenome (só o remetente — a SuperFrete recusa
  etiqueta de remetente com uma palavra só, já com o saldo debitado); `SUPERFRETE_FROM_PHONE` é opcional.
- Com NFe emitida no despacho, a chave vai na etiqueta (`invoice.number`); sem ela, vai como declaração
  de conteúdo (`non_commercial: true`).
- Exige CPF/CNPJ no pedido. Sem CPF, sem saldo, endereço inválido ou erro da SuperFrete, o despacho NÃO
  acontece (o fulfillment não chega a ser criado) e o modo manual segue disponível.
- A compra é uma máquina de estados gravada em `order.metadata.frete` (`lib/etiqueta-segura.ts`,
  `garantirEtiqueta`): `iniciando` → `pendente` (com `superfrete_id`) → `paga` (com rastreio e/ou PDF).
  Três fatos aprendidos com a etiqueta real comprada e cancelada pelo dono em 2026-09-19:
  - **O status da SuperFrete atrasa alguns segundos em relação ao pagamento** (`GET .../order/info/{id}`
    respondeu `pending` por alguns segundos logo depois de um `/checkout` que já tinha sido aceito). Por
    isso um pedido `pendente` que a consulta diz `pending` espera 8s e confere de novo antes de decidir
    pagar — um único `pending` não prova que não foi pago.
  - **Uma etiqueta já registrada como `paga` nunca volta a pagar nem a criar outra**, não importa o que a
    consulta diga depois (inclusive `pending`) — só `canceled` é motivo pra parar e pedir conferência
    manual; qualquer outro status vira só uma tentativa a mais de achar o rastreio.
  - **O rastreio pode estar vazio na hora do pagamento** (a resposta do `/checkout` trouxe o PDF mas
    `tracking` vazio). Por isso toda compra bem-sucedida busca o rastreio logo em seguida (até 3
    consultas, ~12 s no total) — e pode continuar vazio: nesse caso o despacho segue registrado só com o
    PDF, e a mensagem de WhatsApp ao cliente sai sem código de rastreio.
  Trava de duplo pagamento: já paga com rastreio → reaproveita sem chamar a API (zero chamadas); id
  gravado sem confirmação → consulta (com a espera de 8s acima) antes de decidir pagar; `canceled` →
  libera uma compra nova; `iniciando` com menos de 2 minutos → recusa nova tentativa; se `criar` falhou, a
  tentativa seguinte não fica presa nos 2 minutos.
- Trava de despacho em memória por pedido (`lib/trava-despacho.ts`), no TOPO da rota de despacho: um
  segundo clique no mesmo pedido recebe HTTP 409 sem nenhum efeito, nem NFe. Limite conhecido: vale para
  UMA instância do Cockpit; entre instâncias, quem protege a etiqueta é a releitura do pedido feita antes
  de comprar (janela de uma gravação no Medusa), e a emissão de NFe não tem guarda nenhuma entre
  instâncias — se o Cockpit ganhar uma segunda réplica, isso precisa de trava no banco.
- `lib/medusa.ts` (`corpoDoEnvio`): grava o rótulo (`labels`, os 3 campos sempre) sempre que houver
  rastreio OU PDF — uma etiqueta paga pode ainda não ter rastreio da SuperFrete, mas já ter o PDF.
- Variáveis do Cockpit: `SUPERFRETE_TOKEN`, `SUPERFRETE_SANDBOX`, `SUPERFRETE_CONTACT_EMAIL` e o remetente em
  `SUPERFRETE_FROM_NAME`, `_DOCUMENT` (CNPJ), `_PHONE`, `_ADDRESS`, `_NUMBER`, `_COMPLEMENT`, `_DISTRICT`, `_CITY`, `_STATE`, `_POSTAL_CODE`.
  Valores só no ambiente — este repositório é público.
- Pendências conhecidas: não há botão de cancelar etiqueta no Cockpit (o id da SuperFrete fica só em
  `metadata.frete.superfrete_id`; cancelar hoje é pelo painel da SuperFrete ou por `POST
  /api/v0/order/cancel`, só antes de postar, com estorno na carteira). A busca de rastreio só acontece
  durante a compra (até ~12s); se ainda faltar depois disso, não há uma re-consulta automática depois do
  despacho — o operador confere manualmente no painel da SuperFrete e atualiza o pedido, se precisar.
