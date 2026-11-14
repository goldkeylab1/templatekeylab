// Comece aqui: o quanto já está configurado, o próximo passo e o passo a passo.
import { h, ic, api, anel, barra, pedido, copiar, cabeca, falhou, pedirIA, temChat } from '../ui.js';

function pedidoDoArquivo(item) {
  return `Vamos preencher "${item.titulo}" (${item.caminho}). Me faça as perguntas que faltam, uma de cada vez, e anote as respostas no arquivo.`;
}

function proximoPasso(item) {
  if (item.tipo === 'github') {
    return h('div', { class: 'proximo' },
      h('div', { class: 't' }, h('b', null, 'Próximo: ligar no GitHub'), h('div', { class: 'suave pequeno' }, item.faltam[0] || item.texto)),
      h('a', { class: 'botao principal', href: '#/ajuda?q=github' }, 'Ver como'),
      h('button', { type: 'button', class: 'botao', onclick: () => pedirIA('salvar no github') }, ic('ia'), temChat() ? 'Pedir pra IA' : 'Copiar pedido pra IA'));
  }
  const faltam = item.total - item.feitos;
  return h('div', { class: 'proximo' },
    h('div', { class: 't' },
      h('b', null, `Próximo: ${item.titulo}`),
      h('div', { class: 'suave pequeno' }, `${faltam} ${faltam === 1 ? 'resposta falta' : 'respostas faltam'} em ${item.area}`)),
    h('a', { class: 'botao principal', href: `#/arquivo?c=${encodeURIComponent(item.caminho)}` }, ic('lapis'), 'Responder aqui'),
    h('button', { type: 'button', class: 'botao', onclick: () => pedirIA(pedidoDoArquivo(item)) }, ic('ia'), temChat() ? 'Fazer com a IA' : 'Copiar pedido pra IA'));
}

function itemDeStatus(item) {
  const pronto = item.pct >= 100;
  let falta = '';
  if (!pronto) {
    const lista = item.faltam || [];
    falta = item.tipo === 'github'
      ? lista.join(', ')
      : `Falta: ${lista.slice(0, 2).join('; ')}${lista.length > 2 ? ` e mais ${lista.length - 2}` : ''}`;
  }
  const acoes = item.tipo === 'github'
    ? h('div', { class: 'acoes-item' }, pronto ? null : h('a', { class: 'botao pequeno', href: '#/ajustes' }, 'Ver'))
    : h('div', { class: 'acoes-item' },
      h('a', { class: 'botao pequeno', href: `#/arquivo?c=${encodeURIComponent(item.caminho)}` }, pronto ? 'Ver' : 'Responder'),
      pronto ? null : h('button', { type: 'button', class: 'icone-botao', title: 'Pedir pra IA', 'aria-label': 'Pedir pra IA', onclick: () => pedirIA(pedidoDoArquivo(item)) }, ic('ia')));
  const conta = item.tipo === 'github' ? (pronto ? 'ligado' : 'falta') : `${item.feitos} de ${item.total}`;
  return h('div', { class: `status-item${pronto ? ' pronto' : ''}` },
    h('span', { class: 'ico-status' }, ic(pronto ? 'check' : item.icone || 'pasta')),
    h('div', { style: 'min-width:0' },
      h('div', { class: 'topo-item' }, h('span', { class: 'nome' }, item.titulo), h('span', { class: 'conta' }, conta)),
      barra(item.pct),
      falta ? h('div', { class: 'falta', title: falta }, falta) : h('div', { class: 'falta' }, 'Pronto.')),
    acoes);
}

function passo({ feito, titulo, texto, acao }) {
  return h('li', { class: feito ? 'feito' : '' }, h('div', null, h('h3', null, titulo), h('p', null, texto)), acao || h('span'));
}

export async function montar(alvo, ctx) {
  const [st, fb, ideias] = await Promise.all([api('/api/status'), api('/api/feedbacks'), api('/api/ideias')]);
  const marca = ctx.inicio.marca;
  const itensNegocio = st.itens.filter((i) => i.areaId === 'negocio');
  const negocioPronto = itensNegocio.length > 0 && itensNegocio.every((i) => i.pct >= 100);
  const github = st.itens.find((i) => i.tipo === 'github');
  const usando = fb.feedbacks.length > 0 || ideias.ideias.length > 0;

  alvo.append(cabeca({
    titulo: 'Comece aqui',
    texto: 'Configure o cérebro do seu negócio. Responda com a sua IA ou aqui mesmo no painel. Dá pra parar e voltar quando quiser.',
  }));

  alvo.append(h('section', { class: 'painel vidro' },
    h('div', { class: 'progresso-topo' },
      anel(st.pct, { rotulo: 'configurado' }),
      h('div', { class: 'texto' },
        h('h2', null, st.pct >= 100 ? 'Tudo configurado' : `${st.prontos} de ${st.total} partes prontas`),
        h('p', { class: 'suave', style: 'margin:6px 0 0' }, st.pct >= 100
          ? 'O cérebro está completo. A IA continua aprendendo com o que você conta pra ela.'
          : 'Cada parte pronta deixa a IA mais certeira com o seu negócio.'),
        st.proximo ? proximoPasso(st.proximo) : null))));

  // Antes de tudo: o sonho (Mentalidade). Um convite, nunca obrigação: não conta na porcentagem.
  const lembrete = ctx.inicio.lembrete;
  if (lembrete) {
    const sonho = lembrete.sonho;
    alvo.append(h('section', { class: 'painel convite-sonho' },
      h('span', { class: 'convite-sonho-ico' }, ic('semente')),
      h('div', { class: 'convite-sonho-corpo' },
        h('div', { class: 'sonho-rotulo' }, 'Antes de tudo'),
        h('h2', null, sonho ? 'Você já sabe pra onde vai.' : 'Pra onde você quer ir?'),
        h('p', null, sonho
          ? `Rumo a: ${sonho}`
          : 'Todo negócio de sucesso começa com uma pessoa que sabe o que quer da vida. Escrever o seu sonho leva poucos minutos e dá direção pra tudo o que vem depois. É opcional, mas faz muita diferença.')),
      h('a', { class: 'botao principal', href: '#/area/mentalidade' }, ic('montanha'), sonho ? 'Ver a minha Mentalidade' : 'Escrever o meu sonho')));
  }

  const passos = h('ol', { class: 'passos' },
    passo({
      feito: st.pct > 0,
      titulo: 'Abra esta pasta na sua IA',
      texto: 'Claude Code, Codex, Cursor, Gemini ou outra que mexa em arquivos. Ela lê as regras sozinha.',
      acao: h('a', { class: 'botao pequeno', href: '#/ajuda?q=qual ia' }, 'Qual IA usar?'),
    }),
    passo({
      feito: negocioPronto,
      titulo: 'Configure o negócio',
      texto: 'Escreva "configurar". A IA faz perguntas curtas, uma de cada vez, e anota tudo nos arquivos.',
      acao: h('button', { type: 'button', class: 'botao pequeno', onclick: () => pedirIA('configurar') }, ic(temChat() ? 'ia' : 'copiar'), temChat() ? 'Começar' : 'Copiar'),
    }),
    passo({
      feito: !!(marca.logo && marca.cor),
      titulo: 'Coloque a sua marca no painel',
      texto: 'O logo e a cor principal deixam o painel com a sua cara.',
      acao: h('a', { class: 'botao pequeno', href: '#/ajustes' }, 'Abrir Ajustes'),
    }),
    passo({
      feito: github && github.pct >= 100,
      titulo: 'Ligue no GitHub',
      texto: 'Uma cópia na nuvem, pra nunca perder nada. Escreva "salvar no github" e a IA te guia.',
      acao: h('button', { type: 'button', class: 'botao pequeno', onclick: () => pedirIA('salvar no github') }, ic(temChat() ? 'ia' : 'copiar'), temChat() ? 'Começar' : 'Copiar'),
    }),
    passo({
      feito: usando,
      titulo: 'Use no dia a dia',
      texto: 'Conte pra IA o que acontece: feedbacks, ideias, decisões e tarefas. Ela anota sozinha, sem comando.',
      acao: h('a', { class: 'botao pequeno', href: '#/dashboard' }, 'Ver o Dashboard'),
    }),
    passo({
      feito: false,
      titulo: 'Deixe do seu jeito',
      texto: 'Crie áreas, quadros e receitas novas quando precisar. A Ajuda mostra como.',
      acao: h('a', { class: 'botao pequeno', href: '#/ajuda?q=expandir' }, 'Ver como'),
    }));

  alvo.append(h('div', { class: 'grade-2', style: 'margin-top:18px' },
    h('section', { class: 'painel vidro' },
      h('div', { class: 'painel-cabeca' }, h('h2', null, 'O que já está configurado')),
      ...agrupar(st.itens)),
    h('div', { class: 'pilha' },
      h('section', { class: 'painel vidro' }, h('div', { class: 'painel-cabeca' }, h('h2', null, 'Passo a passo')), passos),
      h('section', { class: 'painel vidro' },
        h('h2', null, 'Usa uma IA que só conversa?'),
        h('p', { class: 'suave pequeno', style: 'margin:6px 0 12px' }, 'Tipo o ChatGPT ou o Claude no site. Copie o cérebro, cole lá no começo da conversa e responda pelo painel.'),
        h('button', {
          type: 'button',
          class: 'botao',
          onclick: async () => {
            try { const r = await api('/api/cerebro'); copiar(r.texto, 'Cérebro copiado. Cole no começo da conversa com a IA.'); } catch (e) { falhou(e); }
          },
        }, ic('copiar'), 'Copiar o cérebro')))));
}

function agrupar(itens) {
  const grupos = new Map();
  for (const i of itens) {
    const nome = i.area || 'Outros';
    if (!grupos.has(nome)) grupos.set(nome, []);
    grupos.get(nome).push(i);
  }
  const out = [];
  for (const [nome, lista] of grupos) {
    const prontos = lista.filter((i) => i.pct >= 100).length;
    out.push(h('div', { class: 'grupo-titulo' }, nome, h('span', { class: 'conta' }, `${prontos} de ${lista.length}`)));
    out.push(...lista.map(itemDeStatus));
  }
  return out;
}

export { pedidoDoArquivo };
