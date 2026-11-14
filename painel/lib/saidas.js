// Saídas: o que a IA criou pro dono (saidas/). Um arquivo por entrega: AAAA-MM-DD-assunto.md
'use strict';

const fs = require('fs');
const path = require('path');
const md = require('./md');
const { RAIZ, dentro, relativo, existe, listar } = require('./raiz');
const { ErroPainel } = require('./erro');

const PASTA = path.join(RAIZ, 'saidas');
const EXT = ['.md', '.txt', '.csv'];

// Tira título, citações, comentários e instruções pra IA: sobra o texto que o dono usa
function textoLimpo(texto) {
  const linhas = String(texto || '').replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/);
  let tirouTitulo = false;
  const out = [];
  for (const l of linhas) {
    if (!tirouTitulo && /^#\s/.test(l)) { tirouTitulo = true; continue; }
    if (/^\s*>\s*pra ia\b/i.test(md.semAcento(l))) continue;
    out.push(l);
  }
  return out.join('\n').replace(/^\s+|\s+$/g, '');
}

function resumo(texto) {
  let limpo = '';
  for (const l of textoLimpo(texto).split(/\r?\n/)) {
    if (!l.trim() || /^\s*(#{1,6}\s|>|\||```|---)/.test(l)) continue;
    const item = /^\s*([-*]|\d+[.)])\s+/.test(l);
    const t = l.replace(/^\s*([-*]|\d+[.)])\s+(\[[ xX]\]\s+)?/, '').replace(/\*\*|__|`/g, '').trim();
    limpo += limpo ? `${item ? ' · ' : ' '}${t}` : t;
  }
  return limpo.length > 180 ? `${limpo.slice(0, 177).replace(/\s+\S*$/, '')}...` : limpo;
}

function dataDoNome(nome) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(nome);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function infoSaida(abs) {
  let st;
  try { st = fs.statSync(abs); } catch { return null; }
  if (st.size > 2 * 1024 * 1024) return null;
  const nome = path.basename(abs);
  const rel = relativo(abs);
  const { texto, linhas } = md.ler(abs);
  const partes = path.relative(PASTA, abs).split(path.sep);
  const semData = nome.replace(/^\d{4}-\d{2}-\d{2}[-_ ]?/, '').replace(/\.[a-z]+$/i, '').replace(/[-_]+/g, ' ').trim();
  return {
    caminho: rel,
    titulo: path.extname(nome).toLowerCase() === '.md' ? md.tituloDoArquivo(linhas, semData || nome) : (semData || nome),
    pasta: partes.length > 1 ? partes[0] : '',
    data: dataDoNome(nome) || md.hojeISO(new Date(st.mtimeMs)),
    atualizado: st.mtimeMs,
    resumo: resumo(texto),
    palavras: textoLimpo(texto).split(/\s+/).filter(Boolean).length,
  };
}

function listarSaidas() {
  if (!existe(PASTA)) return { saidas: [], pastas: [] };
  const lista = listar({ base: PASTA, profundidade: 3, extensoes: EXT })
    .filter((abs) => !/^(LEIA-ME|_)/i.test(path.basename(abs)))
    .map(infoSaida)
    .filter(Boolean)
    .sort((a, b) => b.data.localeCompare(a.data) || b.atualizado - a.atualizado);
  const pastas = [...new Set(lista.map((s) => s.pasta).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return { saidas: lista, pastas };
}

// O texto pronto pra copiar (sem o título e sem as instruções pra IA)
function textoDaSaida(rel) {
  const abs = dentro(rel);
  if (!abs || !abs.startsWith(PASTA + path.sep) || !existe(abs) || !EXT.includes(path.extname(abs).toLowerCase())) {
    throw new ErroPainel('Arquivo não encontrado.', 404);
  }
  // Sem as marcas de negrito do markdown: o texto vai ser colado em rede social, e-mail, WhatsApp
  const texto = textoLimpo(md.ler(abs).texto)
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    .replace(/^#{1,6}\s+/gm, '');
  return { caminho: relativo(abs), texto };
}

module.exports = { listarSaidas, textoDaSaida, textoLimpo };
