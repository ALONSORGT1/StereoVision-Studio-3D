const scale = { key: 'scale', label: 'Escala', min: 50, max: 200, step: 1, unit: '%' };
const brightness = { key: 'brightness', label: 'Brillo', min: 50, max: 150, step: 1, unit: '%' };
const contrast = { key: 'contrast', label: 'Contraste', min: 50, max: 150, step: 1, unit: '%' };
const horizontal = { key: 'horizontal', label: 'Desplazamiento horizontal', min: -8, max: 8, step: 0.1, unit: '%' };
const vertical = { key: 'vertical', label: 'Alineación vertical', min: -5, max: 5, step: 0.1, unit: '%' };

export function defaults() {
  return { scale: 100, brightness: 100, contrast: 100, horizontal: 0, vertical: 0, swap: false };
}

export function calibrationControls(mode) {
  if (mode === 'anaglyph') return [scale, brightness, contrast];
  if (mode === 'image' || mode === 'video') return [scale, horizontal, vertical];
  return [];
}

export function fit(sourceWidth, sourceHeight, viewportWidth, viewportHeight, scale) {
  const factor = Math.min(viewportWidth / sourceWidth, viewportHeight / sourceHeight) * scale / 100;
  return { width: sourceWidth * factor, height: sourceHeight * factor };
}
