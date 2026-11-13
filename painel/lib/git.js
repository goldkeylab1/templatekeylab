// GitHub: o backup da pasta. Ver se está ligado e salvar (commit + push).
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const md = require('./md');
const { RAIZ, existe } = require('./raiz');
const pref = require('./preferencias');
const { ErroPainel } = require('./erro');

// O repositório do modelo. Ninguém deve salvar o próprio negócio nele.
const MODELO = 'goldkeylab1/templatekeylab';

function ambiente(interativo) {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
  if (!interativo) env.GCM_INTERACTIVE = 'never';
  return env;
}

function rodar(args, { timeout = 15000, interativo = false } = {}) {
  const r = spawnSync('git', args, { cwd: RAIZ, encoding: 'utf8', timeout, env: ambiente(interativo), windowsHide: true });
  return {
    ok: r.status === 0,
    saida: (r.stdout || '').trim(),
    erro: ((r.stderr || '').trim() || (r.error ? r.error.message : '')),
  };
}

function rodarAsync(args, { timeout = 90000, interativo = false } = {}) {
  return new Promise((resolve) => {
    let saida = '';
    let erro = '';
    let filho;
    try {
      filho = spawn('git', args, { cwd: RAIZ, env: ambiente(interativo), windowsHide: true });
    } catch (e) {
      resolve({ ok: false, saida: '', erro: e.message });
      return;
    }
    const relogio = setTimeout(() => { try { filho.kill(); } catch { /* nada */ } }, timeout);
    filho.stdout.on('data', (d) => { saida += d; });
    filho.stderr.on('data', (d) => { erro += d; });
    filho.on('error', (e) => { clearTimeout(relogio); resolve({ ok: false, saida, erro: e.message }); });
    filho.on('close', (codigo) => { clearTimeout(relogio); resolve({ ok: codigo === 0, saida: saida.trim(), erro: erro.trim() }); });
  });
}

// Tira usuário e senha/token do link antes de mostrar
function limparUrl(url) {
  return String(url || '').replace(/\/\/[^@/]+@/, '//');
}

function donoRepo(url) {
  const m = /github\.com[:/]+([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i.exec(String(url || ''));
  return m ? { dono: m[1], repo: m[2] } : null;
}

function pastaGit() {
  return path.join(RAIZ, '.git');
}

function lerJson(arquivo) {
  try { return JSON.parse(fs.readFileSync(arquivo, 'utf8')); } catch { return null; }
}

function gravarJson(arquivo, dados) {
  try { fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2)); } catch { /* sem problema */ }
}

// ---------- visibilidade (público ou privado) ----------

const CACHE_VIS = () => path.join(pastaGit(), 'keylab-visibilidade.json');

function visibilidadeEmCache(url) {
  const c = lerJson(CACHE_VIS());
  if (c && c.url === limparUrl(url) && Date.now() - c.quando < 12 * 3600 * 1000) return c.resultado;
  return null;
}

// Pergunta pro GitHub se o repositório é público. 404 = privado (ou não existe).
async function verificarVisibilidade(url) {
  const gh = donoRepo(url);
  if (!gh || typeof fetch !== 'function') return null;
  const emCache = visibilidadeEmCache(url);
  if (emCache) return emCache;
  let resultado = null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(`https://api.github.com/repos/${gh.dono}/${gh.repo}`, {
      headers: { 'User-Agent': 'painel-do-negocio', Accept: 'application/vnd.github+json' },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (r.status === 200) {
      const j = await r.json();
      resultado = j.private ? 'privado' : 'publico';
    } else if (r.status === 404) {
      resultado = 'privado';
    }
  } catch { resultado = null; }
  if (resultado) gravarJson(CACHE_VIS(), { url: limparUrl(url), quando: Date.now(), resultado });
  return resultado;
}

// ---------- estado ----------

function ultimoSalvarSozinho() {
  return lerJson(path.join(pastaGit(), 'keylab-ultimo-salvar.json'));
}

function estado() {
  const base = { git: false, repositorio: false, remoto: '', github: false, doModelo: false, mudancas: 0, ultimoCommit: null, naoEnviados: null, visibilidade: null, link: '', salvarSozinho: pref.sim(pref.ler('salvar no github sozinho')), ultimoAuto: null };
  if (!rodar(['--version']).ok) return { ...base, resumo: 'O Git não está instalado.' };
  base.git = true;
  const topo = rodar(['rev-parse', '--show-toplevel']);
  let mesmaPasta = false;
  if (topo.ok) {
    try { mesmaPasta = fs.realpathSync(topo.saida) === fs.realpathSync(RAIZ); } catch { mesmaPasta = false; }
  }
  if (!mesmaPasta) return { ...base, dentroDeOutro: topo.ok, resumo: 'Essa pasta ainda não é um repositório.' };
  base.repositorio = true;
  const url = rodar(['remote', 'get-url', 'origin']);
  const remoto = url.ok ? url.saida : '';
  const gh = donoRepo(remoto);
  const doModelo = !!gh && `${gh.dono}/${gh.repo}`.toLowerCase() === MODELO;
  const mud = rodar(['status', '--porcelain']);
  const ult = rodar(['log', '-1', '--format=%ct']);
  const up = rodar(['rev-list', '--count', '@{u}..HEAD']);
  const res = {
    ...base,
    remoto: limparUrl(remoto),
    github: !!gh,
    doModelo,
    mudancas: mud.ok ? mud.saida.split('\n').filter(Boolean).length : 0,
    ultimoCommit: ult.ok && ult.saida ? Number(ult.saida) * 1000 : null,
    naoEnviados: up.ok ? Number(up.saida) : null,
    visibilidade: gh && !doModelo ? visibilidadeEmCache(remoto) : null,
    link: gh ? `https://github.com/${gh.dono}/${gh.repo}` : '',
    ultimoAuto: ultimoSalvarSozinho(),
  };
  if (!remoto) res.resumo = 'Salvo só no computador. Falta ligar no GitHub.';
  else if (doModelo) res.resumo = 'Ainda ligado ao modelo, não ao seu GitHub.';
  else if (res.visibilidade === 'publico') res.resumo = 'Atenção: o seu repositório está público.';
  else if (res.mudancas) res.resumo = `${res.mudancas} ${res.mudancas === 1 ? 'mudança' : 'mudanças'} sem salvar no GitHub.`;
  else res.resumo = 'Tudo salvo no GitHub.';
  return res;
}

// Pronto pra salvar na nuvem?
function ligado(e = estado()) {
  return e.repositorio && !!e.remoto && !e.doModelo && e.visibilidade !== 'publico';
}

// ---------- salvar ----------

function traduzirErro(r) {
  const t = `${r.erro}\n${r.saida}`;
  if (/could not read Username|Authentication failed|terminal prompts disabled|403|Permission denied|denied to/i.test(t)) {
    return 'O GitHub pediu login. Abra o GitHub Desktop e entre na sua conta (ou peça pra IA: "salvar no github").';
  }
  if (/Repository not found|does not appear to be a git repository/i.test(t)) {
    return 'Não achei o seu repositório no GitHub. Peça pra IA: "salvar no github".';
  }
  if (/Could not resolve host|unable to access|Failed to connect|timed out/i.test(t)) {
    return 'Sem internet agora. As mudanças ficaram guardadas no computador; tente de novo depois.';
  }
  if (/large files|exceeds GitHub's file size limit|GH001/i.test(t)) {
    return 'Tem um arquivo grande demais pro GitHub (mais de 100 MB). Peça pra IA: "tirar arquivo grande do github".';
  }
  const ultima = t.trim().split('\n').filter(Boolean).pop() || 'erro desconhecido';
  return `Não consegui salvar: ${ultima}`;
}

function identidade() {
  const nome = rodar(['config', 'user.name']).saida;
  const email = rodar(['config', 'user.email']).saida;
  if (nome && email) return [];
  let dono = '';
  try {
    const { linhas } = md.ler(path.join(RAIZ, 'negocio', 'empresa.md'));
    const c = md.campoPorNome(linhas, 'seu nome');
    dono = c && c.preenchido ? c.valor : '';
  } catch { /* sem nome */ }
  const gh = donoRepo(rodar(['remote', 'get-url', 'origin']).saida);
  return ['-c', `user.name=${nome || dono || (gh && gh.dono) || 'Dono'}`, '-c', `user.email=${email || `${gh ? gh.dono : 'dono'}@users.noreply.github.com`}`];
}

const TRAVA = () => path.join(pastaGit(), 'keylab-salvar.lock');

async function salvar({ mensagem, interativo = false, auto = false } = {}) {
  const e = estado();
  if (!e.git) throw new ErroPainel('O Git não está instalado. Veja na Ajuda: "Como instalo o Git?".');
  if (!e.repositorio) throw new ErroPainel('Essa pasta ainda não está ligada ao GitHub. Peça pra IA: "salvar no github".');
  if (e.doModelo) throw new ErroPainel('Essa pasta ainda aponta pro modelo, não pro seu GitHub. Peça pra IA: "salvar no github".');
  if (e.remoto && e.github) {
    const vis = await verificarVisibilidade(e.remoto);
    if (vis === 'publico') {
      throw new ErroPainel('O seu repositório no GitHub está PÚBLICO: qualquer um veria o seu negócio. Deixe privado antes (no GitHub: Settings, depois Change visibility).');
    }
  }

  const trava = TRAVA();
  try {
    const st = fs.statSync(trava);
    if (Date.now() - st.mtimeMs < 3 * 60 * 1000) throw new ErroPainel('Já estou salvando. Espere um pouquinho.', 409);
  } catch (err) {
    if (err instanceof ErroPainel) throw err;
  }
  fs.writeFileSync(trava, String(Date.now()));

  try {
    const passos = [];
    if (e.mudancas) {
      const add = await rodarAsync(['add', '-A']);
      if (!add.ok) throw new ErroPainel(traduzirErro(add));
      const agora = new Date();
      const msg = mensagem || `${auto ? 'Salvo sozinho' : 'Salvo pelo painel'}: ${md.dataBR(agora)} ${md.horaBR(agora)}`;
      const commit = await rodarAsync([...identidade(), 'commit', '-m', msg]);
      if (!commit.ok && !/nothing to commit/i.test(commit.saida + commit.erro)) throw new ErroPainel(traduzirErro(commit));
      passos.push('guardado no computador');
    }
    if (!e.remoto) {
      return { ok: true, passos, aviso: 'Guardei no computador. Falta ligar no GitHub pra ter a cópia na nuvem.' };
    }
    let envio = await rodarAsync(['push', '-u', 'origin', 'HEAD'], { interativo });
    if (!envio.ok && /fetch first|non-fast-forward|rejected/i.test(envio.erro)) {
      const ramo = rodar(['rev-parse', '--abbrev-ref', 'HEAD']).saida || 'main';
      const puxar = await rodarAsync(['pull', '--rebase', '--autostash', 'origin', ramo], { interativo });
      if (!puxar.ok) {
        await rodarAsync(['rebase', '--abort']);
        throw new ErroPainel('O GitHub tem mudanças diferentes das suas. Peça pra IA: "resolver o salvar no github".');
      }
      envio = await rodarAsync(['push', '-u', 'origin', 'HEAD'], { interativo });
    }
    if (!envio.ok) throw new ErroPainel(traduzirErro(envio));
    passos.push('enviado pro GitHub');
    return { ok: true, passos };
  } finally {
    try { fs.unlinkSync(trava); } catch { /* já foi */ }
  }
}

function registrarSalvarSozinho(resultado) {
  if (!existe(pastaGit())) return;
  gravarJson(path.join(pastaGit(), 'keylab-ultimo-salvar.json'), { quando: Date.now(), ...resultado });
}

module.exports = { estado, ligado, salvar, verificarVisibilidade, registrarSalvarSozinho, donoRepo, limparUrl, MODELO };
