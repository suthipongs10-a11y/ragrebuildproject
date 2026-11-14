// Serves the game's files (index.html, icons, manifest). On Cloudflare they live in the KV namespace bound as SITE, written
// by tools/deploy-site.mjs: Pages' own file upload signs each request with a short-lived key that the cloud session's
// network proxy replaces, so the site is deployed with Functions only. Locally (wrangler pages dev) they are plain
// static files and next() serves them. /api/* is handled by functions/api/[[route]].js.
const TYPES = {html: 'text/html; charset=utf-8', png: 'image/png', webmanifest: 'application/manifest+json', json: 'application/json', js: 'text/javascript', css: 'text/css', webp: 'image/webp', jpg: 'image/jpeg', mp3: 'audio/mpeg', svg: 'image/svg+xml', txt: 'text/plain; charset=utf-8'};

export async function onRequest({request, env, next}) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('method not allowed', {status: 405});
  const path = new URL(request.url).pathname.replace(/^\/+/, '') || 'index.html';
  if (env.SITE) {
    const {value, metadata} = await env.SITE.getWithMetadata('site:' + path, {type: 'stream', cacheTtl: 60});
    if (value) {
      const etag = metadata && metadata.etag ? '"' + metadata.etag + '"' : null;
      // the page is checked on every visit (a fix shows up on the next open); unchanged pages answer 304 without the 15 MB
      const headers = {'Content-Type': TYPES[path.split('.').pop()] || 'application/octet-stream', 'Cache-Control': path === 'index.html' ? 'no-cache' : 'public, max-age=86400'};
      if (etag) headers.ETag = etag;
      if ((etag && request.headers.get('If-None-Match') === etag) || request.method === 'HEAD') {
        await value.cancel();
        return new Response(null, {status: etag && request.method !== 'HEAD' ? 304 : 200, headers});
      }
      return new Response(value, {headers});
    }
  }
  return next();
}
