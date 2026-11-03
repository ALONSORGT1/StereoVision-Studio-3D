import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, join, resolve, sep } from 'node:path';
import { chromium, devices } from 'playwright-core';

const repo = fileURLToPath(new URL('../', import.meta.url));
const prefix = '/StereoVision-Studio-3D/';
const fixture = (name) => join(repo, 'tests', 'fixtures', name);
const evidence = join(repo, 'test-results');
const types = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.mp4': 'video/mp4',
};
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const path = resolve(repo, pathname.slice(prefix.length) || 'index.html');
    if (!pathname.startsWith(prefix) || !path.startsWith(resolve(repo) + sep)) throw new Error();
    const body = await readFile(path);
    response.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});

const screenshot = async (page, name, fullPage = false) => {
  await page.screenshot({ path: join(evidence, name + '.png'), fullPage, animations: 'disabled' });
};

async function fingerprints(page, comparison) {
  return page.locator('#screen').evaluate((canvas, previous) => {
    const width = canvas.width / 2;
    const context = canvas.getContext('2d');
    const halves = [0, width].map((x) => {
      const pixels = context.getImageData(x, 0, width, canvas.height).data;
      let hash = 2166136261;
      for (const value of pixels) hash = Math.imul(hash ^ value, 16777619);
      return hash;
    });
    return previous ? halves.some((hash, index) => hash !== previous[index]) : halves;
  }, comparison);
}

async function range(page, id, value) {
  await page.locator('#' + id).fill(String(value));
}

async function load(page, mode, name) {
  await page.locator('[data-mode="' + mode + '"]').click();
  await page.locator('#file').setInputFiles(fixture(name));
  await page.waitForFunction((filename) => document.querySelector('#filename').textContent === filename, name);
  assert(await page.locator('#screen').isVisible());
  await page.waitForFunction(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(true)))));
}

async function readVideo(page) {
  return page.evaluate(() => {
    const video = window.testVideos.at(-1);
    return { time: video.currentTime, duration: video.duration, paused: video.paused, volume: video.volume,
      muted: video.muted, inline: video.playsInline, src: video.getAttribute('src') };
  });
}

async function auditContext(context, problems, origin) {
  context.on('request', (request) => {
    const url = new URL(request.url());
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin) problems.push('External request: ' + url);
  });
  context.on('page', (page) => {
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(message.text());
    });
    page.on('response', (response) => {
      if (response.status() >= 400) problems.push(response.status() + ' ' + response.url());
    });
  });
  await context.addInitScript(() => {
    window.testVideos = [];
    window.testReleased = [];
    const create = document.createElement.bind(document);
    const revoke = URL.revokeObjectURL.bind(URL);
    document.createElement = (tag, ...args) => {
      const element = create(tag, ...args);
      if (tag.toLowerCase() === 'video') window.testVideos.push(element);
      return element;
    };
    URL.revokeObjectURL = (url) => {
      window.testReleased.push(url);
      revoke(url);
    };
  });
}

await mkdir(evidence, { recursive: true });
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const url = process.env.STUDIO_URL || 'http://127.0.0.1:' + server.address().port + prefix;
let browser;
try {
  browser = await chromium.launch({ channel: process.env.CHROME_CHANNEL || 'chrome' });
  console.log('Chromium ' + browser.version() + ' · ' + url);
  const problems = [];
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await auditContext(desktop, problems, new URL(url).origin);
  const page = await desktop.newPage();
  await page.goto(url);
  assert(await page.locator('#file').isDisabled());
  assert(await page.locator('#vr').isDisabled());
  assert(await page.locator('#reset').isDisabled());
  assert(await page.locator('#empty').isVisible());
  await page.keyboard.press('Tab');
  assert(await page.locator('#help').evaluate((button) => button.matches(':focus-visible')));
  await page.keyboard.press('Enter');
  assert(await page.locator('#help-dialog').isVisible());
  await page.keyboard.press('Escape');
  await screenshot(page, '01-escritorio-inicio');
  console.log('P-01 PASS: inicio, estados deshabilitados y ayuda por teclado');

  await load(page, 'anaglyph', 'orbital-anaglifo.png');
  const anaglyph = await fingerprints(page);
  for (const [id, value] of [['scale', 130], ['brightness', 125], ['contrast', 125]]) {
    const baseline = await page.locator('#screen').screenshot();
    await range(page, id, value);
    assert(!baseline.equals(await page.locator('#screen').screenshot()), id + ' debe modificar la vista');
  }
  await screenshot(page, '02-anaglifo-ajustado');
  await page.locator('#reset').click();
  assert.deepEqual(await fingerprints(page), anaglyph);
  console.log('P-02 PASS: escala, brillo, contraste y restauración verificados en píxeles');

  await load(page, 'image', 'orbital-sbs.png');
  const eyes = await fingerprints(page);
  assert.notEqual(eyes[0], eyes[1]);
  await page.locator('#swap').check();
  assert.deepEqual(await fingerprints(page), [eyes[1], eyes[0]]);
  for (const [id, value] of [['horizontal', 8], ['vertical', 4], ['scale', 135]]) {
    const baseline = await fingerprints(page);
    await range(page, id, value);
    assert(await fingerprints(page, baseline), id + ' debe modificar el lienzo SBS');
  }
  await screenshot(page, '03-imagen-sbs-calibrada');
  await page.locator('#reset').click();
  assert.deepEqual(await fingerprints(page), eyes);
  console.log('P-03 PASS: vistas distintas, intercambio exacto por píxeles, calibración y restauración');

  await load(page, 'video', 'orbital-sbs.mp4');
  const initial = await readVideo(page);
  assert(initial.paused && initial.inline && initial.duration >= 6);
  assert.match(await page.locator('#time').textContent(), /0:00 \/ 0:06/);
  await page.locator('#play').click();
  await page.waitForFunction(() => window.testVideos[0].currentTime > 0.2);
  await page.locator('#play').click();
  assert((await readVideo(page)).paused);
  await range(page, 'seek', 2.5);
  await page.waitForFunction(() => !window.testVideos[0].seeking && window.testVideos[0].currentTime === 2.5);
  await page.locator('#back').click();
  assert.equal((await readVideo(page)).time, 0);
  await page.locator('#forward').click();
  assert.equal((await readVideo(page)).time, 5);
  await range(page, 'volume', 0.35);
  assert.equal((await readVideo(page)).volume, 0.35);
  console.log('P-04 PASS: reproducción por gesto, pausa, búsqueda, saltos, tiempo y volumen');

  await range(page, 'seek', 0.5);
  await page.locator('#play').click();
  await page.waitForFunction(() => window.testVideos[0].currentTime > 0.75);
  const before = await fingerprints(page);
  await range(page, 'horizontal', 8);
  await range(page, 'scale', 135);
  await page.waitForFunction(() => window.testVideos[0].currentTime > 1);
  assert(await fingerprints(page, before));
  const playing = await readVideo(page);
  assert(!playing.paused && playing.src === initial.src);
  assert.equal(await page.evaluate(() => window.testVideos.length), 1);
  await screenshot(page, '04-video-sbs-reproduccion');
  console.log('P-05 PASS: calibración en reproducción sobre una sola fuente temporal');

  await page.evaluate(() => { window.sameDocument = true; });
  await load(page, 'image', 'orbital-sbs.png');
  const previous = await readVideo(page);
  assert(previous.paused && !previous.src);
  assert(await page.evaluate((src) => window.testReleased.includes(src) && window.sameDocument, initial.src));
  await page.locator('#file').setInputFiles({
    name: 'copia-sbs.png', mimeType: 'image/png', buffer: await readFile(fixture('orbital-sbs.png')),
  });
  await page.waitForFunction(() => document.querySelector('#filename').textContent === 'copia-sbs.png');
  assert((await page.evaluate(() => window.testReleased)).length >= 4);
  console.log('P-06 PASS: cambio de módulo y sustitución consecutiva liberan URL y detienen video');

  for (const [name, mimeType] of [['no-admitido.txt', 'text/plain'], ['corrupto.png', 'image/png']]) {
    await page.locator('#file').setInputFiles({ name, mimeType, buffer: Buffer.from('archivo de prueba') });
    await page.locator('#error').waitFor({ state: 'visible' });
    assert((await page.locator('#error').textContent()).trim().length > 10);
    assert.equal(await page.locator('#filename').textContent(), 'copia-sbs.png');
    assert.deepEqual(await fingerprints(page), eyes);
  }
  await screenshot(page, '05-error-recuperable');
  await load(page, 'image', 'orbital-sbs.png');
  assert(!(await page.locator('#error').isVisible()));
  console.log('P-07 PASS: extensión inválida y PNG corrupto mantienen la vista activa y permiten recuperación');

  const mobile = await browser.newContext({ ...devices['iPhone 13'], defaultBrowserType: 'chromium', reducedMotion: 'reduce' });
  await auditContext(mobile, problems, new URL(url).origin);
  await mobile.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = () => Promise.reject(new Error('Fullscreen unavailable'));
  });
  const phone = await mobile.newPage();
  await phone.goto(url);
  await screenshot(phone, '06-movil-inicio', true);
  await load(phone, 'image', 'orbital-sbs.png');
  await range(phone, 'horizontal', 8);
  await range(phone, 'vertical', 4);
  await range(phone, 'scale', 135);
  await phone.locator('#swap').tap();
  const studioEyes = await fingerprints(phone);
  await phone.locator('#vr').tap();
  assert(!(await phone.locator('#reset').isVisible()));
  assert(await phone.locator('.orientation').isVisible());
  await screenshot(phone, '07-vr-vertical');
  await phone.setViewportSize({ width: 844, height: 390 });
  await phone.locator('.orientation').waitFor({ state: 'hidden' });
  assert(await phone.locator('#screen').isVisible());
  const vrEyes = await fingerprints(phone);
  assert.notEqual(vrEyes[0], vrEyes[1]);
  await screenshot(phone, '08-vr-horizontal');
  await phone.locator('#exit-vr').tap();
  assert(await phone.locator('#reset').isVisible());
  assert.equal(await phone.locator('#scale').inputValue(), '135');
  assert.equal(await phone.locator('#horizontal').inputValue(), '8');
  assert.equal(await phone.locator('#vertical').inputValue(), '4');
  assert(await phone.locator('#swap').isChecked());
  await phone.setViewportSize({ width: 390, height: 664 });
  assert(await phone.evaluate(() => document.documentElement.scrollWidth === innerWidth));
  assert.notEqual(studioEyes[0], studioEyes[1]);
  await load(phone, 'video', 'orbital-sbs.mp4');
  await phone.locator('#play').tap();
  await phone.waitForFunction(() => window.testVideos[0].currentTime > 0.2);
  await phone.locator('#vr').tap();
  await phone.waitForFunction(() => window.testVideos[0].currentTime > 0.5);
  await phone.locator('#exit-vr').tap();
  assert(!(await readVideo(phone)).paused);
  await phone.locator('#play').tap();
  console.log('P-08 PASS: móvil emulado, giro, salida táctil y estado SBS preservado sin pantalla completa');

  assert.deepEqual(problems, []);
  console.log(process.env.STUDIO_URL
    ? 'P-09 PASS: URL configurada sin errores de red o consola en escritorio y móvil emulado'
    : 'P-09 PARCIAL: rutas correctas con el subdirectorio de Pages en HTTP local; publicación HTTPS pendiente');
} finally {
  await browser?.close();
  server.close();
}
