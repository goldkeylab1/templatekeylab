// Testes (marketing/testes.md) e decisões (memoria/decisoes.md): os prazos que somem se ninguém lembrar.
//   Teste:   ### Nome + "- **Julgar em:** DD/MM/AAAA", em "## Abertos" ou "## Fechados"
//   Decisão: ### Nome + "- **Rever em:** DD/MM/AAAA" (vira "revista em DD/MM/AAAA" quando o dono revê)
'use strict';

const path = require('path');
const md = require('./md');
const { RAIZ, existe } = require('./raiz');
const { ErroPainel, MUDOU } = require('./erro');

const ARQ_TESTES = path.join(RAIZ, 'marketing', 'testes.md');
const ARQ_DECISOES = path.join(RAIZ, 'memoria', 'decisoes.md');
const DECISOES_DE_TESTE = ['virou regra', 'não funciona', 'testar de novo'];

const MOLDE_TESTES = `# Testes

> Um teste muda UMA coisa e mede UM número. É assim que uma hipótese vira regra.

## Abertos

## Fechados
`;

// "05/11/2026", "5/11", "2026-11-05" → "2026-11-05"
function dataDoCampo(valor) {
  const v = String(valor || '');
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/.exec(v);
  return br ? md.dataDeTexto(br[1], br[2], br[3]) : null;
}

function isoParaBR(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

// ---------- testes ----------

function lerTestes() {
  if (!existe(ARQ_TESTES)) return { arquivo: 'marketing/testes.md', abertos: [], fechados: [] };
  const { linhas, texto } = md.ler(ARQ_TESTES);
  const lista = md.entradas(linhas).map((e) => {
    const v = (n) => md.valorDe(e, n);
    const fechado = md.chave(e.secao).startsWith('fechad');
    return {
      titulo: e.titulo,
      linha: e.linha,
      fechado,
      hipotese: v('hipotese'),
      muda: v('o que muda'),
      igual: v('o que fica igual'),
      numero: v('numero que julga'),
      comparar: v('comparar com'),
      comecou: dataDoCampo(v('comecou')),
      julgar: dataDoCampo(v('julgar em')),
      resultado: v('resultado'),
      decisao: v('decisao').split('|')[0].trim(),
    };
  });
  return {
    arquivo: 'marketing/testes.md',
    versao: md.versao(texto),
    abertos: lista.filter((t) => !t.fechado),
    fechados: lista.filter((t) => t.fechado),
  };
}

function blocoDaEntrada(linhas, e) {
  let fim = e.fim + 1;
  while (fim < linhas.length && linhas[fim].trim() === '') fim++;
  return linhas.splice(e.linha, fim - e.linha);
}

function agirTestes(dados = {}) {
  if (!existe(ARQ_TESTES)) md.gravar(ARQ_TESTES, MOLDE_TESTES);
  const { linhas, eol } = md.ler(ARQ_TESTES);
  switch (dados.acao) {
    case 'adicionar': {
      const titulo = md.limparValor(dados.titulo);
      if (!titulo) throw new ErroPainel('Dê um nome pro teste.');
      if (!md.limparValor(dados.numero)) throw new ErroPainel('Diga qual número vai julgar o teste.');
      const julgar = dataDoCampo(dados.julgar);
      if (!julgar) throw new ErroPainel('Escolha o dia de julgar.');
      const campo = (rotulo, valor) => `- **${rotulo}:**${md.limparValor(valor) ? ` ${md.limparValor(valor)}` : ''}`;
      md.inserirNaSecao(linhas, 'Abertos', [
        `### ${titulo}`,
        campo('Hipótese', dados.hipotese),
        campo('O que muda', dados.muda),
        campo('O que fica igual', dados.igual),
        campo('Número que julga', dados.numero),
        campo('Comparar com', dados.comparar),
        campo('Começou', md.dataBR()),
        campo('Julgar em', isoParaBR(julgar)),
        '- **Resultado:**',
        '- **Decisão:**',
      ], { topo: true, separar: true });
      break;
    }
    case 'fechar': {
      const e = md.acharEntrada(linhas, { titulo: dados.titulo, linha: dados.linha });
      if (!e) throw new ErroPainel(MUDOU, 409);
      const resultado = md.limparValor(dados.resultado);
      if (!resultado) throw new ErroPainel('Escreva o resultado (com o número).');
      const decisao = DECISOES_DE_TESTE.find((d) => md.chave(d) === md.chave(dados.decisao));
      if (!decisao) throw new ErroPainel('Escolha a decisão.');
      md.trocarCampoDaEntrada(linhas, e, 'resultado', resultado, 'Resultado');
      const depois = md.acharEntrada(linhas, { titulo: e.titulo, linha: e.linha });
      md.trocarCampoDaEntrada(linhas, depois, 'decisao', decisao, 'Decisão');
      const atual = md.acharEntrada(linhas, { titulo: e.titulo, linha: e.linha });
      const bloco = blocoDaEntrada(linhas, atual);
      while (bloco.length && bloco[bloco.length - 1].trim() === '') bloco.pop();
      md.inserirNaSecao(linhas, 'Fechados', bloco, { topo: true, separar: true });
      break;
    }
    case 'apagar': {
      const e = md.acharEntrada(linhas, { titulo: dados.titulo, linha: dados.linha });
      if (!e) throw new ErroPainel(MUDOU, 409);
      blocoDaEntrada(linhas, e);
      break;
    }
    default:
      throw new ErroPainel('Ação desconhecida.');
  }
  md.gravar(ARQ_TESTES, linhas, eol);
  return lerTestes();
}

// ---------- decisões ----------

function lerDecisoes() {
  if (!existe(ARQ_DECISOES)) return [];
  const { linhas } = md.ler(ARQ_DECISOES);
  return md.entradas(linhas).map((e) => {
    const rever = md.valorDe(e, 'rever em');
    return {
      titulo: e.titulo,
      linha: e.linha,
      data: dataDoCampo(md.valorDe(e, 'data')),
      decisao: md.valorDe(e, 'decisao'),
      numero: md.valorDe(e, 'numero que vai julgar'),
      rever: md.chave(rever).startsWith('revist') ? null : dataDoCampo(rever),
    };
  });
}

function marcarRevista(dados = {}) {
  if (!existe(ARQ_DECISOES)) throw new ErroPainel(MUDOU, 409);
  const { linhas, eol } = md.ler(ARQ_DECISOES);
  const e = md.acharEntrada(linhas, { titulo: dados.titulo, linha: dados.linha });
  if (!e) throw new ErroPainel(MUDOU, 409);
  md.trocarCampoDaEntrada(linhas, e, 'rever em', `revista em ${md.dataBR()}`, 'Rever em');
  md.gravar(ARQ_DECISOES, linhas, eol);
  return { ok: true };
}

// ---------- prazos (pro Dashboard e pro resumo da IA) ----------

function prazos() {
  const out = [];
  for (const t of lerTestes().abertos) {
    if (!t.julgar) continue;
    out.push({ tipo: 'teste', texto: `Julgar o teste: ${t.titulo}`, titulo: t.titulo, linha: t.linha, data: t.julgar, href: '#/testes', arquivo: 'marketing/testes.md' });
  }
  for (const d of lerDecisoes()) {
    if (!d.rever) continue;
    out.push({ tipo: 'decisao', texto: `Rever a decisão: ${d.titulo}`, titulo: d.titulo, linha: d.linha, data: d.rever, href: `#/arquivo?c=${encodeURIComponent('memoria/decisoes.md')}`, arquivo: 'memoria/decisoes.md' });
  }
  return out.sort((a, b) => a.data.localeCompare(b.data));
}

module.exports = { lerTestes, agirTestes, lerDecisoes, marcarRevista, prazos, dataDoCampo, DECISOES_DE_TESTE };
