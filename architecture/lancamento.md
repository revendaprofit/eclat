# PLANO MESTRE — Lançamento da ÉCLAT (perfil + site + vendas)
> Consolidado em 01/08/2026 a partir de 3 frentes trabalhadas por agentes
> (brand/storytelling, auditoria SEO do repo, traffic-masters). Complementa o
> architecture/ads.md (acessos e infra já concluídos).

## Visão geral e ordem de dependências

```
FOTOS DOS PRODUTOS ─┐
PIXEL+CAPI testados ─┼─► GSC + MERCHANT ─┐
                     │                    ├─► D0 REVELAÇÃO ─► ANÚNCIOS (D+7)
CONTA RESERVA (@) ───┼─► TEASER (D-7) ───┘
BASE ALWAYS INSTA ✅ ┘
```

Regras de ouro (vindas das 3 frentes, todas concordam):
1. **Anúncio só DEPOIS do rebranding** — o anúncio sai assinado pelo @.
2. **Sem Purchase validado no CAPI, R$0 de gasto.**
3. **A virada precisa de narrativa** — sem os 3 atos, os 6.128 seguidores viram estranhamento (~30% de perda; com narrativa, meta < 12%).
4. **Não rodar anúncios na 1ª semana pós-troca de @** (algoritmo reclassificando a conta).

## DECISÕES PENDENTES DO DONO (bloqueiam o cronograma)
- [ ] **O @ definitivo da ÉCLAT** (ex.: @use.eclat / @eclat.oficial — verificar disponível)
- [ ] **Data do D0** (recomendação: uma SEXTA, melhor dia do perfil; contar D-14 de preparação)
- [ ] **Cenário de orçamento de anúncios**: R$30/dia (aprendizado) · R$70/dia (girar) · R$150/dia (ritmo real)
- [ ] **Fotos reais dos produtos** na loja (bloqueia o feed do Merchant — feed sai vazio sem foto)

---

## FRENTE 1 — Virada do Instagram (@teamwodbr → ÉCLAT)

### Checklist técnico
**D-14 a D-8 (preparação, invisível):**
- [ ] Criar conta reserva com o @ novo (segura o handle; depois da troca, ela captura @teamwodbr)
- [ ] Backup do perfil (Baixar seus dados)
- [ ] Auditar 1.403 posts: marcar p/ ARQUIVAR (nunca deletar) o que é só "comunidade de treino"
- [ ] Preparar assets: foto de perfil (nó), capas de destaques, bio, link

**D-7 a D-1 (teaser):**
- [ ] Arquivar em lotes de 30–50 posts/dia (nunca em massa num dia)
- [ ] Fixar 1–3 posts de transição no topo

**D0 (revelação — nesta ordem):**
- [ ] Foto de perfil → nome "ÉCLAT" → @ novo → bio (com "antes Team WOD Brasil ✦" por 30 dias) → categoria "Marca de roupas" → link da loja
- [ ] Capturar @teamwodbr na conta reserva EM MINUTOS após liberar
- [ ] Destaques novos: Quem somos · Lumiére · Blackout · A caixa · Kit de mãos · Pulseira

**D+1 a D+30:** resposta-padrão humanizada p/ "quem são vocês?"; manter menção à transição na bio por 30 dias.

### Narrativa (3 atos)
- **Ato 1 Teaser (D-7→D-1)**: o ordinário — bastidores sem revelar nome (tecidos, nó, mãos calejadas, caixa). Stories diários + 2 posts de feed. SEM Reels (o teaser sussurra).
- **Ato 2 Revelação (D0→D+7)**: Reel-manifesto da fundadora no D0 ("Passei anos entregando roupas de outras marcas na sua porta. Hoje entrego a minha."). Perfil muda de pele no mesmo dia.
- **Ato 3 Consolidação (D+8→D+30)**: a cliente é a heroína. Provas: unboxing, kit de mãos pós-WOD, pulseira. 3–4 posts/semana, sexta > terça > quinta, Reels como âncora.

### Semana da revelação (D0 = sexta)
| Dia | Peça | Gancho |
|---|---|---|
| Sex D0 | Reel-manifesto + troca do perfil | "Hoje entrego a minha." |
| Sáb D+1 | Stories | Por que ÉCLAT? O nó, l'éclat du soleil |
| Dom D+2 | Carrossel | "Não é sobre roupa. É sobre a mulher que faz tudo — e ainda treina." |
| Seg D+3 | Reel unboxing | Caixa-gaveta em silêncio — "LESS NOISE, more focus" |
| Ter D+4 | Feed + stories | "A gente sabe o que os seus calos significam." (kit de mãos = ponte crossfit) |
| Qua D+5 | Stories | Bastidor Blackout na loja; "o que vocês pediram, item por item" |
| Qui D+6 | Reel | "MOVE HEAVY, RUN FAST" — mulheres reais treinando pesado |
| Sex D+7 | Feed + stories | Pulseira: "cada coleção, um capítulo no seu pulso" + CTA loja |

### Riscos: perda de seguidores (meta <12%), confusão de identidade (bio + destaque + resposta-padrão), queda de alcance 2–4 semanas (dobrar em Reels, não anunciar na 1ª semana), perda do handle antigo (conta reserva), audiência mista (aceitar o sacrifício — foco).

---

## FRENTE 2 — Google (site + buscas de marca)

Domínio: **https://www.useeclat.com.br** (Vercel eclat-loja). Código ~95% pronto:
sitemap.ts, robots.ts, canonicals, JSON-LD (Organization/WebSite/Product/Breadcrumb/FAQ/Article),
feed Merchant (feed.xml, nível variante), OpenAI feed + llms.txt, IndexNow, GTM+Consent, CAPI.

### Ações de painel (ordem)
1. [ ] Vercel: confirmar `NEXT_PUBLIC_BASE_URL=https://www.useeclat.com.br` + redeploy
2. [ ] **Search Console**: propriedade useeclat.com.br → meta tag no Cockpit → Marketing (`gsc_verification`) → enviar sitemap.xml → no D0, pedir indexação manual da home
3. [ ] **Merchant Center**: criar conta BR → confirmar site (herda do GSC) → listagens gratuitas → feed agendado diário `https://www.useeclat.com.br/feed.xml` → configurar FRETE no painel + política de devoluções + CNPJ
4. [ ] **GA4 + GTM**: criar container/propriedade → colar ids no Cockpit → Marketing
5. [ ] **Pixel/CAPI**: `meta_pixel_id` no Cockpit + `META_CAPI_TOKEN` na Vercel (gate dos anúncios!)
6. [ ] Google Business Profile: NÃO criar (e-commerce puro sem endereço físico)
7. [ ] Pós-fotos: abrir `/api/seo/indexnow` (ping Bing/Copilot)

**BLOQUEADOR: o feed sai VAZIO sem fotos nos produtos** (código pula produto sem imagem).

### Lacunas de código (pequenas, fazer antes do D0)
- [ ] `sameAs` (Instagram) no Organization JSON-LD — `apps/storefront/src/modules/seo/jsonld.tsx`; ideal: campo `instagram_url` no tipo Marketing (Cockpit) — depende do @ definitivo
- [ ] Feed: adicionar `g:google_product_category` (ex. 5322 Activewear), `g:gender=female`, `g:age_group=adult` — `app/feed.xml/route.ts` + `lib/util/feed-data.ts` (exigência GMC vestuário BR)
- [ ] Title da home via Cockpit (site_content): incluir "moda fitness premium" (sem deploy)

---

## FRENTE 3 — Anúncios (base de vendas)

### Gate (sem isso, R$0)
- [ ] Pixel + CAPI: eventos PageView→Purchase testados no Events Manager (dedupe por event_id)
- [ ] Catálogo/feed conectado ao pixel (habilita Advantage+ e DPA)
- [ ] Método de pagamento + saldo na conta (hoje saldo 0)
- [ ] Rebranding concluído + ponte narrativa publicada (3–5 posts)
- [ ] Arquivar as 3 campanhas antigas (não reaproveitar)

### Fases
- **F0 Aquecimento (2–3 sem pré-D0)**: OUTCOME_ENGAGEMENT (Reels teaser; envolvidos IG 365d + frio f 25-45) + OUTCOME_TRAFFIC (lista VIP da revelação). 60/40.
- **F1 Lançamento (D+7 → D+17, após semana orgânica)**: OUTCOME_SALES quente (envolvidos 90d + site + VIP; oferta empilhada: conjunto + caixa + kit + pulseira — nunca desconto seco; lote de estreia limitado) + OUTCOME_SALES frio Advantage+ (2 avatares × 3 ângulos, 6+ criativos). 60/40 quente.
- **F2 Contínuo (sem 3+)**: ASC + catálogo (3–5 criativos novos/sem) · DPA remarketing 14d · Topo sempre-ligada. Lookalike só após ~100 compras.

### Orçamento (BRL/dia): conservador 30 · moderado 70 · agressivo 150
Premissas moda fem BR 2026 (±40%): CPM R$25–55, conv. 0,8–1,5%, ticket ~R$250–350 → CPA frio R$80–200.
A R$30/dia: otimizar por AddToCart nos primeiros 14 dias (Purchase demora a aprender).

### Métricas de decisão
- 7d: CTR (matar <0,8% / escalar >1,5%), hook rate >25%, custo por ViewContent. NÃO julgar ROAS.
- 14d: custo ATC (alerta >R$40–50); matar sem compra após 2x CPA-alvo; ATC ok + Purchase 0 = problema na LOJA.
- 30d: ROAS blended ≥1,5–2,0 (quente ≥3).
- Escalar: +20% a cada 2–3 dias no vencedor + duplicar ângulo com hooks novos. Um teste por vez.

---

## CRONOGRAMA UNIFICADO (D0 = sexta escolhida)
| Quando | Instagram | Google/Site | Anúncios | Always Insta |
|---|---|---|---|---|
| D-21 | — | Fotos produtos + GSC + Merchant + GA4/Pixel | Gate: CAPI testada; F0 aquecimento começa | Design specs/frames (logo+paleta) |
| D-14 | Conta reserva; backup; auditoria posts | Lacunas de código (sameAs, feed) | F0 rodando | Grade teaser aprovada no painel |
| D-7 | Teaser (3 atos, ato 1); arquivar em lotes | Title home ajustado | F0 segue | Stories diários do teaser |
| **D0 (sex)** | REVELAÇÃO: troca completa + Reel-manifesto | Pedir indexação da home no GSC + IndexNow | PAUSA (semana orgânica) | Publicação da semana de revelação |
| D+7 | Ato 3 consolidação | Monitorar indexação | F1 LANÇAMENTO (quente+frio) | Grade contínua (playbook medido) |
| D+21 | Ritmo normal 3-4/sem | Merchant aprovado | F2 contínuo (ASC+DPA) | Autopilot com aprovação |
| D+30 | Remover "antes Team WOD" da bio; medir perda (<12%?) | Primeiras posições de marca | Revisão 30d (ROAS/CPA) | Playbook re-medido |
