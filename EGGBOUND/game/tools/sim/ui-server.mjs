// Host scenarios for separate files: mode 'none' (every file 404) · 'csp' (img-src data: blob: only — <img> of files
// blocked, fetch allowed) · 'folder' (page at /app/game with no trailing slash, files under /app/game/...).
import fs from 'node:fs'; import http from 'node:http';
export function serve(port, mode) {
  const html = '<!doctype html><meta charset="utf-8">' + fs.readFileSync(new URL('../../dist/index.html', import.meta.url), 'utf8');
  const page = mode === 'folder' ? '/app/game' : '/';
  return http.createServer((q, r) => { const u = q.url.split('?')[0];
    if (u === page) { r.setHeader('content-type', 'text/html; charset=utf-8'); if (mode === 'csp') r.setHeader('content-security-policy', "img-src data: blob:"); r.end(html); return; }
    const m = u.match(mode === 'folder' ? /^\/app\/game\/((bg|ext)\/[\w.-]+)$/ : /^\/((bg|ext)\/[\w.-]+)$/); const fp = mode !== 'none' && m && new URL('../../dist/', import.meta.url).pathname + m[1];
    if (fp && fs.existsSync(fp)) { r.setHeader('content-type', 'image/webp'); r.end(fs.readFileSync(fp)); } else { r.statusCode = 404; r.end(); } }).listen(port);
}
