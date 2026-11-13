// A marca no painel: nome, cor principal e logo (negocio/marca.md e arquivos/marca/).
'use strict';

const fs = require('fs');
const path = require('path');
const md = require('./md');
const { RAIZ, dentro, relativo, existe } = require('./raiz');
const pref = require('./preferencias');
const { ErroPainel } = require('./erro');

const ARQ_MARCA = path.join(RAIZ, 'negocio', 'marca.md');
const ARQ_EMPRESA = path.join(RAIZ, 'negocio', 'empresa.md');
const PASTA_LOGO = path.join(RAIZ, 'arquivos', 'marca');
const IMAGENS = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

function campo(abs, nome) {
  if (!existe(abs)) return '';
  const c = md.campoPorNome(md.ler(abs).linhas, nome);
  return c && c.preenchido ? c.valor : '';
}

function corValida(v) {
  const m = /#([0-9a-f]{6}|[0-9a-f]{3})\b/i.exec(String(v || ''));
  if (!m) return '';
  let h = m[1].toLowerCase();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return `#${h}`;
}

function acharLogo() {
  const indicado = campo(ARQ_MARCA, 'logo').replace(/^`|`$/g, '');
  const abs = indicado ? dentro(indicado) : null;
  if (abs && existe(abs) && IMAGENS[path.extname(abs).toLowerCase()]) return abs;
  for (const ext of Object.keys(IMAGENS)) {
    const p = path.join(PASTA_LOGO, `logo${ext}`);
    if (existe(p)) return p;
  }
  return null;
}

function lerMarca() {
  const logo = acharLogo();
  const usar = pref.ler('usar as cores da marca');
  return {
    nome: pref.ler('nome no painel') || campo(ARQ_EMPRESA, 'nome do negocio'),
    nomeNoPainel: pref.ler('nome no painel'),
    dono: campo(ARQ_EMPRESA, 'seu nome'),
    cor: corValida(campo(ARQ_MARCA, 'cor principal')),
    corApoio: corValida(campo(ARQ_MARCA, 'cor de apoio')),
    usarCores: !pref.nao(usar),
    logo: logo ? { caminho: relativo(logo), versao: Math.round(fs.statSync(logo).mtimeMs) } : null,
  };
}

function salvarMarca({ cor, usarCores, nomeNoPainel } = {}) {
  if (cor !== undefined) {
    const c = corValida(cor);
    if (cor && !c) throw new ErroPainel('Cor inválida. Use o código com #, por exemplo #E0136E.');
    if (!existe(ARQ_MARCA)) throw new ErroPainel('Não achei negocio/marca.md.', 404);
    const { linhas, eol } = md.ler(ARQ_MARCA);
    md.trocarCampoPorNome(linhas, 'cor principal', c, { rotuloNovo: 'Cor principal', secaoNova: 'Visual' });
    md.gravar(ARQ_MARCA, linhas, eol);
  }
  if (usarCores !== undefined) pref.gravar('usar as cores da marca', usarCores ? 'sim' : 'não', 'Usar as cores da marca no painel');
  if (nomeNoPainel !== undefined) pref.gravar('nome no painel', md.limparValor(nomeNoPainel), 'Nome no painel (opcional)');
  return lerMarca();
}

function salvarLogo({ dados, remover } = {}) {
  fs.mkdirSync(PASTA_LOGO, { recursive: true });
  for (const ext of Object.keys(IMAGENS)) {
    const p = path.join(PASTA_LOGO, `logo${ext}`);
    if (existe(p)) fs.unlinkSync(p);
  }
  let caminho = '';
  if (!remover) {
    const m = /^data:(image\/(png|jpeg|svg\+xml|webp));base64,(.+)$/.exec(String(dados || ''));
    if (!m) throw new ErroPainel('Use uma imagem PNG, JPG, SVG ou WEBP.');
    const buf = Buffer.from(m[3], 'base64');
    if (buf.length > 5 * 1024 * 1024) throw new ErroPainel('Imagem grande demais. Use uma de até 5 MB.');
    const ext = { png: '.png', jpeg: '.jpg', 'svg+xml': '.svg', webp: '.webp' }[m[2]];
    const abs = path.join(PASTA_LOGO, `logo${ext}`);
    fs.writeFileSync(abs, buf);
    caminho = relativo(abs);
  }
  if (existe(ARQ_MARCA)) {
    const { linhas, eol } = md.ler(ARQ_MARCA);
    md.trocarCampoPorNome(linhas, 'logo', caminho, { rotuloNovo: 'Logo', secaoNova: 'Visual' });
    md.gravar(ARQ_MARCA, linhas, eol);
  }
  return lerMarca();
}

module.exports = { lerMarca, salvarMarca, salvarLogo, acharLogo, IMAGENS };
