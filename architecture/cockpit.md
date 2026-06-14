# architecture/cockpit.md — Cockpit use.ÉCLAT: Plano Completo & Faseado

> Conteúdo canônico do Cockpit. Visão completa (para construir cada peça já no lugar certo)
> com execução **uma fase por vez** e **Halt** entre fases. CLAUDE.md é lei; este doc é o mapa do Cockpit.

## Estado / reconciliação (2026-06-14)
- A página read-only do Cockpit dentro do Admin do Medusa (entregue como "Parte 7" v0) fica **SUPERADA**
  por este plano (cockpit é app separado). Manter por ora; remover/migrar na Fase 0.
- O modelo de dados abaixo **evolui** o que foi criado na Parte 5 (lead/cliente_rel/conversa) e na Parte 6
  (webhook WhatsApp gravando em lead/conversa). Haverá migração: `conversa`→`conversation`+`message`,
  `cliente_rel`→`crm_customer`, `lead` ganha `estagio`+`lead_stage`. O webhook (Parte 6) será reescrito
  na Fase 1 para gravar em `conversation`/`message`.

## 1. Visão & arquitetura
O Cockpit é o painel de gestão total da Éclat — um **app separado** (Next.js, fora do admin do Medusa),
que o operador usa sozinho. Ele **opera o sistema via APIs donas**:
- **Medusa Admin API** — comércio (produtos, estoque, pedidos, envios, receita).
- **Supabase** — relacionamento, leads, financeiro próprio, chat (dono desses dados).
- **Evolution API** — WhatsApp.

**Invariante (no CLAUDE.md):** o Cockpit lê e escreve **somente** pelas APIs donas; não duplica dado de
comércio; Medusa segue a fonte da verdade do comércio. Dinheiro em centavos. RLS no Supabase.

## 2. Método de build
1. **Registrar este plano** como architecture/cockpit.md, referenciá-lo no CLAUDE.md e colocar as fases no task_plan.md.
2. **Construir uma fase por vez** ("leia architecture/cockpit.md; construa SOMENTE a Fase X; pare e aguarde aprovação").
3. **Halt entre fases.** Testa pelo critério de aceite, aprova, e só então a próxima.

## 3. Menu completo (aba lateral)
```
Dashboard            (visão geral + filas de ação)
Conversas            (Chat WhatsApp / Evolution)
Clientes             (lista · ficha 360° · pedidos · envios · follow-up · segmentos)
Leads                (Kanban · lista · ficha · captação)
Produtos & Estoque   (produtos · criar/editar · coleções/categorias/tags · estoque · alertas)
Financeiro           (DRE · receita · despesas · COGS/margem · categorias)
Configurações        (conexões · WhatsApp · automações · categorias de despesa · usuários)
```

## 4. Modelo de dados (Supabase = dono). Comércio NÃO entra aqui. RLS; dinheiro em centavos.
```
-- CHAT
conversation(id, contato_e164, nome_contato, alvo_tipo[lead|cliente|nenhum],
  lead_id?, medusa_customer_id?, instancia_evolution, status, nao_lidas,
  ia_autoreply(bool, default false), ultima_msg_em, criado_em)
message(id, conversation_id, direcao[in|out], tipo[texto|audio|imagem|video|doc],
  texto?, media_url?, media_mime?, status, origem[humano|ia], timestamp,
  evolution_msg_id UNIQUE, criado_em)

-- LEADS
lead(id, nome, whatsapp, email?, origem, estagio, valor_estimado_centavos?,
  responsavel?, notas?, medusa_customer_id?, criado_em, ultima_interacao)
lead_stage(id, nome, ordem)            -- estágios do Kanban

-- CRM (extensão do cliente; NÃO duplica o cliente do Medusa)
crm_customer(medusa_customer_id, status_ciclo, tags[], notas?,
  consumivel_proxima_recompra?, ultimo_followup?)
followup_task(id, alvo[lead_id|medusa_customer_id], tipo, canal, due_date, status)

-- FINANCEIRO (próprio)
finance_expense(id, data, categoria_id, descricao, valor_centavos, fornecedor?,
  recorrencia?, anexo_url?)
finance_expense_category(id, nome)
product_cost(medusa_variant_id, custo_centavos, vigencia_inicio)   -- COGS
```

## 5. Fases de build (ordem). Cada fase termina testável e aprovável.

### Fase 0 — Shell do cockpit
App Next.js separado: autenticação, **aba lateral com TODAS as áreas** (placeholders), layout/identidade Éclat,
e **conexões testáveis** com Medusa (Admin API), Supabase e Evolution.
*Aceite:* logar no cockpit; ver o menu completo; as 3 conexões respondem.

### Fase 1 — Conversas (Chat WhatsApp)
**Fase A** (chat funcional: texto, áudio/voz, mídia, tempo real, vínculo lead/cliente, idempotência) →
**Fase B** (IA).
- **IA do chat (decisão travada):** modo **SUGESTÃO** — a IA redige a resposta com a voz da Éclat e o operador
  aprova/edita/envia. Auto-resposta direta só em casos definidos (palavra-chave/estágio), em etapa posterior,
  sempre com handoff humano. Mensagens de IA marcadas com `origem = ia`.
*Aceite (Fase A):* receber/enviar em tempo real (incl. áudio); webhook não duplica; conversa vinculada.

### Fase 2 — Leads (Kanban)
Funil arrastável por estágio, ficha do lead, captação, e **conversão → cria cliente no Medusa**. Usa o chat da Fase 1.
*Aceite:* mover lead entre estágios; abrir conversa; converter em cliente.

### Fase 3 — Produtos & Estoque
CRUD de produtos/variações/preço(centavos)/metadata, coleções/categorias/tags e estoque — tudo via **Medusa Admin API**.
Alertas de baixo estoque e "avise-me".
*Aceite:* criar/editar produto e ajustar estoque pelo cockpit, refletindo no Medusa.

### Fase 4 — Clientes / Pedidos / Envios
Ficha 360°, pedidos, fila de envio (etiqueta, rastreio, aviso por WhatsApp), follow-up, segmentos.
*(Depende do checkout — Partes 3+ da loja.)*
*Aceite:* abrir ficha do cliente com pedidos e conversa; despachar um pedido.

### Fase 5 — Financeiro (P&L)
Receita do Medusa + despesas e COGS lançados no Supabase → DRE (receita − custos − despesas = lucro).
*Aceite:* lançar despesa, definir COGS, e ver o DRE do período fechar certo.

### Fase 6 — Dashboard inteligente
Consolida tudo: vendas do dia, pedidos a enviar, leads novos, conversas pendentes, estoque baixo, recompras previstas.
*Aceite:* o painel abre mostrando as filas de ação corretas.

## 6. Decisões travadas
- **Arquitetura:** cockpit é app separado; opera via APIs donas; Medusa = fonte da verdade do comércio.
- **IA do chat (Fase 1B):** modo sugestão (IA redige, operador aprova). Auto-resposta só em casos definidos, depois.
- **Evolution API:** caminho não-oficial, já configurado. (Mitigação futura: migrar para a API oficial.)
- **Financeiro:** P&L híbrido — receita do Medusa + despesas/COGS no Supabase.
