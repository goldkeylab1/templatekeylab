#!/usr/bin/env node
// Liga o painel em segundo plano (a janela pode fechar) e mostra o endereço.
//   node painel/ligar.js            liga (se ainda não estiver ligado)
//   node painel/ligar.js --abrir    liga e abre no navegador
//   node painel/ligar.js --parar    desliga
'use strict';

const http = require('http');
const porta = require('./lib/porta');

async function parar() {
  const p = await porta.portaLigada();
  if (!p) { console.log('O painel já estava desligado.'); return; }
  await new Promise((resolve) => {
    const req = http.request({ host: '127.0.0.1', port: p, path: '/api/desligar', method: 'POST', headers: { 'X-KeyLab': '1', Host: `localhost:${p}`, 'Content-Type': 'application/json' } }, (res) => { res.resume(); res.on('end', resolve); });
    req.on('error', resolve);
    req.end('{}');
  });
  console.log('Painel desligado.');
}

async function principal() {
  if (process.argv.includes('--parar')) return parar();
  const p = await porta.ligarEmSegundoPlano();
  if (!p) {
    console.log('Não consegui ligar o painel. Rode "npm start" pra ver o erro, ou peça ajuda pra IA.');
    process.exitCode = 1;
    return;
  }
  const endereco = porta.url(p);
  console.log(`Painel ligado: ${endereco}`);
  if (process.argv.includes('--abrir')) {
    porta.abrirNavegador(endereco);
    console.log('Abri no navegador. Pode fechar essa janela.');
  }
}

principal();
