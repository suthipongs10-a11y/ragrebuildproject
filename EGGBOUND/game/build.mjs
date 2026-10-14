// Build: bundle src/main.ts + inject assets into the template -> dist/index.html
// `node build.mjs --test` builds tests/sim.ts -> dist/sim.mjs instead.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });

if (process.argv.includes('--rates')) {
  await build({ entryPoints: [path.join(root, 'tests/eggRates.ts')], bundle: true, platform: 'node', format: 'esm', outfile: path.join(root, 'dist/rates.mjs'), logLevel: 'warning' });
  process.exit(0);
}
if (process.argv.includes('--test')) {
  await build({ entryPoints: [path.join(root, 'tests/sim.ts')], bundle: true, platform: 'node', format: 'esm', outfile: path.join(root, 'dist/sim.mjs'), logLevel: 'warning' });
  process.exit(0);
}

// Everything is embedded (2026-10-14): on the owner's phone the Artifact answers files published next to the page with
// HTTP 403, so separate files (painted plates, realm charts, the Starborn / BATCH21 sprites) never showed. To fit the 16MB
// page, images are embedded as AVIF (tools/avif_cache.py → .avif-cache/, ~55% of the WebP size); sources stay WebP.
//   assets/<k>.webp → IMG[k] · assets_ext/<k>.webp → IMG[k] (same keys as before) · assets_bg/<id>.webp → IMG['bg_' + id]
const { spawnSync } = await import('node:child_process');
const av = spawnSync('python3', ['-I', path.join(root, 'tools/avif_cache.py')], { stdio: 'inherit' });
if (av.status !== 0) { console.error('tools/avif_cache.py failed (needs python3 + Pillow with AVIF)'); process.exit(1); }
const cache = path.join(root, '.avif-cache');
const bgDir = path.join(root, 'assets_bg'), extDir = path.join(root, 'assets_ext'), bgIds = [], extIds = [];
fs.rmSync(path.join(root, 'dist/bg'), { recursive: true, force: true }); fs.rmSync(path.join(root, 'dist/ext'), { recursive: true, force: true });
const assets = {};
let bytes = 0;
/** embed one image: its AVIF copy when there is one (every WebP source), else the file itself (png/jpg) */
function embed(dir, f, key) {
  const ext = path.extname(f).slice(1).toLowerCase(); if (!['webp', 'png', 'jpg'].includes(ext)) return;
  if (f.startsWith('thumb_')) return; // menu thumbnails of separate files: not needed now that everything is embedded
  const avif = path.join(cache, path.basename(dir), path.basename(f, '.' + ext) + '.avif');
  const [file, mime] = ext === 'webp' && fs.existsSync(avif) ? [avif, 'avif'] : [path.join(dir, f), ext === 'jpg' ? 'jpeg' : ext];
  const buf = fs.readFileSync(file); bytes += buf.length;
  assets[key] = `data:image/${mime};base64,` + buf.toString('base64');
}
const adir = path.join(root, 'assets');
if (fs.existsSync(adir)) for (const f of fs.readdirSync(adir)) embed(adir, f, path.basename(f, path.extname(f)));
if (fs.existsSync(extDir)) for (const f of fs.readdirSync(extDir)) if (f.endsWith('.webp')) { embed(extDir, f, path.basename(f, '.webp')); extIds.push(path.basename(f, '.webp')); }
if (fs.existsSync(bgDir)) for (const f of fs.readdirSync(bgDir)) if (f.endsWith('.webp')) { const id = path.basename(f, '.webp'); embed(bgDir, f, 'bg_' + id); bgIds.push(id); }
const res = await build({ entryPoints: [path.join(root, 'src/main.ts')], bundle: true, platform: 'browser', format: 'iife', target: 'es2020', minify: true, write: false, logLevel: 'warning',
  define: { __BG__: JSON.stringify(bgIds), __BGU__: '{}', __EXT__: '{}', __EXTMETA__: '{}' } });
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const tpl = fs.readFileSync(path.join(root, 'src/index.template.html'), 'utf8');
const out = tpl.replace('/*ASSETS*/', () => JSON.stringify(assets)).replace('/*BUNDLE*/', () => js);
fs.writeFileSync(path.join(root, 'dist/index.html'), out);
console.log('dist/index.html', (out.length / 1024).toFixed(0) + 'KB', '· images', Object.keys(assets).length, '(' + (bytes / 1024).toFixed(0) + 'KB AVIF/PNG) · plates/charts', bgIds.length, '· former separate-file sprites', extIds.length);
