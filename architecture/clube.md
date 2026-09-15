# architecture/clube.md — Clube Éclat: automação do grupo do WhatsApp

> Spec aprovada pelo dono em 15/09/2026 (ver "Decisões"). Fonte da verdade da automação do grupo.
> Regra da casa: dado real ou nada; nada sai do sistema sem estar `aprovada` (por pessoa ou por regra autorizada).

## O que é
Painel "Clube" no Cockpit que controla TUDO que vai para o grupo **CLUB ÉCLAT** (`120363159357034423@g.us`,
96 membros, só admins publicam) pelo WhatsApp da marca (Evolution, instância `eclat`):

1. **Agenda** — mensagens com data/hora (roteiro da pré-venda), com marcadores preenchidos na hora do envio.
2. **Gatilhos** — eventos do comércio (estoque, catálogo, pedidos) que geram mensagem sozinhos, cada um com
   modo `automatico` (sai sem ninguém aprovar) ou `aprovar` (vira rascunho e espera um clique).
3. **Manual** — escrever e mandar na hora pelo Cockpit, com prévia.

Tudo passa pela mesma **fila** (`clube_mensagens`) e pelo mesmo **carteiro** (job no backend), que respeita
janela de horário, teto diário, atraso aleatório e avisa o dono no privado quando falha.

## Invariantes
- Medusa continua a fonte da verdade de estoque/pedido/produto; o Clube só LÊ (snapshot) e nunca escreve comércio.
- Supabase guarda regras, fila, snapshot e histórico (RLS: anon negado; backend/Cockpit via service_role).
- Nenhum número inventado: marcador sem dado apaga a frase inteira que o contém.
- Um único destino (o grupo). Envio para números avulsos NÃO passa por aqui (proteção do número).
- Master switch (`clube_config.ativo=false`) para tudo em um clique.

## Dados (Supabase, migration `0010_clube.sql`)

```sql
-- configuração global (1 linha)
clube_config(
  id int primary key default 1 check (id=1),
  ativo boolean not null default false,          -- master switch
  grupo_jid text not null,                        -- 120363159357034423@g.us
  aviso_jid text,                                 -- privado do dono p/ alertas de falha (só dígitos)
  janela_inicio time not null default '09:00',    -- fora da janela: fica na fila até abrir
  janela_fim    time not null default '21:00',
  max_por_dia int not null default 3,             -- teto de mensagens automáticas por dia (agenda não conta)
  atraso_max_min int not null default 9,          -- jitter 0..N min para não postar "em ponto"
  updated_at timestamptz default now()
)

-- regras dos gatilhos (1 linha por tipo)
clube_regras(
  tipo text primary key,                          -- ultima_unidade | reposicao | novidade | esgotado | marco_reservas
  ativa boolean not null default false,
  modo text not null default 'aprovar' check (modo in ('automatico','aprovar')),
  template text not null,                         -- com marcadores
  limiar int,                                     -- ultima_unidade: qty <= limiar (padrão 1); marco_reservas: a cada N
  cooldown_horas int not null default 24,         -- não repetir a mesma variante/produto nesse período
  agrupar boolean not null default true,          -- vários eventos na mesma rodada → 1 mensagem
  anexar_foto boolean not null default true,      -- foto da peça (cor) da loja
  updated_at timestamptz default now()
)

-- fila única de saída
clube_mensagens(
  id uuid pk, origem text check (origem in ('agenda','gatilho','manual')),
  tipo text,                                      -- p/ gatilho: o tipo da regra
  status text check (status in ('rascunho','aprovada','enviada','falhou','descartada')) default 'rascunho',
  enviar_em timestamptz,                          -- agenda: fixo; gatilho: now() (ou abertura da janela)
  texto text not null,                            -- template/mensagem com marcadores
  texto_final text,                               -- o que saiu de fato (marcadores resolvidos)
  midia text,                                     -- 'produto:<handle>:<cor>' | URL | null
  midia_url_final text,
  dados jsonb,                                    -- payload do evento (variantes, quantidades, chaves de cooldown)
  chave_dedup text,                               -- ex.: 'ultima_unidade:variant_01…' → respeita cooldown
  evolution_msg_id text, erro text,
  criado_em timestamptz default now(), aprovado_em timestamptz, enviado_em timestamptz
)

-- snapshot de estoque por variante (o detector de eventos compara com a rodada anterior)
clube_estoque_snapshot(
  variant_id text primary key, product_handle text, product_title text, cor text, tamanho text,
  qty int not null, publicado boolean, visto_em timestamptz default now()
)

clube_eventos_log(id, tipo, chave, dados jsonb, resultado text, criado_em)  -- auditoria do detector
```

## Marcadores (resolvidos na hora do envio, com dado da Medusa/Cockpit)
`{{ultimas_unidades}}` · `{{esgotados}}` · `{{reposicao}}` · `{{novidades}}` · `{{reservas_total}}` ·
`{{reservas_hoje}}` · `{{dias_para_envio}}` (de `site_content.prevenda`) · `{{foto:<handle>:<cor>}}` (vira mídia).
Frase (até o ponto final ou quebra de linha) que contém marcador vazio é removida.

## Gatilhos (detector roda a cada 5 min no backend)
| tipo | evento detectado no snapshot | padrão inicial |
|---|---|---|
| `ultima_unidade` | qty passou de > limiar para ≤ limiar (limiar 1) | ativa, **automatico**, agrupar, foto |
| `reposicao` | qty passou de 0 para > 0 | ativa, **automatico**, foto |
| `novidade` | produto publicado novo, ou cor nova em produto existente | ativa, **automatico**, foto |
| `esgotado` | qty passou para 0 (todos os tamanhos da cor) | ativa, **aprovar** |
| `marco_reservas` | total de pedidos cruzou múltiplo de N (padrão 10) | desativada |

Regras do carteiro: janela 09–21h; teto `max_por_dia` só para gatilhos; cooldown por `chave_dedup`;
jitter 0–9 min; 1 mensagem por rodada; falha (ex.: "Connection Closed") → status `falhou` + WhatsApp no
`aviso_jid` ("Clube: mensagem X não saiu — sessão caída?"); 3 falhas seguidas → pausa automática (`ativo=false`) + aviso.

## Cockpit → "Clube" (item novo no menu)
- **Painel**: master switch, estado da conexão (Evolution `connectionState`), contadores (aguardando aprovação,
  agendadas, enviadas hoje/semana), última falha.
- **Automações**: um card por regra — ligar/desligar, modo automático/aprovar, editar template, limiar, cooldown,
  foto sim/não, botão "Prévia com dados de hoje".
- **Agenda**: lista do roteiro (data, hora, texto, mídia, status) — editar, aprovar, "aprovar semana", enviar agora,
  prévia renderizada.
- **Aprovações**: rascunhos gerados por gatilhos em modo `aprovar` → aprovar / editar / descartar.
- **Histórico**: tudo que saiu, com texto final e horário; filtro por origem.

## Fases (Halt entre elas)
- **F1 Backend**: migration 0010; lib `clube-fila.ts` (marcadores, resolução de foto, carteiro), `clube-detector.ts`
  (snapshot + eventos → fila); job a cada 5 min; seed: config, 5 regras, 14 mensagens do roteiro como `rascunho`.
- **F2 Cockpit**: tela Clube (5 abas acima) sobre rotas `/api/clube/*` (service_role).
- **F3 Ativação**: dono aprova a agenda da semana, liga master switch e 3 regras automáticas; teste com mensagem
  manual; primeiro envio real acompanhado.

## Decisões
- 15/09/2026: dono pediu painel completo com automação por regra ("tudo controlado, mas uma vez autorizado,
  automatizado"). Esgotado fica opcional (aprovar). Agenda começa 16/09 19h30.

## Estado (15/09/2026)
- **F1 CONCLUÍDA e validada em produção** (commit 5e06bcf; migration 0010 aplicada; seed rodado; deploy Railway 15/09 12:34):
  `GET /admin/clube` lê 30 variações com qty real e foto por cor; prévia resolve marcadores e apaga frases vazias;
  fila com 15 mensagens da agenda em `rascunho`; `clube_config.ativo=false`; `aviso_jid` = número do dono (lead do teste).
- **F2 CONCLUÍDA em código** (commit c1f64ec): Cockpit → "Clube Éclat" (Painel · Automações · Agenda · Aprovações · Histórico),
  rotas `/api/clube/*`. Pendente: push/deploy do Cockpit pelo dono.
- **F3 (ativação) PENDENTE do dono**: aprovar a agenda, ligar o interruptor, primeiro envio acompanhado.
- Primeira rodada do job só grava o snapshot (sem eventos); gatilhos passam a valer a partir da 2ª rodada (5 min depois).
- Validar depois do 1º envio real: `texto_final`, `midia_url_final`, `evolution_msg_id` na linha; e se a foto chegou no grupo.
