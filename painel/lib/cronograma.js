// O cronograma: memoria/cronograma.md
//   ## A fazer            - [ ] Tarefa @DD/MM #area
//   ## Decisões pra tomar - [ ] Decidir algo @DD/MM
//   ## Feito              - [x] Tarefa ✓ DD/MM HH:MM   (o mais novo em cima)
'use strict';

const path = require('path');
const md = require('./md');
const { RAIZ, existe } = require('./raiz');
const { analisarTexto, montarTexto, agoraISO } = require('./itens');
const { ErroPainel, MUDOU } = require('./erro');

const ARQUIVO = path.join(RAIZ, 'memoria', 'cronograma.md');

const MOLDE = `# Cronograma

> O que fazer e quando. O painel mostra isso no Dashboard.
> Pra IA: uma tarefa por linha: \`- [ ] O que fazer @DD/MM #area\` (data e área são opcionais).
> Pra IA: quando terminar, troque \`[ ]\` por \`[x]\`, ponha \`✓ DD/MM HH:MM\` no fim e leve a linha pro topo de "Feito".

## A fazer

## Decisões pra tomar

## Feito
`;

const RE_TAREFA = /^(\s*)[-*]\s+\[( |x|X)\]\s+(.*)$/;

function garantir() {
  if (!existe(ARQUIVO)) md.gravar(ARQUIVO, MOLDE);
}

function tipoDaSecao(nome) {
  const k = md.chave(nome);
  if (k.startsWith('feito') || k.startsWith('conclu')) return 'feitos';
  if (k.startsWith('decis')) return 'decisoes';
  return 'tarefas';
}

function itens(linhas) {
  const at = md.ativas(linhas);
  const lista = [];
  let secao = 'tarefas';
  let nomeSecao = 'A fazer';
  for (let i = 0; i < linhas.length; i++) {
    if (!at[i]) continue;
    const t = md.titulo(linhas[i]);
    if (t && t.nivel === 2) { secao = tipoDaSecao(t.texto); nomeSecao = t.texto; continue; }
    const m = RE_TAREFA.exec(linhas[i]);
    if (!m || m[1].length > 3) continue;
    lista.push({
      id: linhas[i].trim(),
      linha: i,
      secao,
      nomeSecao,
      feito: m[2].toLowerCase() === 'x',
      ...analisarTexto(m[3]),
    });
  }
  return lista;
}

function ler() {
  garantir();
  const { linhas, texto } = md.ler(ARQUIVO);
  const todos = itens(linhas);
  const feitos = todos.filter((x) => x.feito)
    .sort((a, b) => String(b.feitoEm || '').localeCompare(String(a.feitoEm || '')));
  return {
    arquivo: 'memoria/cronograma.md',
    versao: md.versao(texto),
    // tarefa sem marcar vale como pendente, mesmo se ficou na seção errada
    tarefas: todos.filter((x) => !x.feito && x.secao !== 'decisoes'),
    decisoes: todos.filter((x) => !x.feito && x.secao === 'decisoes'),
    feitos,
  };
}

function acharLinha(linhas, id) {
  const at = md.ativas(linhas);
  const i = linhas.findIndex((l, n) => at[n] && l.trim() === String(id || '').trim());
  if (i < 0) throw new ErroPainel(MUDOU, 409);
  return i;
}

function agir(dados = {}) {
  garantir();
  const { linhas, eol } = md.ler(ARQUIVO);
  const texto = md.limparValor(dados.texto);

  switch (dados.acao) {
    case 'adicionar': {
      if (!texto) throw new ErroPainel('Escreva o que precisa fazer.');
      const linha = `- [ ] ${montarTexto({ texto, data: dados.data || null, areas: dados.areas || [] })}`;
      md.inserirNaSecao(linhas, dados.tipo === 'decisao' ? 'Decisões pra tomar' : 'A fazer', [linha]);
      break;
    }
    case 'concluir': {
      const i = acharLinha(linhas, dados.id);
      const m = RE_TAREFA.exec(linhas[i]);
      const info = analisarTexto(m[3]);
      linhas.splice(i, 1);
      md.inserirNaSecao(linhas, 'Feito', [`- [x] ${montarTexto({ ...info, feitoEm: agoraISO() })}`], { topo: true });
      break;
    }
    case 'desfazer': {
      const i = acharLinha(linhas, dados.id);
      const m = RE_TAREFA.exec(linhas[i]);
      const info = analisarTexto(m[3]);
      linhas.splice(i, 1);
      md.inserirNaSecao(linhas, 'A fazer', [`- [ ] ${montarTexto({ ...info, feitoEm: null })}`]);
      break;
    }
    case 'editar': {
      if (!texto) throw new ErroPainel('A tarefa não pode ficar vazia.');
      const i = acharLinha(linhas, dados.id);
      const m = RE_TAREFA.exec(linhas[i]);
      const info = analisarTexto(m[3]);
      linhas[i] = `${m[1]}- [${m[2]}] ${montarTexto({ texto, data: dados.data || null, areas: dados.areas || [], feitoEm: info.feitoEm })}`;
      break;
    }
    case 'apagar': {
      const i = acharLinha(linhas, dados.id);
      linhas.splice(i, 1);
      break;
    }
    default:
      throw new ErroPainel('Ação desconhecida.');
  }

  md.gravar(ARQUIVO, linhas, eol);
  return ler();
}

module.exports = { ler, agir, ARQUIVO };
