// Loja "em construção": única fonte da flag, usada pelo middleware (gate de
// rota) e pelo sitemap (evita listar URLs que hoje só mostram a mesma
// página de lista de espera). Para reabrir a loja, mude para false e faça
// o deploy — não precisa mexer em mais nada.
export const COMING_SOON = true
export const COMING_SOON_PATH = "/em-breve"
