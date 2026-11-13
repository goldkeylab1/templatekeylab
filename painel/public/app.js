// O painel: menu do lado, rotas (#/tela), tema, cor da marca e atualização ao vivo.
// Cada tela fica em telas/<nome>.js e exporta montar(alvo, ctx).
import { h, ic, api, aviso, falhou } from './ui.js';

const TELAS = {
  comece: () => import('./telas/comece.js'),
  dashboard: () => import('./telas/dashboard.js'),
  kanban: () => import('./telas/kanban.js'),
  area: () => import('./telas/area.js'),
  arquivo: () => import('./telas/arquivo.js'),
  feedbacks: () => import('./telas/feedbacks.js'),
  ideias: () => import('./telas/ideias.js'),
  ferramentas: () => import('./telas/ferramentas.js'),
  ajuda: () => import('./telas/ajuda.js'),
  ajustes: () => import('./telas/ajustes.js'),
};

const estado = { inicio: null, controle: {}, versao: 0, rotaAnterior: '' };

// ---------- tema ----------

export function lerTema() {
  try { return localStorage.getItem('keylab-tema') || 'auto'; } catch { return 'auto'; }
}

export function trocarTema(t) {
  try { localStorage.setItem('keylab-tema', t); } catch { /* sem guardar */ }
  const raiz = document.documentElement;
  if (t === 'claro') raiz.setAttribute('data-theme', 'light');
  else if (t === 'escuro') raiz.setAttribute('data-theme', 'dark');
  else raiz.removeAttribute('data-theme');
  document.querySelectorAll('[data-tema]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tema === t)));
}

// ---------- cor da marca ----------

function hexParaRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function luz([r, g, b]) {
  const f = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contraste(a, b) {
  const la = luz(a);
  const lb = luz(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function misturar(c, alvo, t) { return c.map((v, i) => Math.round(v + (alvo[i] - v) * t)); }
function comContraste(cor, fundo, alvo) {
  let c = cor;
  for (let t = 0.05; t <= 1 && contraste(c, fundo) < 4.5; t += 0.05) c = misturar(cor, alvo, t);
  return c;
}
function paraHex(c) { return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`; }
function tinta(c) { return contraste(c, [255, 255, 255]) >= contraste(c, [0, 0, 0]) ? '#ffffff' : '#000000'; }

export function aplicarMarca(marca) {
  const s = document.documentElement.style;
  ['claro', 'escuro'].forEach((t) => ['', '-rgb', '-tinta'].forEach((x) => s.removeProperty(`--marca-${t}${x}`)));
  const base = marca && marca.usarCores ? hexParaRgb(marca.cor) : null;
  const ico = document.getElementById('favicon');
  if (marca && marca.logo && ico) ico.href = `/api/logo?v=${marca.logo.versao}`;
  if (!base) { guardarMarca(''); return; }
  const claro = comContraste(base, [255, 255, 255], [0, 0, 0]);
  const escuro = comContraste(base, [0, 0, 0], [255, 255, 255]);
  s.setProperty('--marca-claro', paraHex(claro));
  s.setProperty('--marca-claro-rgb', claro.join(', '));
  s.setProperty('--marca-claro-tinta', tinta(claro));
  s.setProperty('--marca-escuro', paraHex(escuro));
  s.setProperty('--marca-escuro-rgb', escuro.join(', '));
  s.setProperty('--marca-escuro-tinta', tinta(escuro));
  guardarMarca(s.cssText);
}

// Guarda as cores no navegador, pra página já abrir com a cor certa (sem piscar o rosa)
function guardarMarca(css) {
  try { if (css) localStorage.setItem('keylab-marca', css); else localStorage.removeItem('keylab-marca'); } catch { /* sem guardar */ }
}

// ---------- rotas ----------

function rota() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [caminho, query = ''] = hash.split('?');
  const partes = caminho.split('/').filter(Boolean).map(decodeURIComponent);
  return { nome: partes[0] || '', resto: partes.slice(1), params: new URLSearchParams(query), hash };
}

export function navegar(href) {
  if (location.hash === href) mostrar();
  else location.hash = href;
}

// ---------- menu ----------

function itensDoMenu(inicio) {
  const pct = inicio.status.pct;
  const itens = [
    { id: 'comece', nome: 'Comece aqui', icone: 'foguete', href: '#/comece', ordem: 10, selo: pct < 100 ? `${pct}%` : null },
    { id: 'dashboard', nome: 'Dashboard', icone: 'calendario', href: '#/dashboard', ordem: 20 },
    { id: 'kanban', nome: 'Kanban', icone: 'colunas', href: '#/kanban', ordem: 30 },
    { id: 'ferramentas', nome: 'Ferramentas', icone: 'ferramenta', href: '#/ferramentas', ordem: 60 },
    { id: 'feedbacks', nome: 'Feedbacks', icone: 'conversa', href: '#/feedbacks', ordem: 90 },
    { id: 'ideias', nome: 'Ideias', icone: 'lampada', href: '#/ideias', ordem: 100 },
    ...inicio.areas.map((a) => ({ id: `area:${a.id}`, nome: a.nome, icone: a.icone, href: `#/area/${encodeURIComponent(a.id)}`, ordem: a.ordem })),
  ].sort((a, b) => a.ordem - b.ordem);
  return {
    principais: itens,
    rodape: [
      { id: 'ajuda', nome: 'Ajuda', icone: 'ajuda', href: '#/ajuda' },
      { id: 'ajustes', nome: 'Ajustes', icone: 'ajustes', href: '#/ajustes' },
    ],
  };
}

function idAtivo(r) {
  if (r.nome === 'area') return `area:${r.resto[0]}`;
  if (r.nome === 'arquivo') {
    const c = r.params.get('c') || '';
    const pasta = c.split('/')[0];
    const area = (estado.inicio?.areas || []).find((a) => a.id === pasta);
    if (area) return `area:${area.id}`;
    if (pasta === 'memoria') return 'area:negocio';
    return '';
  }
  return r.nome || (estado.inicio && estado.inicio.status.pct < 60 ? 'comece' : 'dashboard');
}

function marcaDoMenu(inicio) {
  const m = inicio.marca;
  const simbolo = h('span', { class: 'marca-simbolo' });
  if (m.logo) simbolo.append(h('img', { src: `/api/logo?v=${m.logo.versao}`, alt: '' }));
  else simbolo.append(ic('chave'));
  return h('a', { class: 'marca', href: '#/dashboard', 'aria-label': 'Ir pro Dashboard' },
    simbolo,
    h('span', { style: 'min-width:0' },
      h('span', { class: 'marca-nome' }, m.nome || 'Seu negócio'),
      h('span', { class: 'marca-sub' }, m.nome ? 'Painel do negócio' : 'Configure em Comece aqui')));
}

function linkDoMenu(item) {
  return h('a', { href: item.href, 'data-id': item.id },
    h('span', { class: 'ico-menu' }, ic(item.icone)),
    h('span', null, item.nome),
    item.selo ? h('span', { class: 'selo', 'aria-label': `${item.selo} configurado` }, item.selo) : null);
}

function seletorDeTema() {
  const atual = lerTema();
  const opcoes = [['claro', 'sol', 'Tema claro'], ['auto', 'auto', 'Igual ao computador'], ['escuro', 'lua', 'Tema escuro']];
  return h('div', { class: 'segmentado', role: 'group', 'aria-label': 'Tema', style: 'align-self:flex-start' },
    opcoes.map(([t, i, nome]) => h('button', { type: 'button', 'data-tema': t, 'aria-pressed': String(atual === t), title: nome, 'aria-label': nome, onclick: () => trocarTema(t) }, ic(i))));
}

function salvoNoGitHub(git) {
  let classe = 'salvo';
  if (git.ligado && !git.mudancas) classe += ' ok';
  else classe += ' atencao';
  return h('a', { class: classe, href: '#/ajustes', title: 'GitHub' }, h('span', { class: 'ponto' }), h('span', null, git.resumo || 'GitHub'));
}

function desenharLateral() {
  const inicio = estado.inicio;
  const { principais, rodape } = itensDoMenu(inicio);
  const lateral = document.querySelector('.lateral');
  const vidro = h('div', { class: 'lateral-vidro vidro' },
    marcaDoMenu(inicio),
    h('nav', { class: 'menu', 'aria-label': 'Menu' },
      principais.map(linkDoMenu),
      h('div', { class: 'menu-separa', role: 'separator' }),
      rodape.map(linkDoMenu)),
    h('div', { class: 'lateral-rodape' }, salvoNoGitHub(inicio.git), seletorDeTema()));
  lateral.replaceChildren(vidro);
  document.querySelector('.topo-movel').replaceChildren(
    marcaDoMenu(inicio),
    h('button', { type: 'button', class: 'icone-botao', 'aria-label': 'Abrir o menu', onclick: () => lateral.classList.add('aberta') }, ic('menu')));
  marcarMenu();
}

function marcarMenu() {
  const ativo = idAtivo(rota());
  document.querySelectorAll('.menu a').forEach((a) => {
    if (a.dataset.id === ativo) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

// ---------- telas ----------

async function atualizarInicio() {
  estado.inicio = await api('/api/inicio');
  aplicarMarca(estado.inicio.marca);
  desenharLateral();
  return estado.inicio;
}

function telaDeErro(e) {
  return h('div', { class: 'painel vidro' },
    h('h2', null, 'Não consegui abrir essa tela'),
    h('p', { class: 'suave' }, e.message || String(e)),
    h('a', { class: 'botao', href: '#/dashboard' }, 'Voltar pro Dashboard'));
}

async function mostrar({ silencioso = false } = {}) {
  const r = rota();
  const nome = r.nome || (estado.inicio && estado.inicio.status.pct < 60 ? 'comece' : 'dashboard');
  const carregar = TELAS[nome];
  marcarMenu();
  const alvo = document.getElementById('tela');
  const versao = ++estado.versao;
  const rolagem = window.scrollY;
  if (!carregar) { alvo.replaceChildren(telaDeErro(new Error('Essa tela não existe.'))); return; }
  try {
    const mod = await carregar();
    const novo = h('div');
    const controle = await mod.montar(novo, { rota: r, inicio: estado.inicio, recarregar, atualizarInicio, navegar });
    if (versao !== estado.versao) return;
    alvo.replaceChildren(...novo.childNodes);
    estado.controle = controle || {};
    if (estado.controle.depois) estado.controle.depois();
    const nomeMarca = estado.inicio?.marca?.nome;
    const titulo = estado.controle.titulo || alvo.querySelector('h1')?.textContent || 'Painel';
    document.title = nomeMarca ? `${titulo} | ${nomeMarca}` : titulo;
    if (silencioso || r.hash === estado.rotaAnterior) window.scrollTo(0, rolagem);
    else window.scrollTo(0, 0);
    estado.rotaAnterior = r.hash;
  } catch (e) {
    if (versao !== estado.versao) return;
    alvo.replaceChildren(telaDeErro(e));
  }
}

let pendente = false;

export async function recarregar({ silencioso = false } = {}) {
  try { await atualizarInicio(); } catch { /* segue */ }
  if (estado.controle.podeRecarregar && !estado.controle.podeRecarregar()) {
    if (!pendente) {
      pendente = true;
      aviso('Um arquivo mudou (talvez a IA). Salve o que está editando e recarregue.', { acao: { texto: 'Recarregar', fazer: () => { pendente = false; mostrar({ silencioso: true }); } }, tempo: 8000 });
      setTimeout(() => { pendente = false; }, 8000);
    }
    return;
  }
  await mostrar({ silencioso });
}

// ---------- ao vivo ----------

function ouvirMudancas() {
  if (!('EventSource' in window)) return;
  const fonte = new EventSource('/api/eventos');
  let relogio = null;
  fonte.addEventListener('mudou', (e) => {
    let d = {};
    try { d = JSON.parse(e.data); } catch { /* sem dados */ }
    if (d.recarregarPagina) { location.reload(); return; }
    // mudança feita pelo próprio painel: a tela já foi atualizada
    if (Date.now() - (window.__ultimaEscrita || 0) < 1500) return;
    clearTimeout(relogio);
    relogio = setTimeout(() => recarregar({ silencioso: true }), 200);
  });
  // O "npm run baixar" (pelo terminal) traz as abas pra tela Ferramentas: é lá que saem as fotos e a transcrição
  fonte.addEventListener('ferramentas', () => { if (!location.hash.startsWith('#/ferramentas')) navegar('#/ferramentas'); });
}

// ---------- começo ----------

async function iniciar() {
  const app = document.getElementById('app');
  app.replaceChildren(
    h('div', { class: 'app' },
      h('aside', { class: 'lateral' }),
      h('div', { style: 'min-width:0' },
        h('div', { class: 'topo-movel vidro' }),
        h('main', { class: 'area-principal', id: 'tela', tabindex: '-1' }))));
  const lateral = document.querySelector('.lateral');
  lateral.addEventListener('click', (e) => {
    if (e.target === lateral || e.target.closest('a')) lateral.classList.remove('aberta');
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') lateral.classList.remove('aberta'); });
  try {
    await atualizarInicio();
  } catch (e) {
    document.getElementById('tela').replaceChildren(telaDeErro(e));
    return;
  }
  window.addEventListener('hashchange', () => mostrar());
  await mostrar();
  ouvirMudancas();
}

window.addEventListener('unhandledrejection', (e) => falhou(e.reason || new Error('Algo deu errado.')));
iniciar();
