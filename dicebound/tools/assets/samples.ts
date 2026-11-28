import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { CONFIG, type ResizeKernel } from './config';
import { placeOnCanvas, sharedScale, writePng } from './compose';
import type { ManifestEntry } from './manifest';
import { loadRaster } from './pixels';
import { sliceAlphaRow, sliceBlackRow, sliceGrid } from './slice';

const KERNELS: ResizeKernel[] = ['nearest', 'lanczos'];

/** Same sheet, same cut, both resize kernels — so the owner can pick one (CLAUDE.md §4.5). */
export async function writeSamples(root: string, entries: ManifestEntry[]): Promise<void> {
  const dir = path.join(root, CONFIG.samplesDir);
  mkdirSync(dir, { recursive: true });
  const index: Array<{ source: string; piece: number; nearest: string; lanczos: string; size: number }> = [];
  for (const [pack, file] of CONFIG.sampleFiles) {
    const entry = entries.find((e) => e.pack === pack && e.file === file);
    if (!entry?.exists || !entry.finalSize) continue;
    const raster = await loadRaster(entry.rawPath);
    const s = entry.slice;
    const cut =
      s.kind === 'grid'
        ? sliceGrid(raster, s.cols, s.rows, 'alpha')
        : s.kind === 'row'
          ? entry.background === 'black'
            ? sliceBlackRow(raster, s.count)
            : sliceAlphaRow(raster, s.count)
          : null;
    if (!cut || cut.failure) continue;
    // A middle piece shows more detail than the first one (effects start tiny).
    const piece = cut.pieces[Math.floor(cut.pieces.length / 2)];
    if (!piece) continue;
    const size = entry.finalSize.width;
    const scale = sharedScale(cut.pieces.map((p) => p.raster), size, entry.finalSize.height ?? size);
    const black = entry.background === 'black';
    const names = { nearest: '', lanczos: '' };
    for (const kernel of KERNELS) {
      const out = await placeOnCanvas(piece.raster, scale, size, entry.finalSize.height ?? size, black ? 'center' : 'bottom', kernel, black);
      names[kernel] = `${entry.baseId}_${kernel}.png`;
      await writePng(out, path.join(dir, names[kernel]));
    }
    index.push({ source: `${pack}/${file}`, piece: piece.index, size, ...names });
  }
  writeFileSync(path.join(dir, 'samples.json'), `${JSON.stringify(index, null, 1)}\n`);
}
