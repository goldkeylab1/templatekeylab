// Quanto do cérebro já está configurado (menu "Comece aqui").
// Conta os arquivos com <!-- configurar --> na raiz de cada área (menos projetos/) e o GitHub.
'use strict';

const fs = require('fs');
const path = require('path');
const md = require('./md');
const { RAIZ, relativo } = require('./raiz');
const { listarAreas, statusDoArquivo } = require('./areas');
const git = require('./git');

function itemGitHub(e) {
  let pct = 0;
  let texto = e.resumo || '';
  const faltam = [];
  if (!e.git) faltam.push('Instalar o Git');
  else if (!e.repositorio) faltam.push('Criar o repositório (privado) no GitHub');
  else if (!e.remoto || e.doModelo) { pct = 50; faltam.push('Ligar a pasta no SEU GitHub'); }
  else if (e.visibilidade === 'publico') { pct = 50; faltam.push('Deixar o repositório privado'); }
  else { pct = 100; texto = 'Ligado ao seu GitHub.'; }
  return { tipo: 'github', titulo: 'GitHub', area: 'Backup', icone: 'nuvem', caminho: null, pct, texto, faltam, total: 1, feitos: pct === 100 ? 1 : 0 };
}

function calcular({ comGit = true } = {}) {
  const itens = [];
  for (const area of listarAreas()) {
    if (area.id === 'projetos') continue;
    const dir = path.join(RAIZ, area.pasta);
    const daArea = [];
    let nomes = [];
    try { nomes = fs.readdirSync(dir); } catch { continue; }
    for (const n of nomes) {
      if (!n.endsWith('.md') || n === 'LEIA-ME.md' || n.startsWith('_')) continue;
      const abs = path.join(dir, n);
      const { texto, linhas } = md.ler(abs);
      const cfg = md.marcador(texto, 'configurar');
      if (!cfg) continue;
      daArea.push({
        tipo: 'arquivo',
        ordem: cfg.ordem,
        caminho: relativo(abs),
        titulo: md.tituloDoArquivo(linhas, n.replace(/\.md$/, '')),
        descricao: md.descricaoDoArquivo(linhas),
        area: area.nome,
        areaId: area.id,
        icone: area.icone,
        ...statusDoArquivo(linhas),
      });
    }
    daArea.sort((a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo, 'pt-BR'));
    itens.push(...daArea);
  }
  if (comGit) itens.push(itemGitHub(git.estado()));
  const pct = itens.length ? Math.round(itens.reduce((s, i) => s + i.pct, 0) / itens.length) : 0;
  return {
    pct,
    prontos: itens.filter((i) => i.pct === 100).length,
    total: itens.length,
    itens,
    proximo: itens.find((i) => i.pct < 100) || null,
  };
}

module.exports = { calcular };
