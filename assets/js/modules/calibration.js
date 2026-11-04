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

export const anaglyphCalibrationSections = [
  { label: 'Imagen', controls: [
    { ...scale, basis: '%', description: 'Ajusta el tamaño del anaglifo conservando su proporción.' },
    { ...brightness, basis: '%', description: 'Multiplica la luminosidad de los tres canales.' },
    { ...contrast, basis: '%', description: 'Ajusta la separación tonal respecto al gris medio.' },
    { key: 'gamma', label: 'Gamma', min: 0.5, max: 2, step: 0.05, unit: '', basis: '',
      description: 'Aplica salida = entrada^(1/gamma). Un valor mayor que 1 aclara los tonos medios.' },
  ] },
  { label: 'Calibración estereoscópica', controls: [
    { key: 'convergence', label: 'Convergencia horizontal', min: -3, max: 3, step: 0.1, unit: '%', basis: '% ancho',
      description: 'Separación relativa como porcentaje del ancho del visor. Positivo mueve rojo a la derecha y cian a la izquierda.' },
    { key: 'anaglyphVertical', label: 'Alineación vertical', min: -2, max: 2, step: 0.1, unit: '%', basis: '% alto',
      description: 'Separación relativa como porcentaje del alto del visor. Positivo baja el rojo y sube el cian.' },
  ] },
  { label: 'Balance cromático', controls: [
    { key: 'redGain', label: 'Intensidad roja', min: 0, max: 150, step: 1, unit: '%', basis: '%',
      description: 'Ajusta solo el rojo. Por encima de 100 %, realza los tonos medios con una curva que conserva los blancos.' },
    { key: 'cyanGain', label: 'Intensidad cian', min: 0, max: 150, step: 1, unit: '%', basis: '%',
      description: 'Ajusta verde y azul juntos. Por encima de 100 %, realza los tonos medios conservando los blancos.' },
  ] },
];

export function defaults() {
  return { scale: 100, brightness: 100, contrast: 100, horizontal: 0, vertical: 0,
    moveX: 0, moveY: 0, sbsType: 'full', swap: false,
    convergence: 0, anaglyphVertical: 0, redGain: 100, cyanGain: 100, gamma: 1, inspection: 'full' };
}

export function calibrationControls(mode) {
  if (mode === 'anaglyph') return anaglyphCalibrationSections.flatMap(section => section.controls);
  if (mode === 'image') return imageCalibrationSections.flatMap(section => section.controls);
  if (mode === 'video') return [scale, horizontal, vertical];
  return [];
}

export function fit(sourceWidth, sourceHeight, viewportWidth, viewportHeight, scale) {
  const factor = Math.min(viewportWidth / sourceWidth, viewportHeight / sourceHeight) * scale / 100;
  return { width: sourceWidth * factor, height: sourceHeight * factor };
}
