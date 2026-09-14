# Leitor de código de barras no Cockpit — design (2026-09-14)

> Status: **proposta para aprovação do dono** (CLAUDE.md: Data-First e Halt entre partes). Nenhum código escrito.
> Base já pronta em produção: SKU da etiqueta `ECL-<REF>-<TAM>` gravado em `variant.sku`, `variant.barcode` e
> `inventory_item.sku` das 30 variantes da Lumière (architecture/catalog.md "SKU da etiqueta e código de barras").

## 1. Decisões do dono (14/09/2026)

| Tema | Decisão |
|---|---|
| Fluxos | Conferência do pedido, entrada de estoque, contagem de inventário, venda presencial |
| Código na etiqueta | **Code 128 com o texto do SKU** (ex.: `ECL-1001-P`) |
| Leitor | USB ou Bluetooth em modo teclado (digita o código e envia Enter) |
| Nome da coleção | **Lumière** no site e na etiqueta (a planilha dizia "LUMINÁ": ajustar a arte antes de imprimir) |
| Histórico | **Sim**: toda movimentação de estoque feita pelo Cockpit fica registrada (quem, quando, antes/depois) |
| Conferência | **Avisa e permite despachar com motivo** quando a conferência não fecha |
| Venda presencial | **Espera o Mercado Pago** (Parte 4). Quando vier: nome e WhatsApp da cliente opcionais |

## 2. Princípios

- **Medusa continua sendo a fonte da verdade do estoque** (invariante 2). O Cockpit só lê e grava níveis pela
  Admin API. O histórico no Supabase é **auditoria do que o operador fez**, não uma segunda contagem de estoque.
- **Leitura sem instalar nada**: o leitor age como teclado. Um campo com foco recebe o código; Enter confirma.
- **Tolerância a leitura ruim**: normalização do código (maiúsculas, espaços, trocas típicas de layout de teclado
  ABNT2 × US, ex. `'` ou `/` no lugar de `-`), e aviso claro quando o código não é um SKU conhecido.
- **Nada muda sem confirmação**: entrada e contagem montam uma lista na tela; o estoque só é gravado no botão
  "Confirmar", com resumo do que vai mudar.

## 3. Dados (Data-First — aprovar antes do código)

### 3.1 Tabela nova `estoque_movimento` (Supabase, migração `0010_estoque_movimento.sql`)

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid pk | |
| `tipo` | text check in (`entrada`, `ajuste_inventario`, `saida_conferencia`, `venda_presencial`, `ajuste_manual`) | `venda_presencial` reservado para a fase futura |
| `sessao_id` | uuid | agrupa as linhas de uma mesma entrada/contagem |
| `sku` | text not null | |
| `medusa_variant_id` | text not null | |
| `inventory_item_id` | text not null | |
| `quantidade_antes` | integer not null | lido da Medusa imediatamente antes de gravar |
| `quantidade_depois` | integer not null | |
| `delta` | integer not null | `depois - antes` |
| `motivo` | text | obrigatório em `ajuste_manual` |
| `operador_email` | text not null | usuário logado no Cockpit |
| `created_at` | timestamptz default now() | |

RLS ligado sem policies (escrita via service_role, igual às demais tabelas). Índices em `sku`, `sessao_id`, `created_at`.

### 3.2 Conferência do pedido (sem tabela nova)

Registro gravado no **metadata do pedido** na Medusa (`POST /admin/orders/:id` com `metadata.conferencia`):
`{ status: "ok" | "divergente", itens: [{ sku, esperado, bipado }], motivo?, operador_email, em }`.
Fica junto do pedido e aparece no detalhe do Cockpit.

## 4. Fases

### F0 — Base do leitor (pré-requisito das outras)
- `lib/leitor.ts` (puro, testado): `normalizarCodigo`, `ehSkuDaEtiqueta`, contagem de leituras por SKU.
- Componente `CampoLeitor`: campo com foco permanente, Enter confirma, sinal visual + sonoro de acerto/erro,
  histórico curto das últimas leituras, botão "desfazer última".
- `GET /api/leitor/variante?codigo=` → variante por SKU/barcode via Admin API (`/admin/product-variants?q=`), com
  produto, cor, tamanho, estoque na localização padrão e reservado.
- Correção necessária: `medusaListProducts` hoje busca só 100 produtos sem paginar — a busca por SKU não pode depender
  dela.

### F1 — Conferência do pedido (antes de despachar)
- Detalhe do pedido passa a trazer `items.variant_sku` e `items.variant_id` (hoje não traz).
- Na gaveta do pedido, bloco "Conferir peças": lista de itens com esperado × bipado. Leitura de peça que não é do
  pedido, cor/tamanho trocado ou quantidade a mais → alerta vermelho.
- Conferência fechada → Despachar normal, grava `metadata.conferencia.status = "ok"`.
- Conferência aberta → Despachar pede **motivo obrigatório** e grava `status = "divergente"` com os itens.
- Rota de despacho valida no servidor que existe conferência (ok ou divergente com motivo).

### F2 — Entrada de estoque
- Página nova **Estoque → Entrada** (item no menu). Bipa as peças que chegaram; a tela soma por SKU e mostra
  estoque atual → estoque depois.
- "Confirmar entrada": para cada SKU relê o nível na Medusa, grava `stocked_quantity = atual + bipado` e registra
  `estoque_movimento` (`entrada`), tudo com a mesma `sessao_id`. Falha em um SKU não apaga os demais: a tela mostra o
  que entrou e o que falhou para tentar de novo.
- Rascunho da sessão salvo no navegador (não perde a bipagem se a página recarregar).

### F3 — Contagem de inventário
- Página **Estoque → Inventário**: escolhe o escopo (tudo, coleção ou categoria), bipa tudo que está na prateleira.
- Tela de diferenças: contado × sistema por SKU (inclusive SKUs do escopo que não foram bipados = contado 0), com
  destaque para faltas e sobras. Pedidos pagos ainda não despachados aparecem ao lado (a peça ainda está na
  prateleira).
- "Aplicar ajustes": só dos SKUs marcados; grava o nível e registra `estoque_movimento` (`ajuste_inventario`).
- Rascunho salvo no navegador; a contagem pode ser pausada e retomada.

### F4 — Venda presencial (adiada até o Mercado Pago)
Registrado para não perder o desenho: carrinho pela Store API (para o **Benefício Conjunto** continuar valendo),
opção de entrega "Retirada no balcão" (R$ 0, precisa ser criada na Medusa), cliente com nome e WhatsApp opcionais,
pagamento pelo Mercado Pago (Parte 4), despacho imediato (baixa o estoque) e `estoque_movimento` (`venda_presencial`).

### Extra opcional — Etiquetas com Code 128 no Cockpit
Página que gera a folha de etiquetas (SKU, modelo, cor, tamanho, "Lumière" e o código de barras) a partir da
Medusa, para imprimir sem depender da planilha. Só se a gráfica/etiquetadora atual não já gerar o código.

## 5. Critérios de aceite (por fase)

- **F0**: leitor real bipando `ECL-1001-P` no campo encontra a variante certa; código com `'` ou minúsculas também;
  código desconhecido mostra erro sem travar o campo; testes do `lib/leitor.ts`.
- **F1**: pedido com 2 peças só libera Despachar sem motivo depois das 2 bipadas certas; peça errada alerta; despacho
  com divergência exige motivo e grava `metadata.conferencia`.
- **F2**: bipar 3× `ECL-1003-M` e confirmar soma 3 no estoque da Medusa e cria 1 linha de histórico com antes/depois.
- **F3**: contagem com uma falta e uma sobra mostra as duas; aplicar ajusta só as marcadas e registra no histórico.

## 6. Fora de escopo

Nota fiscal (NFC-e/NF-e), múltiplos estoques/lojas, EAN-13/GS1, aplicativo de celular com câmera.
