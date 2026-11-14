#!/usr/bin/env node
// O painel do negócio. Roda só no seu computador: http://localhost:4747
// Sem instalar nada: só o Node (versão 18 ou mais nova).
//   node painel/servidor.js           liga e mostra o endereço
//   node painel/servidor.js --abrir   liga e abre no navegador
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const { RAIZ } = require('./lib/raiz');
const md = require('./lib/md');
const cronograma = require('./lib/cronograma');
const kanban = require('./lib/kanban');
const registros = require('./lib/registros');
const areas = require('./lib/areas');
const status = require('./lib/status');
const git = require('./lib/git');
const marca = require('./lib/marca');
const pref = require('./lib/preferencias');
const { lerAjuda } = require('./lib/ajuda');
const { textoDoCerebro } = require('./lib/cerebro');
const porta = require('./lib/porta');
const { vigiar } = require('./lib/vigia');
const { ErroPainel } = require('./lib/erro');
const baixador = require('./lib/baixador');
const ferramentas = require('./lib/ferramentas');
const testes = require('./lib/testes');
const saidas = require('./lib/saidas');
const numeros = require('./lib/numeros');
const busca = require('./lib/busca');
const saude = require('./lib/saude');
const chat = require('./lib/chat');
const anotador = require('./lib/anotador');
const mentalidade = require('./lib/mentalidade');

const VERSAO = require('../package.json').version || '1.0.0';
const PUBLICO = path.join(__dirname, 'public');
const PORTA_INICIAL = Number(process.env.PAINEL_PORTA) || 4747;
const ABRIR = process.argv.includes('--abrir');

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

let portaAtual = PORTA_INICIAL;
const ouvintes = new Set();

// ---------- respostas ----------

function json(res, codigo, dados) {
  const corpo = JSON.stringify(dados);
  res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(corpo);
}

function erro(res, e) {
  const codigo = e instanceof ErroPainel ? e.status : 500;
  if (codigo === 500) console.error(e);
  json(res, codigo, { erro: e instanceof ErroPainel ? e.message : 'Algo deu errado no painel. Veja o terminal ou peça ajuda pra IA.' });
}

function arquivoEstatico(res, caminho) {
  const limpo = path.normalize(decodeURIComponent(caminho)).replace(/^([/\\])+/, '');
  const abs = path.join(PUBLICO, limpo || 'index.html');
  if (!abs.startsWith(PUBLICO)) { res.writeHead(403); res.end(); return; }
  fs.readFile(abs, (e, dados) => {
    if (e) {
      // rotas do painel (#/...) sempre caem no index
      if (!path.extname(limpo)) return arquivoEstatico(res, 'index.html');
      res.writeHead(404); res.end('Não encontrado'); return;
    }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(abs).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(dados);
  });
}

function lerCorpo(req, limite = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let tamanho = 0;
    const partes = [];
    req.on('data', (d) => {
      tamanho += d.length;
      if (tamanho > limite) { reject(new ErroPainel('Arquivo grande demais.', 413)); req.destroy(); return; }
      partes.push(d);
    });
    req.on('end', () => {
      try { resolve(partes.length ? JSON.parse(Buffer.concat(partes).toString('utf8')) : {}); }
      catch { reject(new ErroPainel('Dados inválidos.')); }
    });
    req.on('error', reject);
  });
}

// Só aceita pedidos deste computador e do próprio painel (protege contra sites mal-intencionados)
function hostValido(req) {
  const host = String(req.headers.host || '').toLowerCase();
  return [`localhost:${portaAtual}`, `127.0.0.1:${portaAtual}`, `[::1]:${portaAtual}`].includes(host);
}

// ---------- dados compostos ----------

function inicio() {
  const st = status.calcular();
  const lista = areas.listarAreas().map((a) => ({ id: a.id, nome: a.nome, icone: a.icone, ordem: a.ordem }));
  return {
    versao: VERSAO,
    pasta: RAIZ,
    marca: marca.lerMarca(),
    areas: lista,
    status: { pct: st.pct, prontos: st.prontos, total: st.total },
    git: resumoGit(),
    abrirSozinho: !pref.nao(pref.ler('abrir o painel sozinho')),
    lembrete: mentalidade.lembrete(),
  };
}

function resumoGit() {
  const e = git.estado();
  return { resumo: e.resumo, ligado: git.ligado(e), mudancas: e.mudancas, ultimoCommit: e.ultimoCommit, visibilidade: e.visibilidade, repositorio: e.repositorio, remoto: !!e.remoto };
}

function dashboard() {
  const fb = registros.lerFeedbacks();
  const id = registros.lerIdeias();
  const st = status.calcular();
  return {
    cronograma: cronograma.ler(),
    cartoes: kanban.cartoesComData(),
    prazos: testes.prazos(),
    avisos: saude.avisos(),
    frase: mentalidade.fraseDoDia(),
    anotados: anotador.ultimos(12).filter((e) => (e.itens || []).length && Date.now() - e.quando < 7 * 86400000).slice(0, 5),
    fazendo: kanban.emAndamento(),
    feedbacks: fb.feedbacks.filter((f) => md.chave(f.status) === 'novo').slice(0, 3),
    feedbacksNovos: fb.feedbacks.filter((f) => md.chave(f.status) === 'novo').length,
    ideias: id.ideias.filter((i) => ['nova', 'pensando'].includes(md.chave(i.status))).slice(0, 3),
    status: { pct: st.pct, prontos: st.prontos, total: st.total, proximo: st.proximo },
    git: resumoGit(),
    marca: marca.lerMarca(),
  };
}

// ---------- rotas ----------

const GET = {
  '/api/ping': () => ({ ok: true, app: 'painel-do-negocio', pasta: RAIZ, versao: VERSAO, abas: ouvintes.size }),
  '/api/inicio': inicio,
  '/api/status': () => status.calcular(),
  '/api/dashboard': dashboard,
  '/api/cronograma': () => cronograma.ler(),
  '/api/kanban': () => ({ quadros: kanban.listarQuadros() }),
  '/api/feedbacks': () => registros.lerFeedbacks(),
  '/api/ideias': () => registros.lerIdeias(),
  '/api/testes': () => testes.lerTestes(),
  '/api/saidas': () => saidas.listarSaidas(),
  '/api/saidas/texto': (q) => saidas.textoDaSaida(q.get('caminho')),
  '/api/numeros': () => numeros.lerNumeros(),
  '/api/busca': (q) => busca.procurar(q.get('q') || ''),
  '/api/chat': (q) => chat.estado({ deNovo: q.get('procurar') === '1' }),
  '/api/mentalidade': () => mentalidade.pagina(),
  '/api/crencas': () => mentalidade.paginaDasCrencas(),
  '/api/frases': () => mentalidade.paginaDasFrases(),
  '/api/diario': () => mentalidade.paginaDoDiario(),
  '/api/anotador': () => anotador.estado({ git: git.estado(), temClaude: !!chat.caminhos().claude }),
  '/api/area': (q) => areas.paginaDaArea(q.get('id')),
  '/api/arquivo': (q) => areas.lerArquivo(q.get('caminho')),
  '/api/ajuda': () => lerAjuda(),
  '/api/marca': () => marca.lerMarca(),
  '/api/cerebro': () => ({ texto: textoDoCerebro() }),
  '/api/ferramentas': () => ({
    baixador: baixador.estado(),
    tarefas: baixador.tarefas(),
    virais: ferramentas.listarVirais(),
    transcricoes: ferramentas.listarTranscricoes(),
  }),
  '/api/ferramentas/tarefa': (q) => baixador.tarefa(q.get('id')) || { estado: 'sumiu' },
  '/api/ferramentas/texto': (q) => ferramentas.textos(q.get('grupo') || 'virais', q.get('pasta')),
  '/api/git': async () => {
    const e = git.estado();
    if (e.remoto && e.github && !e.doModelo) {
      e.visibilidade = await git.verificarVisibilidade(e.remoto) || e.visibilidade;
    }
    return { ...e, ligado: git.ligado(e) };
  },
};

const POST = {
  '/api/cronograma': (d) => cronograma.agir(d),
  '/api/kanban': (d) => kanban.agir(d),
  '/api/feedbacks': (d) => registros.agirFeedbacks(d),
  '/api/ideias': (d) => registros.agirIdeias(d),
  '/api/testes': (d) => testes.agirTestes(d),
  '/api/decisoes/revista': (d) => testes.marcarRevista(d),
  '/api/chat/enviar': (d) => chat.enviar(d),
  '/api/chat/parar': () => chat.parar(),
  '/api/chat/nova': () => chat.novaConversa(),
  '/api/chat/ia': (d) => chat.escolher(d.id),
  '/api/chat/modelo': (d) => chat.escolherModelo(d.modelo),
  '/api/chat/esforco': (d) => chat.escolherEsforco(d.esforco),
  '/api/anotador': (d) => anotador.ajustar(d),
  '/api/crencas': (d) => mentalidade.agirCrencas(d),
  '/api/frases': (d) => mentalidade.agirFrases(d),
  '/api/diario': (d) => mentalidade.agirDiario(d),
  '/api/mentalidade/imagem': (d) => mentalidade.agirQuadro(d),
  '/api/arquivo/campos': (d) => areas.salvarCampos(d.caminho, d.mudancas),
  '/api/arquivo/texto': (d) => areas.salvarTexto(d.caminho, d.texto, d.versao),
  '/api/arquivo/marcar': (d) => areas.marcarCaixa(d.caminho, d),
  '/api/marca': (d) => marca.salvarMarca(d),
  '/api/marca/logo': (d) => marca.salvarLogo(d),
  '/api/preferencia': (d) => {
    if (!['salvar no github sozinho', 'abrir o painel sozinho'].includes(md.chave(d.nome))) throw new ErroPainel('Preferência desconhecida.');
    pref.gravar(d.nome, d.valor, d.rotulo || d.nome);
    return { ok: true };
  },
  '/api/git/salvar': (d) => git.salvar({ mensagem: d.mensagem, interativo: true }),
  '/api/ferramentas/preparar': () => baixador.preparar(),
  '/api/ferramentas/baixar': (d) => baixador.baixar(d),
  '/api/ferramentas/cancelar': (d) => baixador.cancelar(d.id),
  '/api/ferramentas/foto': (d) => ferramentas.salvarFoto(d),
  '/api/ferramentas/fotos-prontas': (d) => ferramentas.fotosProntas(d),
  '/api/ferramentas/fotos-de-novo': (d) => ferramentas.fotosDeNovo(d),
  '/api/ferramentas/transcricao': (d) => ferramentas.salvarTranscricao(d),
  '/api/ferramentas/transcrever-de-novo': (d) => ferramentas.transcreverDeNovo(d),
  '/api/ferramentas/apagar': (d) => ferramentas.apagar(d),
  '/api/ferramentas/abrir': (d) => ferramentas.abrirPasta(d),
  // O "npm run baixar" pede pras abas abertas irem pra tela Ferramentas (é lá que saem as fotos e a transcrição)
  '/api/ferramentas/mostrar': () => { mandarEvento('ferramentas', {}); return { ok: true, abas: ouvintes.size }; },
  '/api/desligar': () => {
    setTimeout(() => process.exit(0), 150);
    return { ok: true };
  },
};

function eventos(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
  res.write('retry: 2000\n\n');
  ouvintes.add(res);
  const pulso = setInterval(() => res.write(': ok\n\n'), 25000);
  req.on('close', () => { clearInterval(pulso); ouvintes.delete(res); });
}

function avisar(lista) {
  const codigo = lista.some((r) => r.startsWith('painel/public/'));
  const dados = JSON.stringify({ arquivos: lista.slice(0, 30), recarregarPagina: codigo });
  for (const res of ouvintes) res.write(`event: mudou\ndata: ${dados}\n\n`);
}

function mandarEvento(nome, dados) {
  const texto = JSON.stringify(dados || {});
  for (const res of ouvintes) res.write(`event: ${nome}\ndata: ${texto}\n\n`);
}

function servirLogo(res) {
  const abs = marca.acharLogo();
  if (!abs) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, {
    'Content-Type': marca.IMAGENS[path.extname(abs).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  });
  fs.createReadStream(abs).pipe(res);
}

async function atender(req, res) {
  if (!hostValido(req)) { res.writeHead(403); res.end('Acesso só pelo localhost.'); return; }
  const url = new URL(req.url, `http://localhost:${portaAtual}`);
  const rota = url.pathname;
  try {
    if (req.method === 'GET') {
      if (rota === '/api/eventos') return eventos(req, res);
      if (rota === '/api/logo') return servirLogo(res);
      if (rota === '/api/mentalidade/imagem') return mentalidade.servirImagem(res, url.searchParams.get('nome'));
      if (rota === '/api/ferramentas/midia') return ferramentas.servirMidia(req, res, url.searchParams);
      if (rota === '/api/ferramentas/imagem') return ferramentas.servirImagem(req, res, url.searchParams);
      if (GET[rota]) return json(res, 200, await GET[rota](url.searchParams));
      if (rota.startsWith('/api/')) throw new ErroPainel('Rota não encontrada.', 404);
      return arquivoEstatico(res, rota === '/' ? 'index.html' : rota);
    }
    if (req.method === 'POST') {
      if (req.headers['x-keylab'] !== '1') throw new ErroPainel('Pedido recusado.', 403);
      if (!POST[rota]) throw new ErroPainel('Rota não encontrada.', 404);
      const dados = await lerCorpo(req);
      return json(res, 200, await POST[rota](dados));
    }
    res.writeHead(405); res.end();
  } catch (e) {
    erro(res, e);
  }
}

// ---------- ligar ----------

async function ligar() {
  const ja = await porta.portaLigada();
  if (ja) {
    console.log(`O painel já está ligado: ${porta.url(ja)}`);
    if (ABRIR) porta.abrirNavegador(porta.url(ja));
    return;
  }
  const servidor = http.createServer(atender);
  const tentar = (p) => new Promise((resolve, reject) => {
    servidor.once('error', reject);
    servidor.listen(p, '127.0.0.1', () => { servidor.removeListener('error', reject); resolve(p); });
  });
  for (let p = PORTA_INICIAL; p < PORTA_INICIAL + 20; p++) {
    try {
      portaAtual = await tentar(p);
      break;
    } catch (e) {
      if (e.code !== 'EADDRINUSE') throw e;
      portaAtual = null;
    }
  }
  if (!portaAtual) {
    console.error('Não achei uma porta livre (4747 a 4766). Feche outros painéis e tente de novo.');
    process.exit(1);
  }
  porta.gravarInfo(portaAtual);
  vigiar(avisar);
  chat.iniciar((dados) => mandarEvento('chat', dados));
  const endereco = porta.url(portaAtual);
  console.log(`\n  Painel ligado: ${endereco}\n  Pasta: ${RAIZ}\n  Pra desligar: feche essa janela ou aperte Ctrl+C.\n`);
  if (ABRIR) porta.abrirNavegador(endereco);
  const sair = () => { chat.parar(); porta.apagarInfo(); process.exit(0); };
  process.on('SIGINT', sair);
  process.on('SIGTERM', sair);
  process.on('exit', () => porta.apagarInfo());
}

ligar().catch((e) => {
  console.error('Não consegui ligar o painel:', e.message);
  process.exit(1);
});
