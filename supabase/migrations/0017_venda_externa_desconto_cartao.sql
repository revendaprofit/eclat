-- Vendas fora do site, parte 2 (sócia, 2026-10-16): desconto em % ou R$, perfil da compradora (cliente /
-- embaixadora 20% / creator com custo zero ou % livre) e, no cartão, parcelas + taxa da maquininha para gravar o
-- LÍQUIDO real no financeiro. Cortesia = peça dada (total zero), nasce paga. Taxas por parcela ficam em
-- site_content "cockpit.taxas_cartao" (editável na tela). Reexecutável.

alter table public.venda_externa
  add column if not exists tipo_desconto      text not null default 'valor' check (tipo_desconto in ('valor','percentual')),
  add column if not exists desconto_percentual numeric(5,2),                 -- quando tipo_desconto = percentual
  add column if not exists perfil             text not null default 'cliente' check (perfil in ('cliente','embaixadora','creator')),
  add column if not exists parcelas           int,                          -- cartão: 0 = débito, 1..12 = crédito
  add column if not exists taxa_percentual    numeric(5,2),                 -- taxa aplicada (da tabela da maquininha)
  add column if not exists taxa_centavos      int not null default 0 check (taxa_centavos >= 0),
  add column if not exists liquido_centavos   int;                          -- total − taxa (o que entra de fato)

alter table public.venda_externa drop constraint if exists venda_externa_pagamento_check;
alter table public.venda_externa add constraint venda_externa_pagamento_check
  check (pagamento in ('pix','dinheiro','cartao','a_prazo','cortesia'));

update public.venda_externa set liquido_centavos = total_centavos - taxa_centavos where liquido_centavos is null;
