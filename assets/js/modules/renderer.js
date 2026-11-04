import { AnaglyphRenderer } from './anaglyph.js';
import { defaults } from './calibration.js';
import { drawSBS } from './sbs.js';

const videoEvents = ['loadeddata', 'seeked', 'play', 'pause', 'ended'];

export class StereoRenderer {
  #canvas;
  #context;
  #observer;
  #media = null;
  #settings = defaults();
  #vr = false;
  #listeners = null;
  #animation = 0;
  #frame = null;
  #frameTime = -1;
  #anaglyph = null;

  constructor(canvas) {
    this.#canvas = canvas;
    this.#context = canvas.getContext('2d');
    this.#observer = new ResizeObserver(() => {
      if (this.#resize()) this.#draw();
    });
    this.#observer.observe(canvas);
    this.#resize();
  }

  #resize() {
    const { width, height } = this.#canvas.getBoundingClientRect();
    if (!width || !height) return false;
    const ratio = Math.min(devicePixelRatio, 2, 4096 / Math.max(width, height));
    const nextWidth = Math.max(2, Math.round(width * ratio / 2) * 2);
    const nextHeight = Math.max(1, Math.round(height * ratio));
    if (this.#canvas.width === nextWidth && this.#canvas.height === nextHeight) return false;
    this.#canvas.width = nextWidth;
    this.#canvas.height = nextHeight;
    return true;
  }

  setMedia(media) {
    this.#listeners?.abort();
    cancelAnimationFrame(this.#animation);
    this.#animation = 0;
    this.#frame = null;
    this.#frameTime = -1;
    this.#anaglyph?.setMedia(null);
    this.#media = media;
    this.#canvas.style.removeProperty('filter');
    this.#resize();

    if (media?.mode === 'anaglyph') {
      this.#anaglyph ??= new AnaglyphRenderer(() => this.#draw());
      this.#anaglyph.setMedia(media);
      this.#draw();
    } else if (media?.mode === 'video') {
      this.#listeners = new AbortController();
      const { signal } = this.#listeners;
      const frame = document.createElement('canvas');
      const factor = Math.min(1, 1920 / media.width, 1080 / media.height);
      frame.width = Math.max(2, Math.round(media.width * factor / 2) * 2);
      frame.height = Math.max(1, Math.round(media.height * factor));
      this.#frame = { canvas: frame, context: frame.getContext('2d'), ready: false };

      for (const type of videoEvents) {
        media.element.addEventListener(type, this.#onVideoEvent, { signal });
      }
      this.#onVideoEvent();
    } else {
      this.#draw();
    }
  }

  setCalibration(settings) {
    this.#settings = { ...settings };
    this.#draw();
  }

  setVR(active) {
    this.#vr = active;
    this.#resize();
    this.#draw();
  }

  #onVideoEvent = () => {
    this.#capture();
    this.#draw();
    this.#schedule();
  };

  #schedule() {
    const video = this.#media.element;
    if (video.paused || video.ended || this.#animation) return;
    this.#animation = requestAnimationFrame(() => {
      this.#animation = 0;
      if (video.currentTime !== this.#frameTime && this.#capture()) this.#draw();
      this.#schedule();
    });
  }

  #capture() {
    const video = this.#media.element;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.seeking) return false;
    const frame = this.#frame;
    // Freeze the video into one raster so both eyes always sample the same decoded frame.
    frame.context.drawImage(video, 0, 0, frame.canvas.width, frame.canvas.height);
    frame.ready = true;
    this.#frameTime = video.currentTime;
    return true;
  }

  #draw() {
    const context = this.#context;
    const canvas = this.#canvas;
    context.save();
    context.clearRect(0, 0, canvas.width, canvas.height);
    const media = this.#media;
    if (media?.mode === 'anaglyph') {
      this.#anaglyph.draw(context, canvas, this.#settings);
    } else if (media?.mode === 'image') {
      drawSBS(context, media.element, media.width, media.height, this.#settings, this.#vr);
    } else if (media?.mode === 'video' && this.#frame.ready) {
      const frame = this.#frame.canvas;
      drawSBS(context, frame, frame.width, frame.height, this.#settings, this.#vr, media.width, media.height);
    }
    context.restore();
  }

  destroy() {
    this.setMedia(null);
    this.#anaglyph?.destroy();
    this.#observer.disconnect();
  }
}
