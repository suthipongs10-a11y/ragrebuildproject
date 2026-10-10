/**
 * Import ChatGPT art zips.
 *   npm run art:import -- art-inbox/SJ_P00_UI_Kit_Part1.zip [more.zip] [--brief art-briefs/ART_P00_UI_Kit.md]
 * Steps: unzip -> check names vs brief -> clean alpha halos -> (group-)trim -> resize -> WebP -> manifest + REPORT.md
 */
import AdmZip from 'adm-zip';
import sharp from 'sharp';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { ROOT, loadManifest, saveManifest, type ArtManifest } from './manifest';

const args = process.argv.slice(2);
const briefIdx = args.indexOf('--brief');
const briefPath = briefIdx >= 0 ? args[briefIdx + 1] : undefined;
const zips = args.filter((a, i) => a.endsWith('.zip') && (briefIdx < 0 || i !== briefIdx + 1));
if (!zips.length) { console.error('usage: npm run art:import -- <zip...> [--brief art-briefs/ART_PXX.md]'); process.exit(1); }

const report: string[] = [];
const manifest: ArtManifest = loadManifest();

/** Longest side / height targets per category (px). */
function target(name: string): { maxW: number; maxH: number } {
  if (name.startsWith('zone_')) return { maxW: 1920, maxH: 1080 };
  if (/^(mon|boss|spr|spirit)_/.test(name)) return { maxW: 640, maxH: 512 };
  if (/^(wpn|arm_\d+_(torso|uarm))/.test(name)) return { maxW: 512, maxH: 512 };
  if (name.startsWith('vfx_')) return { maxW: 512, maxH: 512 };
  if (/^ui_(panel|header|bar|btn_(primary|secondary|danger)|numbers)/.test(name)) return { maxW: 1024, maxH: 512 };
  if (name.startsWith('card_')) return { maxW: 384, maxH: 512 };
  return { maxW: 256, maxH: 256 };
}
const noTrim = (n: string) => /^ui_(panel|header|bar|btn_(primary|secondary|danger)|numbers|rarity)/.test(n) || n.startsWith('zone_') && n.endsWith('_far');
const groupKey = (n: string) => /^mon_([a-z0-9]+)_/.exec(n)?.[1];

async function cleanAlpha(buf: Buffer): Promise<{ data: Buffer; w: number; h: number; opaqueCorners: boolean }> {
  const img = sharp(buf).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  for (let i = 3; i < data.length; i += 4) {
    const a = data[i] ?? 0;
    data[i] = a < 24 ? 0 : Math.min(255, Math.round(((a - 24) * 255) / 231));
  }
  const corner = (x: number, y: number) => data[(y * w + x) * 4 + 3] ?? 0;
  const opaqueCorners = [corner(0, 0), corner(w - 1, 0), corner(0, h - 1), corner(w - 1, h - 1)].filter((a) => a > 200).length >= 3;
  return { data, w, h, opaqueCorners };
}
function bbox(data: Buffer, w: number, h: number) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((data[(y * w + x) * 4 + 3] ?? 0) > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? { x0: 0, y0: 0, x1: w - 1, y1: h - 1 } : { x0, y0, x1, y1 };
}

function expectedFromBrief(path: string): string[] {
  const md = readFileSync(join(ROOT, path), 'utf8');
  // only the File column of table rows: `| 12 | `name.png` | ...` (ignores reference names inside descriptions)
  return [...md.matchAll(/^\|\s*\d+\s*\|\s*`([a-z0-9_]+\.png)`/gm)].map((m) => m[1] as string);
}

async function main() {
  const seen = new Set<string>();
  for (const zipPath of zips) {
    const zip = new AdmZip(zipPath);
    const pack = basename(zipPath, '.zip').replace(/^SJ_/, '').replace(/_Part\d+$/, '');
    const outDir = join(ROOT, 'public', 'assets', pack);
    mkdirSync(outDir, { recursive: true });
    const entries = zip.getEntries().filter((e) => !e.isDirectory && e.entryName.toLowerCase().endsWith('.png'));
    report.push(`## ${basename(zipPath)} → pack \`${pack}\` (${entries.length} png)`);

    // decode all first so pose groups can share one crop box
    const decoded = new Map<string, Awaited<ReturnType<typeof cleanAlpha>>>();
    for (const e of entries) {
      const name = basename(e.entryName, '.png').toLowerCase();
      seen.add(`${name}.png`);
      if (name.startsWith('vfx_')) continue;
      decoded.set(name, await cleanAlpha(e.getData()));
    }
    const groupBox = new Map<string, { x0: number; y0: number; x1: number; y1: number }>();
    for (const [name, d] of decoded) {
      const g = groupKey(name); if (!g) continue;
      const b = bbox(d.data, d.w, d.h), cur = groupBox.get(g);
      groupBox.set(g, cur ? { x0: Math.min(cur.x0, b.x0), y0: Math.min(cur.y0, b.y0), x1: Math.max(cur.x1, b.x1), y1: Math.max(cur.y1, b.y1) } : b);
    }

    for (const e of entries) {
      const name = basename(e.entryName, '.png').toLowerCase();
      const t = target(name);
      const file = `${name}.webp`;
      let out: sharp.Sharp;
      if (name.startsWith('vfx_')) {
        const s = sharp(e.getData()).flatten({ background: '#000000' });
        const { data, info } = await s.clone().raw().toBuffer({ resolveWithObject: true });
        const px = (x: number, y: number) => { const i = (y * info.width + x) * info.channels; return (data[i] ?? 0) + (data[i + 1] ?? 0) + (data[i + 2] ?? 0); };
        if ([px(0, 0), px(info.width - 1, 0), px(0, info.height - 1), px(info.width - 1, info.height - 1)].some((v) => v > 60)) report.push(`- ⚠️ \`${name}\`: corners are not black (VFX must be on #000000)`);
        out = s.resize({ width: t.maxW, height: t.maxH, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 });
      } else {
        const d = decoded.get(name)!;
        if (d.opaqueCorners && !name.endsWith('_far')) report.push(`- ⚠️ \`${name}\`: corners are opaque — background probably not transparent`);
        const g = groupKey(name);
        const b = noTrim(name) ? { x0: 0, y0: 0, x1: d.w - 1, y1: d.h - 1 } : (g ? groupBox.get(g)! : bbox(d.data, d.w, d.h));
        const pad = noTrim(name) ? 0 : 6;
        const left = Math.max(0, b.x0 - pad), top = Math.max(0, b.y0 - pad);
        const width = Math.min(d.w - left, b.x1 - b.x0 + 1 + pad * 2), height = Math.min(d.h - top, b.y1 - b.y0 + 1 + pad * 2);
        out = sharp(d.data, { raw: { width: d.w, height: d.h, channels: 4 } })
          .extract({ left, top, width, height })
          .resize({ width: t.maxW, height: t.maxH, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 82, alphaQuality: 90 });
      }
      const info = await out.toFile(join(outDir, file));
      manifest[name] = { pack, url: `assets/${pack}/${file}`, w: info.width, h: info.height, meta: name.startsWith('vfx_') ? { blend: 'add' } : undefined };
    }
  }
  if (briefPath) {
    const expected = expectedFromBrief(briefPath);
    const missing = expected.filter((f) => !seen.has(f));
    const extra = [...seen].filter((f) => !expected.includes(f));
    report.push(`\n## Brief check (${briefPath})`, missing.length ? `- ❌ missing (${missing.length}): ${missing.join(', ')}` : '- ✅ all expected files present', extra.length ? `- extra files: ${extra.join(', ')}` : '');
  }
  saveManifest(manifest);
  mkdirSync(join(ROOT, 'art-inbox'), { recursive: true });
  writeFileSync(join(ROOT, 'art-inbox', 'REPORT.md'), `# Art import report\n\n${report.join('\n')}\n`);
  console.log(report.join('\n'));
  console.log(`\nart:import done — manifest has ${Object.keys(manifest).length} entries`);
}

if (!existsSync(join(ROOT, 'src', 'assets'))) mkdirSync(join(ROOT, 'src', 'assets'), { recursive: true });
main().catch((e) => { console.error(e); process.exit(1); });
