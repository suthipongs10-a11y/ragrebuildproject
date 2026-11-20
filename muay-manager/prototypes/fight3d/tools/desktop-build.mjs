// Builds the computer app (Windows; Linux and the Steam Deck) around the website build: Electron's own release (checked
// against its published SHA-256 sums), the shell in desktop/, and the game's files (dist/site) in resources/app/site.
// Out: dist/desktop/MuayManager-<ver>-<os>-x64/ (the folder a store or a player runs) and a .zip of each.
// usage: node tools/desktop-build.mjs [--no-build] [--only=win|linux]          test: node tools/e2e/desktop.mjs
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import * as ResEdit from 'resedit';

process.chdir(new URL('../', import.meta.url).pathname);
// a release at least two weeks old when it was picked (20 Nov 2026); move it up on purpose, then run tools/e2e/desktop.mjs
const ELECTRON = '45.2.3';
const CACHE = 'node_modules/.cache/muay-electron/', OUT = 'dist/desktop/';
const TARGETS = {
  win: {plat: 'win32-x64', from: 'electron.exe', exe: 'MuayManager.exe'},
  linux: {plat: 'linux-x64', from: 'electron', exe: 'muay-manager'},
};
const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7);
const m = /const VER = '([^']+)', BUILD = (\d+);/.exec(readFileSync('src/game.js', 'utf8'));
if (!m) throw new Error('src/game.js has no VER / BUILD line');
const [, VER, BUILD] = m;

if (!process.argv.includes('--no-build')) execFileSync(process.execPath, ['build.mjs'], {stdio: 'inherit'});
if (!existsSync('dist/site/index.html')) throw new Error('no dist/site/index.html: run node build.mjs first');

// Electron's release files, downloaded once and kept in node_modules/.cache
mkdirSync(CACHE, {recursive: true});
const REL = `https://github.com/electron/electron/releases/download/v${ELECTRON}/`;
function download(name, to) {
  if (existsSync(to)) return to;
  console.log('downloading ' + REL + name);
  execFileSync('curl', ['-fsSL', '--retry', '3', '-o', to + '.part', REL + name], {stdio: 'inherit'});
  renameSync(to + '.part', to);
  return to;
}
const sums = readFileSync(download('SHASUMS256.txt', CACHE + `SHASUMS256-${ELECTRON}.txt`), 'utf8');
function release(name) {
  const file = download(name, CACHE + name);
  const want = (sums.split('\n').find(l => l.endsWith('*' + name) || l.endsWith(' ' + name)) || '').split(' ')[0];
  const got = createHash('sha256').update(readFileSync(file)).digest('hex');
  if (!want || want !== got) { rmSync(file, {force: true}); throw new Error(name + ': SHA-256 does not match Electron\'s published sum, deleted it; run again'); }
  return file;
}

// The Windows program carries the game's name and icon (Task Manager, the taskbar, the file's properties) instead of Electron's.
function brandExe(file) {
  const exe = ResEdit.NtExecutable.from(readFileSync(file), {ignoreCert: true}); // Electron's signature no longer fits a changed file
  const res = ResEdit.NtExecutableResource.from(exe);
  const ico = ResEdit.Data.IconFile.from(readFileSync('desktop/icon.ico'));
  const group = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries)[0];
  if (!group) throw new Error(file + ': no icon group to replace');
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, group.id, group.lang, ico.icons.map(i => i.data));
  const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
  const [a, b] = VER.split('.').map(Number);
  vi.setFileVersion(a, b || 0, 0, +BUILD); vi.setProductVersion(a, b || 0, 0, +BUILD);
  const text = {FileDescription: 'Muay Manager', ProductName: 'Muay Manager', CompanyName: 'Muay Manager', InternalName: 'MuayManager',
    OriginalFilename: 'MuayManager.exe', FileVersion: VER, ProductVersion: VER, LegalCopyright: 'Muay Manager'};
  for (const lang of vi.getAllLanguagesForStringValues()) vi.setStringValues(lang, text);
  vi.outputToResourceEntries(res.entries);
  res.outputResource(exe);
  writeFileSync(file, Buffer.from(exe.generate()));
}

const pkg = JSON.parse(readFileSync('desktop/package.json', 'utf8'));
pkg.version = VER.split('.').concat(['0', '0']).slice(0, 3).map(Number).join('.'); // 2.66 → 2.66.0 (app.getVersion)
for (const [key, t] of Object.entries(TARGETS)) {
  if (only && only !== key) continue;
  const zip = release(`electron-v${ELECTRON}-${t.plat}.zip`);
  const name = `MuayManager-${VER}-${key}-x64`, dir = OUT + name + '/', app = dir + 'resources/app/';
  rmSync(dir, {recursive: true, force: true}); mkdirSync(dir, {recursive: true});
  execFileSync('unzip', ['-q', zip, '-d', dir]);
  renameSync(dir + t.from, dir + t.exe);
  rmSync(dir + 'resources/default_app.asar', {force: true}); // Electron's demo page; the game's app/ takes its place
  // Chromium's own words (a text box's right-click menu) in the game's languages only: English, and Thai
  for (const f of readdirSync(dir + 'locales')) if (!/^(en-US|th)\.pak$/.test(f)) rmSync(dir + 'locales/' + f);
  mkdirSync(app, {recursive: true});
  for (const f of ['main.cjs', 'preload.cjs', 'icon.png']) cpSync('desktop/' + f, app + f);
  writeFileSync(app + 'package.json', JSON.stringify(pkg, null, 2) + '\n');
  cpSync('dist/site', app + 'site', {recursive: true, filter: f => !/[\\/]_headers$/.test(f)}); // _headers is for Cloudflare
  if (key === 'win') brandExe(dir + t.exe); else chmodSync(dir + t.exe, 0o755);
  rmSync(OUT + name + '.zip', {force: true});
  execFileSync('zip', ['-qry', name + '.zip', name], {cwd: OUT});
  const mb = f => (readFileSync(f).length / 1048576).toFixed(0) + ' MB';
  console.log(`${key}: ${dir}${t.exe} · ${OUT}${name}.zip ${mb(OUT + name + '.zip')}`);
}
