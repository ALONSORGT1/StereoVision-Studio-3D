import assert from 'node:assert/strict';
import { join } from 'node:path';

async function settled(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function geometry(page) {
  await settled(page);
  return page.evaluate(() => ({
    eyes: window.testDraws.slice(-2).map(draw => draw.geometry),
    width: document.getElementById('screen').width / 2,
    height: document.getElementById('screen').height,
  }));
}

function near(actual, expected) {
  assert(Math.abs(actual - expected) < 0.01, actual + ' debe ser ' + expected);
}

async function set(page, key, value, numeric = false) {
  const input = page.locator('#' + key + (numeric ? '-number' : ''));
  await input.fill(String(value));
  if (numeric) await input.press('Tab');
  assert.equal(await page.locator('#' + key).inputValue(), String(value));
  assert.equal(await page.locator('#' + key + '-number').inputValue(), String(value));
}

export async function checkTouchSlider(page) {
  await settled(page);
  const before = await page.locator('#screen').evaluate(canvas => canvas.toDataURL());
  const slider = page.locator('#scale');
  const initial = await slider.inputValue();
  const bounds = await slider.boundingBox();
  await slider.tap({ position: { x: bounds.width * 0.7, y: bounds.height / 2 } });
  assert.notEqual(await slider.inputValue(), initial);
  assert.equal(await slider.inputValue(), await page.locator('#scale-number').inputValue());
  const after = await page.locator('#screen').evaluate(canvas => canvas.toDataURL());
  assert.notEqual(after, before);
}

export async function loadHalfSBS(page) {
  const compressed = await page.evaluate(() => {
    const source = window.testDraws.at(-1).source;
    const canvas = document.createElement('canvas');
    canvas.width = source.naturalWidth / 2;
    canvas.height = source.naturalHeight;
    canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('#file').setInputFiles({
    name: 'medio-sbs.png', mimeType: 'image/png', buffer: Buffer.from(compressed, 'base64'),
  });
  await page.waitForFunction(() => document.getElementById('filename').textContent === 'medio-sbs.png');
}

export async function checkImageCalibration(page, evidence) {
  for (const key of ['horizontal', 'moveX', 'moveY', 'vertical']) {
    for (const value of [-4.2, 4.2]) {
      await page.locator('#reset').click();
      const base = await geometry(page);
      await set(page, key, value, value < 0);
      const result = await geometry(page);
      const axis = ['horizontal', 'moveX'].includes(key) ? 4 : 5;
      const extent = axis === 4 ? base.width : base.height;
      const relative = ['horizontal', 'vertical'].includes(key);
      for (let eye = 0; eye < 2; eye++) {
        const sign = relative && eye === 1 ? -1 : 1;
        const expected = sign * value * extent / (relative ? 200 : 100);
        near(result.eyes[eye][axis] - base.eyes[eye][axis], expected);
        near(result.eyes[eye][axis === 4 ? 5 : 4], base.eyes[eye][axis === 4 ? 5 : 4]);
        assert.deepEqual(result.eyes[eye].slice(0, 4), base.eyes[eye].slice(0, 4));
      }
    }
  }

  await page.locator('#reset').click();
  const normal = await geometry(page);
  await set(page, 'scale', 145, true);
  const scaled = await geometry(page);
  for (let eye = 0; eye < 2; eye++) {
    near(scaled.eyes[eye][6] / normal.eyes[eye][6], 1.45);
    near(scaled.eyes[eye][7] / normal.eyes[eye][7], 1.45);
  }

  for (const [key, label, initial] of [
    ['scale', 'Escala', 100], ['horizontal', 'Paralaje', 0],
    ['moveX', 'Mover X', 0], ['moveY', 'Mover Y', 0], ['vertical', 'Desnivel', 0],
  ]) {
    await set(page, key, key === 'scale' ? 160 : 3.1);
    await page.getByRole('button', { name: 'Restablecer ' + label, exact: true }).click();
    assert.equal(await page.locator('#' + key + '-number').inputValue(), String(initial));
    assert.equal(await page.locator('#' + key).inputValue(), String(initial));
  }
  await set(page, 'moveX', 7.5, true);
  const alignment = page.getByText('Alineación', { exact: true });
  await alignment.focus();
  await alignment.press('Enter');
  assert(!(await page.locator('#moveX').isVisible()));
  await alignment.press('Space');
  assert.equal(await page.locator('#moveX-number').inputValue(), '7.5');
  await page.locator('#moveX').focus();
  await page.locator('#moveX').press('ArrowRight');
  assert.equal(await page.locator('#moveX-number').inputValue(), '7.6');

  await page.locator('#moveX-number').fill('999');
  await page.locator('#moveX-number').press('Tab');
  assert.equal(await page.locator('#moveX').inputValue(), '25');
  assert.equal(await page.locator('#moveX-number').inputValue(), '25');
  await page.locator('#moveX-number').fill('');
  await page.locator('#moveX-number').press('Tab');
  assert.equal(await page.locator('#moveX-number').inputValue(), '25');
  await page.locator('#reset').click();

  // Encode an actual Half-SBS from the source without changing the per-eye scene.
  await page.locator('#moveX-number').fill('8.3');
  await loadHalfSBS(page);
  assert.equal(await page.locator('#moveX-number').inputValue(), '0');
  const compressedFull = await geometry(page);
  await page.locator('#sbsType').selectOption('half');
  const corrected = await geometry(page);
  for (let eye = 0; eye < 2; eye++) {
    near(corrected.eyes[eye][6] / corrected.eyes[eye][7],
      2 * compressedFull.eyes[eye][6] / compressedFull.eyes[eye][7]);
    near(corrected.eyes[eye][6] / corrected.eyes[eye][7], 320 / 180);
    assert.deepEqual(corrected.eyes[eye].slice(0, 4), compressedFull.eyes[eye].slice(0, 4));
  }
  await page.getByRole('button', { name: 'Restablecer Tipo de SBS', exact: true }).click();
  assert.equal(await page.locator('#sbsType').inputValue(), 'full');

  await page.locator('#swap').check();
  const swapped = await geometry(page);
  near(swapped.eyes[0][0], compressedFull.eyes[1][0]);
  near(swapped.eyes[1][0], compressedFull.eyes[0][0]);
  await page.getByRole('button', { name: 'Restablecer Intercambiar L/R', exact: true }).click();
  assert(!(await page.locator('#swap').isChecked()));

  await page.locator('#sbsType').selectOption('half');
  await set(page, 'horizontal', -2.1);
  await set(page, 'moveX', 5);
  await set(page, 'moveY', -3);
  await set(page, 'vertical', 1.1);
  await set(page, 'scale', 110);
  await page.locator('#swap').check();
  await page.screenshot({ path: join(evidence, '09-calibracion-avanzada.png'), fullPage: true });
  const state = await page.locator('#controls input, #controls select').evaluateAll(inputs => inputs.map(input => [input.id, input.value, input.checked]));
  // Use the in-page VR fallback so the browser test also covers denied fullscreen.
  await page.evaluate(() => {
    document.getElementById('studio').requestFullscreen = () => Promise.reject(new Error('Not available'));
  });
  await page.locator('#vr').click();
  const immersive = await geometry(page);
  for (let eye = 0; eye < 2; eye++) {
    const [x, y, width, height] = immersive.eyes[eye].slice(4);
    near(width / height, 320 / 180);
    const direction = eye === 0 ? 1 : -1;
    near(x - eye * immersive.width - (immersive.width - width) / 2,
      immersive.width * (5 / 100 + direction * -2.1 / 200));
    near(y - (immersive.height - height) / 2,
      immersive.height * (-3 / 100 + direction * 1.1 / 200));
  }
  await page.locator('#exit-vr').click();
  assert.deepEqual(await page.locator('#controls input, #controls select').evaluateAll(inputs => inputs.map(input => [input.id, input.value, input.checked])), state);

  await page.locator('#reset').click();
  assert.equal(await page.locator('#sbsType').inputValue(), 'full');
  assert(!(await page.locator('#swap').isChecked()));
  for (const key of ['horizontal', 'moveX', 'moveY', 'vertical', 'scale']) {
    assert.equal(await page.locator('#' + key).inputValue(), key === 'scale' ? '100' : '0');
  }
  // Loading another demo must discard all previous calibration.
  await set(page, 'moveX', 9.5);
  await page.locator('#sbsType').selectOption('half');
  await page.locator('[data-demo="arrecife"]').click();
  await page.waitForFunction(() => document.getElementById('filename').textContent === 'arrecife.jpg');
  assert.equal(await page.locator('#moveX-number').inputValue(), '0');
  assert.equal(await page.locator('#sbsType').inputValue(), 'full');
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await settled(page);
    assert(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth));
    const inputsFit = await page.locator('#controls input[type=number]').evaluateAll(inputs =>
      inputs.every(input => input.getBoundingClientRect().right <= innerWidth));
    assert(inputsFit);
  }
  console.log('SBS avanzado PASS: transformaciones relativas/conjuntas, aspecto Half-SBS, campos, restablecimiento, demos y VR');
}
