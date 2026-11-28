// Turns the Vite build into a page that can be hosted as a plain static file set
// (no <html>/<head> wrapper, no CSP meta): used for the browser-playable preview link.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const dist = new URL('../dist/', import.meta.url);
const html = readFileSync(new URL('index.html', dist), 'utf8');
const script = /<script type="module"[^>]*src="([^"]+)"/.exec(html)?.[1];
if (!script) throw new Error('entry script not found in dist/index.html');

const page = `<meta charset="utf-8">
<title>DICEBOUND</title>
<style>
  :root { color-scheme: dark; }
  html, body { margin: 0; height: 100%; background: #000; color: #f4e3c1; overflow: hidden; }
  #game { position: absolute; inset: 0; display: grid; place-items: center; }
  canvas { display: block; }
</style>
<div id="game"></div>
<script type="module" src="${script}"></script>
`;
writeFileSync(new URL('play.html', dist), page);

// File list for publishing: code chunks, the manifest, atlases and only the images the build uses.
const files = { 'manifest.json': 'dist/manifest.json' };
for (const name of readdirSync(new URL('assets/', dist))) files[`assets/${name}`] = `dist/assets/${name}`;
for (const name of readdirSync(new URL('atlases/', dist))) files[`atlases/${name}`] = `dist/atlases/${name}`;
for (const id of ['bg_act1_desert', 'board_act1_desert']) files[`images/${id}.webp`] = `dist/images/${id}.webp`;
writeFileSync(new URL('play-files.json', dist), JSON.stringify(files));
console.log(`play.html + ${Object.keys(files).length} files`);
