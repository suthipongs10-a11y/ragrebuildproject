/** Copy project instructions into dist/ so they are readable on the Pages site next to the game. */
import { cpSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');
const files = ['START.md', 'CLAUDE.md', 'CHANGELOG.md'];
for (const f of files) cpSync(join(ROOT, f), join(DIST, f));
mkdirSync(join(DIST, 'docs'), { recursive: true });
cpSync(join(ROOT, 'docs'), join(DIST, 'docs'), { recursive: true });
mkdirSync(join(DIST, 'art-briefs'), { recursive: true });
cpSync(join(ROOT, 'art-briefs'), join(DIST, 'art-briefs'), { recursive: true });

const list = (dir: string) => readdirSync(join(ROOT, dir), { recursive: true }).map(String).filter((f) => f.endsWith('.md')).sort();
const links = [
  ...files.map((f) => `<li><a href="../${f}">${f}</a></li>`),
  ...list('docs').map((f) => `<li><a href="../docs/${f}">docs/${f}</a></li>`),
  ...list('art-briefs').map((f) => `<li><a href="../art-briefs/${f}">art-briefs/${f}</a></li>`),
].join('\n');
mkdirSync(join(DIST, 'project'), { recursive: true });
writeFileSync(join(DIST, 'project', 'index.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Summon Jump — project docs</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:720px;margin:0 auto;padding:16px;background:#17120c;color:#f6ecd8}a{color:#f0a845}</style>
<h1>Summon Jump — project docs</h1><p><a href="../">▶ เล่นเกม</a> · เริ่มแชทใหม่: อ่าน <a href="../START.md">START.md</a></p><ul>${links}</ul>`);
console.log('docs published into dist/');
