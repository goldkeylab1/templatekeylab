#!/usr/bin/env node
// Resumo curto pra IA no começo da conversa: o que falta configurar, o que tem pra hoje,
// o GitHub e o link do painel (que ele liga se estiver desligado).
//   node painel/contexto.js               resumo + liga o painel
//   node painel/contexto.js --sem-painel  só o resumo
'use strict';

const md = require('./lib/md');
const status = require('./lib/status');
const cronograma = require('./lib/cronograma');
const registros = require('./lib/registros');
const testes = require('./lib/testes');
const git = require('./lib/git');
const porta = require('./lib/porta');

function linhaDoStatus(st) {
  if (st.pct >= 100) return 'Configuração: 100% (tudo pronto).';
  const faltam = st.itens.filter((i) => i.pct < 100).map((i) => (i.tipo === 'github' ? 'GitHub' : `${i.titulo} (${i.caminho}, faltam ${i.total - i.feitos})`));
  return `Configuração: ${st.pct}%. Falta: ${faltam.join('; ')}.`;
}

function linhaDoDia() {
  const c = cronograma.ler();
  const hoje = md.hojeISO();
  const atrasadas = c.tarefas.filter((t) => t.data && t.data < hoje).length;
  const deHoje = c.tarefas.filter((t) => t.data === hoje).length;
  const partes = [`Hoje (${md.dataBR(new Date(), { ano: false })}): ${deHoje} ${deHoje === 1 ? 'tarefa' : 'tarefas'}`];
  if (atrasadas) partes.push(`${atrasadas} ${atrasadas === 1 ? 'atrasada' : 'atrasadas'}`);
  if (c.decisoes.length) partes.push(`${c.decisoes.length} ${c.decisoes.length === 1 ? 'decisão' : 'decisões'} pra tomar`);
  partes.push(`${c.tarefas.length} no total (memoria/cronograma.md)`);
  return `${partes.join(', ')}.`;
}

function linhaDosRegistros() {
  const novos = registros.lerFeedbacks().feedbacks.filter((f) => md.chave(f.status) === 'novo').length;
  return novos ? `Feedbacks novos sem olhar: ${novos} (memoria/feedbacks.md).` : '';
}

function linhaDosPrazos() {
  const hoje = md.hojeISO();
  const vencidos = testes.prazos().filter((p) => p.data <= hoje);
  if (!vencidos.length) return '';
  const t = vencidos.filter((p) => p.tipo === 'teste').length;
  const d = vencidos.filter((p) => p.tipo === 'decisao').length;
  const partes = [];
  if (t) partes.push(`${t} ${t === 1 ? 'teste' : 'testes'} pra julgar (marketing/testes.md)`);
  if (d) partes.push(`${d} ${d === 1 ? 'decisão' : 'decisões'} pra rever (memoria/decisoes.md)`);
  return `Prazos vencidos: ${partes.join(', ')}. Lembre o dono.`;
}

function linhaDoGit() {
  const e = git.estado();
  if (git.ligado(e)) {
    const auto = e.salvarSozinho ? 'salvar sozinho: ligado' : 'salvar sozinho: desligado';
    const mud = e.mudancas ? ` ${e.mudancas} ${e.mudancas === 1 ? 'mudança' : 'mudanças'} sem salvar.` : '';
    return `GitHub: ligado (${auto}).${mud}`;
  }
  if (e.visibilidade === 'publico') return 'GitHub: ATENÇÃO, o repositório está público. Avise o dono pra deixar privado.';
  return `GitHub: ${e.resumo} Ofereça ajuda uma vez (receitas/salvar-no-github.md).`;
}

async function principal() {
  if (process.env.PAINEL_ANOTADOR === '1') return; // a sessão escondida do anotador não precisa do resumo
  const linhas = ['[Painel do negócio] Resumo pra IA (regras em AGENTS.md):'];
  try { linhas.push(linhaDoStatus(status.calcular())); } catch (e) { linhas.push(`Configuração: não consegui ler (${e.message}).`); }
  try { linhas.push(linhaDoDia()); } catch { /* sem cronograma */ }
  try { const r = linhaDosRegistros(); if (r) linhas.push(r); } catch { /* sem feedbacks */ }
  try { const r = linhaDosPrazos(); if (r) linhas.push(r); } catch { /* sem testes */ }
  try { linhas.push(linhaDoGit()); } catch { /* sem git */ }
  if (process.env.PAINEL_CHAT === '1') {
    // A conversa vem do chat que fica dentro do painel: o dono já está com ele aberto
    linhas.push('Painel: o dono está conversando pelo chat que fica dentro do painel. Não mande o link do painel.');
  } else if (!process.argv.includes('--sem-painel')) {
    try {
      const p = await porta.ligarEmSegundoPlano();
      linhas.push(p ? `Painel: ${porta.url(p)} (ponha esse link no fim da sua primeira resposta).` : 'Painel: não ligou (rode npm start pra ver o erro).');
    } catch { linhas.push('Painel: não ligou.'); }
  }
  console.log(linhas.join('\n'));
}

principal();
