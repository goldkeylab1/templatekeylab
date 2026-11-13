// Em qual porta o painel desta pasta está ligado, e como ligar em segundo plano.
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { RAIZ } = require('./raiz');

const INFO = path.join(RAIZ, 'painel', '.porta');
const LOG = path.join(RAIZ, 'painel', '.painel.log');
const SERVIDOR = path.join(RAIZ, 'painel', 'servidor.js');

function lerInfo() {
  try { return JSON.parse(fs.readFileSync(INFO, 'utf8')); } catch { return null; }
}

function gravarInfo(porta) {
  fs.writeFileSync(INFO, JSON.stringify({ porta, pasta: RAIZ, pid: process.pid, quando: Date.now() }));
}

function apagarInfo() {
  const i = lerInfo();
  if (i && i.pid === process.pid) { try { fs.unlinkSync(INFO); } catch { /* já foi */ } }
}

// Responde com os dados do painel se ele estiver ligado nessa porta
function ping(porta, tempo = 800) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port: porta, path: '/api/ping', headers: { 'X-KeyLab': '1' }, timeout: tempo }, (res) => {
      let corpo = '';
      res.on('data', (d) => { corpo += d; });
      res.on('end', () => { try { resolve(JSON.parse(corpo)); } catch { resolve(null); } });
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

function mesmaPasta(a, b) {
  try { return fs.realpathSync(a) === fs.realpathSync(b); } catch { return a === b; }
}

// Porta do painel DESTA pasta, se estiver ligado
async function portaLigada() {
  const info = lerInfo();
  if (!info || !info.porta) return null;
  const r = await ping(info.porta);
  return r && r.app === 'painel-do-negocio' && mesmaPasta(r.pasta, RAIZ) ? info.porta : null;
}

async function ligarEmSegundoPlano() {
  const ja = await portaLigada();
  if (ja) return ja;
  let saida = 'ignore';
  try { saida = fs.openSync(LOG, 'a'); } catch { /* sem log */ }
  const filho = spawn(process.execPath, [SERVIDOR], {
    cwd: RAIZ,
    detached: true,
    stdio: ['ignore', saida, saida],
    windowsHide: true,
  });
  filho.unref();
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 200));
    const p = await portaLigada();
    if (p) return p;
  }
  return null;
}

function abrirNavegador(url) {
  const plataforma = process.platform;
  let cmd;
  let args;
  if (plataforma === 'darwin') { cmd = 'open'; args = [url]; }
  else if (plataforma === 'win32') { cmd = 'cmd'; args = ['/c', 'start', '', url]; }
  else { cmd = 'xdg-open'; args = [url]; }
  try {
    const p = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true });
    p.on('error', () => {});
    p.unref();
  } catch { /* sem navegador */ }
}

function url(porta) {
  return `http://localhost:${porta}`;
}

module.exports = { lerInfo, gravarInfo, apagarInfo, ping, portaLigada, ligarEmSegundoPlano, abrirNavegador, url, INFO, LOG };
