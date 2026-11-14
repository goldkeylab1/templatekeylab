// Preferências do dono (memoria/preferencias.md), seção "Configurações".
'use strict';

const path = require('path');
const md = require('./md');
const { RAIZ, existe } = require('./raiz');

const ARQUIVO = path.join(RAIZ, 'memoria', 'preferencias.md');

const MOLDE = `# Preferências

> Como você gosta que a IA e o painel trabalhem.

## Do meu jeito

## Configurações
- **Salvar no GitHub sozinho:**
- **Anotar sozinho:** sim
- **Modelo do anotador:** haiku
- **Usar as cores da marca no painel:** sim
- **Nome no painel (opcional):**
`;

function ler(nome) {
  if (!existe(ARQUIVO)) return '';
  const { linhas } = md.ler(ARQUIVO);
  const c = md.campoPorNome(linhas, nome);
  return c && c.preenchido ? c.valor : '';
}

function gravar(nome, valor, rotulo) {
  if (!existe(ARQUIVO)) md.gravar(ARQUIVO, MOLDE);
  const { linhas, eol } = md.ler(ARQUIVO);
  md.trocarCampoPorNome(linhas, nome, valor, { rotuloNovo: rotulo || nome, secaoNova: 'Configurações' });
  md.gravar(ARQUIVO, linhas, eol);
}

function sim(v) {
  return /^(sim|s|yes|y|true|ligado|ligada|1)\b/.test(md.semAcento(String(v || '')).trim().toLowerCase());
}

function nao(v) {
  return /^(nao|n|no|false|desligado|desligada|0)\b/.test(md.semAcento(String(v || '')).trim().toLowerCase());
}

module.exports = { ler, gravar, sim, nao, ARQUIVO };
