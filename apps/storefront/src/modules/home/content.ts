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
      { title: "Troca fácil", text: "30 dias para trocar ou devolver." },
    ],
  } as Benefits,
  newsletter: {
    title: "Faça parte da Éclat",
    text:
      "Novidades, lançamentos e acesso antecipado — direto no seu e-mail.",
    button_label: "Quero receber",
  } as Newsletter,
}

// helper: bloco visível a menos que explicitamente desligado (visible === false)
export const isVisible = (v?: { visible?: boolean } | null) =>
  v?.visible !== false
