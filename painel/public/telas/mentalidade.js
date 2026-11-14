// Mentalidade: uma jornada, nesta ordem:
//   1. Entenda (por que começar por dentro)   2. O jeito de pensar de quem prospera   3. Troca de crenças
//   4. O seu objetivo de vida (o sonho, por área)   5. O quadro dos sonhos (o prompt pra IA de imagem e a imagem)
//   6. Todo dia (frase e prática)   7. Diário   + os arquivos, explicados
// É a tela própria da área mentalidade/ ("Tela própria" no LEIA-ME).
import { h, ic, api, aviso, falhou, confirmar, copiar, pedido, pedirIA, temChat } from '../ui.js';
import { blocoDoDiario } from './diario.js';

const ESCOLHI_MUDAR = 'keylab-escolhi-mudar';

const ICONE_DA_AREA = {
  'o meu sonho numa frase': 'montanha',
  'saude e corpo': 'raio',
  'familia e amor': 'coracao',
  'dinheiro e conquistas': 'dinheiro',
  'trabalho e proposito': 'maleta',
  'casa e lugar': 'casa',
  'experiencias e viagens': 'globo',
  'quem eu me torno': 'estrela',
  'o meu dia perfeito': 'sol',
  'o meu porque': 'alvo',
  'quando e o proximo passo': 'passos',
};

// A pergunta de cada área, sempre sobre a vida perfeita (não sobre como é hoje)
const PERGUNTA_DA_AREA = {
  'o meu sonho numa frase': 'Se a sua vida perfeita coubesse numa frase, qual seria?',
  'saude e corpo': 'Na sua versão perfeita, como é o seu corpo e a sua energia?',
  'familia e amor': 'Na vida dos seus sonhos, como são as suas relações?',
  'dinheiro e conquistas': 'Sem limites: o que você tem e quanto você ganha?',
  'trabalho e proposito': 'Como é o trabalho dos seus sonhos?',
  'casa e lugar': 'Onde e como você mora na sua vida perfeita?',
  'experiencias e viagens': 'O que você vive e quais lugares você conhece?',
  'quem eu me torno': 'Como é a melhor versão de você?',
  'o meu dia perfeito': 'Como é um dia inteiro na sua vida perfeita?',
  'o meu porque': 'Por que essa vida importa tanto pra você?',
  'quando e o proximo passo': 'E o primeiro passo, pequeno, pra começar?',
};

const ME_AJUDE_A_SONHAR = 'Me ajude a sonhar: vá área por área da minha vida (saúde e corpo, família e amor, dinheiro e conquistas, '
  + 'trabalho e propósito, casa e lugar, experiências e viagens, quem eu me torno, o meu dia perfeito e o meu porquê). '
  + 'Em cada uma, me faça 1 ou 2 perguntas específicas e dê 2 ou 3 sugestões pra me inspirar. Me incentive a sonhar sem limites e com detalhes. '
  + 'Anote cada resposta em mentalidade/meus-sonhos.md, no presente. No fim, me proponha "O meu sonho numa frase".';

function chaveTexto(t) {
  return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function irPara(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// O id do cartão de cada área do sonho (pra levar direto até ela)
const idDaArea = (titulo) => `area-${chaveTexto(titulo).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

function irParaArea(titulo) {
  const el = document.getElementById(idDaArea(titulo));
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const vazio = [...el.querySelectorAll('textarea')].find((t) => !t.value.trim()) || el.querySelector('textarea');
  if (vazio) setTimeout(() => vazio.focus({ preventScroll: true }), 450);
}

function tituloDaSecao(n, titulo, texto, id) {
  return h('div', { class: 'secao-jornada', id },
    h('span', { class: 'secao-num' }, String(n)),
    h('div', null, h('h2', null, titulo), texto ? h('p', null, texto) : null));
}

const ICONE_DO_PRINCIPIO = ['semente', 'alvo', 'olho', 'bussola', 'passos', 'maos', 'sol'];

const PRATICA = {
  manha: [
    { id: 'respirar', icone: 'vento', texto: 'Respire fundo, três vezes' },
    { id: 'ler', icone: 'montanha', texto: 'Leia o seu sonho' },
    { id: 'ver', icone: 'olho', texto: 'Veja e sinta por 1 minuto' },
    { id: 'frase', icone: 'aspas', texto: 'Repita a frase do dia' },
    { id: 'passo', icone: 'passos', texto: 'Escolha o passo de hoje' },
    { id: 'bem', icone: 'maos', texto: 'Escolha a boa ação de hoje' },
  ],
  noite: [
    { id: 'gratidao', icone: 'coracao', texto: 'Três agradecimentos' },
    { id: 'ajudei', icone: 'maos', texto: 'Quem eu ajudei hoje?' },
    { id: 'vitoria', icone: 'trofeu', texto: 'Uma vitória do dia' },
  ],
};

// ---------- a prática de hoje (marcada neste navegador, um dia de cada vez) ----------

function chaveDoDia(hoje) { return `keylab-pratica-${hoje}`; }
function lerFeitos(hoje) {
  try { return new Set(JSON.parse(localStorage.getItem(chaveDoDia(hoje)) || '[]')); } catch { return new Set(); }
}
function gravarFeitos(hoje, feitos) {
  try { localStorage.setItem(chaveDoDia(hoje), JSON.stringify([...feitos])); } catch { /* sem guardar */ }
}

// ---------- a ilustração do topo (uma semente brotando ao sol) ----------

function ilustracao() {
  const raios = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    const x1 = 172 + Math.cos(a) * 22;
    const y1 = 50 + Math.sin(a) * 22;
    const x2 = 172 + Math.cos(a) * 30;
    const y2 = 50 + Math.sin(a) * 30;
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
  }).join('');
  const brilho = (x, y, s, atraso) => `<path class="ilu-brilho" style="animation-delay:${atraso}s" d="M${x} ${y - s}l${s * 0.3} ${s * 0.7} ${s * 0.7} ${s * 0.3}-${s * 0.7} ${s * 0.3}-${s * 0.3} ${s * 0.7}-${s * 0.3}-${s * 0.7}-${s * 0.7}-${s * 0.3} ${s * 0.7}-${s * 0.3}z"/>`;
  const el = h('div', { class: 'ilustracao', 'aria-hidden': 'true' });
  el.innerHTML = `<svg viewBox="0 0 240 180">
    <circle class="ilu-halo" cx="120" cy="98" r="80"/>
    <circle class="ilu-halo ilu-halo-2" cx="120" cy="98" r="56"/>
    <g class="ilu-raios">${raios}</g>
    <circle class="ilu-sol" cx="172" cy="50" r="15"/>
    ${brilho(64, 62, 7, 0)}${brilho(196, 112, 6, 1.2)}${brilho(52, 120, 5, 2.1)}${brilho(150, 28, 4, 0.6)}
    <path class="ilu-chao" d="M28 152 Q120 132 212 152"/>
    <path class="ilu-terra" d="M84 151c10-12 62-12 72 0z"/>
    <path class="ilu-caule" d="M120 146C120 128 118 112 120 92"/>
    <path class="ilu-folha ilu-folha-e" d="M119 118C103 118 91 108 89 93c16 0 27 9 30 25z"/>
    <path class="ilu-folha ilu-folha-d" d="M121 104c0-16 11-28 30-30 0 16-11 28-30 30z"/>
    <path class="ilu-veio" d="M117 115c-8-3-15-9-20-17M123 101c6-6 13-13 22-21"/>
    <circle class="ilu-broto" cx="120" cy="88" r="5"/>
  </svg>`;
  return el;
}

// ---------- Ver e sentir (1 minuto) ----------

function imagemPrincipal(d) {
  return d.quadro && d.quadro.length ? d.quadro[d.quadro.length - 1] : null;
}

function visualizar(d, aoTerminar) {
  const sonho = d.sonho && d.sonho.curto ? d.sonho.curto : '';
  const img = imagemPrincipal(d);
  const anterior = document.activeElement;
  const relogios = [];
  const volta = 2 * Math.PI * 46;
  const anel = h('div', { class: 'vis-anel' });
  anel.innerHTML = `<svg viewBox="0 0 100 100"><circle class="trilho" cx="50" cy="50" r="46"/><circle class="feito" cx="50" cy="50" r="46" stroke-dasharray="${volta}" stroke-dashoffset="${volta}"/></svg>`;
  const fase = h('p', { class: 'vis-fase' }, 'Inspire devagar... e solte.');
  const sonhoEl = h('p', { class: 'vis-sonho' }, sonho ? `“${sonho}”` : 'Imagine a vida que você quer, com todos os detalhes.');
  const acoes = h('div', { class: 'vis-acoes', hidden: true },
    h('button', { type: 'button', class: 'botao principal', onclick: () => { fechar(); pedirIA('Meu passo de hoje rumo ao sonho é: '); } }, ic('passos'), 'Anotar o passo de hoje'),
    h('button', { type: 'button', class: 'botao', onclick: () => fechar() }, 'Fechar'));
  const caixa = h('div', { class: `visualizar${img ? ' com-imagem' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Ver e sentir' },
    img ? h('div', { class: 'vis-imagem', style: `background-image:url("${img.url}")` }) : null,
    h('button', { type: 'button', class: 'icone-botao vis-fechar', 'aria-label': 'Fechar', onclick: () => fechar() }, ic('x')),
    h('div', { class: 'vis-centro' },
      h('div', { class: 'vis-respira' }, h('span'), h('span'), anel),
      fase,
      sonhoEl,
      acoes));
  const tecla = (e) => { if (e.key === 'Escape') fechar(); };
  function fechar() {
    relogios.forEach(clearTimeout);
    document.removeEventListener('keydown', tecla);
    caixa.classList.add('saindo');
    setTimeout(() => caixa.remove(), 250);
    if (anterior && anterior.focus) anterior.focus();
  }
  const em = (s, f) => relogios.push(setTimeout(f, s * 1000));
  em(8, () => { fase.textContent = 'Mais uma vez. Inspire... e solte.'; });
  em(16, () => { caixa.classList.add('com-sonho'); fase.textContent = 'Veja o seu sonho pronto. Onde você está? Quem está com você?'; });
  em(32, () => { fase.textContent = 'Sinta a alegria de já ter. Agradeça por isso.'; });
  em(48, () => { fase.textContent = 'Guarde esse sentimento. Ele vai com você hoje.'; });
  em(60, () => {
    caixa.classList.add('fim');
    fase.textContent = 'Que lindo. Agora, um passo pequeno pra hoje.';
    acoes.hidden = false;
    if (aoTerminar) aoTerminar();
    acoes.querySelector('.botao').focus();
  });
  document.addEventListener('keydown', tecla);
  document.body.append(caixa);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    caixa.classList.add('aberto');
    const c = anel.querySelector('.feito');
    if (c) c.style.strokeDashoffset = '0';
  }));
}

// ---------- partes da tela ----------

function cartaoDoSonho(d, ctx, marcar) {
  const s = d.sonho || {};
  if (!s.curto) return null;
  const img = imagemPrincipal(d);
  return h('section', { class: `painel sonho-card${img ? ' com-foto' : ''}` },
    img ? h('div', { class: 'sonho-foto', style: `background-image:url("${img.url}")` }) : null,
    h('div', { class: 'sonho-rotulo' }, ic('montanha'), 'O meu sonho'),
    h('h2', { class: 'sonho-texto' }, `“${s.curto}”`),
    h('div', { class: 'sonho-detalhes' },
      s.porque ? h('div', { class: 'sonho-linha' }, ic('coracao'), h('span', null, h('b', null, 'Porque: '), s.porque)) : null,
      s.passo ? h('div', { class: 'sonho-linha' }, ic('passos'), h('span', null, h('b', null, 'Próximo passo: '), s.passo)) : null,
      s.ajudo ? h('div', { class: 'sonho-linha' }, ic('maos'), h('span', null, h('b', null, 'Quem eu ajudo: '), s.ajudo)) : null),
    h('div', { class: 'chips' },
      h('button', { type: 'button', class: 'botao principal', onclick: () => visualizar(d, () => marcar('ver')) }, ic('olho'), 'Ver e sentir (1 minuto)'),
      h('button', { type: 'button', class: 'botao leve', onclick: () => irPara('sonho-areas') }, ic('lapis'), 'Escrever mais')));
}

// ---------- 1. Entenda ----------

function secaoEntenda() {
  const cadeia = [
    { icone: 'lampada', titulo: 'Pensamento', texto: 'O que você pensa' },
    { icone: 'coracao', titulo: 'Sentimento', texto: 'vira o que você sente' },
    { icone: 'passos', titulo: 'Ação', texto: 'vira o que você faz' },
    { icone: 'trofeu', titulo: 'Resultado', texto: 'e vira a sua vida' },
  ];
  let escolheu = false;
  try { escolheu = !!localStorage.getItem(ESCOLHI_MUDAR); } catch { /* sem guardar */ }
  const resposta = h('p', { class: 'escolha-resposta', hidden: !escolheu }, ic('brilho'), h('span', null, 'Que bom. Esse é o primeiro passo, e ele já é seu.'));
  const escolha = h('button', {
    type: 'button',
    class: 'escolha',
    'aria-pressed': String(escolheu),
    onclick: () => {
      const novo = escolha.getAttribute('aria-pressed') !== 'true';
      escolha.setAttribute('aria-pressed', String(novo));
      resposta.hidden = !novo;
      try { if (novo) localStorage.setItem(ESCOLHI_MUDAR, new Date().toISOString()); else localStorage.removeItem(ESCOLHI_MUDAR); } catch { /* sem guardar */ }
    },
  }, h('span', { class: 'escolha-caixa' }, ic('check')), h('span', null, 'Eu escolho mudar o meu jeito de pensar'));
  return h('section', { class: 'jornada-bloco' },
    tituloDaSecao(1, 'Por que começar por dentro', null, 'entenda'),
    h('div', { class: 'grade-2 mentalidade-grade' },
      h('section', { class: 'painel vidro entenda-card' },
        h('p', { class: 'entenda-frase' }, 'Com o mesmo jeito de pensar, você vai ter o mesmo resultado.'),
        h('ol', { class: 'cadeia' }, cadeia.map((c, i) => h('li', null,
          h('span', { class: 'cadeia-ico' }, ic(c.icone)),
          h('b', null, c.titulo),
          h('span', { class: 'fraco pequeno' }, c.texto),
          i < cadeia.length - 1 ? h('span', { class: 'cadeia-seta', 'aria-hidden': 'true' }, ic('seta')) : null))),
        h('p', null, 'Quase todo mundo tenta mudar a vida mexendo só no fim da fila: no que faz. Trabalha mais, tenta outra coisa... e o resultado continua parecido. Porque a raiz não mudou.'),
        h('p', null, 'É como encher um balde furado: dá pra jogar muita água, mas ele não enche. Primeiro a gente tapa o furo, que é o jeito de pensar. Aí cada passo seu passa a render.')),
      h('section', { class: 'painel pode-mudar' },
        h('span', { class: 'pode-mudar-ico' }, ic('semente')),
        h('h3', null, 'E a boa notícia: você pode mudar.'),
        h('p', null, 'O seu cérebro aprende a vida toda. Cada pensamento que você repete abre um caminho novo, como uma trilha no mato. Ninguém nasce com o jeito de pensar de quem prospera: a gente aprende.'),
        h('p', null, 'Você pode, e merece, ficar melhor a cada dia. E pode começar hoje.'),
        escolha,
        resposta)));
}

// ---------- 3. O seu objetivo de vida (o sonho, por área) ----------

function secaoSonho(d, ctx, marcar) {
  const s = d.sonho || {};
  const mudancas = new Map();
  const contador = h('span', { class: 'suave pequeno' });
  const salvar = h('button', { type: 'button', class: 'botao principal', onclick: () => gravar() }, ic('check'), 'Salvar o meu sonho');
  const barra = h('div', { class: 'barra-salvar vidro', hidden: true },
    contador,
    h('div', { class: 'chips' },
      h('button', { type: 'button', class: 'botao leve', onclick: () => { mudancas.clear(); ctx.recarregar({ silencioso: true }); } }, 'Descartar'),
      salvar));
  const atualizarBarra = () => {
    barra.hidden = mudancas.size === 0;
    contador.textContent = `${mudancas.size} ${mudancas.size === 1 ? 'resposta mudou' : 'respostas mudaram'}`;
  };
  async function gravar() {
    if (!mudancas.size) return;
    salvar.disabled = true;
    try {
      await api('/api/arquivo/campos', { caminho: 'mentalidade/meus-sonhos.md', mudancas: [...mudancas.values()] });
      mudancas.clear();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      aviso('Sonho guardado. Leia em voz alta: ele já está mais perto.');
      await ctx.recarregar({ silencioso: true });
    } catch (e) { falhou(e); salvar.disabled = false; }
  }
  const ajustar = (t) => { t.style.height = 'auto'; t.style.height = `${t.scrollHeight + 2}px`; };
  const caixas = [];
  const areas = d.areas.map((a) => h('article', { class: `area-sonho${a.titulo === 'O meu sonho numa frase' ? ' area-frase' : ''}`, id: idDaArea(a.titulo) },
    h('div', { class: 'area-sonho-topo' },
      h('span', { class: 'area-sonho-ico' }, ic(ICONE_DA_AREA[chaveTexto(a.titulo)] || 'estrela')),
      h('h3', null, a.titulo)),
    PERGUNTA_DA_AREA[chaveTexto(a.titulo)] ? h('p', { class: 'area-sonho-pergunta' }, PERGUNTA_DA_AREA[chaveTexto(a.titulo)]) : null,
    a.campos.map((c) => {
      const m = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(c.nome);
      const nome = m ? m[1] : c.nome;
      const dica = m ? m[2].replace(/^ex\.?:?\s*/i, 'Ex.: ') : '';
      const t = h('textarea', {
        class: 'entrada',
        rows: '2',
        placeholder: dica || (c.opcional ? 'Opcional' : 'Escreva como se já fosse real: "Eu..."'),
        'aria-label': nome,
        oninput: () => {
          ajustar(t);
          const k = `${c.secao}|${c.rotulo}`;
          if (t.value.trim() === c.valor.trim()) mudancas.delete(k);
          else mudancas.set(k, { secao: c.secao, rotulo: c.rotulo, valor: t.value });
          atualizarBarra();
        },
      }, c.valor);
      caixas.push(t);
      return h('label', { class: 'campo-sonho' }, h('span', { class: 'rotulo' }, nome, c.opcional ? h('span', { class: 'fraco' }, ' (opcional)') : null), t);
    })));
  const el = h('section', { class: 'jornada-bloco' },
    tituloDaSecao(4, 'O seu objetivo de vida', 'Quem não sabe pra onde vai chega em qualquer lugar. Aqui você cria a vida dos seus sonhos, sem limites: não existe sonho grande demais.', 'sonho'),
    cartaoDoSonho(d, ctx, marcar),
    h('div', { class: 'sonhar-ajuda' },
      h('span', { class: 'sonhar-ajuda-ico' }, ic('ia')),
      h('div', null,
        h('b', null, 'Travou? A IA te ajuda a sonhar.'),
        h('p', null, 'Ela pergunta área por área da sua vida e dá ideias pra inspirar. Você só escolhe e completa.')),
      h('button', { type: 'button', class: 'botao principal', onclick: () => pedirIA(ME_AJUDE_A_SONHAR) }, ic('ia'), temChat() ? 'Me ajude a sonhar' : 'Copiar o pedido')),
    h('section', { class: 'versao-perfeita', id: 'sonho-areas' },
      h('div', { class: 'versao-perfeita-topo' },
        h('span', { class: 'versao-perfeita-ico' }, ic('brilho')),
        h('div', null,
          h('h3', null, 'Crie a versão perfeita da sua vida dos sonhos'),
          h('p', null, 'Imagine que tudo já deu certo. Agora descreva essa vida, área por área.'))),
      h('ul', { class: 'versao-perfeita-regras' },
        h('li', null, ic('estrela'), h('span', null, h('b', null, 'Como você QUER que seja, '), 'não como é hoje.')),
        h('li', null, ic('relogio'), h('span', null, h('b', null, 'No presente, como se já fosse real: '), '"Eu tenho...", "Eu vivo...", "Eu sou...".')),
        h('li', null, ic('infinito'), h('span', null, h('b', null, 'Sem limites. '), 'Se você pudesse ter tudo, como seria? Com detalhes: cores, lugares, pessoas, sentimentos.'))),
      h('div', { class: 'versao-perfeita-exemplo' },
        h('div', { class: 'exemplo-nao' }, ic('x'), h('span', null, h('b', null, 'Assim não: '), '"Quero emagrecer."')),
        h('div', { class: 'exemplo-sim' }, ic('check'), h('span', null, h('b', null, 'Assim sim: '), '"Eu tenho um corpo leve e forte, e acordo cheio de energia."'))),
      h('div', { class: 'fraco pequeno' }, `${s.respondidas || 0} de ${s.total || 0} respondidas.`)),
    h('div', { class: 'areas-sonho' }, areas),
    barra);
  el.depois = () => caixas.forEach(ajustar);
  el.temMudancas = () => mudancas.size > 0;
  return el;
}

// ---------- 5. O quadro dos sonhos ----------
// Duas opções: copiar o prompt pra uma IA de imagem (só depois de descrever todas as áreas da vida)
// e vincular a imagem pronta.

function galeriaDoQuadro(d, ctx) {
  if (!d.quadro.length) return null;
  const ultima = d.quadro.length - 1;
  const ordem = [d.quadro[ultima], ...d.quadro.slice(0, ultima).reverse()];
  return h('div', { class: 'quadro-galeria' }, ordem.map((q, i) => h('figure', { class: `quadro-foto${i === 0 ? ' principal' : ''}` },
    h('img', { src: q.url, alt: 'Imagem do meu quadro dos sonhos', loading: 'lazy' }),
    i === 0 ? h('span', { class: 'chip quadro-selo' }, ic('estrela'), 'O meu quadro') : null,
    h('button', {
      type: 'button',
      class: 'icone-botao quadro-apagar',
      title: 'Tirar do quadro',
      'aria-label': 'Tirar esta imagem do quadro',
      onclick: async () => {
        if (!(await confirmar('Tirar esta imagem do seu quadro dos sonhos?', { sim: 'Tirar' }))) return;
        try { await api('/api/mentalidade/imagem', { acao: 'apagar', nome: q.nome }); aviso('Tirada do quadro.'); } catch (e) { falhou(e); }
        ctx.recarregar({ silencioso: true });
      },
    }, ic('lixo')))));
}

function opcaoDoQuadro(n, icone, titulo, corpo, extra = '') {
  return h('article', { class: `quadro-opcao${extra}` },
    h('div', { class: 'quadro-opcao-topo' },
      h('span', { class: 'quadro-opcao-ico' }, ic(icone)),
      h('div', null, h('span', { class: 'quadro-opcao-num' }, `Opção ${n}`), h('h3', null, titulo))),
    corpo);
}

function opcaoDoPrompt(p) {
  if (!p.liberado) {
    const faltam = p.total - p.feitas;
    const primeira = p.vida.find((a) => !a.feita);
    return opcaoDoQuadro(1, 'cadeado', 'Copiar prompt para uma IA de imagem', [
      h('p', null, 'O prompt é montado com o que você escreveu. Por isso, ele libera quando você descrever como é a sua vida dos sonhos em todas as áreas.'),
      h('div', { class: 'quadro-progresso' },
        h('div', { class: 'quadro-progresso-texto' }, h('b', null, `${p.feitas} de ${p.total} áreas`), h('span', { class: 'fraco' }, ` · falta${faltam === 1 ? '' : 'm'} ${faltam}`)),
        h('div', { class: 'quadro-progresso-barra' }, h('span', { style: `width:${p.total ? Math.round((p.feitas / p.total) * 100) : 0}%` }))),
      h('ul', { class: 'quadro-areas' }, p.vida.map((a) => h('li', null,
        h('button', { type: 'button', class: `quadro-area${a.feita ? ' feita' : ''}`, title: a.feita ? `${a.titulo}: descrita` : `Escrever: ${a.titulo}`, onclick: () => irParaArea(a.titulo) },
          ic(a.feita ? 'check' : (ICONE_DA_AREA[chaveTexto(a.titulo)] || 'estrela')), h('span', null, a.titulo))))),
      h('div', { class: 'chips' },
        h('button', { type: 'button', class: 'botao', disabled: true, title: 'Libera quando todas as áreas estiverem descritas' }, ic('cadeado'), 'Copiar prompt'),
        primeira ? h('button', { type: 'button', class: 'botao leve', onclick: () => irParaArea(primeira.titulo) }, ic('lapis'), 'Escrever o que falta') : null),
    ], ' trancada');
  }
  const ver = h('details', { class: 'prompt-ver' },
    h('summary', null, ic('olho'), 'Ver o prompt'),
    h('pre', { class: 'prompt-quadro' }, p.texto));
  return opcaoDoQuadro(1, 'brilho', 'Copiar prompt para uma IA de imagem', [
    h('p', null, 'Pronto! O prompt traz a sua vida dos sonhos inteira: uma cena pra cada área, no formato certo pro quadro (deitado, 16:9).'),
    h('ol', { class: 'quadro-como' },
      h('li', null, 'Copie o prompt.'),
      h('li', null, 'Cole numa IA que cria imagens, como o ChatGPT ou o Gemini.'),
      h('li', null, h('b', null, 'Dica: '), 'anexe uma foto sua junto. Assim a IA coloca você nas cenas.'),
      h('li', null, 'Gere algumas e fique com a que mais te emocionar.')),
    h('div', { class: 'chips' },
      h('button', { type: 'button', class: 'botao principal', onclick: () => copiar(p.texto, 'Prompt copiado. Cole numa IA de imagem.') }, ic('copiar'), 'Copiar prompt')),
    ver,
  ]);
}

function opcaoDeVincular(d, ctx) {
  const arquivo = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', multiple: true, hidden: true });
  const enviar = async (lista) => {
    let enviadas = 0;
    for (const f of lista) {
      if (!/^image\/(png|jpeg|webp|gif)$/.test(f.type)) { aviso('Use uma imagem PNG, JPG, WEBP ou GIF.', { erro: true }); continue; }
      if (f.size > 6 * 1024 * 1024) { aviso('Imagem grande demais. Use uma de até 6 MB.', { erro: true }); continue; }
      const dados = await new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = erro; r.readAsDataURL(f); });
      try { await api('/api/mentalidade/imagem', { dados }); enviadas++; } catch (e) { falhou(e); }
    }
    if (enviadas) aviso('Quadro vinculado. Olhe pra ele todo dia.');
    ctx.recarregar({ silencioso: true });
  };
  arquivo.addEventListener('change', () => { if (arquivo.files.length) enviar([...arquivo.files]); arquivo.value = ''; });
  const soltar = h('div', {
    class: 'soltar',
    tabindex: '0',
    role: 'button',
    'aria-label': 'Vincular a imagem do meu quadro dos sonhos',
    onclick: () => arquivo.click(),
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); arquivo.click(); } },
    ondragover: (e) => { e.preventDefault(); soltar.classList.add('sobre'); },
    ondragleave: () => soltar.classList.remove('sobre'),
    ondrop: (e) => { e.preventDefault(); soltar.classList.remove('sobre'); if (e.dataTransfer.files.length) enviar([...e.dataTransfer.files]); },
  }, ic('upload'), h('b', null, d.quadro.length ? 'Trocar ou colocar outra imagem' : 'Escolher a imagem'), h('span', { class: 'fraco pequeno' }, 'Arraste aqui ou clique. PNG, JPG ou WEBP, até 6 MB. Melhor deitada (16:9).'), arquivo);
  return opcaoDoQuadro(2, 'imagem', 'Vincular meu quadro dos sonhos', [
    h('p', null, d.quadro.length
      ? 'O seu quadro aparece no seu sonho e no "Ver e sentir". Fez uma imagem nova? Coloque aqui: a mais nova vira o seu quadro.'
      : 'Gerou a imagem? Ou já tem um quadro dos sonhos pronto? Coloque aqui. Ele aparece no seu sonho e no "Ver e sentir".'),
    soltar,
  ]);
}

function secaoQuadro(d, ctx) {
  const p = d.quadroPrompt || { vida: [], feitas: 0, total: 0, liberado: false, texto: '' };
  return h('section', { class: 'jornada-bloco' },
    tituloDaSecao(5, 'O quadro dos sonhos', 'Uma imagem da vida que você quer, pra você olhar todo dia. Ela nasce do sonho que você escreveu.', 'quadro'),
    galeriaDoQuadro(d, ctx),
    h('div', { class: 'quadro-opcoes' }, opcaoDoPrompt(p), opcaoDeVincular(d, ctx)));
}

// ---------- os arquivos, explicados ----------

function secaoArquivos(d) {
  if (!d.explicacoes || !d.explicacoes.length) return null;
  const linha = (icone, rotulo, texto) => (texto ? h('div', { class: 'explica-linha' }, ic(icone), h('span', null, h('b', null, `${rotulo} `), texto)) : null);
  return h('section', { class: 'jornada-bloco' },
    h('div', { class: 'secao-jornada' },
      h('span', { class: 'secao-num secao-num-leve' }, ic('livro')),
      h('div', null, h('h2', null, 'Os arquivos da Mentalidade'), h('p', null, 'Tudo fica escrito em arquivos de texto, que você e a IA leem e mudam. Pra que serve cada um, por que usar e como usar:'))),
    h('div', { class: 'explica-grade' }, d.explicacoes.map((e) => h('article', { class: 'explica-card' },
      h('div', { class: 'explica-topo' }, h('h3', null, e.titulo), h('a', { class: 'botao leve pequeno', href: `#/arquivo?c=${encodeURIComponent(e.caminho)}` }, 'Abrir')),
      linha('alvo', 'Pra que serve:', e.serve),
      linha('coracao', 'Por que usar:', e.porque),
      linha('passos', 'Como usar:', e.como)))));
}


function cartaoDaFrase(d) {
  if (!d.frase) return null;
  const todas = (d.frases && d.frases.todas) || [];
  const rotulo = h('div', { class: 'sonho-rotulo' }, d.frase.minha ? 'Frase do dia · uma das suas' : 'Frase do dia');
  const texto = h('p', { class: 'frase-texto' }, d.frase.texto);
  // "Outra frase": sorteia uma diferente da que está na tela
  const outra = () => {
    const resto = todas.filter((f) => f !== texto.textContent);
    if (!resto.length) return;
    texto.classList.remove('trocou');
    void texto.offsetWidth;
    texto.textContent = resto[Math.floor(Math.random() * resto.length)];
    texto.classList.add('trocou');
    rotulo.textContent = 'Outra frase pra hoje';
  };
  return h('section', { class: 'painel frase-card vidro' },
    h('span', { class: 'frase-aspas' }, ic('aspas')),
    h('div', { class: 'frase-corpo' },
      rotulo,
      texto,
      h('p', { class: 'fraco pequeno', style: 'margin:6px 0 0' }, 'Leia em voz alta, devagar, três vezes.'),
      h('div', { class: 'frase-acoes' },
        todas.length > 1 ? h('button', { type: 'button', class: 'botao leve pequeno', onclick: outra }, ic('recarregar'), 'Outra frase') : null,
        h('a', { class: 'botao leve pequeno', href: '#/frases?escrever=1' }, ic('mais'), 'Escrever a minha'),
        h('a', { class: 'botao leve pequeno', href: '#/frases' }, ic('lista'), `Ver todas (${todas.length})`))));
}

function cartaoDaPratica(d) {
  const feitos = lerFeitos(d.hoje);
  const total = PRATICA.manha.length + PRATICA.noite.length;
  const conta = h('span', { class: 'chip' });
  const contar = h('div', { class: 'pratica-fim', hidden: true },
    ic('brilho'), h('span', null, 'Dia completo. Conte pra IA como foi.'),
    h('button', { type: 'button', class: 'botao pequeno', onclick: () => pedirIA('Hoje eu agradeço por: ') }, ic('ia'), temChat() ? 'Contar' : 'Copiar pedido'));
  const atualizar = () => {
    conta.textContent = `${[...feitos].filter((id) => [...PRATICA.manha, ...PRATICA.noite].some((p) => p.id === id)).length} de ${total}`;
    contar.hidden = !PRATICA.noite.every((p) => feitos.has(p.id));
  };
  const item = (p) => {
    const b = h('button', {
      type: 'button',
      class: 'pratica-item',
      'aria-pressed': String(feitos.has(p.id)),
      'data-id': p.id,
      onclick: () => {
        if (feitos.has(p.id)) feitos.delete(p.id); else feitos.add(p.id);
        gravarFeitos(d.hoje, feitos);
        b.setAttribute('aria-pressed', String(feitos.has(p.id)));
        atualizar();
      },
    }, h('span', { class: 'pratica-ico' }, ic(p.icone)), h('span', { class: 'pratica-texto' }, p.texto), h('span', { class: 'pratica-check' }, ic('check')));
    return b;
  };
  const el = h('section', { class: 'painel pratica-card vidro' },
    h('div', { class: 'painel-cabeca' },
      h('div', null, h('h2', null, 'A prática de hoje'), h('p', { class: 'suave pequeno', style: 'margin:4px 0 0' }, '5 minutos. Toque pra marcar.')),
      conta),
    h('div', { class: 'pratica-grade' },
      h('div', null, h('div', { class: 'pratica-turno' }, ic('sol'), 'De manhã'), PRATICA.manha.map(item)),
      h('div', null, h('div', { class: 'pratica-turno' }, ic('lua'), 'À noite'), PRATICA.noite.map(item))),
    contar);
  atualizar();
  el.marcar = (id) => {
    feitos.add(id);
    gravarFeitos(d.hoje, feitos);
    const b = el.querySelector(`[data-id="${id}"]`);
    if (b) b.setAttribute('aria-pressed', 'true');
    atualizar();
  };
  return el;
}

function cartoesDosPrincipios(d) {
  if (!d.principios.length) return null;
  return h('section', { class: 'jornada-bloco principios' },
    tituloDaSecao(2, 'O jeito de pensar de quem prospera', 'Sete ideias simples. Leia uma por dia e pergunte: como eu uso isso hoje?', 'jeito'),
    h('div', { class: 'principios-grade' }, d.principios.map((p, i) => h('article', { class: 'principio', style: `--atraso:${i * 60}ms` },
      h('div', { class: 'principio-topo' },
        h('span', { class: 'principio-ico' }, ic(ICONE_DO_PRINCIPIO[i] || 'estrela')),
        h('span', { class: 'principio-num' }, String(i + 1))),
      h('h3', null, p.titulo),
      h('p', null, p.texto)))));
}

function secaoCrencas(d) {
  const c = d.crencas;
  if (!c || !c.total) return null;
  return h('section', { class: 'jornada-bloco' },
    tituloDaSecao(3, 'Troca de crenças', 'Algumas ideias seguram a gente sem a gente perceber. Troque cada uma por outra que liberta.', 'crencas'),
    h('section', { class: 'painel crencas-card vidro' },
      h('div', { class: 'painel-cabeca' },
        h('div', null, h('h2', null, 'As trocas de hoje'), h('p', { class: 'suave pequeno', style: 'margin:4px 0 0' }, 'Solte a corrente. Fique com a que liberta.')),
        h('a', { class: 'botao leve pequeno', href: '#/crencas' }, `Ver todas (${c.total})`)),
      h('ul', { class: 'trocas' }, c.doDia.map((t) => h('li', { class: 'troca' },
        h('div', { class: 'troca-trava' }, ic('corrente'), h('span', null, t.trava)),
        h('span', { class: 'troca-seta' }, ic('seta')),
        h('div', { class: 'troca-liberta' }, ic('passaro'), h('span', null, t.liberta))))),
      h('div', { style: 'margin-top:12px' }, pedido('Tenho uma crença que me trava: ', { rotulo: 'Tenho uma crença que me trava...' }))));
}

// ---------- a tela ----------

export async function montar(alvo, ctx, area) {
  const [d, a] = await Promise.all([api('/api/mentalidade'), area ? Promise.resolve(area) : api('/api/area?id=mentalidade')]);
  if (!d) {
    alvo.append(h('p', { class: 'fraco' }, 'A pasta mentalidade/ não existe mais.'));
    return { titulo: 'Mentalidade' };
  }

  alvo.append(h('header', { class: 'mentalidade-topo' },
    h('div', { class: 'mentalidade-titulo' },
      h('div', { class: 'sonho-rotulo' }, ic('semente'), 'Mentalidade'),
      h('h1', null, 'Tudo começa por dentro.'),
      h('p', null, a.descricao || ''),
      h('div', { class: 'chips' },
        h('a', { class: 'botao', href: `#/arquivo?c=${encodeURIComponent('mentalidade/pratica-diaria.md')}` }, ic('relogio'), '5 minutos por dia'),
        h('a', { class: 'botao leve', href: `#/arquivo?c=${encodeURIComponent(a.leiame)}` }, ic('texto'), 'Como funciona'))),
    ilustracao()));

  // A jornada, nesta ordem (os botões levam até cada parte)
  const JORNADA = [['entenda', 'Entenda'], ['jeito', 'Jeito de pensar'], ['crencas', 'Crenças'], ['sonho', 'O seu sonho'], ['quadro', 'Quadro dos sonhos'], ['todo-dia', 'Todo dia'], ['diario', 'Diário']];
  alvo.append(h('nav', { class: 'jornada', 'aria-label': 'A jornada da Mentalidade' }, JORNADA.map(([id, nome], i) => h('button', { type: 'button', class: 'jornada-passo', onclick: () => irPara(id) },
    h('span', { class: 'jornada-num' }, String(i + 1)), nome))));

  const pratica = cartaoDaPratica(d);
  alvo.append(secaoEntenda());
  const principios = cartoesDosPrincipios(d);
  if (principios) alvo.append(principios);
  const crencas = secaoCrencas(d);
  if (crencas) alvo.append(crencas);
  const sonho = secaoSonho(d, ctx, (id) => pratica.marcar(id));
  alvo.append(sonho);
  alvo.append(secaoQuadro(d, ctx));
  alvo.append(h('section', { class: 'jornada-bloco' },
    tituloDaSecao(6, 'Todo dia', 'Cinco minutos por dia mantêm o sonho vivo e a cabeça no lugar.', 'todo-dia'),
    h('div', { class: 'grade-2 mentalidade-grade' },
      h('div', { class: 'pilha' }, cartaoDaFrase(d)),
      h('div', { class: 'pilha' }, pratica))));
  const diario = blocoDoDiario(d.diario, ctx, { limite: 4 });
  alvo.append(h('section', { class: 'jornada-bloco' },
    tituloDaSecao(7, 'Diário', 'Guarde as coisas boas de cada dia: o que você agradece, quem você ajudou, as suas vitórias e o que mais quiser. Num dia difícil, você relê.', 'diario'),
    diario));
  const arquivos = secaoArquivos(d);
  if (arquivos) alvo.append(arquivos);

  return {
    titulo: 'Mentalidade',
    depois: () => { if (sonho.depois) sonho.depois(); diario.depois(); },
    podeRecarregar: () => !(sonho.temMudancas && sonho.temMudancas()) && !diario.temMudancas(),
  };
}
