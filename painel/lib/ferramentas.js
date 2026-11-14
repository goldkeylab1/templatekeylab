// As pastas das ferramentas: arquivos/virais/<pasta>/ (cada vídeo baixado) e arquivos/transcricoes/<pasta>/ (cada áudio
// ou vídeo do computador transcrito). Aqui fica a ficha de cada vídeo (estudo.json e info.md, que a IA lê), o que a tela
// Ferramentas manda do navegador (as fotos das cenas e a transcrição), a lista e o envio do vídeo pra tela.
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { RAIZ } = require('./raiz');
const { ErroPainel } = require('./erro');

const GRUPOS = {
  virais: path.join(RAIZ, 'arquivos', 'virais'),
  transcricoes: path.join(RAIZ, 'arquivos', 'transcricoes'),
};
const PASTA_OK = /^[a-z0-9][a-z0-9-]{0,100}$/;
const FOTO_OK = /^(quadros\/\d{2,3}m\d{2}s|mosaico-\d{1,3})\.jpg$/;
const IMAGEM_OK = /^(capa\.(jpe?g|png|webp)|mosaico-\d{1,3}\.jpg|quadros\/\d{2,3}m\d{2}s\.jpg)$/i;

function dirDe(grupo, pasta) {
  if (!GRUPOS[grupo]) throw new ErroPainel('Grupo desconhecido.');
  if (!PASTA_OK.test(String(pasta || ''))) throw new ErroPainel('Pasta inválida.');
  return path.join(GRUPOS[grupo], pasta);
}

function lerJson(abs) {
  try { return JSON.parse(fs.readFileSync(abs, 'utf8')); } catch { return null; }
}

// ---------- os números escritos do jeito brasileiro ----------

const milhar = (n) => (n == null ? '' : Math.round(n).toLocaleString('pt-BR'));
const dataBr = (iso) => { if (!iso) return ''; const [a, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${a}`; };
function relogio(s) {
  if (!s && s !== 0) return '';
  const t = Math.round(s);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const ss = String(t % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

// ---------- a ficha de cada vídeo baixado ----------

function lerEstudo(pasta) {
  return lerJson(path.join(dirDe('virais', pasta), 'estudo.json'));
}

function mosaicosDe(dir) {
  try { return fs.readdirSync(dir).filter((f) => /^mosaico-\d+\.jpg$/.test(f)).sort((a, b) => parseInt(a.slice(8), 10) - parseInt(b.slice(8), 10)); } catch { return []; }
}

// O info.md é o que a IA lê primeiro: a ficha do post (no molde de marketing/virais/_molde.md) e o que tem na pasta
function infoMd(e, dir) {
  const linha = (nome, valor) => `- **${nome}:** ${valor === '' || valor == null ? 'o site não mostra' : valor}`;
  const razao = e.views != null && e.seguidores ? `${(e.views / e.seguidores).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}x` : '';
  const tela = e.largura && e.altura ? `${e.largura}x${e.altura}${e.vertical ? ' (vertical)' : ''}` : '';
  const existe = (f) => fs.existsSync(path.join(dir, f));
  const mosaicos = mosaicosDe(dir);
  const arquivos = [];
  if (e.arquivo) arquivos.push(`- \`${e.arquivo}\`: o ${e.tipo === 'audio' ? 'áudio' : 'vídeo'}`);
  if (e.capa) arquivos.push(`- \`${e.capa}\`: a capa do post`);
  if (mosaicos.length) {
    arquivos.push(`- \`mosaico-1.jpg\`${mosaicos.length > 1 ? ` a \`mosaico-${mosaicos.length}.jpg\`` : ''}: as fotos das cenas, 20 por imagem, em ordem (uma a cada ${e.intervalo || 2} s). Leia estas primeiro: mostram o visual e o ritmo de uma vez`);
    arquivos.push(`- \`quadros/\`: as mesmas ${e.quadros || ''} fotos, uma por arquivo, com o tempo no nome (\`00m04s.jpg\`), pra ver um detalhe`);
  } else if (e.fotos === 'pendente') {
    arquivos.push('- As fotos das cenas ainda não saíram: elas são feitas com o painel aberto em Ferramentas');
  }
  if (existe('transcricao.txt')) {
    arquivos.push('- `transcricao-com-tempos.txt`: tudo que é falado, com o segundo de cada frase');
    arquivos.push('- `transcricao.txt`: o mesmo texto, corrido');
    arquivos.push('- `legenda.srt`: a legenda');
  } else if (e.tipo !== 'audio' || e.arquivo) {
    arquivos.push('- A transcrição ainda não saiu: ela é feita com o painel aberto em Ferramentas');
  }
  const t = e.transcricao;
  return [
    `# ${e.titulo || 'Vídeo'}`,
    '',
    `> Baixado em ${dataBr(e.baixado)} pelo painel (Ferramentas → Baixar vídeo). Pra estudar, siga marketing/metodo/estudar-viral.md e salve o estudo em marketing/virais/${e.pasta}.md.`,
    '> Baixe pra estudar: postar o vídeo de outra pessoa como se fosse seu é cópia.',
    '',
    '## Ficha',
    '',
    linha('Link', e.link),
    linha('Perfil', e.perfil),
    linha('Rede', e.site),
    linha('Publicado em', dataBr(e.publicado)),
    linha('Views', milhar(e.views)),
    linha('Curtidas', milhar(e.curtidas)),
    linha('Comentários', milhar(e.comentarios)),
    linha('Seguidores do perfil', milhar(e.seguidores)),
    linha('Views divididas por seguidores', razao),
    linha('Duração', relogio(e.duracao)),
    linha('Tamanho da tela', tela),
    t ? linha('Palavras faladas', `${milhar(t.palavras)}${t.palavras_por_minuto ? ` (${t.palavras_por_minuto} por minuto)` : ''}`) : null,
    '',
    '## A legenda do post',
    '',
    e.legenda ? e.legenda.split('\n').map((l) => `> ${l}`).join('\n') : 'Sem legenda.',
    '',
    '## O que tem nesta pasta',
    '',
    ...arquivos,
    '',
  ].filter((l) => l !== null).join('\n');
}

function gravarEstudo(e) {
  const dir = dirDe('virais', e.pasta);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'estudo.json'), `${JSON.stringify(e, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'info.md'), infoMd(e, dir));
  return e;
}

// ---------- a lista ----------

function pastasDe(grupo) {
  try {
    return fs.readdirSync(GRUPOS[grupo], { withFileTypes: true }).filter((d) => d.isDirectory() && PASTA_OK.test(d.name)).map((d) => d.name);
  } catch { return []; }
}

function listarVirais() {
  const lista = [];
  for (const pasta of pastasDe('virais')) {
    const e = lerEstudo(pasta);
    if (!e) continue;
    const dir = dirDe('virais', pasta);
    lista.push({
      pasta, titulo: e.titulo, perfil: e.perfil, site: e.site, link: e.link, publicado: e.publicado,
      views: e.views, curtidas: e.curtidas, comentarios: e.comentarios, seguidores: e.seguidores,
      duracao: e.duracao, vertical: e.vertical, tipo: e.tipo, capa: e.capa,
      temArquivo: !!(e.arquivo && fs.existsSync(path.join(dir, e.arquivo))),
      fotos: e.fotos, quadros: e.quadros || 0, mosaicos: mosaicosDe(dir).length,
      transcricao: e.transcricao || null, transcrever: e.transcrever || null,
      estudado: fs.existsSync(path.join(RAIZ, 'marketing', 'virais', `${pasta}.md`)),
      baixado: e.baixado,
    });
  }
  return lista.sort((a, b) => String(b.baixado).localeCompare(String(a.baixado)));
}

function listarTranscricoes() {
  const lista = [];
  for (const pasta of pastasDe('transcricoes')) {
    const i = lerJson(path.join(dirDe('transcricoes', pasta), 'info.json'));
    if (i) lista.push({ pasta, ...i, estudado: fs.existsSync(path.join(RAIZ, 'saidas', 'estudos', `${pasta}.md`)) });
  }
  return lista.sort((a, b) => String(b.em).localeCompare(String(a.em)));
}

// ---------- as fotos das cenas (tiradas no navegador) ----------

function salvarFoto({ pasta, nome, dados, primeira }) {
  const dir = dirDe('virais', pasta);
  if (!fs.existsSync(path.join(dir, 'estudo.json'))) throw new ErroPainel('Esse vídeo não está mais na pasta.', 404);
  if (!FOTO_OK.test(String(nome || ''))) throw new ErroPainel('Nome de foto inválido.');
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(dados || ''));
  if (!m) throw new ErroPainel('Foto inválida.');
  if (primeira) {
    fs.rmSync(path.join(dir, 'quadros'), { recursive: true, force: true });
    for (const f of mosaicosDe(dir)) fs.rmSync(path.join(dir, f), { force: true });
  }
  const abs = path.join(dir, nome);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, Buffer.from(m[1], 'base64'));
  return { ok: true };
}

function fotosProntas({ pasta, quadros, intervalo, semImagem, erro }) {
  const e = lerEstudo(pasta);
  if (!e) throw new ErroPainel('Esse vídeo não está mais na pasta.', 404);
  if (semImagem) e.fotos = 'sem-imagem';
  else if (erro) { e.fotos = 'erro'; e.erroFotos = String(erro).slice(0, 300); }
  else { e.fotos = 'feitas'; e.quadros = Number(quadros) || 0; e.intervalo = Number(intervalo) || 2; delete e.erroFotos; }
  return { ok: true, estudo: gravarEstudo(e) };
}

// ---------- a transcrição (feita no navegador; aqui só grava) ----------

function paragrafos(segs) {
  const r = [];
  let atual = '';
  let fimAnterior = null;
  for (const s of segs) {
    const t = s.texto.trim();
    if (!t) continue;
    const pausa = fimAnterior !== null && s.ini - fimAnterior > 1.5;
    const grande = atual.length > 650 && /[.!?…]["”»)]?$/.test(atual);
    if (atual && (pausa || grande)) { r.push(atual); atual = ''; }
    atual = atual ? `${atual} ${t}` : t;
    fimAnterior = s.fim;
  }
  if (atual) r.push(atual);
  return r.join('\n\n');
}

function hora(seg, { horas = false, ms = false } = {}) {
  const t = Math.max(0, seg);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const dd = (n) => String(n).padStart(2, '0');
  return (horas || h ? `${dd(h)}:` : '') + `${dd(m)}:${dd(s)}` + (ms ? `,${String(Math.floor((t * 1000) % 1000)).padStart(3, '0')}` : '');
}

function srt(segs) {
  return segs.map((s, i) => `${i + 1}\n${hora(s.ini, { horas: true, ms: true })} --> ${hora(Math.max(s.fim, s.ini + 0.3), { horas: true, ms: true })}\n${s.texto.trim()}\n`).join('\n');
}

function escreverTextos(dir, segs) {
  const horas = segs.length && segs[segs.length - 1].fim >= 3600;
  fs.writeFileSync(path.join(dir, 'transcricao.txt'), `${paragrafos(segs)}\n`);
  fs.writeFileSync(path.join(dir, 'transcricao-com-tempos.txt'), `${segs.map((s) => `[${hora(s.ini, { horas })}] ${s.texto.trim()}`).join('\n')}\n`);
  fs.writeFileSync(path.join(dir, 'legenda.srt'), srt(segs));
  return segs.reduce((n, s) => n + s.texto.trim().split(/\s+/).filter(Boolean).length, 0);
}

function salvarTranscricao(d) {
  const segs = (Array.isArray(d.segmentos) ? d.segmentos : []).slice(0, 20000)
    .map((s) => ({ ini: Number(s.ini) || 0, fim: Number(s.fim) || 0, texto: String(s.texto || '').slice(0, 2000) }))
    .filter((s) => s.texto.trim());
  const modelo = String(d.modelo || '').slice(0, 80);
  const idioma = String(d.idioma || '').slice(0, 30);
  const em = new Date().toISOString();

  // Um vídeo baixado: o texto fica na pasta dele, e a ficha ganha o resumo
  if (d.pasta) {
    const e = lerEstudo(d.pasta);
    if (!e) throw new ErroPainel('Esse vídeo não está mais na pasta.', 404);
    const palavras = escreverTextos(dirDe('virais', d.pasta), segs);
    e.transcricao = { modelo, idioma, palavras, em, palavras_por_minuto: e.duracao ? Math.round(palavras / (e.duracao / 60)) : null };
    delete e.transcrever;
    gravarEstudo(e);
    return { ok: true, grupo: 'virais', pasta: d.pasta };
  }

  // Um arquivo do computador: o arquivo não vem pra cá (fica onde está); só o texto
  const nome = path.basename(String(d.nome || 'arquivo')).slice(0, 160);
  const { slug, hojeIso } = require('./baixador');
  const base = `${hojeIso()}-${slug(nome.replace(/\.[a-z0-9]{2,5}$/i, ''))}`;
  let pasta = base;
  for (let i = 2; fs.existsSync(dirDe('transcricoes', pasta)); i++) pasta = `${base}-${i}`;
  const dir = dirDe('transcricoes', pasta);
  fs.mkdirSync(dir, { recursive: true });
  const palavras = escreverTextos(dir, segs);
  const duracao = Number(d.duracao) || null;
  fs.writeFileSync(path.join(dir, 'info.json'), `${JSON.stringify({ nome, duracao, palavras, modelo, idioma, em }, null, 2)}\n`);
  return { ok: true, grupo: 'transcricoes', pasta };
}

// Volta a pôr a transcrição na fila (o "Transcrever de novo")
function transcreverDeNovo({ pasta }) {
  const e = lerEstudo(pasta);
  if (!e) throw new ErroPainel('Esse vídeo não está mais na pasta.', 404);
  e.transcrever = 'auto';
  delete e.transcricao;
  const dir = dirDe('virais', pasta);
  for (const f of ['transcricao.txt', 'transcricao-com-tempos.txt', 'legenda.srt']) fs.rmSync(path.join(dir, f), { force: true });
  gravarEstudo(e);
  return { ok: true };
}

function fotosDeNovo({ pasta }) {
  const e = lerEstudo(pasta);
  if (!e) throw new ErroPainel('Esse vídeo não está mais na pasta.', 404);
  e.fotos = 'pendente';
  delete e.erroFotos;
  gravarEstudo(e);
  return { ok: true };
}

function textos(grupo, pasta) {
  const dir = dirDe(grupo, pasta);
  const ler = (f) => { try { return fs.readFileSync(path.join(dir, f), 'utf8'); } catch { return ''; } };
  return { texto: ler('transcricao.txt'), tempos: ler('transcricao-com-tempos.txt'), mosaicos: grupo === 'virais' ? mosaicosDe(dir) : [] };
}

function apagar({ grupo, pasta }) {
  const dir = dirDe(grupo, pasta);
  if (!fs.existsSync(dir)) return { ok: true };
  fs.rmSync(dir, { recursive: true, force: true });
  return { ok: true };
}

function abrirPasta({ grupo, pasta }) {
  const dir = pasta ? dirDe(grupo, pasta) : GRUPOS[grupo];
  if (!dir) throw new ErroPainel('Grupo desconhecido.');
  fs.mkdirSync(dir, { recursive: true });
  const [cmd, args] = process.platform === 'darwin' ? ['open', [dir]] : process.platform === 'win32' ? ['explorer', [dir]] : ['xdg-open', [dir]];
  try {
    const p = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true });
    p.on('error', () => {});
    p.unref();
  } catch { /* sem gerenciador de arquivos */ }
  return { ok: true };
}

// ---------- o vídeo e as imagens pra tela ----------

const TIPOS = {
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.mkv': 'video/x-matroska',
  '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.aac': 'audio/aac', '.opus': 'audio/ogg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
};

// Manda o arquivo em pedaços quando o navegador pede (Range): é o que deixa o vídeo pular pro segundo certo
function enviarArquivo(req, res, abs) {
  let st;
  try { st = fs.statSync(abs); } catch { res.writeHead(404); res.end(); return; }
  const tipo = TIPOS[path.extname(abs).toLowerCase()] || 'application/octet-stream';
  const cab = { 'Content-Type': tipo, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ''));
  if (m && (m[1] || m[2])) {
    let ini = m[1] ? Number(m[1]) : st.size - Number(m[2]);
    let fim = m[1] && m[2] ? Number(m[2]) : st.size - 1;
    ini = Math.max(0, ini);
    fim = Math.min(fim, st.size - 1);
    if (ini > fim || ini >= st.size) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); res.end(); return; }
    res.writeHead(206, { ...cab, 'Content-Range': `bytes ${ini}-${fim}/${st.size}`, 'Content-Length': fim - ini + 1 });
    fs.createReadStream(abs, { start: ini, end: fim }).on('error', () => res.end()).pipe(res);
    return;
  }
  res.writeHead(200, { ...cab, 'Content-Length': st.size });
  fs.createReadStream(abs).on('error', () => res.end()).pipe(res);
}

function servirMidia(req, res, q) {
  const e = lerEstudo(q.get('pasta'));
  if (!e || !e.arquivo) { res.writeHead(404); res.end(); return; }
  enviarArquivo(req, res, path.join(dirDe('virais', q.get('pasta')), e.arquivo));
}

function servirImagem(req, res, q) {
  const f = String(q.get('f') || '');
  if (!IMAGEM_OK.test(f)) { res.writeHead(404); res.end(); return; }
  enviarArquivo(req, res, path.join(dirDe('virais', q.get('pasta')), f));
}

module.exports = {
  GRUPOS, gravarEstudo, lerEstudo, listarVirais, listarTranscricoes, salvarFoto, fotosProntas, salvarTranscricao,
  transcreverDeNovo, fotosDeNovo, textos, apagar, abrirPasta, servirMidia, servirImagem,
};
