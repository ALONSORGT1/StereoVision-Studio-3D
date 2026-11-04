import assert from 'node:assert/strict';
import { join } from 'node:path';

async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

export async function loadAnaglyphPattern(page, size = [128, 96]) {
  const encoded = await page.evaluate(([width, height]) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgb(64, 96, 144)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgb(192, 96, 144)';
    ctx.fillRect(width * 0.2, height * 0.35, width * 0.15, height * 0.3);
    ctx.fillStyle = 'rgb(64, 208, 224)';
    ctx.fillRect(width * 0.65, height * 0.35, width * 0.15, height * 0.3);
    return canvas.toDataURL('image/png').split(',')[1];
  }, size);
  await page.locator('#file').setInputFiles({
    name: 'canales-prueba.png', mimeType: 'image/png', buffer: Buffer.from(encoded, 'base64'),
  });
  await page.waitForFunction(() => document.getElementById('filename').textContent === 'canales-prueba.png');
  await settle(page);
}

async function set(page, key, value, numeric = false) {
  const input = page.locator('#' + key + (numeric ? '-number' : ''));
  await input.fill(String(value));
  if (numeric) await input.press('Tab');
  assert.equal(await page.locator('#' + key).inputValue(), String(value));
  assert.equal(await page.locator('#' + key + '-number').inputValue(), String(value));
}

async function snapshot(page) {
  await settle(page);
  return page.locator('#screen').evaluate(canvas => {
    const { width, height } = canvas;
    const data = canvas.getContext('2d').getImageData(0, 0, width, height).data;
    const centroids = [[0, 0, 0], [0, 0, 0]];
    const sums = [0, 0, 0];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        for (let c = 0; c < 3; c++) sums[c] += data[i + c];
        for (let c = 0; c < 2; c++) {
          if (data[i + c] > (c === 0 ? 170 : 190)) {
            centroids[c][0] += x;
            centroids[c][1] += y;
            centroids[c][2]++;
          }
        }
      }
    }
    const factor = Math.min(width / 128, height / 96);
    const x = Math.floor((width - 128 * factor) / 2 + 128 * factor * 0.12);
    const y = Math.floor((height - 96 * factor) / 2 + 96 * factor * 0.12);
    const index = (y * width + x) * 4;
    return {
      width, height, pixel: Array.from(data.slice(index, index + 4)), sums,
      centers: centroids.map(([x, y, count]) => [x / count, y / count]),
    };
  });
}

function near(actual, expected, tolerance = 2) {
  assert(Math.abs(actual - expected) <= tolerance, actual + ' debe aproximar ' + expected);
}

export async function checkAnaglyphCalibration(page, evidence, software = false) {
  await page.locator('[data-mode="anaglyph"]').click();
  await loadAnaglyphPattern(page);
  for (const title of ['Calibración estereoscópica', 'Balance cromático']) {
    const summary = page.getByText(title, { exact: true });
    if (!(await summary.evaluate(node => node.parentElement.open))) await summary.click();
  }
  const initial = await snapshot(page);
  for (const [i, expected] of [64, 96, 144].entries()) near(initial.pixel[i], expected);

  for (const key of ['convergence', 'anaglyphVertical']) {
    for (const value of [-1.2, 1.2]) {
      await page.locator('#reset').click();
      const before = await snapshot(page);
      await set(page, key, value, value < 0);
      const after = await snapshot(page);
      const axis = key === 'convergence' ? 0 : 1;
      const extent = axis === 0 ? before.width : before.height;
      for (let c = 0; c < 2; c++) {
        near(after.centers[c][axis] - before.centers[c][axis], (c === 0 ? 1 : -1) * extent * value / 200, 1);
        near(after.centers[c][1 - axis], before.centers[c][1 - axis], 1);
      }
    }
  }

  await page.locator('#reset').click();
  await set(page, 'redGain', 50, true);
  let adjusted = await snapshot(page);
  near(adjusted.pixel[0], 32);
  near(adjusted.pixel[1], 96);
  near(adjusted.pixel[2], 144);
  await page.locator('#reset').click();
  await set(page, 'cyanGain', 50);
  adjusted = await snapshot(page);
  near(adjusted.pixel[0], 64);
  near(adjusted.pixel[1], 48);
  near(adjusted.pixel[2], 72);
  await page.locator('#reset').click();
  await set(page, 'redGain', 150);
  adjusted = await snapshot(page);
  near(adjusted.pixel[0], 85.3);
  near(adjusted.pixel[1], 96);
  near(adjusted.pixel[2], 144);

  for (const gamma of [0.5, 1.05, 2]) {
    await page.locator('#reset').click();
    await set(page, 'gamma', gamma, true);
    adjusted = await snapshot(page);
    for (const [c, value] of [64, 96, 144].entries()) {
      near(adjusted.pixel[c], 255 * (value / 255) ** (1 / gamma));
    }
  }

  await page.locator('#reset').click();
  await set(page, 'convergence', 0.6);
  await set(page, 'anaglyphVertical', -0.4);
  await set(page, 'redGain', 80);
  await set(page, 'cyanGain', 110);
  await set(page, 'gamma', 1.2);
  await set(page, 'brightness', 115);
  await set(page, 'contrast', 90);
  const combined = await snapshot(page);
  for (const [c, value] of [79.8, 134.3, 179.5].entries()) near(combined.pixel[c], value);
  await page.locator('#inspection').selectOption('red');
  const red = await snapshot(page);
  assert.equal(red.sums[1], 0);
  assert.equal(red.sums[2], 0);
  near(red.sums[0] / combined.sums[0], 1, 0.01);
  assert(await page.locator('#inspection-badge').isVisible());
  await page.locator('#inspection').selectOption('cyan');
  const cyan = await snapshot(page);
  assert.equal(cyan.sums[0], 0);
  near(cyan.sums[1] / combined.sums[1], 1, 0.01);
  near(cyan.sums[2] / combined.sums[2], 1, 0.01);
  await page.locator('#inspection').selectOption('full');
  assert(!(await page.locator('#inspection-badge').isVisible()));
  assert.deepEqual((await snapshot(page)).pixel, combined.pixel);

  // All transforms are reversible and computed from the original texture.
  await page.locator('#reset').click();
  assert.deepEqual((await snapshot(page)).pixel, initial.pixel);
  for (const [key, title, value, expected] of [
    ['scale', 'Escala', 125, 100], ['brightness', 'Brillo', 110, 100],
    ['contrast', 'Contraste', 120, 100], ['gamma', 'Gamma', 1.35, 1],
    ['convergence', 'Convergencia horizontal', 1.1, 0],
    ['anaglyphVertical', 'Alineación vertical', -0.6, 0],
    ['redGain', 'Intensidad roja', 60, 100], ['cyanGain', 'Intensidad cian', 130, 100],
  ]) {
    await set(page, key, value, true);
    await page.getByRole('button', { name: 'Restablecer ' + title, exact: true }).click();
    assert.equal(await page.locator('#' + key + '-number').inputValue(), String(expected));
  }
  await page.locator('#inspection').selectOption('cyan');
  await page.getByRole('button', { name: 'Restablecer Inspección', exact: true }).click();
  assert.equal(await page.locator('#inspection').inputValue(), 'full');

  await set(page, 'gamma', 1.05, true);
  const section = page.getByText('Imagen', { exact: true });
  await section.focus();
  await section.press('Enter');
  await section.press('Space');
  assert.equal(await page.locator('#gamma-number').inputValue(), '1.05');
  await page.locator('#inspection').selectOption('red');
  await page.screenshot({ path: join(evidence, software ? '12-anaglifo-canvas.png' : '11-anaglifo-inspeccion.png'), fullPage: true });
  await page.locator('#reset').click();

  if (!software) {
    const uploads = await page.evaluate(() => window.testUploads);
    assert(uploads > 0, 'La ruta principal debe usar una textura WebGL');
    // High-resolution input uploads once. Adjustments only change uniforms.
    await loadAnaglyphPattern(page, [4096, 3072]);
    const afterLoad = await page.evaluate(() => window.testUploads);
    const timings = await page.evaluate(async () => {
      const times = [];
      const input = document.getElementById('gamma');
      for (const value of [1.05, 1.1, 1.15, 1.2, 1.25]) {
        const start = performance.now();
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        times.push(performance.now() - start);
      }
      return times;
    });
    assert.equal(await page.evaluate(() => window.testUploads), afterLoad);
    console.log('Anaglifo 4096×3072 · ajustes síncronos en ms', timings.map(value => Math.round(value)));
    await page.locator('#gamma-number').fill('1.5');
    const released = await page.evaluate(() => window.testTextureReleases);
    await page.locator('[data-demo="bosque"]').click();
    await page.waitForFunction(() => document.getElementById('filename').textContent === 'bosque.jpg');
    assert.equal(await page.locator('#gamma-number').inputValue(), '1');
    assert((await page.evaluate(() => window.testTextureReleases)) > released);
    const originalView = await snapshot(page);
    const uploadsBeforeLoss = await page.evaluate(() => window.testUploads);
    await page.evaluate(() => {
      window.testLostCanvas = window.testDraws.at(-1).source;
      window.testLossControl = window.testLostCanvas.getContext('webgl').getExtension('WEBGL_lose_context');
      window.testLossControl.loseContext();
    });
    await page.waitForFunction(() => window.testDraws.at(-1).source !== window.testLostCanvas);
    const recovered = await snapshot(page);
    for (let c = 0; c < 3; c++) near(recovered.pixel[c], originalView.pixel[c], 3);
    await page.evaluate(() => window.testLossControl.restoreContext());
    await page.waitForFunction((count) => window.testUploads > count, uploadsBeforeLoss);
    console.log('Anaglifo PASS · pérdida y recuperación del contexto WebGL');
  }
  console.log('Anaglifo avanzado PASS · ' + (software ? 'Canvas alternativo' : 'WebGL') +
    ' · posiciones, RGB, gamma, inspección, reversibilidad y restablecimiento');
}

export async function checkAnaglyphTouch(page, evidence) {
  await page.locator('[data-mode="anaglyph"]').tap();
  await loadAnaglyphPattern(page);
  await page.getByText('Calibración estereoscópica', { exact: true }).tap();
  await page.getByText('Balance cromático', { exact: true }).tap();
  const input = page.locator('#gamma');
  const bounds = await input.boundingBox();
  const before = await snapshot(page);
  await input.tap({ position: { x: bounds.width * 0.7, y: bounds.height / 2 } });
  assert.equal(await input.inputValue(), await page.locator('#gamma-number').inputValue());
  assert.notDeepEqual((await snapshot(page)).pixel, before.pixel);
  await set(page, 'convergence', -1.2, true);
  await page.locator('#inspection').selectOption('red');
  assert.equal((await snapshot(page)).sums[1], 0);
  await page.screenshot({ path: join(evidence, '13-anaglifo-movil.png'), fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth));
  await page.locator('#reset').tap();
  assert.equal(await page.locator('#inspection').inputValue(), 'full');
  assert.equal(await page.locator('#gamma-number').inputValue(), '1');
}
