// Testes (marketing/testes.md): os abertos com quantos dias faltam, julgar com o número e o que virou regra.
import { h, ic, api, aviso, falhou, cabeca, janela, confirmar, copiar, chave, vazio, pedido, barra, hoje, somarDias, dataDe, dataCurta, pedirIA, temChat } from '../ui.js';

const DECISOES = ['virou regra', 'não funciona', 'testar de novo'];

function dias(de, ate) {
  return Math.round((dataDe(ate) - dataDe(de)) / 86400000);
}

async function agir(dados, ctx, msg) {
  try {
    const r = await api('/api/testes', dados);
    if (msg) aviso(msg);
    await ctx.recarregar({ silencioso: true });
    return r;
  } catch (e) {
    falhou(e);
    await ctx.recarregar({ silencioso: true });
    return null;
  }
}

function prazoDoTeste(t) {
  const hj = hoje();
  if (!t.julgar) return { texto: 'sem dia de julgar', alerta: false, pct: 0 };
  const faltam = dias(hj, t.julgar);
  const total = t.comecou ? Math.max(1, dias(t.comecou, t.julgar)) : 0;
  const pct = total ? Math.max(0, Math.min(100, Math.round(((total - Math.max(faltam, 0)) / total) * 100))) : 0;
  if (faltam < 0) return { texto: `passou ${-faltam} ${faltam === -1 ? 'dia' : 'dias'}`, alerta: true, pct: 100 };
  if (faltam === 0) return { texto: 'julgar hoje', alerta: true, pct: 100 };
  return { texto: `faltam ${faltam} ${faltam === 1 ? 'dia' : 'dias'}`, alerta: false, pct };
}

async function julgar(t, ctx) {
  let decisao = '';
  const resultado = h('textarea', { class: 'entrada', rows: '3', placeholder: 'Ex.: a retenção foi de 61% pra 70% nos 5 vídeos do teste.', 'aria-label': 'Resultado' });
  const botoes = h('div', { class: 'segmentado', role: 'group', 'aria-label': 'Decisão' }, DECISOES.map((d) => h('button', {
    type: 'button',
    'aria-pressed': 'false',
    onclick: (e) => {
      decisao = d;
      botoes.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
    },
  }, d)));
  const corpo = h('div', null,
    t.hipotese ? h('p', { class: 'suave', style: 'margin:0 0 12px' }, t.hipotese) : null,
    t.numero ? h('p', { class: 'pequeno', style: 'margin:0 0 14px' }, h('b', null, 'Número que julga: '), t.numero, t.comparar ? h('span', { class: 'fraco' }, ` (comparar com ${t.comparar})`) : null) : null,
    h('div', { class: 'campo-janela' }, h('label', { class: 'rotulo' }, 'O que o número mostrou?'), resultado),
    h('div', { class: 'campo-janela' }, h('label', { class: 'rotulo' }, 'E agora?'), botoes));
  const r = await janela({
    titulo: `Julgar: ${t.titulo}`,
    corpo,
    botoes: [
      { texto: 'Cancelar', valor: null },
      {
        texto: 'Fechar o teste',
        principal: true,
        antes: () => {
          if (!resultado.value.trim()) { aviso('Escreva o resultado, com o número.', { erro: true }); resultado.focus(); return false; }
          if (!decisao) { aviso('Escolha a decisão.', { erro: true }); return false; }
          return true;
        },
        valor: () => ({ resultado: resultado.value, decisao }),
      },
    ],
  });
  if (!r) return;
  const ok = await agir({ acao: 'fechar', titulo: t.titulo, linha: t.linha, ...r }, ctx);
  if (!ok) return;
  if (chave(r.decisao) === 'virou regra') {
    aviso('Teste fechado. Agora peça pra IA guardar a regra.', {
      tempo: 9000,
      acao: { texto: 'Copiar o pedido', fazer: () => pedirIA(`O teste "${t.titulo}" virou regra (marketing/testes.md). Resultado: ${r.resultado}. Anote em marketing/o-que-funciona.md, na parte certa da fórmula, com a prova.`) },
    });
  } else if (chave(r.decisao) === 'nao funciona') {
    aviso('Teste fechado. Saber o que não funciona também vale.', {
      tempo: 9000,
      acao: { texto: 'Copiar o pedido', fazer: () => pedirIA(`O teste "${t.titulo}" não funcionou (marketing/testes.md). Resultado: ${r.resultado}. Anote em "Não funciona" no marketing/o-que-funciona.md e me sugira o próximo teste.`) },
    });
  } else {
    aviso('Teste fechado.');
  }
}

function cartaoAberto(t, ctx) {
  const p = prazoDoTeste(t);
  return h('article', { class: 'registro' },
    h('div', { class: 'topo-reg' },
      h('h3', null, t.titulo),
      h('button', {
        type: 'button',
        class: 'icone-botao',
        title: 'Apagar',
        'aria-label': `Apagar o teste ${t.titulo}`,
        onclick: async () => { if (await confirmar(`Apagar o teste "${t.titulo}"?`, { sim: 'Apagar' })) agir({ acao: 'apagar', titulo: t.titulo, linha: t.linha }, ctx, 'Apagado.'); },
      }, ic('lixo'))),
    h('div', { class: 'chips' }, h('span', { class: `chip${p.alerta ? ' rosa' : ''}` }, ic('relogio'), p.texto)),
    t.hipotese ? h('div', { class: 'disse' }, t.hipotese) : null,
    t.muda ? h('div', { class: 'pensar' }, h('b', null, 'Muda: '), t.muda) : null,
    t.numero ? h('div', { class: 'pensar' }, h('b', null, 'Número que julga: '), t.numero) : null,
    t.julgar ? h('div', null,
      barra(p.pct),
      h('div', { class: 'fraco pequeno', style: 'display:flex;justify-content:space-between;margin-top:4px' },
        h('span', null, t.comecou ? `começou ${dataCurta(t.comecou)}` : ''),
        h('span', null, `julgar ${dataCurta(t.julgar)}`))) : null,
    h('div', { class: 'rodape-reg' },
      h('button', { type: 'button', class: `botao pequeno${p.alerta ? ' principal' : ''}`, onclick: () => julgar(t, ctx) }, ic('check'), 'Julgar'),
      h('button', {
        type: 'button',
        class: 'botao leve pequeno',
        onclick: () => pedirIA(`Julgue o teste "${t.titulo}" (marketing/testes.md) com os meus números. Número que julga: ${t.numero || 'o do teste'}. Diga o resultado, a decisão e, se virou regra, anote em marketing/o-que-funciona.md.`),
      }, ic('ia'), 'Julgar com a IA')));
}

function cartaoFechado(t) {
  const k = chave(t.decisao);
  const classe = k === 'virou regra' ? 'chip cheio' : k === 'testar de novo' ? 'chip rosa' : 'chip';
  return h('article', { class: 'registro' },
    h('div', { class: 'topo-reg' }, h('h3', null, t.titulo), t.decisao ? h('span', { class: classe }, t.decisao) : null),
    t.resultado ? h('div', { class: 'disse' }, t.resultado) : h('div', { class: 'fraco pequeno' }, 'Sem resultado anotado.'),
    t.hipotese ? h('div', { class: 'pensar' }, t.hipotese) : null,
    t.julgar ? h('div', { class: 'fraco pequeno' }, `Julgado em ${dataCurta(t.julgar)}`) : null);
}

function formulario(ctx) {
  const nome = h('input', { class: 'entrada', type: 'text', placeholder: 'Ex.: Gancho com pergunta', 'aria-label': 'Nome do teste' });
  const hipotese = h('input', { class: 'entrada', type: 'text', placeholder: 'Se eu mudar X, o número Y melhora', 'aria-label': 'Hipótese' });
  const muda = h('input', { class: 'entrada', type: 'text', placeholder: 'Só UMA coisa', 'aria-label': 'O que muda' });
  const numero = h('input', { class: 'entrada', type: 'text', placeholder: 'Ex.: views em 24 h, retenção, vendas', 'aria-label': 'Número que julga' });
  const quando = h('input', { class: 'entrada', type: 'date', value: somarDias(hoje(), 14), 'aria-label': 'Julgar em' });
  const campo = (rotulo, el) => h('div', { class: 'campo-janela' }, h('label', { class: 'rotulo' }, rotulo), el);
  return h('form', {
    class: 'pilha form-teste',
    onsubmit: async (e) => {
      e.preventDefault();
      if (!nome.value.trim()) { nome.focus(); return; }
      if (!numero.value.trim()) { numero.focus(); aviso('Diga qual número vai julgar o teste.', { erro: true }); return; }
      await agir({ acao: 'adicionar', titulo: nome.value, hipotese: hipotese.value, muda: muda.value, numero: numero.value, julgar: quando.value }, ctx, 'Teste anotado. O dia de julgar já está no Dashboard.');
    },
  },
  campo('Nome', nome),
  campo('Hipótese', hipotese),
  campo('O que muda', muda),
  campo('Número que julga', numero),
  campo('Julgar em', quando),
  h('div', null, h('button', { type: 'submit', class: 'botao principal' }, ic('mais'), 'Começar o teste')));
}

export async function montar(alvo, ctx) {
  const d = await api('/api/testes');
  const hj = hoje();
  const praJulgar = d.abertos.filter((t) => t.julgar && t.julgar <= hj).length;
  const regras = d.fechados.filter((t) => chave(t.decisao) === 'virou regra').length;
  const naoFunciona = d.fechados.filter((t) => chave(t.decisao) === 'nao funciona').length;

  alvo.append(cabeca({
    titulo: 'Testes',
    texto: 'Um teste muda uma coisa e mede um número. É assim que uma ideia vira regra.',
    volta: { href: '#/area/marketing', texto: 'Marketing' },
    acoes: [h('a', { class: 'botao', href: `#/arquivo?c=${encodeURIComponent(d.arquivo)}` }, ic('texto'), 'Abrir o arquivo')],
  }));

  alvo.append(h('div', { class: 'numeros' },
    h('div', { class: 'numero vidro' }, h('div', { class: 'valor' }, String(d.abertos.length)), h('div', { class: 'nome' }, 'Rodando')),
    h('div', { class: `numero vidro${praJulgar ? ' alerta' : ''}` }, h('div', { class: 'valor' }, String(praJulgar)), h('div', { class: 'nome' }, 'Pra julgar')),
    h('div', { class: 'numero vidro' }, h('div', { class: 'valor' }, String(regras)), h('div', { class: 'nome' }, 'Viraram regra')),
    h('div', { class: 'numero vidro' }, h('div', { class: 'valor' }, String(naoFunciona)), h('div', { class: 'nome' }, 'Não funcionaram'))));

  const abertos = [...d.abertos].sort((a, b) => String(a.julgar || '9').localeCompare(String(b.julgar || '9')));
  const esquerda = h('div', { class: 'pilha' },
    h('section', { class: 'painel vidro' },
      h('div', { class: 'painel-cabeca' }, h('h2', null, 'Rodando agora')),
      abertos.length
        ? h('div', { class: 'grade-cartoes' }, abertos.map((t) => cartaoAberto(t, ctx)))
        : vazio({ titulo: 'Nenhum teste rodando', texto: 'Comece um ao lado, ou peça pra IA sugerir o próximo.', pedido: 'Qual teste eu faço agora? Olhe os meus números e o o-que-funciona.md.' })),
    h('section', { class: 'painel vidro' },
      h('div', { class: 'painel-cabeca' }, h('h2', null, `Fechados (${d.fechados.length})`)),
      d.fechados.length
        ? h('div', { class: 'grade-cartoes' }, d.fechados.map(cartaoFechado))
        : h('p', { class: 'fraco pequeno', style: 'margin:0' }, 'Quando você julgar um teste, ele vem pra cá.')));

  const direita = h('div', { class: 'pilha' },
    h('section', { class: 'painel vidro' }, h('div', { class: 'painel-cabeca' }, h('h2', null, 'Novo teste')), formulario(ctx)),
    h('section', { class: 'painel vidro' },
      h('h2', null, 'Peça pra IA'),
      h('p', { class: 'suave pequeno', style: 'margin:6px 0 12px' }, temChat() ? 'Clique e a IA faz, no chat do lado.' : 'Clique pra copiar e cole na sua IA.'),
      h('div', { class: 'pedidos' },
        pedido('Qual teste eu faço agora? Olhe os meus números e o o-que-funciona.md.'),
        pedido('Transforme esta ideia num teste (uma mudança, um número): '))));

  alvo.append(h('div', { class: 'grade-2' }, esquerda, direita));

  return {
    titulo: 'Testes',
    podeRecarregar: () => {
      const foco = document.activeElement;
      return !(foco && foco.closest && foco.closest('#tela') && /^(INPUT|TEXTAREA)$/.test(foco.tagName) && foco.value && foco.type !== 'date');
    },
  };
}
