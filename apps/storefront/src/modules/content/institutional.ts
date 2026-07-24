// Páginas institucionais da vitrine. Conteúdo padrão abaixo; o Cockpit pode
// sobrescrever título/descrição/corpo salvando em site_content na chave
// `page.<id>` com {title, description, body_md}.

export type InstitutionalPage = {
  // id = chave no site_content (page.<id>)
  id: string
  // slug da URL: /br/<slug>
  slug: string
  title: string
  description: string
  schemaType: "WebPage" | "AboutPage"
  defaultMd: string
}

export const INSTITUTIONAL_PAGES: InstitutionalPage[] = [
  {
    id: "sobre",
    slug: "sobre",
    title: "Sobre a use.ÉCLAT",
    description:
      "Conheça a use.ÉCLAT: marca brasileira premium e independente de moda fitness — athleisure da mulher inteira.",
    schemaType: "AboutPage",
    defaultMd: `## A luz da mulher inteira

A **use.ÉCLAT** é uma marca brasileira premium e independente de moda fitness. Criamos athleisure para a mulher inteira — peças que sustentam no treino, valorizam o corpo e acompanham o dia todo com conforto e elegância.

## No que acreditamos

- **Sustentação real**: modelagem e tecidos que seguram de verdade, sem apertar.
- **Qualidade premium**: acabamento e durabilidade acima do mercado.
- **Independência**: somos uma marca própria, sem vínculo com nenhuma outra.

## Onde estamos

Somos um e-commerce brasileiro: vendemos em todo o Brasil pela loja online, com atendimento próximo pelo WhatsApp.`,
  },
  {
    id: "trocas",
    slug: "trocas-e-devolucoes",
    title: "Trocas e Devoluções",
    description:
      "Política de trocas e devoluções da use.ÉCLAT: arrependimento em até 7 dias, troca de tamanho e produto com defeito.",
    schemaType: "WebPage",
    defaultMd: `## Arrependimento (até 7 dias)

Conforme o Código de Defesa do Consumidor, você pode desistir da compra em até **7 dias corridos** após o recebimento, com reembolso integral. A peça deve estar sem uso, com etiquetas.

## Troca de tamanho

Vestiu e não ficou como esperava? Falamos com você pelo WhatsApp e organizamos a troca de tamanho conforme disponibilidade de estoque.

## Produto com defeito

Peças com defeito de fabricação são trocadas em até **30 dias** após o recebimento, sem custo.

## Como solicitar

- Chame a gente no WhatsApp com o número do pedido.
- Enviaremos as instruções de postagem.
- Após o recebimento e conferência, a troca ou o reembolso é processado.`,
  },
  {
    id: "medidas",
    slug: "guia-de-medidas",
    title: "Guia de Medidas",
    description:
      "Guia de medidas use.ÉCLAT: como medir busto, cintura e quadril e escolher o tamanho ideal de leggings, tops e conjuntos.",
    schemaType: "WebPage",
    defaultMd: `## Como tirar suas medidas

- **Busto**: meça na parte mais cheia, com fita paralela ao chão.
- **Cintura**: meça na parte mais fina do tronco.
- **Quadril**: meça na parte mais cheia do quadril.

## Tabela geral (cm)

- **P** — busto 82–88 · cintura 62–68 · quadril 88–94
- **M** — busto 88–94 · cintura 68–74 · quadril 94–100
- **G** — busto 94–100 · cintura 74–80 · quadril 100–106
- **GG** — busto 100–108 · cintura 80–88 · quadril 106–114

## Dica ÉCLAT

Nossos tecidos têm compressão com elasticidade: entre dois tamanhos, escolha o **menor** para mais sustentação ou o **maior** para mais conforto. Em caso de dúvida, chame a gente no WhatsApp — ajudamos a acertar de primeira.`,
  },
  {
    id: "privacidade",
    slug: "privacidade",
    title: "Política de Privacidade",
    description:
      "Política de privacidade da use.ÉCLAT: como tratamos seus dados pessoais de acordo com a LGPD.",
    schemaType: "WebPage",
    defaultMd: `## Seus dados, com respeito

A use.ÉCLAT trata dados pessoais de acordo com a **LGPD** (Lei 13.709/2018). Coletamos apenas o necessário para operar a loja: dados de cadastro, entrega, pagamento e atendimento.

## O que coletamos e por quê

- **Cadastro e pedido**: nome, contato e endereço — para entregar sua compra.
- **Pagamento**: processado pelo provedor de pagamento; não armazenamos dados de cartão.
- **Navegação**: cookies de análise e marketing, mediante seu consentimento no banner.

## Seus direitos

Você pode solicitar acesso, correção ou exclusão dos seus dados a qualquer momento pelos nossos canais de atendimento.`,
  },
]

export function getInstitutionalBySlug(slug: string) {
  return INSTITUTIONAL_PAGES.find((p) => p.slug === slug) ?? null
}
