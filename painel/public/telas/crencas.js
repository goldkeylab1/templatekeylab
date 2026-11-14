// Troca de crenças (mentalidade/crencas.md): as minhas e as mais comuns, em cartões "corrente → pássaro".
// Dá pra adicionar uma crença, pedir pra IA sugerir a nova e pedir ajuda pra descobrir as crenças que travam.
import { h, ic, api, aviso, falhou, cabeca, confirmar, pedirIA, temChat } from '../ui.js';

const PASSOS = [
  { icone: 'olho', titulo: 'Perceba', texto: 'Leia a crença e pergunte: isso é verdade sempre? Pra todo mundo?' },
  { icone: 'aspas', titulo: 'Diga a nova', texto: 'Leia em voz alta a crença que liberta.' },
  { icone: 'trofeu', titulo: 'Lembre uma prova', texto: 'Algo que já aconteceu com você ou com alguém que você conhece.' },
  { icone: 'passos', titulo: 'Repita 21 dias', texto: 'Um pouco todo dia, até virar o seu jeito de pensar.' },
];

// Um ícone pra cada tema ("### Tema" no crencas.md). Tema novo sem ícone usa a estrela.
const ICONE_DO_TEMA = {
  dinheiro: 'dinheiro',
  merecimento: 'coracao',
  capacidade: 'estrela',
  'trabalho e sucesso': 'trofeu',
  'tempo e oportunidades': 'relogio',
  'familia e origem': 'pessoas',
  'abundancia e generosidade': 'maos',
  'medo e mudanca': 'foguete',
};
const filtro = { tema: '' };

function chaveDoTema(t) {
  return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

const DESCOBRIR = 'Me ajude a descobrir as crenças que me travam sobre dinheiro, sucesso e merecimento. '
  + 'Faça perguntas curtas e gentis, uma de cada vez. No fim, mostre cada crença que trava com 2 sugestões de crença nova '
  + 'de prosperidade, abundância e sucesso. Anote as que eu escolher em mentalidade/crencas.md, em "As minhas".';

function pedidoDeSugestao(trava) {
  return `Tenho esta crença que me trava: "${trava}". Me ajude a entender de onde ela vem, com carinho, `
    + 'e sugira 3 crenças novas de prosperidade, abundância e sucesso pra trocar (curtas, no presente, na primeira pessoa). '
    + 'Quando eu escolher, anote a troca em mentalidade/crencas.md, em "As minhas".';
}

async function agir(dados, ctx, msg, depois) {
  try {
    await api('/api/crencas', dados);
    if (depois) depois(); // limpa o formulário antes de recarregar (a tela não recarrega com campo preenchido)
    if (msg) aviso(msg);
    await ctx.recarregar({ silencioso: true });
    return true;
  } catch (e) { falhou(e); return false; }
}

function cartao(c, acoes) {
  return h('li', { class: `troca${acoes ? ' com-acoes' : ''}` },
    h('div', { class: 'troca-trava' }, ic('corrente'), h('span', null, c.trava)),
    h('span', { class: 'troca-seta' }, ic('seta')),
    h('div', { class: 'troca-liberta' }, ic('passaro'), h('span', null, c.liberta)),
    acoes ? h('div', { class: 'troca-acoes' }, acoes) : null);
}

function formulario(ctx) {
  const trava = h('input', { class: 'entrada', type: 'text', maxlength: '240', placeholder: 'Ex.: Eu nunca vou conseguir juntar dinheiro.', 'aria-label': 'A crença que me trava' });
  const liberta = h('input', { class: 'entrada', type: 'text', maxlength: '240', placeholder: 'Ex.: Eu aprendo a cuidar do meu dinheiro, um pouco por dia.', 'aria-label': 'A crença que liberta' });
  const campo = (icone, rotulo, entrada, classe) => h('label', { class: `crenca-campo ${classe}` },
    h('span', { class: 'crenca-campo-ico' }, ic(icone)),
    h('span', { class: 'crenca-campo-corpo' }, h('span', { class: 'rotulo' }, rotulo), entrada));
  const sugerir = () => {
    const t = trava.value.trim();
    if (!t) { aviso('Escreva primeiro a crença que te trava.', { erro: true }); trava.focus(); return; }
    pedirIA(pedidoDeSugestao(t), { mensagem: 'Pedido copiado. Cole na sua IA.' });
  };
  return h('form', {
    class: 'crenca-form',
    onsubmit: async (e) => {
      e.preventDefault();
      if (!trava.value.trim()) { trava.focus(); return; }
      if (!liberta.value.trim()) { sugerir(); return; }
      await agir({ acao: 'adicionar', trava: trava.value, liberta: liberta.value }, ctx, 'Troca guardada. Leia a nova em voz alta hoje.', () => {
        trava.value = '';
        liberta.value = '';
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      });
    },
  },
  h('div', { class: 'crenca-campos' },
    campo('corrente', 'A crença que me trava', trava, 'campo-trava'),
    h('span', { class: 'crenca-seta' }, ic('seta')),
    campo('passaro', 'A crença que liberta (se você já souber)', liberta, 'campo-liberta')),
  h('div', { class: 'chips', style: 'margin-top:12px' },
    h('button', { type: 'submit', class: 'botao principal' }, ic('check'), 'Guardar a troca'),
    h('button', { type: 'button', class: 'botao', onclick: sugerir }, ic('ia'), temChat() ? 'Pedir pra IA sugerir a nova' : 'Copiar pedido: IA sugere a nova')));
}

export async function montar(alvo, ctx) {
  const d = await api('/api/crencas');
  if (!d) {
    alvo.append(h('p', { class: 'fraco' }, 'A pasta mentalidade/ não tem o crencas.md.'));
    return { titulo: 'Troca de crenças' };
  }

  alvo.append(cabeca({
    titulo: 'Troca de crenças',
    texto: 'Crença é uma ideia que a gente repete tanto que parece verdade. Algumas te seguram. Aqui você troca cada uma por outra que te liberta.',
    volta: { href: '#/area/mentalidade', texto: 'Mentalidade' },
    acoes: [h('a', { class: 'botao leve', href: `#/arquivo?c=${encodeURIComponent(d.arquivo)}` }, ic('texto'), 'Abrir o arquivo')],
  }));

  // Como trocar, em 4 passos
  alvo.append(h('ol', { class: 'passos-troca' }, PASSOS.map((p, i) => h('li', { class: 'passo-troca' },
    h('span', { class: 'passo-troca-ico' }, ic(p.icone), h('b', null, String(i + 1))),
    h('div', null, h('h3', null, p.titulo), h('p', null, p.texto))))));

  // Adicionar e descobrir
  alvo.append(h('div', { class: 'grade-2 mentalidade-grade' },
    h('section', { class: 'painel vidro' },
      h('div', { class: 'painel-cabeca' }, h('div', null,
        h('h2', null, 'Adicionar uma crença'),
        h('p', { class: 'suave pequeno', style: 'margin:4px 0 0' }, 'Escreva a crença que te trava. Não sabe a nova? A IA sugere.'))),
      formulario(ctx)),
    h('section', { class: 'painel descobrir-card' },
      h('span', { class: 'descobrir-ico' }, ic('lampada')),
      h('h2', null, 'Não sabe quais são as suas?'),
      h('p', null, 'A maioria das crenças que travam fica escondida. A IA te faz perguntas curtas, uma de cada vez, e te ajuda a enxergar. Depois sugere crenças novas de prosperidade, abundância e sucesso.'),
      h('button', { type: 'button', class: 'botao principal', onclick: () => pedirIA(DESCOBRIR) }, ic('ia'), temChat() ? 'Me ajude a descobrir' : 'Copiar o pedido'))));

  // As minhas
  alvo.append(h('section', { class: 'painel vidro crencas-card', style: 'margin-top:18px' },
    h('div', { class: 'painel-cabeca' },
      h('div', null, h('h2', null, `As minhas${d.minhas.length ? ` (${d.minhas.length})` : ''}`), h('p', { class: 'suave pequeno', style: 'margin:4px 0 0' }, 'Leia em voz alta, todo dia. A corrente vai ficando pra trás.'))),
    d.minhas.length
      ? h('ul', { class: 'trocas' }, d.minhas.map((c) => cartao(c, [
        c.data ? h('span', { class: 'fraco pequeno', title: 'Quando você trocou' }, c.data) : null,
        h('button', {
          type: 'button',
          class: 'icone-botao',
          title: 'Apagar',
          'aria-label': `Apagar a troca: ${c.trava}`,
          onclick: async () => { if (await confirmar(`Apagar a troca "${c.trava}"?`, { sim: 'Apagar' })) agir({ acao: 'apagar', id: c.id }, ctx, 'Apagada.'); },
        }, ic('lixo'))])))
      : h('div', { class: 'vazio' },
        h('h3', null, 'Ainda nenhuma'),
        h('p', null, 'Escreva acima a primeira, peça pra IA te ajudar a descobrir, ou toque em "Também tenho essa" numa das crenças comuns abaixo.'))));

  // As mais comuns, por tema
  if (d.comuns.length) {
    const minhas = new Set(d.minhas.map((c) => c.trava.toLowerCase()));
    const temas = [];
    for (const c of d.comuns) {
      const nome = c.tema || 'Outras';
      let t = temas.find((x) => x.nome === nome);
      if (!t) { t = { nome, itens: [] }; temas.push(t); }
      t.itens.push(c);
    }
    if (filtro.tema && !temas.some((t) => t.nome === filtro.tema)) filtro.tema = '';
    const lista = h('div', { class: 'temas-crencas' });
    const desenhar = () => {
      const visiveis = temas.filter((t) => !filtro.tema || t.nome === filtro.tema);
      lista.replaceChildren(...visiveis.map((t) => h('div', { class: 'tema-crencas' },
        h('h3', { class: 'tema-titulo' },
          h('span', { class: 'tema-ico' }, ic(ICONE_DO_TEMA[chaveDoTema(t.nome)] || 'estrela')),
          t.nome,
          h('span', { class: 'conta' }, String(t.itens.length))),
        h('ul', { class: 'trocas' }, t.itens.map((c) => cartao(c, [
          minhas.has(c.trava.toLowerCase())
            ? h('span', { class: 'chip' }, ic('check'), 'Nas suas')
            : h('button', { type: 'button', class: 'botao pequeno', onclick: () => agir({ acao: 'adotar', id: c.id }, ctx, 'Agora ela está nas suas.') }, ic('mais'), 'Também tenho essa')]))))));
    };
    const abas = h('div', { class: 'abas filtro-temas', role: 'tablist' },
      [['', 'Todas', d.comuns.length], ...temas.map((t) => [t.nome, t.nome, t.itens.length])].map(([valor, nome, n]) => h('button', {
        type: 'button',
        class: 'aba',
        role: 'tab',
        'aria-selected': String(filtro.tema === valor),
        onclick: (e) => {
          filtro.tema = valor;
          abas.querySelectorAll('.aba').forEach((b) => b.setAttribute('aria-selected', String(b === e.currentTarget)));
          desenhar();
        },
      }, valor ? ic(ICONE_DO_TEMA[chaveDoTema(valor)] || 'estrela') : null, nome, h('span', { class: 'n' }, String(n)))));
    desenhar();
    alvo.append(h('section', { class: 'painel vidro crencas-card', style: 'margin-top:18px' },
      h('div', { class: 'painel-cabeca' },
        h('div', null, h('h2', null, `As mais comuns (${d.comuns.length})`), h('p', { class: 'suave pequeno', style: 'margin:4px 0 0' }, 'Muita gente carrega essas. Reconheceu alguma? Traga pras suas.'))),
      abas,
      lista));
  }

  return {
    titulo: 'Troca de crenças',
    podeRecarregar: () => {
      const foco = document.activeElement;
      return !(foco && foco.closest && foco.closest('#tela') && foco.tagName === 'INPUT' && foco.value);
    },
  };
}
