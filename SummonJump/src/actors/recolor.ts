import type Phaser from 'phaser';

/**
 * Recolour a texture for a look-alike monster (Drops = orange Poring): luminance x tint colour, alpha kept.
 * Made once per (texture, tint) and cached in the texture manager, so it survives room changes.
 */
export function recolored(scene: Phaser.Scene, key: string, tint: number): string {
  const out = `${key}#${tint.toString(16)}`;
  if (scene.textures.exists(out)) return out;
  const src = scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const tex = scene.textures.createCanvas(out, src.width, src.height);
  if (!tex) return key;
  const ctx = tex.getContext();
  ctx.drawImage(src, 0, 0);
  try {
    const img = ctx.getImageData(0, 0, src.width, src.height), d = img.data;
    const r = ((tint >> 16) & 255) / 255, g = ((tint >> 8) & 255) / 255, b = (tint & 255) / 255;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      // luminance, lifted a little so dark tints don't go muddy
      const l = Math.min(255, (0.3 * (d[i] as number) + 0.59 * (d[i + 1] as number) + 0.11 * (d[i + 2] as number)) * 1.25);
      d[i] = l * r; d[i + 1] = l * g; d[i + 2] = l * b;
    }
    ctx.putImageData(img, 0, 0);
  } catch { /* tainted canvas: keep the original colours */ }
  tex.refresh();
  return out;
}
