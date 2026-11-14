// "Pra arrumar": o que está velho ou esquecido no cérebro (a receita revisar-tudo, só que sem pedir).
// Cada aviso: { id, icone, texto, detalhe, href, pedido }. Sem aviso, o Dashboard nem mostra o quadro.
'use strict';

const fs = require('fs');
const path = require('path');
const md = require('./md');
const { RAIZ } = require('./raiz');
const cronograma = require('./cronograma');
const registros = require('./registros');
const testes = require('./testes');
const numeros = require('./numeros');
const status = require('./status');

const DIA = 86400000;

function diasDesde(iso, hoje) {
  if (!iso) return 0;
  return Math.round((new Date(`${hoje}T12:00:00`) - new Date(`${iso}T12:00:00`)) / DIA);
}

function plural(n, um, varios) { return `${n} ${n === 1 ? um : varios}`; }

function avisos() {
  const hoje = md.hojeISO();
  const out = [];

  // 1. Testes que passaram do dia de julgar
  const t = testes.lerTestes().abertos.filter((x) => x.julgar && x.julgar < hoje);
  if (t.length) {
    out.push({
      id: 'testes',
      icone: 'alvo',
      texto: `${plural(t.length, 'teste passou', 'testes passaram')} do dia de julgar`,
      detalhe: t.slice(0, 3).map((x) => x.titulo).join(', '),
      href: '#/testes',
      pedido: 'Julgue os testes de marketing/testes.md que passaram do dia de julgar, com os meus números. Anote o resultado, a decisão e atualize o o-que-funciona.md.',
    });
  }

  // 2. Decisões com o dia de rever vencido
  const d = testes.lerDecisoes().filter((x) => x.rever && x.rever < hoje);
  if (d.length) {
    out.push({
      id: 'decisoes',
      icone: 'relogio',
      texto: `${plural(d.length, 'decisão', 'decisões')} pra rever`,
      detalhe: d.slice(0, 3).map((x) => x.titulo).join(', '),
      href: `#/arquivo?c=${encodeURIComponent('memoria/decisoes.md')}`,
      pedido: 'Vamos rever as decisões de memoria/decisoes.md que chegaram no dia de rever. Mostre o número que ia julgar cada uma e me diga se ela continua valendo.',
    });
  }

  // 3. Tarefas atrasadas há mais de 2 semanas
  const velhas = cronograma.ler().tarefas.filter((x) => x.data && diasDesde(x.data, hoje) > 14);
  if (velhas.length) {
    out.push({
      id: 'tarefas',
      icone: 'calendario',
      texto: `${plural(velhas.length, 'tarefa atrasada', 'tarefas atrasadas')} há mais de 2 semanas`,
      detalhe: 'Ainda valem? Mude a data ou apague.',
      href: null,
      pedido: 'Revise as tarefas atrasadas há mais de 2 semanas no memoria/cronograma.md: me pergunte uma por uma se ainda vale, se muda de data ou se sai.',
    });
  }

  // 4. Feedbacks novos esquecidos
  const fb = registros.lerFeedbacks().feedbacks.filter((x) => md.chave(x.status) === 'novo' && diasDesde(testes.dataDoCampo(x.data), hoje) > 14);
  if (fb.length) {
    out.push({
      id: 'feedbacks',
      icone: 'conversa',
      texto: `${plural(fb.length, 'feedback novo', 'feedbacks novos')} esperando há mais de 2 semanas`,
      detalhe: 'Ninguém viu o que eles ensinam.',
      href: '#/feedbacks',
      pedido: 'Leia os feedbacks com status "novo" em memoria/feedbacks.md. Pra cada um, diga o que ele ensina, anote nos aprendizados certos (só com prova) e mude o status.',
    });
  }

  // 5. Ideias paradas
  const ideias = registros.lerIdeias().ideias.filter((x) => md.chave(x.status) === 'nova' && diasDesde(testes.dataDoCampo(x.data), hoje) > 60);
  if (ideias.length) {
    out.push({
      id: 'ideias',
      icone: 'lampada',
      texto: `${plural(ideias.length, 'ideia parada', 'ideias paradas')} há mais de 2 meses`,
      detalhe: 'Decida: testar, guardar ou descartar.',
      href: '#/ideias',
      pedido: 'Avalie as ideias com status "nova" há mais de 2 meses em memoria/ideias.md: pra cada uma, o que sustenta, o que derruba e se vale um teste pequeno.',
    });
  }

  // 6. Números sem análise (só avisa se já teve algum placar)
  const placares = numeros.lerNumeros().placares;
  if (placares.length && placares[0].data) {
    const dias = diasDesde(placares[0].data, hoje);
    if (dias > 14) {
      out.push({
        id: 'numeros',
        icone: 'grafico',
        texto: `Faz ${dias} dias que os números não são analisados`,
        detalhe: `Último placar: ${placares[0].titulo}`,
        href: '#/numeros',
        pedido: 'Analise os meus números (vou mandar o arquivo ou o print).',
      });
    }
  }

  // 7. O briefing parado há mais de 4 meses (só o que já foi preenchido)
  let st = { itens: [] };
  try { st = status.calcular({ comGit: false }); } catch { /* segue */ }
  const parados = [];
  for (const i of st.itens) {
    if (i.tipo !== 'arquivo' || i.pct < 50) continue;
    let mtime = 0;
    try { mtime = fs.statSync(path.join(RAIZ, i.caminho)).mtimeMs; } catch { continue; }
    const dias = Math.round((Date.now() - mtime) / DIA);
    if (dias > 120) parados.push({ ...i, dias });
  }
  if (parados.length) {
    parados.sort((a, b) => b.dias - a.dias);
    out.push({
      id: 'briefing',
      icone: 'maleta',
      texto: `${plural(parados.length, 'parte do briefing não muda', 'partes do briefing não mudam')} há mais de 4 meses`,
      detalhe: parados.slice(0, 3).map((x) => x.titulo).join(', '),
      href: parados.length === 1 ? `#/arquivo?c=${encodeURIComponent(parados[0].caminho)}` : '#/area/negocio',
      pedido: `Revise ${parados.map((x) => x.caminho).join(', ')}: me pergunte o que mudou no negócio desde a última vez e atualize.`,
    });
  }

  return out;
}

module.exports = { avisos };
