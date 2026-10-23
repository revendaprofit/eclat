-- Vendas fora do site, parte 3 (sócia, 2026-10-23): perfil "uso_proprio" = peças que a sócia pega para ela e para a
-- família. Sempre custo zero (cortesia); o custo puro da peça vai para o financeiro numa linha própria, como as
-- creators (DRE "uso_proprio", Visão geral quadro "Uso próprio"). Reexecutável.
alter table public.venda_externa drop constraint if exists venda_externa_perfil_check;
alter table public.venda_externa add constraint venda_externa_perfil_check
  check (perfil in ('cliente','embaixadora','creator','uso_proprio'));
