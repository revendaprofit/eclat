-- Revisão 2 da integração fiscal (spec 2026-09-16, §10): contrato real da Brasil NFe.
-- Aditiva e idempotente. Não mexe em dado existente.

-- O XML autorizado é o documento fiscal com guarda obrigatória. A resposta síncrona da API já o
-- traz (Base64Xml); fica em coluna própria, não enterrado em resposta_bruta.
alter table public.fiscal_documento
  add column if not exists xml_autorizado text;

-- CST de PIS e COFINS (espelhados). Nulo = o bloco não é enviado.
alter table public.fiscal_perfil
  add column if not exists cst_pis_cofins text
  check (cst_pis_cofins is null or cst_pis_cofins ~ '^\d{2}$');

-- CEST: obrigatório quando o produto tem ICMS-ST (sem ele, rejeição 806).
alter table public.fiscal_perfil
  add column if not exists cest text
  check (cest is null or cest ~ '^\d{7}$');
