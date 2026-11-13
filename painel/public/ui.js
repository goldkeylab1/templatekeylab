// Peças pequenas usadas em todas as telas.
import { icone } from './icones.js';

// ---------- elementos ----------

export function h(tag, props, ...filhos) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v; // só pra ícones e markdown já limpo
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  for (const f of filhos.flat(Infinity)) {
    if (f == null || f === false) continue;
    el.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
  return el;
}

export function ic(nome, classe) {
  const s = document.createElement('span');
  s.style.display = 'contents';
  s.innerHTML = icone(nome, classe);
  return s.firstChild;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function semAcento(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function chave(s) {
  return semAcento(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// ---------- conversa com o servidor ----------

export async function api(caminho, dados) {
  const opcoes = dados === undefined
    ? { headers: { 'X-KeyLab': '1' } }
    : { method: 'POST', headers: { 'X-KeyLab': '1', 'Content-Type': 'application/json' }, body: JSON.stringify(dados) };
  let r;
  try {
    r = await fetch(caminho, opcoes);
  } catch {
    throw new Error('O painel desligou. Abra de novo (dois cliques em ABRIR-PAINEL) e recarregue a página.');
  }
  let corpo = null;
  try { corpo = await r.json(); } catch { corpo = null; }
  if (dados !== undefined) window.__ultimaEscrita = Date.now();
  if (!r.ok) {
    const e = new Error((corpo && corpo.erro) || 'Não deu certo. Tente de novo.');
    e.status = r.status;
    throw e;
  }
  return corpo;
}

// ---------- avisos ----------

let caixaAvisos = null;

export function aviso(texto, { erro = false, acao = null, tempo = 3200 } = {}) {
  if (!caixaAvisos) {
    caixaAvisos = h('div', { class: 'avisos', role: 'status', 'aria-live': 'polite' });
    document.body.append(caixaAvisos);
  }
  const el = h('div', { class: `aviso${erro ? ' erro' : ''}` }, texto);
  if (acao) el.append(h('button', { type: 'button', onclick: () => { acao.fazer(); el.remove(); } }, acao.texto));
  caixaAvisos.append(el);
  setTimeout(() => el.remove(), erro ? Math.max(tempo, 6000) : tempo);
}

export function falhou(e) {
  aviso(e.message || String(e), { erro: true });
}

export async function copiar(texto, mensagem = 'Copiado. Agora é só colar na sua IA.') {
  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    const t = h('textarea', { style: 'position:fixed;opacity:0' }, texto);
    document.body.append(t);
    t.select();
    try { document.execCommand('copy'); } catch { /* sem cópia */ }
    t.remove();
  }
  aviso(mensagem);
}

// ---------- janelas ----------

export function janela({ titulo, corpo, botoes = [], aoAbrir }) {
  return new Promise((resolve) => {
    const anterior = document.activeElement;
    const fundo = h('div', { class: 'fundo-janela' });
    const caixa = h('div', { class: 'janela', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo });
    const fechar = (valor) => {
      fundo.remove();
      document.removeEventListener('keydown', tecla);
      if (anterior && anterior.focus) anterior.focus();
      resolve(valor);
    };
    const tecla = (e) => { if (e.key === 'Escape') fechar(null); };
    const rodape = h('div', { class: 'rodape-janela' }, botoes.map((b) => h('button', {
      type: b.tipo || 'button',
      class: `botao${b.principal ? ' principal' : ''}${b.esquerda ? ' leve esquerda' : ''}`,
      onclick: async () => {
        if (b.antes) { const ok = await b.antes(caixa); if (ok === false) return; }
        fechar(typeof b.valor === 'function' ? b.valor(caixa) : b.valor);
      },
    }, b.icone ? ic(b.icone) : null, b.texto)));
    caixa.append(h('h2', null, titulo), corpo || '', rodape);
    fundo.append(caixa);
    fundo.addEventListener('mousedown', (e) => { if (e.target === fundo) fechar(null); });
    document.addEventListener('keydown', tecla);
    document.body.append(fundo);
    const primeiro = caixa.querySelector('input, textarea, select') || rodape.querySelector('.principal');
    if (primeiro) setTimeout(() => primeiro.focus(), 30);
    if (aoAbrir) aoAbrir(caixa, fechar);
  });
}

export async function confirmar(pergunta, { sim = 'Sim', nao = 'Cancelar', titulo = 'Tem certeza?' } = {}) {
  const r = await janela({
    titulo,
    corpo: h('p', { class: 'suave' }, pergunta),
    botoes: [{ texto: nao, valor: false }, { texto: sim, valor: true, principal: true }],
  });
  return r === true;
}

export async function pedirTexto({ titulo, rotulo, valor = '', dica = '', confirmar: textoOk = 'Salvar' }) {
  const entrada = h('input', { class: 'entrada', type: 'text', value: valor, placeholder: dica });
  const corpo = h('div', { class: 'campo-janela' }, rotulo ? h('label', { class: 'rotulo' }, rotulo) : null, entrada);
  const r = await janela({
    titulo,
    corpo,
    botoes: [{ texto: 'Cancelar', valor: null }, { texto: textoOk, principal: true, valor: () => entrada.value.trim() }],
    aoAbrir: (_c, fechar) => entrada.addEventListener('keydown', (e) => { if (e.key === 'Enter') fechar(entrada.value.trim()); }),
  });
  return r;
}

// ---------- datas ----------

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const SEMANA_LONGA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function isoDe(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function hoje() { return isoDe(new Date()); }
export function dataDe(iso) { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d); }
export function somarDias(iso, n) { const d = dataDe(iso); d.setDate(d.getDate() + n); return isoDe(d); }
export function diaDaSemana(iso, longo = false) { return (longo ? SEMANA_LONGA : SEMANA)[dataDe(iso).getDay()]; }
export function nomeDoMes(m, longo = true) { return (longo ? MESES_LONGOS : MESES)[m]; }
export const NOMES_SEMANA = SEMANA;

export function dataCurta(iso) {
  if (!iso) return '';
  const base = iso.split('T')[0];
  const d = dataDe(base);
  const dif = Math.round((d - dataDe(hoje())) / 86400000);
  if (dif === 0) return 'hoje';
  if (dif === 1) return 'amanhã';
  if (dif === -1) return 'ontem';
  const ano = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : '';
  return `${SEMANA[d.getDay()]}, ${d.getDate()} ${MESES[d.getMonth()]}${ano}`;
}

export function quandoFoi(ms) {
  if (!ms) return '';
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return 'agora há pouco';
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const hr = Math.round(m / 60);
  if (hr < 24) return `há ${hr} h`;
  const d = Math.round(hr / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

// ---------- progresso ----------

export function anel(pct, { tamanho = 132, rotulo = '' } = {}) {
  const r = 52;
  const volta = 2 * Math.PI * r;
  const el = h('div', { class: 'anel', style: `width:${tamanho}px;height:${tamanho}px`, role: 'img', 'aria-label': `${pct}% configurado` });
  el.innerHTML = `<svg viewBox="0 0 120 120"><circle class="trilho" cx="60" cy="60" r="${r}"/><circle class="feito" cx="60" cy="60" r="${r}" stroke-dasharray="${volta}" stroke-dashoffset="${volta}"/></svg>`;
  el.append(h('div', { class: 'meio' }, h('div', null, h('b', null, `${pct}%`), rotulo ? h('div', { class: 'fraco pequeno' }, rotulo) : null)));
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const c = el.querySelector('.feito');
    if (c) c.style.strokeDashoffset = String(volta * (1 - pct / 100));
  }));
  return el;
}

export function miniAnel(pct) {
  const r = 13;
  const volta = 2 * Math.PI * r;
  const s = document.createElement('span');
  s.innerHTML = `<svg class="mini-anel${pct >= 100 ? ' cheio' : ''}" viewBox="0 0 34 34" role="img" aria-label="${pct}%"><circle class="trilho" cx="17" cy="17" r="${r}"/><circle class="feito" cx="17" cy="17" r="${r}" stroke-dasharray="${volta}" stroke-dashoffset="${volta * (1 - pct / 100)}" transform="rotate(-90 17 17)"/></svg>`;
  return s.firstChild;
}

export function barra(pct) {
  return h('div', { class: `barra${pct >= 100 ? ' cheia' : ''}`, role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('span', { style: `width:${Math.max(0, Math.min(100, pct))}%` }));
}

// ---------- pedidos pra IA ----------

export function pedido(texto, { rotulo } = {}) {
  return h('button', { type: 'button', class: 'pedido', title: 'Copiar e colar na sua IA', onclick: () => copiar(texto) },
    ic('ia'), h('span', null, rotulo || texto), h('span', { class: 'copiar-txt' }, 'Copiar'));
}

export function vazio({ titulo, texto, pedido: p, acao }) {
  return h('div', { class: 'vazio' },
    h('h3', null, titulo),
    texto ? h('p', null, texto) : null,
    acao || null,
    p ? pedido(p) : null);
}

export function cabeca({ titulo, texto, acoes = [], volta = null }) {
  return h('header', { class: 'cabeca' },
    h('div', null,
      volta ? h('a', { class: 'volta', href: volta.href }, ic('voltar'), volta.texto) : null,
      h('h1', null, titulo),
      texto ? h('p', null, texto) : null),
    acoes.length ? h('div', { class: 'acoes' }, acoes) : null);
}

// ---------- markdown (leitura segura) ----------

const RE_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const RE_CAMPO_A = /^\*\*([^*\n]+?):\*\*\s*(.*)$/;
const RE_CAMPO_B = /^\*\*([^*\n]+?)\*\*\s*:\s*(.*)$/;

function resolver(base, rel) {
  const partes = (base ? `${base}/${rel}` : rel).split('/');
  const out = [];
  for (const p of partes) {
    if (!p || p === '.') continue;
    if (p === '..') out.pop();
    else out.push(p);
  }
  return out.join('/');
}

function link(texto, url, base) {
  const u = url.replace(/&amp;/g, '&');
  if (/^(https?:|mailto:)/i.test(u)) return `<a href="${esc(u)}" target="_blank" rel="noopener">${texto}</a>`;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u) || u.startsWith('//')) return texto;
  const alvo = resolver(base, u.split('#')[0]);
  if (!alvo) return texto;
  if (u.endsWith('/')) return texto;
  return `<a href="#/arquivo?c=${encodeURIComponent(alvo)}">${texto}</a>`;
}

export function inline(texto, base = '') {
  let s = esc(texto);
  const codigos = [];
  s = s.replace(/`([^`]+)`/g, (_m, c) => { codigos.push(c); return `\u0000${codigos.length - 1}\u0000`; });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t, u) => link(t, u, base));
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  s = s.replace(/(^|\s)(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, (_m, a, u) => `${a}<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
  s = s.replace(/\u0000(\d+)\u0000/g, (_m, i) => `<code>${codigos[Number(i)]}</code>`);
  return s;
}

function itemDeLista(texto, linha, base) {
  const caixa = /^\[( |x|X)\]\s+(.*)$/.exec(texto);
  if (caixa) {
    const marcado = caixa[1].toLowerCase() === 'x';
    return `<li class="tem-caixa"><input type="checkbox" data-linha="${linha}"${marcado ? ' checked' : ''} aria-label="Marcar"><span>${inline(caixa[2], base)}</span>`;
  }
  const campo = RE_CAMPO_A.exec(texto) || RE_CAMPO_B.exec(texto);
  if (campo) {
    const valor = campo[2].trim();
    const nome = campo[1].replace(/\s*\(\s*opcional\s*\)\s*/i, ' ').trim();
    return `<li class="campo-doc"><span class="r">${esc(nome)}</span><span class="v${valor ? '' : ' vazio'}">${valor ? inline(valor, base) : 'sem resposta'}</span>`;
  }
  return `<li>${inline(texto, base)}`;
}

function celulas(l) {
  return l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((s) => s.trim());
}

export function markdown(texto, { base = '' } = {}) {
  const limpo = String(texto || '').replace(/<!--[\s\S]*?-->/g, (m) => '\n'.repeat((m.match(/\n/g) || []).length));
  const linhas = limpo.split(/\r?\n/);
  const out = [];
  let i = 0;
  while (i < linhas.length) {
    const l = linhas[i];
    if (!l.trim()) { i++; continue; }

    if (/^\s*(```|~~~)/.test(l)) {
      const cerca = l.trim().slice(0, 3);
      const buf = [];
      i++;
      while (i < linhas.length && !linhas[i].trim().startsWith(cerca)) { buf.push(linhas[i]); i++; }
      i++;
      out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }

    const t = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(l);
    if (t) { out.push(`<h${t[1].length}>${inline(t[2], base)}</h${t[1].length}>`); i++; continue; }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { out.push('<hr>'); i++; continue; }

    if (/^\s*>/.test(l)) {
      const buf = [];
      while (i < linhas.length && /^\s*>/.test(linhas[i])) { buf.push(linhas[i].replace(/^\s*>\s?/, '')); i++; }
      const ehIA = (s) => /^pra ia\b/i.test(semAcento(s.trim()));
      const humanas = buf.filter((s) => s.trim() && !ehIA(s));
      const ias = buf.filter((s) => ehIA(s));
      if (humanas.length) out.push(`<blockquote>${humanas.map((s) => `<p>${inline(s, base)}</p>`).join('')}</blockquote>`);
      if (ias.length) out.push(`<blockquote class="instrucao-ia">${ias.map((s) => `<p>${inline(s, base)}</p>`).join('')}</blockquote>`);
      continue;
    }

    if (l.includes('|') && i + 1 < linhas.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(linhas[i + 1])) {
      const cab = celulas(l);
      i += 2;
      const corpo = [];
      while (i < linhas.length && linhas[i].includes('|') && linhas[i].trim()) { corpo.push(celulas(linhas[i])); i++; }
      out.push(`<table><thead><tr>${cab.map((c) => `<th>${inline(c, base)}</th>`).join('')}</tr></thead><tbody>${corpo.map((r) => `<tr>${r.map((c) => `<td>${inline(c, base)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      continue;
    }

    if (RE_ITEM.test(l)) {
      const pilha = [];
      while (i < linhas.length) {
        const li = linhas[i];
        if (!li.trim()) {
          if (i + 1 < linhas.length && RE_ITEM.test(linhas[i + 1])) { i++; continue; }
          break;
        }
        const m = RE_ITEM.exec(li);
        if (!m) {
          if (/^\s{2,}\S/.test(li) && pilha.length) { out.push(` ${inline(li.trim(), base)}`); i++; continue; }
          break;
        }
        const recuo = m[1].replace(/\t/g, '  ').length;
        const tipo = /\d/.test(m[2]) ? 'ol' : 'ul';
        if (!pilha.length) { out.push(`<${tipo}>`); pilha.push({ recuo, tipo }); }
        else if (recuo > pilha[pilha.length - 1].recuo + 1) { out.push(`<${tipo}>`); pilha.push({ recuo, tipo }); }
        else {
          while (pilha.length > 1 && recuo < pilha[pilha.length - 1].recuo) { out.push(`</li></${pilha.pop().tipo}>`); }
          out.push('</li>');
        }
        out.push(itemDeLista(m[3], i, base));
        i++;
      }
      while (pilha.length) out.push(`</li></${pilha.pop().tipo}>`);
      continue;
    }

    const buf = [];
    while (i < linhas.length && linhas[i].trim() && !/^\s*(#{1,6}\s|>|```|~~~)/.test(linhas[i]) && !RE_ITEM.test(linhas[i])) { buf.push(linhas[i].trim()); i++; }
    out.push(`<p>${inline(buf.join(' '), base)}</p>`);
  }
  return out.join('');
}

// Liga as caixinhas de marcar (- [ ]) de um documento ao arquivo
export function ligarCaixas(el, texto, caminho, depois) {
  const linhas = String(texto || '').split(/\r?\n/);
  el.querySelectorAll('input[type=checkbox][data-linha]').forEach((cx) => {
    cx.addEventListener('change', async () => {
      const linha = Number(cx.dataset.linha);
      try {
        const r = await api('/api/arquivo/marcar', { caminho, linha, id: linhas[linha], marcado: cx.checked });
        if (depois) depois(r);
      } catch (e) { cx.checked = !cx.checked; falhou(e); }
    });
  });
}

// Separa "Rótulo (ex.: algo)" em nome e dica
export function separarRotulo(nome) {
  const m = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(nome);
  if (!m || !m[1]) return { nome, dica: '' };
  return { nome: m[1], dica: m[2].replace(/^ex\.?:?\s*/i, 'Ex.: ') };
}
