// Muay Manager on a server of one's own (a VPS): this one program serves the game's files and the same /api the
// Cloudflare site has. functions/api/[[route]].js runs here unchanged, on SQLite instead of D1.
//   node server/server.mjs
//   PORT 8787 · HOST 127.0.0.1 · MUAY_DB data/muay.db · MUAY_SITE dist/site · MUAY_RATE 1800 (API calls a minute from one address)
// Needs Node 22.13 or newer (node:sqlite). nginx or Caddy goes in front for HTTPS: docs/DEPLOY_VPS.md.
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './d1-sqlite.mjs';
import { onRequest as api } from '../functions/api/[[route]].js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +(process.env.PORT || 8787), HOST = process.env.HOST || '127.0.0.1';
const SITE = resolve(ROOT, process.env.MUAY_SITE || 'dist/site'), DB_FILE = resolve(ROOT, process.env.MUAY_DB || 'data/muay.db');
const RATE = +(process.env.MUAY_RATE || 1800), MAX_BODY = 300 * 1024, KEEP_BACKUPS = 7;
if (!existsSync(join(SITE, 'index.html'))) { console.error('no site at ' + SITE + ' — run "node build.mjs" first'); process.exit(1); }
mkdirSync(dirname(DB_FILE), {recursive: true});
const db = openDb(DB_FILE), env = {DB: db, CUP_EVERY: process.env.MUAY_CUP_EVERY, CUP_ANCHOR: process.env.MUAY_CUP_ANCHOR, CUP_LEAD: process.env.MUAY_CUP_LEAD, CUP_GAP: process.env.MUAY_CUP_GAP}; // MUAY_CUP_*: another schedule for the players' cup (tests)

// ---- the game's files
const TYPES = {woff2: 'font/woff2', html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', webmanifest: 'application/manifest+json',
  png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', mp3: 'audio/mpeg', ico: 'image/x-icon', txt: 'text/plain; charset=utf-8', glb: 'model/gltf-binary'};
const SQUEEZE = new Set(['html', 'js', 'css', 'json', 'webmanifest', 'svg', 'txt']), SQUEEZE_MAX = 4e6; // the big page in a/ is packed data already: gzip gains little there
const packed = new Map(); // path -> {tag, body}: small text files, gzipped once
function sendFile(req, res, rel) {
  const file = resolve(SITE, rel);
  if (file !== SITE && !file.startsWith(SITE + sep)) return false;
  let st; try { st = statSync(file); } catch (e) { return false; }
  if (!st.isFile()) return false;
  const ext = rel.split('.').pop().toLowerCase(), tag = '"' + st.size.toString(36) + '-' + Math.round(st.mtimeMs).toString(36) + '"';
  // the pages are checked on every visit (a fix shows on the next open); files in a/ are named by content and never change
  const head = {'Content-Type': TYPES[ext] || 'application/octet-stream', ETag: tag, 'X-Content-Type-Options': 'nosniff',
    'Cache-Control': rel.startsWith('a/') ? 'public, max-age=31536000, immutable' : ext === 'html' || ext === 'json' || ext === 'webmanifest' ? 'no-cache' : 'public, max-age=86400'};
  if (req.headers['if-none-match'] === tag) { res.writeHead(304, head); res.end(); return true; }
  if (SQUEEZE.has(ext) && st.size < SQUEEZE_MAX && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    let p = packed.get(rel); if (!p || p.tag !== tag) { p = {tag, body: gzipSync(readFileSync(file))}; packed.set(rel, p); }
    res.writeHead(200, Object.assign(head, {'Content-Encoding': 'gzip', 'Content-Length': p.body.length, Vary: 'Accept-Encoding'}));
    res.end(req.method === 'HEAD' ? undefined : p.body); return true;
  }
  head['Accept-Ranges'] = 'bytes';
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (m && (m[1] || m[2])) { // a part of the file (a download picked up again, a media player)
    const start = m[1] ? +m[1] : Math.max(0, st.size - +m[2]), end = m[1] && m[2] ? Math.min(+m[2], st.size - 1) : st.size - 1;
    if (start > end || start >= st.size) { res.writeHead(416, {'Content-Range': 'bytes */' + st.size}); res.end(); return true; }
    res.writeHead(206, Object.assign(head, {'Content-Range': 'bytes ' + start + '-' + end + '/' + st.size, 'Content-Length': end - start + 1}));
    if (req.method === 'HEAD') res.end(); else createReadStream(file, {start, end}).pipe(res);
    return true;
  }
  res.writeHead(200, Object.assign(head, {'Content-Length': st.size}));
  if (req.method === 'HEAD') res.end(); else createReadStream(file).on('error', () => res.destroy()).pipe(res);
  return true;
}

// ---- the API: the same handler as on Cloudflare, given a Request and handing back a Response
const hits = new Map(); // address -> [minute, count]
function tooMany(ip) {
  const min = Math.floor(Date.now() / 60000), h = hits.get(ip);
  if (!h || h[0] !== min) { hits.set(ip, [min, 1]); if (hits.size > 5000) for (const [k, v] of hits) if (v[0] !== min) hits.delete(k); return false; }
  return ++h[1] > RATE;
}
// behind nginx on the same machine the caller's address is in X-Forwarded-For; a direct caller's header is not believed
const addr = req => { const a = req.socket.remoteAddress || ''; return /^(::1|127\.|::ffff:127\.)/.test(a) ? String(req.headers['x-forwarded-for'] || a).split(',')[0].trim() : a; };
const body = req => new Promise((ok, no) => {
  const parts = []; let n = 0;
  // too much: the rest is read and dropped so the caller gets a proper answer (nginx in front stops the really big ones)
  req.on('data', c => { n += c.length; if (n <= MAX_BODY) parts.push(c); else if (n > 20 * MAX_BODY) req.destroy(); });
  req.on('end', () => n > MAX_BODY ? no(Object.assign(new Error('too large'), {status: 413})) : ok(Buffer.concat(parts))); req.on('error', no); req.on('close', () => no(new Error('closed')));
});
async function sendApi(req, res, url) {
  if (tooMany(addr(req))) { res.writeHead(429, {'Content-Type': 'application/json', 'Retry-After': '30', 'Access-Control-Allow-Origin': '*'}); res.end('{"error":"too many requests"}'); return; }
  const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  const init = {method: req.method, headers};
  if (req.method !== 'GET' && req.method !== 'HEAD') init.body = await body(req);
  const out = await api({request: new Request('http://muay' + req.url, init), env, params: {route: url.pathname.slice(5).split('/').filter(Boolean)}});
  const buf = Buffer.from(await out.arrayBuffer()), h = {}; out.headers.forEach((v, k) => { h[k] = v; });
  h['content-length'] = buf.length; res.writeHead(out.status, h); res.end(buf);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://muay');
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return await sendApi(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, {Allow: 'GET, HEAD'}); res.end('method not allowed'); return; }
    let rel; try { rel = decodeURIComponent(url.pathname).replace(/^\/+/, ''); } catch (e) { rel = '\0'; }
    if (rel.includes('\0') || rel.split('/').some(s => s.startsWith('.'))) { res.writeHead(404); res.end('not found'); return; } // no dotfiles
    if (sendFile(req, res, rel || 'index.html')) return;
    res.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'}); res.end('not found');
  } catch (e) {
    const status = e && e.status || 500; if (status >= 500) console.error(new Date().toISOString(), req.method, req.url, e && e.stack || e);
    if (res.destroyed) return;
    if (!res.headersSent) res.writeHead(status, {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}); res.end(JSON.stringify({error: status === 413 ? 'too large' : 'server error'}));
  }
});
server.requestTimeout = 30000; server.headersTimeout = 15000;

// ---- a copy of the database a day, the last few kept (data/backup/muay-YYYY-MM-DD.db)
function backup() {
  try {
    const dir = join(dirname(DB_FILE), 'backup'), to = join(dir, 'muay-' + new Date().toISOString().slice(0, 10) + '.db'); mkdirSync(dir, {recursive: true});
    if (!existsSync(to)) { db.backupTo(to); console.log('backup written: ' + to); }
    readdirSync(dir).filter(f => /^muay-\d{4}-\d\d-\d\d\.db$/.test(f)).sort().slice(0, -KEEP_BACKUPS).forEach(f => unlinkSync(join(dir, f)));
  } catch (e) { console.error('backup failed:', e && e.message); }
}
setTimeout(backup, 60e3).unref(); setInterval(backup, 6 * 3600e3).unref();

server.listen(PORT, HOST, () => { let ver = '?'; try { ver = JSON.parse(readFileSync(join(SITE, 'version.json'), 'utf8')).ver; } catch (e) { /* an old build */ } console.log('Muay Manager ' + ver + ' on http://' + HOST + ':' + PORT + ' · site ' + SITE + ' · database ' + DB_FILE); });
const stop = () => { server.close(() => { try { db.close(); } catch (e) { /* closing anyway */ } process.exit(0); }); setTimeout(() => process.exit(0), 3000).unref(); };
process.on('SIGTERM', stop); process.on('SIGINT', stop);
