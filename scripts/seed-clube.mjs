// Carga inicial do Clube Éclat (architecture/clube.md): config, 5 regras, roteiro da pré-venda.
// Idempotente: config/regras fazem upsert; mensagens da agenda só entram se o título ainda não existe.
// Uso (da raiz do repo): node scripts/seed-clube.mjs   (lê apps/cockpit/.env.local)
import fs from "node:fs"

const env = Object.fromEntries(
  fs.readFileSync("apps/cockpit/.env.local", "utf8").split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")] })
)
const URL = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }
async function sb(path, init = {}) {
  const r = await fetch(`${URL}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers || {}) } })
  if (!r.ok) throw new Error(`${init.method || "GET"} ${path}: ${r.status} ${await r.text()}`)
  const t = await r.text(); return t ? JSON.parse(t) : null
}

// Imagem do nó (símbolo) para o Dia 2 — sobe uma vez para o Storage público.
async function uploadNo() {
  const local = "docs/design/brand/facebook/perfil-1080.png"
  const dest = "site/ads/clube/no-eclat.png"
  const r = await fetch(`${URL}/storage/v1/object/${dest}`, {
    method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "image/png", "x-upsert": "true" },
    body: fs.readFileSync(local),
  })
  if (!r.ok) throw new Error(`upload nó: ${r.status} ${await r.text()}`)
  return `${URL}/storage/v1/object/public/${dest}`
}

// Privado do dono para alertas: o lead que fez o teste do robô (interesse "Clube Éclat")
async function avisoJid() {
  const rows = await sb(`lead?select=whatsapp,nome&interesse=ilike.*Clube*&order=created_at.asc&limit=1`)
  return rows?.[0]?.whatsapp ? String(rows[0].whatsapp).replace(/\D/g, "") : null
}

const BRT = (data, hora) => `${data}T${hora}:00-03:00`
const LOJA = "useeclat.com.br"

const config = {
  id: 1, ativo: false, grupo_jid: "120363159357034423@g.us", aviso_jid: await avisoJid(),
  janela_inicio: "09:00", janela_fim: "21:00", max_por_dia: 3, atraso_max_min: 9, falhas_seguidas: 0,
}

const regras = [
  { tipo: "ultima_unidade", ativa: true, modo: "automatico", limiar: 1, cooldown_horas: 24, agrupar: true, anexar_foto: true,
    template: `Última unidade no primeiro lote: {{ultimas_unidades}}.\n\nQuem quiser, é agora: ${LOJA}` },
  { tipo: "reposicao", ativa: true, modo: "automatico", limiar: null, cooldown_horas: 24, agrupar: true, anexar_foto: true,
    template: `Voltou ao estoque: {{reposicao}}.\n\nVocês ficam sabendo primeiro, como combinado. ${LOJA}` },
  { tipo: "novidade", ativa: true, modo: "automatico", limiar: null, cooldown_horas: 72, agrupar: true, anexar_foto: true,
    template: `Novidade na loja: {{novidades}}.\n\nPrimeiro aqui, depois no Instagram. ${LOJA}` },
  { tipo: "esgotado", ativa: true, modo: "aprovar", limiar: null, cooldown_horas: 48, agrupar: true, anexar_foto: false,
    template: `Esgotou: {{esgotados}}.\n\nQuem ficou sem, me chama no privado que você entra na frente na reposição.` },
  { tipo: "marco_reservas", ativa: false, modo: "aprovar", limiar: 10, cooldown_horas: 24, agrupar: false, anexar_foto: false,
    template: `{{reservas_total}} reservas até agora. Obrigada por estar desde o começo. 💛` },
]

const NO_URL = await uploadNo()
const P = (h, c) => `produto:${h}:${c}`

const agenda = [
  { titulo: "Fixada · boas-vindas", enviar_em: BRT("2026-09-15", "19:30"), midia: null,
    texto: `*Bem-vinda ao Clube Éclat* ✨\n\nAqui é o lugar onde as coisas chegam primeiro.\n\nComo funciona a pré-venda:\n• A loja já está aberta: ${LOJA}\n• Você reserva a sua peça agora e o pagamento é por Pix, combinado comigo no WhatsApp logo depois do pedido.\n• Os envios começam em 10/10.\n• O primeiro lote é pequeno de verdade. Quem reserva primeiro leva.\n• Reposição e próximas cores: quem está aqui fica sabendo antes.\n\nSó eu publico aqui, para não virar bagunça. Nos dias de enquete eu abro para vocês.\n\nObrigada por estar desde o começo.\nCamila` },
  { titulo: "Dia 1 · por que este clube existe", enviar_em: BRT("2026-09-16", "19:30"), midia: P("macaquinho-solaris", "Telha"),
    texto: `Oi. Eu sou a Camila, e este grupo é o lugar mais perto da ÉCLAT que existe.\n\nPor anos eu fui a mulher que treina no horário que a vida deixa e carrega o resto do dia nas costas. Também fui quem entregava roupa de treino na porta de vocês. Ouvi cada "queria que tivesse bolso", cada "essa não segura no agachamento", cada "eu queria me sentir bonita treinando".\n\nA ÉCLAT nasceu dessas conversas. A Coleção Lumière é a primeira, e ela já está em pré-venda: ${LOJA}\n\nNas próximas semanas eu vou mostrar aqui cada peça, os bastidores e a chegada do primeiro lote. E quando as peças chegarem, quem reservou recebe primeiro.` },
  { titulo: "Dia 2 · o nó", enviar_em: BRT("2026-09-18", "19:30"), midia: NO_URL,
    texto: `Este é o símbolo da ÉCLAT. Um nó que não se desfaz.\n\nNão é enfeite. É o que eu vejo em cada mulher que continua: a força que não vem de motivação de fora, vem de dentro, de repetir mesmo nos dias sem vontade. Constância tem essa cara.\n\nE Lumière é luz. A primeira coleção tinha que se chamar assim: a luz de quem construiu algo por dentro e não precisa anunciar.\n\nQuando você vestir, vai lembrar por que começou.` },
  { titulo: "Dia 3 · as duas cores (enquete 1h)", enviar_em: BRT("2026-09-20", "10:00"), midia: P("top-aurora", "Telha"),
    texto: `A Lumière tem duas cores, e cada uma é um jeito de estar no mundo.\n\n*Telha*: quente, terrosa, feita para aparecer sem esforço. É a cor assinatura da ÉCLAT.\n*Grafitti*: a base de tudo. Menos ruído, mais foco. Combina com qualquer coisa que você já tem.\n\nTodos os modelos existem nas duas cores, do top ao macaquinho.\n\nAbri o grupo por 1 hora: *se você fosse uma cor, seria Telha ou Grafitti?*` },
  { titulo: "Dia 4 · Macaquinho Solaris", enviar_em: BRT("2026-09-22", "19:30"), midia: P("macaquinho-solaris", "Grafitti"),
    texto: `Peça 1: *Macaquinho Solaris*.\n\nFoi a peça que eu mais demorei para aprovar. Decote quadrado, costas nadador vazadas, uma peça só que sustenta o treino e vai além dele: sai da academia e vai para o café sem perder a elegância.\n\nTelha ou Grafitti. P, M e G. R$299.\n\nÉ a peça de menor quantidade no primeiro lote. Se ela é a sua, não deixa para depois: ${LOJA}/br/products/macaquinho-solaris` },
  { titulo: "Dia 5 · os dois tops", enviar_em: BRT("2026-09-24", "19:30"), midia: P("top-orvalho", "Telha"),
    texto: `Peça 2: os tops. São dois, porque não existe um top para todas.\n\n*Top Aurora*: fechado na frente, surpreendente atrás. Estrutura maior, recorte mais fechado, para quem quer sustentação de verdade sem abrir mão do bonito.\n*Top Orvalho*: ousadia em formato de top. Revela os ombros e as costas de quem treina com constância e tem orgulho do que construiu.\n\nCada um R$169, em Telha e Grafitti, P ao G.\n\nNa dúvida entre os dois: Aurora para treino pesado, Orvalho para o dia inteiro.` },
  { titulo: "Dia 6 · os dois shorts", enviar_em: BRT("2026-09-26", "19:30"), midia: P("short-orvalho", "Grafitti"),
    texto: `Peça 3: os shorts. Cós alto nos dois, compressão que sustenta sem apertar.\n\n*Short Aurora*: menos costura, mais você. Comprimento intermediário, cobre na medida certa, sem esconder e sem exagerar.\n*Short Orvalho*: para quem não abre mão dos detalhes. A costura que enaltece o bumbum, desenhada para quem repara em tudo.\n\nR$169 cada, Telha e Grafitti, P ao G.\n\nIsso fecha a Lumière: 1 macaquinho, 2 tops, 2 shorts, em 2 cores. Coleção pequena de propósito. Cada peça teve que merecer o lugar.` },
  { titulo: "Dia 7 · como reservar", enviar_em: BRT("2026-09-28", "10:00"), midia: null,
    texto: `Como reservar, passo a passo, para ninguém ficar perdida:\n\n1. Entre em ${LOJA} e escolha a peça, a cor e o tamanho.\n2. Na dúvida do tamanho, cada peça tem o "Qual é o meu tamanho?" e o guia de medidas. Vale 1 minuto.\n3. Adicione à sacola e finalize o pedido. Não pede cartão: a forma de pagamento é "Pix pelo WhatsApp".\n4. Em seguida eu te chamo aqui com a chave Pix. Pagou, a peça é sua e entra no primeiro envio, dia 10/10.\n\nSe preferir tirar dúvida antes de reservar, me manda no privado. Eu respondo pessoalmente.` },
  { titulo: "Dia 8 · a caixa (anexar foto real)", enviar_em: BRT("2026-09-30", "19:30"), midia: null,
    texto: `O primeiro produto da ÉCLAT não é uma roupa. É a caixa.\n\nEu quis uma caixa-gaveta que você não tenha coragem de jogar fora. Que vire porta-joias, organizador, o que você quiser. Cada peça vem embalada individualmente, com etiqueta de nome e tamanho por fora.\n\nE tem o cheiro. Trabalhei anos com isso e não abri mão: a ÉCLAT tem um aroma próprio. Abrir a caixa é o primeiro momento da marca, e eu queria que ele fosse só seu.` },
  { titulo: "Dia 9 · bastidor + contagem (editar bastidor, anexar foto real)", enviar_em: BRT("2026-10-02", "19:30"), midia: null,
    texto: `Bastidor de hoje: [PREENCHER com o que está acontecendo de verdade].\n\nFaltam {{dias_para_envio}} dias para o primeiro envio.\n\nQuem já reservou: obrigada pela confiança, sua peça está separada. Última unidade neste lote: {{ultimas_unidades}}.` },
  { titulo: "Dia 10 · enquete da reposição (abrir grupo 1h)", enviar_em: BRT("2026-10-04", "10:00"), midia: null,
    texto: `Abri o grupo por 1 hora para uma pergunta que vai decidir a reposição:\n\n*Qual peça você quer ver de novo em estoque primeiro, e em qual cor?*\n\nEu leio tudo. A reposição vai seguir o que vocês responderem aqui, e quem está no Clube fica sabendo antes de todo mundo.` },
  { titulo: "Dia 11 · chegaram (SÓ com as peças em mãos; editar frase, anexar foto real)", enviar_em: BRT("2026-10-06", "19:30"), midia: null,
    texto: `Chegaram.\n\n[PREENCHER com uma frase sua sobre o momento].\n\nA partir de agora é conferir, embalar e despachar. Sexta, dia 10, saem os primeiros envios.\n\nÚltimas unidades neste lote: {{ultimas_unidades}}. Quem ainda quer reservar: ${LOJA}` },
  { titulo: "Dia 12 · prazo do Pix para o primeiro envio", enviar_em: BRT("2026-10-08", "19:30"), midia: null,
    texto: `Aviso importante: reservas confirmadas com Pix *até quinta, dia 9, às 18h*, entram no primeiro envio de sexta.\n\nDepois disso, ainda dá para comprar, mas o envio vai para a leva seguinte.\n\nSe você reservou e ainda não fez o Pix, me chama no privado que eu te mando a chave de novo.` },
  { titulo: "Dia 13 · começaram os envios (editar número real, anexar foto real)", enviar_em: BRT("2026-10-10", "19:30"), midia: null,
    texto: `Hoje começaram os envios. ✨\n\n[PREENCHER com o número real de caixas] saíram hoje. O código de rastreio de cada pedido vai pelo WhatsApp, no privado, assim que a transportadora registrar.\n\nQuem ficou sem o tamanho que queria: a reposição já está em andamento e vocês recebem o aviso aqui primeiro.\n\nObrigada. Hoje a ÉCLAT deixou de ser uma ideia.\nCamila` },
  { titulo: "Dia 14 · quem recebeu, manda foto", enviar_em: BRT("2026-10-12", "10:00"), midia: null,
    texto: `Quem já recebeu a caixa: me manda foto. Pode ser da caixa fechada, da peça no corpo, do treino. Eu quero ver.\n\nE uma pergunta para quem recebeu: o cheiro chegou como eu imaginei? Me conta no privado.\n\nO Clube continua sendo o lugar onde as coisas chegam primeiro: reposição, próxima cor, próxima peça. Fica por aqui.` },
]

await sb("clube_config?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(config) })
await sb("clube_regras?on_conflict=tipo", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(regras) })
const existentes = new Set((await sb("clube_mensagens?select=titulo&origem=eq.agenda")).map((r) => r.titulo))
const novas = agenda.filter((a) => !existentes.has(a.titulo)).map((a) => ({ ...a, origem: "agenda", status: "rascunho" }))
if (novas.length) await sb("clube_mensagens", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(novas) })
console.log(`config ok (aviso_jid ${config.aviso_jid ? "definido" : "VAZIO"}), regras: ${regras.length}, agenda: +${novas.length} (já existiam ${existentes.size})`)
