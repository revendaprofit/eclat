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

## Parte 6 — WhatsApp / BotConversa  [ ]
- [ ] Integração de mensageria
- [ ] Automações de relacionamento
**Aceite:** mensagem disparada e registrada no relacionamento.

## Parte 7 — Cockpit (módulo de orquestração)  [ ]
- [ ] Módulo que LÊ Medusa + Supabase e orquestra (nenhuma escrita de terceiro)
- [ ] Painéis operacionais
**Aceite:** cockpit consolida comércio + relacionamento em leitura.

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
