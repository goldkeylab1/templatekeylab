// Feedbacks, ideias e aprendizados (memoria/).
// Feedbacks e ideias são blocos "### Título" com campos embaixo, o mais novo em cima.
'use strict';

const path = require('path');
const md = require('./md');
const { RAIZ, existe } = require('./raiz');
const { ErroPainel, MUDOU } = require('./erro');
const kanban = require('./kanban');

const ARQ_FEEDBACKS = path.join(RAIZ, 'memoria', 'feedbacks.md');
const ARQ_IDEIAS = path.join(RAIZ, 'memoria', 'ideias.md');
const ARQ_APRENDIZADOS = path.join(RAIZ, 'memoria', 'aprendizados.md');
const ARQ_MARKETING = path.join(RAIZ, 'marketing', 'o-que-funciona.md');

const MOLDE_FEEDBACKS = `# Feedbacks

> Tudo que falam do seu negócio: clientes, seguidores, equipe e você mesmo.

## Registro
`;

const MOLDE_IDEIAS = `# Ideias

> Ideias pra depois. Guarde agora, decida depois.

## Ideias
`;

function lerOuCriar(abs, molde) {
  if (!existe(abs)) md.gravar(abs, molde);
  return md.ler(abs);
}

function simples(e) {
  const v = (n) => md.valorDe(e, n);
  return { titulo: e.titulo, linha: e.linha, campos: e.campos, corpo: e.corpo.join('\n'), v };
}

// ---------- feedbacks ----------

function lerFeedbacks() {
  const { linhas, texto } = lerOuCriar(ARQ_FEEDBACKS, MOLDE_FEEDBACKS);
  const lista = md.entradas(linhas).map((e) => {
    const s = simples(e);
    return {
      titulo: s.titulo,
      linha: s.linha,
      data: s.v('data'),
      quem: s.v('quem'),
      tipo: s.v('tipo'),
      disse: s.v('o que disse') || s.corpo,
      onde: s.v('onde'),
      fazer: s.v('o que fazer'),
      status: s.v('status') || 'novo',
    };
  });
  return { arquivo: 'memoria/feedbacks.md', versao: md.versao(texto), feedbacks: lista, aprendizados: lerAprendizados() };
}

function lerAprendizados() {
  const ler = (abs, rel) => {
    if (!existe(abs)) return { arquivo: rel, secoes: [] };
    const { linhas } = md.ler(abs);
    return { arquivo: rel, secoes: md.secoesComItens(linhas) };
  };
  return {
    geral: ler(ARQ_APRENDIZADOS, 'memoria/aprendizados.md'),
    marketing: ler(ARQ_MARKETING, 'marketing/o-que-funciona.md'),
  };
}

function agirFeedbacks(dados = {}) {
  const { linhas, eol } = lerOuCriar(ARQ_FEEDBACKS, MOLDE_FEEDBACKS);
  switch (dados.acao) {
    case 'adicionar': {
      const disse = md.limparValor(dados.disse);
      if (!disse) throw new ErroPainel('Escreva o que foi dito.');
      const titulo = md.limparValor(dados.titulo) || resumo(disse);
      const bloco = [
        `### ${titulo}`,
        `- **Data:** ${md.dataBR()}`,
        `- **Quem:** ${md.limparValor(dados.quem) || 'cliente'}`,
        `- **Tipo:** ${md.limparValor(dados.tipo) || 'sugestão'}`,
        `- **O que disse:** ${disse}`,
        `- **Onde:**${dados.onde ? ` ${md.limparValor(dados.onde)}` : ''}`,
        '- **O que fazer:**',
        '- **Status:** novo',
      ];
      md.inserirNaSecao(linhas, 'Registro', bloco, { topo: true, separar: true });
      break;
    }
    case 'status': {
      const e = md.acharEntrada(linhas, { titulo: dados.titulo, linha: dados.linha });
      if (!e) throw new ErroPainel(MUDOU, 409);
      md.trocarCampoDaEntrada(linhas, e, 'status', dados.status, 'Status');
      break;
    }
    case 'apagar': {
      apagarEntrada(linhas, dados);
      break;
    }
    default:
      throw new ErroPainel('Ação desconhecida.');
  }
  md.gravar(ARQ_FEEDBACKS, linhas, eol);
  return lerFeedbacks();
}

// ---------- ideias ----------

function lerIdeias() {
  const { linhas, texto } = lerOuCriar(ARQ_IDEIAS, MOLDE_IDEIAS);
  const lista = md.entradas(linhas).map((e) => {
    const s = simples(e);
    return {
      titulo: s.titulo,
      linha: s.linha,
      data: s.v('data'),
      tipo: s.v('tipo'),
      status: s.v('status') || 'nova',
      ideia: s.v('ideia') || s.corpo,
      pensar: s.v('pra pensar'),
    };
  });
  return { arquivo: 'memoria/ideias.md', versao: md.versao(texto), ideias: lista };
}

function agirIdeias(dados = {}) {
  const { linhas, eol } = lerOuCriar(ARQ_IDEIAS, MOLDE_IDEIAS);
  switch (dados.acao) {
    case 'adicionar': {
      const titulo = md.limparValor(dados.titulo);
      if (!titulo) throw new ErroPainel('Dê um nome pra ideia.');
      const bloco = [
        `### ${titulo}`,
        `- **Data:** ${md.dataBR()}`,
        `- **Tipo:** ${md.limparValor(dados.tipo) || 'outro'}`,
        '- **Status:** nova',
        `- **Ideia:**${dados.ideia ? ` ${md.limparValor(dados.ideia)}` : ''}`,
        '- **Pra pensar:**',
      ];
      md.inserirNaSecao(linhas, 'Ideias', bloco, { topo: true, separar: true });
      break;
    }
    case 'status': {
      const e = md.acharEntrada(linhas, { titulo: dados.titulo, linha: dados.linha });
      if (!e) throw new ErroPainel(MUDOU, 409);
      md.trocarCampoDaEntrada(linhas, e, 'status', dados.status, 'Status');
      break;
    }
    case 'pro-kanban': {
      const e = md.acharEntrada(linhas, { titulo: dados.titulo, linha: dados.linha });
      if (!e) throw new ErroPainel(MUDOU, 409);
      kanban.agir({ acao: 'adicionar', arquivo: kanban.PRINCIPAL, texto: e.titulo, areas: ['ideia'] });
      md.trocarCampoDaEntrada(linhas, e, 'status', 'fazendo', 'Status');
      break;
    }
    case 'apagar': {
      apagarEntrada(linhas, dados);
      break;
    }
    default:
      throw new ErroPainel('Ação desconhecida.');
  }
  md.gravar(ARQ_IDEIAS, linhas, eol);
  return lerIdeias();
}

// ---------- ajudantes ----------

function apagarEntrada(linhas, dados) {
  const e = md.acharEntrada(linhas, { titulo: dados.titulo, linha: dados.linha });
  if (!e) throw new ErroPainel(MUDOU, 409);
  let fim = e.fim + 1;
  while (fim < linhas.length && linhas[fim].trim() === '') fim++;
  linhas.splice(e.linha, fim - e.linha);
}

function resumo(texto) {
  const palavras = texto.replace(/["“”]/g, '').split(/\s+/).slice(0, 7).join(' ');
  return palavras.length < texto.length ? `${palavras}...` : palavras;
}

module.exports = { lerFeedbacks, agirFeedbacks, lerIdeias, agirIdeias, lerAprendizados };
