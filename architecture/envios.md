# SOP — Envios / Despacho (Fase 4, Bloco 3)

O cockpit despacha pedidos pela **Medusa Admin API** (comércio = fonte da verdade) e avisa o
cliente por **WhatsApp** (Evolution). A integração com transportadora (**Melhor Envio**) está
**preparada**, mas opcional: sem credenciais, opera-se no **modo manual**.

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

## Modo transportadora (Melhor Envio) — ativar quando houver conta
1. Criar conta no Melhor Envio, gerar **token** (sandbox: https://sandbox.melhorenvio.com.br).
2. Preencher no `apps/cockpit/.env.local` (placeholders já existem, comentados):
   - `MELHOR_ENVIO_TOKEN` (Bearer), `MELHOR_ENVIO_SANDBOX` (true/false), `MELHOR_ENVIO_SERVICE` (1=PAC, 2=SEDEX…)
   - origem: `MELHOR_ENVIO_FROM_*` (postal_code, address, number, city, state, name, phone, document)
3. Reiniciar o cockpit. O botão **"Gerar etiqueta (Melhor Envio)"** passa a funcionar:
   carrinho → checkout (paga c/ saldo) → generate → print (PDF) → grava rastreio no Medusa + WhatsApp.
   Código: `apps/cockpit/lib/shipping.ts` (sequência documentada e cabeada).

> Pendência ao ativar: validar peso/dimensões reais por produto (hoje usa padrão 0,3 kg / 22×16×6 cm) e
> conferir o id do serviço. Sem token, `carrierCreateLabel` lança erro claro e a UI mantém o modo manual.
