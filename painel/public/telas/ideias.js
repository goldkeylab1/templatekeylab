// Ideias: guardar agora, decidir depois.
import { h, ic, api, aviso, falhou, cabeca, confirmar, copiar, chave, vazio } from '../ui.js';

const TIPOS = ['produto', 'conteúdo', 'melhoria', 'negócio', 'outro'];
const STATUS = ['nova', 'pensando', 'fazendo', 'feita', 'descartada'];
const filtro = { status: '' };

async function agir(dados, ctx, msg) {
  try {
    await api('/api/ideias', dados);
    if (msg) aviso(msg);
  } catch (e) { falhou(e); }
  await ctx.recarregar({ silencioso: true });
}

function formulario(ctx) {
  const titulo = h('input', { class: 'entrada', type: 'text', placeholder: 'Nome da ideia', 'aria-label': 'Nome da ideia', style: 'flex:2 1 220px' });
  const tipo = h('select', { class: 'entrada', 'aria-label': 'Tipo', style: 'flex:0 1 150px' }, TIPOS.map((t) => h('option', { value: t }, t)));
  const ideia = h('textarea', { class: 'entrada', rows: '2', placeholder: 'A ideia em uma ou duas frases (opcional)', 'aria-label': 'A ideia' });
  return h('form', {
    class: 'pilha',
    onsubmit: async (e) => {
      e.preventDefault();
      if (!titulo.value.trim()) { titulo.focus(); return; }
      await agir({ acao: 'adicionar', titulo: titulo.value, tipo: tipo.value, ideia: ideia.value }, ctx, 'Ideia guardada.');
    },
  }, h('div', { class: 'linha-form' }, titulo, tipo), ideia, h('div', null, h('button', { type: 'submit', class: 'botao principal' }, ic('mais'), 'Guardar ideia')));
}

function cartaoDeIdeia(i, ctx) {
  const st = chave(i.status);
  return h('article', { class: 'registro' },
    h('div', { class: 'topo-reg' },
      h('h3', null, i.titulo),
      h('button', {
        type: 'button',
        class: 'icone-botao',
        title: 'Apagar',
        'aria-label': `Apagar a ideia ${i.titulo}`,
        onclick: async () => { if (await confirmar(`Apagar a ideia "${i.titulo}"?`, { sim: 'Apagar' })) agir({ acao: 'apagar', titulo: i.titulo, linha: i.linha }, ctx, 'Apagada.'); },
      }, ic('lixo'))),
    i.ideia ? h('div', { class: 'disse' }, i.ideia) : null,
    i.pensar ? h('div', { class: 'pensar' }, h('b', null, 'Pra pensar: '), i.pensar) : null,
    h('div', { class: 'chips' }, i.tipo ? h('span', { class: 'chip' }, i.tipo) : null, i.data ? h('span', { class: 'chip' }, i.data) : null),
    h('div', { class: 'rodape-reg' },
      h('select', {
        class: 'entrada',
        'aria-label': 'Status',
        onchange: (e) => agir({ acao: 'status', titulo: i.titulo, linha: i.linha, status: e.target.value }, ctx),
      }, STATUS.map((s) => h('option', { value: s, selected: st === chave(s) }, s))),
      st === 'nova' || st === 'pensando'
        ? h('button', { type: 'button', class: 'botao pequeno', onclick: () => agir({ acao: 'pro-kanban', titulo: i.titulo, linha: i.linha }, ctx, 'Foi pro kanban (quadro principal).') }, ic('colunas'), 'Mandar pro kanban')
        : null,
      h('button', {
        type: 'button',
        class: 'botao leve pequeno',
        onclick: () => copiar(`Avalie a ideia "${i.titulo}" (memoria/ideias.md) com os números e a estratégia do meu negócio: o que sustenta, o que derruba e um teste pequeno que decide. Anote em "Pra pensar".`),
      }, ic('ia'), 'Avaliar com a IA')));
}

export async function montar(alvo, ctx) {
  const d = await api('/api/ideias');
  alvo.append(cabeca({ titulo: 'Ideias', texto: 'Guarde agora, decida depois. Contou uma ideia pra IA? Ela já anota aqui.' }));

  alvo.append(h('section', { class: 'painel vidro' }, h('div', { class: 'painel-cabeca' }, h('h2', null, 'Nova ideia')), formulario(ctx)));

  const conta = (s) => d.ideias.filter((i) => chave(i.status) === chave(s)).length;
  const filtros = h('div', { class: 'abas', role: 'tablist', style: 'margin:0' },
    [['', 'Todas', d.ideias.length], ...STATUS.map((s) => [s, s.charAt(0).toUpperCase() + s.slice(1), conta(s)])].map(([valor, nome, n]) => h('button', {
      type: 'button',
      class: 'aba',
      role: 'tab',
      'aria-selected': String(filtro.status === valor),
      onclick: () => { filtro.status = valor; ctx.recarregar({ silencioso: true }); },
    }, nome, h('span', { class: 'n' }, String(n)))));

  const lista = d.ideias.filter((i) => !filtro.status || chave(i.status) === chave(filtro.status));
  alvo.append(h('section', { class: 'painel vidro', style: 'margin-top:18px' },
    h('div', { class: 'painel-cabeca' }, filtros),
    lista.length
      ? h('div', { class: 'grade-cartoes' }, lista.map((i) => cartaoDeIdeia(i, ctx)))
      : vazio({
        titulo: d.ideias.length ? 'Nenhuma ideia nesse grupo' : 'Nenhuma ideia ainda',
        texto: d.ideias.length ? 'Escolha outro grupo acima.' : 'Guarde a primeira acima, ou conte pra IA.',
        pedido: d.ideias.length ? null : 'Guarde esta ideia pra depois: ',
      })));

  return {
    titulo: 'Ideias',
    podeRecarregar: () => {
      const foco = document.activeElement;
      return !(foco && foco.closest && foco.closest('#tela') && /^(INPUT|TEXTAREA)$/.test(foco.tagName) && foco.value);
    },
  };
}
