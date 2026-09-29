# Programa de creators — operação de influência feita pela própria ÉCLAT (desenho)

> Rascunho de 2026-09-29 para aprovação do dono. Nada aqui está em código. Continua o desenho de parcerias
> (`2026-09-25-parcerias-influencer-design.md`), que já cobre cupom, comissão, vendas por parceira e repasse.
> Método da constituição: schema aprovado antes de qualquer código, e Halt entre as fases.

## 1. O que é

Fazer dentro do Cockpit a operação que plataformas de influência vendem por mensalidade: encontrar a creator,
avaliar pelo perfil, fechar a parceria, mandar a peça, acompanhar e aprovar o conteúdo, medir a venda e decidir
com quem continuar. Sem custo fixo de plataforma.

### Decisões do dono (2026-09-29)
| # | Decisão |
|---|---------|
| D1 | **Só comissão.** Não há cachê. O formato é o das parcerias: cliente ganha 10% nas peças, parceira ganha 5% do valor das peças pago. |
| D2 | **Toda creator aprovada recebe uma peça de presente.** |
| D3 | **A ÉCLAT pode usar o conteúdo da creator (inclusive em anúncio) durante toda a parceria.** Acabou a parceria, acabou o direito. |
| D4 | **Quem opera é a Camila** (dona da marca). |
| D5 | **Sem portal da creator por enquanto.** A comunicação é por WhatsApp, e **toda venda com o cupom dela gera uma mensagem para ela.** |

## 2. O que já existe e é reaproveitado

- Tabelas `parceria` e `parceria_repasse` (migration 0013), script `scripts/parceria.mjs`, tela Cockpit → Crescimento →
  Parcerias (F2, em código) com cálculo puro em `apps/cockpit/lib/parcerias.ts`.
- Venda atribuída pelo cupom gravado no pedido (`order.promotions[].code`).
- Envio de WhatsApp: `apps/backend/src/lib/evolution.ts` (`sendWhatsappText`, `EvolutionHttpError.numeroInexistente`).
- Padrão de envio único com reserva atômica e estados finais: `apps/backend/src/lib/aviso-despacho.ts`
  ("duplicar é pior que faltar"). O aviso de venda copia esse padrão.
- `order.placed` já é o "pagamento aprovado" (o pedido só nasce pago): `subscribers/pedido-confirmado.ts`.
- Rota de entrada com cookie fora do `[countryCode]`: `apps/storefront/src/app/clube/route.ts`.
- Custo por peça no Supabase (migration 0009, costing) e etiqueta pela SuperFrete (envios).

## 3. Etapas → peças do sistema

| Etapa | Peça nova |
|-------|-----------|
| Encontrar | `creator` (candidatas) + leitura do Instagram pela Meta (Business Discovery) |
| Selecionar | engajamento calculado + nota da Camila; funil de status |
| Fechar parceria | termo padrão com versão; ao aprovar, vira `parceria` com cupom `NOME10` |
| Mandar a peça | `creator_envio`: pedido de R$ 0 na Medusa + etiqueta SuperFrete, custo registrado |
| Acompanhar e aprovar | `creator_entrega`: prazo, status, arquivo, link do post |
| Medir | cupom (já existe) + **link `/p/<apelido>`** que já coloca o cupom na sacola |
| Avisar a creator | **aviso de venda por WhatsApp** a cada pedido pago com o cupom dela |
| Histórico e escala | ranking por venda e por custo por venda |

## 4. Regras propostas (confirmar cada uma)

| # | Regra | Proposta |
|---|-------|----------|
| C1 | Quando sai o aviso de venda | No `order.placed` do pedido com cupom de parceria **ativa, com WhatsApp e comissão > 0**. Os NOME20 (comissão 0) não geram aviso. |
| C2 | Horário | Entre 8h e 21h (horário de Brasília). Venda fora disso fica pendente e sai às 8h, pelo job de 5 em 5 minutos. |
| C3 | Conteúdo | Sem dado da cliente (LGPD): só número do pedido, valor das peças, comissão **prevista** e o total do mês. Modelo em §6. |
| C4 | Cancelamento depois do aviso | Não manda mensagem de correção. O fechamento do mês (repasse) já tira o pedido, e o resumo mensal diz isso. |
| C5 | Proteção do número | Exceção à regra "o robô só responde a quem escreveu": a creator **aceitou receber** (campo `aceite_avisos` no termo). Uma mensagem por venda, com "digitando" de 3–5 s, teto de 20 avisos por hora na loja toda (acima disso fica pendente). |
| C6 | Link `/p/<apelido>` | Grava o cookie `eclat_parceira` (30 dias, o último link clicado vence), manda para a loja e o cupom entra sozinho na sacola, se ela não tiver outro. A comissão continua sendo **só pelo cupom no pedido**: se a cliente trocar pelo BEMVINDA10, a venda não é da creator. O pedido grava `metadata.parceria_link` para contar quem veio pelo link. |
| C7 | Direito de uso | Vale de `aprovada_em` até `desativada_em` da parceria. Ao desativar, a tela lista os conteúdos dela marcados "em anúncio" para a Camila pausar os anúncios (a pausa é manual; a Meta não é mexida pelo sistema). |
| C8 | Peça de presente | Uma peça por creator aprovada, que ela escolhe. Custo = custo de produção da peça (costing) + frete da etiqueta. Mais peças só por decisão da Camila, registrada. |
| C9 | Engajamento | (média de curtidas + comentários dos últimos 12 posts) ÷ seguidores. Só perfil comercial ou de creator (limite da Meta). Público (idade/cidade) não é lido. |
| C10 | Custo por venda da creator | (peças enviadas + fretes + comissões pagas) ÷ vendas que contam. |

## 5. Schema (Supabase, migration `0014_creators.sql`)

```sql
-- Programa de creators (architecture/parcerias.md). RLS: anon negado; backend e Cockpit usam service_role.

create table if not exists public.creator (
  id               uuid primary key default gen_random_uuid(),
  instagram        text not null unique,          -- handle sem o @, minúsculo
  nome             text,
  whatsapp         text,                          -- dígitos com DDI 55
  cidade           text,
  nicho            text,                          -- fitness, corrida, pilates, lifestyle...
  status           text not null default 'encontrada'
                   check (status in ('encontrada','abordada','negociando','aprovada','recusou','encerrada')),
  nota             int check (nota between 1 and 5),  -- avaliação da Camila
  origem           text,                          -- busca, indicação, se inscreveu
  parceria_codigo  text references public.parceria(codigo),  -- preenchido ao aprovar
  termo_versao     text,                          -- versão do termo aceito
  termo_aceito_em  timestamptz,
  aceite_avisos    boolean not null default false, -- aceitou receber o aviso de venda (C5)
  notas            text,
  criado_em        timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Leitura do Instagram (histórico, uma linha por leitura)
create table if not exists public.creator_snapshot (
  id               uuid primary key default gen_random_uuid(),
  creator_id       uuid not null references public.creator(id) on delete cascade,
  seguidores       int,
  posts            int,
  media_curtidas   numeric,
  media_comentarios numeric,
  engajamento_pct  numeric,                       -- C9
  lido_em          timestamptz not null default now()
);

-- Peça de presente
create table if not exists public.creator_envio (
  id               uuid primary key default gen_random_uuid(),
  creator_id       uuid not null references public.creator(id),
  medusa_order_id  text,                          -- pedido de R$ 0
  itens            jsonb not null,                -- [{variant_id, titulo, custo_centavos}]
  custo_pecas_centavos bigint not null default 0,
  frete_centavos   bigint not null default 0,
  status           text not null default 'separando' check (status in ('separando','enviado','entregue')),
  criado_em        timestamptz not null default now()
);

-- Campanha = uma ação com briefing e datas (ex.: lançamento de um modelo). Sem cachê (D1).
create table if not exists public.campanha (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  briefing         text not null,
  inicio           date,
  fim              date,
  status           text not null default 'rascunho' check (status in ('rascunho','ativa','encerrada')),
  criado_em        timestamptz not null default now()
);

-- Conteúdo combinado com a creator
create table if not exists public.creator_entrega (
  id               uuid primary key default gen_random_uuid(),
  creator_id       uuid not null references public.creator(id),
  campanha_id      uuid references public.campanha(id),
  formato          text not null check (formato in ('reels','stories','post','ugc')),
  prazo            date,
  status           text not null default 'combinada'
                   check (status in ('combinada','em_aprovacao','ajuste','aprovada','publicada')),
  arquivo_path     text,                          -- Storage privado: creators/<creator_id>/<arquivo>
  link_post        text,
  em_anuncio       boolean not null default false, -- C7
  comentario       text,                          -- pedido de ajuste da Camila
  atualizado_em    timestamptz not null default now()
);

-- Aviso de venda (C1–C5): uma linha por pedido; a unique garante no máximo um aviso.
create table if not exists public.parceria_aviso (
  order_id         text primary key,
  codigo           text not null references public.parceria(codigo),
  display_id       int not null,
  base_centavos    bigint not null,
  comissao_centavos bigint not null,
  status           text not null default 'pendente'
                   check (status in ('pendente','enviando','enviado','sem_whatsapp','dispensado','incerto')),
  desde            timestamptz not null default now(),
  enviado_em       timestamptz
);

alter table public.parceria add column if not exists apelido_link text unique; -- /p/<apelido>
alter table public.parceria add column if not exists desativada_em timestamptz;
-- RLS ligada em todas as tabelas novas; trigger set_updated_at em creator.
```

Continua fora do banco (decisão de 2026-09-25): chave Pix, CPF e contrato assinado.

## 6. Como fica no sistema

### Backend (Medusa)
- `subscribers/parceria-venda.ts` (`order.placed`): lê `promotions.code` e `item_total`; se for parceria ativa com
  comissão > 0, faz `insert ... on conflict do nothing` em `parceria_aviso` e chama o carteiro. Falha nunca afeta o pedido.
- `lib/parceria-aviso.ts`: reserva atômica `pendente → enviando` (padrão do aviso de despacho), checa horário (C2) e
  teto (C5), envia, grava `enviado` / `sem_whatsapp` / `incerto`. Nenhum log leva telefone.
- `jobs/parceria-avisos.ts` (*/5): manda os pendentes que entraram no horário.
- Modelo da mensagem (texto final a aprovar):
  > Oi, {nome}! Saiu mais uma venda com o seu cupom {codigo} 🎉
  > Pedido #{display_id} · peças R$ {base} · sua comissão prevista R$ {comissao}.
  > No mês: {n} vendas, R$ {comissao_mes} previstos. O repasse é no início do mês que vem.

### Vitrine
- `app/p/[apelido]/route.ts`: procura o apelido (rota de backend que só devolve o código de parceria **ativa**), grava
  o cookie e redireciona para `/br`. Apelido inexistente → `/br` sem cookie.
- Ao criar ou abrir a sacola sem cupom, com o cookie presente, aplica o código (reaproveita `cupom-unico`) e grava
  `metadata.parceria_link` no carrinho.

### Cockpit — Crescimento → Parcerias ganha abas
- **Prospecção**: kanban por status; cadastrar pelo @ (puxa a leitura do Instagram); nota; botão "Aprovar" → cria o
  cupom `NOME10`, a linha em `parceria` com o apelido do link e a mensagem pronta com o termo.
- **Creator (ficha)**: dados, leituras do Instagram, termo, envios, entregas, vendas, avisos enviados, custo por venda.
- **Envio de peça**: escolher variante → pedido de R$ 0 na Medusa → etiqueta pelo fluxo de envios existente.
- **Campanhas**: briefing, creators vinculadas, entregas com prazo; aprovar ou pedir ajuste; marcar "em anúncio".
- **Ranking**: vendas, receita em peças, comissão, custo total, custo por venda (C10), por mês e acumulado.
- Leitura do Instagram: rota do Cockpit chama a Graph API
  `GET /{ig-user-id}?fields=business_discovery.username(<handle>){followers_count,media_count,media.limit(12){like_count,comments_count,timestamp}}`
  com o token da conta da ÉCLAT (variáveis `META_IG_USER_ID` e `META_IG_TOKEN` só no ambiente; nunca no repo).

## 7. Fases (Halt entre cada uma)

| Fase | Entrega | Aceite |
|------|---------|--------|
| P0 | Terminar parcerias: F2 validada e com deploy (Cockpit + vitrine com um cupom por sacola) e F3 (fechar mês, marcar pago, DRE) | pedido com PATY10 aparece com a comissão; repasse gravado |
| P1 | Aviso de venda por WhatsApp (tabela `parceria_aviso`, subscriber, job) | pedido de teste com cupom de teste gera exatamente 1 mensagem para o número do dono; fora do horário, sai às 8h |
| P2 | Link `/p/<apelido>` | clicar no link, montar a sacola → cupom aplicado; pedido grava `parceria_link` |
| P3 | Creators e prospecção + leitura do Instagram | cadastrar um @ real mostra seguidores e engajamento; aprovar cria o cupom |
| P4 | Termo e envio de peça | envio vira pedido de R$ 0 com etiqueta; custo aparece na ficha |
| P5 | Campanhas, entregas, aprovação e arquivos | entrega sobe arquivo, é aprovada e marcada "em anúncio"; desativar a parceria lista o conteúdo para pausar |
| P6 | Ranking | números batem com a conta manual de 2 creators |
| P7 | SOP `architecture/parcerias.md` e contexto compartilhado | — |

## 8. Respostas do dono (2026-09-29)
1. **C5 — DECIDIDO: sim.** Exceção à regra do número autorizada só para creators com `aceite_avisos = true`.
2. **C2/C3 — DECIDIDO: sim, com valor.** Horário 8h–21h; a mensagem mostra a comissão prevista da venda e o total do mês.
3. **C6 — DECIDIDO: sim.** Cookie de 30 dias; o último link clicado vence.
4. **C8 — DECIDIDO: qualquer peça.** Sem teto de preço; uma peça por creator aprovada.
5. **Nota fiscal da peça de presente — DECIDIDO: não tratar agora.** A P4 registra o envio e o custo sem emitir nota.
   Pendência a rever com o contador antes de escalar o volume de envios.
6. **Acesso da Camila ao Cockpit — sim**, ela já tem login de operadora.
7. **Token da Meta** — instruções enviadas ao dono em 2026-09-29; a P3 espera `META_IG_USER_ID` e `META_IG_TOKEN`
   no ambiente do Cockpit (Vercel e `.env.local`).
