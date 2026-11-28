import sharp from 'sharp';
import { CONFIG } from './config';

export interface Raster {
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel. */
  data: Buffer;
}

export interface Box {
  x0: number;
  y0: number;
  /** Exclusive. */
  x1: number;
  y1: number;
}

export interface Component extends Box {
  id: number;
  area: number;
}

export async function loadRaster(file: string): Promise<Raster> {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data };
}

/** 1 where the pixel belongs to artwork. Alpha sheets use alpha, black sheets use brightness. */
export function buildMask(raster: Raster, mode: 'alpha' | 'black'): Uint8Array {
  const { width, height, data } = raster;
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) {
    const p = i * 4;
    if (mode === 'alpha') mask[i] = (data[p + 3] ?? 0) >= CONFIG.alphaOpaqueMin ? 1 : 0;
    else mask[i] = Math.max(data[p] ?? 0, data[p + 1] ?? 0, data[p + 2] ?? 0) >= CONFIG.blackLitMin ? 1 : 0;
  }
  return mask;
}

/** Share of pixels whose alpha is neither clearly clear nor clearly solid. */
export function alphaStats(raster: Raster): { transparent: number; opaque: number } {
  let transparent = 0;
  let opaque = 0;
  const total = raster.width * raster.height;
  for (let i = 0; i < total; i++) {
    const alpha = raster.data[i * 4 + 3] ?? 0;
    if (alpha < CONFIG.alphaOpaqueMin) transparent++;
    else opaque++;
  }
  return { transparent: transparent / total, opaque: opaque / total };
}

/** Square-kernel erosion: a pixel survives only if every neighbour within `radius` is set. */
export function erode(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  if (radius === 0) return mask;
  const horizontal = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    let run = 0;
    const row = y * width;
    for (let x = 0; x < width; x++) {
      run = mask[row + x] ? run + 1 : 0;
      // A run of 2r+1 set pixels ending at x means the pixel at x-r is fully covered.
      if (run >= 2 * radius + 1) horizontal[row + x - radius] = 1;
    }
  }
  const out = new Uint8Array(mask.length);
  for (let x = 0; x < width; x++) {
    let run = 0;
    for (let y = 0; y < height; y++) {
      run = horizontal[y * width + x] ? run + 1 : 0;
      if (run >= 2 * radius + 1) out[(y - radius) * width + x] = 1;
    }
  }
  return out;
}

/** 8-connected component labelling. labels[i] = component id (1-based) or 0. */
export function labelComponents(
  mask: Uint8Array,
  width: number,
  height: number,
): { labels: Int32Array; components: Component[] } {
  const labels = new Int32Array(mask.length);
  const components: Component[] = [];
  const stack: number[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue;
    const id = components.length + 1;
    const component: Component = { id, area: 0, x0: width, y0: height, x1: 0, y1: 0 };
    labels[start] = id;
    stack.push(start);
    while (stack.length > 0) {
      const index = stack.pop() as number;
      const x = index % width;
      const y = (index - x) / width;
      component.area++;
      if (x < component.x0) component.x0 = x;
      if (y < component.y0) component.y0 = y;
      if (x + 1 > component.x1) component.x1 = x + 1;
      if (y + 1 > component.y1) component.y1 = y + 1;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const next = ny * width + nx;
          if (mask[next] && !labels[next]) {
            labels[next] = id;
            stack.push(next);
          }
        }
      }
    }
    components.push(component);
  }
  return { labels, components };
}

export function unionBox(boxes: Box[]): Box {
  const out: Box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const box of boxes) {
    out.x0 = Math.min(out.x0, box.x0);
    out.y0 = Math.min(out.y0, box.y0);
    out.x1 = Math.max(out.x1, box.x1);
    out.y1 = Math.max(out.y1, box.y1);
  }
  return out;
}

/** Distance between two boxes (0 when they touch or overlap). */
export function boxGap(a: Box, b: Box): number {
  const dx = Math.max(0, a.x0 - b.x1, b.x0 - a.x1);
  const dy = Math.max(0, a.y0 - b.y1, b.y0 - a.y1);
  return Math.hypot(dx, dy);
}

/** Copies `box` out of the raster, keeping only pixels for which `keep` is true. */
export function cropRaster(raster: Raster, box: Box, keep: ((index: number) => boolean) | null, solidAlpha: boolean): Raster {
  const width = box.x1 - box.x0;
  const height = box.y1 - box.y0;
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const source = (box.y0 + y) * raster.width + box.x0 + x;
      if (keep && !keep(source)) continue;
      const from = source * 4;
      const to = (y * width + x) * 4;
      data[to] = raster.data[from] ?? 0;
      data[to + 1] = raster.data[from + 1] ?? 0;
      data[to + 2] = raster.data[from + 2] ?? 0;
      data[to + 3] = solidAlpha ? 255 : (raster.data[from + 3] ?? 0);
    }
  }
  return { width, height, data };
}
