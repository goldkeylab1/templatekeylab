// O Whisper (da OpenAI, licença MIT) rodando no navegador, num worker (o painel não trava enquanto ele trabalha).
// O som chega do próprio computador (a tela Ferramentas abre o arquivo), e o texto volta pro painel, que grava na
// pasta. Nada sai pra servidor nenhum. Downloads, uma vez só e guardados no navegador: o modelo (Hugging Face) e o
// motor ONNX (jsDelivr).
//
// A transcrição longa é a do próprio Whisper: ele ouve 30 s, escreve as frases com o tempo de cada uma, e a próxima
// janela começa onde a última frase completa terminou. Assim nenhuma palavra fica cortada no meio, dá pra mostrar o
// progresso e o texto na hora, e dá pra cancelar entre uma janela e outra.

import { env, AutoProcessor, AutoTokenizer, WhisperForConditionalGeneration, ModelRegistry } from './transformers.min.js';

const TAXA = 16000;
const JANELA = 30 * TAXA;
const SEG_POR_TS = 0.02;

env.allowLocalModels = false;
env.useBrowserCache = true;
env.useWasmCache = true;

// O motor (ONNX Runtime) na mesma versão que a biblioteca (transformers.js 4.3.1) espera. Safari antigo sem WebGPU usa
// a versão simples
const ORT = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.0-dev.20260914-8d85527a0/dist/';
function caminhosDoMotor(webgpu) {
  const ua = self.navigator.userAgent;
  const safari = /Safari\//.test(ua) && !/Chrome|Chromium|Edg\//.test(ua);
  const versao = Number((/Version\/(\d+)/.exec(ua) || [])[1] || 0);
  const sufixo = safari && versao < 26 && !webgpu ? '' : '.asyncify';
  return { mjs: `${ORT}ort-wasm-simd-threaded${sufixo}.mjs`, wasm: `${ORT}ort-wasm-simd-threaded${sufixo}.wasm` };
}

let atual = null; // { montagem, tokenizer, processor, model, tsInicio, fimTexto }
const cancelados = new Set();

const manda = (msg) => self.postMessage(msg);

self.onmessage = async ({ data }) => {
  try {
    if (data.tipo === 'carregar') await carregar(data);
    else if (data.tipo === 'transcrever') await transcrever(data);
    else if (data.tipo === 'cancelar') cancelados.add(data.id);
    else if (data.tipo === 'baixado') manda({ tipo: 'baixado', pedido: data.pedido, sim: await baixado(data.montagem) });
  } catch (e) {
    manda({ tipo: 'erro', id: data.id, etapa: data.tipo, mensagem: String((e && e.message) || e) });
  }
};

// ---------- carregar o modelo ----------
async function carregar({ montagem }) {
  if (atual && atual.montagem.id === montagem.id && atual.montagem.device === montagem.device &&
      JSON.stringify(atual.montagem.dtype) === JSON.stringify(montagem.dtype)) {
    manda({ tipo: 'pronto', device: montagem.device, jaEstava: true });
    return;
  }
  if (atual) { try { await atual.model.dispose(); } catch { /* já tinha saído */ } atual = null; }

  env.backends.onnx.wasm.wasmPaths = caminhosDoMotor(montagem.device === 'webgpu');

  // Soma o download de todos os arquivos e avisa o painel no máximo 5 vezes por segundo
  const arquivos = {};
  let ultimo = 0;
  const progresso = (info) => {
    if (info.status === 'progress' && info.total) {
      arquivos[info.file] = { carregado: info.loaded, total: info.total };
      const agora = performance.now();
      if (agora - ultimo < 200 && info.loaded < info.total) return;
      ultimo = agora;
      let carregado = 0, total = 0;
      for (const a of Object.values(arquivos)) { carregado += a.carregado; total += a.total; }
      manda({ tipo: 'baixando', carregado, total });
    }
  };

  // Internet que cai no meio: tenta de novo até 4 vezes (o que já baixou fica guardado e não baixa outra vez)
  let partes;
  for (let tentativa = 1; ; tentativa++) {
    try {
      partes = await Promise.all([
        AutoTokenizer.from_pretrained(montagem.id, { progress_callback: progresso }),
        AutoProcessor.from_pretrained(montagem.id, { progress_callback: progresso }),
        WhisperForConditionalGeneration.from_pretrained(montagem.id, {
          dtype: montagem.dtype, device: montagem.device, progress_callback: progresso,
        }),
      ]);
      break;
    } catch (e) {
      const rede = /network|fetch|load failed|aborted|ERR_|timed? ?out|Failed to/i.test(String((e && e.message) || e));
      if (!rede || tentativa >= 4) throw e;
      manda({ tipo: 'tentando', tentativa: tentativa + 1 });
      await new Promise((ok) => setTimeout(ok, 1500 * tentativa));
    }
  }
  const [tokenizer, processor, model] = partes;
  manda({ tipo: 'preparando' });

  const gc = model.generation_config;
  atual = {
    montagem, tokenizer, processor, model,
    tsInicio: gc.no_timestamps_token_id + 1,
    fimTexto: Array.isArray(gc.eos_token_id) ? gc.eos_token_id[0] : gc.eos_token_id,
  };

  // Aquecimento: a primeira rodada na placa de vídeo compila os programas dela. Melhor agora, com 1 s de silêncio,
  // do que no meio do primeiro arquivo (e assim um defeito aparece já aqui)
  const { input_features } = await processor(new Float32Array(TAXA));
  await model.generate({ inputs: input_features, language: 'portuguese', task: 'transcribe', return_timestamps: true, max_new_tokens: 4 });

  manda({ tipo: 'pronto', device: montagem.device });
}

// ---------- transcrever ----------
async function transcrever({ id, audio, idioma }) {
  if (!atual) throw new Error('O modelo ainda não foi carregado.');
  const { processor, tokenizer, model, tsInicio, fimTexto } = atual;
  const t0 = performance.now();
  const total = audio.length;
  const limiar = limiarDeSilencio(audio);
  const segmentos = [];
  let seek = 0;

  while (seek < total) {
    if (cancelados.has(id)) { cancelados.delete(id); manda({ tipo: 'cancelado', id }); return; }
    const fim = Math.min(seek + JANELA, total);
    const trecho = audio.subarray(seek, fim);
    if (trecho.length < TAXA * 0.25) break;

    if (!temVoz(trecho, limiar)) {
      seek = fim;
      manda({ tipo: 'parcial', id, feito: seek / TAXA, novos: [] });
      continue;
    }

    const { input_features } = await processor(trecho);
    let tokens = await gerar(model, input_features, idioma, null, tsInicio, fimTexto);
    let leitura = ler(tokens, seek, trecho.length, tsInicio, fimTexto, tokenizer);

    // Se o Whisper entrou em looping (a mesma frase de novo e de novo), tenta outra vez soltando um pouco a mão
    if (repetitivo(leitura.segmentos.map((s) => s.texto).join(' '))) {
      for (const temperatura of [0.4, 0.8]) {
        tokens = await gerar(model, input_features, idioma, temperatura, tsInicio, fimTexto);
        const nova = ler(tokens, seek, trecho.length, tsInicio, fimTexto, tokenizer);
        if (!repetitivo(nova.segmentos.map((s) => s.texto).join(' '))) { leitura = nova; break; }
      }
    }

    const novos = leitura.segmentos.filter((s) => s.texto && !LIXO.test(s.texto));
    segmentos.push(...novos);
    seek += Math.max(leitura.avanco, TAXA); // sempre anda pelo menos 1 s, pra nunca ficar parado
    manda({ tipo: 'parcial', id, feito: Math.min(seek, total) / TAXA, novos });
  }

  manda({ tipo: 'fim', id, segmentos: juntarRepetidos(segmentos), segundos: (performance.now() - t0) / 1000 });
}

async function gerar(model, inputs, idioma, temperatura, tsInicio, fimTexto) {
  const opcoes = { inputs, language: idioma, task: 'transcribe', return_timestamps: true, max_new_tokens: 440 };
  if (temperatura) Object.assign(opcoes, { do_sample: true, temperature: temperatura, top_k: 0 });
  const saida = await model.generate(opcoes);
  const seq = saida.tolist()[0].map(Number);
  // Tira o começo fixo (início, idioma, tarefa): são os tokens especiais antes do primeiro tempo ou texto
  let i = 0;
  while (i < seq.length && seq[i] >= fimTexto && seq[i] < tsInicio) i++;
  const tokens = seq.slice(i);
  while (tokens.length && tokens[tokens.length - 1] === fimTexto) tokens.pop();
  return tokens;
}

// Lê os tokens de uma janela: as frases com o tempo e quanto a próxima janela deve andar (o "seek" do Whisper)
function ler(tokens, seek, tamanho, tsInicio, fimTexto, tokenizer) {
  const base = seek / TAXA;
  const eTempo = tokens.map((t) => t >= tsInicio);
  const n = tokens.length;
  const terminaComUmTempo = n >= 2 && eTempo[n - 1] && !eTempo[n - 2];
  const cortes = [];
  for (let i = 1; i < n; i++) if (eTempo[i] && eTempo[i - 1]) cortes.push(i);
  const texto = (ids) => tokenizer.decode(ids.filter((t) => t < fimTexto), { skip_special_tokens: true }).trim();
  const segmentos = [];
  let avanco = tamanho;

  if (cortes.length) {
    if (terminaComUmTempo) cortes.push(n);
    let ultimo = 0;
    for (const corte of cortes) {
      const parte = tokens.slice(ultimo, corte);
      const ini = (parte[0] - tsInicio) * SEG_POR_TS;
      const fim = (parte[parte.length - 1] - tsInicio) * SEG_POR_TS;
      segmentos.push({ ini: base + ini, fim: base + Math.max(fim, ini), texto: texto(parte) });
      ultimo = corte;
    }
    if (!terminaComUmTempo) avanco = Math.round((tokens[ultimo - 1] - tsInicio) * SEG_POR_TS * TAXA);
  } else {
    const tempos = tokens.filter((t) => t >= tsInicio);
    let dur = tamanho / TAXA;
    if (tempos.length && tempos[tempos.length - 1] !== tsInicio) dur = (tempos[tempos.length - 1] - tsInicio) * SEG_POR_TS;
    segmentos.push({ ini: base, fim: base + dur, texto: texto(tokens) });
  }
  return { segmentos, avanco };
}

// ---------- silêncio, looping e lixo ----------
// O volume de cada pedaço de 30 ms; o limiar se ajusta ao volume da gravação inteira (gravação baixinha também passa)
function energias(a) {
  const passo = 480, n = Math.floor(a.length / passo), r = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = i * passo, f = j + passo; j < f; j++) s += a[j] * a[j];
    r[i] = Math.sqrt(s / passo);
  }
  return r;
}
function limiarDeSilencio(audio) {
  const e = energias(audio);
  if (!e.length) return 0.004;
  const ordem = Float32Array.from(e).sort();
  const alto = ordem[Math.floor(ordem.length * 0.95)];
  return Math.max(0.0035, alto * 0.08);
}
function temVoz(trecho, limiar) {
  const e = energias(trecho);
  let acima = 0;
  for (const v of e) if (v > limiar) acima++;
  return acima >= 10; // pelo menos uns 0,3 s com som de verdade
}
function repetitivo(texto) {
  const p = texto.toLowerCase().split(/\s+/).filter(Boolean);
  if (p.length < 24) return false;
  // a mesma sequência de 3 palavras aparecendo muitas vezes é looping, não fala
  const cont = new Map();
  for (let i = 0; i + 2 < p.length; i++) {
    const k = `${p[i]} ${p[i + 1]} ${p[i + 2]}`;
    cont.set(k, (cont.get(k) || 0) + 1);
  }
  const maior = Math.max(...cont.values());
  return maior >= 5 && maior / p.length > 0.08;
}
// Créditos de legenda que o Whisper aprendeu nos filmes e inventa quando escuta música ou barulho
const LIXO = /amara\.org|legendas? pela comunidade|legendado por|legendas? por:|tradução e legendas|subtitles by|transcrição e legendas/i;
function juntarRepetidos(segs) {
  const r = [];
  let iguais = 0;
  for (const s of segs) {
    const ant = r[r.length - 1];
    if (ant && ant.texto.toLowerCase() === s.texto.toLowerCase()) {
      iguais++;
      if (iguais >= 2) { ant.fim = s.fim; continue; } // a mesma frase 3 vezes seguidas: fica uma vez só
    } else iguais = 0;
    r.push({ ...s });
  }
  return r;
}

// ---------- o que já está baixado ----------
async function baixado(m) {
  try { return await ModelRegistry.is_cached(m.id, { dtype: m.dtype, device: m.device }); } catch { return false; }
}
