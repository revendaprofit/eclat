# SOP — Especialista de Anúncios da ÉCLAT (Meta Ads + Always Insta)

> Padrão do projeto: este documento é a fonte da verdade do setup de anúncios.
> Mudou a regra? Atualize AQUI antes de mudar código ou config.

## 1. O time de agentes (já instalado globalmente)

Squad **traffic-masters** (`~/.claude/commands/traffic-masters/`) — ativar com `@traffic-chief`:

| Agente | Papel para a ÉCLAT |
|---|---|
| `traffic-chief` | Orquestrador — triagem (`*diagnose`), lançamento (`*campaign-launch`), auditoria (`*account-audit`) |
| `pedro-sobral` | Meta Ads Brasil — contexto BR/BRL, o principal para a ÉCLAT |
| `molly-pittman` / `ralph-burns` / `depesh-mandalia` / `nicholas-kusmich` | Estratégias Meta (CVJ, Tier 11, BPM scaling, Give-Give-Ask) |
| `ad-midas` + `creative-analyst` | Estratégia e análise de criativos |
| `performance-analyst` + `ads-analyst` | Relatórios, métricas, auditoria de conta |
| `pixel-specialist` | Pixel + CAPI + atribuição (casa com o setup já feito no storefront) |
| `scale-optimizer` + `fiscal` + `media-buyer` | Escala, orçamento, compra de mídia |

Tarefas prontas do squad: `create-ad-strategy`, `create-ad-creative`, `audit-ad-account`,
`analyze-performance`, `setup-tracking`, `manage-budget`, `scale-campaign`, `diagnose`, `review`.
Workflows: `wf-campaign-launch`, `wf-account-audit`.

Squads de apoio: **copy-squad** (Ogilvy, Schwartz, Halbert…), **hormozi-squad**
(ofertas/hooks/US$100M Ads), **brand-squad**, **data-squad**, **storytelling**.

Skills locais que completam o funil criativo:
- `copywriter` — copy de conversão (headline, CTA, descrição)
- `carrosseis-paper` / `recriar-carrossel` / `recriar-carrossel-image-gen` — criativos estáticos
- `gerar-sequencia-stories` — sequências de stories (métodos Nik Setting)
- `gerar-iscas` — lead magnets com Pixel + UTM
- `paper-design` — qualquer peça visual

## 2. Rastreamento (JÁ PRONTO no repo)

- Storefront: CAPI server-side em `apps/storefront/src/modules/analytics/capi.ts`
  (Purchase no pedido concluído). Pixel ID vem do Cockpit (site_content key `marketing`).
- Cockpit: tela **Marketing** (`apps/cockpit/app/(painel)/marketing/page.tsx`) configura
  `gtm_id`, `ga4_id`, `meta_pixel_id`, `google_ads_id`, `gsc_verification`.
- Segredo: `META_CAPI_TOKEN` como env no projeto Vercel `eclat-loja` (Production + Preview).

## 3. Acesso à conta de anúncios do Meta (estado + o que falta)

Estado verificado em 01/08/2026:
- Infra de acesso vive no **Always Insta** (`Desktop\Always INSTA\platform`), módulo
  `src/ads/metaAds.js` — Marketing API com Token de Usuário do Sistema (não expira),
  permissões `ads_read` + `ads_management`, Acesso Padrão (sem revisão da Meta).
- Token atual = usuário do sistema **"AlwaysAds"**; hoje enxerga SOMENTE a conta
  `act_1201432288790924` (UAIROX). **A ÉCLAT ainda não está compartilhada.**
- Multi-conta por perfil: `src/ads/contexto.js` — cada perfil da tabela `accounts`
  pode ter `ads_account_id`, `ads_token`, `ads_page_id`, `ads_ig_user_id` próprios;
  o `.env` é o padrão apenas do perfil dono (leo.berg_/UAIROX).

Verificado em 01/08/2026 (prints do usuário):
- BM escolhido para a ÉCLAT: **"BM - Camila de Moura Nogueira"** (ID 576261903129537), VERIFICADO ✅.
- Nesse BM: conta de anúncios única **"Team WOD Brasil"** (`act_1730969517306822`, própria do BM;
  pessoas: Camila Nogueira e Marcelo Paiva, acesso total); usuário de sistema único
  **"Conversions API System User"** (ID 61569381950296, Employee, sem ativos); **nenhum app**.
- O AlwaysAds NÃO está nesse BM → vive no BM da UAIROX (outro portfólio).
- DECISÃO DO DONO (01/08/2026): os ativos do Team WOD Brasil serão REBATIZADOS como ÉCLAT
  (mesmos IDs — renomear não muda ID). IDs definitivos da ÉCLAT:
  - Conta de anúncios: `act_1730969517306822`
  - Página do Facebook: `341930388993742`
  - Instagram business: `17841405904471948` (hoje @teamwodbr → novo @ da ÉCLAT)
  Pendente do rebranding: trocar @ e nome no app do IG; renomear a Página; renomear a conta
  de anúncios no BM. Anúncios só devem rodar DEPOIS do rebranding (para não sair como @teamwodbr).

Caminho ESCOLHIDO (01/08/2026, "Opção B"): **robô próprio da ÉCLAT no BM da Camila** —
independência total, sem vínculo com o BM da UAIROX:
1. Usuário de sistema novo no BM da Camila: **"EclatAds"**, função Admin
   (Usuários → Usuários do sistema → Adicionar).
2. App novo em developers.facebook.com vinculado ao BM da Camila (tipo Empresa/Business).
   Acesso Padrão da Marketing API basta (conta própria — sem revisão da Meta).
   FEITO 01/08/2026: app **"Eclat Ads"**, ID `1717634332686243`, modo desenvolvimento
   (suficiente para conta própria). Obs.: a Meta exige um app no BM ANTES de permitir
   criar usuário de sistema — por isso o app veio primeiro.
3. No EclatAds → *Gerar token* → selecionar o app → permissões `ads_read` + `ads_management`
   (+ `business_management` opcional) → validade "nunca expira". Guardar o token.
4. No EclatAds → *Adicionar ativos* → conta de anúncios `act_1730969517306822` (controle total),
   Página `341930388993742` e IG `17841405904471948`.
5. Gravar o token no campo `ads_token` do perfil no banco do Always Insta (accounts
   id `ad9b1a0d-...`) — o contexto.js usa o token do perfil no lugar do token do .env.
   A conta de anúncios usada é a "Team WOD Brasil" (rebatizada p/ ÉCLAT no futuro).

**CONCLUÍDO em 01/08/2026.** Usuário de sistema EclatAds (ID 61592699192840, Admin) com os
4 ativos em acesso total; token "nunca expira" validado via API (permissões: ads_read,
ads_management, business_management, pages_show_list, instagram_basic) e gravado em
`accounts.ads_token`. Estado da conta na validação: ativa, BRL, fuso America/Sao_Paulo,
R$1.720,00 gastos históricos, saldo 0; IG @teamwodbr com 6.128 seguidores/1.403 posts;
3 campanhas antigas TODAS PAUSADAS ("Posts Virais" engajamento, e 2 CBO de venda RMKT/FRIO).
Nota de segurança: se o token vazar, "Anular tokens" no EclatAds e gerar outro.

Bônus CAPI: o "Conversions API System User" desse BM é a fonte natural do `META_CAPI_TOKEN`
do storefront — Events Manager → conjunto de dados (pixel da ÉCLAT) → Configurações → Gerar token.

## 4. Integração com o Always Insta (posts/stories diários)

Estado: o Always Insta tem 4 perfis (leo.berg_, @revendaprofit.app, teixeirarox,
uairox.hybridrun) — nenhum da ÉCLAT. Nichos registrados: `corrida_hibrida`,
`generico_continuo`, `revenda_profit` (`src/niches/index.js`).

Plano (executar no repo do Always Insta, respeitando as regras da Zona Verde):
1. Cadastrar o perfil IG da ÉCLAT via wizard de conta (`src/api/wizard.js`).
2. Nicho: começar com `generico_continuo`; evoluir para um cérebro próprio
   `eclat_moda` (e-commerce de moda fitness feminina premium) quando o playbook
   de conteúdo da marca estiver definido.
3. Regras invioláveis herdadas do motor: stories = imagem/vídeo puro (sem stickers),
   CTA "link na bio", arte de IA nasce `aprovado = false`, prova social só com
   dado real cadastrado, teto de posts é limite (não meta).
4. Loop diário: planner do nicho gera a grade → artes renderizadas → aprovação
   humana no painel → publicação automática via Graph API → métricas de volta
   para o performance-analyst do traffic-masters.

## 5. Fluxo de trabalho do especialista (visão de operação)

1. **Estratégia**: `@traffic-chief` + `pedro-sobral` → `create-ad-strategy` (oferta via hormozi-squad).
2. **Criativos**: `ad-midas` define ângulos → skills de carrossel/stories/copywriter produzem.
3. **Campanha**: publicar via painel Anúncios do Always Insta (Marketing API) ou Ads Manager.
4. **Análise**: `performance-analyst` lê métricas (spend/CTR/CPC/leads em `metaAds.js`
   já convertidas para reais) → `scale-optimizer` decide escala; `audit-ad-account` mensal.
5. **Orgânico diário**: Always Insta publica posts/stories da grade aprovada — criativos
   vencedores do orgânico viram anúncio (e vice-versa).

## Pendências (decisões/ações do dono)
- [ ] Rebranding dos ativos QUANDO o dono decidir (adiado em 01/08): novo @ e nome no IG (app),
      renomear Página e conta de anúncios no BM. Depois, atualizar `accounts.username` no
      banco do Always Insta (hoje = 'teamwodbr').
- [ ] Compartilhar os 3 ativos com o BM da UAIROX (Atribuir parceiro) e, lá, adicioná-los ao
      usuário de sistema AlwaysAds (seção 3, passos 1–4). Depois: validar via API (Claude faz).
- [x] Perfil registrado no banco do Always Insta (01/08/2026): accounts id
      `ad9b1a0d-11d6-4a13-b074-3fcd9ea9952f`, username 'teamwodbr', nicho `generico_continuo`,
      **status 'paused'** (sem access_token ainda), com os 3 IDs de anúncios preenchidos.
- [x] Instagram conectado (01/08/2026): token IG Login gerado no app **Always UAIROX**
      (2269480650492054 — @teamwodbr já estava cadastrado lá, webhook ativado), validado
      (user_id = 17841405904471948, account_type MEDIA_CREATOR) e gravado em `access_token`.
      Perfil **ATIVADO** (`status='active'`) — coletor de métricas ligado; publicar continua
      dependendo de playbook + aprovação humana. Obs.: o refresh automático usa
      graph.instagram.com/refresh_access_token (o próprio sistema renova).
- [x] Base da Empresa gravada (01/08, v1) a partir dos PDFs de branding do dono
      ("Branding Éclat", "use.Eclat Mix", "Coleção Éclat aprovação 01"): essência l'éclat du
      soleil, público "mulher inteira", coleção Lumiére, kit de mãos, caixa-gaveta, tom de voz,
      regras (nunca vincular a outras marcas, sem prova social inventada).
- [x] Playbook MEDIDO gerado (01/08, amostra 39 posts reais): Reels alcance mediano 528 vs
      feed 263; melhores dias sexta > terça > quinta; interação ~4,7%. Objetivo: lançar a
      ÉCLAT e vender a coleção mantendo a audiência fitness na transição.
- [ ] Design specs + frames (identidade visual das artes: cores, fontes, logo da ÉCLAT) —
      precisa dos arquivos de marca (logo PNG/SVG + paleta), os PDFs são imagem.
      Sem isso o motor planeja mas não RENDERIZA arte final.
- [ ] Corrigir META_APP_ID/SECRET do .env (app 1039306095126247 inválido — "system error";
      trocar pelas credenciais do app Always UAIROX p/ reativar validação de webhooks de DM).
      PUBLIC_BASE_URL (túnel cloudflare) também está vencido.
- [ ] Pixel da ÉCLAT: criar/confirmar conjunto de dados no Events Manager deste BM, preencher
      `meta_pixel_id` no Cockpit → Marketing e gerar `META_CAPI_TOKEN` pelo Conversions API
      System User → env na Vercel (projeto eclat-loja).
- [ ] Decidir quando criar o cérebro de nicho `eclat_moda` no Always Insta (começa em `generico_continuo`).

## 6. Auditoria da conta — 10/09/2026 (via conector Meta Ads do Claude, login do dono)

Acesso: o conector Meta Ads (MCP) desta sessão enxerga `act_1730969517306822` diretamente
(login Leonardo Berg) — cria/edita campanhas, públicos, catálogo e lê métricas sem passar
pelo módulo `metaAds.js` do Always Insta.

Estado verificado:
- Conta `act_1730969517306822` ATIVA, BRL, método de pagamento OK, ainda chamada
  "Team WOD Brasil - Conta de anúncio". Página ainda "Team WOD Brasil"; IG ainda @teamwodbr.
- Página "PWRD by Coffee Floripa" (109987848788076) também está vinculada à conta (outra marca).
- `ads_get_ig_accounts` retorna vazio → verificar no BM se o IG está atribuído à conta de anúncios.
- 3 campanhas antigas (Posts Virais R$90; CBO RMKT R$700,94; CBO FRIO R$749,06), todas
  PAUSADAS desde 01/08/2026. 10 conjuntos e 15 anúncios, todos do Team WOD.
- Públicos: ~100 públicos salvos. Os `[IG] - *` (seguidores 5,1–6k, envolvimento, direct,
  salvou) continuam válidos após o rebranding (mesmo IG id). Os `[ST] - *` e TODOS os
  "Semelhante" apontam para o pixel **1612810719469817 = "PWRD by Coffee BH-Floripa"**
  (outra marca) → inúteis para a ÉCLAT; recriar no pixel novo.
- **BUG DE RASTREAMENTO:** o Cockpit → Marketing está com `meta_pixel_id = 1612810719469817`
  (pixel da PWRD by Coffee). A CAPI da loja mandaria Purchase para o pixel errado.
  Conjuntos de dados no BM: `2046614265773792` "Team WOD Brasil" (limpo, nunca disparou),
  `1559417004701918` "PIXEL TWB" (parou em nov/2024), `1612810719469817` PWRD (0 eventos 28d).
- Site em produção: modo "EM BREVE" (gate) — nenhum evento de pixel sai hoje. GTM
  `GTM-55868KTG` está injetado; o Pixel do navegador depende de tag dentro do GTM (não auditável
  daqui). Feed `https://www.useeclat.com.br/feed.xml` já serve 96 variantes / 8 produtos com
  imagem (PNG ~4,8 MB cada — otimizar depois).
- **CRIADO 10/09/2026:** catálogo **"ÉCLAT - Catálogo"** `1378297474017580`, feed
  `1094214839674108` (URL acima, diário 03:00 America/Sao_Paulo). Falta conectar ao pixel
  da ÉCLAT (depende da decisão do pixel).
- 10/09 (print do dono): o Instagram JÁ FOI rebatizado para **@eclat.use** (6,1 mil seguidores).
  A Página do Facebook continua "Team WOD Brasil" (4 seguidores). Atualizar `accounts.username`
  no Always Insta (hoje 'teamwodbr').
- Pixels ATRIBUÍDOS à conta de anúncios: só o `1612810719469817` (PWRD by Coffee). Os outros dois
  conjuntos (`2046614265773792`, `1559417004701918`) existem no BM mas NÃO estão atribuídos à
  conta — por isso o Cockpit foi preenchido com ele. Pixel não se liga a Página nem a IG; liga-se
  ao BM (dono) e à conta de anúncios (atribuição de ativo).

### Decisões e ações de 10/09/2026
- **DECISÃO DO DONO:** o pixel da ÉCLAT é o `1612810719469817` (a PWRD by Coffee não usa mais).
  O Cockpit → Marketing JÁ está com esse ID — não mexer. Dono renomeia o conjunto de dados para
  "ÉCLAT - Pixel" no Gerenciador de Eventos. Os públicos `[ST]`/Semelhante antigos voltam a ser
  válidos (mesmo pixel) — vão encher conforme o site sair do "Em breve".
- Catálogo `1378297474017580` CONECTADO ao pixel `1612810719469817` (habilita Advantage+ catálogo e DPA).
- Campanhas antigas: o conector recusa status ARCHIVED (força PAUSED). Renomeadas com prefixo
  `[TWB-ARQUIVO]` e pausadas; arquivar de fato = dono no Gerenciador (selecionar 3 → Arquivar).

### Pendências do dono (painéis Meta) — atualizado 10/09/2026
- [x] Gerenciador de Eventos → conjunto `1612810719469817` renomeado para "ECLAT - Pixel" (10/09).
- [x] Token da CAPI gerado (Dataset Quality API, só o pixel ÉCLAT) e gravado na Vercel como
      `META_CAPI_TOKEN` (10/09). Validado em produção: `GET /api/marketing/capi-test` →
      `configured.pixel=true, token=true`. Teste de evento: `?code=TESTxxxx` (aba Eventos de teste).
- [x] GTM `GTM-55868KTG` Versão 2 "Meta Pixel + eventos" PUBLICADA (10/09 20:09) a partir de
      `docs/marketing/gtm-meta-pixel-container.json`: tag base (All Pages + consent_update, exige
      ad_storage) + ViewContent/AddToCart/InitiateCheckout/Purchase lendo o dataLayer, eventID =
      `event_id` (Purchase = `purchase_<order.id>`, mesmo da CAPI). Validado em produção 10/09 20:10:
      `fbq` carregado, pixel 1612810719469817 inicializado, PageView disparado, cookie `_fbp` criado.
      Bug corrigido no caminho (commit fe9b444): consent update era um push de função vazia →
      "Command name not specified" no GTM. Eventos de produto/carrinho só testáveis após sair do "Em breve".
- [ ] Gerenciador de Anúncios: arquivar as 3 campanhas `[TWB-ARQUIVO]`.
- [ ] BM → Configurações → Contas de anúncios → renomear para "ÉCLAT - Conta de anúncio".
- [x] Página do Facebook renomeada para "ÉCLAT" (10/09 19:10), foto de perfil (nó) e capa C aplicadas,
      bio, categoria "Roupas e vestuário", site, e-mail useeclatbr@gmail.com, tel +55 31 99118-4431,
      IG eclat.use e YouTube vinculados. Assets em docs/design/brand/facebook/. Falta: @ da Página,
      botão de ação "Comprar agora" (link com UTM) e conferir o número do WhatsApp (apareceu com 8 dígitos).
- [x] API confirma (10/09 19:10): Página "ÉCLAT" 341930388993742 e IG @eclat.use 17841405904471948
      visíveis para a conta de anúncios — anúncios já sairão assinados pela ÉCLAT.
- [ ] Opcional: remover a Página "PWRD by Coffee Floripa" da conta de anúncios (higiene).
- [ ] Always Insta: `accounts.username` 'teamwodbr' → 'eclat.use'.

- [x] Domínio `useeclat.com.br` VERIFICADO no BM (10/09 18:50) (Segurança da marca → Domínios, id 1354366457752076),
      método metatag. Valor gravado em `site_content.marketing.meta_domain_verification` (10/09) e
      injetado no `<head>` pelo storefront (commit 810f0db). Pendente: "Conectar ativos" (pixel + Página).
