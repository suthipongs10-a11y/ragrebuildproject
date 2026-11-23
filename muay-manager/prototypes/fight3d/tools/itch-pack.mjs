// The game's page on itch.io (an "HTML" project there): a small page that holds the live game from its own website
// in a frame, so itch.io always plays the newest version (no new upload after each update) on the same server as the
// website (one ranking, challenges, chat and cup). The API answers any origin; the site sends nothing that stops it
// being framed. Saves stay on the player's device as on the website (a different place from the website's own, so a
// player who has both moves with the transfer code).
// Also writes the page's pictures: a cover (630×500) and screenshots, from the game's own art and recorded frames.
// usage: node tools/itch-pack.mjs [--url https://muay.eggpact.com/]   → dist/itch/index.html, dist/MuayManager-itch.zip, dist/itch-page/*
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
const ROOT = new URL('../', import.meta.url).pathname;
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const URL0 = arg('url', 'https://muay.eggpact.com/'), OUT = ROOT + 'dist/itch/', ZIP = ROOT + 'dist/MuayManager-itch.zip';
const src = URL0 + (URL0.includes('?') ? '&' : '?') + 'from=itch';
rmSync(OUT, {recursive: true, force: true}); mkdirSync(OUT, {recursive: true});
// Behind the frame, until the game paints its own loading screen: a line to wait, and the website to open instead.
writeFileSync(OUT + 'index.html', `<!doctype html>
<html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Muay Manager</title>
<style>
html,body{margin:0;height:100%;background:#0e0f14;overflow:hidden;font:15px/1.5 system-ui,sans-serif;color:#9a9fb0}
#wait{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center;padding:0 24px}
#wait a{color:#f2b83a}
iframe{position:fixed;inset:0;width:100%;height:100%;border:0;display:block;background:transparent}
</style></head>
<body>
<div id="wait">กำลังโหลดเกม… · Loading the game…<br><small>ถ้าไม่ขึ้นภายในครึ่งนาที เล่นที่ · If it does not come up, play at <a href="${URL0}" target="_blank" rel="noopener">${URL0.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a></small></div>
<iframe src="${src}" title="Muay Manager" allow="fullscreen; autoplay; clipboard-write; web-share; screen-wake-lock" allowfullscreen></iframe>
</body></html>
`);
rmSync(ZIP, {force: true});
execFileSync('zip', ['-q', '-j', ZIP, OUT + 'index.html']);
console.log('itch page →', OUT + 'index.html', '· zip →', ZIP, '· game at', src);

// the pictures for the itch.io page
const PAGE = ROOT + 'dist/itch-page/'; mkdirSync(PAGE, {recursive: true});
const py = `
import sys
from PIL import Image
root, out = sys.argv[1], sys.argv[2]
bg = Image.open(root + 'assets/ui/title-landscape.webp').convert('RGB')
W, H = 630, 500
s = max(W / bg.width, H / bg.height); bg = bg.resize((round(bg.width * s), round(bg.height * s)), Image.LANCZOS)
x, y = (bg.width - W) // 2, (bg.height - H) // 2; cover = bg.crop((x, y, x + W, y + H))
logo = Image.open(root + 'assets/ui/logo.webp').convert('RGBA'); lw = 520; logo = logo.resize((lw, round(logo.height * lw / logo.width)), Image.LANCZOS)
shade = Image.new('RGBA', (W, H), (0, 0, 0, 0)); band = Image.new('RGBA', (W, logo.height + 40), (8, 8, 12, 150)); shade.paste(band, (0, H - logo.height - 52))
cover = Image.alpha_composite(cover.convert('RGBA'), shade); cover.alpha_composite(logo, ((W - lw) // 2, H - logo.height - 32))
cover.convert('RGB').save(out + 'cover-630x500.png')
`;
execFileSync('python3', ['-I', '-c', py, ROOT, PAGE]);
// screenshots: frames the clip tools recorded (tools/clips), when they are there
const shots = [['round-1-frames/00090.jpg', '1-plan'], ['round-1-frames/01500.jpg', '2-fight'], ['round-1-frames/02150.jpg', '3-fight'], ['gameplay-draft-frames/00168.jpg', '4-training'], ['gameplay-draft-frames/00090.jpg', '5-camp']];
for (const [f, name] of shots) if (existsSync(ROOT + 'dist/clips/' + f)) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', ROOT + 'dist/clips/' + f, '-vf', 'scale=540:-1', '-q:v', '3', PAGE + 'shot-' + name + '.jpg']);
console.log('page pictures →', PAGE);
