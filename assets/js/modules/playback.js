const events = ['play', 'playing', 'pause', 'ended', 'seeking', 'seeked', 'timeupdate',
  'durationchange', 'volumechange', 'waiting', 'canplay', 'error'];

export class VideoPlayback {
  #video = null;
  #listeners = null;
  #waiting = false;
  #volumeSupported = true;
  #onChange;
  #onError;

  constructor({ onChange, onError }) {
    this.#onChange = onChange;
    this.#onError = onError;
  }

  bind(video) {
    if (video === this.#video) {
      this.#update();
      return;
    }
    this.#listeners?.abort();
    this.#video = video;
    this.#waiting = false;
    this.#volumeSupported = true;
    if (video) {
      // iOS can leave the volume property unchanged when only hardware buttons are supported.
      const previous = video.volume;
      try {
        video.volume = previous === 0.5 ? 1 : 0.5;
        this.#volumeSupported = video.volume !== previous;
        video.volume = previous;
      } catch {
        this.#volumeSupported = false;
      }
      this.#listeners = new AbortController();
      const { signal } = this.#listeners;
      for (const type of events) video.addEventListener(type, this.#update, { signal });
    }
    this.#update();
  }

  #update = (event) => {
    const video = this.#video;
    const type = event?.type;
    if (type === 'waiting') this.#waiting = true;
    if (['playing', 'pause', 'ended', 'canplay', 'error'].includes(type)) this.#waiting = false;
    if (video?.error && (type === 'error' || !event)) {
      this.#onError('No se pudo decodificar el video. Prueba con otro MP4, preferentemente H.264.');
    }
    this.#onChange({
      paused: video?.paused ?? true,
      ended: video?.ended ?? false,
      waiting: this.#waiting,
      currentTime: video?.currentTime ?? 0,
      duration: Number.isFinite(video?.duration) ? video.duration : 0,
      volume: video?.volume ?? 1,
      muted: video?.muted ?? false,
      volumeSupported: this.#volumeSupported,
    });
  };

  async toggle() {
    const video = this.#video;
    if (!video) return;
    if (!video.paused) {
      video.pause();
      return;
    }
    try {
      await video.play();
    } catch (error) {
      if (video !== this.#video || error.name === 'AbortError') return;
      this.#onError('No se pudo iniciar el video. Pulsa reproducir otra vez o selecciona otro MP4.');
    }
  }

  seek(seconds) {
    const video = this.#video;
    if (!video || !Number.isFinite(seconds) || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.min(video.duration, Math.max(0, seconds));
    this.#update();
  }

  skip(seconds) {
    if (this.#video) this.seek(this.#video.currentTime + seconds);
  }

  setVolume(value) {
    if (!this.#video || !this.#volumeSupported || !Number.isFinite(value)) return;
    const video = this.#video;
    const volume = Math.min(1, Math.max(0, value));
    video.volume = volume;
    // Hardware-managed browsers can still support a real mute action.
    video.muted = volume === 0;
    this.#update();
  }

  toggleMute() {
    if (!this.#video) return;
    this.#video.muted = !this.#video.muted;
    this.#update();
  }
}
