// Mentalidade (mentalidade/): o sonho do dono, a frase do dia, os princípios, as crenças e o diário.
// O sonho aparece de leve no painel todo (no menu, no Kanban), pra ele sempre lembrar pra onde está indo.
'use strict';

const fs = require('fs');
const path = require('path');
const md = require('./md');
const { RAIZ, existe } = require('./raiz');
const { ErroPainel, MUDOU } = require('./erro');

const PASTA = path.join(RAIZ, 'mentalidade');
const PASTA_QUADRO = path.join(PASTA, 'quadro');
const arq = (nome) => path.join(PASTA, nome);
const IMAGENS = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
// Seções do sonho que não são uma área da vida (não viram cena no quadro dos sonhos)
const NAO_SAO_AREAS = ['o meu sonho numa frase', 'o meu porque', 'quando e o proximo passo'];

function linhasDe(nome) {
  const abs = arq(nome);
  if (!existe(abs)) return null;
  try { return md.ler(abs).linhas; } catch { return null; }
}

// Um número por dia (o mesmo o dia inteiro), pra escolher a frase e as crenças do dia
function numeroDoDia(d = new Date()) {
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
}

function limpar(t) {
  return String(t || '').replace(/\*\*|__|`/g, '').trim();
}

// ---------- as frases (mentalidade/frases.md) ----------
// Cada "## Tema" tem uma frase por item. "## As minhas" são as do dono.

function lerFrases() {
  const linhas = linhasDe('frases.md');
  if (!linhas) return null;
  const at = md.ativas(linhas);
  const temas = [];
  const minhas = [];
  let tema = null;
  for (let i = 0; i < linhas.length; i++) {
    if (!at[i]) continue;
    const t = md.titulo(linhas[i]);
    if (t) {
      if (t.nivel === 2) { tema = { titulo: t.texto, minha: md.chave(t.texto).startsWith('as minhas'), frases: [] }; temas.push(tema); }
      continue;
    }
    const m = /^\s*[-*+]\s+(.*)$/.exec(linhas[i]);
    if (!m || !tema) continue;
    const texto = limpar(m[1]);
    if (!texto || /^\[.*\]$/.test(texto)) continue;
    (tema.minha ? minhas : tema.frases).push({ id: linhas[i].trim(), texto });
  }
  return { temas: temas.filter((x) => !x.minha && x.frases.length).map(({ titulo, frases }) => ({ titulo, frases })), minhas };
}

// Uma frase por dia. As do dono aparecem em dia sim, dia não.
function fraseDoDia(d = new Date()) {
  const f = lerFrases();
  if (!f) return null;
  const pack = f.temas.flatMap((t) => t.frases.map((x) => x.texto));
  const minhas = f.minhas.map((x) => x.texto);
  if (!pack.length && !minhas.length) return null;
  const n = numeroDoDia(d);
  if (minhas.length && (n % 2 === 0 || !pack.length)) {
    return { texto: minhas[(pack.length ? Math.floor(n / 2) : n) % minhas.length], minha: true, arquivo: 'mentalidade/frases.md' };
  }
  return { texto: pack[n % pack.length], minha: false, arquivo: 'mentalidade/frases.md' };
}

function paginaDasFrases() {
  const f = lerFrases();
  if (!f) return null;
  const total = f.minhas.length + f.temas.reduce((n, t) => n + t.frases.length, 0);
  return { arquivo: 'mentalidade/frases.md', temas: f.temas, minhas: f.minhas, total, hoje: fraseDoDia() };
}

function textoDaFrase(t) {
  let x = md.limparValor(t).replace(/^[-*+]\s+/, '').replace(/[“”"]/g, "'").trim();
  if (/^'.*'$/.test(x) && x.length > 1) x = x.slice(1, -1).trim();
  if (x && !/[.!?…]$/.test(x)) x += '.';
  return x.slice(0, 220);
}

function agirFrases(dados = {}) {
  const abs = arq('frases.md');
  if (!existe(abs)) throw new ErroPainel('A pasta mentalidade/ não tem o frases.md.', 404);
  const { linhas, eol } = md.ler(abs);
  switch (dados.acao) {
    case 'adicionar': {
      const texto = textoDaFrase(dados.texto);
      if (!texto) throw new ErroPainel('Escreva a sua frase.');
      const f = lerFrases();
      const todas = [...f.minhas, ...f.temas.flatMap((t) => t.frases)];
      if (todas.some((x) => md.chave(x.texto) === md.chave(texto))) throw new ErroPainel('Essa frase já está na lista.');
      md.inserirNaSecao(linhas, 'As minhas', [`- ${texto}`], { topo: true });
      break;
    }
    case 'apagar': {
      const at = md.ativas(linhas);
      let secao = '';
      const i = linhas.findIndex((l, n) => {
        if (!at[n]) return false;
        const t = md.titulo(l);
        if (t && t.nivel === 2) secao = md.chave(t.texto);
        return secao.startsWith('as minhas') && l.trim() === String(dados.id || '').trim();
      });
      if (i < 0) throw new ErroPainel(MUDOU, 409);
      linhas.splice(i, 1);
      break;
    }
    default:
      throw new ErroPainel('Ação desconhecida.');
  }
  md.gravar(abs, linhas, eol);
  return paginaDasFrases();
}

// O sonho (mentalidade/meus-sonhos.md), pelo começo de cada pergunta
function lerSonho() {
  const linhas = linhasDe('meus-sonhos.md');
  if (!linhas) return null;
  const campos = md.campos(linhas);
  const v = (comeco) => {
    const k = md.chave(comeco);
    const c = campos.find((x) => md.chave(x.nome).startsWith(k));
    return c && c.preenchido ? limpar(c.valor) : '';
  };
  const obrig = campos.filter((c) => !c.opcional);
  const respondidas = campos.filter((c) => c.preenchido).length;
  const sonho = {
    frase: v('o meu sonho numa frase'),
    saude: v('como e o meu corpo'),
    cuido: v('como eu cuido de mim'),
    familia: v('como e a minha familia'),
    momentos: v('como sao os meus momentos'),
    tenho: v('o que eu tenho'),
    ganho: v('quanto eu ganho'),
    trabalho: v('o que eu faco no meu trabalho'),
    ajudo: v('quem eu ajudo'),
    bem: v('como o meu trabalho'),
    casa: v('onde eu moro'),
    viagens: v('os lugares que eu conheco'),
    sou: v('como eu sou'),
    dia: v('como e o meu dia perfeito'),
    porque: v('por que esse sonho'),
    sinto: v('como eu me sinto vivendo'),
    quando: v('quando isso tudo'),
    passo: v('uma coisa pequena'),
    arquivo: 'mentalidade/meus-sonhos.md',
    respondidas,
    total: campos.length,
    pct: obrig.length ? Math.round((obrig.filter((c) => c.preenchido).length / obrig.length) * 100) : 0,
  };
  // Sem a frase curta: usa o começo do que ele já escreveu
  sonho.curto = sonho.frase || [sonho.dia, sonho.tenho, sonho.casa, sonho.familia].find(Boolean) || '';
  if (sonho.curto.length > 140) sonho.curto = `${sonho.curto.slice(0, 137).replace(/\s+\S*$/, '')}...`;
  return sonho;
}

// As perguntas do sonho, por área (pra escrever direto na tela da Mentalidade)
function areasDoSonho() {
  const linhas = linhasDe('meus-sonhos.md');
  if (!linhas) return [];
  const areas = [];
  for (const c of md.campos(linhas)) {
    let a = areas.find((x) => x.titulo === c.secao);
    if (!a) { a = { titulo: c.secao, campos: [] }; areas.push(a); }
    a.campos.push({ rotulo: c.rotulo, nome: c.nome, valor: c.valor, opcional: c.opcional, preenchido: c.preenchido, secao: c.secao });
  }
  return areas;
}

// As áreas da vida (saúde, família, dinheiro...), cada uma com o que o dono já escreveu.
// Uma área está descrita quando tem pelo menos uma resposta (sem contar as opcionais).
function vidaPorArea(areas) {
  return areas
    .filter((a) => !NAO_SAO_AREAS.includes(md.chave(a.titulo)))
    .map((a) => {
      const obrig = a.campos.filter((c) => !c.opcional);
      const textos = (obrig.length ? obrig : a.campos).filter((c) => c.preenchido).map((c) => limpar(c.valor)).filter(Boolean);
      return { titulo: a.titulo, feita: textos.length > 0, textos };
    });
}

// O prompt pra uma IA de imagem gerar o quadro dos sonhos. Só sai com todas as áreas da vida descritas.
const EXTRA_DA_AREA = {
  'quem eu me torno': 'Mostre isso no jeito, na expressão e na postura da pessoa principal.',
  'o meu dia perfeito': 'Esta pode ser a cena do centro, um pouco maior.',
};

function promptDoQuadro(sonho, vida) {
  const corta = (t) => {
    const x = String(t).trim().replace(/[.!;,\s]+$/, '');
    return x.length > 400 ? `${x.slice(0, 397).replace(/\s+\S*$/, '')}...` : x;
  };
  const linhas = [
    'Crie uma imagem de quadro dos sonhos (vision board) que mostre o meu estilo de vida dos sonhos, como se ele já fosse real.',
    '',
    'Formato:',
    '- Horizontal, na proporção 16:9 (por exemplo, 1920 x 1080 pixels).',
    `- Uma colagem bonita e harmoniosa, com ${vida.length} cenas (uma pra cada área da minha vida), bem integradas, sem bordas duras entre elas.`,
    '- Fotografia realista, com luz natural dourada, cores quentes e vivas, e um clima de alegria, gratidão e paz.',
    '- A mesma pessoa principal (eu) aparece nas cenas, feliz e à vontade.',
    '- Sem nenhum texto, letra, número ou logotipo na imagem.',
  ];
  if (sonho.frase) linhas.push('', `A minha vida dos sonhos, numa frase: "${corta(sonho.frase)}".`);
  linhas.push('', 'As cenas (escritas por mim, como se já fossem reais):');
  vida.forEach((a, i) => {
    const extra = EXTRA_DA_AREA[md.chave(a.titulo)];
    linhas.push(`${i + 1}. ${a.titulo}: ${a.textos.map(corta).join('. ')}.${extra ? ` ${extra}` : ''}`);
  });
  if (sonho.sinto) linhas.push('', `O sentimento da imagem: ${corta(sonho.sinto)}.`);
  linhas.push('', 'Se eu anexar uma foto minha, use o meu rosto como referência para a pessoa principal.');
  return linhas.join('\n');
}

function quadroPrompt(sonho, areas) {
  const vida = vidaPorArea(areas);
  const feitas = vida.filter((a) => a.feita).length;
  const liberado = vida.length > 0 && feitas === vida.length;
  return {
    vida: vida.map((a) => ({ titulo: a.titulo, feita: a.feita })),
    feitas,
    total: vida.length,
    liberado,
    texto: liberado && sonho ? promptDoQuadro(sonho, vida) : '',
  };
}

// "**Pra que serve:**", "**Por que usar:**" e "**Como usar:**" de cada arquivo da Mentalidade
function explicacoes() {
  const ordem = ['principios.md', 'crencas.md', 'meus-sonhos.md', 'frases.md', 'pratica-diaria.md', 'diario.md'];
  return ordem.map((nome) => {
    const linhas = linhasDe(nome);
    if (!linhas) return null;
    const achar = (rotulo) => {
      const k = md.chave(rotulo);
      const l = linhas.find((x) => md.chave(x).startsWith(k));
      return l ? limpar(l).replace(/^[^:]+:\s*/, '') : '';
    };
    return {
      caminho: `mentalidade/${nome}`,
      titulo: md.tituloDoArquivo(linhas, nome),
      serve: achar('pra que serve'),
      porque: achar('por que usar'),
      como: achar('como usar'),
    };
  }).filter(Boolean);
}

// ---------- o quadro dos sonhos (mentalidade/quadro/) ----------

function lerQuadro() {
  let nomes = [];
  try { nomes = fs.readdirSync(PASTA_QUADRO); } catch { return []; }
  return nomes
    .filter((n) => IMAGENS[path.extname(n).toLowerCase()] && !n.startsWith('.'))
    .map((n) => {
      let t = 0;
      try { t = fs.statSync(path.join(PASTA_QUADRO, n)).mtimeMs; } catch { /* sumiu */ }
      return { nome: n, url: `/api/mentalidade/imagem?nome=${encodeURIComponent(n)}&v=${Math.round(t)}`, quando: t };
    })
    .sort((a, b) => a.quando - b.quando);
}

function nomeSeguro(nome) {
  const n = path.basename(String(nome || ''));
  if (!n || n.startsWith('.') || !IMAGENS[path.extname(n).toLowerCase()]) return null;
  return n;
}

function agirQuadro(dados = {}) {
  if (!existe(PASTA)) throw new ErroPainel('A pasta mentalidade/ não existe.', 404);
  if (dados.acao === 'apagar') {
    const n = nomeSeguro(dados.nome);
    const abs = n && path.join(PASTA_QUADRO, n);
    if (!abs || !existe(abs)) throw new ErroPainel(MUDOU, 409);
    fs.unlinkSync(abs);
    return { quadro: lerQuadro() };
  }
  const m = /^data:(image\/(png|jpeg|webp|gif));base64,(.+)$/.exec(String(dados.dados || ''));
  if (!m) throw new ErroPainel('Use uma imagem PNG, JPG, WEBP ou GIF.');
  const buf = Buffer.from(m[3], 'base64');
  if (buf.length > 6 * 1024 * 1024) throw new ErroPainel('Imagem grande demais. Use uma de até 6 MB.');
  const ext = { png: '.png', jpeg: '.jpg', webp: '.webp', gif: '.gif' }[m[2]];
  const d = new Date();
  const dois = (x) => String(x).padStart(2, '0');
  const nome = `${md.hojeISO(d)}-${dois(d.getHours())}${dois(d.getMinutes())}${dois(d.getSeconds())}${ext}`;
  fs.mkdirSync(PASTA_QUADRO, { recursive: true });
  fs.writeFileSync(path.join(PASTA_QUADRO, nome), buf);
  return { quadro: lerQuadro(), nome };
}

function servirImagem(res, nome) {
  const n = nomeSeguro(nome);
  const abs = n && path.join(PASTA_QUADRO, n);
  if (!abs || !existe(abs)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, {
    'Content-Type': IMAGENS[path.extname(abs).toLowerCase()],
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  });
  fs.createReadStream(abs).pipe(res);
}

// "### 1. Título" + texto embaixo
function lerPrincipios() {
  const linhas = linhasDe('principios.md');
  if (!linhas) return [];
  const out = [];
  let atual = null;
  const at = md.ativas(linhas);
  linhas.forEach((l, i) => {
    if (!at[i]) return;
    const t = md.titulo(l);
    if (t && t.nivel === 3 && /^\d+\./.test(t.texto)) { atual = { titulo: t.texto.replace(/^\d+\.\s*/, ''), texto: '' }; out.push(atual); return; }
    if (t) { atual = null; return; }
    if (atual && l.trim() && !l.trim().startsWith('>')) atual.texto += (atual.texto ? ' ' : '') + limpar(l);
  });
  return out;
}

// - Trava: "..." → Liberta: "..." — DD/MM/AAAA
const RE_TROCA = /^\s{0,3}[-*]\s+trava:\s*"?([^"→]+?)"?\s*(?:→|->)\s*liberta:\s*"?([^"]+?)"?\s*(?:—\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?))?\s*$/i;

function lerCrencas() {
  const linhas = linhasDe('crencas.md');
  if (!linhas) return { todas: [], minhas: 0 };
  const at = md.ativas(linhas);
  const todas = [];
  let secao = '';
  let tema = '';
  linhas.forEach((l, i) => {
    if (!at[i]) return;
    const t = md.titulo(l);
    if (t && t.nivel === 2) { secao = md.chave(t.texto); tema = ''; return; }
    if (t && t.nivel === 3) { tema = t.texto; return; } // "### Dinheiro": o tema das crenças de baixo
    const m = RE_TROCA.exec(limpar(l));
    if (!m) return;
    todas.push({ trava: m[1].trim(), liberta: m[2].trim(), data: m[3] || '', tema, minha: secao.startsWith('as minhas'), id: l.trim() });
  });
  return { todas, minhas: todas.filter((c) => c.minha).length };
}

// Pra tela "Troca de crenças"
function paginaDasCrencas() {
  if (!existe(arq('crencas.md'))) return null;
  const c = lerCrencas();
  return {
    arquivo: 'mentalidade/crencas.md',
    minhas: c.todas.filter((x) => x.minha),
    comuns: c.todas.filter((x) => !x.minha),
  };
}

// Aspas duplas atrapalham o formato do arquivo: viram simples
function textoDaCrenca(t) {
  let s = md.limparValor(t).replace(/[“”"]/g, "'").replace(/[→]/g, '-').trim();
  if (/^'.*'$/.test(s) && s.length > 1) s = s.slice(1, -1).trim(); // entre aspas por inteiro: tira as de fora
  return s.replace(/[\s.]+$/, '').slice(0, 240);
}

function agirCrencas(dados = {}) {
  const abs = arq('crencas.md');
  if (!existe(abs)) throw new ErroPainel('A pasta mentalidade/ não tem o crencas.md.', 404);
  const { linhas, eol } = md.ler(abs);
  const ponto = (t) => (/[.!?]$/.test(t) ? t : `${t}.`);
  const linhaNova = (trava, liberta) => `- Trava: "${ponto(trava)}" → Liberta: "${ponto(liberta)}" — ${md.dataBR()}`;
  const jaTem = (trava) => lerCrencas().todas.some((c) => c.minha && md.chave(c.trava) === md.chave(trava));
  switch (dados.acao) {
    case 'adicionar': {
      const trava = textoDaCrenca(dados.trava);
      const liberta = textoDaCrenca(dados.liberta);
      if (!trava) throw new ErroPainel('Escreva a crença que te trava.');
      if (!liberta) throw new ErroPainel('Escreva a crença nova, ou peça pra IA sugerir.');
      if (jaTem(trava)) throw new ErroPainel('Essa crença já está nas suas.');
      md.inserirNaSecao(linhas, 'As minhas', [linhaNova(trava, liberta)], { topo: true });
      break;
    }
    case 'adotar': {
      const c = lerCrencas().todas.find((x) => !x.minha && x.id === String(dados.id || '').trim());
      if (!c) throw new ErroPainel(MUDOU, 409);
      if (jaTem(c.trava)) throw new ErroPainel('Essa crença já está nas suas.');
      md.inserirNaSecao(linhas, 'As minhas', [linhaNova(c.trava.replace(/\.$/, ''), c.liberta.replace(/\.$/, ''))], { topo: true });
      break;
    }
    case 'apagar': {
      const at = md.ativas(linhas);
      let secao = '';
      const i = linhas.findIndex((l, n) => {
        if (!at[n]) return false;
        const t = md.titulo(l);
        if (t && t.nivel === 2) secao = md.chave(t.texto);
        return secao.startsWith('as minhas') && l.trim() === String(dados.id || '').trim();
      });
      if (i < 0) throw new ErroPainel(MUDOU, 409);
      linhas.splice(i, 1);
      break;
    }
    default:
      throw new ErroPainel('Ação desconhecida.');
  }
  md.gravar(abs, linhas, eol);
  return paginaDasCrencas();
}

// ---------- o diário (mentalidade/diario.md) ----------
// Cada nota é um "### DD/MM/AAAA" embaixo de "## Registro", com texto livre (quanto quiser)
// e, se tiver, os campos que a IA anota (Agradeço por, Hoje eu ajudei...). Pode ter mais de uma nota no mesmo dia.

const CAMPOS_DO_DIARIO = [
  { chave: 'agradeco', comeco: 'agradeco por', rotulo: 'Agradeço por' },
  { chave: 'ajudei', comeco: 'hoje eu ajudei', rotulo: 'Hoje eu ajudei' },
  { chave: 'vitoria', comeco: 'vitoria', rotulo: 'Vitória do dia' },
  { chave: 'passo', comeco: 'passo rumo', rotulo: 'Passo rumo ao sonho' },
];
const MAX_NOTA = 50000;

// "- **Agradeço por:** x" (como a IA escreve) ou "Agradeço por: x" (como a pessoa digita)
function campoDoDiario(linha) {
  let rotulo = '';
  let valor = '';
  const c = md.campoDaLinha(linha);
  if (c) { rotulo = c.rotulo; valor = c.valor; } else {
    const m = /^\s*([^:]{3,40}):\s*(.*)$/.exec(linha);
    if (!m) return null;
    rotulo = m[1];
    valor = m[2];
  }
  const k = md.chave(rotulo);
  const campo = CAMPOS_DO_DIARIO.find((x) => k.startsWith(x.comeco) && (c || k.length <= x.rotulo.length + 2));
  return campo ? { ...campo, valor: limpar(valor) } : null;
}

// Linhas que o markdown entenderia como título, bloco de código ou comentário ganham uma "\" na frente
const RE_ESPECIAL = /^(\s*)(?=#|```|~~~)/;
const escapar = (l) => l.replace(RE_ESPECIAL, '$1\\').replace(/<!--/g, '<\\!--');
const desescapar = (l) => l.replace(/^(\s*)\\(?=#|```|~~~)/, '$1').replace(/<\\!--/g, '<!--');

function resumo(t) {
  let x = 5381;
  for (let i = 0; i < t.length; i++) x = ((x * 33) ^ t.charCodeAt(i)) >>> 0;
  return x.toString(36);
}

function isoDoTitulo(t) {
  const m = /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/.exec(t || '');
  return m ? md.dataDeTexto(m[1], m[2], m[3], { passado: true }) : null;
}

const semVaziasNasPontas = (l) => {
  const x = [...l];
  while (x.length && !x[0].trim()) x.shift();
  while (x.length && !x[x.length - 1].trim()) x.pop();
  return x;
};

function entradasDoDiario(linhas) {
  return md.entradas(linhas).filter((e) => md.chave(e.secao).startsWith('registro'));
}

function notaDe(linhas, e) {
  const bruto = linhas.slice(e.linha, e.fim + 1);
  const texto = [];
  const editavel = [];
  const campos = {};
  for (const l of bruto.slice(1)) {
    const c = campoDoDiario(l);
    if (c) {
      if (md.preenchido(c.valor)) { campos[c.chave] = c.valor; editavel.push(`${c.rotulo}: ${c.valor}`); }
      continue;
    }
    texto.push(desescapar(l));
    editavel.push(desescapar(l));
  }
  return {
    id: `${e.linha}-${resumo(bruto.join('\n'))}`,
    titulo: e.titulo,
    iso: isoDoTitulo(e.titulo),
    texto: semVaziasNasPontas(texto).join('\n'),
    campos,
    editavel: semVaziasNasPontas(editavel).join('\n'),
  };
}

// Mais novas em cima (a data manda; no mesmo dia, a ordem do arquivo)
function lerNotas() {
  const linhas = linhasDe('diario.md');
  if (!linhas) return null;
  const notas = entradasDoDiario(linhas).map((e, i) => ({ ...notaDe(linhas, e), ordem: i }));
  notas.sort((a, b) => (a.iso && b.iso && a.iso !== b.iso ? (a.iso < b.iso ? 1 : -1) : a.ordem - b.ordem));
  return notas.map(({ ordem, ...n }) => n);
}

function paginaDoDiario() {
  const notas = lerNotas();
  if (!notas) return null;
  return { arquivo: 'mentalidade/diario.md', notas, total: notas.length, hoje: md.hojeISO() };
}

function linhasDaNota(iso, texto) {
  const [a, m, d] = iso.split('-');
  const corpo = semVaziasNasPontas(String(texto).replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/\s+$/, '')));
  const out = [];
  for (const l of corpo) {
    if (!l.trim()) { if (out.length && out[out.length - 1].trim()) out.push(''); continue; } // no máximo uma linha vazia seguida
    const c = campoDoDiario(l);
    out.push(c && md.preenchido(c.valor) ? `- **${c.rotulo}:** ${c.valor}` : escapar(l));
  }
  return [`### ${d}/${m}/${a}`, ...out];
}

function acharNota(linhas, id) {
  const [linha, h] = String(id || '').split('-');
  const lista = entradasDoDiario(linhas);
  const bate = (e) => resumo(linhas.slice(e.linha, e.fim + 1).join('\n')) === h;
  const e = lista.find((x) => String(x.linha) === linha && bate(x)) || lista.find(bate);
  if (!e) throw new ErroPainel(MUDOU, 409);
  return e;
}

function tirarBloco(linhas, e) {
  linhas.splice(e.linha, e.fim - e.linha + 1);
  // não deixa duas linhas vazias seguidas
  if (linhas[e.linha] !== undefined && !linhas[e.linha].trim() && (e.linha === 0 || !linhas[e.linha - 1].trim())) linhas.splice(e.linha, 1);
}

// No lugar certo: antes da primeira nota mais velha (o mais novo fica em cima)
function porNota(linhas, iso, bloco) {
  let sec = md.acharSecao(linhas, 'Registro');
  if (!sec) {
    while (linhas.length && !linhas[linhas.length - 1].trim()) linhas.pop();
    linhas.push('', '## Registro', '');
    sec = md.acharSecao(linhas, 'Registro');
  }
  const antesDe = entradasDoDiario(linhas).find((e) => { const x = isoDoTitulo(e.titulo); return x && x < iso; });
  if (antesDe) { linhas.splice(antesDe.linha, 0, ...bloco, ''); return; }
  const p = md.posicaoFim(linhas, sec);
  const novo = [...bloco];
  if (linhas[p - 1] !== undefined && linhas[p - 1].trim()) novo.unshift('');
  if (linhas[p] !== undefined && linhas[p].trim()) novo.push('');
  linhas.splice(p, 0, ...novo);
}

function dataDaNota(v) {
  const x = String(v || '').trim();
  if (!x) return md.hojeISO();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(x);
  const d = m && new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (!d || d.getDate() !== Number(m[3]) || Number(m[1]) < 1900 || Number(m[1]) > 2200) throw new ErroPainel('Escolha uma data válida.');
  return x;
}

function textoDaNota(v) {
  const t = String(v ?? '');
  if (!t.trim()) throw new ErroPainel('Escreva alguma coisa na nota.');
  if (t.length > MAX_NOTA) throw new ErroPainel('A nota ficou grande demais. Divida em duas.');
  return t;
}

function agirDiario(dados = {}) {
  const abs = arq('diario.md');
  if (!existe(abs)) throw new ErroPainel('A pasta mentalidade/ não tem o diario.md.', 404);
  const { linhas, eol } = md.ler(abs);
  switch (dados.acao) {
    case 'adicionar': {
      const iso = dataDaNota(dados.data);
      porNota(linhas, iso, linhasDaNota(iso, textoDaNota(dados.texto)));
      break;
    }
    case 'editar': {
      const e = acharNota(linhas, dados.id);
      const iso = dataDaNota(dados.data);
      const bloco = linhasDaNota(iso, textoDaNota(dados.texto));
      if (isoDoTitulo(e.titulo) === iso) {
        linhas.splice(e.linha + 1, e.fim - e.linha, ...bloco.slice(1)); // mesma data: troca só o texto, no mesmo lugar
      } else {
        tirarBloco(linhas, e);
        porNota(linhas, iso, bloco);
      }
      break;
    }
    case 'apagar':
      tirarBloco(linhas, acharNota(linhas, dados.id));
      break;
    default:
      throw new ErroPainel('Ação desconhecida.');
  }
  md.gravar(abs, linhas, eol);
  return paginaDoDiario();
}

// Pra tela da Mentalidade
function pagina() {
  if (!existe(PASTA)) return null;
  const crencas = lerCrencas();
  // 3 trocas por dia (as do dono primeiro, se tiver)
  const ordem = [...crencas.todas.filter((c) => c.minha), ...crencas.todas.filter((c) => !c.minha)];
  const n = numeroDoDia();
  const doDia = [];
  for (let i = 0; i < Math.min(3, ordem.length); i++) doDia.push(ordem[(n + i * 5) % ordem.length]);
  const sonho = lerSonho();
  const areas = areasDoSonho();
  return {
    sonho,
    areas,
    quadro: lerQuadro(),
    quadroPrompt: quadroPrompt(sonho, areas),
    explicacoes: explicacoes(),
    frase: fraseDoDia(),
    principios: lerPrincipios(),
    crencas: { doDia: [...new Set(doDia)], total: crencas.todas.length, minhas: crencas.minhas },
    diario: (() => { const n = lerNotas() || []; return { notas: n.slice(0, 4), total: n.length, hoje: md.hojeISO() }; })(),
    frases: (() => { const f = lerFrases(); return f ? { todas: [...f.minhas, ...f.temas.flatMap((t) => t.frases)].map((x) => x.texto), minhas: f.minhas.length } : { todas: [], minhas: 0 }; })(),
    hoje: md.hojeISO(),
  };
}

// Pro lembrete que aparece no painel todo
function lembrete() {
  if (!existe(PASTA)) return null;
  const s = lerSonho();
  const f = fraseDoDia();
  return { sonho: s ? s.curto : '', porque: s ? s.porque : '', frase: f ? f.texto : '' };
}

module.exports = {
  fraseDoDia, lerSonho, pagina, lembrete,
  paginaDasCrencas, agirCrencas, paginaDasFrases, agirFrases, paginaDoDiario, agirDiario,
  agirQuadro, servirImagem,
};
