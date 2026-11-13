// Feedbacks: registrar o que falam do negócio e ver o que a IA aprendeu com isso.
import { h, ic, api, aviso, falhou, cabeca, confirmar, copiar, chave, inline, vazio } from '../ui.js';

const TIPOS = ['elogio', 'crítica', 'sugestão', 'dúvida', 'opinião', 'resultado'];
const QUEM = ['cliente', 'eu', 'seguidor', 'equipe', 'outro'];
const STATUS = ['novo', 'visto', 'aprendido'];

const filtro = { tipo: '', status: '', aba: 'geral' };

async function agir(dados, ctx, msg) {
  try {
    await api('/api/feedbacks', dados);
    if (msg) aviso(msg);
  } catch (e) { falhou(e); }
  await ctx.recarregar({ silencioso: true });
}

function formulario(ctx) {
  let tipo = 'sugestão';
  const botoesTipo = h('div', { class: 'segmentado', role: 'group', 'aria-label': 'Tipo' }, TIPOS.map((t) => h('button', {
    type: 'button',
    'aria-pressed': String(t === tipo),
    onclick: (e) => {
      tipo = t;
      e.currentTarget.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.textContent === t)));
    },
  }, t)));
  const disse = h('textarea', { class: 'entrada', rows: '2', placeholder: 'O que foi dito? De preferência com as palavras da pessoa.', 'aria-label': 'O que foi dito' });
  const quem = h('select', { class: 'entrada', 'aria-label': 'Quem disse', style: 'flex:0 1 160px' }, QUEM.map((q) => h('option', { value: q }, q === 'eu' ? 'eu (o dono)' : q)));
  const onde = h('input', { class: 'entrada', type: 'text', placeholder: 'Onde? Ex.: WhatsApp, comentário, e-mail', 'aria-label': 'Onde', style: 'flex:1 1 200px' });
  return h('form', {
    class: 'pilha',
    onsubmit: async (e) => {
      e.preventDefault();
      if (!disse.value.trim()) { disse.focus(); return; }
      await agir({ acao: 'adicionar', disse: disse.value, quem: quem.value, tipo, onde: onde.value }, ctx, 'Feedback anotado. Peça pra IA ver o que ele ensina.');
    },
  },
  botoesTipo,
  disse,
  h('div', { class: 'linha-form' }, quem, onde, h('button', { type: 'submit', class: 'botao principal' }, ic('mais'), 'Registrar')));
}

function blocoDeAprendizado(titulo, itens, icone) {
  return h('div', { class: 'bloco' },
    h('h3', null, ic(icone), titulo),
    itens.length
      ? h('ul', null, itens.map((t) => h('li', { html: inline(t) })))
      : h('p', { class: 'vazio-bloco' }, 'Nada ainda.'));
}

function aprendizados(ap, ctx) {
  const fonte = filtro.aba === 'marketing' ? ap.marketing : ap.geral;
  const achar = (comeco) => fonte.secoes.find((s) => chave(s.titulo).startsWith(comeco));
  const juntar = (s) => (s ? [...s.itens, ...s.subs.flatMap((x) => x.itens.map((i) => `${x.titulo}: ${i}`))] : []);
  const funciona = filtro.aba === 'marketing' ? juntar(achar('a formula')) : juntar(achar('funciona'));
  const blocos = h('div', { class: 'aprendi' },
    blocoDeAprendizado(filtro.aba === 'marketing' ? 'A fórmula' : 'Funciona', funciona, 'check'),
    blocoDeAprendizado('Não funciona', juntar(achar('nao funciona')), 'x'),
    blocoDeAprendizado('Em teste', juntar(achar('em teste')), 'relogio'),
    blocoDeAprendizado('Hipóteses', juntar(achar('hipotese')), 'lampada'));
  const abas = h('div', { class: 'segmentado', role: 'tablist' },
    [['geral', 'Negócio'], ['marketing', 'Marketing']].map(([id, nome]) => h('button', {
      type: 'button',
      role: 'tab',
      'aria-pressed': String(filtro.aba === id),
      onclick: () => { filtro.aba = id; ctx.recarregar({ silencioso: true }); },
    }, nome)));
  return h('section', { class: 'painel vidro' },
    h('div', { class: 'painel-cabeca' }, h('h2', null, 'O que a IA aprendeu'), abas),
    blocos,
    h('div', { class: 'chips', style: 'margin-top:12px;justify-content:space-between' },
      h('a', { class: 'botao leve pequeno', href: `#/arquivo?c=${encodeURIComponent(fonte.arquivo)}` }, ic('texto'), 'Abrir o arquivo'),
      h('button', { type: 'button', class: 'botao leve pequeno', onclick: () => copiar('Leia os feedbacks com status "novo" em memoria/feedbacks.md. Pra cada um, diga o que ele ensina, anote nos aprendizados certos (só com prova) e mude o status.') }, ic('ia'), 'Pedir pra IA aprender com os novos')));
}

function cartaoDeFeedback(f, ctx) {
  return h('article', { class: 'registro' },
    h('div', { class: 'topo-reg' },
      h('div', { class: 'chips' }, f.tipo ? h('span', { class: 'chip rosa' }, f.tipo) : null, f.quem ? h('span', { class: 'chip' }, f.quem) : null, f.data ? h('span', { class: 'chip' }, f.data) : null),
      h('button', {
        type: 'button',
        class: 'icone-botao',
        title: 'Apagar',
        'aria-label': 'Apagar feedback',
        onclick: async () => { if (await confirmar('Apagar este feedback?', { sim: 'Apagar' })) agir({ acao: 'apagar', titulo: f.titulo, linha: f.linha }, ctx, 'Apagado.'); },
      }, ic('lixo'))),
    h('div', { class: 'disse' }, f.disse || f.titulo),
    f.fazer ? h('div', { class: 'pensar' }, h('b', null, 'O que fazer: '), f.fazer) : null,
    h('div', { class: 'rodape-reg' },
      f.onde ? h('span', { class: 'fraco pequeno' }, f.onde) : null,
      h('select', {
        class: 'entrada',
        'aria-label': 'Status',
        style: 'margin-left:auto',
        onchange: (e) => agir({ acao: 'status', titulo: f.titulo, linha: f.linha, status: e.target.value }, ctx),
      }, STATUS.map((s) => h('option', { value: s, selected: chave(f.status) === chave(s) }, s)))));
}

export async function montar(alvo, ctx) {
  const d = await api('/api/feedbacks');
  alvo.append(cabeca({
    titulo: 'Feedbacks',
    texto: 'O que falam do seu negócio e o que a IA aprende com isso. Você também pode só contar pra IA: ela anota aqui sozinha.',
  }));

  alvo.append(h('div', { class: 'grade-2' },
    h('section', { class: 'painel vidro' }, h('div', { class: 'painel-cabeca' }, h('h2', null, 'Registrar um feedback')), formulario(ctx)),
    h('section', { class: 'painel vidro' },
      h('h2', null, 'Como a IA aprende'),
      h('ol', { class: 'suave pequeno', style: 'margin:10px 0 0;padding-left:18px;line-height:1.7' },
        h('li', null, 'O feedback entra como "novo".'),
        h('li', null, 'A IA vê se ele ensina alguma coisa.'),
        h('li', null, 'Com prova (número ou 3 casos), vira aprendizado.'),
        h('li', null, 'Sem prova, vira hipótese pra testar.')))));

  alvo.append(h('div', { style: 'margin-top:18px' }, aprendizados(d.aprendizados, ctx)));

  const lista = d.feedbacks.filter((f) => (!filtro.tipo || chave(f.tipo) === chave(filtro.tipo)) && (!filtro.status || chave(f.status) === chave(filtro.status)));
  const filtros = h('div', { class: 'chips' },
    h('select', { class: 'entrada', style: 'width:auto', 'aria-label': 'Filtrar por tipo', onchange: (e) => { filtro.tipo = e.target.value; ctx.recarregar({ silencioso: true }); } },
      h('option', { value: '' }, 'Todos os tipos'), TIPOS.map((t) => h('option', { value: t, selected: filtro.tipo === t }, t))),
    h('select', { class: 'entrada', style: 'width:auto', 'aria-label': 'Filtrar por status', onchange: (e) => { filtro.status = e.target.value; ctx.recarregar({ silencioso: true }); } },
      h('option', { value: '' }, 'Todos os status'), STATUS.map((s) => h('option', { value: s, selected: filtro.status === s }, s))));

  alvo.append(h('section', { class: 'painel vidro', style: 'margin-top:18px' },
    h('div', { class: 'painel-cabeca' }, h('h2', null, `Registro (${d.feedbacks.length})`), filtros),
    lista.length
      ? h('div', { class: 'grade-cartoes' }, lista.map((f) => cartaoDeFeedback(f, ctx)))
      : vazio({
        titulo: d.feedbacks.length ? 'Nenhum feedback com esse filtro' : 'Nenhum feedback ainda',
        texto: d.feedbacks.length ? 'Mude o filtro acima.' : 'Registre acima ou conte pra IA o que um cliente disse.',
        pedido: d.feedbacks.length ? null : 'Anote este feedback de cliente: ',
      })));

  return {
    titulo: 'Feedbacks',
    podeRecarregar: () => {
      const foco = document.activeElement;
      return !(foco && foco.closest && foco.closest('#tela') && /^(INPUT|TEXTAREA)$/.test(foco.tagName) && foco.value);
    },
  };
}
