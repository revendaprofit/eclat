// Tipos e conteúdo padrão (fallback) dos blocos editoriais da home.
// Cada bloco é uma chave em site_content (Supabase), editável no Cockpit.
// Se a chave não existir, usa-se o default daqui — a home nunca fica "vazia".

export type Manifesto = { visible?: boolean; text?: string }

export type LineItem = {
  label: string
  caption?: string
  href: string
  image_url?: string
}
export type FeaturedLines = {
  visible?: boolean
  heading?: string
  items?: LineItem[]
}

export type FeaturedCollection = {
  visible?: boolean
  heading?: string
  collection_handle?: string
}

export type EditorialBanner = {
  visible?: boolean
  eyebrow?: string
  title?: string
  text?: string
  cta_label?: string
  cta_href?: string
  image_url?: string
  image_side?: "left" | "right"
}

export type BenefitItem = { title: string; text?: string }
export type Benefits = { visible?: boolean; heading?: string; items?: BenefitItem[] }

export type Newsletter = {
  visible?: boolean
  title?: string
  text?: string
  button_label?: string
}

export type Testimonial = { quote: string; author?: string }
export type Testimonials = {
  visible?: boolean
  heading?: string
  items?: Testimonial[]
}

export type FaqItem = { q: string; a: string }
export type Faq = { visible?: boolean; heading?: string; items?: FaqItem[] }

export const HOME_DEFAULTS = {
  manifesto: {
    text:
      "A Éclat veste a mulher inteira — corpo, força e delicadeza — com peças pensadas para durar e brilhar em cada movimento.",
  } as Manifesto,
  lines: {
    heading: "Nossas linhas",
    items: [
      {
        label: "Treino",
        caption: "Alta performance e caimento que valoriza",
        href: "/categories/treino",
      },
      {
        label: "Casual",
        caption: "Do estúdio à rua, sem perder a elegância",
        href: "/categories/casual",
      },
    ],
  } as FeaturedLines,
  featured: {
    heading: "Coleção em destaque",
  } as FeaturedCollection,
  banner: {
    eyebrow: "Nova estação",
    title: "Resplendor",
    text: "A coleção que celebra a luz da mulher inteira.",
    cta_label: "Explorar coleção",
    cta_href: "/store",
    image_side: "right",
  } as EditorialBanner,
  benefits: {
    heading: "",
    items: [
      { title: "Tecido premium", text: "Compressão e toque que duram." },
      { title: "Caimento que valoriza", text: "Modelagem pensada no corpo real." },
      { title: "Frete para todo o Brasil", text: "Rápido e rastreado." },
      { title: "Troca fácil", text: "7 dias para se arrepender (CDC) e troca de tamanho pelo WhatsApp." },
    ],
  } as Benefits,
  newsletter: {
    title: "Faça parte da Éclat",
    text:
      "Novidades, lançamentos e acesso antecipado — direto no seu e-mail.",
    button_label: "Quero receber",
  } as Newsletter,
  testimonials: {
    heading: "Quem veste, ama",
    items: [
      {
        quote:
          "O caimento é perfeito, valoriza demais. Não tiro mais.",
        author: "Marina S.",
      },
      {
        quote:
          "Tecido premium de verdade — sustenta no treino e fica linda na rua.",
        author: "Camila R.",
      },
      {
        quote: "Entrega rápida e a peça é ainda mais bonita pessoalmente.",
        author: "Juliana P.",
      },
    ],
  } as Testimonials,
  faq: {
    heading: "Perguntas frequentes",
    items: [
      {
        q: "Como escolho meu tamanho na use.ÉCLAT?",
        a: "Cada produto tem a tabela de medidas na própria página. Na dúvida entre dois tamanhos, escolha o maior para mais conforto no treino.",
      },
      {
        q: "O tecido é de compressão? Fica transparente no agachamento?",
        a: "Usamos tecidos premium de alta compressão que sustentam, não marcam e não ficam transparentes no agachamento.",
      },
      {
        q: "Qual o prazo de entrega e o frete?",
        a: "Enviamos para todo o Brasil com rastreio. O prazo e o valor do frete aparecem no checkout conforme o seu CEP.",
      },
      {
        q: "Posso trocar ou devolver?",
        a: "Sim. Você tem 7 dias corridos após receber para desistir da compra com reembolso integral (CDC). Troca de tamanho é pelo WhatsApp, conforme o estoque. Defeito de fabricação: troca sem custo em até 30 dias.",
      },
      {
        q: "As peças servem para treino e para o dia a dia?",
        a: "Sim. A linha Treino é focada em performance e a linha Casual no lifestyle — muitas peças transitam bem entre os dois mundos.",
      },
    ],
  } as Faq,
}

// helper: bloco visível a menos que explicitamente desligado (visible === false)
export const isVisible = (v?: { visible?: boolean } | null) =>
  v?.visible !== false
