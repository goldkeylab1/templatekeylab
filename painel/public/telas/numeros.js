// Números: o número principal de cada conteúdo ao longo do tempo, lido dos placares (marketing/numeros/).
// Uma série só (a cor da marca), uma barra por conteúdo, a linha da mediana e a tabela pra quem prefere ler.
import { h, ic, api, cabeca, vazio, pedido, copiar, hoje, somarDias, dataDe, dataCurta, nomeDoMes, pedirIA } from '../ui.js';

const filtro = { periodo: 'tudo', rede: '', metrica: null };
const SVG = 'http://www.w3.org/2000/svg';

function s(tag, attrs = {}, ...filhos) {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const f of filhos) if (f != null) el.append(f instanceof Node ? f : document.createTextNode(String(f)));
  return el;
}

function formatar(n) {
  return Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

function compacto(n) {
  const a = Math.abs(n);
  if (a >= 1e6) return `${formatar(Math.round((n / 1e6) * 10) / 10)} mi`;
  if (a >= 1e4) return `${formatar(Math.round((n / 1e3) * 10) / 10)} mil`;
  return formatar(n);
}

function mediana(vals) {
  if (!vals.length) return 0;
  const o = [...vals].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

// Escala "redonda": 0, 5 mil, 10 mil...
function escala(max) {
  if (max <= 0) return { topo: 1, passo: 1 };
  const bruto = max / 4;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * pot).find((p) => p >= bruto) || bruto;
  return { topo: Math.ceil(max / passo) * passo, passo };
}

function dataPequena(iso) {
  const d = dataDe(iso);
  return `${d.getDate()} ${nomeDoMes(d.getMonth(), false)}`;
}

function nomeDaMetrica(m) {
  return m || 'número principal';
}

function grafico(caixa, pontos, unidade) {
  const largura = Math.max(320, caixa.clientWidth || 800);
  const altura = 280;
  const comMediana = pontos.length > 2;
  const m = { cima: 22, dir: comMediana ? 76 : 16, baixo: 30, esq: 52 };
  const larg = largura - m.esq - m.dir;
  const alt = altura - m.cima - m.baixo;
  const max = Math.max(...pontos.map((p) => p.valor), 0);
  const { topo, passo } = escala(max);
  const y = (v) => m.cima + alt - (v / topo) * alt;
  const faixa = larg / pontos.length;
  const barra = Math.max(2, Math.min(24, faixa - 2));
  const med = mediana(pontos.map((p) => p.valor));
  const melhor = pontos.reduce((a, b) => (b.valor > a.valor ? b : a), pontos[0]);

  const svg = s('svg', { viewBox: `0 0 ${largura} ${altura}`, width: largura, height: altura, class: 'grafico-svg', role: 'img', 'aria-label': `${nomeDaMetrica(unidade)} de ${pontos.length} conteúdos. Mediana ${formatar(med)}.` });

  // grade e eixo y
  for (let v = 0; v <= topo + passo / 2; v += passo) {
    const yy = Math.round(y(v)) + 0.5;
    svg.append(s('line', { x1: m.esq, x2: largura - m.dir, y1: yy, y2: yy, class: v === 0 ? 'eixo' : 'grade' }));
    svg.append(s('text', { x: m.esq - 8, y: yy + 4, 'text-anchor': 'end', class: 'rotulo-eixo' }, compacto(v)));
  }

  // datas no eixo x (algumas, pra não embolar)
  const cabe = Math.max(1, Math.floor(larg / 70));
  const pulo = Math.max(1, Math.ceil(pontos.length / cabe));
  pontos.forEach((p, i) => {
    if (i % pulo !== 0 && i !== pontos.length - 1) return;
    if (i !== pontos.length - 1 && pontos.length - 1 - i < pulo && i !== 0) return;
    const x = m.esq + faixa * i + faixa / 2;
    svg.append(s('text', { x, y: altura - 8, 'text-anchor': 'middle', class: 'rotulo-eixo' }, dataPequena(p.data)));
  });

  // barras (cantos redondos só em cima)
  const dica = h('div', { class: 'dica-grafico', hidden: true, role: 'tooltip' });
  const mostrar = (p, x, yTopo) => {
    dica.replaceChildren(
      h('b', null, `${formatar(p.valor)}${p.unidade ? ` ${p.unidade}` : ''}`),
      h('div', null, p.conteudo),
      h('div', { class: 'fraco' }, [dataCurta(p.data), p.rede].filter(Boolean).join(' · ')));
    dica.hidden = false;
    const w = dica.offsetWidth;
    dica.style.left = `${Math.max(0, Math.min(largura - w, x - w / 2))}px`;
    dica.style.top = `${Math.max(0, yTopo - dica.offsetHeight - 10)}px`;
  };
  const esconder = () => { dica.hidden = true; };

  pontos.forEach((p, i) => {
    const cx = m.esq + faixa * i + faixa / 2;
    const x = cx - barra / 2;
    const yt = y(p.valor);
    const hgt = Math.max(1, m.cima + alt - yt);
    const r = Math.min(4, barra / 2, hgt);
    const d = `M${x},${m.cima + alt}V${yt + r}Q${x},${yt} ${x + r},${yt}H${x + barra - r}Q${x + barra},${yt} ${x + barra},${yt + r}V${m.cima + alt}Z`;
    const g = s('g', { class: 'barra-g', tabindex: '0', role: 'img', 'aria-label': `${p.conteudo}, ${dataCurta(p.data)}: ${formatar(p.valor)} ${p.unidade || ''}` },
      s('rect', { x: m.esq + faixa * i, y: m.cima, width: faixa, height: alt, class: 'alvo-barra' }),
      s('path', { d, class: `barra-dado${p === melhor ? ' melhor' : ''}` }));
    g.addEventListener('pointerenter', () => mostrar(p, cx, yt));
    g.addEventListener('pointerleave', esconder);
    g.addEventListener('focus', () => mostrar(p, cx, yt));
    g.addEventListener('blur', esconder);
    svg.append(g);
  });

  // mediana
  // mediana: a linha atravessa o gráfico e o rótulo fica do lado de fora, à direita (não cobre barra nenhuma)
  if (comMediana) {
    const ym = Math.round(y(med)) + 0.5;
    const xf = largura - m.dir;
    svg.append(s('line', { x1: m.esq, x2: xf + 4, y1: ym, y2: ym, class: 'linha-mediana' }));
    svg.append(s('text', { x: xf + 10, y: ym - 2, class: 'rotulo-mediana' }, 'mediana'));
    svg.append(s('text', { x: xf + 10, y: ym + 12, class: 'rotulo-mediana forte' }, compacto(med)));
  }

  // só o melhor ganha o número em cima
  const im = pontos.indexOf(melhor);
  svg.append(s('text', { x: m.esq + faixa * im + faixa / 2, y: y(melhor.valor) - 7, 'text-anchor': 'middle', class: 'rotulo-melhor' }, compacto(melhor.valor)));

  caixa.replaceChildren(svg, dica);
}

function tabela(pontos) {
  const ordem = [...pontos].sort((a, b) => b.valor - a.valor);
  return h('div', { class: 'doc' }, h('table', null,
    h('thead', null, h('tr', null, h('th', null, '#'), h('th', null, 'Conteúdo'), h('th', null, 'Data'), h('th', null, 'Rede'), h('th', { style: 'text-align:right' }, 'Número'))),
    h('tbody', null, ordem.map((p, i) => h('tr', null,
      h('td', { class: 'fraco' }, String(i + 1)),
      h('td', null, p.conteudo),
      h('td', { style: 'white-space:nowrap' }, dataCurta(p.data)),
      h('td', null, p.rede || ''),
      h('td', { style: 'text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap' }, `${formatar(p.valor)}${p.unidade ? ` ${p.unidade}` : ''}`))))));
}

export async function montar(alvo, ctx) {
  const d = await api('/api/numeros');

  alvo.append(cabeca({
    titulo: 'Números',
    texto: 'O número principal de cada conteúdo, tirado dos placares que a IA escreve.',
    volta: { href: '#/area/marketing', texto: 'Marketing' },
    acoes: [h('button', { type: 'button', class: 'botao', onclick: () => pedirIA('Analise os meus números (vou mandar o arquivo ou o print).') }, ic('ia'), 'Analisar com a IA')],
  }));

  if (!d.pontos.length) {
    alvo.append(h('section', { class: 'painel vidro' }, vazio({
      titulo: d.placares.length ? 'Os placares ainda não têm números' : 'Nenhum placar ainda',
      texto: 'Mande os números da rede pra IA (arquivo ou print). Ela escreve o placar e o gráfico aparece aqui.',
      pedido: 'Analise os meus números (vou mandar o arquivo ou o print).',
    })));
    return { titulo: 'Números' };
  }

  if (!filtro.metrica || !d.metricas.some((m) => m.nome === filtro.metrica)) filtro.metrica = d.metricas[0].nome;
  const redes = [...new Set(d.pontos.map((p) => p.rede).filter(Boolean))];
  if (filtro.rede && !redes.includes(filtro.rede)) filtro.rede = '';

  const corte = filtro.periodo === '30' ? somarDias(hoje(), -30) : filtro.periodo === '90' ? somarDias(hoje(), -90) : '';
  const pontos = d.pontos.filter((p) => p.unidade === filtro.metrica
    && (!filtro.rede || p.rede === filtro.rede)
    && (!corte || p.data >= corte));

  // filtros: uma linha só, em cima de tudo
  const seg = (opcoes, atual, mudar, rotulo) => h('div', { class: 'segmentado', role: 'group', 'aria-label': rotulo }, opcoes.map(([v, nome]) => h('button', {
    type: 'button',
    'aria-pressed': String(atual === v),
    onclick: () => { mudar(v); ctx.recarregar({ silencioso: true }); },
  }, nome)));
  alvo.append(h('div', { class: 'filtros-linha' },
    seg([['30', '30 dias'], ['90', '90 dias'], ['tudo', 'Tudo']], filtro.periodo, (v) => { filtro.periodo = v; }, 'Período'),
    redes.length > 1 ? seg([['', 'Todas as redes'], ...redes.map((r) => [r, r])], filtro.rede, (v) => { filtro.rede = v; }, 'Rede') : null,
    d.metricas.length > 1 ? h('select', {
      class: 'entrada',
      style: 'width:auto',
      'aria-label': 'Número',
      onchange: (e) => { filtro.metrica = e.target.value; ctx.recarregar({ silencioso: true }); },
    }, d.metricas.map((m) => h('option', { value: m.nome, selected: m.nome === filtro.metrica }, `${nomeDaMetrica(m.nome)} (${m.n})`))) : null));

  const vals = pontos.map((p) => p.valor);
  const melhor = pontos.length ? pontos.reduce((a, b) => (b.valor > a.valor ? b : a)) : null;
  alvo.append(h('div', { class: 'numeros' },
    h('div', { class: 'numero vidro' }, h('div', { class: 'valor' }, String(pontos.length)), h('div', { class: 'nome' }, 'Conteúdos')),
    h('div', { class: 'numero vidro' }, h('div', { class: 'valor' }, pontos.length ? compacto(mediana(vals)) : '-'), h('div', { class: 'nome' }, `Mediana (${nomeDaMetrica(filtro.metrica)})`)),
    h('div', { class: 'numero vidro' }, h('div', { class: 'valor' }, melhor ? compacto(melhor.valor) : '-'), h('div', { class: 'nome', title: melhor ? melhor.conteudo : '' }, melhor ? `Melhor: ${melhor.conteudo}` : 'Melhor')),
    h('div', { class: 'numero vidro' }, h('div', { class: 'valor' }, String(d.placares.length)), h('div', { class: 'nome' }, d.placares[0] ? `Placares (último ${dataCurta(d.placares[0].data)})` : 'Placares'))));

  const caixa = h('div', { class: 'grafico' });
  alvo.append(h('section', { class: 'painel vidro' },
    h('div', { class: 'painel-cabeca' },
      h('div', null,
        h('h2', null, `${nomeDaMetrica(filtro.metrica).replace(/^./, (c) => c.toUpperCase())} por conteúdo`),
        h('p', { class: 'suave pequeno', style: 'margin:4px 0 0' }, 'Cada barra é um conteúdo, na ordem em que foi publicado. Passe o mouse pra ver qual é.'))),
    pontos.length ? caixa : h('p', { class: 'fraco', style: 'margin:0' }, 'Nenhum conteúdo nesse filtro.')));

  if (pontos.length) {
    alvo.append(h('section', { class: 'painel vidro' },
      h('details', null,
        h('summary', { class: 'botao leve pequeno', style: 'display:inline-flex' }, ic('tabela'), 'Ver em tabela (do melhor pro pior)'),
        h('div', { style: 'margin-top:10px' }, tabela(pontos)))));
  }

  alvo.append(h('div', { class: 'grade-2', style: 'margin-top:18px' },
    h('section', { class: 'painel vidro' },
      h('div', { class: 'painel-cabeca' }, h('h2', null, 'Placares')),
      h('div', { class: 'pedidos' }, d.placares.map((p) => h('a', { class: 'arquivo-item', href: `#/arquivo?c=${encodeURIComponent(p.caminho)}` },
        h('span', { class: 'ico-arq' }, ic('grafico')),
        h('span', { class: 'corpo' }, h('span', { class: 't', style: 'display:block' }, p.titulo), h('span', { class: 'd', style: 'display:block' }, `${p.conteudos} ${p.conteudos === 1 ? 'conteúdo' : 'conteúdos'}`)),
        h('span', { class: 'fraco' }, ic('seta')))))),
    h('section', { class: 'painel vidro' },
      h('h2', null, 'Peça pra IA'),
      h('div', { class: 'pedidos', style: 'margin-top:12px' },
        pedido('Analise os meus números (vou mandar o arquivo ou o print).'),
        pedido('O que os meus 3 melhores conteúdos têm em comum que os 3 piores não têm?'),
        pedido('Qual teste eu faço agora? Olhe os meus números e o o-que-funciona.md.')),
      d.arquivos.length ? h('div', { style: 'margin-top:16px' },
        h('h3', null, 'Arquivos de números'),
        h('ul', { class: 'lista' }, d.arquivos.slice(0, 8).map((a) => h('li', { class: 'linha' },
          h('a', { href: `#/arquivo?c=${encodeURIComponent(a.caminho)}`, style: 'text-decoration:none' }, a.nome))))) : null)));

  let observador = null;
  return {
    titulo: 'Números',
    depois: () => {
      if (!pontos.length) return;
      grafico(caixa, pontos, filtro.metrica);
      let largura = caixa.clientWidth;
      observador = new ResizeObserver(() => {
        if (!caixa.isConnected) { observador.disconnect(); return; }
        if (Math.abs(caixa.clientWidth - largura) < 8) return;
        largura = caixa.clientWidth;
        grafico(caixa, pontos, filtro.metrica);
      });
      observador.observe(caixa);
      window.addEventListener('hashchange', () => observador && observador.disconnect(), { once: true });
    },
  };
}
