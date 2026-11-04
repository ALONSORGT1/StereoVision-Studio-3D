import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function imported(page, name) {
  await page.waitForFunction(name => document.getElementById('filename').textContent === name ||
    !document.getElementById('error').hidden, name);
  assert.equal(await page.locator('#filename').textContent(), name, await page.locator('#error').textContent());
  assert(!(await page.locator('#error').isVisible()));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const visiblePixels = await page.locator('#screen').evaluate(canvas => {
    const sample = document.createElement('canvas');
    sample.width = sample.height = 32;
    const ctx = sample.getContext('2d');
    ctx.drawImage(canvas, 0, 0, 32, 32);
    return ctx.getImageData(0, 0, 32, 32).data.some((value, index) => index % 4 === 3 && value > 0);
  });
  assert(visiblePixels, name + ' debe producir píxeles visibles');
}

async function play(page) {
  await page.locator('#play').click();
  await page.waitForFunction(() => window.testVideos.at(-1).currentTime > 0.15);
  await page.locator('#play').click();
}

export async function simulateAndroidProvider(page) {
  // Model Android content-provider failure when metadata is touched first,
  // reading starts after the change event, or the picker is cleared too early.
  await page.evaluate(() => {
    const records = new WeakMap();
    window.testAndroidReads = { complete: 0, earlyMetadata: 0, earlyClear: 0, rawUrls: 0 };
    const descriptor = Object.getOwnPropertyDescriptor(Blob.prototype, 'size');
    const read = File.prototype.arrayBuffer;
    const slice = File.prototype.slice;
    const value = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    const create = URL.createObjectURL;
    document.addEventListener('change', event => {
      if (event.target.id !== 'file') return;
      const file = event.target.files[0];
      if (!file?.name.startsWith('proveedor-')) return;
      const state = { started: false, complete: false, invalid: false, expired: false };
      records.set(file, state);
      queueMicrotask(() => { if (!state.started) state.expired = true; });
    }, true);
    const metadata = file => {
      const state = records.get(file);
      if (state && !state.complete) {
        state.invalid = true;
        window.testAndroidReads.earlyMetadata++;
      }
    };
    Object.defineProperty(File.prototype, 'size', {
      configurable: true,
      get() { metadata(this); return descriptor.get.call(this); },
    });
    File.prototype.slice = function (...args) {
      metadata(this);
      return slice.apply(this, args);
    };
    File.prototype.arrayBuffer = function () {
      const state = records.get(this);
      if (!state) return read.call(this);
      state.started = true;
      return read.call(this).then(buffer => new Promise((resolve, reject) => {
        setTimeout(() => {
          if (state.invalid || state.expired) {
            reject(new DOMException('Android content URI became unreadable', 'NotReadableError'));
          } else {
            state.complete = true;
            window.testAndroidReads.complete++;
            resolve(buffer);
          }
        }, 100);
      }));
    };
    Object.defineProperty(HTMLInputElement.prototype, 'value', {
      ...value,
      set(next) {
        const state = this.type === 'file' ? records.get(this.files[0]) : null;
        if (next === '' && state && !state.complete) {
          state.invalid = true;
          window.testAndroidReads.earlyClear++;
        }
        value.set.call(this, next);
      },
    });
    URL.createObjectURL = blob => {
      if (records.has(blob)) {
        window.testAndroidReads.rawUrls++;
        return create(new Blob(['provider-backed URL became unreadable']));
      }
      return create(blob);
    };
  });
}

export async function checkImports(page, fixtureRoot) {
  const directory = join(fixtureRoot, 'imports');
  for (const mode of ['anaglyph', 'image']) {
    await page.locator('[data-mode="' + mode + '"]').click();
    for (const name of ['fotografia.jpg', 'captura.png', 'imagen.webp', 'imagen.gif', 'imagen.bmp', 'imagen.avif']) {
      await page.locator('#file').setInputFiles(join(directory, name));
      await imported(page, name);
      assert.match(await page.locator('#metadata').textContent(), /129 × 97/);
    }
    for (const [name, mimeType, original] of [
      [' FOTO.JPEG ', '', 'fotografia.jpg'],
      ['camara.jfif', 'application/octet-stream', 'fotografia.jpg'],
      ['sin-extension', '', 'fotografia.jpg'],
      ['nombre.png', 'image/png', 'imagen.webp'],
    ]) {
      await page.locator('#file').setInputFiles({ name, mimeType, buffer: await readFile(join(directory, original)) });
      await imported(page, name);
    }
  }

  await page.locator('[data-mode="video"]').click();
  for (const name of ['orbital-sbs.mp4', 'imports/cabecera-extendida.mp4']) {
    await page.locator('#file').setInputFiles(join(fixtureRoot, name));
    await imported(page, name.split('/').pop());
    await play(page);
  }
  await page.locator('#file').setInputFiles({
    name: 'MOVIL.M4V', mimeType: 'application/octet-stream',
    buffer: await readFile(join(fixtureRoot, 'orbital-sbs.mp4')),
  });
  await imported(page, 'MOVIL.M4V');
  await play(page);
  await page.evaluate(() => {
    const create = document.createElement.bind(document);
    let nextVideo = true;
    document.createElement = (tag, ...args) => {
      const element = create(tag, ...args);
      if (tag === 'video' && nextVideo) {
        nextVideo = false;
        Object.defineProperty(element, 'duration', { get: () => Infinity });
      }
      return element;
    };
  });
  await page.locator('#file').setInputFiles({
    name: 'duracion-pendiente.mp4', mimeType: 'video/mp4',
    buffer: await readFile(join(fixtureRoot, 'orbital-sbs.mp4')),
  });
  await imported(page, 'duracion-pendiente.mp4');
  assert.match(await page.locator('#time').textContent(), /—/);
  await play(page);
  assert(Number(await page.locator('#seek').getAttribute('max')) > 0);

  await page.locator('#file').setInputFiles({
    name: 'incompleto.mp4', mimeType: 'video/mp4', buffer: Buffer.from('incomplete MP4 payload'),
  });
  await page.locator('#error').waitFor({ state: 'visible' });
  assert.match(await page.locator('#error').textContent(), /códec|decodificar/);
  assert.equal(await page.locator('#filename').textContent(), 'duracion-pendiente.mp4');

  await simulateAndroidProvider(page);
  for (const [mode, name, mimeType, original] of [
    ['anaglyph', 'proveedor-foto.jpg', 'image/jpeg', join(directory, 'fotografia.jpg')],
    ['image', 'proveedor-imagen.png', 'image/png', join(directory, 'captura.png')],
    ['video', 'proveedor-video.mp4', 'video/mp4', join(fixtureRoot, 'orbital-sbs.mp4')],
  ]) {
    await page.locator('[data-mode="' + mode + '"]').click();
    assert.equal(await page.locator('#file').getAttribute('accept'), '*/*');
    await page.locator('#file').setInputFiles({ name, mimeType, buffer: await readFile(original) });
    await imported(page, name);
    assert.equal(await page.locator('#file').inputValue(), '');
    if (mode === 'video') await play(page);
  }
  assert.deepEqual(await page.evaluate(() => window.testAndroidReads),
    { complete: 3, earlyMetadata: 0, earlyClear: 0, rawUrls: 0 });

  await page.locator('[data-mode="image"]').click();
  const payload = await readFile(join(directory, 'captura.png'));
  await page.locator('#file').setInputFiles({ name: 'proveedor-primero.png', mimeType: 'image/png', buffer: payload });
  await page.locator('#file').setInputFiles({ name: 'proveedor-segundo.png', mimeType: 'image/png', buffer: payload });
  await imported(page, 'proveedor-segundo.png');
  const reads = await page.evaluate(() => window.testAndroidReads);
  assert.equal(reads.earlyClear, 0);
  assert.equal(reads.earlyMetadata, 0);
  assert.equal(reads.rawUrls, 0);
  console.log('Importación PASS: formatos comunes, MP4, captura inmediata sin metadatos previos, selector conservado y sustitución concurrente');
}
