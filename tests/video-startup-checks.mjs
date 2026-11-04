import assert from 'node:assert/strict';

export async function checkVideoStartup(browser, url, mobile = false) {
  const context = await browser.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    : { viewport: { width: 1440, height: 900 } });
  try {
    await context.addInitScript(() => {
      window.startupVideos = [];
      window.demoFileReads = 0;
      const create = document.createElement.bind(document);
      const read = File.prototype.arrayBuffer;
      document.createElement = (tag, ...args) => {
        const element = create(tag, ...args);
        if (tag === 'video') window.startupVideos.push(element);
        return element;
      };
      File.prototype.arrayBuffer = function () {
        if (/\.mp4$/i.test(this.name)) window.demoFileReads++;
        return read.call(this);
      };
    });
    const page = await context.newPage();
    const errors = [];
    const mediaRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (request.url().includes('.mp4')) {
        mediaRequests.push({ type: request.resourceType(), range: request.headers().range });
      }
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: 80, downloadThroughput: 500000, uploadThroughput: 250000,
    });
    await page.goto(url);
    await page.locator('[data-mode="video"]').click();
    for (const id of ['canon', 'metropolis']) {
      const started = Date.now();
      await page.locator('[data-demo="' + id + '"]').click();
      await page.waitForFunction(name => document.getElementById('filename').textContent === name,
        id + '.mp4', { timeout: 60_000 });
      await page.waitForFunction(() => window.startupVideos.at(-1).readyState >= 2);
      await page.waitForFunction(() => {
        const canvas = document.getElementById('screen');
        return canvas.getContext('2d').getImageData(
          Math.floor(canvas.width / 4), Math.floor(canvas.height / 2), 1, 1).data[3] > 0;
      });
      const readyMs = Date.now() - started;
      const state = await page.evaluate(() => {
        const video = window.startupVideos.at(-1);
        const canvas = document.getElementById('screen');
        return {
          src: video.getAttribute('src'), duration: video.duration,
          bufferedUntil: video.buffered.length ? video.buffered.end(video.buffered.length - 1) : 0,
          frame: canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
            .some((value, index) => index % 4 === 3 && value > 0),
        };
      });
      assert(state.src.startsWith('http'));
      assert(Math.abs(state.duration - 15) < 0.01);
      assert(state.frame);
      assert.equal(await page.evaluate(() => window.demoFileReads), 0);
      console.log(JSON.stringify({ test: 'video-startup', device: mobile ? 'mobile-emulated' : 'desktop',
        scene: id, readyMs, bufferedUntil: state.bufferedUntil, network: '4 Mbps / 80 ms / cold cache' }));
      await page.locator('#play').click();
      await page.waitForFunction(() => window.startupVideos.at(-1).currentTime > 0.25);
      await page.locator('#play').click();
      await page.locator('#seek').fill('10');
      await page.waitForFunction(() => !window.startupVideos.at(-1).seeking &&
        Math.abs(window.startupVideos.at(-1).currentTime - 10) < 0.1);
    }
    assert(mediaRequests.length >= 2);
    assert(mediaRequests.every(request => request.type === 'media'));
    assert(mediaRequests.some(request => request.range?.startsWith('bytes=')));

    // Cancel an in-flight demo and verify that only the latest source remains.
    await page.locator('[data-demo="canon"]').click();
    await page.locator('[data-demo="metropolis"]').click();
    await page.waitForFunction(() => document.getElementById('filename').textContent === 'metropolis.mp4' &&
      window.startupVideos.at(-1).readyState >= 2);
    assert(await page.evaluate(() => window.startupVideos.slice(0, -1)
      .every(video => video.paused && !video.getAttribute('src'))));
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
}
