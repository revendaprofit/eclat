const fs = require('fs');
const NL = String.fromCharCode(10);
const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(NL)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const BASE = env.MEDUSA_ADMIN_URL;
(async () => {
  const auth = await fetch(BASE + '/auth/user/emailpass', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: env.MEDUSA_ADMIN_EMAIL, password: env.MEDUSA_ADMIN_PASSWORD }),
  });
  const { token } = await auth.json();
  if (!token) throw new Error('sem token admin');
  const H = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };

  const list = await fetch(BASE + '/admin/products?handle=legging-resplendor&fields=id,handle,metadata', { headers: H });
  const { products } = await list.json();
  const p = products && products[0];
  if (!p) throw new Error('legging-resplendor nao encontrada');

  const metadata = Object.assign({}, p.metadata || {}, {
    dsb_dor: 'você ainda confere no espelho antes de agachar?',
    dsb_solucao: 'A Legging Resplendor tem tecido encorpado e opaco, com compressão firme que sustenta. Não é promessa de rótulo — é gramatura.',
    dsb_beneficios: [
      'Você agacha, levanta e não confere mais',
      'Sustenta na série pesada e continua bonita na rua',
      'Cintura alta que não enrola no meio do treino',
    ].join(NL),
    quem_sim: [
      'Treina de verdade e precisa de peça que sustente a série pesada',
      'Quer sair do estúdio direto para a rua sem trocar de roupa',
      'Já checou no espelho antes de agachar — e não quer mais',
      'Cansou de cintura que enrola no meio do treino',
      'Valoriza caimento e acabamento, não só preço',
    ].join(NL),
    quem_nao: [
      'Procura a legging mais barata do mercado — não somos',
      'Quer compressão médica ou terapêutica',
      'Precisa de peça térmica para frio extremo',
      'Busca estampa — a Resplendor é lisa, em Preto e Areia',
    ].join(NL),
    faq: JSON.stringify([
      { q: 'Fica transparente no agachamento?', a: 'Não. O tecido é encorpado e opaco: a gramatura foi escolhida para a trama não abrir quando o tecido estica. É a pergunta que mais recebemos — e a razão de a Resplendor existir do jeito que é.' },
      { q: 'A cintura enrola no treino?', a: 'Não. A cintura é alta e trabalha junto com a compressão firme para ficar no lugar do aquecimento ao último exercício.' },
      { q: 'Como escolho meu tamanho?', a: 'Use a tabela de medidas acima, medindo busto na parte mais cheia, cintura na parte mais fina e quadril na parte mais cheia, sempre com a fita paralela ao chão. Entre dois tamanhos: o menor sustenta mais, o maior é mais confortável.' },
      { q: 'Serve para usar fora do treino?', a: 'Sim — é exatamente a proposta. O caimento foi pensado para sair do estúdio direto para a rua, sem parecer roupa de ginástica.' },
      { q: 'Posso trocar ou devolver?', a: 'Sim. Você tem 7 dias corridos após o recebimento para desistir da compra com reembolso integral (CDC), peça sem uso e com etiquetas. Para troca de tamanho, chame no WhatsApp com o número do pedido. Defeito de fabricação: 30 dias, sem custo.' },
    ]),
  });

  const up = await fetch(BASE + '/admin/products/' + p.id, {
    method: 'POST', headers: H, body: JSON.stringify({ metadata }),
  });
  console.log('update status:', up.status);
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
