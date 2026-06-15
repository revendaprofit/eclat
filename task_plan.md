# task_plan.md — Build da use.ÉCLAT (11 partes)

> Regra B.L.A.S.T.: cada parte só avança após o critério de aceite da anterior ser aprovado (Halt entre partes).
> Schema (Data-First) aprovado ANTES de qualquer código da parte.

Legenda: [ ] pendente · [~] em andamento · [x] concluído

---

## Parte 0 — Fundação  [x] CONCLUÍDA
Infra base, scaffold e memória do projeto. Sem catálogo real, pagamento, cockpit ou WhatsApp.
- [x] Memória do projeto: CLAUDE.md, gemini.md, task_plan.md, findings.md, progress.md
- [x] Projeto Medusa v2 via create-medusa-app (monorepo Turbo: apps/backend + apps/storefront)
- [x] PostgreSQL 17 local conectado (banco eclat_medusa) + migrações rodadas
- [x] Seed de dados de exemplo do Medusa (4 produtos, região Europe/EUR)
- [x] Usuário admin criado (admin@eclat.local); painel admin abre e loga (validado via API)
- [x] Vitrine Next.js conectada (publishable API key) listando produtos de exemplo (:8000)
- [x] Projeto Supabase provisionado + variáveis de ambiente (conexão testável via test-supabase.mjs, sem tabelas)
- [x] Tokens de marca aplicados na vitrine (Tailwind): paleta luz/resplendor + tipografia editorial (Inter + Cormorant)
- [x] README curto (como rodar + variáveis de ambiente)
**Aceite:** ✅ backend sobe, admin loga com produtos de exemplo; vitrine lista produtos com a cara da Éclat; Supabase com conexão testável.

## Parte 1 — Catálogo  [~] (estrutura + exemplos prontos; dados reais pendentes)
Modelagem do catálogo da Éclat no Medusa.
- [x] Data Schema registrado em architecture/catalog.md (APROVADO 2026-06-13)
- [x] Região Brasil/BRL criada; demo Europe/EUR + produtos demo removidos; vitrine em pt-BR (br)
- [x] Opções Tamanho (P/M/G/GG) e Cor; 8 categorias por tipo; 2 coleções (Resplendor, Luz Primeira)
- [x] 4 produtos-exemplo on-brand com variantes, preços BRL, ficha técnica (metadata) e estoque
- [x] Seed reproduzível: apps/backend/src/scripts/seed-eclat.ts (npx medusa exec)
- [ ] Imagens/mídia reais dos produtos (aguardando material da marca)
- [ ] Substituir produtos-exemplo pelos produtos REAIS (nomes, cores, preços, fotos)
**Aceite (parcial):** ✅ catálogo navegável no admin e Store API (BRL); produto renderiza na vitrine com R$ pt-BR.
**Halt:** abrir a substituição por dados reais quando a marca enviar catálogo + fotos.

## Parte 2 — Vitrine / Storefront  [~] (shell de marca pronto)
- [x] Home editorial: hero da marca + manifesto + faixa de categorias + coleções em destaque
- [x] Listagem por coleção (/collections/[handle]) e categoria (/categories) — validadas
- [x] Página de produto renderiza com a marca (tokens globais; preço pt-BR R$)
- [x] Navegação pt-BR: nav (logo use.ÉCLAT, Loja/Conta/Sacola) + menu lateral mobile
- [x] Footer Éclat (Categorias/Coleções/A Éclat), sem branding Medusa
- [x] Metadados pt-BR na home
- [ ] Busca, SEO por página (título de produto/categoria ainda usa template padrão), performance/Lighthouse
- [ ] Copy pt-BR de superfícies secundárias (cart dropdown, conta) — parte virá com Parte 3
**Aceite (parcial):** ✅ jornada home → categoria/coleção → produto fiel à marca, em pt-BR/BRL.

## Parte 3 — Carrinho & Checkout  [~] (fluxo validado + pt-BR)
- [x] Carrinho (add/remover/quantidade) persistente — starter, em pt-BR (Sacola)
- [x] Fluxo de checkout traduzido pt-BR: endereço, entrega, pagamento, revisão, resumo, cupom, confirmação
- [x] Pagamento manual (pp_system_default) na região Brasil — pagamento real fica na Parte 4
- [x] Gate de confiabilidade: PEDIDO criado de ponta a ponta via Store API (test-checkout.mjs)
      2× Legging (399,80) + frete (24,90) = 424,70 BRL → pedido #1 pending
- [ ] Validar a compra clicando pela vitrine no navegador (revisão do usuário)
- [ ] Copy pt-BR de telas de conta (login/perfil/pedidos) — pendente
**Aceite:** ✅ pedido criado no Medusa a partir do fluxo da vitrine (sem pagamento real ainda).

## Parte 4 — Pagamento (Mercado Pago)  [ADIADA por decisão do usuário em 2026-06-14]
> Pulada por enquanto. Checkout opera com provider manual/sistema até retomarmos.
- [ ] Integração via SDK oficial (cartão + Pix). Nunca processar cartão na mão
- [ ] Webhooks de status de pagamento
- [ ] Ambiente de sandbox e testes
- [ ] **Taxas de pagamento → DRE** (decidido 2026-06-15): capturar a tarifa REAL por transação (MP `fee_details`)
      e expor como linha própria do DRE "(−) Taxas de pagamento" (e/ou lançar despesa por pedido). É despesa
      financeira, NÃO é COGS. Também passar a registrar o MÉTODO (cartão/Pix/boleto) no pedido p/ relatórios.
      Até o MP entrar, taxa é só despesa manual (sem estimativa automática — escolha do usuário).
**Aceite:** pagamento sandbox aprovado reflete no pedido Medusa.
**Retomar quando:** o usuário fornecer o Access Token do Mercado Pago.

## Parte 5 — Relacionamento / CRM (Supabase)  [~] (schema + RLS aplicados)
- [x] Schema cliente_rel, lead, conversa (Data-First, aprovado) — architecture/crm.md
- [x] SQL versionado: supabase/migrations/0001_crm_init.sql (aplicado via psql/session pooler)
- [x] RLS habilitado desde o início; 0 policies (anon negado, service_role bypass) — provado: anon INSERT 401, service_role 201
- [x] Funil: novo→contatado→negociando→convertido→perdido; origens: instagram/whatsapp/indicacao/anuncio/site/pagina_eclat
- [ ] Sincronização de leitura com Medusa (sem terceiro escritor) — vai no Cockpit (Parte 7)
- [ ] Captura real de leads (formulário na vitrine / webhook BotConversa) — Parte 6
**Aceite:** ✅ CRM com RLS funcionando; leads registráveis via service_role (backend).

## Parte 6 — WhatsApp via Evolution API  [~] (integração montada; falta conectar+testar)
> Decisão 2026-06-14: usar **Evolution API** (self-hosted no Railway), instância dedicada `eclat`.
> SOP completo em architecture/whatsapp.md.
- [x] Instância `eclat` criada na Evolution (v2.3.7)
- [x] Backend: serviço de envio (lib/evolution.ts — sendWhatsappText)
- [x] Backend: webhook lib/supabase.ts + src/api/webhooks/whatsapp/route.ts (grava lead+conversa, valida token)
- [x] Config em .env: EVOLUTION_API_URL/KEY/INSTANCE/INSTANCE_TOKEN + WHATSAPP_WEBHOOK_SECRET
- [x] Túnel cloudflared + webhook da instância configurado (testado: túnel→backend 200)
- [x] Conectar o WhatsApp da marca via QR — CONECTADO (instância eclat = open; nº +55 31 91184431)
- [ ] Testar inbound/outbound → será feito na Fase 1A do Cockpit (com o novo modelo conversation/message)
**Aceite:** mensagem enviada e recebida registrada no relacionamento.
**Retomar:** ver "Como RETOMAR" em architecture/whatsapp.md (subir túnel → re-set webhook → conectar QR → testar).

## Parte 7 — Cockpit (app separado, plano faseado)  [~] plano registrado; build por fase
> REDEFINIDO em 2026-06-14: Cockpit é um app Next.js SEPARADO (apps/cockpit) que opera via APIs donas.
> Plano canônico completo em architecture/cockpit.md. A página read-only no admin do Medusa (v0) está superada.
> Construir UMA fase por vez, com Halt e critério de aceite.
- [x] Plano registrado (architecture/cockpit.md), referenciado no CLAUDE.md (invariante 2 emendado).
- [x] **Fase 0 — Shell**: apps/cockpit (Next 15.5 + Tailwind v4), login Supabase Auth (operador@eclat.local),
      middleware de proteção, menu lateral das 7 áreas (placeholders), identidade Éclat, /api/health.
      Validado: /login 200, / →307 /login, 3 conexões verdes (Medusa/Supabase/Evolution). Porta 7001.
- [~] **Fase 1 — Conversas (Chat WhatsApp)**:
      - [x] 1A (texto): schema conversation/message (migration 0002) + RLS + realtime; webhook reescrito
            (idempotente, cria/vincula lead); cockpit Conversas (lista+thread+envio) com Supabase Realtime.
            Validado real: enviar pelo cockpit ("ok") e receber via webhook. Túnel cloudflared (efêmero).
      - [x] 1A.2: áudio/mídia — webhook baixa da Evolution (getBase64) → Supabase Storage (bucket privado
            'whatsapp') → cockpit serve via proxy autenticado (/api/media). UI: imagem (clique amplia +
            baixar), áudio/vídeo (player + baixar), doc (link). Validado real (foto + áudio).
      - [x] 1B: IA modo sugestão — botão ✨ IA gera resposta na voz da Éclat; operador aprova/edita/envia.
            Provedor: Google Gemini (gemini-2.5-flash via REST). Rota /api/conversations/[id]/suggest.
            Composer = textarea com auto-resize (Enter envia, Shift+Enter quebra). Validado real.
**Fase 1 — COMPLETA** (texto + mídia + IA sugestão).
- [x] **Fase 2 — Leads (Kanban)**: 5 colunas (status) com drag-and-drop nativo; ficha do lead (notas, abrir
      conversa via ?c=, converter); captação (+ Novo lead); conversão → cria cliente no Medusa (Admin API) +
      vincula medusa_customer_id + cliente_rel. Rotas /api/leads (+/[id], /[id]/convert), lib/medusa.
      + IA detecta estágio (modo sugestão): /api/leads/[id]/classify (Gemini, saída JSON estruturada) →
        botão "✨ Detectar estágio" na ficha sugere estágio+motivo; operador confirma "Mover para X".
- [x] **Fase 3 — Produtos & Estoque**: COMPLETA. Painel avançado via Medusa Admin API (Medusa = fonte da verdade).
      - v1: lista com variações (SKU/preço BRL/estoque); EDIÇÃO POR CÉLULA (clica no preço/estoque e edita inline);
        alternar status; alerta de estoque baixo (≤5).
      - Bloco B: filtros (coleção/categoria/tag/status/estoque/faixa de preço) + ordenação + busca; contador.
      - Bloco C: exportar CSV (Excel pt-BR) da lista filtrada; ações em massa (publicar/despublicar, definir preço,
        ajustar/definir estoque) via /api/products/bulk.
      - Bloco A: criar produto (opções tamanho/cor → variantes, estoque inicial, imagem upload, ficha técnica),
        editar campos do produto, excluir. Lição: handle URL-safe; criar usa `categories:[{id}]`.
      - Bloco D: CRUD de categorias (com SUBCATEGORIAS/hierarquia em árvore), coleções e tags
        (components/taxonomy-manager.tsx, rotas /api/taxonomy/*).
      DEFERIDO: editar estrutura de variantes de produto existente (add/remover tamanho/cor); "avise-me" de reposição.
      - [ ] Validação final no navegador dos Blocos A/D (criar produto, criar subcategoria/coleção/tag).
- [x] **Fase 4 — Clientes / Pedidos / Envios**: COMPLETA (Blocos 1–4).
      - B1 Clientes + Ficha 360° (pedidos + conversa/CRM + endereços).
      - B2 Pedidos (lista + filtros + detalhe com itens/totais/entrega).
      - B3 Envios: fila "a enviar" + Despachar (fulfillment+shipment+rastreio) + aviso WhatsApp; transportadora
        Melhor Envio PREPARADA (lib/shipping.ts, env placeholders, SOP architecture/envios.md) — manual funciona já.
      - B4 Segmentos (novos/recorrentes/VIP/inativos/sem pedido) + follow-up WhatsApp (modelos na voz da Éclat).
      Rotas: /api/customers(+[id], [id]/followup), /api/orders(+[id], [id]/dispatch). Schemas de fulfillment/shipment
      confirmados na fonte do Medusa. DEFERIDO: validar despacho ao vivo (no navegador); credenciais da transportadora.
- [x] **Fase 5 — Financeiro (P&L)**: COMPLETA. Despesas (finance_expense + categorias, migration 0004, RLS) com CRUD;
      DRE do período (/api/finance/dre, em centavos): Receita (pedidos pagos/autorizados) + Frete (linha separada)
      − COGS (produto_custo × itens vendidos) − Despesas = Resultado; margem bruta + alerta de itens sem custo.
      Tela Financeiro: período, painel DRE, lançar/gerenciar despesas e categorias. Regras aprovadas pelo usuário.
- [x] **Fase 6 — Dashboard inteligente**: COMPLETA. Home consolida (1 chamada /api/dashboard): vendas de hoje
      (faturamento pagos/autorizados), e filas de ação clicáveis → pedidos a enviar, conversas pendentes, leads novos,
      estoque baixo (com lista p/ repor), reativação (recorrentes inativos +60d). Saudação por horário + conexões.
**Aceite global:** ✅ cockpit opera leads/clientes/compras/financeiro/chat via APIs donas — TODAS as fases (0–6) construídas.
**COCKPIT (Parte 7) — COMPLETO** (validações finais no navegador pendentes do usuário; transportadora real + Mercado Pago são integrações externas futuras).

## Parte 8 — Ciclo do consumível / Recompra  [ ]
- [ ] Modelagem do ciclo de recompra/recorrência
- [ ] Gatilhos de relacionamento por ciclo
**Aceite:** ciclo do consumível rastreado e acionável.

## Parte 9 — Conteúdo & Marca  [ ]
- [ ] Identidade visual consolidada, editorial, lookbook
- [ ] SEO avançado, conteúdo de marca
**Aceite:** experiência de marca premium consistente.

## Parte 10 — PWA / App  [ ]
- [ ] Instalável, offline básico, push
- [ ] Performance e Lighthouse PWA
**Aceite:** vitrine instalável como app, com a experiência Éclat.
