#!/usr/bin/env node
// Salva a pasta no GitHub (guarda as mudanças e envia).
//   node painel/salvar.js                    salva agora
//   node painel/salvar.js "mensagem"         salva com uma mensagem
//   node painel/salvar.js --auto             só salva se "Salvar no GitHub sozinho: sim" (memoria/preferencias.md)
//   node painel/salvar.js --auto --fundo     o mesmo, sem segurar a IA esperando
'use strict';

const path = require('path');
const { spawn } = require('child_process');
const git = require('./lib/git');

const args = process.argv.slice(2);
const auto = args.includes('--auto');
const fundo = args.includes('--fundo');
const mensagem = args.filter((a) => !a.startsWith('--')).join(' ').trim();

async function principal() {
  // dentro da sessão escondida do anotador, quem salva é o próprio anotador (quando termina)
  if (auto && process.env.PAINEL_ANOTADOR === '1') return;
  if (fundo) {
    const filho = spawn(process.execPath, [path.join(__dirname, 'salvar.js'), ...args.filter((a) => a !== '--fundo')], {
      detached: true, stdio: 'ignore', windowsHide: true,
    });
    filho.unref();
    return;
  }

  if (auto) {
    const e = git.estado();
    if (!e.salvarSozinho || !git.ligado(e) || !e.mudancas) return; // nada a fazer, em silêncio
    try {
      const r = await git.salvar({ auto: true });
      git.registrarSalvarSozinho({ ok: true, passos: r.passos });
    } catch (err) {
      git.registrarSalvarSozinho({ ok: false, erro: err.message });
    }
    return;
  }

  try {
    const r = await git.salvar({ mensagem: mensagem || undefined, interativo: true });
    console.log(r.aviso || `Salvo: ${r.passos.length ? r.passos.join(' e ') : 'já estava tudo salvo'}.`);
  } catch (err) {
    console.log(err.message);
    process.exitCode = 1;
  }
}

principal();
