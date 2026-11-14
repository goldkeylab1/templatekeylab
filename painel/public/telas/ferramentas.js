// Ferramentas: baixar um vídeo pra estudar e transcrever áudio e vídeo. Tudo roda neste computador.
// O download quem faz é o painel (lib/baixador.js). As fotos das cenas e a transcrição saem aqui, no navegador, uma de
// cada vez, e continuam mesmo trocando de tela (o estado fica neste módulo, não na tela).
import { h, ic, api, aviso, falhou, cabeca, confirmar, copiar, janela, barra, vazio, pedirIA } from '../ui.js';
import * as M from '../ferramentas/motor.js';

const lerLocal = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const gravarLocal = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem guardar */ } };

const est = {
  dados: null,
  el: null, // as partes da tela que mudam
  tipo: 'video',
  modelo: lerLocal('keylab-modelo', ''),
  idioma: lerLocal('keylab-idioma', 'portuguese'),
  aparelho: null,
  guardados: {},
  manuais: [], // arquivos do computador esperando a vez: { id, arquivo, nome }
  atual: null, // o que está sendo feito agora
  erros: {}, // `${tipo}:${pasta}` → mensagem (o que deu erro nesta visita não tenta de novo sozinho)
  rodando: false,
  outraAba: false,
  timer: null,
  fechadas: new Set(), // downloads com erro que a pessoa já fechou
};
let transcritor = null;

window.addEventListener('beforeunload', (e) => {
  if (est.atual || est.manuais.length) { e.preventDefault(); e.returnValue = ''; }
});

// ---------- números ----------

const milhar = (n) => (n == null ? '' : Math.round(n).toLocaleString('pt-BR'));
function curto(n) {
  if (n == null) return '';
  if (n >= 1e6) return `${(n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (n >= 1e4) return `${Math.round(n / 1e3).toLocaleString('pt-BR')} mil`;
  return milhar(n);
}
function relogio(s) {
  if (!s && s !== 0) return '';
  const t = Math.round(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}
const tamanho = (mb) => (mb >= 1000 ? `${(mb / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB` : `${mb} MB`);
const dataBr = (iso) => { if (!iso) return ''; const [a, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${a}`; };

// ---------- os dados ----------

async function atualizarDados() {
  est.dados = await api('/api/ferramentas');
  return est.dados;
}

const assinatura = (d) => JSON.stringify(d ? [d.virais, d.transcricoes] : null);
const temDownload = () => !!(est.dados && est.dados.tarefas.some((t) => ['fila', 'baixando', 'juntando'].includes(t.estado)));

async function garantirAparelho() {
  if (est.aparelho) return est.aparelho;
  est.aparelho = await M.detectar();
  if (!M.MODELOS[est.modelo]) est.modelo = M.recomendado(est.aparelho);
  for (const k of Object.keys(M.MODELOS)) est.guardados[k] = await M.estaGuardado(M.montagem(k, est.aparelho));
  return est.aparelho;
}

// ---------- a fila: as fotos primeiro (são rápidas), depois os arquivos do computador, depois as transcrições ----------

function proximo(auto) {
  const v = (est.dados && est.dados.virais) || [];
  if (auto) {
    const f = v.find((x) => x.fotos === 'pendente' && x.temArquivo && !est.erros[`fotos:${x.pasta}`]);
    if (f) return { tipo: 'fotos', pasta: f.pasta, nome: f.titulo };
  }
  if (est.manuais.length) return { tipo: 'transcrever', ...est.manuais.shift() };
  if (auto) {
    const t = v.find((x) => x.transcrever === 'auto' && !x.transcricao && x.temArquivo && !est.erros[`transcrever:${x.pasta}`]);
    if (t) return { tipo: 'transcrever', pasta: t.pasta, nome: t.titulo };
  }
  return null;
}

const temPendente = () => !!proximo(true) || est.manuais.length > 0;

async function laco(auto) {
  for (;;) {
    const job = proximo(auto);
    if (!job) return;
    await executar(job);
    try { await atualizarDados(); } catch { /* o painel pode ter desligado */ }
    desenharLista();
  }
}

// Só uma aba do painel faz as fotos e as transcrições dos vídeos baixados (a outra só mostra)
async function processar() {
  if (est.rodando) return;
  est.rodando = true;
  try {
    if (navigator.locks && navigator.locks.request) {
      await navigator.locks.request('keylab-ferramentas', { ifAvailable: true }, async (trava) => {
        est.outraAba = !trava;
        await laco(!!trava);
      });
    } else {
      await laco(true);
    }
  } catch (e) {
    falhou(e);
  } finally {
    est.rodando = false;
    desenharAgora();
  }
}

async function executar(job) {
  const chave = `${job.tipo}:${job.pasta || job.id}`;
  est.atual = { ...job, fase: 'Começando', pct: 0, texto: '', cancelar: false };
  desenharAgora();
  desenharLista();
  try {
    if (job.tipo === 'fotos') {
      est.atual.fase = 'Tirando as fotos das cenas';
      const r = await M.tirarFotos(job.pasta, { aoProgresso: (p) => { est.atual.pct = p; desenharAgora(); }, parar: () => est.atual && est.atual.cancelar });
      if (r.parado) { est.erros[chave] = 'Cancelado.'; return; }
      await api('/api/ferramentas/fotos-prontas', r.semImagem ? { pasta: job.pasta, semImagem: true } : { pasta: job.pasta, ...r });
    } else {
      await transcrever(job, chave);
    }
  } catch (e) {
    const msg = (e && e.message) || String(e);
    est.erros[chave] = msg;
    if (job.tipo === 'fotos') { try { await api('/api/ferramentas/fotos-prontas', { pasta: job.pasta, erro: msg }); } catch { /* fica o erro da tela */ } }
    aviso(`${job.tipo === 'fotos' ? 'As fotos' : 'A transcrição'} de "${job.nome}" não deu: ${msg}`, { erro: true, tempo: 9000 });
  } finally {
    est.atual = null;
    desenharAgora();
  }
}

const mesma = (a, b) => !!a && !!b && a.id === b.id && a.device === b.device && JSON.stringify(a.dtype) === JSON.stringify(b.dtype);

function eventoDoWhisper(d) {
  const a = est.atual;
  if (!a) return;
  if (d.tipo === 'baixando') {
    a.fase = 'Baixando o modelo de transcrição (só na primeira vez)';
    a.pct = d.total ? (d.carregado / d.total) * 100 : 0;
    a.detalhe = d.total ? `${Math.round(d.carregado / 1e6)} de ${Math.round(d.total / 1e6)} MB` : '';
  } else if (d.tipo === 'preparando') {
    a.fase = 'Preparando o modelo';
    a.pct = 100;
    a.detalhe = '';
  } else if (d.tipo === 'tentando') {
    a.fase = `A internet falhou: tentando de novo (${d.tentativa}ª vez)`;
  } else if (d.tipo === 'parcial') {
    a.fase = 'Transcrevendo';
    a.pct = a.duracao ? Math.min(100, (d.feito / a.duracao) * 100) : 0;
    a.detalhe = a.duracao ? `${relogio(d.feito)} de ${relogio(a.duracao)}` : '';
    const novos = (d.novos || []).map((s) => s.texto).join(' ').trim();
    if (novos) a.texto = `${a.texto} ${novos}`.trim().slice(-600);
  }
  desenharAgora();
}

async function transcrever(job, chave) {
  const a = est.atual;
  a.fase = 'Abrindo o som';
  desenharAgora();
  let arquivo = job.arquivo;
  if (!arquivo) {
    const r = await fetch(`/api/ferramentas/midia?pasta=${encodeURIComponent(job.pasta)}`);
    if (!r.ok) throw new Error('Não achei o vídeo na pasta.');
    arquivo = await r.blob();
  }
  const som = await M.abrirSom(arquivo);
  a.duracao = M.segundosDe(som);
  if (a.duracao < 0.5) throw new Error('Esse arquivo não tem som.');
  if (a.cancelar) { est.erros[chave] = 'Cancelado.'; return; }

  await garantirAparelho();
  if (!transcritor) transcritor = new M.Transcritor(eventoDoWhisper);
  let mt = M.montagem(est.modelo, est.aparelho);
  if (!mesma(transcritor.carregado, mt)) {
    a.fase = 'Preparando o modelo';
    desenharAgora();
    try {
      await transcritor.carregar(mt);
    } catch (e) {
      if (mt.device !== 'webgpu') throw e;
      // A placa de vídeo não deu conta: vai pelo processador, que é mais lento mas sempre funciona
      est.aparelho.webgpu = false;
      transcritor.reiniciar();
      mt = M.montagem(est.modelo, est.aparelho);
      a.fase = 'Preparando o modelo (pelo processador)';
      desenharAgora();
      await transcritor.carregar(mt);
    }
    est.guardados[mt.chave] = true;
  }
  if (a.cancelar) { est.erros[chave] = 'Cancelado.'; return; }

  a.fase = 'Transcrevendo';
  a.pct = 0;
  a.id = `t${Date.now()}`;
  desenharAgora();
  const r = await transcritor.transcrever(a.id, som, est.idioma);
  if (r.cancelado) { est.erros[chave] = 'Cancelado.'; return; }
  const nomeModelo = `${M.MODELOS[mt.chave].nome} (${mt.device === 'webgpu' ? 'placa de vídeo' : 'processador'})`;
  const salvo = await api('/api/ferramentas/transcricao', {
    pasta: job.pasta || null, nome: job.nome, duracao: a.duracao, segmentos: r.segmentos, modelo: nomeModelo, idioma: est.idioma,
  });
  aviso(job.pasta ? `Transcrito: ${job.nome}` : `Transcrito. O texto ficou em arquivos/transcricoes/${salvo.pasta}/`, { tempo: 5000 });
}

function cancelarAtual() {
  const a = est.atual;
  if (!a) return;
  a.cancelar = true;
  if (a.tipo === 'transcrever' && a.id && transcritor) transcritor.cancelar(a.id);
  a.fase = 'Cancelando...';
  desenharAgora();
}

// ---------- a tela ----------

// Os pedidos pra IA estudar: o vídeo (o visual), a fala do vídeo (o roteiro) e uma transcrição do computador
function pedidoDoVideo(v) {
  return `Estude o vídeo da pasta arquivos/virais/${v.pasta}/ seguindo marketing/metodo/estudar-viral.md. Comece pelo info.md, depois os mosaicos (as fotos das cenas, em ordem) e a transcricao-com-tempos.txt. Quero entender o modelo visual dele (o estilo, as cenas, o ritmo e o texto na tela) pra fazer um vídeo no mesmo modelo, com o meu conteúdo. Salve o estudo em marketing/virais/${v.pasta}.md.`;
}

function pedidoDaFala(v) {
  return `Estude a fala do vídeo da pasta arquivos/virais/${v.pasta}/: leia o info.md e a transcricao-com-tempos.txt, seguindo marketing/metodo/estudar-viral.md. Quero entender o roteiro: o gancho dos primeiros segundos, a promessa, as viradas, o fim e o que ele pede pra quem assiste. Depois, me mostre como eu usaria essa mesma estrutura com o meu conteúdo (veja negocio/ e marketing/o-que-funciona.md). Copie o princípio, nunca o texto. Salve em marketing/virais/${v.pasta}.md (se o arquivo já existir, complete a parte da fala).`;
}

function pedidoDaTranscricao(t) {
  return `Estude a transcrição da pasta arquivos/transcricoes/${t.pasta}/ (do arquivo "${t.nome}"). Leia a transcricao-com-tempos.txt e me dê, com palavras simples: um resumo curto, as ideias principais, as frases mais fortes (com o tempo de cada uma), o que vira conteúdo pro meu negócio (veja negocio/ e marketing/o-que-funciona.md) e o que vale guardar no cérebro (anote no arquivo certo, como manda o AGENTS.md). Salve o estudo em saidas/estudos/${t.pasta}.md.`;
}

// ---------- selecionar vários e estudar juntos ----------
// A seleção fica guardada na aba (sobrevive quando a lista redesenha)

const SEL = 'keylab-ferr-selecao';
est.sel = new Set((() => { try { return JSON.parse(sessionStorage.getItem(SEL) || '[]'); } catch { return []; } })());
const guardarSel = () => { try { sessionStorage.setItem(SEL, JSON.stringify([...est.sel])); } catch { /* sem guardar */ } };
const chaveSel = (grupo, pasta) => `${grupo}:${pasta}`;

function selecionados() {
  const d = est.dados || { virais: [], transcricoes: [] };
  return {
    videos: d.virais.filter((v) => est.sel.has(chaveSel('virais', v.pasta))),
    roteiros: d.transcricoes.filter((t) => est.sel.has(chaveSel('transcricoes', t.pasta))),
  };
}

function marcador(grupo, pasta, nome) {
  const k = chaveSel(grupo, pasta);
  const caixa = h('input', { type: 'checkbox', 'aria-label': `Selecionar pra estudar junto: ${nome}` });
  caixa.checked = est.sel.has(k);
  caixa.addEventListener('change', () => {
    if (caixa.checked) est.sel.add(k); else est.sel.delete(k);
    guardarSel();
    const cartao = caixa.closest('article');
    if (cartao) cartao.classList.toggle('selecionado', caixa.checked);
    atualizarSelecao();
  });
  return h('label', { class: 'ferr-marcar', title: 'Selecionar pra estudar junto' }, caixa, h('span', { class: 'ferr-marcar-caixa' }, ic('check')));
}

function selecionarTodos(grupo) {
  const lista = grupo === 'virais' ? est.dados.virais : est.dados.transcricoes;
  const todos = lista.every((x) => est.sel.has(chaveSel(grupo, x.pasta)));
  for (const x of lista) { if (todos) est.sel.delete(chaveSel(grupo, x.pasta)); else est.sel.add(chaveSel(grupo, x.pasta)); }
  guardarSel();
  desenharLista();
}

function atualizarSelecao() {
  const el = est.el;
  if (!el || !el.barra || !est.dados) return;
  const { videos, roteiros } = selecionados();
  const n = videos.length + roteiros.length;
  el.barra.hidden = n === 0;
  const partes = [
    videos.length ? `${videos.length} ${videos.length === 1 ? 'vídeo' : 'vídeos'}` : null,
    roteiros.length ? `${roteiros.length} ${roteiros.length === 1 ? 'roteiro' : 'roteiros'}` : null,
  ].filter(Boolean).join(' e ');
  el.selTexto.replaceChildren(
    h('b', null, `${n} ${n === 1 ? 'selecionado' : 'selecionados'}`),
    h('span', { class: 'fraco' }, n === 1 ? ' · escolha mais um pra comparar' : ` · ${partes}`));
  el.selEstudar.disabled = n < 2;
  el.selEstudar.title = n < 2 ? 'Escolha pelo menos 2 pra encontrar os padrões' : 'A IA estuda a imagem, o texto, o roteiro e os padrões virais de todos juntos';
  for (const [grupo, lista, botao] of [['virais', est.dados.virais, el.todosV], ['transcricoes', est.dados.transcricoes, el.todosT]]) {
    if (!botao) continue;
    botao.hidden = lista.length < 2;
    const todos = lista.length > 0 && lista.every((x) => est.sel.has(chaveSel(grupo, x.pasta)));
    botao.textContent = todos ? 'Tirar a seleção' : 'Selecionar todos';
  }
}

function hojeIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function pedidoDosSelecionados() {
  const { videos, roteiros } = selecionados();
  const n = videos.length + roteiros.length;
  const linhas = [`Estude juntos estes ${n} conteúdos e encontre os padrões que se repetem, seguindo marketing/metodo/estudar-padroes.md.`];
  if (videos.length) {
    linhas.push('', 'Vídeos baixados (de cada um, leia o info.md, os mosaicos com as fotos das cenas, em ordem, e a transcricao-com-tempos.txt):');
    for (const v of videos) {
      const nums = [v.views != null ? `${curto(v.views)} views` : null, v.curtidas != null ? `${curto(v.curtidas)} curtidas` : null, v.perfil].filter(Boolean).join(', ');
      linhas.push(`- arquivos/virais/${v.pasta}/ ("${v.titulo}"${nums ? `, ${nums}` : ''})`);
    }
  }
  if (roteiros.length) {
    linhas.push('', 'Roteiros transcritos (de cada um, leia a transcricao-com-tempos.txt):');
    for (const t of roteiros) linhas.push(`- arquivos/transcricoes/${t.pasta}/ ("${t.nome}")`);
  }
  linhas.push('', 'Quero o estudo nestas partes:');
  let i = 1;
  if (videos.length) linhas.push(`${i++}. Imagem: o que se repete no visual (a primeira cena, o enquadramento, quem aparece, o cenário, as cores, os cortes e o ritmo, o texto na tela).`);
  linhas.push(`${i++}. Texto e roteiro: o que se repete na fala (o gancho dos primeiros 3 segundos, a promessa, a estrutura com o tempo de cada parte, as viradas, o fim e o pedido pra quem assiste, as palavras e o tom).`);
  linhas.push(`${i++}. Padrões virais: ${videos.length ? 'o que os de melhor resultado têm e os outros não (compare os números com o tamanho do perfil), e ' : ''}por que a pessoa para, fica até o fim e comenta ou compartilha.`);
  linhas.push(`${i++}. O modelo: um roteiro modelo (as partes, com o tempo de cada uma)${videos.length ? ' e um guia visual (as cenas, em ordem)' : ''}, pra eu fazer com o meu conteúdo, na minha voz (veja negocio/ e marketing/o-que-funciona.md).`);
  linhas.push('', `Diga quantos conteúdos têm cada padrão (ex.: 3 de ${n}). Copie o princípio, nunca o conteúdo.${videos.length ? '' : ' Aqui só tem roteiros, sem imagem: estude o texto.'} No fim, proponha no máximo 2 testes em marketing/testes.md. Salve o estudo em marketing/virais/${hojeIso()}-padroes.md.`);
  return linhas.join('\n');
}

function barraDeSelecao() {
  est.el.selTexto = h('span', { class: 'ferr-selecao-texto' });
  est.el.selEstudar = h('button', {
    type: 'button',
    class: 'botao principal',
    onclick: () => { if (selecionados().videos.length + selecionados().roteiros.length >= 2) pedirIA(pedidoDosSelecionados(), { mensagem: 'Pedido copiado. Cole na sua IA.' }); },
  }, ic('ia'), 'Estudar os selecionados juntos');
  est.el.barra = h('div', { class: 'barra-salvar vidro ferr-selecao', hidden: true, role: 'region', 'aria-label': 'Selecionados pra estudar juntos' },
    h('span', { class: 'ferr-selecao-ico' }, ic('grade')),
    est.el.selTexto,
    h('div', { class: 'chips' },
      h('button', { type: 'button', class: 'botao leve', onclick: () => { est.sel.clear(); guardarSel(); desenharLista(); } }, 'Limpar'),
      est.el.selEstudar));
  return est.el.barra;
}

// O título de cada parte da tela, com o ícone
function tituloDaParte(icone, titulo, texto, extra = null) {
  return h('div', { class: 'painel-cabeca ferr-cabeca' },
    h('div', { class: 'ferr-cabeca-titulo' },
      h('span', { class: 'ferr-ico' }, ic(icone)),
      h('div', { style: 'min-width:0' }, h('h2', null, titulo), texto ? h('p', null, texto) : null)),
    extra);
}

function formularioDeBaixar() {
  const entrada = h('input', { class: 'entrada', type: 'url', inputmode: 'url', placeholder: 'Cole o link do vídeo', 'aria-label': 'Link do vídeo', autocomplete: 'off' });
  const botoesTipo = [['video', 'video', 'Vídeo'], ['audio', 'microfone', 'Só o áudio']].map(([t, i, nome]) => h('button', {
    type: 'button',
    'aria-pressed': String(est.tipo === t),
    onclick: (ev) => {
      est.tipo = t;
      ev.currentTarget.parentElement.querySelectorAll('button').forEach((b, n) => b.setAttribute('aria-pressed', String(['video', 'audio'][n] === t)));
    },
  }, ic(i), nome));
  const enviar = h('button', { type: 'submit', class: 'botao principal' }, ic('baixar'), 'Baixar');
  return h('form', {
    class: 'pilha ferr-baixar',
    onsubmit: async (e) => {
      e.preventDefault();
      if (!entrada.value.trim()) { entrada.focus(); return; }
      enviar.disabled = true;
      try {
        await api('/api/ferramentas/baixar', { link: entrada.value, tipo: est.tipo });
        entrada.value = '';
        await atualizarDados();
        desenharTarefas();
        ligarRelogio(true);
      } catch (err) { falhou(err); } finally { enviar.disabled = false; }
    },
  },
  entrada,
  h('div', { class: 'linha-form', style: 'justify-content:space-between' }, h('div', { class: 'segmentado', role: 'group', 'aria-label': 'O que baixar' }, botoesTipo), enviar),
  h('p', { class: 'fraco pequeno', style: 'margin:0' }, 'Instagram, TikTok, YouTube, X, Facebook e centenas de sites. Só vídeo público. Baixe pra estudar: postar o vídeo de outra pessoa como se fosse seu é cópia.'));
}

function zonaDeSoltar() {
  const arquivo = h('input', { type: 'file', accept: 'audio/*,video/*,.mkv,.m4a,.opus,.amr,.caf', multiple: true, hidden: true });
  const receber = (lista) => {
    const ok = [...(lista || [])].filter((f) => /^(audio|video)\//.test(f.type) || /\.(mp3|m4a|wav|aac|flac|ogg|oga|opus|amr|caf|aif|aiff|mp4|m4v|mov|mkv|webm|3gp|mpeg|mpg)$/i.test(f.name));
    if (!ok.length) { aviso('Esse arquivo não é de áudio nem de vídeo.', { erro: true }); return; }
    for (const f of ok) est.manuais.push({ id: `m${Date.now()}${Math.random().toString(36).slice(2, 6)}`, arquivo: f, nome: f.name });
    aviso(ok.length === 1 ? 'Na fila pra transcrever.' : `${ok.length} arquivos na fila pra transcrever.`);
    desenharAgora();
    processar();
  };
  arquivo.addEventListener('change', () => { receber(arquivo.files); arquivo.value = ''; });
  const zona = h('label', { class: 'soltar', tabindex: '0' },
    ic('upload'),
    h('b', null, 'Arraste um áudio ou vídeo aqui'),
    h('span', { class: 'fraco pequeno' }, 'ou clique pra escolher. O arquivo não sai do computador: só o texto vai pra pasta.'),
    arquivo);
  zona.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); arquivo.click(); } });
  zona.addEventListener('dragover', (e) => { e.preventDefault(); zona.classList.add('sobre'); });
  zona.addEventListener('dragleave', () => zona.classList.remove('sobre'));
  zona.addEventListener('drop', (e) => { e.preventDefault(); zona.classList.remove('sobre'); receber(e.dataTransfer.files); });
  return zona;
}

function escolhaDoModelo() {
  const rec = est.aparelho ? M.recomendado(est.aparelho) : '';
  const grade = h('div', { class: 'ferr-modelos', role: 'radiogroup', 'aria-label': 'Modelo de transcrição' });
  for (const [k, m] of Object.entries(M.MODELOS)) {
    const mt = M.montagem(k, est.aparelho);
    grade.append(h('button', {
      type: 'button',
      class: 'ferr-modelo',
      role: 'radio',
      'aria-checked': String(est.modelo === k),
      onclick: () => {
        est.modelo = k;
        gravarLocal('keylab-modelo', k);
        grade.querySelectorAll('.ferr-modelo').forEach((b) => b.setAttribute('aria-checked', String(b === grade.children[Object.keys(M.MODELOS).indexOf(k)])));
      },
    },
    h('span', { class: 'nome' }, m.nome, k === rec ? h('span', { class: 'chip rosa' }, 'recomendado') : null),
    h('span', { class: 'tam' }, est.guardados[k] ? 'já baixado' : `baixa ${tamanho(mt.mb)} na 1ª vez`),
    h('span', { class: 'desc' }, m.resumo)));
  }
  const idioma = h('select', {
    class: 'entrada',
    'aria-label': 'Idioma da fala',
    onchange: (e) => { est.idioma = e.target.value; gravarLocal('keylab-idioma', est.idioma); },
  }, M.IDIOMAS.map(([v, nome]) => h('option', { value: v, selected: est.idioma === v }, nome)));
  return h('div', { class: 'pilha' },
    h('div', null, h('div', { class: 'rotulo' }, 'Modelo'), grade),
    h('div', null, h('div', { class: 'rotulo' }, 'Idioma da fala'), idioma),
    h('p', { class: 'fraco pequeno', style: 'margin:0' }, est.aparelho && est.aparelho.webgpu
      ? 'Este computador tem placa de vídeo liberada no navegador: a transcrição vai rápido.'
      : 'Sem placa de vídeo liberada no navegador: a transcrição vai pelo processador (funciona, só demora mais). O Chrome costuma liberar.'));
}

function desenharTarefas() {
  const alvo = est.el && est.el.tarefas;
  if (!alvo || !alvo.isConnected || !est.dados) return;
  const b = est.dados.baixador;
  const itens = [];
  if (b.instalando) {
    itens.push(h('div', { class: 'ferr-tarefa' },
      h('div', { class: 'topo' }, h('span', null, 'Instalando o baixador (só na primeira vez)'), h('span', { class: 'fraco' }, `${b.pct}%`)),
      barra(b.pct)));
  } else if (b.erro && !b.pronto) {
    itens.push(h('div', { class: 'ferr-tarefa erro' }, h('span', null, `O baixador não instalou: ${b.erro}`)));
  }
  for (const t of est.dados.tarefas) {
    if (t.estado === 'pronto' || est.fechadas.has(t.id)) continue;
    if (t.estado === 'erro') {
      itens.push(h('div', { class: 'ferr-tarefa erro' },
        h('div', { class: 'topo' }, h('b', null, 'Não deu pra baixar'),
          h('button', { type: 'button', class: 'icone-botao', 'aria-label': 'Fechar', onclick: () => { est.fechadas.add(t.id); desenharTarefas(); } }, ic('x'))),
        h('span', { class: 'pequeno' }, t.erro),
        h('span', { class: 'fraco pequeno', style: 'overflow-wrap:anywhere' }, t.link)));
      continue;
    }
    const mb = t.total ? ` · ${Math.round((t.baixado || 0) / 1e6)} de ${Math.round(t.total / 1e6)} MB` : '';
    itens.push(h('div', { class: 'ferr-tarefa' },
      h('div', { class: 'topo' },
        h('span', { style: 'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, h('b', null, t.titulo || 'Vídeo'), h('span', { class: 'fraco' }, ` · ${t.etapa}${mb}`)),
        h('button', { type: 'button', class: 'botao leve pequeno', onclick: async () => { try { await api('/api/ferramentas/cancelar', { id: t.id }); await atualizarDados(); desenharTarefas(); } catch (e) { falhou(e); } } }, 'Cancelar')),
      barra(t.pct || 0)));
  }
  if (!b.ffmpeg && !itens.length) {
    itens.push(h('p', { class: 'fraco pequeno', style: 'margin:0' }, 'Do YouTube, sem o ffmpeg no computador, vem em 360p. Pra qualidade boa, peça pra sua IA: "instala o ffmpeg neste computador".'));
  }
  alvo.replaceChildren(...itens);
}

function desenharAgora() {
  const alvo = est.el && est.el.agora;
  if (!alvo || !alvo.isConnected) return;
  const a = est.atual;
  const fila = est.manuais.length;
  if (!a) {
    const partes = [];
    if (fila) partes.push(h('p', { class: 'suave', style: 'margin:0' }, `${fila} ${fila === 1 ? 'arquivo esperando' : 'arquivos esperando'} pra transcrever.`));
    if (est.outraAba) partes.push(h('p', { class: 'fraco pequeno', style: 'margin:0' }, 'Outra aba do painel está fazendo as fotos e as transcrições dos vídeos baixados.'));
    alvo.replaceChildren(...partes);
    alvo.hidden = !partes.length;
    atualizarChips();
    return;
  }
  alvo.hidden = false;
  const titulo = a.tipo === 'fotos' ? 'Tirando as fotos das cenas' : 'Transcrevendo';
  alvo.replaceChildren(...[
    h('div', { class: 'painel-cabeca', style: 'margin-bottom:10px' },
      h('div', { style: 'min-width:0' },
        h('h2', { style: 'margin:0' }, `Agora: ${titulo.toLowerCase()}`),
        h('div', { class: 'fraco pequeno', style: 'overflow-wrap:anywhere' }, a.nome)),
      a.cancelar ? null : h('button', { type: 'button', class: 'botao leve pequeno', onclick: cancelarAtual }, 'Cancelar')),
    h('div', { class: 'topo-item', style: 'display:flex;justify-content:space-between;gap:10px;font-size:14px;margin-bottom:6px' },
      h('span', null, a.fase), h('span', { class: 'fraco' }, [a.detalhe, `${Math.floor(a.pct || 0)}%`].filter(Boolean).join(' · '))),
    barra(a.pct || 0),
    a.texto ? h('p', { class: 'ao-vivo' }, `…${a.texto.slice(-260)}`) : null,
    fila ? h('p', { class: 'fraco pequeno', style: 'margin:8px 0 0' }, `Depois: ${fila} ${fila === 1 ? 'arquivo' : 'arquivos'} do computador.`) : null
  ].filter(Boolean)); // sem o filtro, o navegador escreve "null" na tela
  atualizarChips();
}

function chipFotos(v) {
  const a = est.atual;
  if (a && a.tipo === 'fotos' && a.pasta === v.pasta) return h('span', { class: 'chip rosa' }, `tirando as fotos ${Math.floor(a.pct || 0)}%`);
  if (v.fotos === 'feitas') return h('span', { class: 'chip' }, ic('grade'), `${v.quadros} fotos`);
  if (v.fotos === 'sem-imagem') return h('span', { class: 'chip' }, 'só áudio');
  if (v.fotos === 'erro' || est.erros[`fotos:${v.pasta}`]) return h('span', { class: 'chip rosa' }, 'as fotos não saíram');
  return h('span', { class: 'chip' }, 'fotos na fila');
}

function chipTexto(v) {
  const a = est.atual;
  if (a && a.tipo === 'transcrever' && a.pasta === v.pasta) return h('span', { class: 'chip rosa' }, `${a.fase === 'Transcrevendo' ? 'transcrevendo' : 'preparando'} ${Math.floor(a.pct || 0)}%`);
  if (v.transcricao) return h('span', { class: 'chip' }, ic('texto'), `${milhar(v.transcricao.palavras)} palavras`);
  const erro = est.erros[`transcrever:${v.pasta}`];
  if (erro) return h('span', { class: 'chip rosa' }, erro === 'Cancelado.' ? 'transcrição cancelada' : 'a transcrição não saiu');
  if (v.transcrever === 'auto') return h('span', { class: 'chip' }, 'transcrição na fila');
  return null;
}

// Durante o trabalho, só os chips mudam (redesenhar a lista toda faria as capas piscarem)
function atualizarChips() {
  if (!est.el || !est.el.lista || !est.dados) return;
  for (const v of est.dados.virais) {
    const caixa = est.el.lista.querySelector(`[data-chips="${v.pasta}"]`);
    if (caixa) caixa.replaceChildren(...[chipFotos(v), chipTexto(v), v.estudado ? h('span', { class: 'chip cheio' }, ic('check'), 'estudado') : null].filter(Boolean));
  }
}

async function verTexto(grupo, pasta, titulo) {
  let d;
  try { d = await api(`/api/ferramentas/texto?grupo=${grupo}&pasta=${encodeURIComponent(pasta)}`); } catch (e) { falhou(e); return; }
  let modo = 'texto';
  const caixa = h('pre', { class: 'ferr-texto' }, d.texto || 'Sem texto.');
  const abas = h('div', { class: 'segmentado', role: 'group', 'aria-label': 'Como mostrar', style: 'margin-bottom:10px' },
    [['texto', 'Texto corrido'], ['tempos', 'Com os tempos']].map(([m, nome]) => h('button', {
      type: 'button',
      'aria-pressed': String(modo === m),
      onclick: (ev) => {
        modo = m;
        caixa.textContent = (m === 'texto' ? d.texto : d.tempos) || 'Sem texto.';
        ev.currentTarget.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === ev.currentTarget)));
      },
    }, nome)));
  await janela({
    titulo,
    corpo: h('div', null, abas, caixa),
    botoes: [
      { texto: 'Copiar', icone: 'copiar', esquerda: true, antes: () => { copiar((modo === 'texto' ? d.texto : d.tempos) || '', 'Texto copiado.'); return false; } },
      { texto: 'Fechar', principal: true, valor: null },
    ],
    aoAbrir: (c) => c.classList.add('larga'),
  });
}

async function verFotos(v) {
  let d;
  try { d = await api(`/api/ferramentas/texto?grupo=virais&pasta=${encodeURIComponent(v.pasta)}`); } catch (e) { falhou(e); return; }
  await janela({
    titulo: 'As fotos das cenas',
    corpo: h('div', null,
      h('p', { class: 'suave pequeno', style: 'margin:0 0 10px' }, `Uma a cada ${v.duracao && v.duracao > 180 ? 'alguns' : '2'} segundos, em ordem. É assim que a IA vê o vídeo.`),
      h('div', { class: 'ferr-fotos' }, d.mosaicos.map((f) => h('img', { src: `/api/ferramentas/imagem?pasta=${encodeURIComponent(v.pasta)}&f=${f}`, alt: `Fotos das cenas (${f})`, loading: 'lazy' })))),
    botoes: [{ texto: 'Fechar', principal: true, valor: null }],
    aoAbrir: (c) => c.classList.add('larga'),
  });
}

async function agir(rota, dados, msg) {
  try {
    await api(rota, dados);
    if (msg) aviso(msg);
    await atualizarDados();
    desenharLista();
    processar();
  } catch (e) { falhou(e); }
}

function cartaoDoVideo(v) {
  const capa = h('div', { class: `capa${v.vertical === false ? ' deitada' : ''}` },
    v.capa ? h('img', { src: `/api/ferramentas/imagem?pasta=${encodeURIComponent(v.pasta)}&f=${encodeURIComponent(v.capa)}`, alt: '', loading: 'lazy' }) : ic(v.tipo === 'audio' ? 'microfone' : 'video'));
  const numeros = [
    v.views != null ? `${curto(v.views)} views` : null,
    v.curtidas != null ? `${curto(v.curtidas)} curtidas` : null,
    v.comentarios != null ? `${curto(v.comentarios)} comentários` : null,
  ].filter(Boolean).join(' · ');
  const meta = [v.site, v.perfil, v.duracao ? relogio(v.duracao) : null, v.publicado ? `postado em ${dataBr(v.publicado)}` : null].filter(Boolean).join(' · ');
  const erroFotos = v.fotos === 'erro' || est.erros[`fotos:${v.pasta}`];
  const erroTexto = est.erros[`transcrever:${v.pasta}`];
  return h('article', { class: `ferr-video${est.sel.has(chaveSel('virais', v.pasta)) ? ' selecionado' : ''}` },
    marcador('virais', v.pasta, v.titulo),
    capa,
    h('div', { style: 'min-width:0' },
      h('h3', { title: v.titulo }, v.titulo),
      h('div', { class: 'meta' }, meta),
      numeros ? h('div', { class: 'meta' }, numeros) : null,
      h('div', { class: 'chips', 'data-chips': v.pasta }, chipFotos(v), chipTexto(v), v.estudado ? h('span', { class: 'chip cheio' }, ic('check'), 'estudado') : null),
      h('div', { class: 'ferr-estudar' },
        h('button', { type: 'button', class: 'botao principal pequeno', title: 'A IA estuda o visual: as cenas, o ritmo e o texto na tela', onclick: () => pedirIA(pedidoDoVideo(v), { mensagem: 'Pedido copiado. Cole na sua IA.' }) }, ic('video'), 'Estudar o vídeo'),
        v.transcricao ? h('button', { type: 'button', class: 'botao pequeno', title: 'A IA estuda o roteiro: o gancho, a promessa, as viradas e o fim', onclick: () => pedirIA(pedidoDaFala(v), { mensagem: 'Pedido copiado. Cole na sua IA.' }) }, ic('ia'), 'Estudar a fala') : null),
      h('div', { class: 'acoes' },
        v.transcricao ? h('button', { type: 'button', class: 'botao leve pequeno', onclick: () => verTexto('virais', v.pasta, v.titulo) }, ic('texto'), 'Ver o texto') : null,
        v.mosaicos ? h('button', { type: 'button', class: 'botao leve pequeno', onclick: () => verFotos(v) }, ic('grade'), 'Ver as fotos') : null,
        erroFotos ? h('button', { type: 'button', class: 'botao pequeno', onclick: () => { delete est.erros[`fotos:${v.pasta}`]; agir('/api/ferramentas/fotos-de-novo', { pasta: v.pasta }); } }, ic('recarregar'), 'Tirar as fotos de novo') : null,
        erroTexto ? h('button', { type: 'button', class: 'botao pequeno', onclick: () => { delete est.erros[`transcrever:${v.pasta}`]; agir('/api/ferramentas/transcrever-de-novo', { pasta: v.pasta }); } }, ic('recarregar'), 'Transcrever de novo') : null,
        h('button', { type: 'button', class: 'icone-botao', title: 'Abrir a pasta', 'aria-label': 'Abrir a pasta', onclick: () => agir('/api/ferramentas/abrir', { grupo: 'virais', pasta: v.pasta }) }, ic('pasta')),
        v.transcricao && !erroTexto ? h('button', {
          type: 'button',
          class: 'icone-botao',
          title: 'Transcrever de novo (com o modelo e o idioma escolhidos)',
          'aria-label': 'Transcrever de novo',
          onclick: async () => { if (await confirmar(`Transcrever "${v.titulo}" de novo, com o modelo ${M.MODELOS[est.modelo].nome} e a fala em ${(M.IDIOMAS.find((i) => i[0] === est.idioma) || [])[1]}? O texto de agora sai.`, { sim: 'Transcrever de novo' })) agir('/api/ferramentas/transcrever-de-novo', { pasta: v.pasta }, 'Na fila pra transcrever.'); },
        }, ic('recarregar')) : null,
        h('button', {
          type: 'button',
          class: 'icone-botao',
          title: 'Apagar',
          'aria-label': `Apagar ${v.titulo}`,
          disabled: !!(est.atual && est.atual.pasta === v.pasta),
          onclick: async () => { if (await confirmar(`Apagar a pasta de "${v.titulo}", com o vídeo, as fotos e o texto? O estudo em marketing/virais/ (se tiver) fica.`, { sim: 'Apagar' })) agir('/api/ferramentas/apagar', { grupo: 'virais', pasta: v.pasta }, 'Apagado.'); },
        }, ic('lixo')))));
}

function cartaoDaTranscricao(t) {
  const video = /\.(mp4|m4v|mov|mkv|webm|3gp|mpeg|mpg)$/i.test(t.nome || '');
  return h('article', { class: `ferr-transcricao${est.sel.has(chaveSel('transcricoes', t.pasta)) ? ' selecionado' : ''}` },
    marcador('transcricoes', t.pasta, t.nome),
    h('div', { class: 'ferr-transcricao-ico' }, ic(video ? 'video' : 'microfone')),
    h('div', { style: 'min-width:0' },
      h('h3', { title: t.nome }, t.nome),
      h('div', { class: 'meta' }, [t.em ? `transcrito em ${dataBr(t.em)}` : null, t.modelo].filter(Boolean).join(' · ')),
      h('div', { class: 'chips' },
        t.duracao ? h('span', { class: 'chip' }, ic('relogio'), relogio(t.duracao)) : null,
        h('span', { class: 'chip' }, ic('texto'), `${milhar(t.palavras)} palavras`),
        t.estudado ? h('span', { class: 'chip cheio' }, ic('check'), 'estudado') : null),
      h('div', { class: 'ferr-estudar' },
        h('button', { type: 'button', class: 'botao principal pequeno', title: 'A IA resume, tira as ideias e as frases fortes, e diz o que vira conteúdo', onclick: () => pedirIA(pedidoDaTranscricao(t), { mensagem: 'Pedido copiado. Cole na sua IA.' }) }, ic('ia'), 'Estudar com a IA'),
        h('button', { type: 'button', class: 'botao leve pequeno', onclick: () => verTexto('transcricoes', t.pasta, t.nome) }, ic('texto'), 'Ver o texto'),
        h('span', { class: 'ferr-estudar-resto' },
          h('button', { type: 'button', class: 'icone-botao', title: 'Abrir a pasta', 'aria-label': 'Abrir a pasta', onclick: () => agir('/api/ferramentas/abrir', { grupo: 'transcricoes', pasta: t.pasta }) }, ic('pasta')),
          h('button', {
            type: 'button', class: 'icone-botao', title: 'Apagar', 'aria-label': `Apagar a transcrição de ${t.nome}`,
            onclick: async () => { if (await confirmar(`Apagar a transcrição de "${t.nome}"? O arquivo original não é apagado.`, { sim: 'Apagar' })) agir('/api/ferramentas/apagar', { grupo: 'transcricoes', pasta: t.pasta }, 'Apagada.'); },
          }, ic('lixo'))))));
}

function desenharLista() {
  const el = est.el;
  if (!el || !el.lista || !el.lista.isConnected || !est.dados) return;
  const v = est.dados.virais;
  el.lista.replaceChildren(v.length
    ? h('div', { class: 'ferr-videos' }, v.map(cartaoDoVideo))
    : vazio({ titulo: 'Nenhum vídeo baixado ainda', texto: 'Cole aqui em cima o link de um vídeo que viralizou. Ele vem com a capa e os números do post, e depois saem as fotos das cenas e o texto falado, sozinhos.' }));
  const t = est.dados.transcricoes;
  el.contaV.textContent = v.length ? String(v.length) : '';
  el.contaT.textContent = t.length ? String(t.length) : '';
  el.listaT.replaceChildren(t.length
    ? h('div', { class: 'ferr-videos' }, t.map(cartaoDaTranscricao))
    : vazio({ titulo: 'Nenhuma transcrição ainda', texto: 'Arraste aqui em cima um áudio ou vídeo do computador (uma aula, uma reunião, um áudio do WhatsApp). O texto aparece aqui, pronto pra IA estudar.' }));
  const existem = new Set([...v.map((x) => chaveSel('virais', x.pasta)), ...t.map((x) => chaveSel('transcricoes', x.pasta))]);
  for (const k of [...est.sel]) if (!existem.has(k)) est.sel.delete(k);
  guardarSel();
  atualizarSelecao();
  est.ultimaAssinatura = assinatura(est.dados);
}

// Enquanto a tela está aberta, confere o andamento: rápido com download, devagar sem (pega o que veio pelo terminal)
function ligarRelogio(agora = false) {
  if (est.timer && !agora) return;
  clearTimeout(est.timer);
  const tique = async () => {
    est.timer = null;
    if (!est.el || !est.el.lista || !est.el.lista.isConnected) return;
    try { await atualizarDados(); } catch { est.timer = setTimeout(tique, 5000); return; }
    if (assinatura(est.dados) !== est.ultimaAssinatura) desenharLista();
    desenharTarefas();
    if (!est.rodando && temPendente()) processar();
    est.timer = setTimeout(tique, temDownload() || (est.dados.baixador && est.dados.baixador.instalando) ? 800 : 4000);
  };
  est.timer = setTimeout(tique, agora ? 300 : 800);
}

export async function montar(alvo, ctx) {
  await Promise.all([atualizarDados(), garantirAparelho()]);
  if (!est.dados.baixador.pronto && !est.dados.baixador.instalando) {
    api('/api/ferramentas/preparar', {}).then(() => ligarRelogio(true)).catch(() => {});
  }

  est.el = {
    tarefas: h('div', { class: 'pilha', style: 'margin-top:14px' }),
    agora: h('section', { class: 'painel vidro ferr-agora', 'aria-live': 'polite' }),
    lista: h('div'),
    listaT: h('div'),
    contaV: h('span', { class: 'conta' }),
    contaT: h('span', { class: 'conta' }),
  };
  const abrirPasta = (grupo) => h('button', { type: 'button', class: 'icone-botao ferr-abrir', title: 'Abrir a pasta', 'aria-label': 'Abrir a pasta', onclick: () => agir('/api/ferramentas/abrir', { grupo }) }, ic('pasta'));
  est.el.todosV = h('button', { type: 'button', class: 'ferr-todos', hidden: true, onclick: () => selecionarTodos('virais') }, 'Selecionar todos');
  est.el.todosT = h('button', { type: 'button', class: 'ferr-todos', hidden: true, onclick: () => selecionarTodos('transcricoes') }, 'Selecionar todos');
  const sub = (icone, titulo, conta, texto, extra, todos) => h('div', { class: 'ferr-sub' },
    h('div', { class: 'ferr-sub-titulo' }, ic(icone), h('h3', null, titulo), conta, extra),
    texto ? h('p', { class: 'fraco pequeno' }, texto) : null,
    todos ? h('div', { class: 'ferr-sub-selecao' }, h('span', { class: 'fraco pequeno' }, 'Marque pra estudar vários juntos e achar os padrões.'), todos) : null);

  alvo.append(
    cabeca({ titulo: 'Ferramentas', texto: 'Baixe um vídeo pra estudar e transforme fala em texto. Tudo roda neste computador: nada vai pra servidor nenhum.' }),
    est.el.agora,
    h('div', { class: 'ferr-colunas' },
      // Baixar um vídeo, com os vídeos baixados embaixo
      h('section', { class: 'painel vidro ferr-coluna' },
        tituloDaParte('baixar', 'Baixar um vídeo', 'Cole o link de um vídeo que viralizou. A IA estuda o visual e a fala dele.'),
        formularioDeBaixar(),
        est.el.tarefas,
        sub('video', 'Vídeos baixados', est.el.contaV, 'As fotos das cenas e o texto saem sozinhos, um por vez. Deixe esta aba aberta.', abrirPasta('virais'), est.el.todosV),
        est.el.lista),
      // Transcrever, com as transcrições embaixo
      h('section', { class: 'painel vidro ferr-coluna' },
        tituloDaParte('microfone', 'Transcrever', 'Um áudio ou vídeo do computador vira texto. A IA estuda o que foi falado.'),
        h('div', { class: 'pilha' }, zonaDeSoltar(), escolhaDoModelo()),
        sub('texto', 'Transcrições de arquivos do computador', est.el.contaT, 'O arquivo não sai do computador: só o texto fica na pasta.', abrirPasta('transcricoes'), est.el.todosT),
        est.el.listaT)),
    barraDeSelecao());

  desenharTarefas();
  desenharLista();
  desenharAgora();
  ligarRelogio(true);
  processar();

  return {
    titulo: 'Ferramentas',
    podeRecarregar: () => {
      const foco = document.activeElement;
      return !(foco && foco.closest && foco.closest('.ferr-baixar') && foco.value);
    },
  };
}
