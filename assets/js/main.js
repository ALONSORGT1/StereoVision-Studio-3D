import { MediaLoader, acceptFor } from './modules/media.js';
import { StereoRenderer } from './modules/renderer.js';
import { calibrationControls, defaults } from './modules/calibration.js';
import { VideoPlayback } from './modules/playback.js';
import { VRPresentation } from './modules/vr.js';
import { ImageCalibrationPanel } from './modules/calibration-panel.js';

const $ = (id) => document.getElementById(id);
const modes = {
  anaglyph: ['Anaglifo', 'JPG, JPEG, PNG o WebP', '01'],
  image: ['Imagen SBS', 'JPG, JPEG, PNG o WebP con dos vistas lado a lado', '02'],
  video: ['Video SBS', 'MP4 con dos vistas lado a lado', '03'],
};
const loader = new MediaLoader();
const renderer = new StereoRenderer($('screen'));
const buttons = [...document.querySelectorAll('[data-mode]')];
let mode = null;
let media = null;
let settings = defaults();
let request = 0;
let loading = false;
let demoFetch = null;
const demos = {
  anaglyph: [
    ['bosque', 'Bosque umbrío', 'Sendero entre árboles y vegetación.'],
    ['ciudad-nocturna', 'Ciudad nocturna', 'Canal, puentes y fachadas iluminadas.'],
  ],
  image: [
    ['arrecife', 'Arrecife azul', 'Cardumen sobre un paisaje de coral.'],
    ['galeria', 'Galería de luz', 'Interior con columnas y luz lateral.'],
  ],
  video: [
    ['canon', 'Cañón estratificado', 'Recorrido entre roca, agua y vegetación.'],
    ['metropolis', 'Metrópolis futura', 'Avenida nocturna con tráfico en movimiento.'],
  ],
};

function showDemos() {
  const type = { anaglyph: 'Anaglifo', image: 'Imagen SBS', video: 'Video SBS · 0:15' }[mode];
  const cards = demos[mode].map(([id, title, description]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ghost demo';
    button.dataset.demo = id;
    const thumbnail = new Image(320, 180);
    thumbnail.alt = '';
    thumbnail.loading = 'lazy';
    thumbnail.src = new URL('../media/' + id + '.webp', import.meta.url);
    const copy = document.createElement('span');
    const name = document.createElement('strong');
    name.textContent = title;
    const summary = document.createElement('small');
    summary.textContent = description;
    const metadata = document.createElement('small');
    metadata.textContent = type;
    metadata.className = 'demo-type';
    copy.append(name, summary, metadata);
    button.append(thumbnail, copy);
    button.addEventListener('click', () => importFile(null, id));
    return button;
  });
  $('demo-options').replaceChildren(...cards);
  $('demos').hidden = false;
}

function errorMessage(message = '') {
  $('error').textContent = message;
  $('error').hidden = !message;
}

function clock(seconds) {
  const whole = Math.floor(seconds);
  return Math.floor(whole / 60) + ':' + String(whole % 60).padStart(2, '0');
}

const playback = new VideoPlayback({
  onError: errorMessage,
  onChange(state) {
    $('play').textContent = state.paused ? 'Reproducir' : 'Pausar';
    $('seek').max = state.duration;
    $('seek').value = state.currentTime;
    $('volume').value = state.muted ? 0 : state.volume;
    $('volume-range').hidden = state.volumeSupported === false;
    $('mute').hidden = state.volumeSupported !== false;
    $('mute').textContent = state.muted ? 'Activar sonido' : 'Silenciar';
    $('time').textContent = clock(state.currentTime) + ' / ' + clock(state.duration);
    if (media?.mode === 'video' && !loading) {
      const status = state.waiting ? 'Preparando fotograma…' :
        state.ended ? 'Finalizado' : state.paused ? 'En pausa' : 'En reproducción';
      if ($('status').textContent !== status) $('status').textContent = status;
    }
  },
});

const vr = new VRPresentation($('studio'), {
  onChange(active) {
    renderer.setVR(active);
    $('vr-controls').hidden = !active;
    (active ? $('exit-vr') : $('vr')).focus();
  },
});

const imagePanel = new ImageCalibrationPanel($('controls'), (patch) => {
  settings = { ...settings, ...patch };
  updateCalibration();
});

function updateCalibration() {
  if (mode === 'image') {
    imagePanel.update(settings);
    renderer.setCalibration(settings);
    return;
  }
  for (const { key, unit } of calibrationControls(mode)) {
    $(key).value = settings[key];
    $(key + '-value').value = settings[key] + ' ' + unit;
  }
  if ($('swap')) $('swap').checked = settings.swap;
  renderer.setCalibration(settings);
}

function makeControls() {
  const controls = $('controls');
  $('reset').textContent = mode === 'image' ? 'Restablecer calibración' : 'Restablecer ajustes';
  if (mode === 'image') {
    imagePanel.mount();
    return;
  }
  controls.classList.remove('advanced-calibration');
  controls.replaceChildren();
  for (const { key, label, min, max, step } of calibrationControls(mode)) {
    const row = document.createElement('div');
    row.className = 'control';
    const name = document.createElement('label');
    name.htmlFor = key;
    name.textContent = label;
    const value = document.createElement('output');
    value.id = key + '-value';
    value.htmlFor = key;
    const slider = document.createElement('input');
    Object.assign(slider, { id: key, type: 'range', min, max, step });
    slider.addEventListener('input', () => {
      settings[key] = slider.valueAsNumber;
      updateCalibration();
    });
    row.append(name, value, slider);
    controls.append(row);
  }
  if (mode !== 'anaglyph') {
    const label = document.createElement('label');
    label.className = 'control';
    label.textContent = 'Intercambiar ojos';
    const swap = document.createElement('input');
    Object.assign(swap, { id: 'swap', type: 'checkbox' });
    swap.addEventListener('change', () => {
      settings.swap = swap.checked;
      updateCalibration();
    });
    label.append(swap);
    controls.append(label);
  }
}

function showMedia() {
  $('empty').hidden = !!media;
  $('screen').hidden = !media;
  $('player').hidden = media?.mode !== 'video';
  $('eye-guides').hidden = !media || mode === 'anaglyph';
  $('vr').disabled = $('eye-guides').hidden || loading;
  $('adjustments').disabled = !media;
  $('reset').disabled = !media;
  $('replace').textContent = media ? 'Sustituir archivo' : 'Importar archivo';
  $('filename').textContent = media?.file.name ?? 'Sin archivo';
  $('metadata').textContent = media ? media.width + ' × ' + media.height + ' px · ' +
    new Intl.NumberFormat('es-MX', { style: 'unit', unit: 'megabyte', maximumFractionDigits: 2 })
      .format(media.file.size / 1e6) : '';
  $('calibration-hint').textContent = media ? 'Los ajustes se aplican a la vista en tiempo real.' :
    'Importa un archivo para activar los instrumentos.';
  $('status').textContent = loading ? 'Validando archivo…' : media ? 'Contenido listo' : 'En espera de archivo';
}

function chooseMode(next) {
  if (mode === next) return;
  request++;
  demoFetch?.abort();
  loading = false;
  playback.bind(null);
  renderer.setMedia(null);
  loader.clear();
  media = null;
  mode = next;
  settings = defaults();
  for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  const [label, formats, number] = modes[mode];
  $('mode-label').textContent = label.toUpperCase();
  $('mode-detail').textContent = 'LOCAL / ' + number;
  $('empty-title').textContent = 'Importa ' + (mode === 'video' ? 'un video SBS' : mode === 'image' ? 'una imagen SBS' : 'un anaglifo');
  $('empty-copy').textContent = formats + '. También puedes arrastrar el archivo aquí.';
  $('file').accept = acceptFor(mode);
  showDemos();
  for (const id of ['file', 'import', 'replace']) $(id).disabled = false;
  errorMessage();
  makeControls();
  updateCalibration();
  showMedia();
}

async function importFile(file, demo) {
  if ((!file && !demo) || !mode) return;
  const token = ++request;
  demoFetch?.abort();
  demoFetch = null;
  loader.cancelPending();
  loading = true;
  $('status').textContent = demo ? 'Cargando demo…' : 'Validando archivo…';
  $('vr').disabled = true;
  errorMessage();
  try {
    if (demo) {
      const name = demo + (mode === 'video' ? '.mp4' : '.jpg');
      demoFetch = new AbortController();
      try {
        const response = await fetch(new URL('../media/' + name, import.meta.url), {
          signal: demoFetch.signal,
        });
        if (!response.ok) throw new Error('Demo no disponible');
        const blob = await response.blob();
        file = new File([blob], name, { type: blob.type });
      } catch {
        throw new Error('No se pudo cargar la demo. Vuelve a intentarlo o importa un archivo local.');
      }
      if (token !== request) return;
    }
    const candidate = await loader.load(file, mode);
    if (!candidate || token !== request) return;
    media = candidate;
    settings = defaults();
    $('screen').hidden = false;
    renderer.setMedia(media);
    updateCalibration();
  } catch (error) {
    if (token !== request) return;
    errorMessage(error.message);
  } finally {
    if (token === request) {
      demoFetch = null;
      loading = false;
      showMedia();
      playback.bind(media?.mode === 'video' ? media.element : null);
    }
  }
}

for (const button of buttons) button.addEventListener('click', () => chooseMode(button.dataset.mode));
for (const id of ['import', 'replace']) $(id).addEventListener('click', () => $('file').click());
$('file').addEventListener('change', ({ target }) => {
  importFile(target.files[0]);
  target.value = '';
});
const viewport = $('viewport');
viewport.addEventListener('dragover', (event) => {
  event.preventDefault();
  if (mode && !$('studio').dataset.vr) viewport.classList.add('dragging');
});
viewport.addEventListener('dragleave', () => viewport.classList.remove('dragging'));
viewport.addEventListener('drop', (event) => {
  event.preventDefault();
  viewport.classList.remove('dragging');
  if (!$('studio').dataset.vr) importFile(event.dataTransfer.files[0]);
});
$('reset').addEventListener('click', () => {
  settings = defaults();
  updateCalibration();
});
$('play').addEventListener('click', () => {
  errorMessage();
  playback.toggle();
});
$('seek').addEventListener('input', (event) => playback.seek(event.target.valueAsNumber));
$('volume').addEventListener('input', (event) => playback.setVolume(event.target.valueAsNumber));
$('mute').addEventListener('click', () => playback.toggleMute());
$('back').addEventListener('click', () => playback.skip(-5));
$('forward').addEventListener('click', () => playback.skip(5));
$('vr').addEventListener('click', () => vr.enter());
$('exit-vr').addEventListener('click', () => vr.exit());
$('help').addEventListener('click', () => $('help-dialog').showModal());
