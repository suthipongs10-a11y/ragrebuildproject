// Asset pipeline entry point: raw/ + manifests -> assets/ (atlases, images, manifest.json) + report.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from './config';
import { writeAtlas } from './compose';
import { readPack } from './manifest';
import { packAtlas } from './pack';
import { processEntries } from './process';
import { buildReport } from './report';
import { writeSamples } from './samples';

const root = fileURLToPath(new URL('../..', import.meta.url));
const outDir = path.join(root, CONFIG.outDir);

interface FrameRecord {
  atlas: string;
  x: number;
  y: number;
  w: number;
  h: number;
  anchor: 'bottom' | 'center';
  blend: 'normal' | 'add';
  placeholder?: true;
}

async function main(): Promise<void> {
  const listings = CONFIG.packs.map((pack) => readPack(root, pack));
  const entries = listings.flatMap((listing) => listing.entries);
  const { frames, images, results } = await processEntries(entries);
  await writeSamples(root, entries);

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(path.join(outDir, 'atlases'), { recursive: true });
  mkdirSync(path.join(outDir, 'images'), { recursive: true });

  const frameRecords: Record<string, FrameRecord> = {};
  const atlasFiles: Record<string, string[]> = {};
  let atlasPages = 0;
  for (const [pack, packFrames] of frames) {
    const category = pack.replace(/^\d+_/, '');
    const seen = new Set<string>();
    for (const frame of packFrames) {
      if (seen.has(frame.id) || frame.id in frameRecords) throw new Error(`duplicate asset id "${frame.id}"`);
      seen.add(frame.id);
    }
    const packed = packAtlas(packFrames.map((frame) => ({ id: frame.id, raster: frame.raster })));
    const files = packed.pages.map((_, i) => `atlases/${category}-${i}.webp`);
    atlasFiles[category] = files;
    atlasPages += files.length;
    const lossless = CONFIG.losslessAtlases.includes(category);
    await Promise.all(packed.pages.map((page, i) => writeAtlas(page, path.join(outDir, files[i] as string), lossless)));
    // Keep manifest order = sheet order (idle, attack, hurt...), not packing order.
    for (const frame of packFrames) {
      const placement = packed.placements.find((p) => p.id === frame.id);
      if (!placement) continue;
      frameRecords[frame.id] = {
        atlas: files[placement.page] as string,
        x: placement.x,
        y: placement.y,
        w: placement.w,
        h: placement.h,
        anchor: frame.anchor,
        blend: frame.blend,
        ...(frame.placeholder ? { placeholder: true as const } : {}),
      };
    }
  }

  const imageRecords: Record<string, { file: string; w: number; h: number }> = {};
  for (const image of images) {
    const file = `images/${image.id}.webp`;
    writeFileSync(path.join(outDir, file), image.data);
    imageRecords[image.id] = { file, w: image.width, h: image.height };
  }

  const sortKeys = <T>(record: Record<string, T>): Record<string, T> => Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
  const manifest = { version: 1, resize: CONFIG.resizeKernel, atlases: atlasFiles, frames: frameRecords, images: sortKeys(imageRecords) };
  writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 1)}\n`);

  const totals = { frames: Object.keys(frameRecords).length, images: images.length, atlasPages };
  const report = buildReport(listings, results, path.join(root, 'tools/assets/review-notes.md'), totals);
  writeFileSync(path.join(root, CONFIG.reportPath), `${report}\n`);

  const failed = results.filter((r) => r.status === 'failed' || r.status === 'missing');
  const warned = results.filter((r) => r.warnings.length > 0);
  console.log(`assets: ${totals.frames} frames, ${totals.atlasPages} atlas pages, ${totals.images} images`);
  console.log(`        ${failed.length} sheets need a new image, ${warned.length} have warnings -> ${CONFIG.reportPath}`);
  for (const r of failed) console.log(`  FAILED ${r.entry.file}: ${r.failure}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
