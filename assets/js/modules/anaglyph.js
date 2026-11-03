import { fit } from './calibration.js';

export function drawAnaglyph(context, canvas, { element, width, height }, settings) {
  const size = fit(width, height, canvas.width, canvas.height, settings.scale);
  const filter = 'brightness(' + settings.brightness + '%) contrast(' + settings.contrast + '%)';
  if ('filter' in context) context.filter = filter;
  else canvas.style.filter = filter;
  context.drawImage(element, (canvas.width - size.width) / 2, (canvas.height - size.height) / 2, size.width, size.height);
}
