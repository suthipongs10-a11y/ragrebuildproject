// Every Thai text in the game's code that the catalog cannot yet show in another language (default English): string
// literals are split at their HTML tags into the pieces a page would show, and each piece with Thai is looked up the
// way src/i18n.js does it. A piece that is part of a sentence built at run time can be listed although the sentence it
// ends up in has a line; tools/e2e/lang.mjs (the screens themselves) is the final word.
// usage: node tools/i18n-scan.mjs [en] [files…]      (default: src/game.js src/main.js)
import { readFileSync } from 'node:fs';
const ROOT = new URL('../', import.meta.url).pathname;
const args = process.argv.slice(2), lang = args[0] && !args[0].includes('.') ? args.shift() : 'en', files = args.length ? args : ['src/game.js', 'src/main.js'];
const { useCatalog, tr } = await import(ROOT + 'src/i18n.js'), { NAMES } = await import(ROOT + 'src/lang/' + lang + '-names.js');
useCatalog(lang, JSON.parse(readFileSync(ROOT + 'src/lang/' + lang + '.json', 'utf8')), NAMES);
const TH = /[ก-ฺเ-๛]/, lit = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g, out = new Map();
for (const f of files) {
  const src = readFileSync(ROOT + f, 'utf8').split('\n');
  src.forEach((line, i) => {
    if (/^\s*\/\//.test(line)) return;
    for (const m of line.matchAll(lit)) {
      const body = m[0].slice(1, -1); if (!TH.test(body)) continue;
      for (const piece of body.split(/<[^>]*>/)) { const t = piece.replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim(); if (TH.test(t) && tr(t) == null && !out.has(t)) out.set(t, f + ':' + (i + 1)); }
    }
  });
}
console.log(out.size + ' pieces without a line (' + lang + ')');
for (const [t, at] of out) console.log(at.padEnd(18), t);
