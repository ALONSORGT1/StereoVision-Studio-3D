export class VRPresentation {
  #root;
  #onChange;
  #active = false;
  #fullscreen = false;

  constructor(root, { onChange }) {
    this.#root = root;
    this.#onChange = onChange;
    document.addEventListener('fullscreenchange', () => {
      if (document.fullscreenElement === root && this.#active) this.#fullscreen = true;
      else if (this.#fullscreen) this.exit();
    });
    document.addEventListener('keydown', (event) => {
      if (this.#active && event.key === 'Escape') {
        event.preventDefault();
        this.exit();
      }
    });
  }

  async enter() {
    if (this.#active) return;
    this.#active = true;
    this.#root.dataset.vr = 'true';
    this.#onChange(true);
    if (document.fullscreenElement) return;
    try {
      await this.#root.requestFullscreen?.();
      if (!this.#active && document.fullscreenElement === this.#root) {
        await document.exitFullscreen();
      }
    } catch {
      // The CSS layout also works when fullscreen is unavailable or denied.
    }
  }

  exit() {
    if (!this.#active) return;
    this.#active = false;
    this.#fullscreen = false;
    delete this.#root.dataset.vr;
    this.#onChange(false);
    if (document.fullscreenElement === this.#root) document.exitFullscreen().catch(() => {});
  }
}
