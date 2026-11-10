// Bundles src/ into one self-contained page: dist/muay-fight-lab.html
// three.js itself is loaded from the CDN by the page and used as a global.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const r = await build({entryPoints: ['src/main.js'], bundle: true, format: 'iife', minify: process.argv.includes('--min'), write: false, target: 'es2019', legalComments: 'none',
  // loaders from the three package import 'three'; point that at the page's global THREE instead of a second copy
  plugins: [{name: 'three-global', setup(b) { b.onResolve({filter: /^three$/}, () => ({path: resolve('src/three-shim.cjs')})); }}]});
const js = r.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const html = readFileSync('src/page.html', 'utf8').replace('/*__APP__*/', () => js);
mkdirSync('dist', {recursive: true});
writeFileSync('dist/muay-fight-lab.html', html);
// Models are published beside the page as a glTF JSON file plus its texture image (the host serves .json and .jpg, not .glb).
for (const name of ['fighter-a', 'fighter-b']) {
  if (!existsSync(`assets/${name}.glb`)) continue;
  const glb = readFileSync(`assets/${name}.glb`), jsonLen = glb.readUInt32LE(12);
  const g = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8')), bin = glb.subarray(20 + jsonLen + 8);
  const imgViews = new Set();
  (g.images || []).forEach((im, i) => {
    const v = g.bufferViews[im.bufferView], ext = im.mimeType === 'image/png' ? 'png' : 'jpg', file = `${name}${i ? '-' + i : ''}.${ext}`;
    writeFileSync('dist/' + file, bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength));
    imgViews.add(im.bufferView); delete im.bufferView; delete im.mimeType; im.uri = file;
  });
  delete g.animations; // the fight drives the bones itself
  const parts = []; let off = 0;
  g.bufferViews.forEach((v, i) => {
    if (imgViews.has(i)) { v.byteOffset = 0; v.byteLength = 0; return; }
    const chunk = bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength), pad = (4 - (off % 4)) % 4;
    if (pad) { parts.push(Buffer.alloc(pad)); off += pad; }
    v.byteOffset = off; parts.push(chunk); off += chunk.length;
  });
  const packed = Buffer.concat(parts);
  g.buffers = [{byteLength: packed.length, uri: 'data:application/octet-stream;base64,' + packed.toString('base64')}];
  writeFileSync(`dist/${name}.json`, JSON.stringify(g));
  console.log(`dist/${name}.json`, (packed.length * 4 / 3 / 1024 / 1024).toFixed(1) + ' MB');
}
console.log('dist/muay-fight-lab.html', (html.length / 1024).toFixed(0) + ' KB');
