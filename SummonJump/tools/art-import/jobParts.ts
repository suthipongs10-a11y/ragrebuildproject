/**
 * Cut the P03 job parts sheets into rig pieces (one-off, re-runnable): `npm run art:jobs`.
 * Source: art-store/P03_Jobs (full-res WebP of the owner's zips). Data: job-parts.json (piece rects + joint pivots).
 * Writes public/assets/P03_Jobs/job_<job>_<part>.webp (+ expression heads, designs) and registers them with
 * meta { sheetX, sheetY, sheetW, sheetH, pivotX, pivotY } — the same sheet-space contract HeroRig uses for the hero.
 */
import sharp from 'sharp';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadManifest, saveManifest } from './manifest';

interface Piece { rect: [number, number, number, number]; pivot: [number, number] }
interface Expr { rect: [number, number, number, number]; crop: [number, number, number, number]; pivot: [number, number] }
const data = JSON.parse(readFileSync(join(import.meta.dirname, 'job-parts.json'), 'utf8')) as { jobs: Record<string, Record<string, Piece>>; expr: Record<string, Expr> };
const SRC = join(ROOT, 'art-store', 'P03_Jobs'), PACK = 'P03_Jobs', OUT = join(ROOT, 'public', 'assets', PACK);
/** pieces are shown ~1/16 of sheet size; 1/3 keeps them sharp on 3x phone screens */
const SCALE = 1 / 3;
const m = loadManifest();

/**
 * Cut one piece out of the sheet: the rect, minus anything that belongs to a neighbouring piece.
 * Keeps the biggest opaque blob plus blobs that don't touch the rect edge (dangling bits of this piece).
 */
async function piece(file: string, x: number, y: number, w: number, h: number): Promise<sharp.Sharp> {
  const { data } = await sharp(file).extract({ left: x, top: y, width: w, height: h }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const label = new Int32Array(w * h).fill(-1);
  const blobs: { n: number; edge: boolean }[] = [];
  for (let i = 0; i < w * h; i++) {
    if (label[i] !== -1 || (data[i * 4 + 3] ?? 0) < 16) continue;
    const id = blobs.length, st = [i];
    let n = 0, edge = false;
    label[i] = id;
    while (st.length) {
      const q = st.pop() as number, qx = q % w, qy = (q - qx) / w;
      n++; if (qx === 0 || qy === 0 || qx === w - 1 || qy === h - 1) edge = true;
      for (const nb of [qx > 0 ? q - 1 : -1, qx < w - 1 ? q + 1 : -1, qy > 0 ? q - w : -1, qy < h - 1 ? q + w : -1]) {
        if (nb >= 0 && label[nb] === -1 && (data[nb * 4 + 3] ?? 0) >= 16) { label[nb] = id; st.push(nb); }
      }
    }
    blobs.push({ n, edge });
  }
  const main = blobs.reduce((b, c, i) => (c.n > (blobs[b]?.n ?? 0) ? i : b), 0);
  const keep = blobs.map((b, i) => i === main || (!b.edge && b.n > 30));
  for (let i = 0; i < w * h; i++) {
    const l = label[i] ?? -1;
    if (l >= 0 && !keep[l]) data[i * 4 + 3] = 0; // a neighbour's pixels
  }
  return sharp(data, { raw: { width: w, height: h, channels: 4 } });
}

async function write(key: string, img: sharp.Sharp, meta: Record<string, unknown>): Promise<void> {
  const info = await img.webp({ quality: 85, alphaQuality: 90 }).toFile(join(OUT, `${key}.webp`));
  m[key] = { pack: PACK, url: `assets/${PACK}/${key}.webp`, w: info.width, h: info.height, meta };
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  for (const [job, parts] of Object.entries(data.jobs)) {
    const sheet = join(SRC, `job_${job}_parts.webp`);
    for (const [part, p] of Object.entries(parts)) {
      const [x, y, w, h] = p.rect;
      const img = (await piece(sheet, x, y, w, h)).resize(Math.round(w * SCALE), Math.round(h * SCALE));
      await write(`job_${job}_${part}`, img, { sheetX: x, sheetY: y, sheetW: w, sheetH: h, pivotX: p.pivot[0], pivotY: p.pivot[1] });
    }
    // full-body design picture for the job-change screen
    await write(`job_${job}_design`, sharp(join(SRC, `job_${job}_design.webp`)).trim().resize({ width: 384, height: 384, fit: 'inside' }), {});
  }
  for (const [k, e] of Object.entries(data.expr)) {
    const [job, ex] = k.split('_') as [string, string];
    const [cx0, cy0, cx1, cy1] = e.crop, [x, y, w, h] = e.rect;
    const key = job === 'hero' ? `hero_part_head_${ex}` : `job_${job}_head_${ex}`;
    const img = sharp(join(SRC, `${job === 'hero' ? 'hero' : `job_${job}`}_head_${ex}.webp`)).extract({ left: cx0, top: cy0, width: cx1 - cx0, height: cy1 - cy0 })
      .resize(Math.round(w * SCALE), Math.round(h * SCALE));
    await write(key, img, { sheetX: x, sheetY: y, sheetW: w, sheetH: h, pivotX: e.pivot[0], pivotY: e.pivot[1] });
  }
  saveManifest(m);
  console.log(`job parts written to ${OUT}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
