// Kanban: um quadro por arquivo .md com o marcador de kanban. Arraste os cartões entre as colunas.
import { h, ic, api, aviso, falhou, cabeca, janela, confirmar, pedirTexto, dataCurta, hoje, vazio, copiar } from '../ui.js';

const escolha = {
  get quadro() { try { return localStorage.getItem('keylab-quadro') || ''; } catch { return ''; } },
  set quadro(v) { try { localStorage.setItem('keylab-quadro', v); } catch { /* sem guardar */ } },
};

let arrastando = null;

async function agir(dados, ctx, msg) {
  try {
    const r = await api('/api/kanban', dados);
    if (msg) aviso(msg);
    return r;
  } catch (e) {
    falhou(e);
    return null;
  } finally {
    await ctx.recarregar({ silencioso: true });
  }
}

function listaDeTags(texto) {
  return String(texto || '').split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean);
}

async function editarCartao(q, col, c, ctx) {
  const texto = h('input', { class: 'entrada', type: 'text', value: c.texto });
  const data = h('input', { class: 'entrada', type: 'date', value: c.data || '' });
  const tags = h('input', { class: 'entrada', type: 'text', value: (c.areas || []).join(', '), placeholder: 'Ex.: site, urgente' });
  const notas = h('textarea', { class: 'entrada', rows: '3', placeholder: 'Uma nota por linha' }, (c.notas || []).join('\n'));
  const coluna = h('select', { class: 'entrada' }, q.colunas.map((k) => h('option', { value: k.titulo, selected: k.titulo === col.titulo }, k.titulo)));
  const corpo = h('div', null,
    h('div', { class: 'campo-janela' }, h('label', { class: 'rotulo' }, 'Cartão'), texto),
    h('div', { class: 'campo-janela' }, h('label', { class: 'rotulo' }, 'Coluna'), coluna),
    h('div', { class: 'campo-janela' }, h('label', { class: 'rotulo' }, 'Data (opcional)'), data),
    h('div', { class: 'campo-janela' }, h('label', { class: 'rotulo' }, 'Etiquetas (opcional)'), tags),
    h('div', { class: 'campo-janela' }, h('label', { class: 'rotulo' }, 'Notas (opcional)'), notas));
  const r = await janela({
    titulo: 'Cartão',
    corpo,
    botoes: [
      { texto: 'Apagar', esquerda: true, icone: 'lixo', valor: 'apagar' },
      { texto: 'Cancelar', valor: null },
      { texto: 'Salvar', principal: true, valor: 'salvar' },
    ],
  });
  if (r === 'apagar') {
    if (await confirmar(`Apagar o cartão "${c.texto}"?`, { sim: 'Apagar' })) await agir({ acao: 'apagar', arquivo: q.arquivo, coluna: col.titulo, id: c.id }, ctx, 'Cartão apagado.');
    return;
  }
  if (r !== 'salvar') return;
  let colunaAtual = col.titulo;
  if (coluna.value !== col.titulo) {
    const m = await api('/api/kanban', { acao: 'mover', arquivo: q.arquivo, coluna: col.titulo, id: c.id, para: coluna.value }).catch((e) => { falhou(e); return null; });
    if (!m) { await ctx.recarregar({ silencioso: true }); return; }
    colunaAtual = coluna.value;
  }
  await agir({
    acao: 'editar',
    arquivo: q.arquivo,
    coluna: colunaAtual,
    id: c.id,
    texto: texto.value,
    data: data.value || null,
    areas: listaDeTags(tags.value),
    notas: notas.value.split('\n').map((s) => s.trim()).filter(Boolean),
  }, ctx, 'Cartão salvo.');
}

function cartao(q, col, c, ctx) {
  const hj = hoje();
  const el = h('div', {
    class: 'cartao',
    draggable: 'true',
    tabindex: '0',
    role: 'button',
    'aria-label': `${c.texto}. Enter pra editar ou mover.`,
    onclick: () => editarCartao(q, col, c, ctx),
    onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); editarCartao(q, col, c, ctx); } },
    ondragstart: (e) => {
      arrastando = { coluna: col.titulo, id: c.id, el };
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', c.texto); } catch { /* ok */ }
      requestAnimationFrame(() => el.classList.add('arrastando'));
    },
    ondragend: () => {
      el.classList.remove('arrastando');
      document.querySelectorAll('.soltar-aqui').forEach((x) => x.remove());
      document.querySelectorAll('.cartoes.sobre').forEach((x) => x.classList.remove('sobre'));
      arrastando = null;
    },
  },
  h('div', { class: 't' }, c.texto),
  c.data || (c.areas && c.areas.length)
    ? h('div', { class: 'meta' },
      c.data ? h('span', { class: `chip${c.data < hj ? ' rosa' : ''}` }, ic('relogio'), dataCurta(c.data)) : null,
      (c.areas || []).map((a) => h('span', { class: 'chip' }, a)))
    : null,
  c.notas && c.notas.length ? h('div', { class: 'notas' }, c.notas.length === 1 ? c.notas[0] : `${c.notas.length} notas`) : null);
  return el;
}

function posicaoDoMouse(container, y) {
  const cards = [...container.querySelectorAll('.cartao:not(.arrastando)')];
  for (let i = 0; i < cards.length; i++) {
    const r = cards[i].getBoundingClientRect();
    if (y < r.top + r.height / 2) return { indice: i, antes: cards[i] };
  }
  return { indice: cards.length, antes: null };
}

function coluna(q, col, ctx) {
  const lista = h('div', { class: 'cartoes', 'data-coluna': col.titulo }, col.cartoes.map((c) => cartao(q, col, c, ctx)));
  const marcador = h('div', { class: 'soltar-aqui' });

  lista.addEventListener('dragover', (e) => {
    if (!arrastando) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    lista.classList.add('sobre');
    const { antes } = posicaoDoMouse(lista, e.clientY);
    if (antes) lista.insertBefore(marcador, antes);
    else lista.append(marcador);
  });
  lista.addEventListener('dragleave', (e) => {
    if (!lista.contains(e.relatedTarget)) { lista.classList.remove('sobre'); marcador.remove(); }
  });
  lista.addEventListener('drop', async (e) => {
    if (!arrastando) return;
    e.preventDefault();
    const { indice } = posicaoDoMouse(lista, e.clientY);
    const de = arrastando;
    marcador.remove();
    lista.classList.remove('sobre');
    await agir({ acao: 'mover', arquivo: q.arquivo, coluna: de.coluna, id: de.id, para: col.titulo, posicao: indice }, ctx);
  });

  const novo = h('input', { class: 'entrada', type: 'text', placeholder: 'Novo cartão', 'aria-label': `Novo cartão em ${col.titulo}` });
  const form = h('form', {
    class: 'adicionar-cartao',
    onsubmit: async (e) => {
      e.preventDefault();
      if (!novo.value.trim()) return;
      await agir({ acao: 'adicionar', arquivo: q.arquivo, coluna: col.titulo, texto: novo.value }, ctx);
    },
  }, novo);

  const renomear = async () => {
    const nome = await pedirTexto({ titulo: 'Renomear coluna', valor: col.titulo });
    if (nome && nome !== col.titulo) await agir({ acao: 'coluna-renomear', arquivo: q.arquivo, coluna: col.titulo, nome }, ctx, 'Coluna renomeada.');
  };

  return h('section', { class: 'coluna vidro', 'aria-label': col.titulo },
    h('div', { class: 'coluna-cabeca' },
      h('h3', { ondblclick: renomear, title: 'Dois cliques pra renomear' }, col.titulo),
      h('span', { class: 'n' }, String(col.cartoes.length)),
      h('button', { type: 'button', class: 'icone-botao', title: 'Renomear', 'aria-label': `Renomear ${col.titulo}`, onclick: renomear }, ic('lapis')),
      col.cartoes.length ? null : h('button', {
        type: 'button',
        class: 'icone-botao',
        title: 'Apagar coluna',
        'aria-label': `Apagar a coluna ${col.titulo}`,
        onclick: async () => {
          if (await confirmar(`Apagar a coluna "${col.titulo}"?`, { sim: 'Apagar' })) await agir({ acao: 'coluna-apagar', arquivo: q.arquivo, coluna: col.titulo }, ctx, 'Coluna apagada.');
        },
      }, ic('lixo'))),
    lista,
    form);
}

export async function montar(alvo, ctx) {
  const { quadros } = await api('/api/kanban');
  const pedido = ctx.rota.params.get('q');
  const atual = quadros.find((x) => x.arquivo === pedido) || quadros.find((x) => x.arquivo === escolha.quadro) || quadros[0];

  const novoQuadro = h('button', {
    type: 'button',
    class: 'botao',
    onclick: async () => {
      const nome = await pedirTexto({ titulo: 'Novo quadro', rotulo: 'Nome do quadro', dica: 'Ex.: Lançamento de dezembro', confirmar: 'Criar' });
      if (!nome) return;
      try {
        const r = await api('/api/kanban', { acao: 'novo-quadro', nome });
        escolha.quadro = r.criado;
        aviso('Quadro criado.');
      } catch (e) { falhou(e); }
      ctx.recarregar({ silencioso: true });
    },
  }, ic('mais'), 'Novo quadro');

  alvo.append(cabeca({
    titulo: 'Kanban',
    texto: atual && atual.descricao ? atual.descricao : 'Arraste os cartões de uma coluna pra outra. A IA também move quando você conta que algo andou.',
    acoes: [novoQuadro],
  }));

  if (!atual) {
    alvo.append(vazio({ titulo: 'Nenhum quadro ainda', texto: 'Crie um quadro no botão acima, ou peça pra IA.', pedido: 'Crie um quadro de kanban pra organizar o meu trabalho.' }));
    return { titulo: 'Kanban' };
  }

  alvo.append(h('div', { class: 'abas', role: 'tablist', 'aria-label': 'Quadros' }, quadros.map((x) => {
    const n = x.colunas.reduce((s, c) => s + c.cartoes.length, 0);
    return h('button', {
      type: 'button',
      class: 'aba',
      role: 'tab',
      'aria-selected': String(x.arquivo === atual.arquivo),
      onclick: () => { escolha.quadro = x.arquivo; ctx.navegar('#/kanban'); },
    }, x.titulo, h('span', { class: 'n' }, String(n)));
  }), h('button', {
    type: 'button',
    class: 'botao leve pequeno',
    title: 'Copiar pedido pra IA',
    onclick: () => copiar(`Olhe o quadro "${atual.titulo}" (${atual.arquivo}) e me diga o que está parado, o que está atrasado e o que eu faço primeiro.`),
  }, ic('ia'), 'Pedir análise pra IA')));

  alvo.append(h('div', { class: 'quadro' },
    atual.colunas.map((col) => coluna(atual, col, ctx)),
    h('div', { class: 'coluna-nova' }, h('button', {
      type: 'button',
      class: 'botao',
      style: 'width:100%',
      onclick: async () => {
        const nome = await pedirTexto({ titulo: 'Nova coluna', rotulo: 'Nome da coluna', dica: 'Ex.: Esperando resposta', confirmar: 'Criar' });
        if (nome) await agir({ acao: 'coluna-adicionar', arquivo: atual.arquivo, nome }, ctx, 'Coluna criada.');
      },
    }, ic('mais'), 'Nova coluna'))));

  alvo.append(h('p', { class: 'fraco pequeno' }, `Este quadro fica em ${atual.arquivo}.`));

  return {
    titulo: 'Kanban',
    podeRecarregar: () => {
      if (arrastando) return false;
      const foco = document.activeElement;
      return !(foco && foco.closest && foco.closest('#tela') && foco.tagName === 'INPUT' && foco.value);
    },
  };
}
