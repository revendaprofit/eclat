// Quais caminhos o middleware deixa passar sem usuário logado.
//
// `/login` é a única rota pública em produção. `/estilo` (o mostruário das peças de leitura)
// existe apenas em desenvolvimento — a própria página devolve 404 fora de dev, e esta função
// é a segunda tranca: em produção ela nunca libera nada além do login.
export function rotaLiberada(path: string, ambiente: string | undefined = process.env.NODE_ENV): boolean {
  if (path.startsWith("/login")) return true
  if (ambiente !== "production" && path.startsWith("/estilo")) return true
  return false
}
