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
