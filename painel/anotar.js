#!/usr/bin/env node
// O anotador: lê a conversa com a IA e anota no cérebro o que ficou pra trás.
//
// A IA principal já anota na hora (AGENTS.md, seção 4). Mas, no meio de uma tarefa grande, ela esquece.
// O anotador roda escondido, com um modelo barato (Haiku), e confere só as mensagens novas:
//   - a cada 5 mensagens do dono (gancho Stop, no fim de cada resposta);
//   - sempre no fim da conversa (SessionEnd) e antes da conversa ser resumida (PreCompact).
// Mensagem curtinha ("ok", "valeu") não conta. Nada novo = não chama a IA = não gasta nada.
//
//   node painel/anotar.js --gancho stop|compactar|fim   (os ganchos do Claude Code mandam a conversa pela entrada)
//   node painel/anotar.js --agora                      anota agora a conversa mais recente desta pasta
//   node painel/anotar.js --agora --conversa <arquivo>  anota agora um arquivo de conversa (.jsonl)
//
// Liga e desliga em memoria/preferencias.md ("Anotar sozinho") ou no painel (Ajustes).
// O que ele anotou fica em painel/.anotador.log (o painel mostra no Dashboard). Não vai pro GitHub.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
const ESTADO = path.join(__dirname, '.anotador.json');
const LOG = path.join(__dirname, '.anotador.log');
const TRAVA = path.join(__dirname, '.anotador.lock');
const MIN_MENSAGENS = 5; // a cada quantas mensagens do dono o anotador confere (no fim de cada resposta)
const MAX_CARACTERES = 24000; // o tanto de conversa que vai pro anotador de uma vez (o mais recente)
const MAX_LOG = 200;
const TEMPO_MAXIMO = 4 * 60 * 1000;

const args = process.argv.slice(2);
const valor = (nome) => { const i = args.indexOf(nome); return i >= 0 ? args[i + 1] : null; };

// ---------- quando roda ----------

function ligado() {
  const pref = require('./lib/preferencias');
  return !pref.nao(pref.ler('anotar sozinho'));
}

// A pasta do próprio modelo (quem programa o modelo) não anota: o cérebro de lá vai pra todo mundo
function ehOModelo() {
  try { return !!require('./lib/git').estado().doModelo; } catch { return false; }
}

function modelo() {
  const v = require('./lib/preferencias').ler('modelo do anotador').trim();
  return /^[A-Za-z0-9][A-Za-z0-9._:[\]-]{0,79}$/.test(v) ? v : 'haiku';
}

// ---------- ler a conversa (o arquivo .jsonl do Claude Code) ----------

function limpar(texto) {
  return String(texto || '')
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
    .replace(/<ide_[a-z_]+>[\s\S]*?<\/ide_[a-z_]+>/g, '')
    .replace(/<(command|local-command)-[a-z-]+>[\s\S]*?<\/\1-[a-z-]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function textosDe(conteudo) {
  if (typeof conteudo === 'string') return [conteudo];
  if (!Array.isArray(conteudo)) return [];
  return conteudo.filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text);
}

// Só o que importa: o que o dono escreveu e o que a IA respondeu em texto (sem ferramentas e sem arquivos lidos)
function extrair(linhas) {
  const out = [];
  for (const linha of linhas) {
    let d;
    try { d = JSON.parse(linha); } catch { continue; }
    if (d.isMeta || d.isSidechain) continue;
    if (d.type === 'user' && d.message) {
      for (const t of textosDe(d.message.content)) {
        const s = limpar(t);
        if (!s || s.startsWith('<') || /^Base directory for this skill/i.test(s) || /^\[Request interrupted/i.test(s)) continue;
        out.push({ papel: 'dono', texto: s });
      }
    } else if (d.type === 'attachment' && d.attachment && d.attachment.type === 'queued_command') {
      // mensagem que o dono mandou enquanto a IA ainda trabalhava
      for (const t of textosDe(d.attachment.prompt)) {
        const s = limpar(t);
        if (s && !s.startsWith('<')) out.push({ papel: 'dono', texto: s });
      }
    } else if (d.type === 'assistant' && d.message) {
      const s = limpar(textosDe(d.message.content).join('\n'));
      if (s) out.push({ papel: 'ia', texto: s });
    }
  }
  return out;
}

function trivial(texto) {
  const t = texto.toLowerCase().replace(/[!.?,\s]+/g, ' ').trim();
  return t.length < 4 || (t.length < 25 && /^(ok|okay|blz|beleza|valeu|vlw|obrigad[oa]|brigad[oa]|sim|nao|não|isso|pode|show|top|perfeito|massa|boa|certo|entendi|legal|bom dia|boa tarde|boa noite|oi|ola|olá)\b/.test(t));
}

// O trecho que vai pro anotador: mensagens do dono inteiras; da IA, só o começo e as linhas "📌 Anotei" (o que ela já salvou)
function montarTrecho(msgs) {
  const partes = msgs.map((m) => {
    if (m.papel === 'dono') return `DONO: ${m.texto}`;
    const anotou = m.texto.split('\n').filter((l) => l.includes('📌')).join('\n');
    let curto = m.texto.length > 700 ? `${m.texto.slice(0, 700)}...` : m.texto;
    if (anotou && !curto.includes(anotou)) curto += `\n${anotou}`;
    return `IA: ${curto}`;
  });
  const out = [];
  let total = 0;
  for (let i = partes.length - 1; i >= 0; i--) {
    total += partes[i].length + 2;
    if (total > MAX_CARACTERES && out.length) break;
    out.unshift(partes[i]);
  }
  return out.join('\n\n');
}

// ---------- estado, trava e registro ----------

function lerJson(abs, padrao) {
  try { return JSON.parse(fs.readFileSync(abs, 'utf8')); } catch { return padrao; }
}

function gravarJson(abs, dados) {
  const tmp = `${abs}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(dados, null, 1));
  fs.renameSync(tmp, abs);
}

function vivo(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function travar() {
  const t = lerJson(TRAVA, null);
  if (t && t.pid && vivo(t.pid) && Date.now() - t.desde < TEMPO_MAXIMO + 60000) return false;
  gravarJson(TRAVA, { pid: process.pid, desde: Date.now() });
  return true;
}

function destravar() {
  try { if ((lerJson(TRAVA, {}) || {}).pid === process.pid) fs.unlinkSync(TRAVA); } catch { /* já foi */ }
}

function registrar(entrada) {
  let linhas = [];
  try { linhas = fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean); } catch { /* primeiro */ }
  linhas.push(JSON.stringify(entrada));
  fs.writeFileSync(LOG, `${linhas.slice(-MAX_LOG).join('\n')}\n`);
}

// Fotografia dos arquivos do cérebro (pra saber o que o anotador mudou)
function fotografia() {
  const { listar, relativo } = require('./lib/raiz');
  const mapa = new Map();
  for (const abs of listar({ extensoes: ['.md'], profundidade: 5 })) {
    try { mapa.set(relativo(abs), fs.statSync(abs).mtimeMs); } catch { /* sumiu */ }
  }
  return mapa;
}

// ---------- chamar a IA ----------

const INSTRUCOES = `Você é o anotador do cérebro deste negócio (esta pasta). Você trabalha escondido: o dono não lê o que você escreve aqui.

Leia o AGENTS.md (seção 4, "Aprender sozinho") e siga a tabela e as regras de salvar.

Abaixo vem um trecho NOVO da conversa entre o dono e a IA dele. Ache o que vale guardar e ainda não está salvo, e salve no arquivo certo.
- As linhas "📌 Anotei" da IA mostram o que ela já salvou. Não repita.
- Antes de escrever, abra o arquivo de destino e confira se a informação já não está lá.
- Edite só a linha ou o bloco certo, no formato das linhas "Pra IA" do topo do arquivo. Nunca reescreva o arquivo inteiro.
- A informação nova contradiz o que já está salvo? Não troque. Anote em memoria/cronograma.md, em "Decisões pra tomar": "Confirmar: X ou Y?".
- Pedido de programar ou mudar o painel, o código ou as receitas desta pasta NÃO é informação do negócio. Só guarde dali uma preferência do dono sobre como a IA deve trabalhar.
- Nunca salve senha, chave, token, número de cartão, CPF, CNPJ, RG ou dado de banco.
- Não invente nada. Guarde só o que o dono disse ou decidiu. Campo sem informação fica vazio (não escreva "não disse" nem "a definir").
- Nada novo pra guardar? Não mexa em arquivo nenhum.

No fim, responda só com uma lista curta, uma linha por coisa salva: "- o que foi (arquivo)". Se não salvou nada, responda só: nada novo.`;

function chamarAnotador(trecho) {
  const chat = require('./lib/chat');
  const comando = chat.caminhos().claude;
  if (!comando) return Promise.resolve({ erro: 'Claude Code não encontrado neste computador.' });
  const a = ['-p', '--model', modelo(), '--output-format', 'json',
    '--permission-mode', 'acceptEdits',
    '--allowedTools', 'Read', 'Edit', 'Write', 'Glob', 'Grep',
    '--disallowedTools', 'Bash', 'WebFetch', 'WebSearch', 'Task', 'Agent',
    '--no-session-persistence'];
  if (chat.infoDoClaude().esforcos.includes('low')) a.push('--effort', 'low');
  return new Promise((resolve) => {
    let saida = '';
    let erro = '';
    let p;
    try {
      p = chat.chamarIA(comando, a, { cwd: RAIZ, env: { ...process.env, PAINEL_ANOTADOR: '1' }, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) { resolve({ erro: e.message }); return; }
    const relogio = setTimeout(() => { try { p.kill(); } catch { /* já parou */ } }, TEMPO_MAXIMO);
    p.stdout.on('data', (d) => { saida += d; });
    p.stderr.on('data', (d) => { erro = (erro + d).slice(-2000); });
    p.on('error', (e) => { clearTimeout(relogio); resolve({ erro: e.message }); });
    p.on('close', (codigo) => {
      clearTimeout(relogio);
      let r = null;
      try { r = JSON.parse(saida.trim().split('\n').pop()); } catch { /* sem json */ }
      if (r && !r.is_error) resolve({ resumo: String(r.result || '').trim() });
      else resolve({ erro: (r && (r.result || (r.errors || []).join(' '))) || erro.trim().split('\n').slice(-2).join(' ') || `saiu com código ${codigo}` });
    });
    p.stdin.on('error', () => {});
    p.stdin.end(`${INSTRUCOES}\n\n<conversa>\n${trecho}\n</conversa>`);
  });
}

// ---------- o trabalho ----------

function conversaMaisRecente() {
  const pasta = path.join(os.homedir(), '.claude', 'projects', RAIZ.replace(/[^A-Za-z0-9]/g, '-'));
  try {
    return fs.readdirSync(pasta).filter((n) => n.endsWith('.jsonl'))
      .map((n) => path.join(pasta, n))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] || null;
  } catch { return null; }
}

async function trabalhar({ gancho, sessao, conversa, forcar }) {
  if (!conversa || !fs.existsSync(conversa)) return;
  if (!ligado() || ehOModelo()) return;
  const id = sessao || path.basename(conversa, '.jsonl');
  if (!travar()) {
    // outro anotador está rodando: deixa um recado pra ele conferir de novo quando terminar
    const st = lerJson(ESTADO, { sessoes: {} });
    st.pendentes = { ...(st.pendentes || {}), [id]: { conversa, gancho } };
    gravarJson(ESTADO, st);
    return;
  }
  try {
    let fila = [{ id, conversa, gancho, forcar }];
    for (let volta = 0; volta < 3 && fila.length; volta++) {
      const atual = fila.shift();
      await conferir(atual);
      const st = lerJson(ESTADO, { sessoes: {} });
      if (st.pendentes && Object.keys(st.pendentes).length) {
        fila = fila.concat(Object.entries(st.pendentes).map(([pid, p]) => ({ id: pid, conversa: p.conversa, gancho: p.gancho })));
        delete st.pendentes;
        gravarJson(ESTADO, st);
      }
    }
  } finally {
    destravar();
  }
}

async function conferir({ id, conversa, gancho, forcar }) {
  const st = lerJson(ESTADO, { sessoes: {} });
  st.sessoes = st.sessoes || {};
  const ck = st.sessoes[id] || { linha: 0 };
  let linhas;
  try { linhas = fs.readFileSync(conversa, 'utf8').split('\n').filter(Boolean); } catch { return; }
  if (linhas.length < ck.linha) ck.linha = 0; // o arquivo foi trocado
  const msgs = extrair(linhas.slice(ck.linha));
  const doDono = msgs.filter((m) => m.papel === 'dono' && !trivial(m.texto));
  const minimo = gancho === 'stop' && !forcar ? MIN_MENSAGENS : 1;
  if (doDono.length < minimo) return; // junta mais (não avança a marca)

  const antes = fotografia();
  const inicio = Date.now();
  const r = await chamarAnotador(montarTrecho(msgs));
  const depois = fotografia();
  const mudou = [...depois.entries()].filter(([rel, t]) => antes.get(rel) !== t && !rel.startsWith('painel/')).map(([rel]) => rel);

  const itens = r.resumo && !/^nada novo\.?$/i.test(r.resumo)
    ? r.resumo.split('\n').map((l) => l.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean).slice(0, 20)
    : [];
  registrar({ quando: Date.now(), gancho, sessao: id, mensagens: doDono.length, segundos: Math.round((Date.now() - inicio) / 1000), itens, arquivos: mudou, erro: r.erro || null });

  if (!r.erro) {
    const novo = lerJson(ESTADO, { sessoes: {} });
    novo.sessoes = novo.sessoes || {};
    novo.sessoes[id] = { linha: linhas.length, quando: Date.now() };
    // guarda só as 30 conversas mais recentes
    const ordem = Object.entries(novo.sessoes).sort((a, b) => b[1].quando - a[1].quando).slice(0, 30);
    novo.sessoes = Object.fromEntries(ordem);
    gravarJson(ESTADO, novo);
  }

  // Salvar no GitHub sozinho ligado? Guarda o que o anotador escreveu
  if (mudou.length) {
    try {
      spawn(process.execPath, [path.join(__dirname, 'salvar.js'), '--auto'], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    } catch { /* fica pra próxima */ }
  }
}

// ---------- começo ----------

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
    const relogio = setTimeout(fim, 1500);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (d) => { txt += d; });
    process.stdin.on('end', () => { clearTimeout(relogio); fim(); });
    process.stdin.on('error', () => { clearTimeout(relogio); fim(); });
  });
}

async function principal() {
  // A própria sessão do anotador (e a de quem ele chama) não dispara outro anotador
  if (process.env.PAINEL_ANOTADOR === '1') return;

  if (args.includes('--trabalhar')) {
    await trabalhar({ gancho: valor('--gancho') || 'stop', sessao: valor('--sessao'), conversa: valor('--conversa'), forcar: args.includes('--forcar') });
    return;
  }

  if (args.includes('--agora')) {
    const conversa = valor('--conversa') || conversaMaisRecente();
    if (!conversa) { console.log('Não achei nenhuma conversa desta pasta.'); return; }
    if (!ligado()) { console.log('O anotador está desligado (memoria/preferencias.md, "Anotar sozinho").'); return; }
    if (ehOModelo()) { console.log('Esta pasta ainda está ligada ao modelo no GitHub: o anotador não roda aqui.'); return; }
    const tamanho = () => { try { return fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean).length; } catch { return 0; } };
    const antes = tamanho();
    await trabalhar({ gancho: 'manual', conversa, forcar: true });
    if (tamanho() === antes) { console.log('Nada novo desde a última vez.'); return; }
    const ultima = fs.readFileSync(LOG, 'utf8').trim().split('\n').pop();
    try {
      const u = JSON.parse(ultima);
      console.log(u.erro ? `Não deu certo: ${u.erro}` : (u.itens.length ? `Anotei:\n- ${u.itens.join('\n- ')}` : 'Nada novo pra anotar.'));
    } catch { console.log('Nada novo pra anotar.'); }
    return;
  }

  // Chamado por um gancho do Claude Code: lê a conversa e sai logo; o trabalho roda separado, sem segurar a IA
  const entrada = await lerEntrada();
  const conversa = entrada.transcript_path;
  if (!conversa) return;
  const gancho = valor('--gancho') || 'stop';
  const filho = spawn(process.execPath, [__filename, '--trabalhar', '--gancho', gancho, '--sessao', String(entrada.session_id || ''), '--conversa', conversa], {
    cwd: RAIZ, detached: true, stdio: 'ignore', windowsHide: true,
  });
  filho.unref();
}

principal().catch(() => { /* o anotador nunca atrapalha a conversa */ });
