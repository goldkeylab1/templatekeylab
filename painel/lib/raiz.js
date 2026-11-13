// Onde fica a pasta do cérebro e como achar arquivos dentro dela com segurança.
'use strict';

const path = require('path');
const fs = require('fs');

// A raiz é a pasta acima de painel/
const RAIZ = path.resolve(__dirname, '..', '..');

// Pastas que o painel nunca mostra nem altera
const PASTAS_FORA = new Set(['.git', 'node_modules', '.claude', 'painel', '.github', '.vscode', '.idea']);

// Devolve o caminho absoluto de um arquivo da pasta, ou null se ele sair da pasta
// ou entrar numa pasta escondida/proibida.
function dentro(relativo) {
  if (typeof relativo !== 'string' || !relativo.trim()) return null;
  const limpo = relativo.replace(/\\/g, '/').replace(/^\/+/, '');
  const abs = path.resolve(RAIZ, limpo);
  const rel = path.relative(RAIZ, abs);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  const partes = rel.split(path.sep);
  if (partes.some((p) => p.startsWith('.') || PASTAS_FORA.has(p))) return null;
  return abs;
}

// Caminho relativo à raiz, sempre com "/"
function relativo(abs) {
  return path.relative(RAIZ, abs).split(path.sep).join('/');
}

function existe(abs) {
  try { fs.accessSync(abs); return true; } catch { return false; }
}

// Lista arquivos .md (e outros, se pedir) da pasta, sem entrar nas pastas proibidas
function listar({ extensoes = ['.md'], profundidade = 4, base = RAIZ } = {}) {
  const achados = [];
  const andar = (dir, nivel) => {
    if (nivel > profundidade || achados.length > 3000) return;
    let itens = [];
    try { itens = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const it of itens) {
      if (it.name.startsWith('.') || PASTAS_FORA.has(it.name)) continue;
      const abs = path.join(dir, it.name);
      if (it.isDirectory()) andar(abs, nivel + 1);
      else if (extensoes.includes(path.extname(it.name).toLowerCase())) achados.push(abs);
    }
  };
  andar(base, 1);
  return achados;
}

module.exports = { RAIZ, PASTAS_FORA, dentro, relativo, existe, listar };
