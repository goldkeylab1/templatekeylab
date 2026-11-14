// Diário (mentalidade/diario.md): escrever, editar e apagar notas, organizadas por data.
// A nota é texto livre (quanto quiser), com a data de hoje já marcada (dá pra escolher outra).
// O bloco do diário também aparece na tela da Mentalidade (com as últimas notas).
import { h, ic, api, aviso, falhou, cabeca, confirmar } from '../ui.js';

const RASCUNHO = 'keylab-diario-rascunho';
const CAMPOS = [
  { chave: 'agradeco', rotulo: 'Agradeço por', icone: 'coracao' },
  { chave: 'ajudei', rotulo: 'Hoje eu ajudei', icone: 'maos' },
  { chave: 'vitoria', rotulo: 'Vitória do dia', icone: 'trofeu' },
  { chave: 'passo', rotulo: 'Passo rumo ao sonho', icone: 'passos' },
];

const lerRascunho = () => { try { return JSON.parse(localStorage.getItem(RASCUNHO) || 'null'); } catch { return null; } };
const gravarRascunho = (r) => { try { if (r) localStorage.setItem(RASCUNHO, JSON.stringify(r)); else localStorage.removeItem(RASCUNHO); } catch { /* sem guardar */ } };

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dataLonga(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-').map(Number);
  const t = new Date(a, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function quando(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-').map(Number);
  const hoje = new Date();
  const dias = Math.round((new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()) - new Date(a, m - 1, d)) / 86400000);
  if (dias === 0) return 'Hoje';
  if (dias === 1) return 'Ontem';
  if (dias === -1) return 'Amanhã';
  return '';
}

const ajustar = (t) => { t.style.height = 'auto'; t.style.height = `${t.scrollHeight + 2}px`; };

// Põe "Agradeço por: " numa linha nova, onde o cursor estiver
function inserirInicio(t, rotulo) {
  const pos = t.selectionStart ?? t.value.length;
  const antes = t.value.slice(0, pos);
  const depois = t.value.slice(pos);
  const prefixo = antes && !antes.endsWith('\n') ? '\n' : '';
  const novo = `${prefixo}${rotulo}: `;
  t.value = antes + novo + depois;
  const fim = antes.length + novo.length;
  t.focus();
  t.setSelectionRange(fim, fim);
  t.dispatchEvent(new Event('input'));
}

// O formulário: escrever uma nota nova ou editar uma que já existe
function formulario({ nota = null, aoSalvar, aoCancelar }) {
  const rascunho = nota ? null : lerRascunho();
  const data = h('input', { class: 'entrada diario-data-entrada', type: 'date', value: nota ? (nota.iso || hojeISO()) : (rascunho?.data || hojeISO()), max: '2200-12-31', 'aria-label': 'A data da nota', required: true });
  const texto = h('textarea', {
    class: 'entrada diario-texto',
    rows: nota ? '4' : '5',
    placeholder: 'Como foi o seu dia? O que você agradece, quem você ajudou, o que deu certo, o que você sentiu... Escreva o quanto quiser.',
    'aria-label': 'O texto da nota',
    oninput: () => { ajustar(texto); if (!nota) gravarRascunho(texto.value.trim() ? { data: data.value, texto: texto.value } : null); },
  }, nota ? nota.editavel : (rascunho?.texto || ''));
  data.addEventListener('change', () => { if (!nota && texto.value.trim()) gravarRascunho({ data: data.value, texto: texto.value }); });
  const salvar = h('button', { type: 'submit', class: 'botao principal' }, ic('check'), nota ? 'Salvar' : 'Salvar no diário');
  const form = h('form', {
    class: `diario-form${nota ? ' editando' : ''}`,
    onsubmit: async (e) => {
      e.preventDefault();
      if (!texto.value.trim()) { aviso('Escreva alguma coisa antes de salvar.', { erro: true }); texto.focus(); return; }
      salvar.disabled = true;
      const ok = await aoSalvar({ data: data.value || hojeISO(), texto: texto.value }, () => {
        if (!nota) { texto.value = ''; gravarRascunho(null); ajustar(texto); }
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      });
      if (!ok) salvar.disabled = false;
    },
  },
  h('div', { class: 'diario-form-topo' },
    h('label', { class: 'diario-data-rotulo' }, ic('calendario'), data),
    h('div', { class: 'diario-inicios', 'aria-label': 'Começar uma linha com' }, CAMPOS.slice(0, 3).map((c) => h('button', {
      type: 'button', class: 'chip-botao', title: `Começar uma linha com "${c.rotulo}:"`, onclick: () => inserirInicio(texto, c.rotulo),
    }, ic(c.icone), c.rotulo)))),
  texto,
  h('div', { class: 'chips' },
    salvar,
    nota ? h('button', { type: 'button', class: 'botao leve', onclick: aoCancelar }, 'Cancelar') : null));
  // Nota nova: o rascunho fica guardado no navegador, então só segura a tela enquanto a pessoa está escrevendo
  form.temTexto = () => (nota ? texto.value !== nota.editavel || data.value !== (nota.iso || '') : !!texto.value.trim() && form.contains(document.activeElement));
  form.depois = () => ajustar(texto);
  return form;
}

function cartaoDaNota(n, ctx, estado, { curta }) {
  const campos = CAMPOS.filter((c) => n.campos && n.campos[c.chave]);
  const longa = curta && (n.texto.length > 420 || n.texto.split('\n').length > 7);
  const corpo = h('div', { class: `diario-nota-corpo${longa ? ' recolhida' : ''}` },
    n.texto ? h('p', { class: 'diario-nota-texto' }, n.texto) : null,
    campos.length ? h('div', { class: 'diario-nota-campos' }, campos.map((c) => h('div', { class: 'diario-linha' }, ic(c.icone), h('span', null, h('b', null, `${c.rotulo}: `), n.campos[c.chave])))) : null);
  const el = h('article', { class: 'diario-nota' },
    corpo,
    h('div', { class: 'diario-nota-pe' },
      longa ? h('button', {
        type: 'button',
        class: 'botao leve pequeno',
        onclick: (e) => { const r = corpo.classList.toggle('recolhida'); e.currentTarget.textContent = r ? 'Ler tudo' : 'Mostrar menos'; },
      }, 'Ler tudo') : h('span'),
      h('div', { class: 'diario-nota-acoes' },
        h('button', { type: 'button', class: 'icone-botao', title: 'Editar', 'aria-label': 'Editar esta nota', onclick: () => editar() }, ic('lapis')),
        h('button', {
          type: 'button',
          class: 'icone-botao',
          title: 'Apagar',
          'aria-label': 'Apagar esta nota',
          onclick: async () => {
            if (!(await confirmar('Apagar esta nota do diário?', { sim: 'Apagar' }))) return;
            try { await api('/api/diario', { acao: 'apagar', id: n.id }); aviso('Nota apagada.'); } catch (e) { falhou(e); }
            ctx.recarregar({ silencioso: true });
          },
        }, ic('lixo')))));
  function editar() {
    if (estado.editando) estado.editando.cancelar();
    const form = formulario({
      nota: n,
      aoSalvar: async (dados, limpar) => {
        try {
          await api('/api/diario', { acao: 'editar', id: n.id, ...dados });
          estado.editando = null;
          limpar();
          aviso('Nota salva.');
          await ctx.recarregar({ silencioso: true });
          return true;
        } catch (e) { falhou(e); return false; }
      },
      aoCancelar: () => cancelar(),
    });
    const cancelar = () => { form.replaceWith(el); estado.editando = null; };
    estado.editando = { cancelar, form };
    el.replaceWith(form);
    form.depois();
    form.querySelector('textarea').focus();
  }
  return el;
}

function listaPorDia(notas, ctx, estado, opcoes) {
  const dias = [];
  for (const n of notas) {
    const chave = n.iso || n.titulo;
    let d = dias.find((x) => x.chave === chave);
    if (!d) { d = { chave, iso: n.iso, titulo: n.titulo, notas: [] }; dias.push(d); }
    d.notas.push(n);
  }
  return h('div', { class: 'diario-dias' }, dias.map((d) => h('section', { class: 'diario-dia' },
    h('h3', { class: 'diario-dia-titulo' },
      h('span', null, d.iso ? dataLonga(d.iso) : d.titulo),
      quando(d.iso) ? h('span', { class: 'chip' }, quando(d.iso)) : null),
    d.notas.map((n) => cartaoDaNota(n, ctx, estado, opcoes)))));
}

// O bloco inteiro: escrever + as notas. `d` = { notas, total }; `limite` mostra só as últimas.
export function blocoDoDiario(d, ctx, { limite = 0 } = {}) {
  const estado = { editando: null };
  const form = formulario({
    aoSalvar: async (dados, limpar) => {
      try {
        await api('/api/diario', { acao: 'adicionar', ...dados });
        limpar();
        aviso(dados.data === hojeISO() ? 'Guardado no diário. Que dia bom de lembrar.' : 'Guardado no diário, na data que você escolheu.');
        await ctx.recarregar({ silencioso: true });
        return true;
      } catch (e) { falhou(e); return false; }
    },
  });
  const notas = limite ? d.notas.slice(0, limite) : d.notas;
  const el = h('div', { class: 'diario-bloco' },
    h('section', { class: 'painel vidro diario-escrever' },
      h('div', { class: 'painel-cabeca' },
        h('div', null, h('h2', null, 'Escrever no diário'), h('p', { class: 'suave pequeno', style: 'margin:4px 0 0' }, 'A data de hoje já vem marcada. Quer outra? É só trocar.'))),
      form),
    notas.length
      ? listaPorDia(notas, ctx, estado, { curta: !!limite })
      : h('div', { class: 'vazio diario-vazio' }, ic('livro'), h('h3', null, 'O seu diário ainda está em branco'), h('p', null, 'Escreva acima a primeira nota. Pode ser uma coisa pequena: um agradecimento, uma ajuda, uma vitória.')),
    limite && d.total > notas.length
      ? h('a', { class: 'botao leve diario-ver-tudo', href: '#/diario' }, ic('livro'), `Ver o diário inteiro (${d.total} notas)`)
      : null);
  el.temMudancas = () => form.temTexto() || !!(estado.editando && estado.editando.form.temTexto());
  el.depois = () => form.depois();
  return el;
}

export async function montar(alvo, ctx) {
  const d = await api('/api/diario');
  if (!d) {
    alvo.append(h('p', { class: 'fraco' }, 'A pasta mentalidade/ não tem o diario.md.'));
    return { titulo: 'Diário' };
  }
  alvo.append(cabeca({
    titulo: 'Diário',
    texto: `Gratidão, boas ações, vitórias e o que mais você quiser guardar. ${d.total ? `${d.total} ${d.total === 1 ? 'nota' : 'notas'}, a mais nova em cima.` : ''}`,
    volta: { href: '#/area/mentalidade', texto: 'Mentalidade' },
    acoes: [h('a', { class: 'botao leve', href: `#/arquivo?c=${encodeURIComponent(d.arquivo)}` }, ic('texto'), 'Abrir o arquivo')],
  }));
  const bloco = blocoDoDiario(d, ctx);
  alvo.append(bloco);
  return {
    titulo: 'Diário',
    depois: () => bloco.depois(),
    podeRecarregar: () => !bloco.temMudancas(),
  };
}
