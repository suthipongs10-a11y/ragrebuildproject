// Bundles src/ into one self-contained page: dist/muay-fight-lab.html
// three.js itself is loaded from the CDN by the page and used as a global.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
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
// Per model: glTF structure, gzip-compressed geometry (tangents dropped, weights, normals and texture coordinates
// quantised) and a 1280px texture: about 1.1 MB each, so twelve bodies fit under the page limit.
const models = [];
for (const name of readdirSync('assets').filter(f => /^fighter-[a-z]\.glb$/.test(f)).map(f => f.slice(0, -4)).sort()) {
  if (!existsSync(`assets/${name}-1k.jpg`)) continue;
  const glb = readFileSync(`assets/${name}.glb`), jsonLen = glb.readUInt32LE(12);
  const g = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8')), bin = glb.subarray(20 + jsonLen + 8);
  // the page supplies the texture itself, so the glTF carries geometry and skeleton only
  delete g.images; delete g.textures; delete g.samplers; delete g.animations;
  (g.materials || []).forEach(m => { if (m.pbrMetallicRoughness) delete m.pbrMetallicRoughness.baseColorTexture; delete m.normalTexture; delete m.occlusionTexture; delete m.emissiveTexture; });
  // Smaller numbers for what does not need 32-bit floats: skin weights and texture coordinates as normalised integers,
  // normals as signed bytes (KHR_mesh_quantization). Positions stay as floats. Cuts the geometry by about 40%.
  const floats = acc => { const a = g.accessors[acc], v = g.bufferViews[a.bufferView], n = {VEC2: 2, VEC3: 3, VEC4: 4}[a.type], stride = v.byteStride || n * 4, base = (v.byteOffset || 0) + (a.byteOffset || 0), out = new Float32Array(a.count * n);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) out[i * n + k] = bin.readFloatLE(base + i * stride + k * 4); return {a, n, out}; };
  const requant = (acc, type, Ctor, scale, pad) => { const {a, n, out} = floats(acc), w = n + (pad || 0), q = new Ctor(a.count * w);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) q[i * w + k] = Math.round(Math.max(-1, Math.min(1, out[i * n + k])) * scale);
    g.bufferViews.push({buffer: 0, byteOffset: 0, byteLength: q.byteLength, _data: Buffer.from(q.buffer), ...(pad ? {byteStride: w * q.BYTES_PER_ELEMENT} : {})});
    a.bufferView = g.bufferViews.length - 1; a.byteOffset = 0; a.componentType = type; a.normalized = true; delete a.min; delete a.max; };
  g.meshes.forEach(m => m.primitives.forEach(p => {
    delete p.attributes.TANGENT;
    if (g.accessors[p.attributes.WEIGHTS_0].componentType === 5126) {
      const {a, out} = floats(p.attributes.WEIGHTS_0), q = new Uint8Array(a.count * 4);
      for (let i = 0; i < a.count; i++) { // bytes that still add up to 255, so the weights still add up to one
        let sum = 0, big = 0; for (let k = 0; k < 4; k++) sum += out[i * 4 + k];
        let used = 0; for (let k = 0; k < 4; k++) { const b = Math.round(out[i * 4 + k] / (sum || 1) * 255); q[i * 4 + k] = b; used += b; if (q[i * 4 + k] > q[i * 4 + big]) big = k; }
        q[i * 4 + big] += 255 - used;
      }
      g.bufferViews.push({buffer: 0, byteOffset: 0, byteLength: q.byteLength, _data: Buffer.from(q.buffer)});
      a.bufferView = g.bufferViews.length - 1; a.byteOffset = 0; a.componentType = 5121; a.normalized = true; delete a.min; delete a.max;
    }
    if (g.accessors[p.attributes.NORMAL].componentType === 5126) requant(p.attributes.NORMAL, 5120, Int8Array, 127, 1);
    const uv = floats(p.attributes.TEXCOORD_0).out; let inside = true; for (const x of uv) if (x < 0 || x > 1) { inside = false; break; }
    if (inside && g.accessors[p.attributes.TEXCOORD_0].componentType === 5126) requant(p.attributes.TEXCOORD_0, 5123, Uint16Array, 65535);
  }));
  g.extensionsUsed = [...new Set([...(g.extensionsUsed || []), 'KHR_mesh_quantization'])]; g.extensionsRequired = [...new Set([...(g.extensionsRequired || []), 'KHR_mesh_quantization'])];
  const usedAcc = new Set();
  g.meshes.forEach(m => m.primitives.forEach(p => { Object.values(p.attributes).forEach(a => usedAcc.add(a)); if (p.indices != null) usedAcc.add(p.indices); }));
  (g.skins || []).forEach(sk => { if (sk.inverseBindMatrices != null) usedAcc.add(sk.inverseBindMatrices); });
  const usedViews = new Set([...usedAcc].map(a => g.accessors[a].bufferView));
  const parts = []; let off = 0;
  g.bufferViews.forEach((v, i) => {
    if (!usedViews.has(i)) { v.byteOffset = 0; v.byteLength = 0; return; }
    const chunk = v._data || bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength), pad = (4 - (off % 4)) % 4; delete v._data;
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
