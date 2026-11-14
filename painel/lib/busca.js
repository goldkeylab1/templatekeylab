// Busca geral (Cmd+K): procura em todos os arquivos de texto do cérebro.
// Sem acento e sem maiúscula: "estrategia" acha "Estratégia". Todas as palavras precisam aparecer no arquivo.
'use strict';

const fs = require('fs');
const path = require('path');
const md = require('./md');
const { relativo, listar } = require('./raiz');
const { ehQuadro } = require('./kanban');

const EXT = ['.md', '.txt', '.csv'];
const LIMITE_ARQUIVO = 1024 * 1024;
const MAX_RESULTADOS = 30;

// Tira acento letra por letra, sem mudar o tamanho do texto (pra achar a posição certa no original)
function normalizar(s) {
  let out = '';
  for (const c of String(s || '')) {
    const n = c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    out += n.length === c.length ? n : c.toLowerCase().padEnd(c.length, ' ').slice(0, c.length);
  }
  return out;
}

function termosDe(q) {
  return [...new Set(normalizar(q).split(/[^\p{L}\p{N}@#]+/u).filter((t) => t.length >= 2))].slice(0, 6);
}

function trecho(limpa, pos, tamanho = 150) {
  if (limpa.length <= tamanho) return limpa.trim();
  const inicio = Math.max(0, Math.min(pos - 50, limpa.length - tamanho));
  let s = limpa.slice(inicio, inicio + tamanho);
  if (inicio > 0) s = `...${s.replace(/^\S*\s/, '')}`;
  if (inicio + tamanho < limpa.length) s = `${s.replace(/\s\S*$/, '')}...`;
  return s.trim();
}

function procurar(q) {
  const termos = termosDe(q);
  if (!termos.length) return { termos: [], resultados: [] };
  const achados = [];
  for (const abs of listar({ extensoes: EXT, profundidade: 6 })) {
    let st;
    try { st = fs.statSync(abs); } catch { continue; }
    if (st.size > LIMITE_ARQUIVO) continue;
    const rel = relativo(abs);
    let texto;
    try { texto = md.ler(abs).texto; } catch { continue; }
    const norm = normalizar(texto);
    const relNorm = normalizar(rel);
    if (!termos.every((t) => norm.includes(t) || relNorm.includes(t))) continue;

    const linhas = texto.split(/\r?\n/);
    const titulo = path.extname(abs).toLowerCase() === '.md' ? md.tituloDoArquivo(linhas, path.basename(abs)) : path.basename(abs);
    const tituloNorm = normalizar(titulo);
    let pontos = 0;
    for (const t of termos) {
      if (tituloNorm.includes(t)) pontos += 12;
      if (relNorm.includes(t)) pontos += 5;
      let n = 0;
      let i = norm.indexOf(t);
      while (i >= 0 && n < 20) { n++; i = norm.indexOf(t, i + t.length); }
      pontos += n;
    }
    if (path.basename(abs).startsWith('_') || rel.startsWith('modelos/')) pontos -= 8;

    // As linhas com mais palavras da busca viram o trecho (pula comentários e o título)
    const trechos = [];
    let melhor = 0;
    linhas.forEach((l, n) => {
      if (!l.trim() || /^#\s/.test(l) || /<!--/.test(l)) return;
      const ln = normalizar(l);
      const quantos = termos.filter((t) => ln.includes(t)).length;
      if (!quantos) return;
      if (quantos > melhor) { melhor = quantos; trechos.length = 0; }
      if (quantos === melhor && trechos.length < 2) {
        const limpa = l
          .replace(/^\s*(?:[-*+]\s+(?:\[[ xX]\]\s+)?|>\s*|#{2,6}\s+|\d+[.)]\s+)/, '')
          .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
          .replace(/\*\*|__|`/g, '')
          .replace(/\s+/g, ' ');
        const lnLimpa = normalizar(limpa);
        trechos.push({ linha: n, texto: trecho(limpa, lnLimpa.indexOf(termos.find((t) => lnLimpa.includes(t)))) });
      }
    });

    achados.push({
      caminho: rel,
      titulo,
      quadro: path.extname(abs) === '.md' && ehQuadro(texto),
      trechos,
      pontos,
      atualizado: st.mtimeMs,
    });
  }
  achados.sort((a, b) => b.pontos - a.pontos || b.atualizado - a.atualizado);
  return { termos, resultados: achados.slice(0, MAX_RESULTADOS), total: achados.length };
}

module.exports = { procurar, normalizar };
