// Baixa um vídeo (ou só o áudio) de um link pra arquivos/virais/<AAAA-MM-DD-nome>/, pra estudar: o vídeo, a capa e os
// números do post (views, curtidas, data, legenda). As fotos das cenas e a transcrição a tela Ferramentas faz depois,
// no navegador (lib/ferramentas.js grava o que ela manda).
//
// Quem baixa é o yt-dlp oficial (https://github.com/yt-dlp/yt-dlp, domínio público): na primeira vez, o painel baixa a
// versão certa pro computador do GitHub, pra .ferramentas/, e confere a soma SHA-256 que o próprio yt-dlp publica. A
// cada 3 dias ele se atualiza sozinho, porque os sites mudam toda semana. Nada passa por servidor nenhum além do site
// do vídeo e do GitHub.
//
// Sem nada instalado, vem a melhor qualidade que o site entrega num arquivo só (no Instagram e no TikTok, a normal; no
// YouTube, 360p). Se o computador tiver o ffmpeg, o yt-dlp usa ele e o YouTube vem em até 1080p.
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');
const { RAIZ } = require('./raiz');
const { ErroPainel } = require('./erro');

const FERR = path.join(RAIZ, '.ferramentas');
const VIRAIS = path.join(RAIZ, 'arquivos', 'virais');
const WIN = process.platform === 'win32';
const ASSET = process.platform === 'darwin' ? 'yt-dlp_macos'
  : WIN ? (process.arch === 'arm64' ? 'yt-dlp_arm64.exe' : process.arch === 'ia32' ? 'yt-dlp_x86.exe' : 'yt-dlp.exe')
    : process.arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux';
const YTDLP = process.env.YTDLP || path.join(FERR, WIN ? 'yt-dlp.exe' : 'yt-dlp');
// O YouTube pede um motor de JavaScript pra liberar as qualidades boas: o próprio Node serve, do 22 em diante
const NODE_OK = Number(process.versions.node.split('.')[0]) >= 22;

// ---------- o ffmpeg, se o computador tiver ----------

let ffmpegAchado;
function ffmpeg() {
  if (ffmpegAchado !== undefined) return ffmpegAchado;
  const nome = WIN ? 'ffmpeg.exe' : 'ffmpeg';
  const lugares = [process.env.FFMPEG, nome, '/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg'].filter(Boolean);
  ffmpegAchado = null;
  for (const l of lugares) {
    try {
      const r = spawnSync(l, ['-version'], { windowsHide: true, timeout: 5000 });
      if (r.status === 0) { ffmpegAchado = l; break; }
    } catch { /* não tem */ }
  }
  return ffmpegAchado;
}

// ---------- o yt-dlp ----------

function pedirUrl(url, { destino, aoProgresso, seguir = true } = {}, saltos = 0) {
  return new Promise((ok, falha) => {
    const req = https.get(url, { headers: { 'User-Agent': 'painel-do-negocio' }, timeout: 30000 }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        if (!seguir) return ok({ local: res.headers.location });
        if (saltos > 6) return falha(new Error('O GitHub redirecionou demais.'));
        return pedirUrl(new URL(res.headers.location, url).href, { destino, aoProgresso }, saltos + 1).then(ok, falha);
      }
      if (res.statusCode !== 200) { res.resume(); return falha(new Error(`O GitHub respondeu ${res.statusCode}.`)); }
      const total = Number(res.headers['content-length']) || 0;
      if (!destino) {
        const partes = [];
        res.on('data', (d) => partes.push(d));
        res.on('end', () => ok({ texto: Buffer.concat(partes).toString('utf8') }));
        res.on('error', falha);
        return;
      }
      const hash = crypto.createHash('sha256');
      const saida = fs.createWriteStream(destino);
      let n = 0;
      res.on('data', (d) => { hash.update(d); n += d.length; if (aoProgresso) aoProgresso(n, total); });
      res.on('error', falha);
      saida.on('error', falha);
      saida.on('finish', () => ok({ sha256: hash.digest('hex'), bytes: n }));
      res.pipe(saida);
    });
    req.on('timeout', () => req.destroy(new Error('A internet demorou demais pra responder.')));
    req.on('error', falha);
  });
}

let instalando = null;
const instalacao = { pct: 0, erro: null };

// Baixa o yt-dlp oficial na primeira vez (uns 25 a 40 MB), conferindo a soma da versão
function garantirYtdlp(aoProgresso) {
  if (process.env.YTDLP || fs.existsSync(YTDLP)) return Promise.resolve(YTDLP);
  if (instalando) return instalando;
  instalacao.pct = 0;
  instalacao.erro = null;
  instalando = (async () => {
    fs.mkdirSync(FERR, { recursive: true });
    const { local } = await pedirUrl('https://github.com/yt-dlp/yt-dlp/releases/latest', { seguir: false });
    const versao = (String(local || '').match(/\/tag\/([^/?#]+)/) || [])[1];
    if (!versao) throw new ErroPainel('Não achei a versão do baixador no GitHub. Confira a internet e tente de novo.');
    const base = `https://github.com/yt-dlp/yt-dlp/releases/download/${versao}/`;
    const { texto } = await pedirUrl(`${base}SHA2-256SUMS`);
    const linha = texto.split('\n').map((l) => l.trim().split(/\s+/)).find((p) => p[1] === ASSET);
    if (!linha) throw new ErroPainel(`O baixador não tem versão pra este computador (${process.platform}, ${process.arch}).`);
    const tmp = `${YTDLP}.baixando`;
    const { sha256 } = await pedirUrl(base + ASSET, {
      destino: tmp,
      aoProgresso: (n, total) => { instalacao.pct = total ? (n / total) * 100 : 0; if (aoProgresso) aoProgresso(n, total); },
    });
    if (sha256 !== linha[0]) {
      fs.rmSync(tmp, { force: true });
      throw new ErroPainel('O baixador veio diferente do oficial (a internet pode ter cortado). Tente de novo.');
    }
    fs.chmodSync(tmp, 0o755);
    fs.renameSync(tmp, YTDLP);
    fs.writeFileSync(path.join(FERR, 'yt-dlp-conferido.txt'), String(Date.now()));
    return YTDLP;
  })().catch((e) => { instalacao.erro = e.message; throw e; }).finally(() => { instalando = null; });
  return instalando;
}

function estado() {
  return {
    pronto: !!process.env.YTDLP || fs.existsSync(YTDLP),
    instalando: !!instalando,
    pct: Math.round(instalacao.pct),
    erro: instalacao.erro,
    ffmpeg: !!ffmpeg(),
    node: process.versions.node,
    nodeOk: NODE_OK,
  };
}

// Começa a instalar o baixador em segundo plano (a tela chama quando abre, pra não esperar no primeiro download)
function preparar() {
  if (!estado().pronto && !instalando) garantirYtdlp().catch(() => { /* o erro fica no estado */ });
  return estado();
}

// A cada 3 dias, com a fila vazia, o yt-dlp se atualiza (-U): nunca troca o programa no meio de um download
function atualizarSePrecisar() {
  if (process.env.YTDLP || !fs.existsSync(YTDLP) || rodando || fila.length) return;
  const marca = path.join(FERR, 'yt-dlp-conferido.txt');
  let quando = 0;
  try { quando = Number(fs.readFileSync(marca, 'utf8')) || 0; } catch { /* nunca conferiu */ }
  if (Date.now() - quando < 3 * 864e5) return;
  fs.writeFileSync(marca, String(Date.now()));
  try { spawn(YTDLP, ['-U'], { stdio: 'ignore', windowsHide: true }).on('error', () => {}); } catch { /* fica pra próxima */ }
}

function argsBase() {
  const a = ['--no-warnings', '--no-color', '--no-playlist', '--playlist-items', '1', '--socket-timeout', '20'];
  const ff = ffmpeg();
  if (ff && path.isAbsolute(ff)) a.push('--ffmpeg-location', ff);
  if (NODE_OK) a.push('--no-js-runtimes', '--js-runtimes', `node:${process.execPath}`);
  return a;
}

// Roda um programa e junta a saída (aoLer recebe linha por linha, pra mostrar o progresso)
function rodar(programa, args, { aoLer, tempo = 0, tarefa } = {}) {
  return new Promise((ok) => {
    let p;
    try { p = spawn(programa, args, { windowsHide: true }); } catch (e) { return ok({ codigo: -1, saida: '', erro: String(e.message) }); }
    if (tarefa) tarefa.proc = p;
    let saida = '';
    let erro = '';
    let resto = '';
    const relogio = tempo ? setTimeout(() => { erro += '\nERROR: timed out'; p.kill(); }, tempo) : null;
    const linhas = (texto) => {
      if (!aoLer) return;
      resto += texto;
      const ls = resto.split(/\r?\n|\r/);
      resto = ls.pop();
      for (const l of ls) if (l.trim()) aoLer(l);
    };
    // sem aoLer, a saída é o JSON do vídeo e vem inteira; com aoLer, é o progresso e só o fim importa
    p.stdout.on('data', (d) => { const t = d.toString('utf8'); if (!aoLer) saida += t; else { saida = (saida + t).slice(-20000); linhas(t); } });
    p.stderr.on('data', (d) => { const t = d.toString('utf8'); erro = (erro + t).slice(-20000); linhas(t); });
    p.on('error', (e) => { erro += `\nERROR: ${e.message}`; });
    p.on('close', (codigo) => { if (relogio) clearTimeout(relogio); if (tarefa) tarefa.proc = null; ok({ codigo, saida, erro }); });
  });
}

// O Instagram (e às vezes o TikTok e o Facebook) recusa por uns minutos quem busca vários vídeos seguidos sem login,
// com um erro que não diz isso. Por isso o download tenta de novo sozinho, e a mensagem explica o que é.
const SITES_QUE_RECUSAM = /instagram\.com|instagr\.am|tiktok\.com|facebook\.com|fb\.watch|kwai/i;
const PERMANENTE = /private|unsupported url|no suitable extractor|has been removed|no longer available|does not exist|http error 404|drm|age.?restrict|members-only/i;
const RECUSOU = 'O site não liberou esse vídeo agora (o Instagram faz isso por alguns minutos quando a gente baixa vários vídeos seguidos). O painel já tentou 3 vezes: espere 2 ou 3 minutos e tente de novo. Se continuar, abra o link no navegador sem estar logado: se ele pedir login pra mostrar o vídeo, o vídeo não é público.';

function tentarDeNovo(link, r) {
  return r.codigo !== 0 && SITES_QUE_RECUSAM.test(link) && !PERMANENTE.test(r.erro || '');
}

async function comNovasTentativas(link, fazer, aoTentar = () => {}, parar = () => false) {
  let r = await fazer();
  for (const espera of [4000, 10000]) {
    if (parar() || !tentarDeNovo(link, r)) break;
    aoTentar(espera);
    await new Promise((ok) => setTimeout(ok, espera));
    if (parar()) break;
    r = await fazer();
  }
  return r;
}

function traduzir(saida, link = '') {
  if (SITES_QUE_RECUSAM.test(link) && !PERMANENTE.test(saida) && /rate.?limit|login|logged.?in|locked behind|empty media|unable to extract|unable to download|429|too many requests|not available|general metadata/i.test(saida)) {
    return new ErroPainel(RECUSOU);
  }
  const erros = saida.split('\n').filter((l) => l.startsWith('ERROR'));
  const b = (erros.length ? erros[erros.length - 1] : saida.slice(-400)).toLowerCase();
  const casos = [
    [['unsupported url', 'no suitable extractor'], 'Esse site não é aceito. Funciona com Instagram, TikTok, YouTube, X, Facebook, Pinterest e centenas de outros.'],
    [['confirm you', 'not a bot'], 'O YouTube pediu pra confirmar que não é um robô. Espere uns minutos e tente de novo.'],
    [['confirm your age', 'age-restricted', 'age restricted', 'inappropriate for some users'], 'Esse vídeo tem restrição de idade e só abre com login. Não dá pra baixar por aqui.'],
    [['private video', 'video is private', 'this account is private'], 'Esse vídeo é privado. Só dá pra baixar vídeo público.'],
    [['members-only', 'join this channel', 'premium'], 'Esse vídeo é só pra membros ou assinantes. Só dá pra baixar vídeo público.'],
    [['live event will begin', 'premieres in', 'is live', 'live stream'], 'É uma transmissão ao vivo. Espere ela terminar e tente de novo.'],
    [['login required', 'log in', 'login', 'cookies', 'rate-limit reached'], 'O site pediu login pra mostrar esse vídeo. Se ele for público, espere uns minutos e tente de novo.'],
    [['drm'], 'Esse vídeo é protegido contra cópia. Não dá pra baixar.'],
    [['requested format is not available', 'format is not available'], 'Esse vídeo não tem um arquivo pronto pra baixar sem o ffmpeg. Peça pra sua IA: "instala o ffmpeg neste computador".'],
    [['not available in your country', 'geo restrict', 'not available from your location'], 'Esse vídeo é bloqueado no seu país.'],
    [['http error 404', 'not found', 'does not exist', 'no video'], 'Não achei vídeo nesse link. Confira se ele abre no navegador.'],
    [['video unavailable', 'unavailable', 'has been removed', 'no longer available'], 'Esse vídeo não está disponível: pode ter sido apagado ou estar privado.'],
    [['timed out', 'timeout', 'connection reset', 'temporary failure', 'getaddrinfo', 'network'], 'A internet ou o site demoraram demais. Confira a internet e tente de novo.'],
  ];
  for (const [chaves, msg] of casos) if (chaves.some((c) => b.includes(c))) return new ErroPainel(msg);
  if (SITES_QUE_RECUSAM.test(link)) return new ErroPainel(RECUSOU);
  return new ErroPainel('Não consegui pegar esse vídeo. Confira se o link abre no navegador e se o vídeo é público.');
}

// Aceita o link colado com texto em volta, como vem do "compartilhar" do celular
function limparLink(texto) {
  const m = String(texto || '').match(/https?:\/\/[^\s<>"']+/);
  if (!m) throw new ErroPainel('Cole o link do vídeo, começando com https://');
  return m[0].replace(/[.,;:!?)\]}]+$/, '');
}

// ---------- a pasta de cada vídeo ----------

const SITES = { Youtube: 'YouTube', YoutubeTab: 'YouTube', Instagram: 'Instagram', TikTok: 'TikTok', Twitter: 'X (Twitter)',
  Facebook: 'Facebook', FacebookReel: 'Facebook', Vimeo: 'Vimeo', Reddit: 'Reddit', TwitchVod: 'Twitch', TwitchClips: 'Twitch',
  Pinterest: 'Pinterest', Kwai: 'Kwai', Dailymotion: 'Dailymotion', Soundcloud: 'SoundCloud', Generic: 'Site' };

function slug(t, max = 50) {
  return String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/, '') || 'video';
}

function hojeIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const ATIVOS = ['fila', 'baixando', 'juntando'];
const TAREFAS = new Map();
const fila = [];
let rodando = null;

function pastaLivre(base) {
  let id = base;
  for (let i = 2; fs.existsSync(path.join(VIRAIS, id)) || [...TAREFAS.values()].some((t) => t.id === id && ATIVOS.includes(t.estado)); i++) id = `${base}-${i}`;
  return id;
}

// O Instagram chama todo post de "Video by fulano": o título bom é a 1ª linha da legenda
function tituloDe(info) {
  let t = String(info.title || '').trim();
  const desc = String(info.description || '').trim();
  if (desc && (!t || /^(Video|Vídeo) (by|de) /i.test(t))) t = desc.split('\n')[0];
  t = t.replace(/\s+/g, ' ');
  return t.length > 140 ? `${t.slice(0, 140)}…` : t || 'Vídeo';
}

// ---------- os downloads (um por vez) ----------

function baixar({ link, tipo = 'video' }) {
  const url = limparLink(link);
  if (!['video', 'audio'].includes(tipo)) throw new ErroPainel('Escolha vídeo ou só o áudio.');
  const ja = [...TAREFAS.values()].find((t) => t.link === url && ATIVOS.includes(t.estado));
  if (ja) return publico(ja);
  const t = {
    id: crypto.randomBytes(6).toString('hex'), link: url, tipo, pasta: null, titulo: '',
    estado: 'fila', etapa: 'Na fila', pct: 0, baixado: null, total: null, velocidade: null, falta: null,
    erro: null, aviso: null, partes: {}, proc: null, cancelada: false, criado: Date.now(),
  };
  TAREFAS.set(t.id, t);
  fila.push(t);
  processar();
  return publico(t);
}

const publico = (t) => ({
  id: t.id, link: t.link, tipo: t.tipo, pasta: t.pasta, titulo: t.titulo, estado: t.estado, etapa: t.etapa,
  pct: Math.round(t.pct * 10) / 10, baixado: t.baixado, total: t.total, velocidade: t.velocidade, falta: t.falta,
  erro: t.erro, aviso: t.aviso,
});

function tarefa(id) { const t = TAREFAS.get(String(id)); return t ? publico(t) : null; }
function tarefas() { return [...TAREFAS.values()].sort((a, b) => a.criado - b.criado).map(publico); }

function cancelar(id) {
  const t = TAREFAS.get(String(id));
  if (!t) return { ok: true };
  t.cancelada = true;
  const i = fila.indexOf(t);
  if (i >= 0) fila.splice(i, 1);
  if (t.proc) { try { t.proc.kill(); } catch { /* já tinha parado */ } }
  TAREFAS.delete(t.id);
  if (t.pasta) setTimeout(() => fs.rmSync(path.join(VIRAIS, t.pasta), { recursive: true, force: true }), 800);
  return { ok: true };
}

async function processar() {
  if (rodando) return;
  while (fila.length) {
    const t = fila.shift();
    rodando = t;
    try {
      await executar(t);
      if (!t.cancelada) {
        t.estado = 'pronto'; t.etapa = 'Pronto'; t.pct = 100;
        setTimeout(() => TAREFAS.delete(t.id), 2 * 60000);
      }
    } catch (e) {
      if (!t.cancelada) {
        t.estado = 'erro'; t.etapa = '';
        t.erro = e instanceof ErroPainel ? e.message : `Deu um erro: ${e.message}`;
        if (t.pasta) fs.rmSync(path.join(VIRAIS, t.pasta), { recursive: true, force: true });
        t.pasta = null;
        setTimeout(() => TAREFAS.delete(t.id), 10 * 60000);
      }
    } finally {
      rodando = null;
    }
  }
  atualizarSePrecisar();
}

const num = (x) => { const n = Number(x); return Number.isFinite(n) ? n : null; };
const PROGRESSO = /^@@ (\S+) (\S+) (\S+) (\S+) (\S+) (\S+) (\S+)/;

async function executar(t) {
  t.estado = 'baixando'; t.etapa = 'Preparando o baixador';
  const bin = await garantirYtdlp((n, total) => { t.etapa = 'Instalando o baixador (só na primeira vez)'; t.pct = total ? (n / total) * 100 : 0; });
  if (t.cancelada) return;

  // 1. O que tem no link (o título, o perfil e os números), pra dar nome à pasta
  t.etapa = 'Procurando o vídeo'; t.pct = 0;
  const busca = await comNovasTentativas(t.link, () => rodar(bin, [...argsBase(), '-J', '--', t.link], { tempo: 120000, tarefa: t }),
    (espera) => { t.etapa = `O site não respondeu: tentando de novo em ${Math.round(espera / 1000)} s`; }, () => t.cancelada);
  if (t.cancelada) return;
  if (busca.codigo !== 0 || !busca.saida.trim()) throw traduzir(busca.erro, t.link);
  let info;
  try { info = JSON.parse(busca.saida); } catch { throw new ErroPainel('O site respondeu de um jeito estranho. Tente de novo.'); }
  if (info._type === 'playlist') {
    const entradas = (info.entries || []).filter(Boolean);
    if (!entradas.length) throw new ErroPainel('Esse link é de uma lista ou de um perfil. Cole o link de um vídeo só.');
    info = entradas[0];
  }
  if (info.is_live || ['is_live', 'is_upcoming'].includes(info.live_status)) throw new ErroPainel('É uma transmissão ao vivo. Espere ela terminar e tente de novo.');

  const site = SITES[info.extractor_key] || info.extractor_key || 'Site';
  const perfil = info.channel || info.uploader_id || info.uploader || '';
  t.titulo = tituloDe(info);
  t.pasta = pastaLivre(`${hojeIso()}-${slug(`${perfil} ${t.titulo}`)}`);
  const dir = path.join(VIRAIS, t.pasta);
  fs.mkdirSync(dir, { recursive: true });

  // 2. O download
  t.etapa = 'Baixando';
  const ff = !!ffmpeg();
  const base = t.tipo === 'video' ? 'video' : 'audio';
  const molde = '@@ %(progress.status)s %(progress.downloaded_bytes)s %(progress.total_bytes)s %(progress.total_bytes_estimate)s %(progress.speed)s %(progress.eta)s %(info.format_id)s';
  const args = [...argsBase(), '--newline', '--progress', '--progress-template', `download:${molde}`, '--concurrent-fragments', '4',
    '--no-mtime', '--no-part', '-o', path.join(dir, `${base}.%(ext)s`),
    '--write-thumbnail', '-o', `thumbnail:${path.join(dir, 'capa.%(ext)s')}`];
  if (ff) args.push('--convert-thumbnails', 'jpg');
  if (t.tipo === 'video') {
    args.push('-S', 'res:1080,vcodec:h264,acodec:aac');
    if (ff) args.push('-f', 'bv*+ba/b', '--merge-output-format', 'mp4');
    else args.push('-f', 'b');
  } else {
    args.push('-f', 'ba[acodec^=mp4a]/ba/b');
    if (ff) args.push('-x', '--audio-format', 'm4a');
  }
  args.push('--', info.webpage_url || t.link);
  const r = await comNovasTentativas(t.link, () => rodar(bin, args, {
    tarefa: t,
    aoLer: (linha) => {
      const m = PROGRESSO.exec(linha);
      if (m) {
        const [, , feito, total, estimado, vel, falta, fid] = m;
        t.partes[fid] = [num(feito) || 0, num(total) || num(estimado) || 0];
        const somaFeito = Object.values(t.partes).reduce((s, p) => s + p[0], 0);
        const somaTotal = Object.values(t.partes).reduce((s, p) => s + p[1], 0);
        t.baixado = Math.round(somaFeito);
        t.total = somaTotal ? Math.round(somaTotal) : null;
        t.velocidade = num(vel);
        t.falta = num(falta);
        if (somaTotal) t.pct = Math.min(99, (somaFeito / somaTotal) * 100);
      } else if (/^\[(Merger|VideoRemuxer|FixupM3u8|FixupM4a|ExtractAudio)\]/.test(linha)) {
        t.estado = 'juntando'; t.etapa = 'Arrumando o arquivo';
      }
    },
  }), (espera) => { t.etapa = `O site não respondeu: tentando de novo em ${Math.round(espera / 1000)} s`; t.pct = 0; }, () => t.cancelada);
  if (t.cancelada) return;
  if (r.codigo !== 0) throw traduzir(r.erro, t.link);

  const prontos = fs.readdirSync(dir).filter((f) => f.startsWith(`${base}.`) && !/\.(part|ytdl|temp|tmp)$|\.f[\w-]+\.\w+$/.test(f));
  if (!prontos.length) throw new ErroPainel('O site entregou um arquivo vazio. Tente de novo.');
  const arquivo = prontos.sort((a, b) => fs.statSync(path.join(dir, b)).size - fs.statSync(path.join(dir, a)).size)[0];
  const capa = fs.readdirSync(dir).find((f) => /^capa\.(jpe?g|png|webp)$/i.test(f)) || null;

  if (site === 'YouTube' && t.tipo === 'video' && !ff) {
    t.aviso = 'Sem o ffmpeg, o YouTube só deixa baixar em 360p. Pra qualidade boa, peça pra sua IA: "instala o ffmpeg neste computador".';
  }

  const altura = info.height || null;
  const largura = info.width || null;
  const comImagem = t.tipo === 'video';
  require('./ferramentas').gravarEstudo({
    pasta: t.pasta,
    titulo: t.titulo,
    perfil,
    site,
    link: info.webpage_url || t.link,
    publicado: info.upload_date ? `${info.upload_date.slice(0, 4)}-${info.upload_date.slice(4, 6)}-${info.upload_date.slice(6, 8)}` : null,
    views: info.view_count ?? null,
    curtidas: info.like_count ?? null,
    comentarios: info.comment_count ?? null,
    seguidores: info.channel_follower_count ?? null,
    duracao: info.duration || null,
    largura,
    altura,
    vertical: largura && altura ? altura > largura : null,
    legenda: String(info.description || '').slice(0, 5000),
    tipo: t.tipo,
    arquivo,
    capa,
    baixado: new Date().toISOString(),
    fotos: comImagem ? 'pendente' : 'sem-imagem',
    transcrever: 'auto',
  });
}

module.exports = { VIRAIS, estado, preparar, baixar, tarefa, tarefas, cancelar, limparLink, slug, hojeIso };
