import { CONFIG } from './config';
import { boxGap, buildMask, cropRaster, erode, labelComponents, unionBox, type Box, type Component, type Raster } from './pixels';

export interface Piece {
  index: number;
  raster: Raster;
  /** Where the piece sat in the raw sheet. */
  box: Box;
}

export interface SliceResult {
  pieces: Piece[];
  /** Human-readable description of how the cut was found. */
  method: string;
  warnings: string[];
  /** Set when the sheet could not be cut without guessing. */
  failure: string | null;
}

const fail = (failure: string): SliceResult => ({ pieces: [], method: '-', warnings: [], failure });

/** Consecutive runs of `true` in a projection. */
function runsOf(flags: boolean[]): Array<[number, number]> {
  const runs: Array<[number, number]> = [];
  let start = -1;
  flags.forEach((flag, i) => {
    if (flag && start < 0) start = i;
    if (!flag && start >= 0) {
      runs.push([start, i]);
      start = -1;
    }
  });
  if (start >= 0) runs.push([start, flags.length]);
  return runs;
}

/** Merges the two neighbours with the smallest gap until `target` intervals remain. */
function mergeIntervals(intervals: Array<[number, number]>, target: number): Array<[number, number]> {
  const out = intervals.map((interval): [number, number] => [interval[0], interval[1]]);
  while (out.length > target) {
    let best = 0;
    let bestGap = Infinity;
    for (let i = 0; i + 1 < out.length; i++) {
      const gap = (out[i + 1] as [number, number])[0] - (out[i] as [number, number])[1];
      if (gap < bestGap) {
        bestGap = gap;
        best = i;
      }
    }
    const merged: [number, number] = [(out[best] as [number, number])[0], (out[best + 1] as [number, number])[1]];
    out.splice(best, 2, merged);
  }
  return out;
}

function projection(mask: Uint8Array, width: number, height: number, axis: 'x' | 'y'): boolean[] {
  const length = axis === 'x' ? width : height;
  const counts = new Array<number>(length).fill(0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) counts[axis === 'x' ? x : y] = (counts[axis === 'x' ? x : y] ?? 0) + 1;
    }
  }
  return counts.map((count) => count > 0);
}

/**
 * A row of poses on a transparent sheet. Poses are found as connected blobs; when
 * sparks or glows bridge two poses, the mask is eroded just enough to separate the
 * bodies, then every original pixel is handed to the body it is connected to.
 */
export function sliceAlphaRow(raster: Raster, count: number): SliceResult {
  const { width, height } = raster;
  const mask = buildMask(raster, 'alpha');
  let groups: Component[][] | null = null;
  let seedLabels: Int32Array | null = null;
  let usedRadius = 0;
  let lastBodies = 0;

  for (const radius of CONFIG.erosionRadii) {
    const { labels, components } = labelComponents(erode(mask, width, height, radius), width, height);
    const largest = Math.max(0, ...components.map((c) => c.area));
    const bodies = components.filter((c) => c.area >= largest * CONFIG.bodyAreaShare).sort((a, b) => a.x0 - b.x0);
    lastBodies = bodies.length;
    if (bodies.length < count) continue;
    // More bodies than poses (e.g. a pawn hovering over its base): fuse horizontal neighbours.
    const merged = mergeIntervals(bodies.map((b): [number, number] => [b.x0, b.x1]), count);
    groups = merged.map(([x0, x1]) => bodies.filter((b) => b.x0 >= x0 && b.x1 <= x1));
    seedLabels = labels;
    usedRadius = radius;
    break;
  }
  if (!groups || !seedLabels) {
    return fail(`expected ${count} poses but only ${lastBodies} separable bodies even after eroding ${CONFIG.erosionRadii.at(-1)}px`);
  }

  // owner[i] = 1-based pose index for every artwork pixel.
  const owner = new Int32Array(mask.length);
  const componentToGroup = new Map<number, number>();
  groups.forEach((group, g) => group.forEach((c) => componentToGroup.set(c.id, g + 1)));
  let frontier: number[] = [];
  for (let i = 0; i < mask.length; i++) {
    const g = componentToGroup.get(seedLabels[i] ?? 0);
    if (g) {
      owner[i] = g;
      frontier.push(i);
    }
  }
  // Grow the seeds through the un-eroded mask, breadth first, so bridges split near their middle.
  while (frontier.length > 0) {
    const next: number[] = [];
    for (const index of frontier) {
      const x = index % width;
      const y = (index - x) / width;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const n = ny * width + nx;
          if (mask[n] && !owner[n]) {
            owner[n] = owner[index] ?? 0;
            next.push(n);
          }
        }
      }
    }
    frontier = next;
  }

  const boxes = groups.map((_, g) => boxOfOwner(owner, width, height, g + 1));
  // Loose bits (sparkles, impact stars) join the nearest pose.
  const loose = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) loose[i] = mask[i] && !owner[i] ? 1 : 0;
  const looseLabelled = labelComponents(loose, width, height);
  const looseOwner = new Map<number, number>();
  for (const component of looseLabelled.components) {
    if (component.area < CONFIG.speckArea) continue;
    let best = 0;
    let bestGap = Infinity;
    boxes.forEach((box, g) => {
      const gap = boxGap(component, box);
      if (gap < bestGap) {
        bestGap = gap;
        best = g + 1;
      }
    });
    looseOwner.set(component.id, best);
  }
  for (let i = 0; i < mask.length; i++) {
    const g = looseOwner.get(looseLabelled.labels[i] ?? 0);
    if (g) owner[i] = g;
  }

  const pieces = groups.map((_, g): Piece => {
    const box = boxOfOwner(owner, width, height, g + 1);
    return { index: g, box, raster: cropRaster(raster, box, (i) => owner[i] === g + 1, true) };
  });
  const warnings: string[] = [];
  const widths = pieces.map((p) => p.raster.width).sort((a, b) => a - b);
  const median = widths[Math.floor(widths.length / 2)] ?? 1;
  pieces.forEach((p) => {
    if (p.raster.width > median * 1.8) warnings.push(`pose ${p.index} is ${p.raster.width}px wide (median ${median}) — check it is one pose`);
  });
  const method = usedRadius === 0 ? 'connected blobs' : `connected blobs after ${usedRadius}px erosion (poses were touching)`;
  return { pieces, method, warnings, failure: null };
}

function boxOfOwner(owner: Int32Array, width: number, height: number, id: number): Box {
  const box: Box = { x0: width, y0: height, x1: 0, y1: 0 };
  for (let i = 0; i < owner.length; i++) {
    if (owner[i] !== id) continue;
    const x = i % width;
    const y = (i - x) / width;
    if (x < box.x0) box.x0 = x;
    if (y < box.y0) box.y0 = y;
    if (x + 1 > box.x1) box.x1 = x + 1;
    if (y + 1 > box.y1) box.y1 = y + 1;
  }
  return box;
}

/** A row of effect frames on black: frames are the lit column ranges, closest ranges fused. */
export function sliceBlackRow(raster: Raster, count: number): SliceResult {
  const { width, height } = raster;
  const mask = buildMask(raster, 'black');
  const columnRuns = runsOf(projection(mask, width, height, 'x'));
  if (columnRuns.length < count) return fail(`expected ${count} frames but lit columns form only ${columnRuns.length} groups`);
  const frames = mergeIntervals(columnRuns, count);
  // One shared vertical band keeps the effect from jumping up and down between frames.
  const rowRuns = runsOf(projection(mask, width, height, 'y'));
  const y0 = rowRuns[0]?.[0] ?? 0;
  const y1 = rowRuns.at(-1)?.[1] ?? height;
  const pieces = frames.map(([x0, x1], index): Piece => {
    const box = { x0, y0, x1, y1 };
    return { index, box, raster: cropRaster(raster, box, null, true) };
  });
  const method = columnRuns.length === count ? 'lit column ranges' : `lit column ranges (${columnRuns.length} fused to ${count} by nearest gap)`;
  return { pieces, method, warnings: [], failure: null };
}

/** Horizontal strips on black (tileable lines): one piece per lit row band, full sheet width. */
export function sliceBlackRows(raster: Raster, count: number): SliceResult {
  const { width, height } = raster;
  const rowRuns = runsOf(projection(buildMask(raster, 'black'), width, height, 'y'));
  if (rowRuns.length < count) return fail(`expected ${count} strips but found ${rowRuns.length} lit bands`);
  const bands = mergeIntervals(rowRuns, count);
  const pieces = bands.map(([y0, y1], index): Piece => {
    const box = { x0: 0, y0, x1: width, y1 };
    return { index, box, raster: cropRaster(raster, box, null, true) };
  });
  return { pieces, method: 'lit row bands', warnings: [], failure: null };
}

/**
 * A cols x rows sheet. The uniform grid is used only to decide which cell a blob
 * belongs to; every piece is cropped to the blobs' real bounding box.
 */
export function sliceGrid(raster: Raster, cols: number, rows: number, mode: 'alpha' | 'black'): SliceResult {
  const { width, height } = raster;
  const mask = buildMask(raster, mode);
  const { labels, components } = labelComponents(mask, width, height);
  const cellW = width / cols;
  const cellH = height / rows;
  const cells: Component[][] = Array.from({ length: cols * rows }, () => []);
  const cellOfComponent = new Map<number, number>();
  const warnings: string[] = [];
  for (const component of components) {
    if (component.area < CONFIG.speckArea) continue;
    const cx = (component.x0 + component.x1) / 2;
    const cy = (component.y0 + component.y1) / 2;
    const cell = Math.min(rows - 1, Math.floor(cy / cellH)) * cols + Math.min(cols - 1, Math.floor(cx / cellW));
    cells[cell]?.push(component);
    cellOfComponent.set(component.id, cell);
    if (component.x1 - component.x0 > cellW * 1.3 || component.y1 - component.y0 > cellH * 1.3) {
      warnings.push(`a blob near cell ${cell} spans more than one cell — neighbours may be touching`);
    }
  }
  const empty = cells.flatMap((cell, i) => (cell.length === 0 ? [i] : []));
  if (empty.length > 0) return fail(`expected ${cols}x${rows} = ${cols * rows} pieces but cell(s) ${empty.join(', ')} are empty`);
  const pieces = cells.map((cell, index): Piece => {
    const box = unionBox(cell);
    const keep = (i: number): boolean => cellOfComponent.get(labels[i] ?? 0) === index;
    return { index, box, raster: cropRaster(raster, box, mode === 'alpha' ? keep : null, true) };
  });
  return { pieces, method: 'blobs grouped by grid cell', warnings, failure: null };
}

/** Full-bleed tile sheets: cut on the real seam (the column/row where alpha dips) near each grid line. */
export function sliceTiles(raster: Raster, cols: number, rows: number): SliceResult {
  const { width, height, data } = raster;
  const meanAlpha = (axis: 'x' | 'y', at: number): number => {
    let sum = 0;
    const span = axis === 'x' ? height : width;
    for (let k = 0; k < span; k++) {
      const index = axis === 'x' ? k * width + at : at * width + k;
      sum += data[index * 4 + 3] ?? 0;
    }
    return sum / span;
  };
  const seams = (axis: 'x' | 'y', parts: number, size: number): number[] => {
    const cuts = [0];
    for (let k = 1; k < parts; k++) {
      const expected = Math.round((size * k) / parts);
      let best = expected;
      let bestAlpha = Infinity;
      for (let at = expected - CONFIG.tileSeamSearch; at <= expected + CONFIG.tileSeamSearch; at++) {
        const alpha = meanAlpha(axis, at);
        if (alpha < bestAlpha) {
          bestAlpha = alpha;
          best = at;
        }
      }
      cuts.push(best);
    }
    cuts.push(size);
    return cuts;
  };
  const xs = seams('x', cols, width);
  const ys = seams('y', rows, height);
  const inset = CONFIG.tileSeamInset;
  const pieces: Piece[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const box = {
        x0: (xs[c] ?? 0) + inset,
        x1: (xs[c + 1] ?? width) - inset,
        y0: (ys[r] ?? 0) + inset,
        y1: (ys[r + 1] ?? height) - inset,
      };
      pieces.push({ index: r * cols + c, box, raster: cropRaster(raster, box, null, true) });
    }
  }
  const method = `alpha seams at x=${xs.slice(1, -1).join('/')} y=${ys.slice(1, -1).join('/')}, ${inset}px inset`;
  return { pieces, method, warnings: [], failure: null };
}

/** Trim a single transparent image to its artwork. */
export function trimAlpha(raster: Raster): Piece {
  const mask = buildMask(raster, 'alpha');
  const { components } = labelComponents(mask, raster.width, raster.height);
  const box = unionBox(components.filter((c) => c.area >= CONFIG.speckArea));
  return { index: 0, box, raster: cropRaster(raster, box, (i) => mask[i] === 1, true) };
}
