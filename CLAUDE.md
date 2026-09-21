# CLAUDE.md — Constituição do Projeto use.ÉCLAT
> Este arquivo é LEI. Leia no início de toda sessão e siga integralmente.
> (Fonte canônica. O gemini.md apenas redireciona para cá.)

## Identidade
use.ÉCLAT — marca premium e INDEPENDENTE de moda fitness (athleisure da "mulher inteira").
Nunca vincular a Éclat a nenhuma outra marca.

## Stack
- Vitrine: Next.js (PWA) consumindo a Store API do Medusa
- Core de loja: Medusa v2 (Node/TypeScript + Postgres)
- Relacionamento: Supabase (CRM, leads, conversas). WhatsApp via Evolution API (self-hosted).
- Cockpit: app Next.js SEPARADO (apps/cockpit) operando via APIs donas. Plano: architecture/cockpit.md.
- Pagamento: Mercado Pago — Checkout Transparente (Bricks; Pix + cartão até 4x), em construção. Decisão do dono em 2026-09-17: MP entra agora; a Getnet (Global API, portal docs.globalgetnet.com) entra depois como segundo provider do Medusa, quando liberar o sandbox. Spec: docs/superpowers/specs/2026-09-17-pagamento-mercadopago-design.md.

## Invariantes de arquitetura (inegociáveis)
1. A Éclat é UM sistema, internamente modular. Sem segundo sistema independente.
2. Fonte da verdade: Medusa = comércio (produto, estoque, pedido, pagamento);
   Supabase = relacionamento/financeiro próprio (cliente, lead, conversa, despesas, COGS).
   O Cockpit (app separado) lê e escreve SOMENTE pelas APIs donas (Medusa Admin API = comércio;
   Supabase = relacionamento/financeiro; Evolution = WhatsApp). Não duplica dado de comércio;
   Medusa é a fonte da verdade do comércio. Ver architecture/cockpit.md (plano canônico do Cockpit).
3. Dinheiro sempre em centavos inteiros (BRL). Nunca float.
4. Pagamento sempre via API/SDK oficial do gateway (Mercado Pago; depois Getnet Global API), com o cartão tokenizado do lado do gateway. Nunca processar cartão na mão.
5. RLS (Row Level Security) no Supabase desde o início.
6. Nunca adivinhar business logic. Se houver ambiguidade, PERGUNTAR.

## Método de trabalho (B.L.A.S.T.)
- Data-First: schema aprovado ANTES de qualquer código.
- Halt entre partes: cada parte só avança após o critério de aceite aprovado.
- Auto-reparo: em erro -> ler o stack trace -> corrigir -> testar ->
  atualizar o SOP em architecture/ para o erro nunca repetir.

## Memória do projeto
- CLAUDE.md   -> esta constituição (lei)
- gemini.md   -> redireciona para CLAUDE.md
- task_plan.md -> as 11 partes do build e checklists
- findings.md  -> pesquisa, descobertas, constraints
- progress.md  -> feito, erros, testes, resultados
- architecture/ -> SOPs técnicos (ex.: catalog.md)

## Dois computadores, uma pasta raiz
Dono e sócia trabalham cada um no seu computador e na sua sessão do Claude Code. Em cada PC existe uma pasta
raiz (a pasta PAI deste clone) com a mesma forma:
- `eclat/` -> este repositório. Código só viaja por git (pull antes de começar, branch + commit, push é da pessoa).
- `brand-assets/` -> link para o Google Drive da marca: fotos do ensaio, logos, backups JSON. É a pasta que
  `scripts/import-lumiere.py` lê. Salvou ali, aparece no outro computador.
- `contexto-claude/` -> link para o Google Drive da marca: contexto operacional compartilhado entre as sessões.
- Este repositório é PÚBLICO. Conhecimento operacional (contas, preços, deploy, pendências com terceiros) vai em
  `contexto-claude/`, não aqui. Segredos não vão para o git nem para o Drive.
- Máquina nova: `powershell -ExecutionPolicy Bypass -File scripts\setup-maquina.ps1` cria os links e o
  `CLAUDE.md` da raiz. O clone nunca fica dentro do Drive. Caminhos sempre relativos à raiz, sem letra de drive.

## Estado atual
- Fundação (Parte 0): CONCLUÍDA. Repo: github.com/revendaprofit/eclat (conta revendaprofit fixada p/ push).
- Parte 1 — Catálogo: architecture/catalog.md. Região Brasil/BRL, vitrine pt-BR. 4 produtos-exemplo
  (seed: apps/backend/src/scripts/seed-eclat.ts). PENDENTE: produtos REAIS + imagens.
- Parte 2 — Vitrine: shell de marca pt-BR (nav, hero, home, footer). PENDENTE: telas de conta. (Busca com sugestões e SEO por listagem: entregues nas Fases 2–5 da spec de navegação por tipo de peça; PDP com vídeo do YouTube na galeria e recomendação de tamanho "Qual é o meu tamanho?" — plano `2026-09-07-pdp-video-e-recomendacao-tamanho`.)
- Parte 3 — Carrinho & Checkout: fluxo validado (pedido criado) + pt-BR. Pagamento = provider manual.
- Parte 4 — Pagamento (Mercado Pago, Checkout Transparente via **Orders API** `/v1/orders`): F0–F3 CONCLUÍDAS e F4 com código pronto em 2026-09-17 (SOP: architecture/pagamento.md). Spec aprovada (D1: pedido só após Pix pago; D2: até 4x; D3: desligar o provider manual no go-live; D4: conta no CNPJ). Provider `pp_mercadopago_mercadopago` (src/modules/mercadopago), vitrine com Pix + Card Payment Brick, Cockpit com bloco Pagamento + "(−) Taxas de pagamento" no DRE, reconciliação a cada 10 min. Branch feat/pagamento-mercadopago (worktree ../eclat-wt-pagamento), sem push. GO-LIVE PENDENTE do dono: credenciais de produção (Railway/Vercel), webhook "Order", ativar na região com "pode aplicar" (ativar-mercadopago-regiao.mjs), pagamento=gateway no Cockpit → Marketing. Credenciais só por .env/Railway/Vercel, pelo dono. Getnet: segundo provider, depois; não usar a Plataforma Digital antiga (developers.getnet.com.br, rotas /v1).
- E-mail transacional (Resend): provider `src/modules/resend` + subscriber `order.placed` → "pedido confirmado", em código desde 2026-09-18 (SOP: architecture/email.md). Só liga com `RESEND_API_KEY` no Railway; domínio e chave são do dono. Faltam os e-mails de envio/rastreio, senha e cancelamento.
- Frete (SuperFrete): cotação calculada no checkout (provider `superfrete_superfrete`, `src/modules/superfrete`) + etiqueta pelo Cockpit (spec `docs/superpowers/specs/2026-09-18-frete-superfrete-design.md`, SOP `architecture/envios.md`). Só liga com `SUPERFRETE_TOKEN` no ambiente. **COTAÇÃO NO AR em produção desde 2026-09-19** (`ativar-superfrete.mjs --aplicar`). FALTA para a ETIQUETA: variáveis `SUPERFRETE_*` no ambiente do Cockpit (remetente completo, nome com sobrenome), saldo na carteira e o primeiro pedido real. Avisos de entrega (webhook + job de 5 min, spec `2026-09-20-avisos-entrega-superfrete-design.md`, SOP `architecture/envios.md`): código completo na branch `feat/frete-superfrete`, aguardando o go-live do dono (ordem em `progress.md`, 2026-09-21; interruptor `SUPERFRETE_AVISO_PELO_BACKEND` desligado até o backend estar no ar).
- Regras de venda (2026-09-20): **pedido mínimo R$ 150 em peças** (preço cheio, sem descontos e sem frete) — avisa na sacola, trava o botão, recusa a criação da cobrança (`src/api/middlewares/pedido-minimo.ts`) e recusa o fechamento (`hooks/pedido-minimo.ts`). **Cupom nunca soma com o Benefício Conjunto**: por peça vale o MAIOR desconto (`marcarContexto` compara conjunto × cupom percentual; empate fica com o conjunto). **Cupons são de uso único no total** (`budget.type: "usage"`), nunca presos a cliente — `scripts/cupom.mjs --codigo X --percentual N --usos 1`. **Entrega por aplicativo** (`src/modules/entrega-app`): frete R$ 0 em Betim/RMBH por faixa de CEP (`ENTREGA_APP_CEPS` amplia sem deploy), exige aceite da cliente (gravado no pedido com texto e hora) e não gera etiqueta — retirada combinada por WhatsApp; ligar/desligar com `ativar-entrega-app.mjs`.
- Parte 5 — CRM/Supabase: architecture/crm.md + supabase/migrations/0001_crm_init.sql aplicados.
  Tabelas lead/cliente_rel/conversa com RLS (anon negado, backend via service_role). SUPABASE_DB_URL no .env.
- Parte 6 — WhatsApp via Evolution API (instância eclat): integração montada (lib/evolution, lib/supabase,
  api/webhooks/whatsapp) + webhook configurado. FALTA conectar o WhatsApp (QR) e testar. SOP: architecture/whatsapp.md.
- Cockpit: REDEFINIDO como app Next.js separado (apps/cockpit), plano completo e faseado registrado em
  architecture/cockpit.md (Fases 0–6). A página read-only no admin do Medusa (antiga "Parte 7" v0) está superada.
  Build por fase, com Halt.
  - Fase 0 (Shell): CONCLUÍDA. apps/cockpit (Next 15.5), login Supabase Auth (operador@eclat.local), porta 7001.
  - Fase 1 (Conversas): COMPLETA. Chat WhatsApp texto+mídia (conversation/message, realtime, Storage) +
    IA modo sugestão. IA usa **Google Gemini** (gemini-2.5-flash, REST), não Claude — decisão do usuário
    (@anthropic-ai/sdk instalado mas sem uso). WhatsApp da marca conectado (eclat=open).
    Túnel cloudflared é efêmero (re-subir + reapontar webhook ao retomar — ver architecture/whatsapp.md).
  - Fase 2 (Leads/Kanban): COMPLETA. Kanban 5 colunas (drag-and-drop nativo), ficha, captação, conversão →
    cliente Medusa; IA (Gemini) detecta estágio em modo sugestão.
  - Fase 3 (Produtos & Estoque): COMPLETA. Painel avançado via Medusa Admin API (comércio = fonte da verdade):
    lista com edição POR CÉLULA de preço/estoque; filtros+ordenação+busca; exportar CSV + ações em massa
    (/api/products/bulk); criar/editar/excluir produto (variantes, estoque inicial, imagem upload, ficha técnica);
    CRUD de categorias (com SUBCATEGORIAS em árvore), coleções e tags (/api/taxonomy/*, components/taxonomy-manager.tsx).
    Endpoints-chave: POST /admin/products (handle URL-safe; categorias via `categories:[{id}]`); preço
    POST /admin/products/{id}/variants/{vid} {prices:[{amount,currency_code:"brl"}]}; estoque CRIAR/ATUALIZAR nível
    POST /admin/inventory-items/{iid}/location-levels {location_id,stocked_quantity}; upload POST /admin/uploads (multipart "files").
    Stock location única: sloc (CD Brasil). DEFERIDO: editar estrutura de variantes existente; "avise-me".
  - Fase 4 (Clientes/Pedidos/Envios): COMPLETA. Clientes + Ficha 360° (pedidos/conversa/CRM); Pedidos (lista+detalhe);
    Envios (fila + Despachar: fulfillment+shipment+rastreio + aviso WhatsApp; transportadora SuperFrete
    (ver linha Frete)); Segmentos + follow-up WhatsApp.
    Rotas /api/customers* e /api/orders* (dispatch). COGS por variação no Supabase (produto_custo).
  - Fase 5 (Financeiro/DRE): COMPLETA. Despesas (finance_expense + categorias, migration 0004) CRUD; DRE do período
    (/api/finance/dre, centavos): Receita (pedidos pagos/autorizados) + Frete separado − COGS (produto_custo×itens) − Despesas
    = Resultado, com margem e alerta de itens sem custo. Tela Financeiro.
  - Fase 6 (Dashboard inteligente): COMPLETA. Home /api/dashboard: vendas de hoje + filas de ação clicáveis
    (a enviar, conversas pendentes, leads novos, estoque baixo c/ lista, reativação). 
  - **COCKPIT COMPLETO (Fases 0–6).** Pendências: validações finais no navegador; integrações externas futuras
    (SuperFrete (ver linha Frete); Getnet Parte 4 — inclui taxas no DRE).
- Benefício Conjunto (Spec 2) — F0 (prova de conceito) e F1 (backend: módulo, gancho, promoções, cupons, rotas admin/store) CONCLUÍDAS em código e em produção (deploy + seed feitos em 2026-09-09, regra padrão inativa). SOP em architecture/conjunto.md. F2 (Cockpit: telas Regras/Curados/painel na ficha do produto, architecture/cockpit.md §7) CONCLUÍDA em código; validação visual e redeploy do backend (capa_url nullable) PENDENTES do dono — roteiro em progress.md ("Benefício Conjunto F2"). F3 (Vitrine: página Conjuntos, página do conjunto, "Complete o conjunto" na PDP, selo "Forma conjunto"; architecture/catalog.md "Conjuntos na vitrine — Fase F3") CONCLUÍDA em código com aceite local completo (§11 itens 5–8); PENDENTES do dono: push/merge, redeploy do backend (ruling V2) antes do deploy da vitrine, e o roteiro de validação — progress.md ("Benefício Conjunto F3"). F4 (Carrinho/checkout/pedido + detalhe do pedido no Cockpit: etiqueta "Conjunto", resumo "Benefício Conjunto" separado de "Cupom", aviso de cupom, gatilhos "Feche mais um conjunto"; architecture/catalog.md "Carrinho e pedido — Fase F4") CONCLUÍDA em código, **sem mudança de backend**, com aceite local dos itens 1–4 e 10 do §11 (item 9 parcial: o checkout local não fecha por falta de frete/pagamento na região Brasil do seed). PENDENTES do dono: push/merge e deploy da vitrine (não há redeploy do backend por causa da F4), ativar a regra padrão no Cockpit e rodar o roteiro de validação — progress.md ("Benefício Conjunto F4"). Spec 2 encerrada em código (F0–F4).
- Próxima ação: validações no navegador OU retomar Parte 4 (Getnet Global API) / Parte 1 (produtos reais) / Partes 8-10 / deploy do Benefício Conjunto F1 (autorização do dono).
