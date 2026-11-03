const formats = {
  jpg: { mime: 'image/jpeg', matches: bytes => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  png: { mime: 'image/png', matches: bytes => [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte) },
  webp: { mime: 'image/webp', matches: bytes => tag(bytes, 0) === 'RIFF' && tag(bytes, 8) === 'WEBP' },
  mp4: { mime: 'video/mp4', matches: isMP4 },
};
formats.jpeg = formats.jpg;

function tag(bytes, offset) {
  return String.fromCharCode(...bytes.subarray(offset, offset + 4));
}

function isMP4(bytes) {
  const view = new DataView(bytes.buffer);
  for (let offset = 0; offset + 8 <= bytes.length;) {
    const length = view.getUint32(offset);
    if (length < 8) return false;
    if (tag(bytes, offset + 4) === 'ftyp') {
      // QuickTime files also use ISO boxes but are not MP4 files.
      return length >= 16 && offset + 16 <= bytes.length && tag(bytes, offset + 8) !== 'qt  ';
    }
    offset += length;
  }
  return false;
}

export function acceptFor(mode) {
  if (mode === 'video') return '.mp4,video/mp4';
  if (mode === 'anaglyph' || mode === 'image') return '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';
  return '';
}

function abortError() {
  return new DOMException('Importación cancelada', 'AbortError');
}

function release(asset) {
  if (!asset) return;
  const { element, mode, url } = asset;
  if (mode === 'video') element.pause();
  element.removeAttribute('src');
  if (mode === 'video') element.load();
  URL.revokeObjectURL(url);
}

function waitUntilReadable(element, url, isVideo, signal) {
  const readyEvent = isVideo ? 'loadedmetadata' : 'load';
  const failure = isVideo
    ? 'No se pudo leer el MP4. Prueba con un video MP4 con códec H.264.'
    : 'No se pudo decodificar la imagen. Selecciona otra imagen válida.';
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error(failure)), 20_000);
    const onReady = () => finish();
    const onError = () => finish(new Error(failure));
    const onAbort = () => finish(abortError());

    function finish(error) {
      clearTimeout(timeout);
      element.removeEventListener(readyEvent, onReady);
      element.removeEventListener('error', onError);
      signal.removeEventListener('abort', onAbort);
      if (error) reject(error);
      else resolve();
    }

    element.addEventListener(readyEvent, onReady);
    element.addEventListener('error', onError);
    signal.addEventListener('abort', onAbort);
    if (signal.aborted) onAbort();
    else element.src = url;
  });
}

export class MediaLoader {
  #active = null;
  #pending = null;

  async load(file, mode) {
    this.#pending?.abort();
    const controller = new AbortController();
    this.#pending = controller;
    const { signal } = controller;
    let asset;
    try {
      if (!acceptFor(mode)) throw new Error('Elige un módulo antes de importar un archivo.');
      const extension = file.name.split('.').pop().toLowerCase();
      const format = Object.hasOwn(formats, extension) ? formats[extension] : null;
      const isVideo = mode === 'video';
      if (!format || isVideo !== (extension === 'mp4')) {
        throw new Error(isVideo ? 'Selecciona un archivo MP4.' : 'Selecciona una imagen JPG, PNG o WebP.');
      }
      const header = new Uint8Array(await file.slice(0, 65_536).arrayBuffer());
      if (signal.aborted) return null;
      if (!format.matches(header)) {
        throw new Error('El contenido del archivo no coincide con su formato. Selecciona otro archivo.');
      }

      const element = isVideo ? document.createElement('video') : new Image();
      if (isVideo) {
        element.preload = 'auto';
        element.playsInline = true;
        element.disablePictureInPicture = true;
      }
      // Supply a reliable media type even when the operating system omitted it.
      const url = URL.createObjectURL(file.type === format.mime ? file : file.slice(0, file.size, format.mime));
      asset = { element, url, mode, file };
      // Mobile data-saving browsers may defer the first decoded frame until play().
      await waitUntilReadable(element, url, isVideo, signal);
      if (signal.aborted) return null;

      asset.width = isVideo ? element.videoWidth : element.naturalWidth;
      asset.height = isVideo ? element.videoHeight : element.naturalHeight;
      if (!asset.width || !asset.height || (isVideo && (!Number.isFinite(element.duration) || element.duration <= 0))) {
        throw new Error('No se encontraron dimensiones o duración válidas. Selecciona otro archivo.');
      }
      if (mode !== 'anaglyph' && asset.width % 2 !== 0) {
        throw new Error('El archivo SBS debe tener un ancho par para obtener dos perspectivas del mismo tamaño.');
      }
      if (isVideo && element.error) {
        throw new Error('El navegador no pudo decodificar el MP4. Prueba con un video MP4 con códec H.264.');
      }

      release(this.#active);
      this.#active = asset;
      return asset;
    } catch (error) {
      if (signal.aborted) return null;
      throw error;
    } finally {
      if (this.#pending === controller) this.#pending = null;
      if (this.#active !== asset) release(asset);
    }
  }

  clear() {
    this.#pending?.abort();
    this.#pending = null;
    release(this.#active);
    this.#active = null;
  }
}
