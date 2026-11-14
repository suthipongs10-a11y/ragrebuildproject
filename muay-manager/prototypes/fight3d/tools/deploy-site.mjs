// Deploys the game website to Cloudflare (see docs/DEPLOY_CLOUDFLARE.md): build, put each file of dist/site into the
// KV namespace bound as SITE, then deploy the Pages Functions with no static files (functions/[[path]].js serves the
// files from KV). Needs CLOUDFLARE_ACCOUNT_ID and a token (in the cloud session the proxy supplies the real one).
// usage: node tools/deploy-site.mjs [--no-build]
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';

const W = ['--yes', 'wrangler@4'];
const run = args => execFileSync('npx', [...W, ...args], {stdio: 'inherit'});
const ns = /binding = "SITE"\s*\nid = "([0-9a-f]{32})"/.exec(readFileSync('wrangler.toml', 'utf8'));
if (!ns) throw new Error('wrangler.toml has no KV namespace bound as SITE (see docs/DEPLOY_CLOUDFLARE.md)');
if (!process.argv.includes('--no-build')) execFileSync('node', ['build.mjs'], {stdio: 'inherit'});

// 1. files: index.html last, so a visitor never gets a page whose icons are missing
const files = readdirSync('dist/site').filter(f => !f.startsWith('_')).sort((a, b) => (a === 'index.html') - (b === 'index.html'));
for (const f of files) {
  const etag = createHash('sha256').update(readFileSync('dist/site/' + f)).digest('hex').slice(0, 20);
  console.log('KV site:' + f, etag);
  run(['kv', 'key', 'put', 'site:' + f, '--path', 'dist/site/' + f, '--namespace-id', ns[1], '--remote', '--metadata', JSON.stringify({etag})]);
}
// 2. the Functions (and the D1 / KV bindings from wrangler.toml), with an empty folder of static files
rmSync('dist/pages-empty', {recursive: true, force: true}); mkdirSync('dist/pages-empty', {recursive: true});
run(['pages', 'deploy', 'dist/pages-empty', '--project-name', 'muay-manager', '--branch', 'main', '--skip-caching', '--commit-dirty=true']);
