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

  // Reproduce a file-backed URL read failure, then verify the owned-byte retry.
  for (const [mode, name, mimeType, original] of [
    ['anaglyph', 'reintento.jpg', 'image/jpeg', join(directory, 'fotografia.jpg')],
    ['image', 'reintento.png', 'image/png', join(directory, 'captura.png')],
    ['video', 'reintento.mp4', 'video/mp4', join(fixtureRoot, 'orbital-sbs.mp4')],
  ]) {
    await page.locator('[data-mode="' + mode + '"]').click();
    await page.evaluate(() => {
      const create = URL.createObjectURL;
      window.testFailedFileUrl = false;
      URL.createObjectURL = blob => {
        if (blob instanceof File && !window.testFailedFileUrl) {
          window.testFailedFileUrl = true;
          return create(new Blob(['unreadable file-backed media'], { type: blob.type }));
        }
        return create(blob);
      };
    });
    await page.locator('#file').setInputFiles({ name, mimeType, buffer: await readFile(original) });
    await imported(page, name);
    assert(await page.evaluate(() => window.testFailedFileUrl));
    if (mode === 'video') await play(page);
  }
  console.log('Importación PASS: JPEG, PNG 16-bit, WebP, GIF, BMP, AVIF, anchos impares, MIME/nombres variables, MP4 y recuperación de lectura');
}
