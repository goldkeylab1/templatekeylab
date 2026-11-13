// Leitura e escrita dos arquivos .md do cérebro.
// Tudo aqui é texto simples: o painel lê o que a IA escreveu e escreve do mesmo jeito.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---------- arquivo ----------

function ler(abs) {
  let texto = fs.readFileSync(abs, 'utf8');
  if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1);
  const eol = texto.includes('\r\n') ? '\r\n' : '\n';
  return { texto, eol, linhas: texto.split(/\r?\n/) };
}

function versao(texto) {
  return crypto.createHash('sha1').update(texto).digest('hex').slice(0, 12);
}

// Grava de um jeito seguro: escreve num arquivo temporário e troca.
function gravar(abs, linhasOuTexto, eol = '\n') {
  let texto = Array.isArray(linhasOuTexto) ? linhasOuTexto.join(eol) : linhasOuTexto;
  if (texto && !texto.endsWith('\n')) texto += eol;
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const tmp = `${abs}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, texto, 'utf8');
  fs.renameSync(tmp, abs);
  return texto;
}

// ---------- texto ----------

function semAcento(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Chave pra comparar nomes sem ligar pra acento, maiúscula e pontuação
function chave(s) {
  return semAcento(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function slug(s) {
  return chave(s).replace(/\s+/g, '-').slice(0, 60) || 'sem-nome';
}

// Linhas "ativas": fora de bloco de código (```) e de comentário <!-- -->
function ativas(linhas) {
  const r = new Array(linhas.length).fill(true);
  let cerca = null;
  let comentario = false;
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    if (comentario) {
      r[i] = false;
      if (l.includes('-->')) comentario = false;
      continue;
    }
    const t = l.trim();
    if (cerca) {
      r[i] = false;
      if (t.startsWith(cerca)) cerca = null;
      continue;
    }
    if (t.startsWith('```') || t.startsWith('~~~')) {
      cerca = t.slice(0, 3);
      r[i] = false;
      continue;
    }
    if (l.includes('<!--')) {
      r[i] = false;
      const depois = l.slice(l.indexOf('<!--') + 4);
      if (!depois.includes('-->')) comentario = true;
    }
  }
  return r;
}

function titulo(linha) {
  const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(linha || '');
  return m ? { nivel: m[1].length, texto: m[2].trim() } : null;
}

// Primeiro "# Título" do arquivo
function tituloDoArquivo(linhas, reserva = '') {
  const at = ativas(linhas);
  for (let i = 0; i < linhas.length; i++) {
    if (!at[i]) continue;
    const t = titulo(linhas[i]);
    if (t && t.nivel === 1) return t.texto;
  }
  return reserva;
}

// Primeira linha de citação (">") que não é instrução pra IA
function descricaoDoArquivo(linhas) {
  const at = ativas(linhas);
  for (let i = 0; i < linhas.length; i++) {
    if (!at[i]) continue;
    const t = linhas[i].trim();
    if (titulo(t) && titulo(t).nivel >= 2) break;
    if (t.startsWith('>')) {
      const s = t.replace(/^>\s?/, '').trim();
      if (s && !/^pra ia\b/i.test(semAcento(s))) return s.replace(/\*\*/g, '').replace(/`/g, '');
    }
  }
  return '';
}

// ---------- marcadores ----------
// <!-- configurar: 1 --> arquivo de perguntas que conta no "Comece aqui"
// <!-- kanban -->        arquivo que vira um quadro no menu Kanban

// O marcador precisa estar sozinho na linha (citado no meio de um texto não conta)
function marcador(texto, nome) {
  const m = new RegExp(`^[ \\t]*<!--\\s*${nome}\\s*:?\\s*(\\d+)?\\s*-->[ \\t]*$`, 'im').exec(texto);
  if (!m) return null;
  return { ordem: m[1] ? Number(m[1]) : 99 };
}

// ---------- campos ("- **Pergunta:** resposta") ----------

const RE_CAMPO_A = /^(\s{0,3}[-*]\s+\*\*([^*\n]+?):\*\*)[ \t]*(.*)$/; // - **Rótulo:** valor
const RE_CAMPO_B = /^(\s{0,3}[-*]\s+\*\*([^*\n]+?)\*\*[ \t]*:)[ \t]*(.*)$/; // - **Rótulo**: valor

function campoDaLinha(linha) {
  const m = RE_CAMPO_A.exec(linha || '') || RE_CAMPO_B.exec(linha || '');
  if (!m) return null;
  return { cabeca: m[1], rotulo: m[2].trim(), valor: m[3].trim() };
}

const VAZIOS = new Set([
  '', '-', '--', '—', '–', '...', '…', '?', '_', '__', 'vazio', '(vazio)', 'a preencher', '(a preencher)',
  'preencher', 'pendente', 'a definir', 'tbd', 'n/a', 'nao sei', '[ ]', '( )',
]);

function preenchido(valor) {
  const v = semAcento(String(valor || '')).trim().toLowerCase().replace(/[.!]+$/, '');
  return !VAZIOS.has(v);
}

function ehOpcional(rotulo) {
  return /\(\s*opcional\s*\)/i.test(rotulo);
}

function nomeDoCampo(rotulo) {
  return rotulo.replace(/\s*\(\s*opcional\s*\)\s*/gi, ' ').replace(/\s+/g, ' ').trim();
}

function limparValor(v) {
  return String(v ?? '').replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Todos os campos do arquivo, com a seção (## ) e a subseção (### ) onde estão
function campos(linhas) {
  const at = ativas(linhas);
  const out = [];
  let secao = '';
  let sub = '';
  for (let i = 0; i < linhas.length; i++) {
    if (!at[i]) continue;
    const t = titulo(linhas[i]);
    if (t) {
      if (t.nivel <= 2) { secao = t.nivel === 2 ? t.texto : ''; sub = ''; }
      else if (t.nivel === 3) sub = t.texto;
      continue;
    }
    const c = campoDaLinha(linhas[i]);
    if (!c) continue;
    out.push({
      linha: i,
      secao,
      sub,
      rotulo: c.rotulo,
      nome: nomeDoCampo(c.rotulo),
      valor: c.valor,
      opcional: ehOpcional(c.rotulo),
      preenchido: preenchido(c.valor),
    });
  }
  return out;
}

// Troca o valor de vários campos. Cada mudança: { secao, rotulo, valor }.
// Devolve a lista de rótulos que não foram achados.
function trocarCampos(linhas, mudancas) {
  const lista = campos(linhas);
  const naoAchou = [];
  for (const m of mudancas || []) {
    const rotulo = String(m.rotulo || '').trim().replace(/:$/, '').trim();
    const alvo = lista.find((c) => c.secao === (m.secao || '') && c.rotulo === rotulo)
      || lista.find((c) => c.rotulo === rotulo);
    if (!alvo) { naoAchou.push(rotulo); continue; }
    const c = campoDaLinha(linhas[alvo.linha]);
    const valor = limparValor(m.valor);
    linhas[alvo.linha] = valor ? `${c.cabeca} ${valor}` : c.cabeca;
    alvo.valor = valor;
  }
  return naoAchou;
}

// Acha um campo pelo começo do nome (sem acento): campoPorNome(linhas, 'cor principal')
function campoPorNome(linhas, comeco) {
  const k = chave(comeco);
  return campos(linhas).find((c) => chave(c.nome).startsWith(k)) || null;
}

// Troca um campo pelo começo do nome. Se não existir, cria no fim da seção indicada.
function trocarCampoPorNome(linhas, comeco, valor, { rotuloNovo, secaoNova } = {}) {
  const c = campoPorNome(linhas, comeco);
  const v = limparValor(valor);
  if (c) {
    const cc = campoDaLinha(linhas[c.linha]);
    linhas[c.linha] = v ? `${cc.cabeca} ${v}` : cc.cabeca;
    return true;
  }
  const linhaNova = `- **${rotuloNovo || comeco}:**${v ? ` ${v}` : ''}`;
  const sec = secaoNova ? acharSecao(linhas, secaoNova) : null;
  if (sec) {
    linhas.splice(posicaoFim(linhas, sec), 0, linhaNova);
  } else {
    if (secaoNova) linhas.push('', `## ${secaoNova}`, '');
    linhas.push(linhaNova);
  }
  return true;
}

// ---------- seções ----------

// Acha "## Nome" (pelo começo do nome, sem acento). Devolve { inicio, fim } (fim = linha do próximo título)
function acharSecao(linhas, nome, nivel = 2) {
  const alvo = chave(nome);
  const at = ativas(linhas);
  for (let i = 0; i < linhas.length; i++) {
    if (!at[i]) continue;
    const t = titulo(linhas[i]);
    if (t && t.nivel === nivel && chave(t.texto).startsWith(alvo)) {
      let fim = linhas.length;
      for (let j = i + 1; j < linhas.length; j++) {
        if (!at[j]) continue;
        const u = titulo(linhas[j]);
        if (u && u.nivel <= nivel) { fim = j; break; }
      }
      return { inicio: i, fim, titulo: t.texto };
    }
  }
  return null;
}

// Primeira linha útil de uma seção (pula linhas em branco, citações e comentários)
function posicaoTopo(linhas, sec) {
  const at = ativas(linhas);
  let p = sec.inicio + 1;
  while (p < sec.fim && (linhas[p].trim() === '' || linhas[p].trim().startsWith('>') || !at[p])) p++;
  return p;
}

// Logo depois do último texto da seção
function posicaoFim(linhas, sec) {
  let p = sec.fim;
  while (p - 1 > sec.inicio && linhas[p - 1].trim() === '') p--;
  return p;
}

// Insere linhas no topo ou no fim de uma seção (cria a seção se não existir)
function inserirNaSecao(linhas, nomeSecao, novas, { topo = false, separar = false } = {}) {
  let sec = acharSecao(linhas, nomeSecao);
  if (!sec) {
    while (linhas.length && linhas[linhas.length - 1].trim() === '') linhas.pop();
    linhas.push('', `## ${nomeSecao}`, '');
    sec = acharSecao(linhas, nomeSecao);
  }
  let p;
  if (topo) {
    p = posicaoTopo(linhas, sec);
    if (p >= sec.fim) p = posicaoFim(linhas, sec); // seção vazia
  } else {
    p = posicaoFim(linhas, sec);
  }
  const bloco = [...novas];
  const antes = linhas[p - 1];
  const depois = linhas[p];
  if (antes !== undefined && antes.trim() !== '' && (separar || titulo(antes) || antes.trim().startsWith('>') || antes.includes('-->'))) bloco.unshift('');
  if (depois !== undefined && depois.trim() !== '' && (separar || titulo(depois))) bloco.push('');
  linhas.splice(p, 0, ...bloco);
  return linhas;
}

// Seções com os itens de lista (pra aprendizados, pedidos prontos etc.)
function secoesComItens(linhas) {
  const at = ativas(linhas);
  const secoes = [];
  let sec = null;
  let sub = null;
  for (let i = 0; i < linhas.length; i++) {
    if (!at[i]) continue;
    const t = titulo(linhas[i]);
    if (t) {
      if (t.nivel === 2) { sec = { titulo: t.texto, itens: [], subs: [] }; secoes.push(sec); sub = null; }
      else if (t.nivel === 3 && sec) { sub = { titulo: t.texto, itens: [] }; sec.subs.push(sub); }
      continue;
    }
    const m = /^\s{0,3}[-*]\s+(?:\[[ xX]\]\s+)?(.+)$/.exec(linhas[i]);
    if (m && sec) (sub || sec).itens.push(m[1].trim());
  }
  return secoes;
}

// ---------- entradas ("### Título" + campos) ----------

// Lê os blocos "### Título" com os campos de baixo. Usado em feedbacks, ideias, decisões.
function entradas(linhas, { nivel = 3 } = {}) {
  const at = ativas(linhas);
  const out = [];
  let secao = '';
  let atual = null;
  for (let i = 0; i < linhas.length; i++) {
    if (!at[i]) continue;
    const t = titulo(linhas[i]);
    if (t && t.nivel < nivel) { secao = t.texto; atual = null; continue; }
    if (t && t.nivel === nivel) {
      atual = { titulo: t.texto, secao, linha: i, fim: i, campos: {}, corpo: [] };
      out.push(atual);
      continue;
    }
    if (!atual) continue;
    if (linhas[i].trim() === '') continue;
    atual.fim = i;
    const c = campoDaLinha(linhas[i]);
    if (c) atual.campos[chave(nomeDoCampo(c.rotulo))] = { valor: c.valor, linha: i, rotulo: c.rotulo };
    else atual.corpo.push(linhas[i]);
  }
  return out;
}

function valorDe(entrada, nome) {
  const k = chave(nome);
  const achado = Object.keys(entrada.campos).find((c) => c.startsWith(k));
  return achado ? entrada.campos[achado].valor : '';
}

// Acha uma entrada pelo título (e pela linha, se ainda bater)
function acharEntrada(linhas, { titulo: tit, linha }) {
  const lista = entradas(linhas);
  return lista.find((e) => e.titulo === tit && e.linha === linha) || lista.find((e) => e.titulo === tit) || null;
}

// Troca (ou cria) um campo dentro de uma entrada
function trocarCampoDaEntrada(linhas, entrada, nome, valor, rotuloNovo) {
  const k = chave(nome);
  const achado = Object.keys(entrada.campos).find((c) => c.startsWith(k));
  const v = limparValor(valor);
  if (achado) {
    const { linha } = entrada.campos[achado];
    const c = campoDaLinha(linhas[linha]);
    linhas[linha] = v ? `${c.cabeca} ${v}` : c.cabeca;
  } else {
    linhas.splice(entrada.fim + 1, 0, `- **${rotuloNovo || nome}:**${v ? ` ${v}` : ''}`);
  }
}

// ---------- datas ----------

function doisDigitos(n) { return String(n).padStart(2, '0'); }

function hojeISO(d = new Date()) {
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
}

function dataBR(d = new Date(), { ano = true } = {}) {
  return `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)}${ano ? `/${d.getFullYear()}` : ''}`;
}

function horaBR(d = new Date()) {
  return `${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
}

// "05/11" ou "05/11/2026" → "2026-11-05". Sem ano: o mais perto de hoje.
function dataDeTexto(dia, mes, ano, { passado = false } = {}) {
  const d = Number(dia);
  const m = Number(mes);
  if (!(d >= 1 && d <= 31 && m >= 1 && m <= 12)) return null;
  let a;
  if (ano) {
    a = Number(ano);
    if (a < 100) a += 2000;
  } else {
    const hoje = new Date();
    a = hoje.getFullYear();
    const dif = (new Date(a, m - 1, d) - hoje) / 86400000;
    if (passado) { if (dif > 1) a -= 1; }
    else if (dif < -120) a += 1;
    else if (dif > 240) a -= 1;
  }
  return `${a}-${doisDigitos(m)}-${doisDigitos(d)}`;
}

// "2026-11-05" → "05/11" (ou "05/11/2027" se for outro ano)
function isoParaCurta(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return Number(a) === new Date().getFullYear() ? `${d}/${m}` : `${d}/${m}/${a}`;
}

module.exports = {
  ler, gravar, versao,
  semAcento, chave, slug,
  ativas, titulo, tituloDoArquivo, descricaoDoArquivo, marcador,
  campoDaLinha, campos, trocarCampos, campoPorNome, trocarCampoPorNome, preenchido, ehOpcional, nomeDoCampo, limparValor,
  acharSecao, posicaoTopo, posicaoFim, inserirNaSecao, secoesComItens,
  entradas, valorDe, acharEntrada, trocarCampoDaEntrada,
  hojeISO, dataBR, horaBR, dataDeTexto, isoParaCurta, doisDigitos,
};
