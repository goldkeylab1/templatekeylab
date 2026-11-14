// O chat com a IA, numa aba do lado do painel.
// O painel chama a IA que o dono já tem no computador (Claude Code, Codex ou Gemini). Ela trabalha nesta pasta:
// quando muda um arquivo, a tela do painel se atualiza sozinha.
import { h, ic, api, aviso, falhou, markdown, confirmar, pedirTexto } from './ui.js';

const ABERTO = 'keylab-chat-aberto';
const SUGESTOES = [
  'O que eu faço hoje?',
  'Me dá 5 temas pro próximo conteúdo, com nota e o porquê.',
  'Revisa tudo: o que está velho ou esquecido?',
];

const estado = {
  dados: null, // { provedores, escolhido, mensagens, rodando }
  aberto: false,
  atual: null, // resposta chegando agora
  carregando: false,
};

let el = {};
let desenhoPendente = false;

function lerAberto() { try { return localStorage.getItem(ABERTO) === '1'; } catch { return false; } }
function guardarAberto(v) { try { localStorage.setItem(ABERTO, v ? '1' : '0'); } catch { /* sem guardar */ } }

function provedorAtual() {
  const d = estado.dados;
  return d && d.provedores.find((p) => p.id === d.escolhido);
}

function disponivel() {
  return !!provedorAtual();
}

// "claude-opus-4-6" → "Opus 4.6"; "claude-haiku-4-5-20251001" → "Haiku 4.5"; "opus" → "Opus"
function nomeDoModelo(m) {
  const s = String(m || '');
  if (s.startsWith('<')) return ''; // "<synthetic>": mensagem do próprio Claude Code, não de um modelo
  const c = /^claude-([a-z]+)-(\d{1,2})(?:-(\d{1,2}))?(?!\d)/i.exec(s);
  if (c) return `${c[1].charAt(0).toUpperCase()}${c[1].slice(1)} ${c[2]}${c[3] ? `.${c[3]}` : ''}`;
  return /^[a-z]+$/.test(s) ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// O que o dono está vendo agora (vai junto da mensagem, pra IA entender "esse teste", "essa tarefa")
function contexto() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [rota, q = ''] = hash.split('?');
  const tela = (document.title || '').split('|')[0].trim();
  const arquivo = rota.startsWith('arquivo') ? new URLSearchParams(q).get('c') : null;
  return `o dono está na tela "${tela || rota || 'Dashboard'}" do painel${arquivo ? `, vendo o arquivo ${arquivo}` : ''}.`;
}

// ---------- desenho ----------

function bolha(m) {
  if (m.papel === 'eu') {
    return h('div', { class: 'msg eu' }, h('div', { class: 'balao' }, m.texto));
  }
  const ehAtual = estado.atual && estado.atual.id === m.id;
  const corpo = h('div', { class: 'balao doc' });
  if (m.texto) corpo.innerHTML = markdown(m.texto);
  else if (ehAtual) corpo.append(h('span', { class: 'pensando' }, h('i'), h('i'), h('i'), h('span', { class: 'fraco pequeno' }, 'Pensando...')));
  else corpo.append(h('span', { class: 'fraco pequeno' }, 'Sem resposta.'));
  corpo.querySelectorAll('input[type=checkbox]').forEach((c) => { c.disabled = true; });
  const passos = m.ferramentas && m.ferramentas.length
    ? h('details', { class: 'passos-ia', open: ehAtual ? true : null },
      h('summary', null, ic('ferramenta'), `${m.ferramentas.length} ${m.ferramentas.length === 1 ? 'passo' : 'passos'}`),
      h('ul', null, m.ferramentas.slice(-30).map((f) => h('li', null, f))))
    : null;
  const rodape = [m.duracao ? `${Math.max(1, Math.round(m.duracao / 1000))} s` : '', nomeDoModelo(m.modeloUsado || m.modelo), m.esforco ? `esforço ${nomeDoEsforco(m.esforco).toLowerCase()}` : ''].filter(Boolean).join(' · ');
  return h('div', { class: `msg ia${m.erro ? ' erro' : ''}`, 'data-id': m.id || '' }, passos, corpo,
    !ehAtual && rodape ? h('div', { class: 'fraco pequeno quando', title: m.modeloUsado || '' }, rodape) : null);
}

function vazio() {
  const p = provedorAtual();
  return h('div', { class: 'chat-vazio' },
    h('span', { class: 'chat-vazio-ico' }, ic('ia')),
    h('h3', null, 'Converse com a sua IA'),
    h('p', null, `É o ${p ? p.nome : 'sua IA'} do seu computador, com a sua conta. Ela lê e muda os arquivos do negócio, e o painel se atualiza na hora.`),
    h('div', { class: 'pedidos' }, SUGESTOES.map((s) => h('button', { type: 'button', class: 'pedido', onclick: () => mandar(s) }, ic('ia'), h('span', null, s)))));
}

function semIA() {
  const d = estado.dados;
  return h('div', { class: 'chat-vazio' },
    h('span', { class: 'chat-vazio-ico' }, ic('ia')),
    h('h3', null, 'Nenhuma IA instalada'),
    h('p', null, 'O chat usa a IA que você instala no computador, com a sua conta. Instale uma, entre na sua conta pelo terminal e volte aqui.'),
    h('div', { class: 'pedidos' }, (d ? d.provedores : []).map((p) => h('a', { class: 'pedido', href: p.site, target: '_blank', rel: 'noopener' },
      ic('link'), h('span', null, `Instalar o ${p.nome}${p.id === 'claude' ? ' (recomendado)' : ''}`)))),
    h('button', { type: 'button', class: 'botao pequeno', style: 'margin-top:12px', onclick: () => carregar({ procurar: true }) }, ic('recarregar'), 'Já instalei: procurar de novo'));
}

function desenharMensagens({ rolar = false } = {}) {
  if (!el.lista) return;
  const perto = el.lista.scrollHeight - el.lista.scrollTop - el.lista.clientHeight < 80;
  const d = estado.dados;
  if (!d) el.lista.replaceChildren(h('p', { class: 'fraco pequeno', style: 'padding:16px' }, 'Carregando...'));
  else if (!disponivel()) el.lista.replaceChildren(semIA());
  else if (!d.mensagens.length) el.lista.replaceChildren(vazio());
  else el.lista.replaceChildren(...d.mensagens.map(bolha));
  if (rolar || perto) el.lista.scrollTop = el.lista.scrollHeight;
}

function redesenharDepois() {
  if (desenhoPendente) return;
  desenhoPendente = true;
  requestAnimationFrame(() => { desenhoPendente = false; desenharMensagens(); });
}

function desenharControles() {
  if (!el.caixa) return;
  const d = estado.dados;
  const rodando = !!(d && d.rodando);
  const pode = disponivel();
  el.entrada.disabled = !pode;
  el.entrada.placeholder = pode ? 'Escreva pra IA...' : 'Instale uma IA pra conversar';
  el.enviar.hidden = rodando;
  el.parar.hidden = !rodando;
  el.enviar.disabled = !pode;
  const instalados = d ? d.provedores.filter((p) => p.instalado) : [];
  el.ia.replaceChildren();
  if (instalados.length > 1) {
    el.ia.append(h('select', {
      class: 'entrada',
      'aria-label': 'Qual IA',
      onchange: async (e) => {
        try { estado.dados = await api('/api/chat/ia', { id: e.target.value }); desenharTudo(); } catch (err) { falhou(err); }
      },
    }, instalados.map((p) => h('option', { value: p.id, selected: p.id === d.escolhido }, p.nome))));
  } else if (instalados.length === 1) {
    el.ia.append(h('span', { class: 'chip', title: instalados[0].versao ? `Versão ${instalados[0].versao}` : '' }, h('span', { class: 'ponto-ia' }), instalados[0].nome));
  }
  desenharModelo(rodando);
  const p = provedorAtual();
  el.nota.textContent = p && !p.completo ? `${p.nome} em modo simples: a resposta aparece inteira no fim.` : 'Enter manda. Shift+Enter pula linha.';
}

// Modelo e esforço (o quanto a IA pensa). "Padrão" não manda nada: vale o que a pessoa usa na IA dela.
function nomeDoEsforco(id) {
  const e = (estado.dados && estado.dados.esforcos || []).find((x) => x.id === id);
  return e ? e.nome : '';
}

async function trocar(rota, dados, msg) {
  try {
    estado.dados = await api(rota, dados);
    if (msg) aviso(msg(estado.dados));
  } catch (err) { falhou(err); }
  desenharTudo();
}

function seletorDeModelo(d, rodando) {
  const lista = [...(d.modelos || [])];
  if (d.modelo && !lista.some((m) => m.id === d.modelo)) lista.push({ id: d.modelo, nome: d.modelo, dica: 'escolhido por você', grupo: 'Outro' });
  const opcao = (m) => h('option', { value: m.id, selected: m.id === (d.modelo || '') }, m.dica ? `${m.nome} · ${m.dica}` : m.nome);
  const grupos = [];
  for (const m of lista) {
    const g = m.grupo || '';
    let alvo = grupos.find((x) => x.nome === g);
    if (!alvo) { alvo = { nome: g, itens: [] }; grupos.push(alvo); }
    alvo.itens.push(m);
  }
  return h('select', {
    class: 'entrada',
    id: 'chat-modelo',
    disabled: rodando ? true : null,
    title: rodando ? 'Espere a IA terminar pra trocar' : 'Qual modelo responde as próximas mensagens',
    onchange: async (e) => {
      let valor = e.target.value;
      if (valor === '__outro') {
        valor = await pedirTexto({ titulo: 'Outro modelo', rotulo: 'Nome do modelo', dica: 'Ex.: o nome completo de um modelo novo', valor: d.modelo || '', confirmar: 'Usar' });
        if (valor == null) { desenharTudo(); return; }
      }
      trocar('/api/chat/modelo', { modelo: valor }, (n) => {
        const atual = (n.modelos || []).find((m) => m.id === n.modelo);
        return `As próximas respostas vêm do ${atual ? atual.nome : n.modelo || 'modelo padrão'}.`;
      });
    },
  },
  grupos.map((g) => (g.nome ? h('optgroup', { label: g.nome }, g.itens.map(opcao)) : g.itens.map(opcao))),
  h('option', { value: '__outro' }, 'Outro...'));
}

function seletorDeEsforco(d, rodando) {
  return h('select', {
    class: 'entrada',
    id: 'chat-esforco',
    disabled: rodando ? true : null,
    title: 'O quanto a IA pensa antes de responder. Mais esforço: resposta melhor, mas mais lenta (e gasta mais do seu plano).',
    onchange: (e) => trocar('/api/chat/esforco', { esforco: e.target.value }, (n) => (n.esforco ? `Esforço: ${nomeDoEsforco(n.esforco)}.` : 'Esforço: o padrão da sua IA.')),
  },
  h('option', { value: '', selected: !d.esforco }, 'Padrão'),
  d.esforcos.map((x) => h('option', { value: x.id, selected: x.id === d.esforco, disabled: x.aceito ? null : true },
    x.aceito ? `${x.nome} (${x.id})` : `${x.nome} (${x.id}) · atualize o Claude Code`)));
}

function desenharModelo(rodando) {
  const d = estado.dados;
  el.modelo.replaceChildren();
  if (!d || !disponivel()) { el.config.hidden = true; return; }
  el.config.hidden = false;
  const bloco = (rotulo, id, campo) => h('div', { class: 'chat-campo' }, h('label', { class: 'rotulo-modelo', for: id }, rotulo), campo);
  el.modelo.append(bloco('Modelo', 'chat-modelo', seletorDeModelo(d, rodando)));
  if (d.esforcos && d.esforcos.length) el.modelo.append(bloco('Esforço', 'chat-esforco', seletorDeEsforco(d, rodando)));
  // A última resposta pediu pra atualizar a IA? Botão pra conferir a versão de novo
  const ultima = [...d.mensagens].reverse().find((m) => m.papel === 'ia');
  if (ultima && ultima.precisaAtualizar) {
    const p = provedorAtual();
    el.modelo.append(h('button', {
      type: 'button',
      class: 'botao pequeno chat-atualizei',
      title: p && p.versao ? `Agora: versão ${p.versao}` : '',
      onclick: async () => {
        const antes = p && p.versao;
        await carregar({ procurar: true, silencioso: true });
        const depois = provedorAtual();
        aviso(depois && depois.versao && depois.versao !== antes ? `Achei a versão ${depois.versao}. Pode tentar de novo.` : `Continua a versão ${antes || 'antiga'}. Rode "claude update" no terminal.`);
      },
    }, ic('recarregar'), 'Já atualizei'));
  }
}

function desenharTudo({ rolar = false } = {}) {
  desenharControles();
  desenharMensagens({ rolar });
}

// ---------- ações ----------

async function carregar({ procurar = false, silencioso = false } = {}) {
  try {
    estado.dados = await api(`/api/chat${procurar ? '?procurar=1' : ''}`);
    if (procurar && !silencioso) aviso(disponivel() ? `Achei o ${provedorAtual().nome}.` : 'Ainda não achei nenhuma IA instalada.');
  } catch (e) {
    if (procurar && !silencioso) falhou(e);
  }
  desenharTudo({ rolar: true });
}

async function mandar(texto) {
  if (!estado.dados) return;
  const t = String(texto ?? el.entrada.value).trim();
  if (!t) { el.entrada.focus(); return; }
  if (estado.dados && estado.dados.rodando) { aviso('Espere a IA terminar (ou aperte Parar).'); return; }
  el.entrada.value = '';
  ajustarAltura();
  // aparece na hora, antes do servidor responder
  estado.dados.mensagens.push({ papel: 'eu', texto: t, quando: Date.now() });
  estado.dados.rodando = true;
  desenharTudo({ rolar: true });
  try {
    const r = await api('/api/chat/enviar', { texto: t, contexto: contexto() });
    estado.atual = { id: r.id };
    if (!estado.dados.mensagens.some((m) => m.id === r.id)) {
      estado.dados.mensagens.push({ papel: 'ia', texto: '', ferramentas: [], id: r.id, quando: Date.now() });
    }
    desenharTudo({ rolar: true });
  } catch (e) {
    falhou(e);
    estado.dados.rodando = false;
    el.entrada.value = t;
    await carregar();
  }
}

async function parar() {
  try { await api('/api/chat/parar', {}); } catch (e) { falhou(e); }
}

async function nova() {
  if (estado.dados && estado.dados.mensagens.length && !(await confirmar('Começar uma conversa nova? A IA não vai lembrar desta (o que ela anotou nos arquivos continua lá).', { sim: 'Começar nova', titulo: 'Conversa nova' }))) return;
  try { estado.dados = await api('/api/chat/nova', {}); estado.atual = null; desenharTudo(); el.entrada.focus(); } catch (e) { falhou(e); }
}

function ajustarAltura() {
  const t = el.entrada;
  t.style.height = 'auto';
  t.style.height = `${Math.min(180, t.scrollHeight + 2)}px`;
}

// ---------- eventos que chegam do servidor (pelo /api/eventos) ----------

export function eventoDoChat(ev) {
  const d = estado.dados;
  if (!d) return;
  if (ev.tipo === 'inicio') {
    d.rodando = true;
    estado.atual = { id: ev.id };
    if (!d.mensagens.some((m) => m.id === ev.id)) d.mensagens.push({ papel: 'ia', texto: '', ferramentas: [], id: ev.id, quando: Date.now() });
    desenharTudo();
    return;
  }
  const m = d.mensagens.find((x) => x.id === ev.id);
  if (ev.tipo === 'texto' && m) { m.texto = (m.texto || '') + ev.texto; redesenharDepois(); return; }
  if (ev.tipo === 'ferramenta' && m) { (m.ferramentas = m.ferramentas || []).push(ev.texto); redesenharDepois(); return; }
  if (ev.tipo === 'fim') {
    d.rodando = false;
    estado.atual = null;
    if (m && ev.mensagem) Object.assign(m, ev.mensagem);
    desenharTudo();
    if (!estado.aberto) marcarNovidade(true);
    else if (document.activeElement !== el.entrada && el.entrada && !el.entrada.disabled) el.entrada.focus({ preventScroll: true });
  }
}

function marcarNovidade(v) {
  document.querySelectorAll('.abrir-chat').forEach((b) => b.classList.toggle('novidade', !!v));
}

// ---------- abrir e fechar ----------

export function abrirChat({ focar = true } = {}) {
  estado.aberto = true;
  guardarAberto(true);
  document.body.classList.add('com-chat');
  el.caixa.hidden = false;
  marcarNovidade(false);
  desenharTudo({ rolar: true });
  if (focar && el.entrada && !el.entrada.disabled) setTimeout(() => el.entrada.focus(), 30);
}

export function fecharChat() {
  estado.aberto = false;
  guardarAberto(false);
  document.body.classList.remove('com-chat');
  el.caixa.hidden = true;
}

export function alternarChat() {
  if (estado.aberto) fecharChat(); else abrirChat();
}

// Pedido vindo de um botão do painel ("Pedir pra IA"). Termina em ":"? O dono completa antes de mandar.
function pedir(texto) {
  abrirChat({ focar: false });
  const t = String(texto || '').trim();
  if (/:\s*$/.test(t) || (estado.dados && estado.dados.rodando)) {
    el.entrada.value = `${t} `;
    ajustarAltura();
    el.entrada.focus();
    el.entrada.setSelectionRange(el.entrada.value.length, el.entrada.value.length);
    if (estado.dados && estado.dados.rodando) aviso('A IA ainda está respondendo. O pedido ficou na caixa.');
    return;
  }
  mandar(t);
}

export function botaoDoChat({ classe = 'botao-chat' } = {}) {
  return h('button', { type: 'button', class: `${classe} abrir-chat`, onclick: alternarChat, 'aria-label': 'Conversar com a IA', title: 'Conversar com a IA' },
    ic('ia'), h('span', { class: 'rotulo-lateral' }, 'Conversar com a IA'), h('i', { class: 'bolinha' }));
}

export async function iniciarChat() {
  el.lista = h('div', { class: 'chat-lista', role: 'log', 'aria-live': 'polite' });
  el.entrada = h('textarea', {
    class: 'entrada',
    rows: '1',
    'aria-label': 'Mensagem pra IA',
    oninput: ajustarAltura,
    onkeydown: (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); mandar(); }
    },
  });
  el.enviar = h('button', { type: 'button', class: 'botao principal chat-enviar', 'aria-label': 'Mandar', title: 'Mandar', onclick: () => mandar() }, ic('seta'));
  el.parar = h('button', { type: 'button', class: 'botao chat-enviar', 'aria-label': 'Parar', title: 'Parar a IA', hidden: true, onclick: parar }, h('span', { class: 'quadrado' }));
  el.ia = h('div', { class: 'chat-ia' });
  el.modelo = h('div', { class: 'chat-modelo' });
  el.config = h('div', { class: 'chat-config', hidden: true }, el.modelo);
  el.nota = h('div', { class: 'fraco chat-nota' });
  el.caixa = h('aside', { class: 'chat vidro', 'aria-label': 'Chat com a IA', hidden: true },
    h('div', { class: 'chat-topo' },
      h('div', { class: 'chat-titulo' }, h('h2', null, 'IA'), el.ia),
      h('div', { class: 'chips' },
        h('button', { type: 'button', class: 'icone-botao', title: 'Conversa nova', 'aria-label': 'Conversa nova', onclick: nova }, ic('mais')),
        h('button', { type: 'button', class: 'icone-botao', title: 'Fechar', 'aria-label': 'Fechar o chat', onclick: fecharChat }, ic('x')))),
    el.config,
    el.lista,
    h('div', { class: 'chat-rodape' },
      h('div', { class: 'chat-escrever' }, el.entrada, el.enviar, el.parar),
      el.nota));
  document.body.append(el.caixa);
  // Atalho no canto de baixo, à direita (some quando o chat está aberto)
  document.body.append(h('button', { type: 'button', class: 'chat-flutuante abrir-chat', onclick: () => abrirChat(), 'aria-label': 'Conversar com a IA', title: 'Conversar com a IA' },
    ic('ia'), h('i', { class: 'bolinha' })));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && estado.aberto && document.activeElement === el.entrada && !el.entrada.value) fecharChat(); });

  window.__chat = { disponivel, pedir, abrir: abrirChat };
  await carregar();
  if (lerAberto()) abrirChat({ focar: false });
  // Volta a conferir de vez em quando (se a conexão ao vivo caiu no meio de uma resposta)
  setInterval(() => { if (estado.dados && estado.dados.rodando) carregar(); }, 15000);
}

