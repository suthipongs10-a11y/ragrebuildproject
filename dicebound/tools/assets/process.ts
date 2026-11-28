import sharp from 'sharp';
import { CONFIG } from './config';
import { placeOnCanvas, resizeRaster, sharedScale, solidRaster, type Anchor } from './compose';
import type { ManifestEntry } from './manifest';
import { alphaStats, loadRaster, type Raster } from './pixels';
import { sliceAlphaRow, sliceBlackRow, sliceBlackRows, sliceGrid, sliceTiles, trimAlpha, type Piece, type SliceResult } from './slice';

export interface Frame {
  id: string;
  raster: Raster;
  anchor: Anchor;
  blend: 'normal' | 'add';
  placeholder: boolean;
}

export interface StandaloneImage {
  id: string;
  /** Encoded WebP. */
  data: Buffer;
  width: number;
  height: number;
}

export interface EntryResult {
  entry: ManifestEntry;
  status: 'ok' | 'missing' | 'failed' | 'reference';
  expected: number;
  got: number;
  method: string;
  scale: number | null;
  warnings: string[];
  failure: string | null;
  rawSize: string;
}

interface Sliced {
  entry: ManifestEntry;
  pieces: Piece[];
  ids: string[];
  result: EntryResult;
}

const PLACEHOLDER_RGBA: [number, number, number, number] = [255, 0, 255, 255];
const MAX_ATLAS_SINGLE = 512;

/** Poses of one creature share a scale so it never changes size mid-fight. */
export function scaleGroup(entry: ManifestEntry): string {
  return entry.baseId.replace(/_t\d$/, '').replace(/_[ab]$/, '');
}

function expectedCount(entry: ManifestEntry): number {
  const s = entry.slice;
  if (s.kind === 'row' || s.kind === 'rows') return s.count;
  if (s.kind === 'grid') return s.cols * s.rows;
  return s.kind === 'single' ? 1 : 0;
}

function frameIds(entry: ManifestEntry, count: number): string[] {
  const s = entry.slice;
  if (s.kind === 'single') return [entry.baseId];
  const names = s.kind === 'row' || s.kind === 'grid' ? s.names : null;
  // Boss sheets A and B hold different poses of one boss, so both use the boss id.
  const prefix = s.kind === 'row' && names ? entry.baseId.replace(/_[ab]$/, '') : entry.baseId;
  return Array.from({ length: count }, (_, i) => {
    const name = names?.[i];
    if (!name) return `${prefix}_${i}`;
    return s.kind === 'grid' ? name : `${prefix}_${name}`;
  });
}

function runSlice(entry: ManifestEntry, raster: Raster): SliceResult {
  const s = entry.slice;
  const black = entry.background === 'black';
  if (s.kind === 'row') return black ? sliceBlackRow(raster, s.count) : sliceAlphaRow(raster, s.count);
  if (s.kind === 'rows') return sliceBlackRows(raster, s.count);
  if (s.kind === 'grid') {
    if (entry.background === 'tile') return sliceTiles(raster, s.cols, s.rows);
    return sliceGrid(raster, s.cols, s.rows, black ? 'black' : 'alpha');
  }
  throw new Error(`runSlice called for ${s.kind}`);
}

export interface ProcessOutput {
  frames: Map<string, Frame[]>;
  images: StandaloneImage[];
  results: EntryResult[];
}

export async function processEntries(entries: ManifestEntry[]): Promise<ProcessOutput> {
  const images: StandaloneImage[] = [];
  const results: EntryResult[] = [];
  const sliced: Sliced[] = [];
  const frames = new Map<string, Frame[]>();
  const addFrame = (pack: string, frame: Frame): void => {
    frames.set(pack, [...(frames.get(pack) ?? []), frame]);
  };

  for (const entry of entries) {
    const expected = expectedCount(entry);
    const base: EntryResult = { entry, status: 'ok', expected, got: 0, method: '-', scale: null, warnings: [], failure: null, rawSize: '-' };
    if (entry.slice.kind === 'reference') {
      results.push({ ...base, status: 'reference', method: 'not used in game' });
      continue;
    }
    if (!entry.exists) {
      results.push({ ...base, status: 'missing', failure: 'file not found in raw/' });
      sliced.push({ entry, pieces: [], ids: frameIds(entry, expected), result: results.at(-1) as EntryResult });
      continue;
    }
    const raster = await loadRaster(entry.rawPath);
    base.rawSize = `${raster.width}x${raster.height}`;
    if (entry.background === 'alpha' && alphaStats(raster).transparent < 0.02) {
      base.warnings.push('manifest says alpha but the image is opaque — background was not removed');
    }

    if (entry.slice.kind === 'single') {
      const single = await processSingle(entry, raster);
      if (single.image) images.push(single.image);
      if (single.frame) addFrame(entry.pack, single.frame);
      results.push({ ...base, got: 1, method: single.method, scale: single.scale, warnings: [...base.warnings, ...single.warnings] });
      continue;
    }

    const cut = runSlice(entry, raster);
    const result: EntryResult = {
      ...base,
      status: cut.failure ? 'failed' : 'ok',
      got: cut.pieces.length,
      method: cut.method,
      warnings: [...base.warnings, ...cut.warnings],
      failure: cut.failure,
    };
    results.push(result);
    sliced.push({ entry, pieces: cut.pieces, ids: frameIds(entry, expected), result });
  }

  // Second pass: one scale per creature / per sheet, then place on the final canvas.
  const groups = new Map<string, Sliced[]>();
  for (const item of sliced) groups.set(scaleGroup(item.entry), [...(groups.get(scaleGroup(item.entry)) ?? []), item]);
  for (const group of groups.values()) {
    const sizes = group.flatMap((item) => item.pieces.map((p) => p.raster));
    for (const item of group) {
      const { entry, pieces, ids, result } = item;
      const target = entry.finalSize;
      const black = entry.background === 'black';
      const anchor: Anchor = entry.slice.kind === 'row' && !black ? 'bottom' : 'center';
      const blend = black ? 'add' : 'normal';
      if (pieces.length === 0) {
        const w = target?.width ?? 64;
        const h = target?.height ?? w;
        for (const id of ids) addFrame(entry.pack, { id, raster: solidRaster(w, h, PLACEHOLDER_RGBA), anchor, blend, placeholder: true });
        continue;
      }
      const scale = target ? sharedScale(sizes, target.width, target.height ?? target.width) : 1;
      result.scale = scale;
      for (const piece of pieces) {
        const id = ids[piece.index] ?? `${entry.baseId}_${piece.index}`;
        const raster = target
          ? await placeOnCanvas(piece.raster, scale, target.width, target.height ?? target.width, anchor, CONFIG.resizeKernel, black)
          : piece.raster;
        addFrame(entry.pack, { id, raster, anchor, blend, placeholder: false });
      }
    }
  }
  return { frames, images, results };
}

async function processSingle(
  entry: ManifestEntry,
  raster: Raster,
): Promise<{ image: StandaloneImage | null; frame: Frame | null; method: string; scale: number | null; warnings: string[] }> {
  const warnings: string[] = [];
  const target = entry.finalSize;
  const alpha = entry.background === 'alpha';
  const source = alpha ? trimAlpha(raster).raster : raster;
  let width = source.width;
  let height = source.height;
  let scale = 1;
  if (target) {
    const targetH = target.height ?? Math.round((target.width * source.height) / source.width);
    if (alpha) {
      scale = Math.min(1, target.width / source.width, targetH / source.height);
      width = Math.round(source.width * scale);
      height = Math.round(source.height * scale);
    } else {
      const sameShape = Math.abs(target.width / targetH - source.width / source.height) < 0.01;
      if (!sameShape) warnings.push(`aspect differs from final_size ${entry.finalSizeText}; kept at ${source.width}x${source.height}`);
      else {
        width = target.width;
        height = targetH;
        scale = width / source.width;
      }
    }
  }
  const resized = await resizeRaster(source, width, height, CONFIG.resizeKernel);
  const method = alpha ? 'trimmed to artwork' : 'whole image';
  if (alpha && Math.max(width, height) <= MAX_ATLAS_SINGLE) {
    return { image: null, frame: { id: entry.baseId, raster: resized, anchor: 'center', blend: 'normal', placeholder: false }, method, scale, warnings };
  }
  const data = await sharp(resized.data, { raw: { width, height, channels: 4 } })
    .webp(alpha ? { lossless: true } : { quality: CONFIG.sceneWebpQuality })
    .toBuffer();
  return { image: { id: entry.baseId, data, width, height }, frame: null, method, scale, warnings };
}
