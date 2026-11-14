// Busca geral: Cmd+K (ou Ctrl+K) em qualquer tela. Procura nas telas do painel e em todos os arquivos do cérebro.
import { h, ic, api, semAcento } from './ui.js';

let aberta = null;

// Sem acento, letra por letra (mesmo tamanho do original, pra marcar o trecho certo)
function normalizar(s) {
  let out = '';
  for (const c of String(s || '')) {
    const n = semAcento(c).toLowerCase();
    out += n.length === c.length ? n : c.toLowerCase().padEnd(c.length, ' ').slice(0, c.length);
  }
  return out;
}

function termosDe(q) {
  return [...new Set(normalizar(q).split(/[^\p{L}\p{N}@#]+/u).filter((t) => t.length >= 2))];
}

// Texto com as palavras da busca em destaque (sem innerHTML)
function marcar(texto, termos) {
  const frag = document.createDocumentFragment();
  const norm = normalizar(texto);
  const marcas = new Array(texto.length).fill(false);
  for (const t of termos) {
    let i = norm.indexOf(t);
    while (i >= 0) { for (let j = i; j < i + t.length; j++) marcas[j] = true; i = norm.indexOf(t, i + t.length); }
  }
  let i = 0;
  while (i < texto.length) {
    const m = marcas[i];
    let j = i;
    while (j < texto.length && marcas[j] === m) j++;
    const pedaco = texto.slice(i, j);
    frag.append(m ? h('mark', null, pedaco) : document.createTextNode(pedaco));
    i = j;
  }
  return frag;
}

export function abrirBusca({ navegar, telas = [] }) {
  if (aberta) { aberta.querySelector('input').focus(); return; }
  const anterior = document.activeElement;
  let itens = [];
  let ativo = 0;
  let relogio = null;
  let pedidoAtual = 0;

  const entrada = h('input', {
    class: 'entrada',
    type: 'search',
    placeholder: 'Procure em tudo: tarefas, feedbacks, roteiros, a estratégia...',
    'aria-label': 'Procurar no painel',
    autocomplete: 'off',
    spellcheck: 'false',
  });
  const lista = h('ul', { class: 'busca-resultados', role: 'listbox', 'aria-label': 'Resultados' });
  const rodape = h('div', { class: 'busca-rodape fraco pequeno' },
    h('span', null, h('kbd', null, '↑'), h('kbd', null, '↓'), ' pra escolher'),
    h('span', null, h('kbd', null, 'Enter'), ' abre'),
    h('span', null, h('kbd', null, 'Esc'), ' fecha'));
  const caixa = h('div', { class: 'busca-geral', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Procurar' },
    h('div', { class: 'busca' }, ic('busca'), entrada),
    lista,
    rodape);
  const fundo = h('div', { class: 'fundo-janela fundo-busca' }, caixa);
  aberta = fundo;

  const fechar = () => {
    clearTimeout(relogio);
    fundo.remove();
    document.removeEventListener('keydown', tecla, true);
    aberta = null;
    if (anterior && anterior.focus) anterior.focus();
  };
  const abrir = (item) => {
    if (!item) return;
    fechar();
    navegar(item.href);
  };

  const marcarAtivo = () => {
    lista.querySelectorAll('[role=option]').forEach((li, i) => {
      li.setAttribute('aria-selected', String(i === ativo));
      if (i === ativo) li.scrollIntoView({ block: 'nearest' });
    });
  };

  const desenhar = (termos, arquivos, { carregando = false, total = 0 } = {}) => {
    const q = termos.length ? termos : [];
    const telasAchadas = telas.filter((t) => q.length && q.every((x) => normalizar(t.nome).includes(x)));
    const lista1 = q.length ? telasAchadas : telas;
    itens = [
      ...lista1.map((t) => ({ tipo: 'tela', titulo: t.nome, href: t.href, icone: t.icone, detalhe: 'Tela do painel' })),
      ...arquivos.map((a) => ({
        tipo: 'arquivo',
        titulo: a.titulo,
        href: a.quadro ? `#/kanban?q=${encodeURIComponent(a.caminho)}` : `#/arquivo?c=${encodeURIComponent(a.caminho)}`,
        icone: a.quadro ? 'colunas' : 'texto',
        detalhe: a.caminho,
        trechos: a.trechos,
      })),
    ];
    if (ativo >= itens.length) ativo = 0;
    const filhos = [];
    if (!q.length) filhos.push(h('li', { class: 'busca-grupo' }, 'Ir pra'));
    else if (telasAchadas.length) filhos.push(h('li', { class: 'busca-grupo' }, 'Telas'));
    itens.forEach((it, i) => {
      if (it.tipo === 'arquivo' && (i === 0 || itens[i - 1].tipo !== 'arquivo')) {
        filhos.push(h('li', { class: 'busca-grupo' }, total > arquivos.length ? `Arquivos (${arquivos.length} de ${total})` : 'Arquivos'));
      }
      filhos.push(h('li', {
        role: 'option',
        class: 'busca-item',
        'aria-selected': String(i === ativo),
        onmousemove: () => { if (ativo !== i) { ativo = i; marcarAtivo(); } },
        onclick: () => abrir(it),
      },
      h('span', { class: 'ico-arq' }, ic(it.icone)),
      h('span', { class: 'corpo' },
        h('span', { class: 't' }, marcar(it.titulo, q)),
        h('span', { class: 'd' }, it.detalhe),
        (it.trechos || []).map((tr) => h('span', { class: 'trecho' }, marcar(tr.texto, q))))));
    });
    if (q.length && !itens.length) {
      filhos.push(h('li', { class: 'busca-vazio' }, carregando ? 'Procurando...' : 'Nada encontrado. Tente outra palavra.'));
    }
    lista.replaceChildren(...filhos);
  };

  const procurar = () => {
    const q = entrada.value.trim();
    const termos = termosDe(q);
    clearTimeout(relogio);
    if (!termos.length) { desenhar([], []); return; }
    desenhar(termos, [], { carregando: true });
    relogio = setTimeout(async () => {
      const n = ++pedidoAtual;
      try {
        const r = await api(`/api/busca?q=${encodeURIComponent(q)}`);
        if (n !== pedidoAtual || !aberta) return;
        ativo = 0;
        desenhar(termos, r.resultados, { total: r.total });
      } catch {
        if (n === pedidoAtual) desenhar(termos, []);
      }
    }, 140);
  };

  const tecla = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fechar(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); ativo = Math.min(itens.length - 1, ativo + 1); marcarAtivo(); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); ativo = Math.max(0, ativo - 1); marcarAtivo(); return; }
    if (e.key === 'Enter' && document.activeElement === entrada) { e.preventDefault(); abrir(itens[ativo]); }
  };

  entrada.addEventListener('input', procurar);
  fundo.addEventListener('mousedown', (e) => { if (e.target === fundo) fechar(); });
  document.addEventListener('keydown', tecla, true);
  document.body.append(fundo);
  desenhar([], []);
  setTimeout(() => entrada.focus(), 20);
}
