// Fica de olho na pasta: quando a IA (ou você) muda um arquivo, o painel se atualiza sozinho.
'use strict';

const fs = require('fs');
const path = require('path');
const { RAIZ, listar } = require('./raiz');

function ignorar(rel) {
  return !rel
    || rel === '.git' || rel.startsWith('.git/')
    || rel.includes('node_modules')
    || (rel.startsWith('painel/.') && rel !== 'painel/.anotador.log')
    || rel.startsWith('.claude/')
    // as ferramentas escrevem muito ali (o download, as fotos): a tela Ferramentas acompanha sozinha
    || rel === '.ferramentas' || rel.startsWith('.ferramentas/')
    || rel === 'arquivos/virais' || rel.startsWith('arquivos/virais/')
    || rel === 'arquivos/transcricoes' || rel.startsWith('arquivos/transcricoes/')
    || rel.endsWith('.DS_Store')
    || /\.tmp-\d+-\d+$/.test(rel);
}

function assinatura() {
  let s = '';
  for (const abs of listar({ extensoes: ['.md', '.csv', '.txt', '.js', '.css', '.html'], profundidade: 5 })) {
    try { s += `${abs}:${fs.statSync(abs).mtimeMs};`; } catch { /* sumiu */ }
  }
  return s;
}

// aoMudar(listaDeArquivos) é chamado no máximo uma vez a cada 250 ms
function vigiar(aoMudar) {
  let relogio = null;
  const mudados = new Set();
  const avisar = (nome) => {
    const rel = String(nome || '').split(path.sep).join('/');
    if (ignorar(rel)) return;
    mudados.add(rel);
    clearTimeout(relogio);
    relogio = setTimeout(() => {
      const lista = [...mudados];
      mudados.clear();
      aoMudar(lista);
    }, 250);
  };
  try {
    const w = fs.watch(RAIZ, { recursive: true }, (_ev, nome) => avisar(nome && nome.toString()));
    w.on('error', () => {});
    return;
  } catch { /* sem watch recursivo: confere de tempos em tempos */ }
  let atual = assinatura();
  setInterval(() => {
    const nova = assinatura();
    if (nova !== atual) { atual = nova; aoMudar(['?']); }
  }, 2500).unref();
}

module.exports = { vigiar };
