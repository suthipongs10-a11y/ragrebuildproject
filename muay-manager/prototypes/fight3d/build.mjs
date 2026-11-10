// Bundles src/ into one self-contained page: dist/muay-fight-lab.html
// three.js itself is loaded from the CDN by the page and used as a global.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const r = await build({entryPoints: ['src/main.js'], bundle: true, format: 'iife', minify: process.argv.includes('--min'), write: false, target: 'es2019', legalComments: 'none'});
const js = r.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const html = readFileSync('src/page.html', 'utf8').replace('/*__APP__*/', () => js);
mkdirSync('dist', {recursive: true});
writeFileSync('dist/muay-fight-lab.html', html);
console.log('dist/muay-fight-lab.html', (html.length / 1024).toFixed(0) + ' KB');
