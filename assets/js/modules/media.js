const mediaTypes = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', jfif: 'image/jpeg',
  png: 'image/png', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp',
  avif: 'image/avif', heic: 'image/heic', heif: 'image/heif',
  tif: 'image/tiff', tiff: 'image/tiff', svg: 'image/svg+xml',
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime',
  webm: 'video/webm', ogv: 'video/ogg',
};

function tag(bytes, offset, length = 4) {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

// Signatures are MIME hints, never an admission test. The browser decodes the file.
function contentType(file, buffer) {
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 64));
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (tag(bytes, 0, 8) === '\x89PNG\r\n\x1a\n') return 'image/png';
  if (tag(bytes, 0) === 'RIFF' && tag(bytes, 8) === 'WEBP') return 'image/webp';
  if (tag(bytes, 0, 3) === 'GIF') return 'image/gif';
  if (tag(bytes, 0, 2) === 'BM') return 'image/bmp';
  const extension = file.name.trim().split('.').pop().toLowerCase();
  if (Object.hasOwn(mediaTypes, extension)) return mediaTypes[extension];
  return file.type || 'application/octet-stream';
}

export function acceptFor(mode) {
  // Use the general document picker instead of Android's photo/video provider.
  // Native decoding still validates the selected content for its module.
  return ['anaglyph', 'image', 'video'].includes(mode) ? '*/*' : '';
}

function abortError() {
  return new DOMException('Importación cancelada', 'AbortError');
}

export function videoErrorMessage(video) {
  switch (video.error?.code) {
    case 1:
      return 'La lectura del video se interrumpió. Vuelve a seleccionarlo.';
    case 2:
      return 'No se pudo leer el video desde el almacenamiento. Comprueba que esté descargado en el dispositivo y vuelve a seleccionarlo.';
    case 3:
      return 'El navegador no pudo decodificar el video. Puede estar incompleto o usar un códec incompatible. Prueba una copia completa o un MP4 con video H.264 y audio AAC.';
    default:
      return 'El navegador no admite el formato o códec de este video. Un archivo MP4 puede contener distintos códecs. Prueba MP4 con video H.264 y audio AAC, o un formato que este navegador pueda reproducir.';
  }
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
  return new Promise((resolve, reject) => {
    let finished = false;
    let timeout = setTimeout(() => {
      const error = new Error('La lectura del archivo está tardando demasiado. Comprueba que esté descargado por completo en el dispositivo y vuelve a seleccionarlo.');
      error.name = 'TimeoutError';
      finish(error);
    }, 60_000);
    const onReady = () => {
      if (!isVideo || element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        finish();
        return;
      }
      // Mobile browsers may defer the first decoded frame until explicit play.
      clearTimeout(timeout);
      timeout = setTimeout(() => finish(), 1200);
    };
    const onFrame = () => finish();
    const onError = () => finish(new Error(isVideo ? videoErrorMessage(element)
      : 'El navegador no pudo decodificar esta imagen. Comprueba que el archivo esté completo. Puedes convertir una copia a JPG, PNG o WebP si su formato no es compatible.'));
    const onAbort = () => finish(abortError());

    function finish(error) {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      element.removeEventListener(readyEvent, onReady);
      element.removeEventListener('loadeddata', onFrame);
      element.removeEventListener('error', onError);
      signal.removeEventListener('abort', onAbort);
      if (error) reject(error);
      else resolve();
    }

    element.addEventListener(readyEvent, onReady);
    if (isVideo) element.addEventListener('loadeddata', onFrame);
    element.addEventListener('error', onError);
    signal.addEventListener('abort', onAbort);
    if (signal.aborted) onAbort();
    else {
      element.src = url;
      if (isVideo) element.load();
    }
  });
}

export class MediaLoader {
  #active = null;
  #pending = null;

  async load(file, mode) {
    this.cancelPending();
    const controller = new AbortController();
    this.#pending = controller;
    const { signal } = controller;
    let asset;
    try {
      if (!acceptFor(mode)) throw new Error('Elige un módulo antes de importar un archivo.');
      // Start the full read in the change/drop event call stack, before touching
      // size, lastModified, slice(), or a file-backed URL. Android content URIs
      // can invalidate reads once their snapshot metadata has been queried.
      let bytes;
      try {
        bytes = await file.arrayBuffer();
      } catch {
        throw new Error('El selector del sistema no permitió leer el archivo. Vuelve a elegirlo desde Archivos o Descargas.');
      }
      if (signal.aborted) return null;
      if (!bytes.byteLength) throw new Error('El archivo está vacío. Selecciona una copia completa.');
      const type = contentType(file, bytes);
      // Only owned memory reaches the decoder. The provider-backed File is not
      // consulted again during playback, rendering or metadata display.
      file = new File([bytes], file.name, { type });
      const isVideo = mode === 'video';
      const element = isVideo ? document.createElement('video') : new Image();
      if (isVideo) {
        element.preload = 'auto';
        element.playsInline = true;
        element.disablePictureInPicture = true;
      }
      const url = URL.createObjectURL(file);
      asset = { element, url, mode, file };
      await waitUntilReadable(element, url, isVideo, signal);
      if (signal.aborted) return null;

      asset.width = isVideo ? element.videoWidth : element.naturalWidth;
      asset.height = isVideo ? element.videoHeight : element.naturalHeight;
      if (!asset.width || !asset.height) {
        throw new Error('El navegador no encontró imágenes o fotogramas válidos en este archivo.');
      }
      if (isVideo && element.error) throw new Error(videoErrorMessage(element));

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

  cancelPending() {
    this.#pending?.abort();
    this.#pending = null;
  }

  clear() {
    this.cancelPending();
    release(this.#active);
    this.#active = null;
  }
}
