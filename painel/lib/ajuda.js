// Perguntas e respostas do menu Ajuda (AJUDA.md na raiz).
//   ## Tema
//   ### Pergunta?
//   Resposta curta.
//   Peça pra IA: `o pedido pronto`
'use strict';

const path = require('path');
const md = require('./md');
const { RAIZ, existe } = require('./raiz');

const ARQUIVO = path.join(RAIZ, 'AJUDA.md');
const RE_PEDIDO = /^\s*(?:>\s*)?(?:\*\*)?pe[çc]a (?:pra|para|à|a) ia:?(?:\*\*)?:?\s*(.*)$/i;

function lerAjuda() {
  if (!existe(ARQUIVO)) return { temas: [] };
  const { linhas } = md.ler(ARQUIVO);
  const at = md.ativas(linhas);
  const temas = [];
  let tema = null;
  let pergunta = null;
  for (let i = 0; i < linhas.length; i++) {
    if (!at[i]) continue;
    const t = md.titulo(linhas[i]);
    if (t && t.nivel === 2) { tema = { titulo: t.texto, perguntas: [] }; temas.push(tema); pergunta = null; continue; }
    if (t && t.nivel === 3 && tema) { pergunta = { pergunta: t.texto, resposta: [], pedido: '' }; tema.perguntas.push(pergunta); continue; }
    if (!pergunta) continue;
    const p = RE_PEDIDO.exec(linhas[i]);
    if (p) { pergunta.pedido = p[1].trim().replace(/^[`"“]+|[`"”]+$/g, ''); continue; }
    pergunta.resposta.push(linhas[i]);
  }
  for (const tm of temas) for (const q of tm.perguntas) q.resposta = q.resposta.join('\n').trim();
  return { temas };
}

module.exports = { lerAjuda };
