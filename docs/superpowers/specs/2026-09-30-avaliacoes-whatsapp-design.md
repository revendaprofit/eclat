# Pedido de avaliação pelo WhatsApp — desenho (2026-09-30)

> Pedido do dono em 2026-09-30: "o pedido de avaliação depois das próximas entregas, deixar automatizado usando
> o nosso sistema de WhatsApp do Cockpit". CLAUDE.md é lei (Data-First: o esquema abaixo precisa de aprovação
> antes do código). Mesmo molde da recuperação automática (`architecture/recuperacao.md`).

## Decisões do dono (2026-09-30)
- **Quando:** 3 dias depois de o pedido ser **entregue**. Sem o dado de entrega (webhook da SuperFrete ainda não
  ativado na conta), usa **10 dias depois do despacho** como substituto.
- **Autorização para publicar:** 2ª mensagem **automática** quando ela responde ("Posso colocar seu comentário no
  site, só com seu primeiro nome?"). O "sim" fica registrado; publicar continua sendo **um clique no Cockpit**.
- **Nada em troca** (sem cupom): depoimento espontâneo, sem aviso de "avaliação incentivada".
- Persona e freios do número: os mesmos da recuperação (Camila; 15 primeiras mensagens por dia no total das duas
  automações; 9h–19h; intervalo sorteado 15–60 min; só com a sessão `open`).

## Fluxo de um pedido
`agendada` → (sai o pedido) `pedida` → (ela responde) `respondeu` → (1 a 3 min) `autorizacao_pedida`
→ (ela diz sim) `autorizada` → (operadora clica "Publicar") `publicada`.
Fim com motivo (`encerrada`): `sem_resposta` (5 dias depois do pedido), `nao_autorizou` (disse não, ou nada em
5 dias), `pediu_para_parar` (mesmas palavras da recuperação), `humano_assumiu`, `ja_em_conversa` (mensagem nas
últimas 24 h), `sem_whatsapp`, `sem_telefone`, `pedido_cancelado`, `parado_pela_equipe`, `expirou` (7 dias na fila).

Mensagens (variações sorteadas, sem link, `*` vira negrito; texto editável no Cockpit):
1. **Pedido:** "Oi, {nome}! Aqui é a Camila, da ÉCLAT 💛 Já deu pra treinar com {a peça / o conjunto}? Me conta
   em uma frase o que achou — e se quiser mandar uma foto usando, eu amo ver."
2. **Autorização** (só se ela respondeu): "Que bom ler isso! Posso colocar seu comentário no nosso site, só com
   seu primeiro nome?" → "sim/pode/claro/…" = `autorizada`; "não/prefiro não" = `nao_autorizou` (resposta
   educada: "Tranquilo! Obrigada por contar 💛"). Resposta ambígua fica em `autorizacao_pedida` para a
   operadora decidir no Cockpit.

**Quem entra:** pedido do site com telefone, não cancelado, com entrega registrada (ou despacho há 10 dias), a
partir do marco zero da ativação (pedidos antigos NÃO recebem — o #21 só se a operadora usar o botão manual).
Um pedido de avaliação por pessoa a cada 60 dias. Pedido de teste (e-mail `@eclat.local`) fica de fora.
**Botão manual** "Pedir avaliação" na conversa do Cockpit, para quem comprou fora do site (ex.: pelo WhatsApp);
cria a linha já em `agendada` e respeita os mesmos freios.

## Dado de entrega (mudança pequena no webhook da SuperFrete)
Hoje só existe `metadata.frete.avisos.entregue`, gravado **depois** do WhatsApp de "entregue" sair. Passa a
gravar também `metadata.frete.entregue_em` (hora do evento `order.delivered`) **antes** do aviso, para a data de
entrega não depender de a mensagem ter saído. Sem webhook ativo, vale `fulfillment.shipped_at + 10 dias`.

## Esquema (Supabase, migration `0015_avaliacao.sql`) — PRECISA DE APROVAÇÃO
```sql
create table public.avaliacao_config (
  id               int primary key default 1 check (id = 1),
  ativo            boolean not null default false,   -- interruptor, nasce DESLIGADO
  dias_apos_entrega int not null default 3,
  dias_apos_despacho int not null default 10,        -- substituto sem webhook de entrega
  marco_zero       timestamptz not null default now(), -- pedidos anteriores não entram
  texto_pedido     text,                             -- null = variações padrão do código
  texto_autorizacao text,
  updated_at       timestamptz not null default now()
);

create table public.avaliacao (
  id               uuid primary key default gen_random_uuid(),
  order_id         text unique,                      -- null quando criada pelo botão manual
  display_id       int,
  origem           text not null check (origem in ('pedido','manual')),
  contato          text,                             -- WhatsApp com DDI
  contato_chave    text,                             -- 55+DDD+8 últimos (mesma regra da recuperação)
  nome             text,                             -- primeiro nome
  pecas            text,                             -- "o conjunto Aurora" / "o Macaquinho Solaris"
  conversation_id  uuid,
  etapa            text not null default 'agendada'
                     check (etapa in ('agendada','pedida','respondeu','autorizacao_pedida','autorizada','publicada','encerrada')),
  motivo_fim       text,
  elegivel_em      timestamptz not null,             -- entrega + 3 dias (ou despacho + 10)
  pedido_texto     text,  pedido_em      timestamptz,
  resposta_texto   text,  resposta_em    timestamptz,  -- fala EXATA dela (o que vai para o site)
  tem_foto         boolean not null default false,     -- mandou imagem na resposta
  autorizacao_em   timestamptz,                        -- hora da 2ª mensagem
  autorizou_texto  text,  autorizou_em   timestamptz,  -- o "sim" dela, literal (prova do consentimento)
  publicado_em     timestamptz,  publicado_por text,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);
-- índices: (etapa, elegivel_em); (contato_chave, criado_em desc). RLS ligada, sem policies (service_role).
```
O limite de 15 por dia é **compartilhado** com a recuperação (conta as abordagens das duas tabelas no dia), para o
número nunca passar do teto decidido.

## Onde vai no código
- Backend: `src/lib/avaliacao-regras.ts` (puro: elegibilidade, datas, textos, "sim/não", com testes),
  `src/lib/avaliacao.ts` (detector + envios), job `src/jobs/avaliacao.ts` (a cada 5 min), e o webhook do
  WhatsApp chama `tratarRespostaDeAvaliacao` antes/depois da recuperação (uma resposta pertence a uma só
  automação: a ocasião mais recente daquele `contato_chave`).
- Webhook SuperFrete: grava `metadata.frete.entregue_em`.
- Cockpit: tela **Avaliações** (menu Vender): interruptor, textos, lista por etapa; na linha `autorizada`, a fala
  dela e o botão **Publicar no site** (acrescenta em `site_content.home.testimonials` com primeiro nome e
  `origem: "WhatsApp"`, sem editar a fala); botão **Pedir avaliação** na conversa.

## Ordem de ativação (tudo com "pode aplicar")
1. Migration 0015 no Supabase (dono). 2. `railway up` (interruptor desligado = job não faz nada). 3. Push (Cockpit).
4. Ativar o webhook da SuperFrete (`ativar-webhook-superfrete.mjs --aplicar`, dono) — sem ele vale o substituto de
10 dias. 5. Cockpit → Avaliações: conferir textos e ligar.

## Riscos
- Mais mensagens ativas pelo número não oficial (Evolution). Mitigação: teto compartilhado de 15/dia, só para quem
  comprou (contato esperado, baixa chance de denúncia), sem link.
- Pouco volume hoje (2 pedidos no site): o botão manual é o que traz depoimentos agora.
