// Ajuda: perguntas e respostas curtas (AJUDA.md), com busca e o pedido pronto pra IA.
import { h, ic, api, cabeca, markdown, pedido, chave } from '../ui.js';

export async function montar(alvo, ctx) {
  const { temas } = await api('/api/ajuda');
  const inicial = ctx.rota.params.get('q') || '';

  alvo.append(cabeca({ titulo: 'Ajuda', texto: 'Perguntas curtas, respostas curtas. Toda resposta tem um pedido pronto: copie e cole na sua IA.' }));

  const busca = h('input', { class: 'entrada', type: 'search', placeholder: 'Procure: github, logo, kanban, área nova...', 'aria-label': 'Procurar na ajuda', value: inicial });
  const lista = h('div');
  const nada = h('div', { class: 'vazio', hidden: true },
    h('h3', null, 'Não achei essa pergunta'),
    h('p', null, 'Pergunte pra sua IA. Ela conhece esta pasta inteira.'),
    pedido('Tenho uma dúvida sobre o meu painel e a minha pasta: '));

  const blocos = temas.map((t) => {
    const itens = t.perguntas.map((q) => {
      const det = h('details', { class: 'duvida' },
        h('summary', null, ic('seta'), q.pergunta),
        h('div', { class: 'resposta' },
          h('div', { class: 'doc', html: markdown(q.resposta) }),
          q.pedido ? h('div', { style: 'margin-top:10px' }, pedido(q.pedido)) : null));
      det.dataset.busca = chave(`${t.titulo} ${q.pergunta} ${q.resposta} ${q.pedido}`);
      return det;
    });
    const sec = h('section', { class: 'painel vidro tema-ajuda' }, h('h2', null, t.titulo), itens);
    return { sec, itens };
  });
  lista.append(...blocos.map((b) => b.sec));

  const filtrar = () => {
    const termos = chave(busca.value).split(' ').filter(Boolean);
    let achou = 0;
    for (const b of blocos) {
      let visiveis = 0;
      for (const d of b.itens) {
        const ok = termos.every((t) => d.dataset.busca.includes(t));
        d.hidden = !ok;
        if (ok) visiveis++;
        d.open = termos.length > 0 && ok && visiveis <= 3;
      }
      b.sec.hidden = visiveis === 0;
      achou += visiveis;
    }
    nada.hidden = achou > 0;
  };
  busca.addEventListener('input', filtrar);

  alvo.append(h('div', { class: 'busca' }, ic('busca'), busca), lista, nada);
  if (inicial) filtrar();

  return { titulo: 'Ajuda', depois: () => { if (!inicial) busca.focus({ preventScroll: true }); }, podeRecarregar: () => !busca.value };
}
