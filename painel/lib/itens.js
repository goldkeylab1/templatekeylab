// Texto de uma tarefa ou cartão: "Gravar o vídeo @10/11 #marketing ✓ 09/11 14:32"
//   @DD/MM ou @DD/MM/AAAA  → data
//   #palavra               → área (pode ter mais de uma)
//   ✓ DD/MM HH:MM no fim   → quando foi feito
'use strict';

const { dataDeTexto, isoParaCurta, doisDigitos, semAcento, limparValor } = require('./md');

const RE_DATA = /(^|\s)@(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=$|[\s.,;:!?)])/;
const RE_TAG = /(^|\s)#([\p{L}][\p{L}\p{N}_-]*)/gu;
const RE_FEITO = /\s*✓\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:\s+(\d{1,2})[:h](\d{2}))?\s*$/;

function analisarTexto(bruto) {
  let t = String(bruto || '');
  let feitoEm = null;
  const f = RE_FEITO.exec(t);
  if (f) {
    const iso = dataDeTexto(f[1], f[2], f[3], { passado: true });
    if (iso) feitoEm = f[4] ? `${iso}T${doisDigitos(f[4])}:${f[5]}` : iso;
    t = t.slice(0, f.index);
  }
  let data = null;
  const d = RE_DATA.exec(t);
  if (d) {
    data = dataDeTexto(d[2], d[3], d[4]);
    t = t.slice(0, d.index) + (d[1] || '') + t.slice(d.index + d[0].length);
  }
  const areas = [];
  t = t.replace(RE_TAG, (_m, antes, nome) => { areas.push(nome); return antes; });
  t = t.replace(/\s{2,}/g, ' ').trim();
  return { texto: t, data, areas, feitoEm };
}

function limparTag(a) {
  return semAcento(String(a || '')).toLowerCase().replace(/^#/, '').replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
}

function montarTexto({ texto, data, areas = [], feitoEm = null }) {
  const partes = [limparValor(texto)];
  if (data) partes.push(`@${isoParaCurta(data)}`);
  for (const a of areas || []) {
    const s = limparTag(a);
    if (s) partes.push(`#${s}`);
  }
  let s = partes.filter(Boolean).join(' ');
  if (feitoEm) {
    const [iso, hora] = feitoEm.split('T');
    s += ` ✓ ${isoParaCurta(iso)}${hora ? ` ${hora}` : ''}`;
  }
  return s;
}

function agoraISO() {
  const d = new Date();
  const iso = `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
  return `${iso}T${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
}

module.exports = { analisarTexto, montarTexto, limparTag, agoraISO };
