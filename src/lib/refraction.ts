/**
 * Builds a displacement map for a rounded-rect "lens" of size w×h with corner radius r.
 *
 * Red = horizontal shift, green = vertical shift, 128 = no shift (feDisplacementMap in sRGB).
 * Inside a bezel band along the edge, pixels sample the backdrop from further toward the
 * centre, with the strength rising steeply at the rim, like light bending through the
 * curved edge of a thick piece of glass. The flat middle stays undistorted.
 */
export function displacementMap(w: number, h: number, r: number, bezel = Math.min(18, h / 2.5)) {
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;

  const img = ctx.createImageData(W, H);
  const data = img.data;
  const cx = W / 2;
  const cy = H / 2;
  const rad = Math.min(r, W / 2, H / 2);

  // signed distance to the rounded-rect edge (negative inside)
  const sdf = (x: number, y: number) => {
    const qx = Math.abs(x - cx) - (W / 2 - rad);
    const qy = Math.abs(y - cy) - (H / 2 - rad);
    const ox = Math.max(qx, 0);
    const oy = Math.max(qy, 0);
    return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - rad;
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const d = sdf(px, py);
      let dx = 0;
      let dy = 0;
      if (d < 0 && -d < bezel) {
        // outward normal from the SDF gradient
        const nx = sdf(px + 0.5, py) - sdf(px - 0.5, py);
        const ny = sdf(px, py + 0.5) - sdf(px, py - 0.5);
        const len = Math.hypot(nx, ny) || 1;
        const t = 1 - -d / bezel; // 0 at the inner edge of the bezel → 1 at the rim
        const strength = t * t * (3 - 2 * t) * t; // smooth, steep near the rim
        dx = -(nx / len) * strength; // sample toward the centre
        dy = -(ny / len) * strength;
      }
      const i = (y * W + x) * 4;
      data[i] = Math.round(128 + dx * 127);
      data[i + 1] = Math.round(128 + dy * 127);
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}
