import sharp from 'sharp';
import { CONFIG, type ResizeKernel } from './config';
import type { Raster } from './pixels';

export type Anchor = 'bottom' | 'center';

export async function resizeRaster(raster: Raster, width: number, height: number, kernel: ResizeKernel): Promise<Raster> {
  if (width === raster.width && height === raster.height) return raster;
  let pipeline = sharp(raster.data, { raw: { width: raster.width, height: raster.height, channels: 4 } }).resize(width, height, {
    kernel: kernel === 'nearest' ? 'nearest' : 'lanczos3',
    fit: 'fill',
  });
  // Lanczos softens pixel-art edges slightly when shrinking; a light sharpen brings them back.
  if (kernel === 'lanczos' && (width < raster.width || height < raster.height)) pipeline = pipeline.sharpen({ sigma: CONFIG.sharpenSigma });
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data };
}

/** Largest scale (never above 1) at which every piece fits the target box. */
export function sharedScale(sizes: Array<{ width: number; height: number }>, targetW: number, targetH: number): number {
  const maxW = Math.max(...sizes.map((s) => s.width));
  const maxH = Math.max(...sizes.map((s) => s.height));
  return Math.min(1, targetW / maxW, targetH / maxH);
}

/** Scales a piece and places it on a canvas: feet on the bottom edge, or dead centre. */
export async function placeOnCanvas(
  raster: Raster,
  scale: number,
  canvasW: number,
  canvasH: number,
  anchor: Anchor,
  kernel: ResizeKernel,
  opaqueBlack: boolean,
): Promise<Raster> {
  const width = Math.max(1, Math.min(canvasW, Math.round(raster.width * scale)));
  const height = Math.max(1, Math.min(canvasH, Math.round(raster.height * scale)));
  const scaled = await resizeRaster(raster, width, height, kernel);
  const data = Buffer.alloc(canvasW * canvasH * 4);
  if (opaqueBlack) for (let i = 3; i < data.length; i += 4) data[i] = 255;
  const left = Math.floor((canvasW - width) / 2);
  const top = anchor === 'bottom' ? canvasH - height : Math.floor((canvasH - height) / 2);
  for (let y = 0; y < height; y++) {
    scaled.data.copy(data, ((top + y) * canvasW + left) * 4, y * width * 4, (y + 1) * width * 4);
  }
  return { width: canvasW, height: canvasH, data };
}

export function solidRaster(width: number, height: number, rgba: [number, number, number, number]): Raster {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgba[0];
    data[i + 1] = rgba[1];
    data[i + 2] = rgba[2];
    data[i + 3] = rgba[3];
  }
  return { width, height, data };
}

export async function writePng(raster: Raster, file: string): Promise<void> {
  await sharp(raster.data, { raw: { width: raster.width, height: raster.height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(file);
}
