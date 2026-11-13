// Um arquivo: perguntas viram formulário, o resto aparece como documento.
// "Editar o texto" abre o arquivo inteiro pra mexer à mão.
import { h, ic, api, aviso, falhou, cabeca, markdown, ligarCaixas, separarRotulo, copiar, quandoFoi, esc } from '../ui.js';
import { semCabecalho } from './area.js';

function voltaDe(f) {
  if (f.area) return { href: `#/area/${encodeURIComponent(f.area.id)}`, texto: f.area.nome };
  if (f.caminho.startsWith('memoria/')) return { href: '#/area/negocio', texto: 'Meu negócio' };
  return { href: '#/dashboard', texto: 'Dashboard' };
}

function pedidoDe(f) {
  if (f.tipo === 'configurar') return `Vamos preencher "${f.titulo}" (${f.caminho}). Me faça as perguntas que faltam, uma de cada vez, e anote as respostas no arquivo.`;
  return `Leia ${f.caminho} e me diga, em poucas linhas, o que tem de importante e o que está faltando.`;
}

// ---------- formulário ----------

function formulario(f, ctx, estado) {
  const linhas = semCabecalho(f.texto).split(/\r?\n/);
  const porLinha = new Map(f.campos.map((c) => [c.linha, c]));
  const blocos = [];
  let buffer = [];
  let campos = [];
  const fecharTexto = () => { if (buffer.join('').trim()) blocos.push({ tipo: 'texto', texto: buffer.join('\n') }); buffer = []; };
  const fecharCampos = () => { if (campos.length) blocos.push({ tipo: 'campos', campos }); campos = []; };
  linhas.forEach((l, i) => {
    if (porLinha.has(i)) { fecharTexto(); campos.push(porLinha.get(i)); }
    else { fecharCampos(); buffer.push(l); }
  });
  fecharTexto();
  fecharCampos();

  const contador = h('span', { class: 'suave pequeno' });
  const salvar = h('button', { type: 'button', class: 'botao principal', onclick: () => gravar() }, ic('check'), 'Salvar');
  const barraSalvar = h('div', { class: 'barra-salvar vidro', hidden: true },
    contador,
    h('div', { class: 'chips' },
      h('button', { type: 'button', class: 'botao leve', onclick: () => { estado.mudancas.clear(); ctx.recarregar({ silencioso: true }); } }, 'Descartar'),
      salvar));

  const atualizarBarra = () => {
    const n = estado.mudancas.size;
    barraSalvar.hidden = n === 0;
    contador.textContent = `${n} ${n === 1 ? 'resposta mudou' : 'respostas mudaram'}`;
  };

  async function gravar() {
    if (!estado.mudancas.size) return;
    salvar.disabled = true;
    try {
      const r = await api('/api/arquivo/campos', { caminho: f.caminho, mudancas: [...estado.mudancas.values()] });
      if (r.naoAchou && r.naoAchou.length) aviso(`Não achei: ${r.naoAchou.join(', ')}. O arquivo mudou; confira.`, { erro: true });
      else aviso(r.tipo === 'configurar' && r.pct >= 100 ? 'Salvo. Esta parte está pronta.' : 'Salvo.');
      estado.mudancas.clear();
      await ctx.recarregar({ silencioso: true });
    } catch (e) {
      falhou(e);
      salvar.disabled = false;
    }
  }
  estado.gravar = gravar;

  const ajustarAltura = (t) => { t.style.height = 'auto'; t.style.height = `${t.scrollHeight + 2}px`; };
  const todos = [];

  const el = h('div', null, blocos.map((b) => {
    if (b.tipo === 'texto') {
      const doc = h('div', { class: 'doc', html: markdown(b.texto, { base: f.caminho.split('/').slice(0, -1).join('/') }) });
      return doc;
    }
    return h('div', { class: 'form-secao' }, b.campos.map((c) => {
      const { nome, dica } = separarRotulo(c.nome);
      const id = `campo-${c.linha}`;
      const caixa = h('textarea', {
        class: 'entrada',
        id,
        rows: '1',
        placeholder: c.opcional ? 'Opcional' : 'Sua resposta',
        oninput: () => {
          ajustarAltura(caixa);
          const chave = `${c.secao}|${c.rotulo}`;
          if (caixa.value.trim() === c.valor.trim()) estado.mudancas.delete(chave);
          else estado.mudancas.set(chave, { secao: c.secao, rotulo: c.rotulo, valor: caixa.value });
          atualizarBarra();
        },
        onkeydown: (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const prox = todos[todos.indexOf(caixa) + 1];
            if (prox) prox.focus(); else gravar();
          }
        },
      }, c.valor);
      todos.push(caixa);
      return h('div', { class: 'pergunta' },
        h('label', { for: id },
          h('span', { class: `ponto${c.preenchido || c.opcional ? ' ok' : ''}`, title: c.preenchido ? 'Respondida' : 'Falta responder' }),
          h('span', null, nome, dica ? h('span', { class: 'dica' }, dica) : null, c.opcional ? h('span', { class: 'dica' }, 'opcional') : null)),
        caixa);
    }));
  }), barraSalvar);

  estado.depois = () => todos.forEach(ajustarAltura);
  return el;
}

// ---------- editor de texto ----------

function editorDeTexto(f, ctx, estado) {
  const caixa = h('textarea', {
    class: 'entrada',
    spellcheck: 'false',
    style: 'min-height:62vh;font-family:var(--fonte-mono);font-size:13.5px;line-height:1.6;resize:vertical',
    'aria-label': `Texto de ${f.caminho}`,
    oninput: () => { estado.sujo = caixa.value !== f.texto; },
  }, f.texto);
  const salvar = async () => {
    try {
      await api('/api/arquivo/texto', { caminho: f.caminho, texto: caixa.value, versao: f.versao });
      estado.sujo = false;
      aviso('Salvo.');
      ctx.navegar(`#/arquivo?c=${encodeURIComponent(f.caminho)}`);
    } catch (e) { falhou(e); }
  };
  estado.gravar = salvar;
  return h('section', { class: 'painel vidro' },
    h('p', { class: 'suave pequeno', style: 'margin:0 0 10px' }, 'Você está mexendo no arquivo de verdade. Mantenha os formatos (as perguntas, os "##" e os "- "), porque a IA e o painel leem por eles.'),
    caixa,
    h('div', { class: 'chips', style: 'margin-top:12px;justify-content:flex-end' },
      h('a', { class: 'botao leve', href: `#/arquivo?c=${encodeURIComponent(f.caminho)}` }, 'Cancelar'),
      h('button', { type: 'button', class: 'botao principal', onclick: salvar }, ic('check'), 'Salvar o texto')));
}

// ---------- planilha (.csv) ----------

function tabelaCsv(texto) {
  const linhas = String(texto).split(/\r?\n/).filter((l) => l.trim()).slice(0, 300);
  const sep = (linhas[0] || '').split(';').length > (linhas[0] || '').split(',').length ? ';' : ',';
  const partir = (l) => {
    const out = [];
    let atual = '';
    let aspas = false;
    for (const ch of l) {
      if (ch === '"') aspas = !aspas;
      else if (ch === sep && !aspas) { out.push(atual); atual = ''; }
      else atual += ch;
    }
    out.push(atual);
    return out;
  };
  const [cab, ...corpo] = linhas.map(partir);
  const html = `<table><thead><tr>${(cab || []).map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${corpo.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  return h('div', { class: 'doc', html });
}

// ---------- tela ----------

export async function montar(alvo, ctx) {
  const caminho = ctx.rota.params.get('c') || '';
  const editar = ctx.rota.params.get('editar') === '1';
  const f = await api(`/api/arquivo?caminho=${encodeURIComponent(caminho)}`);
  const estado = { mudancas: new Map(), sujo: false, gravar: null, depois: null };
  const ehMd = /\.md$/i.test(f.caminho);

  const acoes = [];
  if (ehMd && !editar) acoes.push(h('a', { class: 'botao', href: `#/arquivo?c=${encodeURIComponent(f.caminho)}&editar=1` }, ic('lapis'), 'Editar o texto'));
  if (f.tipo === 'kanban') acoes.push(h('a', { class: 'botao', href: `#/kanban?q=${encodeURIComponent(f.caminho)}` }, ic('colunas'), 'Abrir no Kanban'));
  acoes.push(h('button', { type: 'button', class: 'botao', onclick: () => copiar(pedidoDe(f)) }, ic('ia'), 'Pedir pra IA'));

  alvo.append(cabeca({ titulo: f.titulo, texto: f.descricao, volta: voltaDe(f), acoes }));

  const rodape = h('p', { class: 'fraco pequeno' }, `Arquivo: ${f.caminho}${f.atualizado ? `. Mudou ${quandoFoi(f.atualizado)}.` : ''}`);

  if (editar) {
    alvo.append(editorDeTexto(f, ctx, estado), rodape);
  } else if (/\.csv$/i.test(f.caminho)) {
    alvo.append(h('section', { class: 'painel vidro' }, tabelaCsv(f.texto)), rodape);
  } else if (!ehMd) {
    alvo.append(h('section', { class: 'painel vidro' }, h('pre', { style: 'white-space:pre-wrap;margin:0;font-family:var(--fonte-mono);font-size:13px' }, f.texto)), rodape);
  } else {
    const temCampos = f.tipo === 'configurar' && f.campos.length;
    const corpo = temCampos ? formulario(f, ctx, estado) : h('div', { class: 'doc', html: markdown(semCabecalho(f.texto), { base: f.caminho.split('/').slice(0, -1).join('/') }) });
    if (!temCampos) ligarCaixas(corpo, semCabecalho(f.texto), f.caminho, () => ctx.recarregar({ silencioso: true }));
    const caixa = h('section', { class: 'painel vidro' }, corpo);
    const verIA = h('button', {
      type: 'button',
      class: 'botao leve pequeno',
      onclick: () => {
        const ligado = caixa.classList.toggle('mostrar-ia');
        verIA.lastChild.textContent = ligado ? 'Esconder as instruções pra IA' : 'Ver as instruções pra IA';
      },
    }, ic('olho'), h('span', null, 'Ver as instruções pra IA'));
    alvo.append(caixa, h('div', { class: 'chips', style: 'justify-content:space-between;margin-top:10px' }, rodape, verIA));
  }

  const teclas = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' && estado.gravar) { e.preventDefault(); estado.gravar(); }
  };
  document.addEventListener('keydown', teclas);
  window.addEventListener('hashchange', () => document.removeEventListener('keydown', teclas), { once: true });

  return {
    titulo: f.titulo,
    depois: () => estado.depois && estado.depois(),
    podeRecarregar: () => estado.mudancas.size === 0 && !estado.sujo,
  };
}
