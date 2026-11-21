/**
 * Shared Canvas, Math & Clipboard Utilities for Interactive Portal Widgets
 * Pure ES Module — zero build step, zero external dependencies.
 */

export function setupHiDpiCanvas(canvas, cssHeight = 240) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(280, Math.floor(rect.width || 640));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(cssHeight * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height: cssHeight };
}

export function gaussianNoise() {
  // Box-Muller transform for realistic thermal RF noise floor
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function copyText(text, btn, originalLabel) {
  if (!navigator.clipboard) return;
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = "Copied!";
    setTimeout(() => {
      btn.textContent = originalLabel;
    }, 1200);
  }).catch(() => {});
}
