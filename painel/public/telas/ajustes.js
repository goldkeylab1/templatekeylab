// Ajustes: tema, a sua marca no painel (logo, cor, nome) e o GitHub.
import { h, ic, api, aviso, falhou, cabeca, copiar, quandoFoi, pedirIA, temChat } from '../ui.js';
import { trocarTema, lerTema } from '../app.js';

function linha(titulo, texto, controle) {
  return h('div', { class: 'linha', style: 'align-items:center' },
    h('div', { class: 'linha-texto' }, h('div', { style: 'font-weight:650' }, titulo), texto ? h('div', { class: 'suave pequeno' }, texto) : null),
    controle);
}

function interruptor(ligado, aoMudar, rotulo) {
  const b = h('button', { type: 'button', class: 'interruptor', role: 'switch', 'aria-checked': String(!!ligado), 'aria-label': rotulo });
  b.addEventListener('click', async () => {
    const novo = b.getAttribute('aria-checked') !== 'true';
    b.setAttribute('aria-checked', String(novo));
    try { await aoMudar(novo); } catch (e) { b.setAttribute('aria-checked', String(!novo)); falhou(e); }
  });
  return b;
}

function painelAparencia(ctx) {
  const m = ctx.inicio.marca;
  const tema = lerTema();
  const temas = h('div', { class: 'segmentado', role: 'group', 'aria-label': 'Tema' },
    [['claro', 'sol', 'Claro'], ['auto', 'auto', 'Automático'], ['escuro', 'lua', 'Escuro']].map(([t, i, nome]) => h('button', {
      type: 'button',
      'data-tema': t,
      'aria-pressed': String(tema === t),
      onclick: () => trocarTema(t),
    }, ic(i), nome)));

  const corAtual = m.cor || '#e0136e';
  const seletor = h('input', { type: 'color', value: corAtual, 'aria-label': 'Escolher a cor', style: 'width:44px;height:38px;border:0;background:none;padding:0;cursor:pointer' });
  const hex = h('input', { class: 'entrada', type: 'text', value: m.cor || '', placeholder: '#E0136E', 'aria-label': 'Código da cor', style: 'width:120px' });
  seletor.addEventListener('input', () => { hex.value = seletor.value.toUpperCase(); });
  hex.addEventListener('input', () => { if (/^#[0-9a-f]{6}$/i.test(hex.value.trim())) seletor.value = hex.value.trim(); });
  const salvarCor = h('button', {
    type: 'button',
    class: 'botao pequeno',
    onclick: async () => {
      try {
        await api('/api/marca', { cor: hex.value.trim() });
        aviso(hex.value.trim() ? 'Cor salva em negocio/marca.md.' : 'Cor tirada. Voltou o rosa.');
        await ctx.atualizarInicio();
      } catch (e) { falhou(e); }
    },
  }, 'Salvar cor');

  const previa = h('span', { class: 'marca-simbolo', style: 'width:56px;height:56px;border-radius:16px' });
  if (m.logo) previa.append(h('img', { src: `/api/logo?v=${m.logo.versao}`, alt: 'Logo atual' }));
  else previa.append(ic('chave'));
  const arquivo = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/svg+xml,image/webp', hidden: true });
  arquivo.addEventListener('change', () => {
    const f = arquivo.files && arquivo.files[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { aviso('Imagem grande demais. Use uma de até 5 MB.', { erro: true }); return; }
    const leitor = new FileReader();
    leitor.onload = async () => {
      try {
        await api('/api/marca/logo', { dados: leitor.result });
        aviso('Logo salvo em arquivos/marca/.');
        await ctx.atualizarInicio();
        ctx.recarregar({ silencioso: true });
      } catch (e) { falhou(e); }
    };
    leitor.readAsDataURL(f);
  });

  const nome = h('input', { class: 'entrada', type: 'text', value: m.nomeNoPainel || '', placeholder: m.nome || 'O nome do negócio', 'aria-label': 'Nome no painel', style: 'max-width:260px' });

  return h('section', { class: 'painel vidro' },
    h('div', { class: 'painel-cabeca' }, h('h2', null, 'Aparência')),
    h('ul', { class: 'lista' },
      linha('Tema', 'Claro, escuro ou igual ao computador. Fica guardado neste navegador.', temas),
      linha('Usar as cores da minha marca', 'Troca o rosa pela cor principal da marca.', interruptor(m.usarCores, async (v) => { await api('/api/marca', { usarCores: v }); await ctx.atualizarInicio(); }, 'Usar as cores da marca')),
      linha('Cor principal', 'Use o código com # (ex.: #E0136E).', h('div', { class: 'chips' }, seletor, hex, salvarCor)),
      linha('Logo', 'PNG, JPG, SVG ou WEBP, de até 5 MB. Quadrado fica melhor.', h('div', { class: 'chips' },
        previa,
        h('button', { type: 'button', class: 'botao pequeno', onclick: () => arquivo.click() }, ic('upload'), m.logo ? 'Trocar' : 'Escolher'),
        m.logo ? h('button', {
          type: 'button',
          class: 'botao leve pequeno',
          onclick: async () => {
            try { await api('/api/marca/logo', { remover: true }); aviso('Logo tirado.'); await ctx.atualizarInicio(); ctx.recarregar({ silencioso: true }); } catch (e) { falhou(e); }
          },
        }, 'Tirar') : null,
        arquivo)),
      linha('Nome no painel', 'Vazio = o nome do negócio (negocio/empresa.md).', h('div', { class: 'chips' }, nome, h('button', {
        type: 'button',
        class: 'botao pequeno',
        onclick: async () => { try { await api('/api/marca', { nomeNoPainel: nome.value }); aviso('Nome salvo.'); await ctx.atualizarInicio(); } catch (e) { falhou(e); } },
      }, 'Salvar')))));
}

function painelGitHub(g, ctx) {
  const salvar = h('button', {
    type: 'button',
    class: 'botao principal',
    onclick: async () => {
      salvar.disabled = true;
      salvar.lastChild.textContent = 'Salvando...';
      try { const r = await api('/api/git/salvar', {}); aviso(r.aviso || 'Salvo no GitHub.'); } catch (e) { falhou(e); }
      ctx.recarregar({ silencioso: true });
    },
  }, ic('nuvem'), h('span', null, 'Salvar agora'));

  const itens = [];
  if (!g.git) {
    itens.push(linha('Falta instalar o Git', 'É o programa que manda a pasta pro GitHub.', h('a', { class: 'botao pequeno', href: '#/ajuda?q=instalo o git' }, 'Como instalar')));
  } else if (!g.repositorio || !g.remoto || g.doModelo) {
    itens.push(linha(
      g.doModelo ? 'Ainda ligado ao modelo' : 'Ainda não está no seu GitHub',
      'Crie um repositório PRIVADO e ligue esta pasta nele. A IA faz com você.',
      h('div', { class: 'chips' },
        h('button', { type: 'button', class: 'botao pequeno', onclick: () => pedirIA('salvar no github') }, ic('ia'), temChat() ? 'Pedir pra IA' : 'Copiar pedido'),
        h('a', { class: 'botao leve pequeno', href: '#/ajuda?q=github' }, 'Ver passo a passo'))));
  }
  if (g.visibilidade === 'publico') {
    itens.push(linha('O repositório está PÚBLICO', 'Qualquer pessoa vê o seu negócio. No GitHub: Settings, depois Change visibility, Private.', h('a', { class: 'botao pequeno', href: g.link, target: '_blank', rel: 'noopener' }, ic('link'), 'Abrir')));
  }
  if (g.remoto) {
    itens.push(linha('Repositório', g.remoto, g.link ? h('a', { class: 'botao leve pequeno', href: g.link, target: '_blank', rel: 'noopener' }, ic('link'), 'Abrir') : null));
    itens.push(linha('Visibilidade', { privado: 'Privado. Só você vê.', publico: 'Público.' }[g.visibilidade] || 'Não deu pra conferir agora (sem internet?).', null));
  }
  if (g.repositorio) {
    itens.push(linha('Mudanças sem salvar', g.mudancas ? `${g.mudancas} ${g.mudancas === 1 ? 'arquivo mudou' : 'arquivos mudaram'} desde o último salvamento.` : 'Nenhuma.', g.ligado ? salvar : null));
    if (g.ultimoCommit) itens.push(linha('Último salvamento', quandoFoi(g.ultimoCommit), null));
  }
  itens.push(linha(
    'Salvar sozinho',
    'Depois de cada resposta da IA, guarda e manda pro GitHub (no Claude Code). Nas outras IAs, ela roda o salvar no fim das tarefas.',
    interruptor(g.salvarSozinho, async (v) => {
      await api('/api/preferencia', { nome: 'salvar no github sozinho', rotulo: 'Salvar no GitHub sozinho', valor: v ? 'sim' : 'não' });
      aviso(v ? 'Ligado. A IA salva sozinha depois de cada mudança.' : 'Desligado.');
    }, 'Salvar sozinho no GitHub')));
  if (g.ultimoAuto) {
    itens.push(linha('Último salvar sozinho', `${quandoFoi(g.ultimoAuto.quando)}: ${g.ultimoAuto.ok ? 'deu certo' : g.ultimoAuto.erro}`, null));
  }

  return h('section', { class: 'painel vidro' },
    h('div', { class: 'painel-cabeca' }, h('h2', null, 'GitHub'), h('span', { class: `chip${g.ligado ? ' cheio' : ' rosa'}` }, g.ligado ? 'ligado' : 'falta ligar')),
    h('p', { class: 'suave pequeno', style: 'margin:-4px 0 6px' }, 'Uma cópia da pasta na nuvem. Se o computador quebrar, nada se perde.'),
    h('ul', { class: 'lista' }, itens));
}

// O anotador: a IA que confere a conversa escondida e anota no cérebro o que ficou pra trás
function painelAnotador(a, ctx) {
  const MOTIVOS = {
    desligado: 'Desligado. A IA só anota o que lembrar na hora.',
    modelo: 'Parado: esta pasta ainda está ligada ao modelo no GitHub (o cérebro do modelo vai pra todo mundo). Ligue no seu GitHub pra ele funcionar.',
    'sem-claude': 'Precisa do Claude Code instalado neste computador.',
  };
  const status = a.funcionando
    ? (a.rodando ? 'Anotando agora...' : 'Ligado. Confere a conversa a cada 5 mensagens e sempre no fim dela.')
    : MOTIVOS[a.motivo] || '';
  const seletor = h('select', {
    class: 'entrada',
    style: 'width:auto',
    'aria-label': 'Modelo do anotador',
    onchange: async (e) => { try { await api('/api/anotador', { modelo: e.target.value }); aviso('Modelo do anotador trocado.'); } catch (err) { falhou(err); } },
  }, a.modelos.map((m) => h('option', { value: m.id, selected: m.id === a.modelo }, m.nome)));
  const vezes = a.ultimos.slice(0, 5);
  return h('section', { class: 'painel vidro' },
    h('div', { class: 'painel-cabeca' }, h('h2', null, 'Aprender sozinho'), h('span', { class: `chip${a.funcionando ? ' cheio' : ''}` }, a.funcionando ? 'ligado' : 'parado')),
    h('p', { class: 'suave pequeno', style: 'margin:-4px 0 6px' }, 'Além do que a IA anota na hora, uma IA escondida confere a conversa e guarda no cérebro o que ficou pra trás. Usa um pouco do seu plano do Claude.'),
    h('ul', { class: 'lista' },
      linha('Anotar sozinho', status, interruptor(a.ligado, async (v) => { await api('/api/anotador', { ligado: v }); ctx.recarregar({ silencioso: true }); }, 'Anotar sozinho')),
      linha('Modelo do anotador', 'Haiku: barato e rápido (recomendado). Sonnet: mais cuidadoso, gasta mais.', seletor)),
    vezes.length
      ? h('div', { style: 'margin-top:10px' },
        h('h3', null, 'Últimas vezes'),
        h('ul', { class: 'lista' }, vezes.map((e) => h('li', { class: 'linha' },
          h('div', { class: 'linha-texto' },
            h('div', { class: 'pequeno' }, e.erro ? `Não deu certo: ${e.erro}` : (e.itens && e.itens.length ? e.itens.join(' · ') : 'Nada novo pra anotar.')),
            h('div', { class: 'fraco pequeno' }, `${quandoFoi(e.quando)} · ${e.mensagens} ${e.mensagens === 1 ? 'mensagem lida' : 'mensagens lidas'} · ${e.gancho === 'fim' ? 'fim da conversa' : e.gancho === 'compactar' ? 'conversa longa' : e.gancho === 'manual' ? 'na mão' : 'durante a conversa'}`))))))
      : null);
}

function painelOutraIA() {
  return h('section', { class: 'painel vidro' },
    h('h2', null, 'Levar pra outra IA'),
    h('p', { class: 'suave pequeno', style: 'margin:6px 0 12px' }, 'Copia o essencial do cérebro (o negócio, as preferências e os aprendizados) num texto só. Cole no começo da conversa com qualquer IA.'),
    h('button', {
      type: 'button',
      class: 'botao',
      onclick: async () => { try { const r = await api('/api/cerebro'); copiar(r.texto, 'Cérebro copiado. Cole no começo da conversa.'); } catch (e) { falhou(e); } },
    }, ic('copiar'), 'Copiar o cérebro'));
}

function painelSobre(ctx) {
  return h('section', { class: 'painel vidro' },
    h('h2', null, 'Sobre o painel'),
    h('ul', { class: 'lista' },
      linha('Pasta', ctx.inicio.pasta, null),
      linha('Versão', ctx.inicio.versao, null),
      linha('Abrir o painel sozinho', 'Quando você começa uma conversa com a IA, o painel abre no navegador (se ainda não estiver aberto).', interruptor(ctx.inicio.abrirSozinho, async (v) => {
        await api('/api/preferencia', { nome: 'Abrir o painel sozinho', valor: v ? 'sim' : 'não', rotulo: 'Abrir o painel sozinho' });
        await ctx.atualizarInicio();
      }, 'Abrir o painel sozinho')),
      linha('Desligar', 'Feche a janela do terminal, ou rode: npm run parar', null),
      linha('Mudar o painel', 'Peça pra IA. Ela segue receitas/personalizar-painel.md.', h('button', { type: 'button', class: 'botao leve pequeno', onclick: () => pedirIA('Quero mudar o meu painel: ') }, ic('ia'), temChat() ? 'Pedir pra IA' : 'Copiar pedido'))));
}

export async function montar(alvo, ctx) {
  const [g, a] = await Promise.all([api('/api/git'), api('/api/anotador')]);
  alvo.append(cabeca({ titulo: 'Ajustes', texto: 'A cara do painel, o backup no GitHub e como a IA aprende.' }));
  alvo.append(h('div', { class: 'grade-2' },
    h('div', { class: 'pilha' }, painelAparencia(ctx), painelGitHub(g, ctx)),
    h('div', { class: 'pilha' }, painelAnotador(a, ctx), painelOutraIA(), painelSobre(ctx))));
  return { titulo: 'Ajustes' };
}
