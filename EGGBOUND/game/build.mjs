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

// Painted battle plates (BATCH17) are too big to embed under the 16MB single-file limit: they ship as separate files
// dist/bg/<loc>.webp (published next to the page) and the bundle only gets the list of which locations have one.
const bgDir = path.join(root, 'assets_bg'), bgOut = path.join(root, 'dist/bg'), bgIds = [];
fs.rmSync(bgOut, { recursive: true, force: true });
if (fs.existsSync(bgDir)) for (const f of fs.readdirSync(bgDir)) if (f.endsWith('.webp')) { fs.mkdirSync(bgOut, { recursive: true }); fs.copyFileSync(path.join(bgDir, f), path.join(bgOut, f)); bgIds.push(path.basename(f, '.webp')); }
// Separate-file sprites (Starborn sets, eggs): assets_ext/ → dist/ext/, loaded on demand (render/assets.ts ensureArt)
const extDir = path.join(root, 'assets_ext'), extOut = path.join(root, 'dist/ext'), extIds = [];
fs.rmSync(extOut, { recursive: true, force: true });
if (fs.existsSync(extDir)) for (const f of fs.readdirSync(extDir)) if (f.endsWith('.webp')) { fs.mkdirSync(extOut, { recursive: true }); fs.copyFileSync(path.join(extDir, f), path.join(extOut, f)); extIds.push(path.basename(f, '.webp')); }
const res = await build({ entryPoints: [path.join(root, 'src/main.ts')], bundle: true, platform: 'browser', format: 'iife', target: 'es2020', minify: true, write: false, logLevel: 'warning', define: { __BG__: JSON.stringify(bgIds), __EXT__: JSON.stringify(extIds) } });
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

// Assets: game/assets/*.webp|png (authoritative). Legacy fallback: the old Test Lab's embedded ASSET block if present.
const assets = {};
const protoPath = path.join(root, '../proto/index.html');
const m = fs.existsSync(protoPath) && fs.readFileSync(protoPath, 'utf8').match(/const ASSET=(\{.*?\});\n/s);
if (m) { const all = JSON.parse(m[1]); for (const k in all) if (/^(mon\w+|egg\w+)$/.test(k)) assets[k] = all[k]; }
const adir = path.join(root, 'assets');
if (fs.existsSync(adir)) for (const f of fs.readdirSync(adir)) {
  const ext = path.extname(f).slice(1).toLowerCase(); if (!['webp', 'png', 'jpg'].includes(ext)) continue;
  const mime = ext === 'jpg' ? 'jpeg' : ext;
  assets[path.basename(f, '.' + ext)] = `data:image/${mime};base64,` + fs.readFileSync(path.join(adir, f)).toString('base64');
}

const tpl = fs.readFileSync(path.join(root, 'src/index.template.html'), 'utf8');
const out = tpl.replace('/*ASSETS*/', () => JSON.stringify(assets)).replace('/*BUNDLE*/', () => js);
fs.writeFileSync(path.join(root, 'dist/index.html'), out);
console.log('dist/index.html', (out.length / 1024).toFixed(0) + 'KB', 'bg plates:', bgIds.join(',') || '-', 'ext art:', extIds.length, 'assets:', Object.keys(assets).join(','));
