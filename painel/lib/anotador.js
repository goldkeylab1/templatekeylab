// O anotador visto pelo painel: se está ligado, por que não roda e o que ele anotou (painel/.anotador.log).
// Quem anota é o painel/anotar.js, chamado pelos ganchos do Claude Code.
'use strict';

const fs = require('fs');
const path = require('path');
const { RAIZ } = require('./raiz');
const pref = require('./preferencias');
const { ErroPainel } = require('./erro');

const LOG = path.join(RAIZ, 'painel', '.anotador.log');
const TRAVA = path.join(RAIZ, 'painel', '.anotador.lock');
const MODELOS = [
  { id: 'haiku', nome: 'Haiku', dica: 'barato e rápido (recomendado)' },
  { id: 'sonnet', nome: 'Sonnet', dica: 'mais cuidadoso, gasta mais' },
];

function rodando() {
  try {
    const t = JSON.parse(fs.readFileSync(TRAVA, 'utf8'));
    process.kill(t.pid, 0);
    return true;
  } catch { return false; }
}

function ultimos(n = 30) {
  let linhas = [];
  try { linhas = fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean); } catch { return []; }
  return linhas.slice(-n).reverse().map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

function estado({ git, temClaude } = {}) {
  const ligado = !pref.nao(pref.ler('anotar sozinho'));
  const modelo = pref.ler('modelo do anotador') || 'haiku';
  let motivo = null;
  if (!ligado) motivo = 'desligado';
  else if (git && git.doModelo) motivo = 'modelo';
  else if (temClaude === false) motivo = 'sem-claude';
  const lista = ultimos();
  return {
    ligado,
    funcionando: !motivo,
    motivo,
    modelo,
    modelos: MODELOS.some((m) => m.id === modelo) ? MODELOS : [...MODELOS, { id: modelo, nome: modelo }],
    rodando: rodando(),
    ultimos: lista,
    anotadosNaSemana: lista.filter((e) => Date.now() - e.quando < 7 * 86400000).reduce((s, e) => s + (e.itens || []).length, 0),
  };
}

function ajustar({ ligado, modelo } = {}) {
  if (typeof ligado === 'boolean') pref.gravar('anotar sozinho', ligado ? 'sim' : 'não', 'Anotar sozinho');
  if (modelo !== undefined) {
    const m = String(modelo).trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9._:[\]-]{0,79}$/.test(m)) throw new ErroPainel('Nome de modelo inválido.');
    pref.gravar('modelo do anotador', m, 'Modelo do anotador');
  }
  return { ok: true };
}

module.exports = { estado, ajustar, ultimos };
