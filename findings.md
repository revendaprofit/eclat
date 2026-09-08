# findings.md — Pesquisa, descobertas e constraints

## Ambiente da máquina (2026-06-13)
- OS: Windows 10 Pro (19045)
- Node: v24.15.0
- npm: 11.12.1
- git: 2.53.0 (windows)
- PostgreSQL: **ausente** (psql não encontrado)
- Docker: **ausente**
- Pasta do projeto: c:\Users\Team WOD Brasil\Desktop\ECLAT (vazia no início)

## Constraints / pontos de atenção
- **Postgres obrigatório:** Medusa v2 exige PostgreSQL. Sem psql nem Docker local — decidir como provisionar:
  (a) instalar PostgreSQL nativo no Windows, (b) instalar Docker Desktop e subir Postgres em container,
  ou (c) usar um Postgres gerenciado (ex.: o próprio Supabase como banco do Medusa — avaliar implicação de manter
  Medusa e Supabase no mesmo cluster vs. separados). **PENDENTE de decisão do usuário.**
- **Node 24:** mais novo que o oficialmente recomendado pelo Medusa v2 (Node 20/22 LTS). Risco de incompatibilidade
  em dependências nativas. Mitigação: usar nvm-windows para fixar Node 22 LTS se o scaffold falhar.
- **Supabase:** projeto a provisionar no painel supabase.com (precisa login do usuário). Variáveis: SUPABASE_URL,
  SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL. Conexão testável sem criar tabelas na Fundação.
- **Mercado Pago:** apenas fase futura (Parte 4). Não implementar na Fundação.

## Decisões tomadas (2026-06-13)
1. PostgreSQL: **nativo no Windows** (instalar via winget/EDB). Não usar Docker nem Supabase como DB do Medusa.
2. Node: **tentar primeiro com Node 24**; plano B = Node 22 LTS via nvm-windows se houver falha em dependência nativa.
3. Supabase: projeto a ser criado manualmente pelo usuário (requer login). Pendente quando chegar no passo 6 da Fundação.

## Ferramentas de instalação disponíveis
- winget v1.28.240 e choco v2.7.1 presentes — usar winget para instalar o PostgreSQL.

## Marca — tokens visuais (referência para Tailwind)
- Paleta "luz/resplendor": neutros sofisticados (off-white, areia, grafite) + dourado suave (accent).
- Tipografia: serif editorial para títulos, sans limpa para texto.
- A definir valores hex exatos na aplicação dos tokens.

## 2026-07-26 — Pesquisa: IA para criação própria de peças (design → piloto)
Stack recomendado p/ ÉCLAT (barato, leigo-friendly):
- Tendências: Pinterest Predicts (grátis, ~88% acerto) + TikTok/IG; Heuritech/WGSN = caro, pular.
- Design/render: The New Black (packs $5-10, Pro $50/mês — design+try-on+tech pack+vídeo) OU NewArc.ai (sketch→foto).
- Estampas seamless: PatternedAI / Pattern Weaver (export 8K print-ready).
- Modelagem/simulação 3D: CLO 3D ($50/mês ou $225/ano, padrão da indústria, curva média) OU Tailornova ($49/mês, browser, iniciante, gera molde+gradação) OU Seamly2D (GRÁTIS, open-source, molde paramétrico multi-tamanho, sem simulação de caimento).
- Ficha técnica: geradores IA ($3-7/tech pack: aitechpacks.com, techpackgenerator.org) — SEMPRE revisar medidas antes da facção.
- Fotos/campanha: Botika ($22/mês Lite) ou Higgsfield (MCP já conectado no Claude!). 
- Peça piloto: facção local precisa de MOLDE (impresso/plotter) + FICHA TÉCNICA + tecido definido; ref. private label fitness: R2PB. IA não substitui pilotista — 1ª peça sempre ajusta em prova real.

## 2026-07-27 — DESIGN APROVADO: Conjunto 01 ÉCLAT (Flare Atelier)
- Conjunto off-white: blusa canelada manga longa costuras terracota COSTAS FECHADAS + calça flare cós alto off-white com vivos na cor RAMATEX LICOR 8316 (amostrada #D5823E) + nó ÉCLAT bordado no cós e etiqueta lettering terracota.
- Arquivos: docs/design/aprovados/CONJUNTO-01-*.png (frente/costas) + CALCA-01-*.png. Fotos geradas via Higgsfield (nano banana pro), modelo/estúdio consistentes p/ catálogo.
- Tecido a cotar: Ramatex Lightness ou Málaga; vivos em Licor 8316. Próximo: ficha técnica p/ facção.

## 2026-09-08 — F0 Benefício Conjunto
Spec: `docs/superpowers/specs/2026-09-08-beneficio-conjunto-design.md` (§6.3/§6.4) · Plano:
`docs/superpowers/plans/2026-09-08-conjunto-f0-prova-de-conceito.md` · Testes: `apps/backend/integration-tests/http/conjunto-poc.spec.ts`.

**Os quatro resultados (mais dois observacionais), todos com HTTP real contra Medusa 2.15.5:**
- **A** (1 top + 1 legging, sem divisão de linha): PASSOU. Desconto R$ 18,90 (10% do top, o mais barato), legging sem ajuste.
- **B** (Top ×2, 1 marcada, K=1 de N=2 — §6.3): PASSOU. Desconto R$ 18,90 (não R$ 37,80).
- **B2** (Top ×3, 2 marcadas, K=2 de N=3): PASSOU. Desconto R$ 37,80 (não R$ 56,70 nem R$ 18,90) — confirma que a divisão de contexto generaliza para K intermediário.
- **C** (cupom de itens `CUPOM10` com regra de exclusão `items.conjunto_desconto eq "nenhum"` — §6.4): PASSOU. `CONJUNTO-POC` = R$ 18,90 no top, `CUPOM10` = R$ 25,90 na legging, `discount_total` = R$ 44,80.
- **D** (cupom de pedido inteiro `PEDIDO10`, sem `target_rules`, sobre carrinho com `CONJUNTO-POC` já aplicado): observacional, R$ 42,91 — alcança a unidade em conjunto, mas incide sobre o subtotal já líquido (compounding), não duplica sobre o preço cheio.
- **D2** (tentativa de cupom de pedido `PEDIDO10X` **com** `target_rules`): REJEITADO pela Admin API nas duas tentativas de payload (sem `allocation`; com `allocation: across` + `max_quantity`) — `400 invalid_data`: `"Target rules for application method with target type (order) is not allowed"`.
- **Bônus** (empilhar `CUPOM10` sobre `PEDIDO10` já aplicado no mesmo carrinho — `POST /store/carts/{id}/promotions` é aditivo): `discount_total` combinado = R$ 85,12.

**Achados do motor de promoções (Medusa 2.15.5), não documentados oficialmente:**
- `target_rules[].attribute` de uma promoção **automática** precisa do prefixo `"items."` (ex.: `"items.conjunto_desconto"`). Sem o prefixo, o pré-filtro SQL de promoções automáticas (`build-promotion-rule-query-filter-from-context.js`) descarta a promoção antes da avaliação de regra — desconto fica 0, sem qualquer erro. A avaliação de regra em si aceita os dois formatos (remove o prefixo antes de ler a propriedade do item), o que mascara o problema até alguém comparar contra o pré-filtro.
- `application_method.max_quantity` é obrigatório quando `allocation: "each"` (senão `400`) e precisa ser um valor ALTO (usamos `1000`) — com `max_quantity: 1` o próprio motor capa o desconto em 1 unidade (`maximumPromotionAmount = unitPrice * (max_quantity ?? 1)`), escondendo se a divisão de contexto do gancho está de fato funcionando.
- `disableAutoTeardown: true` é obrigatório no `medusaIntegrationTestRunner` sempre que um `describe`/spec cria catálogo/admin/promoção uma única vez em `beforeAll` e reusa em múltiplos `it()` — o `afterEach` padrão faz `TRUNCATE` em todas as tabelas após cada `it()`, e o segundo teste em diante falha com um 400 enganoso de "chave publicável inválida" (na verdade, tudo foi truncado).
- Admin: em 2.15.5 o fluxo `register` → `POST /admin/users` sempre responde 401 (Medusa Cloud/self-host não expõe mais essa rota pública). O único caminho viável para criar o primeiro admin em teste é direto pelos módulos: `container.resolve(Modules.USER).createUsers(...)` + `container.resolve(Modules.AUTH).createAuthIdentities(...)` + assinar o JWT com as mesmas claims que o middleware `authenticate` lê. Não foi preciso testar se a Admin API aceita `attribute` customizado fora de módulo — as promoções (que são o caso real de `attribute` customizado) foram criadas via Admin API pública (`POST /admin/promotions`) com sucesso, sem precisar do `promotionModuleService` diretamente.
- Store API: `POST /store/carts` aceita `metadata` direto no payload de criação (usado para `conjunto_poc_k` no caso B2) — não foi preciso o fallback `PATCH /store/carts/:id`.

**Comando completo para rodar a suíte de integração no Windows** (Postgres em Docker + `.env.test`):
```bash
# 1. Subir o Postgres de teste (uma vez; container fica no ar entre execuções)
cd apps/backend
npm_config_script_shell="C:\Program Files\Git\usr\bin\bash.exe" npm run test:db:up

# 2. Rodar a suíte HTTP (a partir de apps/backend; .env.test já aponta pra localhost:55432)
npm_config_script_shell="C:\Program Files\Git\usr\bin\bash.exe" npm run test:integration:http -- --verbose

# 3. (opcional) Derrubar o container ao terminar
npm_config_script_shell="C:\Program Files\Git\usr\bin\bash.exe" npm run test:db:down
```
O prefixo `npm_config_script_shell` é necessário porque os scripts `test:db:up`/`test:db:down`/
`test:integration:http` usam sintaxe `VAR=valor comando`, que o `cmd.exe` (shell padrão do npm no
Windows) não interpreta — aponta a chamada do `npm run` para o Git Bash só para essa execução,
sem alterar `.npmrc`/config global do npm.
