# Recuperação automática de vendas

> Decisão do dono em 2026-09-29. CLAUDE.md é lei. Números, contas e estado de ativação ficam em
> `contexto-claude/` (o repositório é público).

Quem deixou contato e não comprou recebe um contato automático: e-mail pelo Resend e WhatsApp pela Evolution,
em tom de pessoa. No WhatsApp, a primeira mensagem é só uma abordagem ("Oi, Cristina! Tudo bem? Aqui é a
Camila, da ÉCLAT 😊"), sem link, sem cupom e sem preço. O motivo do contato, o cupom e o link vão numa segunda
mensagem, **só depois que a pessoa responde**. Quem recebe link de um número desconhecido denuncia o número;
quem recebe um "oi" responde.

## Ocasiões (gatilhos)
| Gatilho | Origem | Quando fica elegível |
|---|---|---|
| `pix` | carrinho com sessão do Mercado Pago `metodo: "pix"`, não concluído | 30 min depois do Pix vencer |
| `carrinho` | carrinho não concluído, com itens e com WhatsApp ou e-mail | 1 h parado (até 3 dias) |
| `anuncio` | lead `origem: anuncio`, status `novo` (até 14 dias) | 24 h depois da última mensagem da conversa |
| `lead_site` | lead `origem: site` (aviso de 10%), status `novo` (até 7 dias) | 2 h depois do aceite |

- **Uma ocasião por pessoa a cada 30 dias** (pelo WhatsApp ou pelo e-mail). Se a mesma pessoa aparece em duas,
  vale a mais quente (Pix > carrinho > anúncio > lead do site) e a outra fica no histórico (`mesma_pessoa`).
- Carrinhos de teste e os anteriores ao marco zero ficam de fora (mesmo filtro da tela de carrinhos abandonados,
  `api/admin/carrinhos-abandonados/filtro.ts`).

## Fluxo de uma ocasião
`aguardando` → (abordagem no WhatsApp) `abordada` → (pessoa responde) `respondeu` → (1 a 3 min depois)
`oferta_enviada`. Qualquer etapa pode ir para `encerrada` com um motivo:
`comprou`, `pediu_para_parar` ("sair", "pare", "não quero"… — recebe uma resposta educada e nada mais),
`humano_assumiu` (alguém escreveu pelo celular da marca), `ja_em_conversa` (houve mensagem nas últimas 24 h),
`sem_resposta` (3 dias depois do oi), `expirou` (4 dias na fila), `sem_whatsapp`, `so_email`,
`parado_pela_equipe` (botão "Parar" no Cockpit).

**E-mail:** nunca junto com o WhatsApp. Sai sozinho quando não há número (ou o WhatsApp está desligado), ou 4 h
depois de um oi sem resposta. Uma vez por ocasião. Anúncio não recebe e-mail. Template `recuperacao`
(`modules/resend/templates/recuperacao.ts`), com três textos (carrinho, Pix, lead do site). A resposta
"sair" chega na caixa do `RESEND_REPLY_TO` e é tratada por pessoa.

Antes de cada envio o sistema confere se a pessoa comprou (carrinho concluído, ou pedido dos últimos 35 dias
com o mesmo e-mail ou telefone).

## Freios do número (decisão do dono)
- Máximo de **15 abordagens por dia**; intervalo **sorteado entre 15 e 60 min** entre uma e outra; só das
  **9h às 19h** (Brasília). Ofertas (resposta a quem respondeu) não contam no limite, mas respeitam o horário.
- Uma abordagem por rodada do job; "digitando…" de 3 a 10 s antes de cada mensagem (`delay` da Evolution).
- Textos com variações sorteadas, para não repetir a mesma frase.
- Só envia com a sessão do WhatsApp `open`. Três falhas seguidas → o WhatsApp automático **desliga sozinho**
  (o Cockpit mostra o aviso). Número sem WhatsApp encerra só aquela ocasião.
- Casamento de números: o JID do WhatsApp de muitos celulares BR vem sem o nono dígito. A coluna
  `contato_chave` guarda 55 + DDD + 8 últimos dígitos, e é por ela que a resposta encontra a ocasião.

## Onde está
- Banco (Supabase): `supabase/migrations/0014_recuperacao.sql` — `recuperacao_config` (linha única com os dois
  interruptores, **desligados** de início) e `recuperacao` (uma linha por ocasião). RLS sem policies.
- Backend: `src/lib/recuperacao-regras.ts` (regras puras, com teste), `src/lib/recuperacao-db.ts`,
  `src/lib/recuperacao.ts` (detector, envios e respostas), job `src/jobs/recuperacao.ts` (a cada 5 min),
  webhook `src/api/webhooks/whatsapp/route.ts` chama `tratarMensagemRecebida`.
- Cockpit: tela `/recuperacao` (menu Vender) com os interruptores, as regras, os números e a lista;
  `app/api/recuperacao/*`, regras em `lib/recuperacao.ts` (com teste).
- Junto veio uma correção no webhook: mensagem enviada pela marca não usa mais o nome da própria marca como
  nome do lead ("Éclat - Moda Fitness").

## Ordem segura de ativação
1. Aplicar a migration 0014 no Supabase.
2. `railway up` do backend (dono). Com os interruptores desligados, o job não faz nada.
3. Publicar o Cockpit (push na `main`, Vercel).
4. No Cockpit → Recuperação automática: conferir persona e cupom, ligar **E-mail** primeiro e acompanhar.
5. Conferir que a sessão do WhatsApp está `open` e ligar **WhatsApp**. A primeira abordagem sai na próxima
   rodada dentro do horário. Acompanhar a lista e as Conversas nos primeiros dias.
Desligar: os mesmos interruptores. Nada precisa de deploy para parar.

## Testes
`apps/backend/src/lib/__tests__/recuperacao-regras.unit.spec.ts`,
`apps/backend/src/modules/resend/__tests__/recuperacao.unit.spec.ts`, `apps/cockpit/lib/recuperacao.test.ts`.
Não testado em execução: o job contra o banco e a Evolution reais (depende da migration e do deploy).
