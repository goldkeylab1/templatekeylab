// Números: lê os placares (marketing/numeros/placar-AAAA-MM-DD.md) pro gráfico.
// O placar tem a tabela "## Os números": | Conteúdo | Data | Rede | Número principal | Outros números |
'use strict';

const fs = require('fs');
const path = require('path');
const md = require('./md');
const { RAIZ, relativo, existe } = require('./raiz');

const PASTA = path.join(RAIZ, 'marketing', 'numeros');

function celulas(l) {
  return l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((s) => s.trim());
}

function ehSeparador(l) {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
}

// "12.300 views" → { valor: 12300, unidade: 'views' }; "12,3 mil" → 12300; "45%" → 45 '%'; "1.2M" → 1200000
function numeroDe(texto) {
  const t = String(texto || '').replace(/\*\*|__|`/g, '').trim();
  const m = /(-?\d[\d.,]*)\s*(mil\b|k\b|milh(?:ão|ao|ões|oes)\b|mi\b|m\b)?/i.exec(t);
  if (!m) return null;
  let s = m[1].replace(/[.,]$/, '');
  const temPonto = s.includes('.');
  const temVirgula = s.includes(',');
  if (temPonto && temVirgula) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (temVirgula) {
    s = /^-?\d{1,3}(,\d{3}){2,}$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (temPonto && /^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  let valor = Number(s);
  if (!Number.isFinite(valor)) return null;
  const mult = md.chave(m[2] || '');
  if (mult === 'mil' || mult === 'k') valor *= 1000;
  else if (mult) valor *= 1000000;
  const resto = t.slice(m.index + m[0].length).trim();
  let unidade = resto.startsWith('%') ? '%' : resto.replace(/^[^\p{L}%]+/u, '').replace(/[.;:,!?)]+$/, '').trim().toLowerCase();
  if (unidade.length > 30) unidade = unidade.slice(0, 30).trim();
  return { valor: Math.round(valor * 100) / 100, unidade };
}

function dataDoPlacar(nome, linhas) {
  const m = /(\d{4})-(\d{2})-(\d{2})/.exec(nome);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const t = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(md.tituloDoArquivo(linhas, ''));
  return t ? md.dataDeTexto(t[1], t[2], t[3]) : null;
}

// Data da linha: sem ano, usa o ano do placar (e volta um ano se ficar depois dele)
function dataDaLinha(texto, dataPlacar) {
  const m = /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/.exec(String(texto || ''));
  if (!m) return null;
  if (m[3] || !dataPlacar) return md.dataDeTexto(m[1], m[2], m[3]);
  const ano = Number(dataPlacar.slice(0, 4));
  let iso = md.dataDeTexto(m[1], m[2], ano);
  if (iso && iso > dataPlacar) iso = md.dataDeTexto(m[1], m[2], ano - 1);
  return iso;
}

function lerPlacar(abs) {
  const { linhas } = md.ler(abs);
  const nome = path.basename(abs);
  const data = dataDoPlacar(nome, linhas);
  const sec = md.acharSecao(linhas, 'Os numeros');
  const pontos = [];
  if (sec) {
    for (let i = sec.inicio + 1; i < sec.fim - 1; i++) {
      if (!linhas[i].includes('|') || !ehSeparador(linhas[i + 1])) continue;
      const cab = celulas(linhas[i]).map(md.chave);
      const col = (comeco) => cab.findIndex((c) => c.startsWith(comeco));
      const iConteudo = col('conteudo');
      const iData = col('data');
      const iRede = col('rede');
      let iPrincipal = col('numero principal');
      if (iPrincipal < 0) iPrincipal = col('numero');
      const extra = iPrincipal >= 0 ? (/\(([^)]+)\)/.exec(celulas(linhas[i])[iPrincipal]) || [])[1] : '';
      for (let j = i + 2; j < sec.fim && linhas[j].includes('|') && linhas[j].trim(); j++) {
        const c = celulas(linhas[j]);
        const n = iPrincipal >= 0 ? numeroDe(c[iPrincipal]) : null;
        if (!n) continue;
        const conteudo = (iConteudo >= 0 ? c[iConteudo] : c[0] || '').replace(/\*\*|__|`/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim();
        if (!conteudo) continue;
        pontos.push({
          conteudo,
          data: (iData >= 0 ? dataDaLinha(c[iData], data) : null) || data,
          rede: iRede >= 0 ? c[iRede] : '',
          valor: n.valor,
          unidade: n.unidade || (extra ? extra.toLowerCase() : ''),
          texto: c[iPrincipal],
          placar: relativo(abs),
        });
      }
      break;
    }
  }
  return { caminho: relativo(abs), titulo: md.tituloDoArquivo(linhas, nome), data, pontos };
}

function lerNumeros() {
  if (!existe(PASTA)) return { placares: [], pontos: [], metricas: [], arquivos: [] };
  let nomes = [];
  try { nomes = fs.readdirSync(PASTA); } catch { nomes = []; }
  const placares = nomes
    .filter((n) => /^placar.*\.md$/i.test(n))
    .map((n) => lerPlacar(path.join(PASTA, n)))
    .sort((a, b) => String(a.data).localeCompare(String(b.data)));

  // O mesmo conteúdo em dois placares: vale o número do placar mais novo
  const porConteudo = new Map();
  for (const p of placares) {
    for (const pt of p.pontos) porConteudo.set(`${md.chave(pt.conteudo)}|${md.chave(pt.rede)}|${md.chave(pt.unidade)}`, pt);
  }
  const pontos = [...porConteudo.values()].sort((a, b) => String(a.data).localeCompare(String(b.data)));

  const contagem = new Map();
  for (const pt of pontos) {
    const k = pt.unidade || '';
    contagem.set(k, (contagem.get(k) || 0) + 1);
  }
  const metricas = [...contagem.entries()].map(([nome, n]) => ({ nome, n })).sort((a, b) => b.n - a.n);

  const arquivos = nomes
    .filter((n) => !n.startsWith('_') && !n.startsWith('.') && n !== 'LEIA-ME.md' && !/^placar/i.test(n))
    .map((n) => ({ caminho: relativo(path.join(PASTA, n)), nome: n }))
    .sort((a, b) => b.nome.localeCompare(a.nome));

  return {
    placares: placares.map(({ pontos: pts, ...resto }) => ({ ...resto, conteudos: pts.length })).reverse(),
    pontos,
    metricas,
    arquivos,
  };
}

module.exports = { lerNumeros, numeroDe };
