const scale = { key: 'scale', label: 'Escala', min: 50, max: 200, step: 1, unit: '%' };
const brightness = { key: 'brightness', label: 'Brillo', min: 50, max: 150, step: 1, unit: '%' };
const contrast = { key: 'contrast', label: 'Contraste', min: 50, max: 150, step: 1, unit: '%' };
const horizontal = { key: 'horizontal', label: 'Desplazamiento horizontal', min: -8, max: 8, step: 0.1, unit: '%' };
const vertical = { key: 'vertical', label: 'Alineación vertical', min: -5, max: 5, step: 0.1, unit: '%' };
const parallax = { ...horizontal, label: 'Paralaje', basis: '% ancho',
  description: 'Separa horizontalmente las vistas en sentidos opuestos. El valor es la separación relativa como porcentaje del ancho por ojo.' };
const offset = { ...vertical, label: 'Desnivel', basis: '% alto',
  description: 'Corrige la diferencia de altura entre ojos, moviendo cada vista en sentido opuesto.' };
const moveX = { key: 'moveX', label: 'Mover X', min: -25, max: 25, step: 0.1, unit: '%', basis: '% ancho',
  description: 'Mueve ambas vistas juntas. Un valor positivo desplaza el conjunto a la derecha.' };
const moveY = { key: 'moveY', label: 'Mover Y', min: -25, max: 25, step: 0.1, unit: '%', basis: '% alto',
  description: 'Mueve ambas vistas juntas. Un valor positivo desplaza el conjunto hacia abajo.' };

export const imageCalibrationSections = [
  { label: 'Paralaje y tamaño', controls: [parallax, { ...scale, basis: '%',
    description: 'Amplía o reduce ambas vistas conservando su proporción. A 100 % se ajustan al área por ojo.' }] },
  { label: 'Alineación', controls: [moveX, moveY, offset] },
];

export function defaults() {
  return { scale: 100, brightness: 100, contrast: 100, horizontal: 0, vertical: 0,
    moveX: 0, moveY: 0, sbsType: 'full', swap: false };
}

export function calibrationControls(mode) {
  if (mode === 'anaglyph') return [scale, brightness, contrast];
  if (mode === 'image') return imageCalibrationSections.flatMap(section => section.controls);
  if (mode === 'video') return [scale, horizontal, vertical];
  return [];
}

export function fit(sourceWidth, sourceHeight, viewportWidth, viewportHeight, scale) {
  const factor = Math.min(viewportWidth / sourceWidth, viewportHeight / sourceHeight) * scale / 100;
  return { width: sourceWidth * factor, height: sourceHeight * factor };
}
