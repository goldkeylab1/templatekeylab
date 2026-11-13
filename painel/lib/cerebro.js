// "Copiar o cérebro": junta o essencial num texto só, pra colar numa IA de chat.
'use strict';

const path = require('path');
const md = require('./md');
const { RAIZ, existe } = require('./raiz');
const status = require('./status');

const FIXOS = [
  'memoria/preferencias.md',
  'memoria/aprendizados.md',
  'marketing/o-que-funciona.md',
];

function limpar(texto) {
  return texto
    .replace(/<!--[\s\S]*?-->/g, '')
    .split(/\r?\n/)
    .filter((l) => !/^\s*>\s*pra ia\b/i.test(md.semAcento(l)))
    .filter((l) => {
      const c = md.campoDaLinha(l);
      return !c || md.preenchido(c.valor);
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function temConteudo(texto) {
  return texto.split('\n').some((l) => l.trim() && !md.titulo(l) && !l.trim().startsWith('>'));
}

function textoDoCerebro() {
  const arquivos = status.calcular({ comGit: false }).itens.map((i) => i.caminho).filter(Boolean);
  for (const f of FIXOS) if (!arquivos.includes(f)) arquivos.push(f);
  const partes = [
    '# O cérebro do meu negócio',
    '',
    `Copiado do meu painel em ${md.dataBR()}. Use como contexto em tudo que me responder.`,
    'Regras: frases curtas e palavras simples, sem textão. Se faltar informação, pergunte. Nunca invente número.',
    'Quando eu disser algo novo (feedback, ideia, decisão, correção), me diga numa linha o que eu devo anotar e em qual arquivo.',
    '',
  ];
  for (const rel of arquivos) {
    const abs = path.join(RAIZ, rel);
    if (!existe(abs)) continue;
    const t = limpar(md.ler(abs).texto);
    if (!temConteudo(t)) continue;
    partes.push(`---\n\n(arquivo: ${rel})\n\n${t}\n`);
  }
  return partes.join('\n');
}

module.exports = { textoDoCerebro };
