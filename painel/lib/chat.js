// Chat com a IA da pessoa, dentro do painel.
// O painel não tem IA própria: ele chama a IA que o dono já usa no computador (Claude Code, Codex ou Gemini),
// com a conta dele, dentro desta pasta. A IA lê o AGENTS.md, mexe nos arquivos e o painel se atualiza sozinho.
//   Claude Code: completo (resposta aos poucos, mostra os arquivos que ela abriu ou mudou, continua a conversa).
//   Codex e Gemini: modo simples (resposta inteira no fim; a conversa continua mandando as últimas mensagens).
// A conversa fica em painel/.chat.json (só neste computador; não vai pro GitHub).
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');
const { RAIZ, existe } = require('./raiz');
const { ErroPainel } = require('./erro');

const ARQUIVO = path.join(RAIZ, 'painel', '.chat.json');
const MAX_MENSAGENS = 200;
const WIN = process.platform === 'win32';

const AVISO_SISTEMA = [
  'Você está conversando com o dono pelo chat que fica dentro do painel web (não pelo terminal).',
  'O painel já está aberto na frente dele: não mande o link do painel.',
  'Siga o AGENTS.md desta pasta. Respostas curtas, em português simples.',
].join(' ');

// Modelos: o Claude Code aceita apelidos (opus, sonnet, haiku) que sempre apontam pro mais novo que ele conhece.
// "Padrão" não manda nada: vale o modelo que a pessoa escolheu no próprio Claude Code/Codex/Gemini.
// Qualquer outro nome dá pra escrever em "Outro" (ex.: o nome completo de um modelo novo).
const PROVEDORES = {
  claude: {
    nome: 'Claude Code', comando: 'claude', site: 'https://claude.com/claude-code', completo: true,
    modelos: [
      { id: '', nome: 'Padrão', dica: 'o do seu Claude Code' },
      { id: 'opus', nome: 'Opus', dica: 'mais inteligente', grupo: 'Sempre o mais novo' },
      { id: 'sonnet', nome: 'Sonnet', dica: 'equilibrado', grupo: 'Sempre o mais novo' },
      { id: 'haiku', nome: 'Haiku', dica: 'mais rápido', grupo: 'Sempre o mais novo' },
      // Versão fixa: precisam de um Claude Code recente (o erro "versão antiga" vira um aviso em português)
      { id: 'claude-fable-5-2', nome: 'Fable 5.2', dica: 'o mais capaz', grupo: 'Versão fixa' },
      { id: 'claude-opus-5-5', nome: 'Opus 5.5', grupo: 'Versão fixa' },
      { id: 'claude-sonnet-5-5', nome: 'Sonnet 5.5', grupo: 'Versão fixa' },
      { id: 'claude-haiku-5-5', nome: 'Haiku 5.5', grupo: 'Versão fixa' },
    ],
    esforco: true,
  },
  codex: { nome: 'Codex', comando: 'codex', site: 'https://github.com/openai/codex', completo: false, modelos: [{ id: '', nome: 'Padrão', dica: 'o do seu Codex' }] },
  gemini: { nome: 'Gemini', comando: 'gemini', site: 'https://github.com/google-gemini/gemini-cli', completo: false, modelos: [{ id: '', nome: 'Padrão', dica: 'o do seu Gemini' }] },
};

const RE_MODELO = /^[A-Za-z0-9][A-Za-z0-9._:[\]-]{0,79}$/;

// Esforço: o quanto a IA pensa antes de responder. Mais esforço = resposta melhor, mais lenta e gasta mais.
const ESFORCOS = [
  { id: 'low', nome: 'Baixo', dica: 'rápido' },
  { id: 'medium', nome: 'Médio' },
  { id: 'high', nome: 'Alto' },
  { id: 'xhigh', nome: 'Extra alto' },
  { id: 'max', nome: 'Máximo', dica: 'pensa mais, demora mais' },
];
let cacheClaude = null; // { versao, esforcos: ['low', ...] }

let avisar = () => {};
let rodando = null; // { processo, provedor, inicio }
let cacheCaminhos = null;

// ---------- achar a IA instalada ----------

// Quem abre o painel com dois cliques nem sempre tem o PATH do terminal: procura também nos lugares de sempre
function lugaresComuns(comando) {
  const casa = os.homedir();
  const nomes = WIN ? [`${comando}.cmd`, `${comando}.exe`, `${comando}.ps1`, comando] : [comando];
  const pastas = WIN
    ? [path.join(process.env.APPDATA || '', 'npm'), path.join(casa, '.local', 'bin'), path.join(casa, 'AppData', 'Local', 'Programs', comando)]
    : [path.join(casa, '.local', 'bin'), path.join(casa, '.claude', 'local'), path.join(casa, '.npm-global', 'bin'), path.join(casa, '.bun', 'bin'), '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin'];
  const out = [];
  for (const p of pastas) for (const n of nomes) out.push(path.join(p, n));
  return out;
}

function acharComando(comando) {
  try {
    const r = spawnSync(WIN ? 'where' : 'which', [comando], { encoding: 'utf8', timeout: 4000, windowsHide: true });
    const achado = (r.stdout || '').split(/\r?\n/).map((s) => s.trim()).find(Boolean);
    if (r.status === 0 && achado) return achado;
  } catch { /* procura nos lugares comuns */ }
  return lugaresComuns(comando).find((p) => existe(p)) || null;
}

// Pergunta pro Claude Code instalado a versão e quais níveis de esforço ele aceita (muda de versão pra versão)
function infoDoClaude({ deNovo = false } = {}) {
  if (cacheClaude && !deNovo) return cacheClaude;
  const comando = caminhos()[`claude`];
  cacheClaude = { versao: '', esforcos: ['low', 'medium', 'high', 'max'] };
  if (!comando) return cacheClaude;
  const rodar = (args) => {
    try {
      const comShell = WIN && /\.(cmd|bat|ps1)$/i.test(comando);
      const r = spawnSync(comShell ? `"${comando}"` : comando, args, { encoding: 'utf8', timeout: 8000, windowsHide: true, shell: comShell });
      return `${r.stdout || ''}${r.stderr || ''}`;
    } catch { return ''; }
  };
  // Um nível inventado faz o Claude Code dizer quais ele aceita (sem chamar a IA):
  //   novo:   "Unknown --effort value '...' ... Valid values: low, medium, high, xhigh, max."
  //   antigo: "argument '...' is invalid. It must be one of: low, medium, high, max"
  const teste = rodar(['--effort', 'nivel-invalido', '--version']);
  const v = /(\d+\.\d+\.\d+)/.exec(teste) || /(\d+\.\d+\.\d+)/.exec(rodar(['--version']));
  if (v) cacheClaude.versao = v[1];
  let lista = /(?:valid values|must be one of)\s*:\s*([a-z,\s]+)/i.exec(teste);
  let ajuda = '';
  if (!lista) { ajuda = rodar(['--help']); lista = /--effort <[^>]+>[^\n(]*\(([^)]+)\)/.exec(ajuda); }
  if (lista) {
    const ids = lista[1].split(/[,\s]+/).map((x) => x.trim().toLowerCase()).filter((x) => ESFORCOS.some((e) => e.id === x));
    if (ids.length) cacheClaude.esforcos = ids;
  } else if (/--effort/.test(ajuda)) {
    cacheClaude.esforcos = ESFORCOS.map((e) => e.id); // tem --effort, mas não disse a lista: oferece todos
  } else {
    cacheClaude.esforcos = []; // versão sem --effort
  }
  return cacheClaude;
}

function caminhos({ deNovo = false } = {}) {
  if (!cacheCaminhos || deNovo) {
    cacheCaminhos = {};
    for (const [id, p] of Object.entries(PROVEDORES)) cacheCaminhos[id] = acharComando(p.comando);
  }
  return cacheCaminhos;
}

// ---------- guardar a conversa ----------

function ler() {
  try {
    const d = JSON.parse(fs.readFileSync(ARQUIVO, 'utf8'));
    const modelos = d.modelos && typeof d.modelos === 'object' ? d.modelos : {};
    const esforcos = d.esforcos && typeof d.esforcos === 'object' ? d.esforcos : {};
    return { provedor: d.provedor || null, sessao: d.sessao || null, modelos, esforcos, mensagens: Array.isArray(d.mensagens) ? d.mensagens : [] };
  } catch {
    return { provedor: null, sessao: null, modelos: {}, esforcos: {}, mensagens: [] };
  }
}

function gravar(d) {
  const limpo = { ...d, mensagens: d.mensagens.slice(-MAX_MENSAGENS) };
  const tmp = `${ARQUIVO}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(limpo, null, 1), 'utf8');
  fs.renameSync(tmp, ARQUIVO);
}

// ---------- estado (pra tela) ----------

function estado({ deNovo = false } = {}) {
  const achados = caminhos({ deNovo });
  const d = ler();
  const claude = achados.claude ? infoDoClaude({ deNovo }) : null;
  const provedores = Object.entries(PROVEDORES).map(([id, p]) => ({
    id, nome: p.nome, site: p.site, completo: p.completo, instalado: !!achados[id],
    versao: id === 'claude' && claude ? claude.versao : '',
  }));
  let escolhido = d.provedor && achados[d.provedor] ? d.provedor : (provedores.find((p) => p.instalado) || {}).id || null;
  if (!escolhido) escolhido = null;
  const modelo = escolhido ? modeloDe(d, escolhido) : '';
  const comEsforco = escolhido && PROVEDORES[escolhido].esforco;
  const aceitos = comEsforco && claude ? claude.esforcos : [];
  return {
    provedores,
    escolhido,
    modelos: escolhido ? PROVEDORES[escolhido].modelos : [],
    modelo,
    esforcos: comEsforco ? ESFORCOS.map((e) => ({ ...e, aceito: aceitos.includes(e.id) })) : [],
    esforco: comEsforco ? esforcoDe(d, escolhido) : '',
    mensagens: d.mensagens,
    rodando: !!rodando,
  };
}

function modeloDe(d, id) {
  const m = d.modelos && d.modelos[id];
  return typeof m === 'string' && (m === '' || RE_MODELO.test(m)) ? m : '';
}

function esforcoDe(d, id) {
  const e = d.esforcos && d.esforcos[id];
  return typeof e === 'string' && ESFORCOS.some((x) => x.id === e) ? e : '';
}

function escolherEsforco(esforco) {
  const e = String(esforco ?? '').trim().toLowerCase();
  const d = ler();
  const id = d.provedor && caminhos()[d.provedor] ? d.provedor : estado().escolhido;
  if (!id || !PROVEDORES[id].esforco) throw new ErroPainel('Essa IA não deixa escolher o esforço por aqui.');
  if (e && !ESFORCOS.some((x) => x.id === e)) throw new ErroPainel('Nível de esforço desconhecido.');
  if (e && !infoDoClaude().esforcos.includes(e)) {
    throw new ErroPainel(`O seu Claude Code${cacheClaude.versao ? ` (versão ${cacheClaude.versao})` : ''} ainda não tem esse nível. Atualize: abra o terminal e rode "claude update".`);
  }
  d.provedor = id;
  d.esforcos = { ...(d.esforcos || {}), [id]: e };
  gravar(d);
  return estado();
}

function escolherModelo(modelo) {
  const m = String(modelo ?? '').trim();
  if (m && !RE_MODELO.test(m)) throw new ErroPainel('Esse nome de modelo não parece certo. Use só letras, números, ponto e traço.');
  const d = ler();
  const id = d.provedor && caminhos()[d.provedor] ? d.provedor : estado().escolhido;
  if (!id) throw new ErroPainel('Nenhuma IA instalada neste computador.');
  d.provedor = id;
  d.modelos = { ...(d.modelos || {}), [id]: m };
  gravar(d);
  return estado();
}

function escolher(id) {
  if (!PROVEDORES[id]) throw new ErroPainel('IA desconhecida.');
  if (!caminhos()[id]) throw new ErroPainel(`Não achei o ${PROVEDORES[id].nome} neste computador.`);
  const d = ler();
  if (d.provedor !== id) { d.provedor = id; d.sessao = null; }
  gravar(d);
  return estado();
}

function novaConversa() {
  if (rodando) throw new ErroPainel('Espere a IA terminar (ou aperte Parar).');
  const d = ler();
  gravar({ provedor: d.provedor, sessao: null, modelos: d.modelos, esforcos: d.esforcos, mensagens: [] });
  return estado();
}

function parar() {
  if (rodando) {
    rodando.parado = true;
    try { rodando.processo.kill(WIN ? undefined : 'SIGTERM'); } catch { /* já parou */ }
  }
  return { ok: true };
}

// ---------- mandar uma mensagem ----------

function argumentos(id, d) {
  const modelo = modeloDe(d, id);
  if (id === 'claude') {
    const a = ['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
      '--permission-mode', 'acceptEdits',
      '--allowedTools', 'Bash(node painel/*)', 'Bash(npm run baixar*)', 'Bash(git status*)', 'Bash(git log*)', 'Bash(git diff*)',
      '--append-system-prompt', AVISO_SISTEMA];
    if (modelo) a.push('--model', modelo);
    const esforco = esforcoDe(d, id);
    if (esforco && infoDoClaude().esforcos.includes(esforco)) a.push('--effort', esforco);
    if (d.sessao) a.push('--resume', d.sessao);
    else { d.sessao = crypto.randomUUID(); a.push('--session-id', d.sessao); }
    return a;
  }
  if (id === 'codex') return ['exec', '--full-auto', '--skip-git-repo-check', ...(modelo ? ['-m', modelo] : []), '-'];
  return [...(modelo ? ['-m', modelo] : []), '--approval-mode', 'auto_edit'];
}

// Codex e Gemini não continuam a conversa sozinhos: mandamos as últimas mensagens junto
function promptSimples(d, texto) {
  const antes = d.mensagens.slice(-8, -1).map((m) => `${m.papel === 'eu' ? 'Dono' : 'Você'}: ${m.texto}`).join('\n\n');
  return [AVISO_SISTEMA, antes ? `Conversa até aqui:\n${antes}` : '', `Dono: ${texto}`].filter(Boolean).join('\n\n');
}

function nomeCurto(caminho) {
  const s = String(caminho || '');
  const rel = s.startsWith(RAIZ) ? path.relative(RAIZ, s).split(path.sep).join('/') : s;
  return rel.length > 60 ? `...${rel.slice(-57)}` : rel;
}

// O que a IA está fazendo, em português: "Leu negocio/empresa.md", "Mudou memoria/cronograma.md"
function descreverFerramenta(nome, entrada = {}) {
  const arq = nomeCurto(entrada.file_path || entrada.path || entrada.notebook_path || '');
  switch (nome) {
    case 'Read': return `Leu ${arq}`;
    case 'Edit': case 'MultiEdit': return `Mudou ${arq}`;
    case 'Write': return `Escreveu ${arq}`;
    case 'Glob': case 'Grep': case 'LS': return 'Procurou nos arquivos';
    case 'Bash': return `Rodou: ${String(entrada.command || '').slice(0, 70)}`;
    case 'WebFetch': return `Abriu ${String(entrada.url || '').slice(0, 60)}`;
    case 'WebSearch': return `Pesquisou: ${String(entrada.query || '').slice(0, 60)}`;
    case 'TodoWrite': return 'Organizou os passos';
    case 'Skill': return `Usou a receita ${entrada.skill || entrada.command || ''}`.trim();
    case 'Task': case 'Agent': return 'Chamou um ajudante';
    default: return `Usou ${nome}`;
  }
}

function enviar({ texto, contexto } = {}) {
  const pergunta = String(texto || '').trim();
  if (!pergunta) throw new ErroPainel('Escreva a mensagem.');
  if (pergunta.length > 20000) throw new ErroPainel('Mensagem grande demais.');
  if (rodando) throw new ErroPainel('A IA ainda está respondendo. Espere ou aperte Parar.');
  const st = estado();
  const id = st.escolhido;
  if (!id) throw new ErroPainel('Nenhuma IA instalada neste computador.');
  const comando = caminhos()[id];
  const prov = PROVEDORES[id];

  const d = ler();
  d.provedor = id;
  const agora = Date.now();
  d.mensagens.push({ papel: 'eu', texto: pergunta, quando: agora });
  const resposta = { papel: 'ia', texto: '', quando: agora, ferramentas: [], provedor: id, modelo: modeloDe(d, id), esforco: PROVEDORES[id].esforco ? esforcoDe(d, id) : '', id: crypto.randomUUID() };
  d.mensagens.push(resposta);

  const comContexto = contexto ? `${pergunta}\n\n(Contexto do painel: ${String(contexto).slice(0, 300)})` : pergunta;
  const entrada = prov.completo ? comContexto : promptSimples(d, comContexto);
  rodar({ id, comando, prov, d, resposta, entrada, agora, tentativa: 0 });
  return { ok: true, id: resposta.id };
}

function rodar({ id, comando, prov, d, resposta, entrada, agora, tentativa }) {
  const args = argumentos(id, d);
  gravar(d);

  // No Windows, o claude/codex/gemini do npm é um .cmd: precisa do shell, e aí cada argumento vai entre aspas.
  // A mensagem do dono nunca passa pelo shell: ela vai pela entrada padrão (stdin).
  const comShell = WIN && /\.(cmd|bat|ps1)$/i.test(comando);
  const argsFinais = comShell ? args.map((a) => (/[\s()*&|<>^]/.test(a) ? `"${a.replace(/"/g, '')}"` : a)) : args;
  let processo;
  try {
    processo = spawn(comShell ? `"${comando}"` : comando, argsFinais, {
      cwd: RAIZ,
      env: { ...process.env, PAINEL_CHAT: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      shell: comShell,
    });
  } catch (e) {
    resposta.texto = `Não consegui chamar o ${prov.nome}: ${e.message}`;
    resposta.erro = true;
    gravar(d);
    throw new ErroPainel(resposta.texto);
  }
  rodando = { processo, provedor: id, inicio: agora, parado: false };
  if (!tentativa) avisar({ tipo: 'inicio', id: resposta.id });

  // salva aos poucos (se o painel cair no meio, não perde o que já veio)
  let salvarRelogio = null;
  const salvarLogo = () => {
    clearTimeout(salvarRelogio);
    salvarRelogio = setTimeout(() => { try { gravar(d); } catch { /* tenta de novo no fim */ } }, 600);
  };

  let buffer = '';
  let textoFinal = '';
  let erroTexto = '';
  let blocoAtual = '';
  let quebra = false;
  let sessaoInvalida = false;
  const SEM_CONVERSA = /No conversation found|session.*not found/i;

  const tratarLinha = (linha) => {
    if (!linha.trim()) return;
    if (!prov.completo) { resposta.texto += `${linha}\n`; avisar({ tipo: 'texto', id: resposta.id, texto: `${linha}\n` }); salvarLogo(); return; }
    let ev;
    try { ev = JSON.parse(linha); } catch { return; }
    if (ev.type === 'stream_event' && ev.event) {
      const e = ev.event;
      if (e.type === 'content_block_start') blocoAtual = e.content_block && e.content_block.type;
      if (e.type === 'content_block_delta' && e.delta && e.delta.type === 'text_delta') {
        // texto novo depois de usar uma ferramenta: separa num parágrafo
        if (resposta.texto && blocoAtual === 'text' && quebra) { resposta.texto += '\n\n'; avisar({ tipo: 'texto', id: resposta.id, texto: '\n\n' }); }
        quebra = false;
        resposta.texto += e.delta.text;
        avisar({ tipo: 'texto', id: resposta.id, texto: e.delta.text });
        salvarLogo();
      }
      return;
    }
    if (ev.type === 'assistant' && ev.message && Array.isArray(ev.message.content)) {
      // o modelo que respondeu de verdade (ex.: "claude-opus-4-6"), pra mostrar embaixo da resposta
      if (ev.message.model && !/^</.test(ev.message.model) && !resposta.modeloUsado) resposta.modeloUsado = ev.message.model;
      for (const b of ev.message.content) {
        if (b.type !== 'tool_use') continue;
        const f = descreverFerramenta(b.name, b.input || {});
        resposta.ferramentas.push(f);
        quebra = true;
        avisar({ tipo: 'ferramenta', id: resposta.id, texto: f });
      }
      salvarLogo();
      return;
    }
    if (ev.type === 'result') {
      textoFinal = typeof ev.result === 'string' ? ev.result : '';
      const erros = Array.isArray(ev.errors) ? ev.errors.join(' ') : '';
      if (SEM_CONVERSA.test(erros)) sessaoInvalida = true;
      if (ev.is_error) erroTexto = textoFinal || erros || 'A IA parou com erro.';
    }
  };

  processo.stdout.setEncoding('utf8');
  processo.stdout.on('data', (pedaco) => {
    buffer += pedaco;
    let i;
    while ((i = buffer.indexOf('\n')) >= 0) { tratarLinha(buffer.slice(0, i)); buffer = buffer.slice(i + 1); }
  });
  let stderr = '';
  processo.stderr.setEncoding('utf8');
  processo.stderr.on('data', (s) => {
    stderr = (stderr + s).slice(-4000);
    if (SEM_CONVERSA.test(s)) sessaoInvalida = true;
  });

  const terminar = (codigo, falha) => {
    if (!rodando || rodando.processo !== processo) return;
    if (buffer) { tratarLinha(buffer); buffer = ''; }
    clearTimeout(salvarRelogio);
    const parado = rodando.parado;
    rodando = null;

    // A conversa antiga sumiu (outro computador, apagaram a pasta do Claude): começa uma nova e manda de novo
    if (sessaoInvalida && !parado && !tentativa && !resposta.texto.trim()) {
      d.sessao = null;
      resposta.ferramentas = [];
      try { rodar({ id, comando, prov, d, resposta, entrada, agora, tentativa: 1 }); return; } catch { /* cai no erro abaixo */ }
    }

    if (!resposta.texto.trim() && textoFinal) resposta.texto = textoFinal;
    resposta.texto = resposta.texto.trim();
    if (parado) {
      resposta.texto = `${resposta.texto}\n\n*(parado por você)*`.trim();
    } else if (falha || erroTexto || (codigo !== 0 && !resposta.texto)) {
      resposta.erro = true;
      const detalhe = falha ? falha.message : (erroTexto || stderr.trim().split(/\r?\n/).slice(-3).join(' ') || `saiu com código ${codigo}`);
      // a IA às vezes já escreveu o próprio erro como resposta: não repete
      const jaVeio = resposta.texto && (detalhe.includes(resposta.texto) || resposta.texto.includes(detalhe));
      const antes = resposta.texto && !jaVeio ? `${resposta.texto}\n\n` : '';
      if (/claude_code_version_too_old|or newer is required/i.test(detalhe)) {
        const precisa = /version (\d+\.\d+\.\d+) or newer/i.exec(detalhe);
        resposta.texto = `${antes}O seu ${prov.nome}${cacheClaude && cacheClaude.versao ? ` (versão ${cacheClaude.versao})` : ''} é antigo demais pra esse modelo${precisa ? ` (precisa da ${precisa[1]} ou mais nova)` : ''}. Abra o terminal e rode \`claude update\`. Depois clique em "Já atualizei" no topo do chat, ou escolha outro modelo.`;
        resposta.precisaAtualizar = true;
      } else if (/argument '[^']*' is invalid/i.test(detalhe) && /effort/i.test(detalhe)) {
        resposta.texto = `${antes}O seu ${prov.nome} não conhece esse nível de esforço. Escolha outro em "Esforço", ou atualize com \`claude update\`.`;
        resposta.precisaAtualizar = true;
      } else if (/issue with the selected model|model.{0,40}(not found|not exist|not available|invalid|unknown)|invalid model|unknown model/i.test(detalhe)) {
        resposta.texto = `${antes}Esse modelo${resposta.modelo ? ` (${resposta.modelo})` : ''} não está disponível na sua conta ou no seu ${prov.nome}. Escolha outro em "Modelo", no topo do chat.`;
      } else if (/log ?in|login|auth|credential|api key|not logged/i.test(detalhe)) {
        resposta.texto = `${antes}A IA não entrou na sua conta. Abra o terminal, rode \`${prov.comando}\` e entre na sua conta. Depois tente de novo aqui.`;
      } else {
        resposta.texto = `${antes}Não deu certo: ${detalhe}`;
      }
    }
    if (sessaoInvalida) d.sessao = null;
    resposta.duracao = Date.now() - agora;
    try { gravar(d); } catch { /* sem disco? */ }
    avisar({ tipo: 'fim', id: resposta.id, mensagem: resposta });
  };

  processo.on('error', (e) => terminar(null, e));
  processo.on('close', (codigo) => terminar(codigo));
  processo.stdin.on('error', () => {});
  processo.stdin.end(entrada);
}

// Chama a IA instalada com segurança. No Windows, o .cmd do npm precisa do shell (e de aspas em cada argumento);
// o texto da pessoa nunca vai por argumento, só pela entrada padrão (stdin).
function chamarIA(comando, args, opcoes = {}) {
  const comShell = WIN && /\.(cmd|bat|ps1)$/i.test(comando);
  const argsFinais = comShell ? args.map((a) => (/[\s()*&|<>^]/.test(a) ? `"${a.replace(/"/g, '')}"` : a)) : args;
  return spawn(comShell ? `"${comando}"` : comando, argsFinais, { windowsHide: true, shell: comShell, ...opcoes });
}

function iniciar(funcaoDeAvisar) {
  avisar = (dados) => { try { funcaoDeAvisar(dados); } catch { /* sem abas abertas */ } };
}

module.exports = { iniciar, estado, escolher, escolherModelo, escolherEsforco, enviar, parar, novaConversa, caminhos, infoDoClaude, chamarIA };
