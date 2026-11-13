// Quadros do kanban: todo arquivo .md com <!-- kanban --> vira um quadro.
//   # Nome do quadro
//   ## Coluna            (cada "##" é uma coluna)
//   - Cartão @DD/MM #tag (cada item de lista é um cartão)
//     - nota do cartão   (linhas com recuo embaixo do cartão)
'use strict';

const fs = require('fs');
const path = require('path');
const md = require('./md');
const { RAIZ, dentro, relativo, existe, listar } = require('./raiz');
const { analisarTexto, montarTexto } = require('./itens');
const { ErroPainel, MUDOU } = require('./erro');

const PRINCIPAL = 'memoria/kanban.md';
const RE_CARTAO = /^([-*])\s+(?:\[( |x|X)\]\s+)?(.*)$/;

// O marcador precisa estar sozinho na linha (citado no meio de um texto não conta)
function ehQuadro(texto) {
  return /^[ \t]*<!--\s*kanban\s*-->[ \t]*$/im.test(texto);
}

function analisar(linhas) {
  const at = md.ativas(linhas);
  const colunas = [];
  let titulo = '';
  let col = null;
  let cartao = null;
  for (let i = 0; i < linhas.length; i++) {
    if (!at[i]) continue;
    const l = linhas[i];
    const t = md.titulo(l);
    if (t) {
      if (t.nivel === 1 && !titulo) titulo = t.texto;
      if (t.nivel === 2) { col = { titulo: t.texto, linha: i, cartoes: [] }; colunas.push(col); }
      cartao = null;
      continue;
    }
    if (!col) continue;
    const m = RE_CARTAO.exec(l);
    if (m) {
      cartao = { id: l.trim(), linha: i, ate: i, marcado: m[2] ? m[2].toLowerCase() === 'x' : null, notas: [], ...analisarTexto(m[3]) };
      col.cartoes.push(cartao);
      continue;
    }
    if (l.trim() === '') continue;
    if (cartao && /^(\s{2,}|\t)/.test(l)) {
      cartao.notas.push(l.trim().replace(/^[-*]\s+/, ''));
      cartao.ate = i;
      continue;
    }
    cartao = null;
  }
  return { titulo, colunas };
}

function lerQuadro(abs) {
  const { linhas, texto } = md.ler(abs);
  const q = analisar(linhas);
  return {
    arquivo: relativo(abs),
    titulo: q.titulo || path.basename(abs, '.md'),
    descricao: md.descricaoDoArquivo(linhas),
    versao: md.versao(texto),
    colunas: q.colunas.map((c) => ({
      titulo: c.titulo,
      cartoes: c.cartoes.map(({ linha, ate, ...resto }) => resto),
    })),
  };
}

function listarQuadros() {
  const achados = [];
  for (const abs of listar({ profundidade: 4 })) {
    const rel = relativo(abs);
    // moldes não são quadros de verdade
    if (rel.startsWith('modelos/') || path.basename(abs).startsWith('_')) continue;
    let texto = '';
    try { texto = fs.readFileSync(abs, 'utf8'); } catch { continue; }
    if (ehQuadro(texto)) achados.push(abs);
  }
  const quadros = achados.map(lerQuadro);
  quadros.sort((a, b) => {
    if (a.arquivo === PRINCIPAL) return -1;
    if (b.arquivo === PRINCIPAL) return 1;
    return a.titulo.localeCompare(b.titulo, 'pt-BR');
  });
  return quadros;
}

function abrir(arquivo) {
  const abs = dentro(arquivo);
  if (!abs || !abs.endsWith('.md') || !existe(abs)) throw new ErroPainel('Quadro não encontrado.', 404);
  const lido = md.ler(abs);
  if (!ehQuadro(lido.texto)) throw new ErroPainel('Esse arquivo não é um quadro.', 400);
  return { abs, ...lido };
}

function acharColuna(colunas, nome) {
  return colunas.find((c) => c.titulo === nome) || colunas.find((c) => md.chave(c.titulo) === md.chave(nome)) || null;
}

function acharCartao(colunas, nomeColuna, id) {
  const col = acharColuna(colunas, nomeColuna);
  const cartao = col && col.cartoes.find((c) => c.id === String(id || '').trim());
  if (!cartao) throw new ErroPainel(MUDOU, 409);
  return { col, cartao };
}

// Onde inserir um cartão novo na coluna (posição = índice entre os cartões)
function linhaDeInsercao(linhas, col, posicao) {
  if (posicao != null && posicao < col.cartoes.length) return col.cartoes[posicao].linha;
  if (col.cartoes.length) return col.cartoes[col.cartoes.length - 1].ate + 1;
  let p = col.linha + 1;
  while (p < linhas.length && (linhas[p].trim() === '' || linhas[p].trim().startsWith('>'))) {
    if (md.titulo(linhas[p])) break;
    p++;
  }
  // volta pras linhas em branco logo depois do título
  while (p > col.linha + 1 && linhas[p - 1].trim() === '') p--;
  return p;
}

function inserirCartao(linhas, col, bloco, posicao) {
  const p = linhaDeInsercao(linhas, col, posicao);
  const novo = [...bloco];
  if (!col.cartoes.length) {
    if (linhas[p - 1] !== undefined && md.titulo(linhas[p - 1])) novo.unshift('');
    if (linhas[p] !== undefined && linhas[p].trim() !== '') novo.push('');
  }
  linhas.splice(p, 0, ...novo);
}

function linhaDoCartao({ texto, data, areas, notas, marcado }) {
  const caixa = marcado === true ? '[x] ' : marcado === false ? '[ ] ' : '';
  const bloco = [`- ${caixa}${montarTexto({ texto, data, areas })}`];
  for (const n of notas || []) {
    const s = md.limparValor(n);
    if (s) bloco.push(`  - ${s}`);
  }
  return bloco;
}

function agir(dados = {}) {
  if (dados.acao === 'novo-quadro') return novoQuadro(dados.nome);
  const { abs, linhas, eol } = abrir(dados.arquivo || PRINCIPAL);
  let { colunas } = analisar(linhas);

  switch (dados.acao) {
    case 'adicionar': {
      const texto = md.limparValor(dados.texto);
      if (!texto) throw new ErroPainel('Escreva o cartão.');
      const col = acharColuna(colunas, dados.coluna) || colunas[0];
      if (!col) throw new ErroPainel('Crie uma coluna antes.');
      inserirCartao(linhas, col, linhaDoCartao({ texto, data: dados.data, areas: dados.areas, notas: dados.notas }));
      break;
    }
    case 'editar': {
      const texto = md.limparValor(dados.texto);
      if (!texto) throw new ErroPainel('O cartão não pode ficar vazio.');
      const { cartao } = acharCartao(colunas, dados.coluna, dados.id);
      const bloco = linhaDoCartao({ texto, data: dados.data, areas: dados.areas, notas: dados.notas, marcado: cartao.marcado });
      linhas.splice(cartao.linha, cartao.ate - cartao.linha + 1, ...bloco);
      break;
    }
    case 'apagar': {
      const { cartao } = acharCartao(colunas, dados.coluna, dados.id);
      linhas.splice(cartao.linha, cartao.ate - cartao.linha + 1);
      break;
    }
    case 'mover': {
      const { cartao } = acharCartao(colunas, dados.coluna, dados.id);
      const bloco = linhas.splice(cartao.linha, cartao.ate - cartao.linha + 1);
      ({ colunas } = analisar(linhas));
      const destino = acharColuna(colunas, dados.para);
      if (!destino) throw new ErroPainel(MUDOU, 409);
      const pos = Number.isInteger(dados.posicao) ? Math.max(0, dados.posicao) : destino.cartoes.length;
      inserirCartao(linhas, destino, bloco, pos);
      break;
    }
    case 'coluna-adicionar': {
      const nome = md.limparValor(dados.nome);
      if (!nome) throw new ErroPainel('Dê um nome pra coluna.');
      if (acharColuna(colunas, nome)) throw new ErroPainel('Já existe uma coluna com esse nome.');
      while (linhas.length && linhas[linhas.length - 1].trim() === '') linhas.pop();
      linhas.push('', `## ${nome}`, '');
      break;
    }
    case 'coluna-renomear': {
      const nome = md.limparValor(dados.nome);
      const col = acharColuna(colunas, dados.coluna);
      if (!col || !nome) throw new ErroPainel(MUDOU, 409);
      linhas[col.linha] = `## ${nome}`;
      break;
    }
    case 'coluna-apagar': {
      const col = acharColuna(colunas, dados.coluna);
      if (!col) throw new ErroPainel(MUDOU, 409);
      if (col.cartoes.length) throw new ErroPainel('Tire os cartões dessa coluna antes de apagar.');
      let fim = col.linha + 1;
      while (fim < linhas.length && linhas[fim].trim() === '') fim++;
      linhas.splice(col.linha, fim - col.linha);
      break;
    }
    default:
      throw new ErroPainel('Ação desconhecida.');
  }

  md.gravar(abs, linhas, eol);
  return { quadros: listarQuadros() };
}

function novoQuadro(nome) {
  const limpo = md.limparValor(nome);
  if (!limpo) throw new ErroPainel('Dê um nome pro quadro.');
  const rel = `memoria/quadros/${md.slug(limpo)}.md`;
  const abs = path.join(RAIZ, rel);
  if (existe(abs)) throw new ErroPainel('Já existe um quadro com esse nome.');
  md.gravar(abs, [
    '<!-- kanban -->',
    `# ${limpo}`,
    '',
    '> Pra IA: cada "##" é uma coluna e cada "- " é um cartão: `- O que fazer @DD/MM #tag`.',
    '',
    '## A fazer',
    '',
    '## Fazendo',
    '',
    '## Feito',
    '',
  ]);
  return { quadros: listarQuadros(), criado: rel };
}

// Cartões com data que ainda não estão na última coluna (pro cronograma do Dashboard)
function cartoesComData() {
  const out = [];
  for (const q of listarQuadros()) {
    const ultima = q.colunas[q.colunas.length - 1];
    for (const c of q.colunas) {
      if (c === ultima && q.colunas.length > 1) continue;
      for (const k of c.cartoes) if (k.data) out.push({ texto: k.texto, data: k.data, areas: k.areas, quadro: q.titulo, arquivo: q.arquivo, coluna: c.titulo });
    }
  }
  return out;
}

// Quantos cartões estão "fazendo" (coluna com nome de andamento)
function emAndamento() {
  let n = 0;
  for (const q of listarQuadros()) {
    for (const c of q.colunas) {
      const k = md.chave(c.titulo);
      if (/^(fazendo|em andamento|andamento|producao|em producao|doing|desenvolvendo|corrigindo)/.test(k)) n += c.cartoes.length;
    }
  }
  return n;
}

module.exports = { listarQuadros, agir, cartoesComData, emAndamento, ehQuadro, PRINCIPAL };
