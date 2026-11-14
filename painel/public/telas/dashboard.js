// Dashboard: o cronograma (lista e calendário), os números do dia e o resumo do resto.
import { h, ic, api, aviso, falhou, cabeca, janela, confirmar, copiar, hoje, somarDias, dataDe, isoDe, dataCurta, diaDaSemana, nomeDoMes, NOMES_SEMANA, quandoFoi, pedirIA } from '../ui.js';

const vista = {
  get modo() { try { return localStorage.getItem('keylab-cronograma') || 'lista'; } catch { return 'lista'; } },
  set modo(v) { try { localStorage.setItem('keylab-cronograma', v); } catch { /* sem guardar */ } },
  dia: null,
  mes: null,
};

function saudacao() {
  const hr = new Date().getHours();
  if (hr < 12) return 'Bom dia';
  if (hr < 18) return 'Boa tarde';
  return 'Boa noite';
}

function hojePorExtenso() {
  const d = new Date();
  const dia = diaDaSemana(hoje(), true);
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)}, ${d.getDate()} de ${nomeDoMes(d.getMonth())}`;
}

function chipsDeAreas(areas) {
  return (areas || []).map((a) => h('span', { class: 'chip' }, a));
}

function chipDeData(iso, hj) {
  if (!iso) return null;
  return h('span', { class: `chip${iso < hj ? ' rosa' : ''}` }, ic('relogio'), dataCurta(iso));
}

async function cron(dados, ctx, msg) {
  try {
    const r = await api('/api/cronograma', dados);
    if (msg) aviso(msg);
    await ctx.recarregar({ silencioso: true });
    return r;
  } catch (e) {
    falhou(e);
    await ctx.recarregar({ silencioso: true });
    return null;
  }
}

async function concluir(t, ctx) {
  const r = await cron({ acao: 'concluir', id: t.id }, ctx);
  if (!r) return;
  const novo = r.feitos[0];
  aviso('Feito.', { acao: novo ? { texto: 'Desfazer', fazer: () => cron({ acao: 'desfazer', id: novo.id }, ctx) } : null });
}

async function editarTarefa(t, ctx) {
  const texto = h('input', { class: 'entrada', type: 'text', value: t.texto });
  const data = h('input', { class: 'entrada', type: 'date', value: t.data || '' });
  const areas = h('input', { class: 'entrada', type: 'text', value: (t.areas || []).join(', '), placeholder: 'Ex.: marketing, vendas' });
  const corpo = h('div', null,
    h('div', { class: 'campo-janela' }, h('label', { class: 'rotulo' }, 'O que fazer'), texto),
    h('div', { class: 'campo-janela' }, h('label', { class: 'rotulo' }, 'Data (opcional)'), data),
    h('div', { class: 'campo-janela' }, h('label', { class: 'rotulo' }, 'Área (opcional)'), areas));
  const r = await janela({
    titulo: 'Editar tarefa',
    corpo,
    botoes: [
      { texto: 'Apagar', esquerda: true, icone: 'lixo', valor: 'apagar' },
      { texto: 'Cancelar', valor: null },
      { texto: 'Salvar', principal: true, valor: 'salvar' },
    ],
  });
  if (r === 'apagar') {
    if (await confirmar(`Apagar "${t.texto}"?`, { sim: 'Apagar' })) await cron({ acao: 'apagar', id: t.id }, ctx, 'Apagada.');
  } else if (r === 'salvar') {
    await cron({ acao: 'editar', id: t.id, texto: texto.value, data: data.value || null, areas: areas.value.split(',').map((s) => s.trim()).filter(Boolean) }, ctx, 'Salvo.');
  }
}

async function marcarRevista(t, ctx) {
  try {
    await api('/api/decisoes/revista', { titulo: t.titulo, linha: t.linha });
    aviso('Anotado: decisão revista.');
  } catch (e) { falhou(e); }
  await ctx.recarregar({ silencioso: true });
}

// Prazo de um teste (julgar) ou de uma decisão (rever): vem de marketing/testes.md e memoria/decisoes.md
function linhaDePrazo(t, ctx, { mostrarData = true } = {}) {
  const hj = hoje();
  const ehTeste = t.tipo === 'teste';
  return h('li', { class: 'linha' },
    h('span', { class: 'caixa prazo', title: ehTeste ? 'Teste pra julgar' : 'Decisão pra rever' }, ic(ehTeste ? 'alvo' : 'relogio')),
    h('div', { class: 'linha-texto' },
      h('a', { href: t.href, style: 'text-decoration:none' }, t.texto),
      h('div', { class: 'meta' }, mostrarData ? chipDeData(t.data, hj) : null, h('span', { class: 'chip' }, ehTeste ? 'Teste' : 'Decisão'))),
    h('div', { class: 'acoes-linha', style: 'opacity:1' },
      ehTeste
        ? h('a', { class: 'botao leve pequeno', href: '#/testes' }, 'Julgar')
        : h('button', { type: 'button', class: 'botao leve pequeno', title: 'Marcar como revista', onclick: () => marcarRevista(t, ctx) }, ic('check'), 'Já revi')));
}

function linhaDeTarefa(t, ctx, { mostrarData = true } = {}) {
  const hj = hoje();
  if (t.doPrazo) return linhaDePrazo(t, ctx, { mostrarData });
  if (t.doQuadro) {
    return h('li', { class: 'linha' },
      h('span', { class: 'caixa', style: 'border-style:dashed;cursor:default', title: 'Cartão do kanban' }),
      h('div', { class: 'linha-texto' },
        h('a', { href: '#/kanban', style: 'text-decoration:none' }, t.texto),
        h('div', { class: 'meta' }, mostrarData ? chipDeData(t.data, hj) : null, h('span', { class: 'chip' }, ic('colunas'), `${t.quadro}: ${t.coluna}`), chipsDeAreas(t.areas))));
  }
  return h('li', { class: 'linha' },
    h('button', { type: 'button', class: 'caixa', title: 'Marcar como feito', 'aria-label': `Marcar "${t.texto}" como feito`, onclick: () => concluir(t, ctx) }, ic('check')),
    h('div', { class: 'linha-texto' },
      h('div', null, t.texto),
      (mostrarData && t.data) || (t.areas && t.areas.length)
        ? h('div', { class: 'meta' }, mostrarData ? chipDeData(t.data, hj) : null, chipsDeAreas(t.areas))
        : null),
    h('div', { class: 'acoes-linha' },
      h('button', { type: 'button', class: 'icone-botao', title: 'Editar', 'aria-label': 'Editar', onclick: () => editarTarefa(t, ctx) }, ic('lapis'))));
}

function grupo(titulo, itens, ctx, { alerta = false, mostrarData = true } = {}) {
  if (!itens.length) return null;
  return h('div', null,
    h('div', { class: `grupo-titulo${alerta ? ' alerta' : ''}` }, titulo, h('span', { class: 'conta' }, String(itens.length))),
    h('ul', { class: 'lista' }, itens.map((t) => linhaDeTarefa(t, ctx, { mostrarData }))));
}

function formNovaTarefa(ctx, { data = '' } = {}) {
  const texto = h('input', { class: 'entrada', type: 'text', placeholder: 'O que fazer? #área opcional', 'aria-label': 'Tarefa nova', style: 'flex:1 1 180px' });
  const quando = h('input', { class: 'entrada', type: 'date', value: data, 'aria-label': 'Data (opcional)', style: 'flex:0 0 148px' });
  const tipo = h('select', { class: 'entrada', 'aria-label': 'Tipo', style: 'flex:0 0 112px' }, h('option', { value: 'tarefa' }, 'Tarefa'), h('option', { value: 'decisao' }, 'Decisão'));
  const form = h('form', {
    class: 'linha-form',
    style: 'margin-bottom:14px',
    onsubmit: async (e) => {
      e.preventDefault();
      if (!texto.value.trim()) { texto.focus(); return; }
      await cron({ acao: 'adicionar', texto: texto.value, data: quando.value || null, tipo: tipo.value }, ctx, 'Anotado no cronograma.');
    },
  }, texto, quando, tipo, h('button', { class: 'botao principal', type: 'submit', style: 'flex:0 0 auto' }, ic('mais'), 'Adicionar'));
  return form;
}

function semana(itens, ctx) {
  const hj = hoje();
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(hj, i));
  return h('div', { class: 'semana', role: 'group', 'aria-label': 'Próximos 7 dias' }, dias.map((iso) => {
    const n = itens.filter((t) => t.data === iso).length;
    return h('button', {
      type: 'button',
      class: `dia${iso === hj ? ' hoje' : ''}`,
      'aria-pressed': String(vista.dia === iso),
      'aria-label': `${dataCurta(iso)}: ${n} ${n === 1 ? 'item' : 'itens'}`,
      onclick: () => { vista.dia = vista.dia === iso ? null : iso; ctx.recarregar({ silencioso: true }); },
    },
    h('div', { class: 'sem' }, diaDaSemana(iso)),
    h('div', { class: 'num' }, String(dataDe(iso).getDate())),
    h('div', { class: 'pontos' }, Array.from({ length: Math.min(n, 4) }, () => h('i'))));
  }));
}

function listaDoCronograma(itens, ctx) {
  const hj = hoje();
  const fim = somarDias(hj, 7);
  const ordenar = (a, b) => String(a.data).localeCompare(String(b.data));
  if (vista.dia) {
    const doDia = itens.filter((t) => t.data === vista.dia);
    return [
      h('div', { class: 'grupo-titulo' }, dataCurta(vista.dia), h('button', { type: 'button', class: 'botao leve pequeno', onclick: () => { vista.dia = null; ctx.recarregar({ silencioso: true }); } }, 'Ver tudo')),
      doDia.length ? h('ul', { class: 'lista' }, doDia.map((t) => linhaDeTarefa(t, ctx, { mostrarData: false }))) : h('p', { class: 'fraco' }, 'Nada marcado pra esse dia.'),
    ];
  }
  const blocos = [
    grupo('Atrasadas', itens.filter((t) => t.data && t.data < hj).sort(ordenar), ctx, { alerta: true }),
    grupo('Hoje', itens.filter((t) => t.data === hj), ctx, { mostrarData: false }),
    grupo('Próximos 7 dias', itens.filter((t) => t.data && t.data > hj && t.data <= fim).sort(ordenar), ctx),
    grupo('Mais pra frente', itens.filter((t) => t.data && t.data > fim).sort(ordenar), ctx),
    grupo('Sem data', itens.filter((t) => !t.data), ctx),
  ].filter(Boolean);
  if (!blocos.length) {
    return [h('div', { class: 'vazio' }, h('h3', null, 'Nada no cronograma'), h('p', null, 'Anote acima, ou conte pra IA o que precisa fazer. Ela põe aqui sozinha.'))];
  }
  return blocos;
}

function calendario(itens, ctx) {
  const hj = hoje();
  const base = vista.mes || hj.slice(0, 7);
  const [ano, mes] = base.split('-').map(Number);
  const primeiro = new Date(ano, mes - 1, 1);
  const inicio = new Date(primeiro);
  inicio.setDate(1 - primeiro.getDay());
  const celulas = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    if (i >= 35 && d.getMonth() !== mes - 1) break;
    celulas.push(isoDe(d));
  }
  const trocarMes = (n) => {
    const d = new Date(ano, mes - 1 + n, 1);
    vista.mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    ctx.recarregar({ silencioso: true });
  };
  return h('div', null,
    h('div', { class: 'painel-cabeca', style: 'margin-bottom:10px' },
      h('h3', { style: 'margin:0;font-size:17px' }, `${nomeDoMes(mes - 1).replace(/^./, (c) => c.toUpperCase())} de ${ano}`),
      h('div', { class: 'chips' },
        h('button', { type: 'button', class: 'icone-botao', 'aria-label': 'Mês anterior', onclick: () => trocarMes(-1) }, ic('voltar')),
        h('button', { type: 'button', class: 'botao leve pequeno', onclick: () => { vista.mes = null; ctx.recarregar({ silencioso: true }); } }, 'Hoje'),
        h('button', { type: 'button', class: 'icone-botao', 'aria-label': 'Próximo mês', onclick: () => trocarMes(1) }, ic('seta')))),
    h('div', { class: 'calendario' },
      NOMES_SEMANA.map((s) => h('div', { class: 'sem' }, s)),
      celulas.map((iso) => {
        const doDia = itens.filter((t) => t.data === iso);
        const fora = Number(iso.slice(5, 7)) !== mes;
        return h('div', {
          class: `cal-dia${fora ? ' fora' : ''}${iso === hj ? ' hoje' : ''}`,
          role: 'button',
          tabindex: '0',
          'aria-label': `${dataCurta(iso)}: ${doDia.length} itens`,
          onclick: () => abrirDia(iso, itens, ctx),
          onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirDia(iso, itens, ctx); } },
        },
        h('span', { class: 'n' }, String(Number(iso.slice(8)))),
        doDia.slice(0, 3).map((t) => h('span', { class: `cal-item${t.data < hj ? ' atrasada' : ''}${t.doQuadro ? ' do-quadro' : ''}${t.doPrazo ? ' do-prazo' : ''}`, title: t.texto }, t.texto)),
        doDia.length > 3 ? h('span', { class: 'cal-mais' }, `mais ${doDia.length - 3}`) : null);
      })));
}

async function abrirDia(iso, itens, ctx) {
  const doDia = itens.filter((t) => t.data === iso);
  const lista = doDia.length
    ? h('ul', { class: 'lista' }, doDia.map((t) => linhaDeTarefa(t, ctx, { mostrarData: false })))
    : h('p', { class: 'fraco' }, 'Nada marcado pra esse dia.');
  const corpo = h('div', null, lista, h('div', { style: 'margin-top:14px' }, formNovaTarefa(ctx, { data: iso })));
  await janela({ titulo: dataCurta(iso).replace(/^./, (c) => c.toUpperCase()), corpo, botoes: [{ texto: 'Fechar', valor: null }] });
}

function feitosRecentes(feitos, ctx) {
  if (!feitos.length) return null;
  return h('details', { style: 'margin-top:16px' },
    h('summary', { class: 'botao leve pequeno', style: 'display:inline-flex' }, `Feitos recentemente (${feitos.length})`),
    h('ul', { class: 'lista', style: 'margin-top:6px' }, feitos.slice(0, 10).map((t) => h('li', { class: 'linha' },
      h('button', { type: 'button', class: 'caixa marcada', title: 'Desfazer', 'aria-label': `Desfazer "${t.texto}"`, onclick: () => cron({ acao: 'desfazer', id: t.id }, ctx, 'Voltou pra lista.') }, ic('check')),
      h('div', { class: 'linha-texto' }, h('div', { class: 'feito-texto' }, t.texto), t.feitoEm ? h('div', { class: 'meta' }, h('span', { class: 'chip' }, `feito ${dataCurta(t.feitoEm)}`)) : null)))));
}

function painelDecisoes(decisoes, ctx) {
  return h('section', { class: 'painel vidro' },
    h('div', { class: 'painel-cabeca' }, h('h2', null, 'Decisões pra tomar')),
    decisoes.length
      ? h('ul', { class: 'lista' }, decisoes.map((t) => linhaDeTarefa(t, ctx)))
      : h('p', { class: 'fraco pequeno', style: 'margin:0' }, 'Nada pra decidir agora. Escolha "Decisão" ao anotar, ou conte pra IA.'));
}

// "Pra arrumar": o que está velho ou esquecido (só aparece quando tem algo)
function painelArrumar(avisos) {
  if (!avisos || !avisos.length) return null;
  return h('section', { class: 'painel vidro arrumar' },
    h('div', { class: 'painel-cabeca' },
      h('h2', null, 'Pra arrumar'),
      h('button', { type: 'button', class: 'botao leve pequeno', title: 'Pedir pra IA', onclick: () => pedirIA('Revisa tudo: o que está velho, atrasado ou esquecido no cérebro do negócio? Siga receitas/revisar-tudo.md.') }, ic('ia'), 'Arrumar com a IA')),
    h('ul', { class: 'lista' }, avisos.map((a) => h('li', { class: 'linha' },
      h('span', { class: 'ico-aviso' }, ic(a.icone)),
      h('div', { class: 'linha-texto' },
        a.href ? h('a', { href: a.href, style: 'text-decoration:none;font-weight:600' }, a.texto) : h('div', { style: 'font-weight:600' }, a.texto),
        a.detalhe ? h('div', { class: 'fraco pequeno' }, a.detalhe) : null),
      h('button', { type: 'button', class: 'icone-botao', title: 'Pedir pra IA', 'aria-label': `Pedir pra IA: ${a.texto}`, onclick: () => pedirIA(a.pedido) }, ic('ia'))))));
}

// O que o anotador (a IA escondida que confere a conversa) guardou nos últimos dias
function painelAnotados(lista) {
  if (!lista || !lista.length) return null;
  const itens = lista.flatMap((e) => (e.itens || []).map((t) => ({ texto: t, quando: e.quando, arquivos: e.arquivos || [] }))).slice(0, 6);
  const arquivoDe = (t, arquivos) => {
    const m = /([\w-]+(?:\/[\w.-]+)+\.md)/.exec(t);
    return m ? m[1] : (arquivos.length === 1 ? arquivos[0] : null);
  };
  return h('section', { class: 'painel vidro' },
    h('div', { class: 'painel-cabeca' }, h('h2', null, 'A IA anotou sozinha'), h('a', { class: 'botao leve pequeno', href: '#/ajustes' }, 'Ajustes')),
    h('ul', { class: 'lista' }, itens.map((i) => {
      const arq = arquivoDe(i.texto, i.arquivos);
      const texto = i.texto.replace(/\s*\([^()]*\.md[^()]*\)\s*$/, '');
      return h('li', { class: 'linha' },
        h('span', { class: 'ico-aviso' }, ic('check')),
        h('div', { class: 'linha-texto' },
          arq ? h('a', { href: `#/arquivo?c=${encodeURIComponent(arq)}`, style: 'text-decoration:none' }, texto) : h('div', null, texto),
          h('div', { class: 'fraco pequeno' }, [quandoFoi(i.quando), arq].filter(Boolean).join(' · '))));
    })));
}

function painelGitHub(git, ctx) {
  const salvar = h('button', {
    type: 'button',
    class: 'botao pequeno',
    onclick: async () => {
      salvar.disabled = true;
      salvar.textContent = 'Salvando...';
      try {
        const r = await api('/api/git/salvar', {});
        aviso(r.aviso || 'Salvo no GitHub.');
      } catch (e) { falhou(e); }
      ctx.recarregar({ silencioso: true });
    },
  }, ic('nuvem'), 'Salvar agora');
  return h('section', { class: 'painel vidro' },
    h('div', { class: 'painel-cabeca' }, h('h2', null, 'GitHub')),
    h('p', { class: `pequeno ${git.ligado && !git.mudancas ? 'suave' : ''}`, style: 'margin:0 0 10px' }, git.resumo),
    git.ultimoCommit ? h('p', { class: 'fraco pequeno', style: 'margin:-6px 0 10px' }, `Última vez guardado: ${quandoFoi(git.ultimoCommit)}`) : null,
    git.ligado ? (git.mudancas ? salvar : null) : h('a', { class: 'botao pequeno', href: '#/ajustes' }, 'Ligar no GitHub'));
}

function painelFeedbacks(d) {
  return h('section', { class: 'painel vidro' },
    h('div', { class: 'painel-cabeca' }, h('h2', null, 'Feedbacks novos'), h('a', { class: 'botao leve pequeno', href: '#/feedbacks' }, 'Ver todos')),
    d.feedbacks.length
      ? h('ul', { class: 'lista' }, d.feedbacks.map((f) => h('li', { class: 'linha' },
        h('div', { class: 'linha-texto' }, h('div', null, f.disse || f.titulo), h('div', { class: 'meta' }, f.tipo ? h('span', { class: 'chip rosa' }, f.tipo) : null, f.quem ? h('span', { class: 'chip' }, f.quem) : null)))))
      : h('p', { class: 'fraco pequeno', style: 'margin:0' }, 'Nenhum feedback novo. Conte pra IA o que ouviu de um cliente.'));
}

function painelIdeias(d) {
  return h('section', { class: 'painel vidro' },
    h('div', { class: 'painel-cabeca' }, h('h2', null, 'Ideias'), h('a', { class: 'botao leve pequeno', href: '#/ideias' }, 'Ver todas')),
    d.ideias.length
      ? h('ul', { class: 'lista' }, d.ideias.map((i) => h('li', { class: 'linha' },
        h('div', { class: 'linha-texto' }, h('div', null, i.titulo), h('div', { class: 'meta' }, h('span', { class: 'chip' }, i.status))))))
      : h('p', { class: 'fraco pequeno', style: 'margin:0' }, 'Nenhuma ideia guardada ainda.'));
}

export async function montar(alvo, ctx) {
  const d = await api('/api/dashboard');
  const hj = hoje();
  const cartoes = d.cartoes.map((c) => ({ ...c, doQuadro: true, id: `quadro:${c.arquivo}:${c.texto}` }));
  const prazos = (d.prazos || []).map((p) => ({ ...p, doPrazo: true, id: `prazo:${p.tipo}:${p.titulo}` }));
  const itens = [...d.cronograma.tarefas, ...cartoes, ...prazos];
  const atrasadas = itens.filter((t) => t.data && t.data < hj).length;
  const deHoje = itens.filter((t) => t.data === hj).length;
  const semanaN = itens.filter((t) => t.data && t.data > hj && t.data <= somarDias(hj, 7)).length;
  const nome = d.marca.dono ? d.marca.dono.split(' ')[0] : '';

  alvo.append(cabeca({
    titulo: nome ? `${saudacao()}, ${nome}` : saudacao(),
    texto: `${hojePorExtenso()}. ${atrasadas ? `Tem ${atrasadas} ${atrasadas === 1 ? 'coisa atrasada' : 'coisas atrasadas'}.` : 'Nada atrasado.'}`,
    acoes: d.status.pct < 100 ? [h('a', { class: 'botao', href: '#/comece' }, ic('foguete'), `Configuração ${d.status.pct}%`)] : [],
  }));

  alvo.append(h('div', { class: 'numeros' },
    h('div', { class: `numero vidro${atrasadas ? ' alerta' : ''}` }, h('div', { class: 'valor' }, String(atrasadas)), h('div', { class: 'nome' }, 'Atrasadas')),
    h('div', { class: 'numero vidro' }, h('div', { class: 'valor' }, String(deHoje)), h('div', { class: 'nome' }, 'Pra hoje')),
    h('div', { class: 'numero vidro' }, h('div', { class: 'valor' }, String(semanaN)), h('div', { class: 'nome' }, 'Nos próximos 7 dias')),
    h('a', { class: 'numero vidro', href: '#/kanban' }, h('div', { class: 'valor' }, String(d.fazendo)), h('div', { class: 'nome' }, 'Andando no kanban'))));

  const modo = vista.modo;
  const alternar = h('div', { class: 'segmentado', role: 'group', 'aria-label': 'Jeito de ver' },
    h('button', { type: 'button', 'aria-pressed': String(modo === 'lista'), onclick: () => { vista.modo = 'lista'; ctx.recarregar({ silencioso: true }); } }, ic('lista'), 'Lista'),
    h('button', { type: 'button', 'aria-pressed': String(modo === 'calendario'), onclick: () => { vista.modo = 'calendario'; ctx.recarregar({ silencioso: true }); } }, ic('grade'), 'Calendário'));

  const cronograma = h('section', { class: 'painel vidro' },
    h('div', { class: 'painel-cabeca' }, h('h2', null, 'Cronograma'), alternar),
    formNovaTarefa(ctx),
    modo === 'calendario' ? calendario(itens, ctx) : [semana(itens, ctx), ...listaDoCronograma(itens, ctx)],
    feitosRecentes(d.cronograma.feitos, ctx));

  alvo.append(h('div', { class: 'grade-2' },
    cronograma,
    h('div', { class: 'pilha' },
      painelArrumar(d.avisos),
      painelAnotados(d.anotados),
      painelDecisoes(d.cronograma.decisoes, ctx),
      painelGitHub(d.git, ctx),
      painelFeedbacks(d),
      painelIdeias(d),
      h('section', { class: 'painel vidro' },
        h('h2', null, 'Pergunte pra IA'),
        h('p', { class: 'suave pequeno', style: 'margin:6px 0 12px' }, 'Não sabe por onde começar o dia?'),
        h('button', { type: 'button', class: 'pedido', onclick: () => pedirIA('O que eu faço hoje? Leia o cronograma, o kanban e a estratégia e me diga as 3 coisas mais importantes.') },
          ic('ia'), h('span', null, 'O que eu faço hoje?'), h('span', { class: 'copiar-txt' }, 'Copiar'))))));

  return {
    titulo: 'Dashboard',
    podeRecarregar: () => {
      const foco = document.activeElement;
      return !(foco && foco.closest && foco.closest('#tela') && /^(INPUT|TEXTAREA|SELECT)$/.test(foco.tagName) && foco.value);
    },
  };
}
