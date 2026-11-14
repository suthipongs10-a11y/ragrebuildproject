// Deploys the game website to Cloudflare (see docs/DEPLOY_CLOUDFLARE.md): build, put each file of dist/site into the
// KV namespace bound as SITE, then deploy the Pages Functions with no static files (functions/[[path]].js serves the
// files from KV). Files under a/ are named by their content: one already in KV is not sent again, and ones the new
// page no longer uses are deleted at the end. Needs CLOUDFLARE_ACCOUNT_ID and a token (in the cloud session the
// proxy supplies the real one).
// usage: node tools/deploy-site.mjs [--no-build]
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';

const W = ['--yes', 'wrangler@4'];
const run = args => execFileSync('npx', [...W, ...args], {stdio: 'inherit'});
const out = args => execFileSync('npx', [...W, ...args], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']});
const ns = /binding = "SITE"\s*\nid = "([0-9a-f]{32})"/.exec(readFileSync('wrangler.toml', 'utf8'));
if (!ns) throw new Error('wrangler.toml has no KV namespace bound as SITE (see docs/DEPLOY_CLOUDFLARE.md)');
const NS = ['--namespace-id', ns[1], '--remote'];
if (!process.argv.includes('--no-build')) execFileSync('node', ['build.mjs'], {stdio: 'inherit'});

const walk = d => readdirSync('dist/site/' + d).flatMap(f => { const p = d ? d + '/' + f : f; return statSync('dist/site/' + p).isDirectory() ? walk(p) : [p]; });
// index.html last, so a visitor never gets a page whose files are not there yet
const files = walk('').filter(f => !f.startsWith('_')).sort((a, b) => (a === 'index.html') - (b === 'index.html'));
const have = new Set(JSON.parse(out(['kv', 'key', 'list', ...NS, '--prefix', 'site:'])).map(k => k.name));
for (const f of files) {
  if (f.startsWith('a/') && have.has('site:' + f)) { console.log('KV site:' + f, 'already there'); continue; }
  const etag = createHash('sha256').update(readFileSync('dist/site/' + f)).digest('hex').slice(0, 20);
  console.log('KV site:' + f, etag);
  run(['kv', 'key', 'put', 'site:' + f, '--path', 'dist/site/' + f, ...NS, '--metadata', JSON.stringify({etag})]);
}
// the Functions (and the D1 / KV bindings from wrangler.toml), with an empty folder of static files
rmSync('dist/pages-empty', {recursive: true, force: true}); mkdirSync('dist/pages-empty', {recursive: true});
run(['pages', 'deploy', 'dist/pages-empty', '--project-name', 'muay-manager', '--branch', 'main', '--skip-caching', '--commit-dirty=true']);
// old content files, and the single big page of the first deploys
const keep = new Set(files.map(f => 'site:' + f));
for (const k of have) if (!keep.has(k) && (k.startsWith('site:a/'))) { console.log('KV delete', k); run(['kv', 'key', 'delete', k, ...NS]); }
