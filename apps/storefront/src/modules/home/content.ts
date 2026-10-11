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
  // 2+ fotos = carrossel de fotos inteiras 2:3 no lugar de `image_url` (que segue como reserva)
  image_urls?: string[]
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

// `image_url` = print real da mensagem (Storage site/depoimentos/), com dados pessoais escondidos. Com print, o
// card mostra o print e a frase vira o alt; sem print, o card de texto de antes (sócia, 2026-10-11: "a imagem do
// Whats com a msg fica mais real e confiável"). `image_width`/`image_height` evitam salto de layout.
export type Testimonial = { quote: string; author?: string; origem?: string; image_url?: string; image_width?: number; image_height?: number } // origem: "WhatsApp", "Instagram"
export type Testimonials = {
  visible?: boolean
  heading?: string
  subheading?: string
  items?: Testimonial[]
}

// Chamada para o grupo do WhatsApp (entrada pelo número da marca — vira lead no Cockpit).
export type Clube = {
  visible?: boolean
  eyebrow?: string
  title?: string
  text?: string
  cta_label?: string
}

// Grade "Acompanhe @eclat.use". Fotos hospedadas no Storage do site (as URLs do Instagram expiram).
export type InstagramItem = { image_url: string; href?: string; alt?: string }
// Reels "em movimento" (2026-10-10): vídeo curto hospedado no Storage (site/instagram/reels/), pôster,
// legenda e um link — do post no Instagram (https://www.instagram.com/...) ou interno ("/products/...",
// "/categories/...") que vira "Comprar o look".
export type InstagramReel = { video_url: string; poster_url?: string; caption?: string; href?: string; cta_label?: string }
export type Instagram = {
  visible?: boolean
  handle?: string
  heading?: string
  // título grande do bloco novo; `heading` segue como o da grade de fotos antiga
  title?: string
  text?: string
  reels?: InstagramReel[]
  items?: InstagramItem[]
}

// Universos em painéis de foto (referência versianiswim.com.br, 2026-10-11). Item sem `href` = "em breve".
export type UniversoItem = { title: string; image_url: string; href?: string; cta_label?: string }
export type Universos = { visible?: boolean; heading?: string; items?: UniversoItem[] }

// "Conheça a fundadora" (referência versianiswim.com.br, 2026-10-11).
export type Fundadora = { visible?: boolean; eyebrow?: string; name?: string; text?: string; signature?: string; image_url?: string }

// Banner de largura total "Éclat em todos os momentos" (fotos da praia, 2026-10-10).
export type BannerMomentos = {
  visible?: boolean
  eyebrow?: string
  title?: string
  text?: string
  cta_label?: string
  cta_href?: string
  image_url?: string
  image_url_mobile?: string
}

export type FaqItem = { q: string; a: string }
export type Faq = { visible?: boolean; heading?: string; items?: FaqItem[] }

export const HOME_DEFAULTS = {
  manifesto: {
    text:
      "A Éclat veste a mulher inteira — corpo, força e delicadeza — com peças pensadas para durar e brilhar em cada movimento.",
  } as Manifesto,
  lines: {
    // Oculta por padrão (achado I7): "Compre por peça" já cobre a navegação por categoria;
    // "Nossas linhas" só aparece se o dono ligar explicitamente no Cockpit (site_content.home.lines.visible=true).
    visible: false,
    heading: "Nossas peças",
    items: [
      {
        label: "Legging",
        caption: "Compressão que sustenta do treino ao dia todo",
        href: "/categories/leggings",
      },
      {
        label: "Top",
        caption: "Sustentação e caimento que valorizam",
        href: "/categories/tops",
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
      "Novidades, lançamentos e acesso antecipado, direto no seu e‑mail.",   // hífen que não quebra (e-mail quebrava no fim da linha)
    button_label: "Quero receber",
  } as Newsletter,
  testimonials: {
    // Sem itens de propósito: depoimento só de cliente real, gravado no Cockpit (lib/util/depoimentos.ts).
    heading: "O que elas dizem",
    subheading: "Mensagens reais, do jeito que chegaram no WhatsApp e no Instagram.",
    items: [],
  } as Testimonials,
  clube: {
    // Mecânica decidida pela sócia em 10/10/2026: a cada 3 compras, um mega presente especial.
    eyebrow: "Clube Éclat",
    title: "A cada 3 compras, um mega presente especial.",
    text:
      "Cada compra abre uma porta: a primeira traz a experiência ÉCLAT e um voucher para a próxima; a segunda coloca você dentro do Clube; a terceira vem com um mega presente e um colecionável das Auroras.",
    cta_label: "Quero entrar no Clube",
  } as Clube,
  instagram: {
    handle: "eclat.use",
    heading: "Acompanhe a Éclat",
    title: "ÉCLAT em movimento",
    text: "Treino, praia, bastidores e o que vem por aí. Entra lá: a conversa continua no perfil.",
    reels: [],
    items: [],
  } as Instagram,
  universos: {
    heading: "Compre por universo",
    items: [
      { title: "Fitness", image_url: "https://hqphayoyusbzfhyrxjga.supabase.co/storage/v1/object/public/site/banners/universos/fitness-0f804018.jpg", href: "/collections/lumiere", cta_label: "Comprar agora" },
      { title: "Masculino", image_url: "https://hqphayoyusbzfhyrxjga.supabase.co/storage/v1/object/public/site/banners/universos/masculino-1d1afae9.jpg", href: "/categories/masculino", cta_label: "Comprar agora" },
      { title: "Acessórios", image_url: "https://hqphayoyusbzfhyrxjga.supabase.co/storage/v1/object/public/site/banners/universos/acessorios-4a2ce1a7.jpg", href: "/categories/acessorios", cta_label: "Comprar agora" },
      // Athleisure: foto 134 do ensaio (pasta ATHLEISURE no Drive da sócia, 2026-10-11), estúdio.
      { title: "Athleisure", image_url: "https://hqphayoyusbzfhyrxjga.supabase.co/storage/v1/object/public/site/banners/universos/athleisure-e3d7a40a.jpg", cta_label: "Em breve" },
    ],
  } as Universos,
  fundadora: {
    // RASCUNHO (2026-10-11): a sócia vai mandar o roteiro do aniversário de 40 anos; trocar o texto por ele.
    eyebrow: "Conheça a fundadora",
    name: "Camila",
    text:
      "Aos 40, eu decidi que não queria mais escolher entre a mulher que treina e a mulher que vive o resto do dia. A ÉCLAT nasceu dessa decisão: peças para a mulher inteira, a que acorda cedo, cuida de quem ama, trabalha, treina e ainda quer se olhar no espelho e gostar do que vê.\n\nCada modelo passa pelo meu corpo antes de chegar ao seu. Eu testo no treino, na praia e no dia corrido. Se não segura, não respira ou não valoriza, não entra na coleção.\n\nÉclat é brilho, em francês. Não o brilho que vem de fora: o que você já tem e às vezes esquece. A minha missão é fazer você lembrar.",
    signature: "Camila, fundadora da use.ÉCLAT",
    image_url: "https://hqphayoyusbzfhyrxjga.supabase.co/storage/v1/object/public/site/banners/fundadora/fundadora-87bcdadf.jpg",
  } as Fundadora,
  momentos: {
    eyebrow: "Da areia ao treino",
    title: "ÉCLAT em todos os momentos.",
    text: "No sol da praia, no costão, no treino e no café depois. A peça que acompanha a mulher inteira, do primeiro raio ao fim do dia.",
    cta_label: "Ver a coleção",
    cta_href: "/store",
    image_url: "https://hqphayoyusbzfhyrxjga.supabase.co/storage/v1/object/public/site/banners/momentos/momentos-desktop-ea5b3393.jpg",
    image_url_mobile: "https://hqphayoyusbzfhyrxjga.supabase.co/storage/v1/object/public/site/banners/momentos/momentos-mobile-769d86f7.jpg",
  } as BannerMomentos,
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
        a: "Sim. As peças são pensadas para sustentar no treino e acompanhar o dia todo — compressão que segura, tecido que respira, caimento que valoriza.",
      },
    ],
  } as Faq,
}

// helper: bloco visível a menos que explicitamente desligado (visible === false)
export const isVisible = (v?: { visible?: boolean } | null) =>
  v?.visible !== false
