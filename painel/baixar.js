#!/usr/bin/env node
// Baixa um vídeo pra estudar, pelo terminal (é o que a IA usa). Quem baixa é o painel: este comando liga ele se
// precisar, pede o download e mostra o andamento. No fim, abre a tela Ferramentas, onde saem as fotos das cenas e a
// transcrição (as duas são feitas no navegador).
//   npm run baixar -- "<link>"              o vídeo, em arquivos/virais/<AAAA-MM-DD-nome>/
//   npm run baixar -- "<link>" --audio      só o áudio
//   npm run baixar -- "<link>" --esperar    espera também as fotos e a transcrição ficarem prontas
//   npm run baixar -- "<link>" --sem-abrir  não abre o navegador
//   npm run baixar -- --lista               os vídeos que já estão na pasta
'use strict';

const http = require('http');
const porta = require('./lib/porta');
const ferramentas = require('./lib/ferramentas');

const args = process.argv.slice(2);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const milhar = (n) => (n == null ? '' : Math.round(n).toLocaleString('pt-BR'));

function pedir(p, metodo, caminho, dados) {
  return new Promise((ok, falha) => {
    const corpo = dados === undefined ? null : JSON.stringify(dados);
    const req = http.request({
      host: '127.0.0.1', port: p, path: caminho, method: metodo, timeout: 30000,
      headers: { Host: `localhost:${p}`, 'X-KeyLab': '1', ...(corpo ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(corpo) } : {}) },
    }, (res) => {
      let texto = '';
      res.on('data', (d) => { texto += d; });
      res.on('end', () => {
        let j = null;
        try { j = JSON.parse(texto); } catch { /* sem json */ }
        if (res.statusCode >= 400) falha(new Error((j && j.erro) || `O painel respondeu ${res.statusCode}.`));
        else ok(j);
      });
    });
    req.on('timeout', () => req.destroy(new Error('O painel não respondeu.')));
    req.on('error', falha);
    if (corpo) req.write(corpo);
    req.end();
  });
}

function situacao(v) {
  const fotos = v.fotos === 'feitas' ? `${v.quadros} fotos das cenas` : v.fotos === 'sem-imagem' ? 'só áudio' : v.fotos === 'erro' ? 'as fotos deram erro' : 'sem as fotos ainda';
  const texto = v.transcricao ? `transcrito (${milhar(v.transcricao.palavras)} palavras)` : 'sem a transcrição ainda';
  return `${fotos} · ${texto}${v.estudado ? ' · estudado' : ''}`;
}

function lista() {
  const l = ferramentas.listarVirais();
  if (!l.length) { console.log('Ainda não tem nenhum vídeo em arquivos/virais/.'); return; }
  for (const v of l) {
    console.log(`arquivos/virais/${v.pasta}/  ${v.site} · ${v.titulo}${v.views != null ? ` · ${milhar(v.views)} views` : ''}\n  ${situacao(v)}`);
  }
}

async function principal() {
  if (args.includes('--lista')) return lista();
  const link = args.find((a) => /https?:\/\//.test(a));
  if (!link) {
    console.log('Uso: npm run baixar -- "<link do vídeo>" [--audio] [--esperar]   ou   npm run baixar -- --lista');
    process.exitCode = 1;
    return;
  }

  const p = await porta.ligarEmSegundoPlano();
  if (!p) throw new Error('Não consegui ligar o painel. Rode: npm run painel');
  const endereco = `${porta.url(p)}/#/ferramentas`;

  console.log('Procurando o vídeo...');
  const t = await pedir(p, 'POST', '/api/ferramentas/baixar', { link, tipo: args.includes('--audio') ? 'audio' : 'video' });
  let ultima = '';
  let x = t;
  for (;;) {
    await espera(700);
    x = await pedir(p, 'GET', `/api/ferramentas/tarefa?id=${encodeURIComponent(t.id)}`);
    if (x.estado === 'sumiu') throw new Error('O download foi cancelado.');
    const linha = `${x.etapa}${x.estado === 'baixando' && x.pct ? ` ${Math.floor(x.pct / 10) * 10}%` : ''}`;
    if (linha !== ultima) { console.log(`  ${linha}`); ultima = linha; }
    if (x.estado === 'erro') throw new Error(x.erro);
    if (x.estado === 'pronto') break;
  }
  if (x.aviso) console.log(`Atenção: ${x.aviso}`);
  console.log(`\nBaixado: arquivos/virais/${x.pasta}/`);

  // As fotos e a transcrição saem no navegador: leva as abas abertas pra tela Ferramentas, ou abre uma
  const r = await pedir(p, 'POST', '/api/ferramentas/mostrar', {});
  if (!r.abas && !args.includes('--sem-abrir')) porta.abrirNavegador(endereco);
  console.log(`As fotos das cenas e a transcrição saem sozinhas no painel, em Ferramentas (${endereco}). Deixe ele aberto.`);

  if (!args.includes('--esperar')) {
    console.log('Pra saber se terminaram: npm run baixar -- --lista');
    return;
  }
  const limite = Date.now() + 30 * 60000;
  let antes = '';
  while (Date.now() < limite) {
    await espera(3000);
    const v = ferramentas.listarVirais().find((i) => i.pasta === x.pasta);
    if (!v) throw new Error('O vídeo saiu da pasta.');
    const agora = situacao(v);
    if (agora !== antes) { console.log(`  ${agora}`); antes = agora; }
    const fotosOk = v.fotos !== 'pendente';
    const textoOk = !!v.transcricao || v.transcrever !== 'auto';
    if (fotosOk && textoOk) { console.log(`\nPronto pra estudar: arquivos/virais/${x.pasta}/info.md`); return; }
  }
  console.log('Ainda não terminou (a primeira transcrição baixa o modelo, que é grande). Confira no painel, em Ferramentas.');
}

principal().catch((e) => {
  console.log(`Não deu: ${e.message}`);
  process.exitCode = 1;
});
