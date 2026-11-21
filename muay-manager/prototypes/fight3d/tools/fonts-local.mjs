// The game's two typefaces (Chakra Petch for headings and numbers, Bai Jamjuree for text; both SIL Open Font License)
// as files of the game's own, so the website asks nothing of Google and the computer app looks right with no network.
// Fetches what Google Fonts serves a current Chrome (woff2, split by script: Thai, Latin, Latin extended, Vietnamese)
// into assets/fonts/, with fonts.json (the @font-face list build.mjs writes into the page) and each family's licence.
// Run again only to change the faces or weights (then also the font-family / font-weight in src/page.html).
// usage: node tools/fonts-local.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';

process.chdir(new URL('../', import.meta.url).pathname);
const CSS = 'https://fonts.googleapis.com/css2?family=Chakra+Petch:ital,wght@0,500;0,600;0,700;1,700&family=Bai+Jamjuree:wght@400;500;600;700&display=swap';
const LICENCES = {'Chakra Petch': 'chakrapetch', 'Bai Jamjuree': 'baijamjuree'}; // folders in github.com/google/fonts/ofl
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const get = (url, to) => execFileSync('curl', ['-fsSL', '--retry', '3', '-A', UA, url, ...(to ? ['-o', to] : [])], {encoding: to ? undefined : 'utf8', maxBuffer: 1 << 24});

const css = get(CSS), DIR = 'assets/fonts/';
mkdirSync(DIR, {recursive: true});
for (const f of readdirSync(DIR)) rmSync(DIR + f);
const faces = [];
for (const m of css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]+)\}/g)) {
  const [, subset, body] = m, v = k => (body.match(new RegExp(k + ':\\s*([^;]+);')) || [])[1];
  const family = v('font-family').replace(/['"]/g, ''), style = v('font-style'), weight = v('font-weight'), url = body.match(/url\(([^)]+)\)/)[1];
  const file = family.toLowerCase().replace(/ /g, '-') + '-' + weight + (style === 'italic' ? 'i' : '') + '-' + subset + '.woff2';
  get(url, DIR + file);
  faces.push({family, style, weight: +weight, subset, file, range: v('unicode-range')});
}
if (!faces.length) throw new Error('no @font-face in what Google Fonts sent');
writeFileSync(DIR + 'fonts.json', JSON.stringify(faces, null, 1) + '\n');
for (const [family, dir] of Object.entries(LICENCES)) get(`https://raw.githubusercontent.com/google/fonts/main/ofl/${dir}/OFL.txt`, DIR + 'OFL-' + family.replace(/ /g, '') + '.txt');
console.log(faces.length + ' font files in ' + DIR + ' (' + [...new Set(faces.map(f => f.family + ' ' + f.weight + (f.style === 'italic' ? 'i' : '')))].join(', ') + ')');
