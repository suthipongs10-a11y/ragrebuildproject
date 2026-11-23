// The ranking, for the owner: who is on top and with what, the writes the server refused as impossible (the plausibility
// guard in functions/api/[[route]].js), and taking a cheater off (his ranking line, challenges, answers and cup entries go,
// and nothing more of his is taken into the shared lists until he is let back).
//   node tools/rank-admin.mjs top [n]                 the first n on the ranking (30), with anything odd about each
//   node tools/rank-admin.mjs refused [n]             the last n writes refused (30), newest last
//   node tools/rank-admin.mjs ban <player id> [why]   off the ranking and out of every shared list
//   node tools/rank-admin.mjs unban <player id>       he may write again (his fighter comes back the next time his game saves)
//   node tools/rank-admin.mjs bans                    who is banned
// Where: --remote (the Cloudflare site; needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID), --local, or --db <file> (the VPS).
import { execFileSync } from 'node:child_process';
const args = process.argv.slice(2), has = f => args.includes(f), arg = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const words = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--db'), [cmd, what, ...rest] = words;
let query;
if (arg('--db')) { const { DatabaseSync } = await import('node:sqlite'); const db = new DatabaseSync(arg('--db')); query = sql => (/^\s*select/i.test(sql) ? db.prepare(sql).all() : (db.exec(sql), [])); }
else if (has('--remote') || has('--local')) query = sql => JSON.parse(execFileSync('npx', ['--yes', 'wrangler@4', 'd1', 'execute', 'muay-manager', has('--remote') ? '--remote' : '--local', '--json', '--command', sql], {maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore']}))[0].results;
else { console.log('say where the database is: --db <file> | --remote | --local'); process.exit(1); }
const when = t => new Date(t).toLocaleString('th-TH', {timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'});
const pid = v => { if (!/^p_[0-9a-f]{6,40}$/.test(String(v))) { console.log('a player id looks like p_1a2b3c…'); process.exit(1); } return v; };
const q = s => "'" + String(s).replace(/'/g, "''") + "'";
// the server makes these tables on its first request after the update; a database it has not served since has none yet
const ensure = () => query("CREATE TABLE IF NOT EXISTS bans (pid TEXT PRIMARY KEY, t INTEGER NOT NULL, why TEXT); CREATE TABLE IF NOT EXISTS refused (id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER NOT NULL, pid TEXT NOT NULL, coll TEXT NOT NULL, why TEXT NOT NULL)");
if (cmd === 'top') {
  const n = Math.max(1, Math.min(200, +what || 30));
  const rows = query(`SELECT id, data, updated FROM docs WHERE coll = 'board' ORDER BY json_extract(data, '$.rp') DESC LIMIT ${n}`);
  rows.forEach((r, i) => {
    const d = JSON.parse(r.data), st = d.stats || {}, top = Math.max(0, ...Object.values(st).map(Number)), wins = (d.w | 0) + (d.d | 0), odd = [];
    if (top > 97) odd.push('stat ' + top); if (d.rp > 1000 + 32 * wins) odd.push('rating over 1000 + 32 a win'); if ((d.ko | 0) > (d.w | 0)) odd.push('more KOs than wins');
    console.log(String(i + 1).padStart(3), r.id, String(d.name || '').padEnd(20).slice(0, 20), 'RP', Math.round(d.rp), `${d.w | 0}-${d.l | 0}-${d.d | 0} KO ${d.ko | 0}`, 'best stat', top, when(r.updated), odd.length ? '  ⚠ ' + odd.join(', ') : '');
  });
} else if (cmd === 'refused') {
  ensure(); const n = Math.max(1, Math.min(500, +what || 30));
  for (const r of query(`SELECT t, pid, coll, why FROM refused ORDER BY id DESC LIMIT ${n}`).reverse()) console.log(when(r.t), r.pid, r.coll, '·', r.why);
} else if (cmd === 'ban') {
  ensure(); const p = pid(what), why = rest.join(' ').slice(0, 200) || 'owner';
  query(`INSERT OR REPLACE INTO bans (pid, t, why) VALUES (${q(p)}, ${Date.now()}, ${q(why)})`);
  query(`DELETE FROM docs WHERE id = ${q(p)} AND coll IN ('board', 'challenges', 'answers')`); query(`DELETE FROM cups WHERE id = ${q(p)}`);
  console.log(p, 'is off the ranking, his challenges and cup entries are gone, and nothing more of his is taken (screens drop him within a minute)');
} else if (cmd === 'unban') { ensure(); query(`DELETE FROM bans WHERE pid = ${q(pid(what))}`); console.log(what, 'may write again'); }
else if (cmd === 'bans') { ensure(); for (const r of query('SELECT pid, t, why FROM bans ORDER BY t')) console.log(r.pid, when(r.t), r.why); }
else console.log('top [n] | refused [n] | ban <player id> [why] | unban <player id> | bans');
