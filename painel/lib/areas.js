// Áreas: toda pasta da raiz com um LEIA-ME.md que tem "Nome no menu" vira um item do menu.
// E a leitura/escrita dos arquivos que o painel mostra.
'use strict';

const fs = require('fs');
const path = require('path');
const md = require('./md');
const { RAIZ, PASTAS_FORA, dentro, relativo, existe, listar } = require('./raiz');
const { ehQuadro } = require('./kanban');
const { ErroPainel } = require('./erro');

const EXT_TEXTO = ['.md', '.csv', '.txt', '.json'];
const LIMITE = 2 * 1024 * 1024;

function valor(linhas, nome) {
  const c = md.campoPorNome(linhas, nome);
  return c && c.preenchido ? c.valor : '';
}

function listaDeTexto(v) {
  return v ? v.split(/[,;]/).map((s) => s.trim().replace(/^`|`$/g, '')).filter(Boolean) : [];
}

function lerArea(dirAbs) {
  const leia = path.join(dirAbs, 'LEIA-ME.md');
  if (!existe(leia)) return null;
  const { linhas } = md.ler(leia);
  const nome = valor(linhas, 'nome no menu');
  if (!nome) return null;
  const pedidos = md.secoesComItens(linhas).find((s) => md.chave(s.titulo).startsWith('pedidos'));
  return {
    id: path.basename(dirAbs),
    pasta: relativo(dirAbs),
    nome,
    icone: md.chave(valor(linhas, 'icone')).replace(/\s+/g, '-') || 'pasta',
    ordem: Number(valor(linhas, 'ordem')) || 60,
    titulo: md.tituloDoArquivo(linhas, nome),
    descricao: md.descricaoDoArquivo(linhas),
    topo: listaDeTexto(valor(linhas, 'mostrar no topo')),
    tambem: listaDeTexto(valor(linhas, 'mostrar tambem')),
    pedidos: pedidos ? pedidos.itens.map((p) => p.replace(/^["“]|["”]$/g, '').replace(/`/g, '')) : [],
    leiame: relativo(leia),
  };
}

function listarAreas() {
  let itens = [];
  try { itens = fs.readdirSync(RAIZ, { withFileTypes: true }); } catch { return []; }
  return itens
    .filter((i) => i.isDirectory() && !i.name.startsWith('.') && !PASTAS_FORA.has(i.name))
    .map((i) => lerArea(path.join(RAIZ, i.name)))
    .filter(Boolean)
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'));
}

// Quanto de um arquivo de perguntas já foi respondido
function statusDoArquivo(linhas) {
  const cs = md.campos(linhas);
  const obrig = cs.filter((c) => !c.opcional);
  const opc = cs.filter((c) => c.opcional);
  const feitos = obrig.filter((c) => c.preenchido).length;
  const opcFeitos = opc.filter((c) => c.preenchido).length;
  let pct = 100;
  if (obrig.length) pct = Math.round((feitos / obrig.length) * 100);
  else if (opc.length) pct = opcFeitos ? 100 : 0;
  return {
    total: obrig.length,
    feitos,
    opcionais: opc.length,
    opcionaisFeitos: opcFeitos,
    pct,
    faltam: obrig.filter((c) => !c.preenchido).map((c) => c.nome),
  };
}

function infoArquivo(abs) {
  const ext = path.extname(abs).toLowerCase();
  const rel = relativo(abs);
  const nome = path.basename(abs);
  let st;
  try { st = fs.statSync(abs); } catch { return null; }
  if (ext !== '.md') {
    return { caminho: rel, titulo: nome, descricao: '', tipo: 'dados', atualizado: st.mtimeMs, tamanho: st.size };
  }
  const { linhas, texto } = md.ler(abs);
  const cfg = md.marcador(texto, 'configurar');
  let tipo = 'texto';
  if (nome.startsWith('_')) tipo = 'molde';
  else if (cfg) tipo = 'configurar';
  else if (ehQuadro(texto)) tipo = 'kanban';
  const info = {
    caminho: rel,
    titulo: md.tituloDoArquivo(linhas, nome.replace(/\.md$/i, '')),
    descricao: md.descricaoDoArquivo(linhas),
    tipo,
    atualizado: st.mtimeMs,
  };
  if (cfg) Object.assign(info, statusDoArquivo(linhas), { ordem: cfg.ordem });
  return info;
}

const PESO = { configurar: 0, kanban: 1, texto: 2, dados: 3, molde: 4 };

function ordenar(lista) {
  return lista.filter(Boolean).sort((a, b) => {
    const la = /LEIA-ME\.md$/.test(a.caminho) ? -1 : 0;
    const lb = /LEIA-ME\.md$/.test(b.caminho) ? -1 : 0;
    if (la !== lb) return la - lb;
    return (PESO[a.tipo] - PESO[b.tipo]) || ((a.ordem || 99) - (b.ordem || 99)) || a.caminho.localeCompare(b.caminho, 'pt-BR');
  });
}

function grupo(dirAbs) {
  const leia = path.join(dirAbs, 'LEIA-ME.md');
  let titulo = path.basename(dirAbs);
  let descricao = '';
  if (existe(leia)) {
    const { linhas } = md.ler(leia);
    titulo = md.tituloDoArquivo(linhas, titulo);
    descricao = md.descricaoDoArquivo(linhas);
  }
  const arquivos = ordenar(listar({ base: dirAbs, profundidade: 2, extensoes: EXT_TEXTO }).map(infoArquivo));
  return { pasta: relativo(dirAbs), titulo, descricao, arquivos };
}

function paginaDaArea(id) {
  const area = listarAreas().find((a) => a.id === id);
  if (!area) throw new ErroPainel('Essa área não existe mais.', 404);
  const dirAbs = path.join(RAIZ, area.pasta);
  const arquivos = [];
  const grupos = [];
  const itens = fs.readdirSync(dirAbs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  for (const it of itens) {
    if (it.name.startsWith('.')) continue;
    const abs = path.join(dirAbs, it.name);
    if (it.isDirectory()) { grupos.push(grupo(abs)); continue; }
    if (it.name === 'LEIA-ME.md') continue;
    if (!EXT_TEXTO.includes(path.extname(it.name).toLowerCase())) continue;
    arquivos.push(infoArquivo(abs));
  }
  const topo = area.topo.map((nome) => {
    const abs = dentro(`${area.pasta}/${nome}`) || dentro(nome);
    if (!abs || !existe(abs)) return null;
    const { texto, linhas } = md.ler(abs);
    return { caminho: relativo(abs), titulo: md.tituloDoArquivo(linhas, nome), texto };
  }).filter(Boolean);
  const tambem = area.tambem.map((rel) => {
    const abs = dentro(rel);
    return abs && existe(abs) ? infoArquivo(abs) : null;
  });
  return { ...area, arquivos: ordenar(arquivos), grupos, topo, tambem: ordenar(tambem) };
}

// ---------- um arquivo ----------

function abrirArquivo(rel, { escrever = false } = {}) {
  const abs = dentro(rel);
  if (!abs || !existe(abs) || fs.statSync(abs).isDirectory()) throw new ErroPainel('Arquivo não encontrado.', 404);
  const ext = path.extname(abs).toLowerCase();
  if (!EXT_TEXTO.includes(ext)) throw new ErroPainel('O painel só mostra arquivos de texto (.md, .csv, .txt).', 400);
  if (escrever && ext !== '.md') throw new ErroPainel('O painel só edita arquivos .md.', 400);
  if (fs.statSync(abs).size > LIMITE) throw new ErroPainel('Arquivo grande demais pra mostrar aqui. Abra no seu editor.', 400);
  return { abs, ext };
}

function areaDoCaminho(rel) {
  const primeira = String(rel).split('/')[0];
  const area = listarAreas().find((a) => a.pasta === primeira);
  return area ? { id: area.id, nome: area.nome } : null;
}

function lerArquivo(rel) {
  const { abs, ext } = abrirArquivo(rel);
  const { texto, linhas } = md.ler(abs);
  const info = infoArquivo(abs);
  return {
    ...info,
    texto,
    versao: md.versao(texto),
    campos: ext === '.md' ? md.campos(linhas) : [],
    area: areaDoCaminho(info.caminho),
  };
}

function salvarCampos(rel, mudancas) {
  const { abs } = abrirArquivo(rel, { escrever: true });
  const { linhas, eol } = md.ler(abs);
  const naoAchou = md.trocarCampos(linhas, mudancas);
  md.gravar(abs, linhas, eol);
  return { ...lerArquivo(rel), naoAchou };
}

function salvarTexto(rel, texto, versaoAntes) {
  const { abs } = abrirArquivo(rel, { escrever: true });
  const atual = md.ler(abs);
  if (versaoAntes && md.versao(atual.texto) !== versaoAntes) {
    throw new ErroPainel('O arquivo mudou enquanto você editava (talvez a IA mexeu). Copie o seu texto, recarregue e tente de novo.', 409);
  }
  const novo = String(texto ?? '').replace(/\r\n/g, '\n');
  md.gravar(abs, atual.eol === '\r\n' ? novo.replace(/\n/g, '\r\n') : novo);
  return lerArquivo(rel);
}

function marcarCaixa(rel, { linha, id, marcado }) {
  const { abs } = abrirArquivo(rel, { escrever: true });
  const { linhas, eol } = md.ler(abs);
  let i = Number.isInteger(linha) && linhas[linha] !== undefined && linhas[linha].trim() === String(id).trim() ? linha : -1;
  if (i < 0) i = linhas.findIndex((l) => l.trim() === String(id).trim());
  if (i < 0) throw new ErroPainel('A linha mudou. Recarreguei: tente de novo.', 409);
  linhas[i] = linhas[i].replace(/\[( |x|X)\]/, marcado ? '[x]' : '[ ]');
  md.gravar(abs, linhas, eol);
  return lerArquivo(rel);
}

module.exports = { listarAreas, paginaDaArea, lerArquivo, salvarCampos, salvarTexto, marcarCaixa, statusDoArquivo, infoArquivo };
