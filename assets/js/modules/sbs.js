import { fit } from './calibration.js';

export function drawSBS(context, source, width, height, settings, vr, aspectWidth = width, aspectHeight = height) {
  const eyeWidth = context.canvas.width / 2;
  const eyeHeight = context.canvas.height;
  const sourceEyeWidth = width / 2;
  const scale = vr ? settings.scale * 0.82 : settings.scale;
  // Half-SBS encodes each eye at half its intended horizontal resolution.
  const displayWidth = settings.sbsType === 'half' ? aspectWidth : aspectWidth / 2;
  const size = fit(displayWidth, aspectHeight, eyeWidth, eyeHeight, scale);
  const moveX = eyeWidth * (settings.moveX ?? 0) / 100;
  const moveY = eyeHeight * (settings.moveY ?? 0) / 100;

  for (let eye = 0; eye < 2; eye++) {
    const sourceEye = settings.swap ? 1 - eye : eye;
    const origin = eye * eyeWidth;
    const direction = eye === 0 ? 1 : -1;
    const x = origin + (eyeWidth - size.width) / 2 + moveX + direction * eyeWidth * settings.horizontal / 200;
    const y = (eyeHeight - size.height) / 2 + moveY + direction * eyeHeight * settings.vertical / 200;

    context.save();
    context.beginPath();
    context.rect(origin, 0, eyeWidth, eyeHeight);
    context.clip();
    context.drawImage(source, sourceEye * sourceEyeWidth, 0, sourceEyeWidth, height, x, y, size.width, size.height);
    context.restore();
  }
}
