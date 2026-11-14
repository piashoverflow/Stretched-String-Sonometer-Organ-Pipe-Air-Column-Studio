export function syncCanvasSize(canvas: HTMLCanvasElement): {
  width: number;
  height: number;
  dpr: number;
} | null {
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  if (cssW <= 0 || cssH <= 0) return null;

  const dpr = window.devicePixelRatio || 1;
  const targetW = Math.round(cssW * dpr);
  const targetH = Math.round(cssH * dpr);

  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }

  return { width: cssW, height: cssH, dpr };
}

export function drawRoundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number | [number, number, number, number]
) {
  const [tl, tr, br, bl] =
    typeof radius === 'number' ? [radius, radius, radius, radius] : radius;
  const maxR = Math.min(w / 2, h / 2);
  const rTL = Math.min(tl, maxR);
  const rTR = Math.min(tr, maxR);
  const rBR = Math.min(br, maxR);
  const rBL = Math.min(bl, maxR);

  ctx.beginPath();
  ctx.moveTo(x + rTL, y);
  ctx.lineTo(x + w - rTR, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rTR);
  ctx.lineTo(x + w, y + h - rBR);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rBR, y + h);
  ctx.lineTo(x + rBL, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rBL);
  ctx.lineTo(x, y + rTL);
  ctx.quadraticCurveTo(x, y, x + rTL, y);
  ctx.closePath();
}
