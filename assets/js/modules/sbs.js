import { fit } from './calibration.js';

export function drawSBS(context, source, width, height, settings, vr, aspectWidth = width, aspectHeight = height) {
  const eyeWidth = context.canvas.width / 2;
  const eyeHeight = context.canvas.height;
  const sourceEyeWidth = width / 2;
  const scale = vr ? settings.scale * 0.82 : settings.scale;
  const size = fit(aspectWidth / 2, aspectHeight, eyeWidth, eyeHeight, scale);

  for (let eye = 0; eye < 2; eye++) {
    const sourceEye = settings.swap ? 1 - eye : eye;
    const origin = eye * eyeWidth;
    const direction = eye === 0 ? 1 : -1;
    const x = origin + (eyeWidth - size.width) / 2 + direction * eyeWidth * settings.horizontal / 200;
    const y = (eyeHeight - size.height) / 2 + direction * eyeHeight * settings.vertical / 200;

    context.save();
    context.beginPath();
    context.rect(origin, 0, eyeWidth, eyeHeight);
    context.clip();
    context.drawImage(source, sourceEye * sourceEyeWidth, 0, sourceEyeWidth, height, x, y, size.width, size.height);
    context.restore();
  }
}
