# Vendas fora do site — desenho (2026-10-15)

Pedido da sócia em 15/10/2026: um lugar no Cockpit para lançar vendas fechadas fora do site (WhatsApp, presencial,
Instagram) com os dados da cliente, as peças, a forma de pagamento, a data combinada quando for a prazo (com
mensagem automática no dia) e um check para mandar o convite ao unboxing.

## Onde mora
- A venda em si: Supabase, tabela `venda_externa` (migration `0016_venda_externa.sql`). Não passa pelo checkout nem
  vira pedido do Medusa: criar um pedido de verdade exigiria frete, pagamento e e-mail que essas vendas não têm.
  É "financeiro próprio" (invariante 2), como as despesas.
- O que continua no Medusa (fonte da verdade do comércio): o **estoque** (baixado pela Admin API ao salvar) e a
  **cliente** (achada pelo WhatsApp/e-mail ou criada), para ela entrar na ficha 360°, no programa de aniversário e
  nas próximas automações.
- Dinheiro em centavos. Itens em JSON (`variant_id`, nome, variação, SKU, quantidade, preço) — o preço é o do
  catálogo no momento, editável no lançamento.

## Fluxo
1. Cockpit → Vender → **Vendas fora do site** → "+ Lançar venda": data, canal, nome, WhatsApp, e-mail (opcional),
   peças (busca no catálogo), desconto, pagamento (Pix / dinheiro / cartão / a prazo), data combinada (a prazo),
   observações; checks "Baixar o estoque no Medusa" (ligado) e "Enviar o convite ao unboxing agora" (ligado).
2. Salvar: valida → grava → vincula/cria a cliente → baixa o estoque → manda o unboxing (se marcado). Cada passo
   depois da gravação é best-effort e volta como aviso na tela.
3. Pix/dinheiro/cartão nascem **pagas**. A prazo nasce em aberto; às 9h do dia combinado (ou no primeiro dia
   depois, se atrasou sem lembrete) o backend manda o lembrete uma vez (`jobs/venda-externa-lembretes.ts`); depois
   é o botão "Lembrar agora". "✓ Recebi" marca como paga.
4. DRE: vendas pagas entram na receita de produtos e no COGS pela data da venda, com a linha "sendo vendas fora do
   site". Taxas de cartão fora do site não entram (não há gateway).
5. Cancelar: marca `cancelada_em`; o estoque não volta sozinho (a equipe ajusta em Produtos se a peça voltou).

## Fora deste desenho
- Etiqueta/envio pelo Cockpit para essas vendas (entrega combinada à mão); se precisar, lançar como pedido no site.
- Comissão de parceria em venda fora do site.
