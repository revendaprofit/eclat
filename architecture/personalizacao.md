# Minha ÉCLAT — Personalização por Wizard (personas, tamanho, estilo)

## Conceito
Na 1ª visita, um modal de 3 passos (pulável) deixa a cliente escolher:
(1) a MODELO que aparece nas fotos (persona), (2) o TAMANHO dela, (3) os ESTILOS
preferidos. A loja se personaliza — sem cadastro, sem dado pessoal no servidor.

## Dados
- `persona` (migration 0008): slug, nome, descricao, avatar_url, ordem, ativo.
  RLS: anon lê só ativas; escrita via service_role (Cockpit).
- `product_persona_media` (0008): product_id (id OU handle Medusa) × persona →
  images[] (URLs ordenadas). RLS: leitura pública.
- Preferências da cliente: SÓ no navegador — localStorage `eclat_prefs`
  {persona_id, persona_slug, tamanho, estilos[], wizard_done} + cookie espelho
  (permite personalização server-side futura). LGPD: nada identificável no servidor.

## Vitrine (apps/storefront)
- `lib/data/personas.ts` — listPersonas / getPersonaMediaForProduct (anon, revalidate 60s).
- `modules/personalization/`:
  - `prefs.ts` — get/set + evento `eclat:prefs` + `openWizard()`.
  - `wizard.tsx` — modal 3 passos; montado no layout (main); abre 2,5s após
    hidratar na 1ª visita; reabre pelo botão "Minha ÉCLAT" do nav (`trigger.tsx`).
  - `persona-gallery.tsx` — PDP: HTML canônico (SSG) = fotos padrão (SEO INTACTO,
    sem cloaking); após hidratar, troca client-side para as fotos da persona
    escolhida, se existirem. Selo "imagens criadas com IA" automático.
- ProductActions: pré-seleciona a opção Tamanho salva (se existir na peça).

## Cockpit
- Menu "Personas (Minha ÉCLAT)": CRUD de personas + fotos por produto × persona
  (informar handle/prod_id + URLs, uma por linha).
- APIs: /api/personas (GET/POST), /api/personas/[id] (PATCH/DELETE),
  /api/persona-media (GET ?product_id, PUT upsert).

## Produção das fotos por persona (fluxo aprovado: IA com personas fixas)
1. Gerar/treinar persona consistente (Higgsfield; ideal: Soul ID por persona).
2. Para cada produto: gerar frente/costas na persona (nano_banana_pro, usando a
   foto padrão do produto + avatar da persona como referências).
3. Subir no Supabase Storage (`site/personas/...`) e colar as URLs no Cockpit.
Seed atual: personas **Aurora** (1,75m veste P) e **Íris** (1,65m veste G).

## Regras
- SEMPRE exibir o selo de transparência de IA junto às fotos de persona.
- O HTML servidor NUNCA muda por persona (SEO/canonical intocados).
- Fases futuras: reordenar vitrine por estilos; selo "tem seu tamanho"; try-on.
