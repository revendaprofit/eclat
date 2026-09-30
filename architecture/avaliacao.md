# Pedido de avaliação pelo WhatsApp

> Decisão do dono em 2026-09-30. CLAUDE.md é lei. Estado de ativação e números ficam em `contexto-claude/`.
> Desenho: `docs/superpowers/specs/2026-09-30-avaliacoes-whatsapp-design.md`.

Quem comprou recebe, **3 dias depois da entrega**, uma mensagem da persona (Camila) perguntando o que achou — sem
link, sem cupom, sem nada em troca. Se responder, 1 a 3 min depois vem a 2ª: "Posso colocar seu comentário no site,
só com seu primeiro nome?". O "sim" dela fica registrado literalmente (`autorizou_texto`, `autorizou_em`). Publicar é
**um clique no Cockpit** (Vender → Avaliações), que acrescenta a fala EXATA em `site_content.home.testimonials`.

## Quando sai
- Data de entrega: evento `order.delivered` do webhook da SuperFrete (gravado em `metadata.frete.eventos`) ou
  "entregue" marcado no fulfillment. Sem nenhum dos dois: **despacho + 10 dias** (`dias_apos_despacho`).
- Só pedidos criados depois de `avaliacao_config.marco_zero` (pedidos antigos não recebem; use o botão manual).
- Fora: cancelado, e-mail `@eclat.local` (teste), sem telefone, pessoa que já recebeu pedido de avaliação nos
  últimos 60 dias (`pedida_recentemente`).
- **Botão "Pedir avaliação"** na conversa do Cockpit: para quem comprou fora do site. Cria a linha já na fila.

## Fluxo
`agendada` → `pedida` → (ela responde; várias mensagens se juntam na mesma fala) `respondeu` →
`autorizacao_pedida` → "sim" `autorizada` → (clique) `publicada`.
Encerra com motivo: `sem_resposta` (5 dias), `nao_autorizou` ("não", ou 5 dias sem resposta à autorização),
`pediu_para_parar`, `humano_assumiu` (alguém escreveu pelo celular da marca), `ja_em_conversa` (mensagem nas
últimas 24 h), `sem_whatsapp`, `expirou` (7 dias na fila), `parado_pela_equipe`.
Resposta ambígua à autorização fica em `autorizacao_pedida` com a fala dela; a equipe decide ("É um sim" / "Não
autorizou"). Só foto/áudio sem texto: aparece no Cockpit, mas **não publica** sem uma frase escrita.

## Freios do número (os da recuperação)
Janela, intervalo sorteado e `proximo_envio_em` são os de `recuperacao_config` (um relógio só para as duas
automações). O teto diário (`max_abordagens_dia`, 15) é **somado**: abordagens da recuperação + pedidos de
avaliação. 1 pedido por rodada do job (5 min). Só com a sessão `open`. 3 falhas seguidas desligam o pedido de
avaliação (`avaliacao_config.ativo = false`). A 2ª mensagem (autorização) e os agradecimentos não contam no teto.
Uma mensagem recebida pertence a uma automação só: se há avaliação em andamento para o número, a recuperação
não a trata (webhook do WhatsApp).

## Onde está
- Banco: `supabase/migrations/0015_avaliacao.sql` — `avaliacao_config` (interruptor **desligado**, dias, marco
  zero, textos) e `avaliacao` (uma linha por pedido). RLS sem policies.
- Backend: `src/lib/avaliacao-regras.ts` (puro, testado), `src/lib/avaliacao-db.ts`, `src/lib/avaliacao.ts`,
  job `src/jobs/avaliacao.ts`, webhook `src/api/webhooks/whatsapp/route.ts` (`tratarRespostaDeAvaliacao` antes
  da recuperação), teto somado em `src/lib/recuperacao.ts`.
- Cockpit: tela `/avaliacoes` (menu Vender), `app/api/avaliacoes/*`, `lib/avaliacao.ts` (testado), botão na
  tela de Conversas.

## Ordem de ativação
1. Aplicar `0015_avaliacao.sql` no SQL Editor do Supabase (dono).
2. `railway up` do backend (interruptor desligado = o job não faz nada).
3. Push na `main` (Cockpit e vitrine na Vercel).
4. Ativar o webhook da SuperFrete (dono, terminal próprio — o segredo sai UMA vez): ver `architecture/envios.md`
   ("Webhook na conta da SuperFrete") e copiar o segredo para `SUPERFRETE_WEBHOOK_SECRET` no Railway. Sem isso,
   vale o substituto de 10 dias depois do despacho.
5. Cockpit → Avaliações: conferir os textos e ligar.

## Testes
`apps/backend/src/lib/__tests__/avaliacao-regras.unit.spec.ts`, `apps/cockpit/lib/avaliacao.test.ts`.
Não testado em execução: job contra Supabase/Evolution reais (depende da migration e do deploy).
