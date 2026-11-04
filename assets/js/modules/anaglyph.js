import { fit } from './calibration.js';

const vertexSource = `
attribute vec2 position;
varying vec2 uv;
void main() {
  uv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const fragmentSource = `
precision highp float;
varying vec2 uv;
uniform sampler2D original;
uniform vec2 imageScale;
uniform vec2 offset;
uniform vec3 tone;
uniform vec2 gains;
uniform int inspection;

vec4 sampleInside(vec2 p) {
  if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) return vec4(0.0);
  return texture2D(original, p);
}
float adjust(float channel, float gain) {
  float value = clamp((channel * tone.x - 0.5) * tone.y + 0.5, 0.0, 1.0);
  // Attenuation is linear. Boosts preserve highlight headroom.
  value = gain <= 1.0 ? value * gain : value * gain / (1.0 + value * (gain - 1.0));
  return pow(value, 1.0 / tone.z);
}
void main() {
  vec2 sourceUV = (uv - 0.5) / imageScale + 0.5;
  vec4 red = sampleInside(sourceUV - offset);
  vec4 cyan = sampleInside(sourceUV + offset);
  if (inspection == 1) cyan = vec4(0.0);
  if (inspection == 2) red = vec4(0.0);
  float alpha = max(red.a, cyan.a);
  vec3 color = vec3(adjust(red.r, gains.x) * red.a,
                    adjust(cyan.g, gains.y) * cyan.a,
                    adjust(cyan.b, gains.y) * cyan.a);
  gl_FragColor = alpha > 0.0 ? vec4(color / alpha, alpha) : vec4(0.0);
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
}

function sample(pixels, width, height, x, y, channel) {
  if (x < -0.5 || y < -0.5 || x > width - 0.5 || y > height - 0.5) return 0;
  x = Math.max(0, Math.min(width - 1, x));
  y = Math.max(0, Math.min(height - 1, y));
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(width - 1, x0 + 1), y1 = Math.min(height - 1, y0 + 1);
  const dx = x - x0, dy = y - y0;
  const a = pixels[(y0 * width + x0) * 4 + channel];
  const b = pixels[(y0 * width + x1) * 4 + channel];
  const c = pixels[(y1 * width + x0) * 4 + channel];
  const d = pixels[(y1 * width + x1) * 4 + channel];
  return (a * (1 - dx) + b * dx) * (1 - dy) + (c * (1 - dx) + d * dx) * dy;
}

function lookup(settings, gain) {
  return Uint8ClampedArray.from({ length: 256 }, (_, i) => {
    let value = Math.max(0, Math.min(1, (i / 255 * settings.brightness / 100 - 0.5) * settings.contrast / 100 + 0.5));
    value = gain <= 1 ? value * gain : value * gain / (1 + value * (gain - 1));
    return 255 * value ** (1 / settings.gamma);
  });
}

// One immutable texture per active image, with a bounded Canvas fallback.
export class AnaglyphRenderer {
  #canvas = document.createElement('canvas');
  #gl = null;
  #program = null;
  #buffer = null;
  #texture = null;
  #uniforms = {};
  #media = null;
  #cpu = null;
  #events = new AbortController();

  constructor(onInvalidate) {
    this.#canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      this.#releaseGPU();
      onInvalidate();
    }, { signal: this.#events.signal });
    this.#canvas.addEventListener('webglcontextrestored', () => {
      this.#prepareGPU();
      if (this.#media) this.#upload();
      onInvalidate();
    }, { signal: this.#events.signal });
    this.#prepareGPU();
  }

  #prepareGPU() {
    const gl = this.#canvas.getContext('webgl', {
      alpha: true, premultipliedAlpha: false, antialias: false, preserveDrawingBuffer: true,
    });
    if (!gl || gl.isContextLost()) return;
    const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (vertex && fragment) {
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
    }
    if (vertex) gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return;
    }
    this.#gl = gl;
    this.#program = program;
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    this.#buffer = buffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    for (const name of ['original', 'imageScale', 'offset', 'tone', 'gains', 'inspection']) {
      this.#uniforms[name] = gl.getUniformLocation(program, name);
    }
    gl.uniform1i(this.#uniforms.original, 0);
  }

  #upload() {
    const gl = this.#gl;
    if (!gl) return;
    try {
      const { width, height, element } = this.#media;
      const limit = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      let source = element;
      if (Math.max(width, height) > limit) {
        source = document.createElement('canvas');
        const factor = limit / Math.max(width, height);
        source.width = Math.max(1, Math.floor(width * factor));
        source.height = Math.max(1, Math.floor(height * factor));
        source.getContext('2d').drawImage(element, 0, 0, source.width, source.height);
      }
      this.#texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.#texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      if (gl.getError() !== gl.NO_ERROR) this.#releaseGPU();
      else this.#cpu = null;
    } catch {
      this.#releaseGPU();
    }
  }

  setMedia(media) {
    if (this.#texture) this.#gl.deleteTexture(this.#texture);
    this.#texture = null;
    this.#cpu = null;
    this.#media = media;
    // Resizing releases the previous output backing store on replacement.
    this.#canvas.width = this.#canvas.height = 1;
    if (media) this.#upload();
  }

  draw(context, canvas, settings) {
    if (!this.#media) return;
    if (!this.#gl) {
      this.#drawCPU(context, canvas, settings);
      return;
    }
    const gl = this.#gl;
    if (this.#canvas.width !== canvas.width || this.#canvas.height !== canvas.height) {
      this.#canvas.width = canvas.width;
      this.#canvas.height = canvas.height;
    }
    const size = fit(this.#media.width, this.#media.height, canvas.width, canvas.height, settings.scale);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(this.#uniforms.imageScale, size.width / canvas.width, size.height / canvas.height);
    gl.uniform2f(this.#uniforms.offset,
      canvas.width * settings.convergence / 200 / size.width,
      -canvas.height * settings.anaglyphVertical / 200 / size.height);
    gl.uniform3f(this.#uniforms.tone, settings.brightness / 100, settings.contrast / 100, settings.gamma);
    gl.uniform2f(this.#uniforms.gains, settings.redGain / 100, settings.cyanGain / 100);
    gl.uniform1i(this.#uniforms.inspection, { full: 0, red: 1, cyan: 2 }[settings.inspection]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    context.drawImage(this.#canvas, 0, 0);
  }

  #drawCPU(context, canvas, settings) {
    if (!this.#cpu) {
      const source = document.createElement('canvas');
      const factor = Math.min(1, 2048 / Math.max(this.#media.width, this.#media.height));
      source.width = Math.max(1, Math.round(this.#media.width * factor));
      source.height = Math.max(1, Math.round(this.#media.height * factor));
      const input = source.getContext('2d', { willReadFrequently: true });
      input.drawImage(this.#media.element, 0, 0, source.width, source.height);
      this.#cpu = { pixels: input.getImageData(0, 0, source.width, source.height).data,
        width: source.width, height: source.height };
    }
    const factor = Math.min(1, 1280 / Math.max(canvas.width, canvas.height));
    const width = Math.max(1, Math.round(canvas.width * factor));
    const height = Math.max(1, Math.round(canvas.height * factor));
    if (this.#canvas.width !== width || this.#canvas.height !== height) {
      this.#canvas.width = width;
      this.#canvas.height = height;
    }
    const output = this.#canvas.getContext('2d');
    // A WebGL canvas cannot change context type after context loss.
    const raster = output ? this.#canvas : (this.#cpu.output ??= document.createElement('canvas'));
    if (raster.width !== width || raster.height !== height) {
      raster.width = width;
      raster.height = height;
    }
    const target = output || raster.getContext('2d');
    const image = this.#cpu.image?.width === width && this.#cpu.image.height === height
      ? this.#cpu.image : (this.#cpu.image = target.createImageData(width, height));
    const red = lookup(settings, settings.redGain / 100);
    const cyan = lookup(settings, settings.cyanGain / 100);
    const size = fit(this.#media.width, this.#media.height, width, height, settings.scale);
    const left = (width - size.width) / 2, top = (height - size.height) / 2;
    const dx = width * settings.convergence / 200;
    const dy = height * settings.anaglyphVertical / 200;
    const source = this.#cpu;
    for (let y = 0; y < height; y++) {
      const ry = (y + 0.5 - top - dy) / size.height * source.height - 0.5;
      const cy = (y + 0.5 - top + dy) / size.height * source.height - 0.5;
      for (let x = 0; x < width; x++) {
        const rx = (x + 0.5 - left - dx) / size.width * source.width - 0.5;
        const cx = (x + 0.5 - left + dx) / size.width * source.width - 0.5;
        const ra = settings.inspection === 'cyan' ? 0 : sample(source.pixels, source.width, source.height, rx, ry, 3);
        const ca = settings.inspection === 'red' ? 0 : sample(source.pixels, source.width, source.height, cx, cy, 3);
        const alpha = Math.max(ra, ca);
        const index = (y * width + x) * 4;
        image.data[index] = alpha ? red[Math.round(sample(source.pixels, source.width, source.height, rx, ry, 0))] * ra / alpha : 0;
        image.data[index + 1] = alpha ? cyan[Math.round(sample(source.pixels, source.width, source.height, cx, cy, 1))] * ca / alpha : 0;
        image.data[index + 2] = alpha ? cyan[Math.round(sample(source.pixels, source.width, source.height, cx, cy, 2))] * ca / alpha : 0;
        image.data[index + 3] = alpha;
      }
    }
    target.putImageData(image, 0, 0);
    context.drawImage(raster, 0, 0, canvas.width, canvas.height);
  }

  #releaseGPU() {
    const gl = this.#gl;
    if (!gl) return;
    if (this.#texture) gl.deleteTexture(this.#texture);
    gl.deleteBuffer(this.#buffer);
    gl.deleteProgram(this.#program);
    this.#texture = this.#buffer = this.#program = null;
    this.#gl = null;
    this.#uniforms = {};
  }

  destroy() {
    this.#events.abort();
    this.setMedia(null);
    const gl = this.#gl;
    this.#releaseGPU();
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    this.#canvas.width = this.#canvas.height = 1;
  }
}
