// Build: bundle src/main.ts + inject assets into the template -> dist/index.html
// `node build.mjs --test` builds tests/sim.ts -> dist/sim.mjs instead.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });

if (process.argv.includes('--test')) {
  await build({ entryPoints: [path.join(root, 'tests/sim.ts')], bundle: true, platform: 'node', format: 'esm', outfile: path.join(root, 'dist/sim.mjs'), logLevel: 'warning' });
  process.exit(0);
}

const res = await build({ entryPoints: [path.join(root, 'src/main.ts')], bundle: true, platform: 'browser', format: 'iife', target: 'es2020', minify: true, write: false, logLevel: 'warning' });
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
console.log('dist/index.html', (out.length / 1024).toFixed(0) + 'KB', 'assets:', Object.keys(assets).join(','));
