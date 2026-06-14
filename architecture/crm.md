# architecture/crm.md — SOP do Relacionamento/CRM (Parte 5)

> Schema de referência da camada de relacionamento (Supabase). APROVADO em 2026-06-14 (Data-First).
> Invariante 2: Medusa é dono do comércio; Supabase é dono do relacionamento. Nenhum terceiro escritor.
> Invariante 5: RLS ligado desde o início.

## 1. Princípios
- **Não duplicar comércio.** Cliente/pedido/pagamento vivem no Medusa. O Supabase referencia o cliente
  do Medusa por `medusa_customer_id` (texto, sem FK entre sistemas) e guarda só o que é relacionamento.
- **RLS em todas as tabelas.** Acesso apenas via `service_role` (backend/Cockpit). `anon` (vitrine pública)
  não acessa o CRM. Sem policies permissivas para anon/authenticated → negado por padrão.
- **Operação:** uma operadora por enquanto (campo `responsavel` é texto livre; sem login de equipe ainda).

## 2. Tabelas (schema `public`)

### lead — possível cliente captado antes/fora da compra
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| nome | text NOT NULL | |
| whatsapp | text | telefone/WhatsApp (formato BR ou E.164) |
| email | text | |
| origem | text | em: instagram, whatsapp, indicacao, anuncio, site, pagina_eclat |
| status | text NOT NULL default 'novo' | em: novo, contatado, negociando, convertido, perdido |
| interesse | text | o que a pessoa procura |
| responsavel | text | operadora responsável |
| notas | text | |
| medusa_customer_id | text | preenchido quando o lead converte em cliente |
| created_at / updated_at | timestamptz | updated_at via trigger |

### cliente_rel — perfil de relacionamento do cliente (não duplica o Medusa)
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| medusa_customer_id | text NOT NULL UNIQUE | elo com o cliente do Medusa (fonte da verdade lá) |
| whatsapp | text | |
| tags | text[] | segmentação |
| consentimento_lgpd | boolean NOT NULL default false | |
| consentimento_em | timestamptz | quando consentiu |
| notas | text | |
| created_at / updated_at | timestamptz | |

### conversa — interações de mensageria (WhatsApp/BotConversa)
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| lead_id | uuid FK lead(id) ON DELETE CASCADE | nullable |
| cliente_rel_id | uuid FK cliente_rel(id) ON DELETE CASCADE | nullable |
| canal | text | em: whatsapp, instagram, email, outro |
| direcao | text | em: entrada, saida |
| resumo | text | |
| conteudo | text | |
| status | text | |
| external_id | text | id no BotConversa/canal |
| ocorreu_em | timestamptz NOT NULL default now() | |
| created_at | timestamptz | |
- CHECK: ao menos um de (lead_id, cliente_rel_id) preenchido.

## 3. Índices
- lead(status), lead(whatsapp), lead(medusa_customer_id)
- cliente_rel(medusa_customer_id) UNIQUE
- conversa(lead_id), conversa(cliente_rel_id), conversa(ocorreu_em)

## 4. Regras
- `updated_at` atualizado por trigger (`set_updated_at`) em lead e cliente_rel.
- Enums modelados como TEXT + CHECK (fáceis de estender via ALTER) e documentados aqui.
- Conversão de lead: setar `lead.medusa_customer_id` e (idealmente) criar `cliente_rel` com o mesmo id.

## 5. Aplicação
- SQL versionado em `supabase/migrations/0001_crm_init.sql` (reexecutável: usa IF NOT EXISTS / DROP-CREATE de policies).
- Aplicar via connection string do Postgres do Supabase (psql) OU colar no SQL Editor do painel.

## 6. Pendências futuras
- Login de equipe (Supabase Auth) + policies por usuário, se a operação crescer.
- Ciclo do consumível / recompra (Parte 8) — tabela própria, ligada a cliente_rel.
- Sincronização de leitura Medusa↔Supabase no Cockpit (Parte 7), sem terceiro escritor.
