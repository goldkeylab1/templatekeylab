// Saídas: o que a IA criou (saidas/), com o texto pronto pra copiar.
import { h, ic, api, falhou, cabeca, copiar, chave, vazio, pedido, dataCurta, pedirIA } from '../ui.js';

const filtro = { pasta: '', texto: '' };

function nomeDaPasta(p) {
  return p ? p.charAt(0).toUpperCase() + p.slice(1).replace(/[-_]+/g, ' ') : 'Soltos';
}

async function copiarTexto(s) {
  try {
    const r = await api(`/api/saidas/texto?caminho=${encodeURIComponent(s.caminho)}`);
    await copiar(r.texto, 'Copiado. É só colar onde for usar.');
  } catch (e) { falhou(e); }
}

function cartao(s) {
  return h('article', { class: 'registro saida' },
    h('div', { class: 'topo-reg' },
      h('h3', null, h('a', { href: `#/arquivo?c=${encodeURIComponent(s.caminho)}`, style: 'text-decoration:none' }, s.titulo))),
    s.resumo ? h('div', { class: 'pensar saida-resumo' }, s.resumo) : null,
    h('div', { class: 'chips' },
      h('span', { class: 'chip' }, ic('calendario'), dataCurta(s.data)),
      s.pasta ? h('span', { class: 'chip' }, nomeDaPasta(s.pasta)) : null,
      h('span', { class: 'chip' }, `${s.palavras} ${s.palavras === 1 ? 'palavra' : 'palavras'}`)),
    h('div', { class: 'rodape-reg' },
      h('button', { type: 'button', class: 'botao principal pequeno', onclick: () => copiarTexto(s) }, ic('copiar'), 'Copiar o texto'),
      h('a', { class: 'botao leve pequeno', href: `#/arquivo?c=${encodeURIComponent(s.caminho)}` }, ic('olho'), 'Ver'),
      h('button', {
        type: 'button',
        class: 'botao leve pequeno',
        onclick: () => pedirIA(`Melhore o texto de ${s.caminho} seguindo a voz da marca (negocio/voz.md). Salve como uma versão nova na mesma pasta.`),
      }, ic('ia'), 'Melhorar com a IA')));
}

export async function montar(alvo, ctx) {
  const d = await api('/api/saidas');
  if (filtro.pasta && filtro.pasta !== '-' && !d.pastas.includes(filtro.pasta)) filtro.pasta = '';

  alvo.append(cabeca({
    titulo: 'Saídas',
    texto: 'O que a IA criou pra você: roteiros, legendas, propostas, relatórios. Copie e use.',
    acoes: [h('a', { class: 'botao', href: `#/arquivo?c=${encodeURIComponent('saidas/LEIA-ME.md')}` }, ic('texto'), 'Como funciona')],
  }));

  if (!d.saidas.length) {
    alvo.append(h('section', { class: 'painel vidro' }, vazio({
      titulo: 'Nada criado ainda',
      texto: 'Quando a IA escrever um roteiro, uma legenda ou uma proposta, ele aparece aqui.',
      pedido: 'Escreva um roteiro sobre: ',
    })));
    return { titulo: 'Saídas' };
  }

  const lista = h('div', { class: 'grade-cartoes' });
  const nada = h('p', { class: 'fraco', hidden: true, style: 'margin:0' }, 'Nada com esse filtro.');
  const desenhar = () => {
    const termos = chave(filtro.texto).split(' ').filter(Boolean);
    const itens = d.saidas.filter((s) => {
      if (filtro.pasta === '-' && s.pasta) return false;
      if (filtro.pasta && filtro.pasta !== '-' && s.pasta !== filtro.pasta) return false;
      const alvoBusca = chave(`${s.titulo} ${s.resumo} ${s.pasta} ${s.caminho}`);
      return termos.every((t) => alvoBusca.includes(t));
    });
    lista.replaceChildren(...itens.map(cartao));
    nada.hidden = itens.length > 0;
  };

  const busca = h('input', {
    class: 'entrada',
    type: 'search',
    placeholder: 'Procurar nas saídas',
    'aria-label': 'Procurar nas saídas',
    value: filtro.texto,
    oninput: (e) => { filtro.texto = e.target.value; desenhar(); },
  });
  const temSoltos = d.saidas.some((s) => !s.pasta);
  const grupos = [['', 'Todas', d.saidas.length], ...d.pastas.map((p) => [p, nomeDaPasta(p), d.saidas.filter((s) => s.pasta === p).length])];
  if (temSoltos && d.pastas.length) grupos.push(['-', 'Soltos', d.saidas.filter((s) => !s.pasta).length]);
  const abas = h('div', { class: 'abas', role: 'tablist', style: 'margin:0' }, grupos.map(([valor, nome, n]) => h('button', {
    type: 'button',
    class: 'aba',
    role: 'tab',
    'aria-selected': String(filtro.pasta === valor),
    onclick: (e) => {
      filtro.pasta = valor;
      abas.querySelectorAll('.aba').forEach((b) => b.setAttribute('aria-selected', String(b === e.currentTarget)));
      desenhar();
    },
  }, nome, h('span', { class: 'n' }, String(n)))));

  alvo.append(h('section', { class: 'painel vidro' },
    h('div', { class: 'painel-cabeca' }, grupos.length > 1 ? abas : h('h2', null, `Tudo (${d.saidas.length})`), h('div', { class: 'busca', style: 'margin:0;flex:0 1 280px' }, ic('busca'), busca)),
    lista,
    nada));
  desenhar();

  alvo.append(h('section', { class: 'painel vidro' },
    h('h2', null, 'Peça pra IA'),
    h('div', { class: 'pedidos', style: 'margin-top:12px' },
      pedido('Escreva um roteiro sobre: '),
      pedido('Escreva a legenda do post sobre: '),
      pedido('Faça uma proposta pro cliente: '))));

  return {
    titulo: 'Saídas',
    podeRecarregar: () => !(document.activeElement === busca && busca.value),
  };
}
