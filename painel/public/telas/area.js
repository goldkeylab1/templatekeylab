// Página de uma área (Meu negócio, Marketing, Projetos e as que você criar).
// Mostra os arquivos da pasta, as subpastas, os pedidos prontos e os destaques do topo.
import { h, ic, api, cabeca, markdown, miniAnel, pedido, vazio, quandoFoi, temChat } from '../ui.js';

function temConteudo(texto) {
  return String(texto || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split(/\r?\n/)
    .some((l) => l.trim() && !/^\s*#{1,6}\s/.test(l) && !/^\s*>/.test(l));
}

export function semCabecalho(texto) {
  // tira o "# Título" e a primeira citação (já aparecem no topo da tela), mantendo a numeração das linhas
  const linhas = String(texto || '').split(/\r?\n/);
  let i = 0;
  let viuTitulo = false;
  while (i < linhas.length) {
    const l = linhas[i];
    if (!viuTitulo && /^#\s/.test(l)) { linhas[i] = ''; viuTitulo = true; i++; continue; }
    if (viuTitulo && /^\s*>/.test(l)) {
      while (i < linhas.length && /^\s*>/.test(linhas[i])) {
        if (!/^\s*>\s*pra ia\b/i.test(linhas[i].normalize('NFD').replace(/[̀-ͯ]/g, ''))) linhas[i] = '';
        i++;
      }
      break;
    }
    if (viuTitulo && l.trim()) break;
    i++;
  }
  return linhas.join('\n');
}

// Tira os títulos que não têm nada embaixo (pra o destaque não virar uma lista de títulos vazios)
function semTitulosVazios(texto) {
  const linhas = String(texto || '').replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/);
  const nivel = (l) => { const m = /^(#{1,6})\s/.exec(l); return m ? m[1].length : 0; };
  const conteudo = (l) => l.trim() && !nivel(l) && !/^\s*>/.test(l);
  return linhas.filter((l, i) => {
    const n = nivel(l);
    if (!n) return true;
    for (let j = i + 1; j < linhas.length; j++) {
      const m = nivel(linhas[j]);
      if (m && m <= n) return false;
      if (conteudo(linhas[j])) return true;
    }
    return false;
  }).join('\n');
}

function iconeDoArquivo(f) {
  if (f.tipo === 'configurar' || f.tipo === 'formulario') return miniAnel(f.pct);
  const nome = { kanban: 'colunas', dados: 'tabela', molde: 'copiar', texto: 'texto' }[f.tipo] || 'texto';
  return h('span', { class: 'ico-arq' }, ic(nome));
}

function descricaoDoArquivo(f) {
  if (f.tipo === 'configurar' || f.tipo === 'formulario') {
    if (f.pct >= 100) return 'Pronto';
    const faltam = f.total - f.feitos;
    return `${faltam} ${faltam === 1 ? 'resposta falta' : 'respostas faltam'}`;
  }
  if (f.tipo === 'kanban') return 'Quadro do kanban';
  if (f.tipo === 'molde') return 'Molde (a IA copia pra criar um novo)';
  return f.descricao || (f.atualizado ? `Mudou ${quandoFoi(f.atualizado)}` : '');
}

// Áreas que têm uma tela só delas (no lugar da página padrão)
const TELAS_PROPRIAS = {
  mentalidade: () => import('./mentalidade.js'),
};

// Telas especiais que uma área pode mostrar no topo ("- **Telas (opcional):** testes, numeros" no LEIA-ME)
const TELAS_EXTRAS = {
  testes: { nome: 'Testes', icone: 'alvo', href: '#/testes', texto: 'Os testes rodando e o que virou regra' },
  numeros: { nome: 'Números', icone: 'grafico', href: '#/numeros', texto: 'O gráfico dos seus números' },
  saidas: { nome: 'Saídas', icone: 'bandeja', href: '#/saidas', texto: 'O que a IA criou, pronto pra copiar' },
  ferramentas: { nome: 'Ferramentas', icone: 'ferramenta', href: '#/ferramentas', texto: 'Baixar e transcrever vídeos' },
};

function atalhos(telas) {
  const lista = (telas || []).map((t) => TELAS_EXTRAS[t]).filter(Boolean);
  if (!lista.length) return null;
  return h('div', { class: 'grade-cartoes atalhos' }, lista.map((t) => h('a', { class: 'arquivo-item atalho vidro', href: t.href },
    h('span', { class: 'ico-arq' }, ic(t.icone)),
    h('span', { class: 'corpo' }, h('span', { class: 't', style: 'display:block' }, t.nome), h('span', { class: 'd', style: 'display:block' }, t.texto)),
    h('span', { class: 'fraco' }, ic('seta')))));
}

export function itemDeArquivo(f) {
  const href = f.tipo === 'kanban' ? `#/kanban?q=${encodeURIComponent(f.caminho)}` : `#/arquivo?c=${encodeURIComponent(f.caminho)}`;
  return h('a', { class: 'arquivo-item', href },
    iconeDoArquivo(f),
    h('span', { class: 'corpo' }, h('span', { class: 't', style: 'display:block' }, f.titulo), h('span', { class: 'd', style: 'display:block' }, descricaoDoArquivo(f))),
    h('span', { class: 'fraco' }, ic('seta')));
}

function destaque(t) {
  const texto = semTitulosVazios(semCabecalho(t.texto));
  const corpo = temConteudo(texto)
    ? h('div', { class: 'doc', html: markdown(texto, { base: t.caminho.split('/').slice(0, -1).join('/') }) })
    : h('p', { class: 'fraco', style: 'margin:0' }, 'Ainda vazio. A IA preenche aqui quando os seus números provarem alguma coisa.');
  corpo.querySelectorAll('input[type=checkbox]').forEach((c) => { c.disabled = true; });
  return h('section', { class: 'painel vidro' },
    h('div', { class: 'painel-cabeca' }, h('h2', null, t.titulo), h('a', { class: 'botao leve pequeno', href: `#/arquivo?c=${encodeURIComponent(t.caminho)}` }, 'Abrir')),
    corpo);
}

export async function montar(alvo, ctx) {
  const id = ctx.rota.resto[0];
  const a = await api(`/api/area?id=${encodeURIComponent(id || '')}`);
  // Área com tela própria ("Tela própria (opcional)" no LEIA-ME)
  if (TELAS_PROPRIAS[a.telaPropria]) {
    const mod = await TELAS_PROPRIAS[a.telaPropria]();
    return mod.montar(alvo, ctx, a);
  }

  alvo.append(cabeca({
    titulo: a.titulo || a.nome,
    texto: a.descricao,
    acoes: [h('a', { class: 'botao', href: `#/arquivo?c=${encodeURIComponent(a.leiame)}` }, ic('texto'), 'Como funciona')],
  }));

  const barraDeAtalhos = atalhos(a.telas);
  if (barraDeAtalhos) alvo.append(barraDeAtalhos);

  const esquerda = h('div', { class: 'pilha' });
  const direita = h('div', { class: 'pilha' });

  for (const t of a.topo) esquerda.append(destaque(t));

  if (a.arquivos.length) {
    esquerda.append(h('section', { class: 'painel vidro' },
      h('div', { class: 'painel-cabeca' }, h('h2', null, 'Arquivos')),
      h('div', { class: 'grade-cartoes' }, a.arquivos.map(itemDeArquivo))));
  }

  for (const g of a.grupos) {
    esquerda.append(h('section', { class: 'painel vidro' },
      h('div', { class: 'painel-cabeca' }, h('div', null, h('h2', null, g.titulo), g.descricao ? h('p', { class: 'suave pequeno', style: 'margin:4px 0 0' }, g.descricao) : null)),
      g.arquivos.length
        ? h('div', { class: 'grade-cartoes' }, g.arquivos.map(itemDeArquivo))
        : h('p', { class: 'fraco pequeno', style: 'margin:0' }, 'Nada aqui ainda.')));
  }

  if (!a.arquivos.length && !a.grupos.length && !a.topo.length) {
    esquerda.append(vazio({
      titulo: 'Nada aqui ainda',
      texto: 'Peça pra IA criar o primeiro item desta área.',
      pedido: a.pedidos[0] || `Crie o primeiro item da área "${a.nome}" (pasta ${a.pasta}/).`,
    }));
  }

  if (a.pedidos.length) {
    direita.append(h('section', { class: 'painel vidro' },
      h('h2', null, 'Peça pra IA'),
      h('p', { class: 'suave pequeno', style: 'margin:6px 0 12px' }, temChat() ? 'Clique e a IA faz, no chat do lado (se terminar em dois-pontos, você completa antes).' : 'Clique pra copiar. Depois é só colar na sua IA (e completar, se terminar em dois-pontos).'),
      h('div', { class: 'pedidos' }, a.pedidos.map((p) => pedido(p)))));
  }

  if (a.tambem && a.tambem.length) {
    direita.append(h('section', { class: 'painel vidro' },
      h('h2', null, 'O que a IA anotou'),
      h('p', { class: 'suave pequeno', style: 'margin:6px 0 12px' }, 'A IA atualiza esses arquivos sozinha enquanto vocês conversam.'),
      h('div', { class: 'pedidos' }, a.tambem.map(itemDeArquivo))));
  }

  alvo.append(direita.childNodes.length ? h('div', { class: 'grade-2' }, esquerda, direita) : esquerda);
  return { titulo: a.nome };
}
