// Bundles src/ into one self-contained page: dist/muay-fight-lab.html
// three.js itself is loaded from the CDN by the page and used as a global.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const bundle = async entry => (await build({entryPoints: [entry], bundle: true, format: 'iife', minify: process.argv.includes('--min'), write: false, target: 'es2019', legalComments: 'none',
  // loaders from the three package import 'three'; point that at the page's global THREE instead of a second copy
  plugins: [{name: 'three-global', setup(b) { b.onResolve({filter: /^three$/}, () => ({path: resolve('src/three-shim.cjs')})); }}]})).outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const js = await bundle('src/main.js'), jsGame = await bundle('src/entry-game.js');
const html = readFileSync('src/page.html', 'utf8').replace('/*__APP__*/', () => js);
mkdirSync('dist', {recursive: true});
writeFileSync('dist/muay-fight-lab.html', html);
// Models are embedded in the page itself: the mobile app refuses requests for files published beside an artifact (403).
// Per model: glTF structure, gzip-compressed geometry (tangents dropped) and a 1536px texture, under 2 MB each.
const models = [];
for (const name of ['fighter-a', 'fighter-b', 'fighter-c', 'fighter-d', 'fighter-e', 'fighter-f']) {
  if (!existsSync(`assets/${name}.glb`) || !existsSync(`assets/${name}-1k.jpg`)) continue;
  const glb = readFileSync(`assets/${name}.glb`), jsonLen = glb.readUInt32LE(12);
  const g = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8')), bin = glb.subarray(20 + jsonLen + 8);
  // the page supplies the texture itself, so the glTF carries geometry and skeleton only
  delete g.images; delete g.textures; delete g.samplers; delete g.animations;
  (g.materials || []).forEach(m => { if (m.pbrMetallicRoughness) delete m.pbrMetallicRoughness.baseColorTexture; delete m.normalTexture; delete m.occlusionTexture; delete m.emissiveTexture; });
  const usedAcc = new Set();
  g.meshes.forEach(m => m.primitives.forEach(p => { delete p.attributes.TANGENT; Object.values(p.attributes).forEach(a => usedAcc.add(a)); if (p.indices != null) usedAcc.add(p.indices); }));
  (g.skins || []).forEach(sk => { if (sk.inverseBindMatrices != null) usedAcc.add(sk.inverseBindMatrices); });
  const usedViews = new Set([...usedAcc].map(a => g.accessors[a].bufferView));
  const parts = []; let off = 0;
  g.bufferViews.forEach((v, i) => {
    if (!usedViews.has(i)) { v.byteOffset = 0; v.byteLength = 0; return; }
    const chunk = bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength), pad = (4 - (off % 4)) % 4;
    if (pad) { parts.push(Buffer.alloc(pad)); off += pad; }
    v.byteOffset = off; parts.push(chunk); off += chunk.length;
  });
  const packed = Buffer.concat(parts);
  g.buffers = [{byteLength: packed.length}];
  const data = {gltf: g, gz: gzipSync(packed, {level: 9}).toString('base64'), texture: 'data:image/jpeg;base64,' + readFileSync(`assets/${name}-1k.jpg`).toString('base64')};
  const text = JSON.stringify(data).replace(/<\//g, '<\\/');
  models.push(`<script type="application/json" id="model-${name.slice(-1)}">${text}</script>`);
  console.log(name, (text.length / 1024 / 1024).toFixed(2) + ' MB');
}
const withModels = readFileSync('dist/muay-fight-lab.html', 'utf8').replace('<!--__MODELS__-->', () => models.join('\n'));
// two pages from one source: the presentation lab, and the game (same viewer plus the game screens)
const page = withModels.replace('<!--G:top-->', '').replace('<!--G:body-->', '');
writeFileSync('dist/muay-fight-lab.html', page);
const game = readFileSync('src/page.html', 'utf8').replace('/*__APP__*/', () => jsGame).replace('<!--__MODELS__-->', () => models.join('\n')).replace('<title>Muay Fight Lab 3D</title>', '<title>Muay Manager</title>')
  .replace('<!--G:top-->', '<div id="game"><div class="gbar" id="gTop"></div></div>')
  .replace('<!--G:body-->', '<nav class="gnav" id="gNav" aria-label="เมนูเกม"></nav><div class="gbody" id="gBody"></div>');
writeFileSync('dist/muay-manager.html', game);
console.log('dist/muay-fight-lab.html with models', (page.length / 1024 / 1024).toFixed(2) + ' MB (limit 16)');
