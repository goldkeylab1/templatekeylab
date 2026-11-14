#!/usr/bin/env node
// Resumo curto pra IA no começo da conversa: o que falta configurar, o que tem pra hoje,
// o GitHub e o link do painel (que ele liga se estiver desligado e abre no navegador se não tiver aba aberta).
// Na primeira vez (nada configurado), pede pra IA guiar o dono na configuração, sem esperar ele pedir.
//   node painel/contexto.js               resumo + liga o painel (e abre no navegador, se não estiver aberto)
//   node painel/contexto.js --sem-painel  só o resumo
//   node painel/contexto.js --sem-abrir   liga o painel, mas não abre o navegador
// No Claude Code, roda sozinho (gancho SessionStart). Retomar ou resumir a conversa não reabre o navegador.
'use strict';

const md = require('./lib/md');
const status = require('./lib/status');
const cronograma = require('./lib/cronograma');
const registros = require('./lib/registros');
const testes = require('./lib/testes');
const git = require('./lib/git');
const porta = require('./lib/porta');
const pref = require('./lib/preferencias');

// O gancho do Claude Code manda um JSON pela entrada (com "source": startup, resume, clear ou compact)
function lerEntrada() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) { resolve({}); return; }
    let txt = '';
    let feito = false;
    const fim = () => {
      if (feito) return;
      feito = true;
      try { process.stdin.destroy(); } catch { /* já fechou */ }
      try { resolve(JSON.parse(txt || '{}')); } catch { resolve({}); }
    };
    setTimeout(fim, 600);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (d) => { txt += d; });
    process.stdin.on('end', fim);
    process.stdin.on('error', fim);
  });
}

// Primeira vez: nenhuma pergunta de configurar respondida ainda
function ehPrimeiraVez(st) {
  const arquivos = st.itens.filter((i) => i.tipo === 'arquivo');
  return arquivos.length > 0 && arquivos.every((i) => !i.feitos);
}

const PRIMEIRA_VEZ = 'PRIMEIRA VEZ: o dono acabou de abrir esta pasta e ainda não configurou nada. Guie ele agora, sem esperar ele pedir. Na sua primeira resposta, qualquer que seja a mensagem dele: (1) boas-vindas em até 2 linhas (esta pasta é o cérebro do negócio dele, e o painel mostra tudo); (2) mande o link do painel e diga se ele já abriu no navegador (a linha "Painel" abaixo diz); (3) comece a receita receitas/configurar.md já fazendo a primeira pergunta (o tipo de negócio, com as opções numeradas). Se ele pediu outra coisa específica, faça primeiro e depois comece a configuração.';

async function abasAbertas(p) {
  const r = await porta.ping(p, 1000);
  return r && typeof r.abas === 'number' ? r.abas : 0;
}

// Liga o painel e, se nenhuma aba estiver aberta, abre no navegador
async function painel({ abrir }) {
  const jaEstava = await porta.portaLigada();
  const p = jaEstava || await porta.ligarEmSegundoPlano();
  if (!p) return { porta: null };
  if (!abrir) return { porta: p, aberto: null };
  // painel que acabou de ligar: dá tempo pras abas que já estavam abertas se reconectarem
  if (!jaEstava) await new Promise((r) => setTimeout(r, 2500));
  if (await abasAbertas(p)) return { porta: p, aberto: 'ja' };
  if (process.env.PAINEL_SEM_NAVEGADOR === '1') return { porta: p, aberto: 'abriria' }; // pra testar sem abrir janela
  porta.abrirNavegador(porta.url(p));
  return { porta: p, aberto: 'agora' };
}

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
  const entrada = await lerEntrada();
  const linhas = ['[Painel do negócio] Resumo pra IA (regras em AGENTS.md):'];
  let primeiraVez = false;
  try {
    const st = status.calcular();
    primeiraVez = ehPrimeiraVez(st);
    if (primeiraVez) linhas.push(PRIMEIRA_VEZ);
    linhas.push(linhaDoStatus(st));
  } catch (e) { linhas.push(`Configuração: não consegui ler (${e.message}).`); }
  try { linhas.push(linhaDoDia()); } catch { /* sem cronograma */ }
  try { const r = linhaDosRegistros(); if (r) linhas.push(r); } catch { /* sem feedbacks */ }
  try { const r = linhaDosPrazos(); if (r) linhas.push(r); } catch { /* sem testes */ }
  try { linhas.push(linhaDoGit()); } catch { /* sem git */ }
  if (process.env.PAINEL_CHAT === '1') {
    // A conversa vem do chat que fica dentro do painel: o dono já está com ele aberto
    linhas.push('Painel: o dono está conversando pelo chat que fica dentro do painel. Não mande o link do painel.');
  } else if (!process.argv.includes('--sem-painel')) {
    // Abre no navegador no começo de uma conversa (não ao retomar ou resumir), se o dono não desligou
    const comeco = !entrada.source || ['startup', 'clear'].includes(entrada.source);
    const abrir = comeco && !process.argv.includes('--sem-abrir') && !pref.nao(pref.ler('abrir o painel sozinho'));
    try {
      const r = await painel({ abrir });
      if (!r.porta) linhas.push('Painel: não ligou. Peça pro dono dar dois cliques em ABRIR-PAINEL (receitas/abrir-painel.md).');
      else {
        const url = porta.url(r.porta);
        const como = { agora: 'abri no navegador agora', abriria: 'abriria no navegador agora', ja: 'já está aberto numa aba do navegador' }[r.aberto];
        const dizer = r.aberto ? ' e diga que o painel está aberto no navegador' : ' (está ligado, mas não abri no navegador: diga pro dono clicar no link)';
        linhas.push(`Painel: ${url}${como ? ` (${como})` : ''}. Ponha esse link no fim da sua primeira resposta${primeiraVez ? dizer : ''}.`);
      }
    } catch { linhas.push('Painel: não ligou. Peça pro dono dar dois cliques em ABRIR-PAINEL.'); }
  }
  console.log(linhas.join('\n'));
}

principal();
