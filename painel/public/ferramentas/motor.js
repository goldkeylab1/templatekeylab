// O que roda no navegador nas Ferramentas: a transcrição (o Whisper, num worker), abrir o som de um arquivo e tirar as
// fotos das cenas de um vídeo. Nada sai do computador: o painel só grava o resultado na pasta.
import { api } from '../ui.js';

// ---------- os modelos de transcrição ----------
// Tudo é o Whisper (da OpenAI, licença MIT), convertido pra rodar no navegador pela comunidade ONNX do Hugging Face.
// Os tamanhos (em MB) são os dos arquivos baixados na primeira vez; depois ficam guardados no navegador.
export const MODELOS = {
  leve: {
    nome: 'Leve',
    id: 'onnx-community/whisper-base',
    resumo: 'Baixa rápido e roda em qualquer computador. Erra mais em nome e palavra difícil.',
    webgpu: { f16: { dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' }, mb: 206 }, f32: { dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' }, mb: 206 } },
    wasm: { dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' }, mb: 77 },
  },
  rapida: {
    nome: 'Rápido',
    id: 'onnx-community/whisper-small',
    resumo: 'Acerta bem a fala do dia a dia. O melhor sem placa de vídeo.',
    webgpu: { f16: { dtype: { encoder_model: 'fp16', decoder_model_merged: 'q4' }, mb: 410 }, f32: { dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' }, mb: 586 } },
    wasm: { dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' }, mb: 249 },
  },
  precisa: {
    nome: 'Preciso',
    id: 'onnx-community/whisper-large-v3-turbo',
    resumo: 'O melhor: pontuação, nome próprio e número. Pede placa de vídeo.',
    webgpu: { f16: { dtype: { encoder_model: 'q4f16', decoder_model_merged: 'q4f16' }, mb: 563 }, f32: { dtype: { encoder_model: 'q4', decoder_model_merged: 'q4' }, mb: 759 } },
    wasm: { dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' }, mb: 1085 },
  },
};

export const IDIOMAS = [
  ['portuguese', 'Português'], ['english', 'Inglês'], ['spanish', 'Espanhol'], ['french', 'Francês'], ['italian', 'Italiano'],
  ['german', 'Alemão'], ['japanese', 'Japonês'], ['korean', 'Coreano'], ['chinese', 'Chinês'], ['russian', 'Russo'],
  ['arabic', 'Árabe'], ['hindi', 'Hindi'],
];

// O que o navegador consegue: placa de vídeo pelo WebGPU (e se ela aceita meia precisão), memória, se é celular
export async function detectar() {
  const r = {
    webgpu: false,
    f16: false,
    memoria: navigator.deviceMemory || null,
    celular: /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent),
  };
  try {
    const adaptador = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
    if (adaptador) { r.webgpu = true; r.f16 = adaptador.features.has('shader-f16'); }
  } catch { /* sem placa */ }
  return r;
}

export function recomendado(ap) {
  if (ap.webgpu && !ap.celular) return 'precisa';
  if (ap.celular || (ap.memoria && ap.memoria <= 4)) return 'leve';
  return 'rapida';
}

export function montagem(chave, ap) {
  const m = MODELOS[chave] || MODELOS.rapida;
  if (ap && ap.webgpu) {
    const v = ap.f16 ? m.webgpu.f16 : m.webgpu.f32;
    return { id: m.id, device: 'webgpu', dtype: v.dtype, mb: v.mb, chave };
  }
  return { id: m.id, device: 'wasm', dtype: m.wasm.dtype, mb: m.wasm.mb, chave };
}

// Se o modelo já está guardado no navegador (sem perguntar nada pra internet)
const SUFIXO = { fp32: '', fp16: '_fp16', q8: '_quantized', int8: '_int8', uint8: '_uint8', q4: '_q4', q4f16: '_q4f16', bnb4: '_bnb4' };
export async function estaGuardado(mt) {
  try {
    if (!self.caches) return false;
    const cache = await caches.open('transformers-cache');
    const base = `https://huggingface.co/${mt.id}/resolve/main/onnx/`;
    for (const [parte, dtype] of Object.entries(mt.dtype)) {
      if (!(await cache.match(`${base}${parte}${SUFIXO[dtype] ?? ''}.onnx`))) return false;
    }
    return true;
  } catch { return false; }
}

// ---------- o som: 16 mil amostras por segundo, um canal, que é o que o Whisper ouve ----------

const TAXA = 16000;
const LIMITE = 400 * 1024 * 1024; // acima disso, o navegador teria que pôr o arquivo inteiro na memória

export async function abrirSom(blob) {
  if (blob.size > LIMITE) throw new Error('Esse arquivo é grande demais pra abrir no navegador (mais de 400 MB). Corte um pedaço ou mande só o áudio.');
  const dados = await blob.arrayBuffer();
  const Contexto = window.AudioContext || window.webkitAudioContext;
  let ctx;
  try { ctx = new Contexto({ sampleRate: TAXA }); } catch { ctx = new Contexto(); }
  try {
    let buffer;
    try { buffer = await ctx.decodeAudioData(dados); } catch {
      throw new Error('O navegador não conseguiu abrir o som desse arquivo. Tente no Chrome, ou converta pra MP3 ou MP4.');
    }
    if (buffer.sampleRate !== TAXA) {
      const off = new OfflineAudioContext(1, Math.ceil(buffer.duration * TAXA), TAXA);
      const fonte = off.createBufferSource();
      fonte.buffer = buffer;
      fonte.connect(off.destination);
      fonte.start();
      buffer = await off.startRendering();
    }
    if (buffer.numberOfChannels === 1) return buffer.getChannelData(0).slice();
    const n = buffer.length;
    const r = new Float32Array(n);
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const d = buffer.getChannelData(c);
      for (let i = 0; i < n; i++) r[i] += d[i];
    }
    for (let i = 0; i < n; i++) r[i] /= buffer.numberOfChannels;
    return r;
  } finally {
    try { ctx.close(); } catch { /* já fechado */ }
  }
}

export const segundosDe = (som) => som.length / TAXA;

// ---------- a ponte com o worker do Whisper ----------

export class Transcritor {
  constructor(aoEvento) {
    this.aoEvento = aoEvento;
    this.worker = null;
    this.espera = null;
    this.carregado = null;
  }

  _worker() {
    if (this.worker) return this.worker;
    this.worker = new Worker('/ferramentas/whisper.worker.js', { type: 'module' });
    this.worker.onmessage = ({ data }) => this._mensagem(data);
    this.worker.onerror = (e) => {
      if (e.preventDefault) e.preventDefault();
      this._morreu(new Error(e.message || 'O transcritor parou de responder. Pode ter faltado memória.'));
    };
    return this.worker;
  }

  _morreu(erro) {
    try { if (this.worker) this.worker.terminate(); } catch { /* já parou */ }
    this.worker = null;
    this.carregado = null;
    if (this.espera) { const { falha } = this.espera; this.espera = null; falha(erro); }
  }

  _mensagem(d) {
    if (['baixando', 'preparando', 'tentando', 'parcial'].includes(d.tipo)) { this.aoEvento(d); return; }
    if (!this.espera) return;
    const { tipos, ok, falha } = this.espera;
    if (d.tipo === 'erro') { this.espera = null; falha(new Error(d.mensagem)); return; }
    if (tipos.includes(d.tipo)) { this.espera = null; ok(d); }
  }

  _esperar(tipos, msg, transferir) {
    if (this.espera) return Promise.reject(new Error('O transcritor já está ocupado.'));
    return new Promise((ok, falha) => {
      this.espera = { tipos, ok, falha };
      this._worker().postMessage(msg, transferir || []);
    });
  }

  async carregar(mt) {
    const r = await this._esperar(['pronto'], { tipo: 'carregar', montagem: { id: mt.id, device: mt.device, dtype: mt.dtype } });
    this.carregado = mt;
    return r;
  }

  // Devolve { segmentos, segundos } ou { cancelado: true }
  async transcrever(id, som, idioma) {
    const r = await this._esperar(['fim', 'cancelado'], { tipo: 'transcrever', id, audio: som, idioma }, [som.buffer]);
    return r.tipo === 'cancelado' ? { cancelado: true } : r;
  }

  cancelar(id) { if (this.worker) this.worker.postMessage({ tipo: 'cancelar', id }); }

  reiniciar() {
    try { if (this.worker) this.worker.terminate(); } catch { /* já parou */ }
    this.worker = null;
    this.carregado = null;
  }
}

// ---------- as fotos das cenas ----------
// Uma foto a cada 2 s (vídeo de até 3 min), com o tempo no nome, e os mosaicos: 20 fotos por imagem, em ordem, que a IA
// lê de uma vez só pra ver o visual e o ritmo da edição. O vídeo abre num <video> escondido e o canvas tira as fotos.

function esperarEvento(el, nome, ms, erro) {
  return new Promise((ok, falha) => {
    const limpar = () => { clearTimeout(r); el.removeEventListener(nome, bom); el.removeEventListener('error', ruim); };
    const bom = () => { limpar(); ok(); };
    const ruim = () => { limpar(); falha(new Error(erro)); };
    const r = setTimeout(() => { limpar(); falha(new Error(erro)); }, ms);
    el.addEventListener(nome, bom);
    el.addEventListener('error', ruim);
  });
}

function irPara(video, t) {
  return new Promise((ok) => {
    const fim = () => { clearTimeout(r); video.removeEventListener('seeked', fim); ok(); };
    const r = setTimeout(fim, 8000);
    video.addEventListener('seeked', fim);
    video.currentTime = t;
  });
}

const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}m${String(Math.round(s % 60)).padStart(2, '0')}s`;

export async function tirarFotos(pasta, { aoProgresso, parar = () => false } = {}) {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.setAttribute('aria-hidden', 'true');
  video.style.cssText = 'position:fixed;left:-10000px;top:0;width:4px;height:4px;opacity:0;pointer-events:none';
  document.body.append(video);
  try {
    const pronto = esperarEvento(video, 'loadeddata', 60000, 'O navegador não conseguiu abrir esse vídeo. Tente no Chrome.');
    video.src = `/api/ferramentas/midia?pasta=${encodeURIComponent(pasta)}`;
    await pronto;
    const dur = video.duration;
    const W = video.videoWidth;
    const H = video.videoHeight;
    if (!W || !H) return { semImagem: true };
    if (!Number.isFinite(dur) || dur <= 0) throw new Error('O vídeo não diz quanto tempo tem.');

    const intervalo = dur <= 180 ? 2 : dur <= 600 ? 5 : Math.ceil(dur / 120);
    const total = Math.max(1, Math.ceil(dur / intervalo - 0.01));
    const fw = 480;
    const fh = Math.round((fw * H) / W / 2) * 2;
    const foto = Object.assign(document.createElement('canvas'), { width: fw, height: fh });
    const cf = foto.getContext('2d');

    const COL = 5;
    const LIN = 4;
    const POR = COL * LIN;
    const PAD = 6;
    const tw = H > W ? 216 : 384;
    const th = Math.round((tw * H) / W);
    const mosaico = document.createElement('canvas');
    const cm = mosaico.getContext('2d');
    let nMosaico = 0;

    const novoMosaico = (quantas) => {
      const linhas = Math.ceil(quantas / COL);
      mosaico.width = PAD + COL * (tw + PAD);
      mosaico.height = PAD + linhas * (th + PAD);
      cm.fillStyle = '#ffffff';
      cm.fillRect(0, 0, mosaico.width, mosaico.height);
    };

    for (let i = 0; i < total; i++) {
      if (parar()) return { parado: true };
      const nominal = i * intervalo;
      await irPara(video, Math.min(nominal + 0.1, Math.max(0, dur - 0.05)));
      cf.drawImage(video, 0, 0, fw, fh);
      await api('/api/ferramentas/foto', { pasta, nome: `quadros/${mmss(nominal)}.jpg`, dados: foto.toDataURL('image/jpeg', 0.82), primeira: i === 0 });

      const slot = i % POR;
      if (slot === 0) novoMosaico(Math.min(POR, total - i));
      cm.drawImage(video, PAD + (slot % COL) * (tw + PAD), PAD + Math.floor(slot / COL) * (th + PAD), tw, th);
      if (slot === POR - 1 || i === total - 1) {
        nMosaico++;
        await api('/api/ferramentas/foto', { pasta, nome: `mosaico-${nMosaico}.jpg`, dados: mosaico.toDataURL('image/jpeg', 0.8) });
      }
      if (aoProgresso) aoProgresso(((i + 1) / total) * 100);
    }
    return { quadros: total, intervalo, mosaicos: nMosaico };
  } finally {
    video.removeAttribute('src');
    try { video.load(); } catch { /* já liberado */ }
    video.remove();
  }
}
