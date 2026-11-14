// Frases pra repetir (mentalidade/frases.md): a frase de hoje, as minhas e todas, por tema.
// Dá pra escrever as suas e pedir pra IA criar frases a partir do sonho e das crenças.
import { h, ic, api, aviso, falhou, cabeca, confirmar, copiar, pedirIA, temChat } from '../ui.js';

// Um ícone pra cada tema ("## Tema" no frases.md). Tema novo sem ícone usa a estrela.
const ICONE_DO_TEMA = {
  'prosperidade e dinheiro': 'dinheiro',
  prosperidade: 'dinheiro',
  merecimento: 'coracao',
  'clareza e confianca': 'bussola',
  'coragem e acao': 'foguete',
  'saude e energia': 'raio',
  'familia e amor': 'pessoas',
  'gratidao e bom coracao': 'maos',
  'bom coracao': 'maos',
  'paz e fe': 'sol',
};
const filtro = { tema: '' };

const chaveDoTema = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const iconeDoTema = (t) => ICONE_DO_TEMA[chaveDoTema(t)] || 'estrela';

export const CRIAR_FRASES = 'Crie 5 frases pra eu repetir todo dia, feitas pra mim. Leia o meu sonho (mentalidade/meus-sonhos.md) '
  + 'e as minhas crenças (mentalidade/crencas.md). Frases curtas, no presente, na primeira pessoa e com palavras simples. '
  + 'Me mostre as 5 e, nas que eu escolher, anote em mentalidade/frases.md, em "As minhas".';

async function agir(dados, ctx, msg, depois) {
  try {
    await api('/api/frases', dados);
    if (depois) depois();
    if (msg) aviso(msg);
    await ctx.recarregar({ silencioso: true });
    return true;
  } catch (e) { falhou(e); return false; }
}

function itemDaFrase(texto, acoes) {
  return h('li', { class: 'frase-item' },
    h('span', { class: 'frase-item-ico' }, ic('aspas')),
    h('span', { class: 'frase-item-texto' }, texto),
    acoes ? h('div', { class: 'frase-item-acoes' }, acoes) : null);
}

function formulario(ctx) {
  const entrada = h('textarea', {
    class: 'entrada frase-entrada',
    rows: '2',
    maxlength: '220',
    placeholder: 'Ex.: Eu sou capaz, e cada dia eu provo isso.',
    'aria-label': 'A minha frase',
    onkeydown: (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } },
  });
  const form = h('form', {
    class: 'frase-form',
    onsubmit: async (e) => {
      e.preventDefault();
      if (!entrada.value.trim()) { entrada.focus(); return; }
      await agir({ acao: 'adicionar', texto: entrada.value }, ctx, 'Frase guardada. Ela vai aparecer dia sim, dia não.', () => {
        entrada.value = '';
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      });
    },
  },
  entrada,
  h('p', { class: 'fraco pequeno', style: 'margin:8px 0 0' }, 'Curta, no presente e na primeira pessoa: "Eu sou...", "Eu tenho...", "Eu faço...".'),
  h('div', { class: 'chips', style: 'margin-top:12px' },
    h('button', { type: 'submit', class: 'botao principal' }, ic('mais'), 'Guardar a minha frase')));
  form.entrada = entrada;
  return form;
}

export async function montar(alvo, ctx) {
  const d = await api('/api/frases');
  if (!d) {
    alvo.append(h('p', { class: 'fraco' }, 'A pasta mentalidade/ não tem o frases.md.'));
    return { titulo: 'Frases pra repetir' };
  }

  alvo.append(cabeca({
    titulo: 'Frases pra repetir',
    texto: 'O que você diz pra você mesmo, todo dia, vira o que você acredita. Uma frase aparece por dia no painel: leia em voz alta, devagar, três vezes.',
    volta: { href: '#/area/mentalidade', texto: 'Mentalidade' },
    acoes: [h('a', { class: 'botao leve', href: `#/arquivo?c=${encodeURIComponent(d.arquivo)}` }, ic('texto'), 'Abrir o arquivo')],
  }));

  // A de hoje
  if (d.hoje) {
    alvo.append(h('section', { class: 'painel frase-card frase-hoje vidro' },
      h('span', { class: 'frase-aspas' }, ic('aspas')),
      h('div', null,
        h('div', { class: 'sonho-rotulo' }, d.hoje.minha ? 'A frase de hoje · uma das suas' : 'A frase de hoje'),
        h('p', { class: 'frase-texto' }, d.hoje.texto),
        h('div', { class: 'chips', style: 'margin-top:10px' },
          h('button', { type: 'button', class: 'botao leve pequeno', onclick: () => copiar(d.hoje.texto, 'Frase copiada.') }, ic('copiar'), 'Copiar')))));
  }

  // Escrever a minha e pedir pra IA
  const form = formulario(ctx);
  alvo.append(h('div', { class: 'grade-2 mentalidade-grade', style: 'margin-top:18px' },
    h('section', { class: 'painel vidro', id: 'escrever-frase' },
      h('div', { class: 'painel-cabeca' }, h('div', null,
        h('h2', null, 'Escrever a minha frase'),
        h('p', { class: 'suave pequeno', style: 'margin:4px 0 0' }, 'As suas têm mais força: elas falam da sua vida.'))),
      form),
    h('section', { class: 'painel descobrir-card' },
      h('span', { class: 'descobrir-ico' }, ic('ia')),
      h('h2', null, 'Frases feitas pra você'),
      h('p', null, 'A IA lê o seu sonho e as suas crenças, e cria frases curtas pra você repetir. Você escolhe as que tocarem e ela guarda nas suas.'),
      h('button', { type: 'button', class: 'botao principal', onclick: () => pedirIA(CRIAR_FRASES) }, ic('ia'), temChat() ? 'Criar frases pra mim' : 'Copiar o pedido'))));

  // As minhas
  alvo.append(h('section', { class: 'painel vidro', style: 'margin-top:18px' },
    h('div', { class: 'painel-cabeca' },
      h('div', null, h('h2', null, `As minhas${d.minhas.length ? ` (${d.minhas.length})` : ''}`), h('p', { class: 'suave pequeno', style: 'margin:4px 0 0' }, 'Aparecem como frase do dia em dia sim, dia não.'))),
    d.minhas.length
      ? h('ul', { class: 'frases-lista' }, d.minhas.map((f) => itemDaFrase(f.texto, [
        h('button', {
          type: 'button',
          class: 'icone-botao',
          title: 'Apagar',
          'aria-label': `Apagar a frase: ${f.texto}`,
          onclick: async () => { if (await confirmar(`Apagar a frase "${f.texto}"?`, { sim: 'Apagar' })) agir({ acao: 'apagar', id: f.id }, ctx, 'Apagada.'); },
        }, ic('lixo'))])))
      : h('div', { class: 'vazio' },
        h('h3', null, 'Ainda nenhuma'),
        h('p', null, 'Escreva acima a primeira, ou peça pra IA criar frases a partir do seu sonho.'))));

  // Todas, por tema
  if (d.temas.length) {
    const totalPack = d.temas.reduce((n, t) => n + t.frases.length, 0);
    if (filtro.tema && !d.temas.some((t) => t.titulo === filtro.tema)) filtro.tema = '';
    const lista = h('div', { class: 'temas-crencas' });
    const desenhar = () => {
      lista.replaceChildren(...d.temas.filter((t) => !filtro.tema || t.titulo === filtro.tema).map((t) => h('div', { class: 'tema-crencas' },
        h('h3', { class: 'tema-titulo' },
          h('span', { class: 'tema-ico' }, ic(iconeDoTema(t.titulo))),
          t.titulo,
          h('span', { class: 'conta' }, String(t.frases.length))),
        h('ul', { class: 'frases-lista' }, t.frases.map((f) => itemDaFrase(f.texto))))));
    };
    const abas = h('div', { class: 'abas filtro-temas', role: 'tablist' },
      [['', 'Todas', totalPack], ...d.temas.map((t) => [t.titulo, t.titulo, t.frases.length])].map(([valor, nome, n]) => h('button', {
        type: 'button',
        class: 'aba',
        role: 'tab',
        'aria-selected': String(filtro.tema === valor),
        onclick: (e) => {
          filtro.tema = valor;
          abas.querySelectorAll('.aba').forEach((b) => b.setAttribute('aria-selected', String(b === e.currentTarget)));
          desenhar();
        },
      }, valor ? ic(iconeDoTema(valor)) : null, nome, h('span', { class: 'n' }, String(n)))));
    desenhar();
    alvo.append(h('section', { class: 'painel vidro', style: 'margin-top:18px' },
      h('div', { class: 'painel-cabeca' },
        h('div', null, h('h2', null, `Todas as frases (${totalPack})`), h('p', { class: 'suave pequeno', style: 'margin:4px 0 0' }, 'Uma por dia, em rodízio. Leia as que mais precisar hoje.'))),
      abas,
      lista));
  }

  return {
    titulo: 'Frases pra repetir',
    depois: () => {
      if (ctx.rota && ctx.rota.params.get('escrever')) {
        setTimeout(() => {
          document.getElementById('escrever-frase')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => form.entrada.focus({ preventScroll: true }), 350);
        }, 60);
      }
    },
    podeRecarregar: () => !form.entrada.value.trim(),
  };
}
