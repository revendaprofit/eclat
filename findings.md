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
