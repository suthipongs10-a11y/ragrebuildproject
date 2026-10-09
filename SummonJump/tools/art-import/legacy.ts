/** One-off: register the prototype's processed art (reference/legacy_art) as pack P00_legacy. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { ROOT, loadManifest, saveManifest } from './manifest';

interface LegacyZone { far: string; mid: string; near: string; ground: string; plat: string; groundTop: number; groundAR: number; platTop: number; platAR: number }
const src = JSON.parse(readFileSync(join(ROOT, 'reference', 'legacy_art', 'manifest.json'), 'utf8')) as Record<string, unknown>;
const m = loadManifest();
const pack = 'P00_legacy';

async function add(key: string, file: string, meta?: Record<string, unknown>) {
  const info = await sharp(join(ROOT, 'public', 'assets', pack, file)).metadata();
  m[key] = { pack, url: `assets/${pack}/${file}`, w: info.width ?? 0, h: info.height ?? 0, meta };
}

async function main() {
  for (const zone of ['forest', 'deep', 'town', 'sky', 'abyss', 'desert']) {
    const z = src[zone] as LegacyZone;
    await add(`zone_${zone}_far`, z.far);
    await add(`zone_${zone}_mid`, z.mid);
    await add(`zone_${zone}_near`, z.near);
    await add(`zone_${zone}_ground`, z.ground, { top: z.groundTop });
    await add(`zone_${zone}_plat`, z.plat, { top: z.platTop });
  }
  for (const [k, v] of Object.entries(src.sprites as Record<string, { src: string }>)) await add(k === 'hero' ? 'hero_design' : `legacy_${k}`, v.src);
  for (const [k, v] of Object.entries(src.icons as Record<string, { src: string }>)) await add(`icon_${k}`, v.src);
  for (const [k, v] of Object.entries(src.parts as Record<string, { src: string; x: number; y: number; w: number; h: number }>)) await add(`hero_part_${k}`, v.src, { sheetX: v.x, sheetY: v.y, sheetW: v.w, sheetH: v.h });
  saveManifest(m);
  console.log(`legacy art registered: ${Object.keys(m).length} entries`);
}
main().catch((e) => { console.error(e); process.exit(1); });
