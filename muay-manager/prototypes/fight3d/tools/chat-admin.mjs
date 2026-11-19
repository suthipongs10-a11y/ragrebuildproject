// The world chat, for the owner: read the last lines and the reports, take a line out, stop a player from writing.
//   node tools/chat-admin.mjs list [n]            the last n lines (30)
//   node tools/chat-admin.mjs reports             lines players reported
//   node tools/chat-admin.mjs delete <line id>    remove one line
//   node tools/chat-admin.mjs ban <player id>     he can no longer write (his lines are removed); unban <player id> undoes it
// Where: --remote (the Cloudflare site; needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID), --local, or --db <file> (the VPS).
import { execFileSync } from 'node:child_process';
const args = process.argv.slice(2), has = f => args.includes(f), arg = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const words = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--db'), [cmd, what] = words;
let query;
if (arg('--db')) { const { DatabaseSync } = await import('node:sqlite'); const db = new DatabaseSync(arg('--db')); query = sql => (/^\s*select/i.test(sql) ? db.prepare(sql).all() : (db.exec(sql), [])); }
else if (has('--remote') || has('--local')) query = sql => JSON.parse(execFileSync('npx', ['--yes', 'wrangler@4', 'd1', 'execute', 'muay-manager', has('--remote') ? '--remote' : '--local', '--json', '--command', sql], {maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore']}))[0].results;
else { console.log('say where the database is: --db <file> | --remote | --local'); process.exit(1); }
const when = t => new Date(t).toLocaleString('th-TH', {timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'});
const id = v => { if (!/^[0-9]+$/.test(String(v))) { console.log('a line id is a number'); process.exit(1); } return +v; };
const pid = v => { if (!/^p_[0-9a-f]{6,40}$/.test(String(v))) { console.log('a player id looks like p_1a2b3c…'); process.exit(1); } return v; };
if (cmd === 'list') { const n = Math.max(1, Math.min(200, +what || 30)); for (const r of query('SELECT id, t, pid, name, msg FROM chat ORDER BY id DESC LIMIT ' + n).reverse()) console.log('#' + r.id, when(r.t), r.pid, '|', r.name + ':', r.msg); }
else if (cmd === 'reports') { for (const r of query("SELECT t, msg FROM logs WHERE msg LIKE 'REPORT %' ORDER BY id DESC LIMIT 50").reverse()) console.log(when(r.t), r.msg); }
else if (cmd === 'delete') { query('DELETE FROM chat WHERE id = ' + id(what)); console.log('line #' + what + ' removed (screens that already show it keep it until they are reloaded)'); }
else if (cmd === 'ban') { const p = pid(what); query("INSERT OR REPLACE INTO chat_bans (pid, t) VALUES ('" + p + "', " + Date.now() + ')'); query("DELETE FROM chat WHERE pid = '" + p + "'"); console.log(p, 'can no longer write in the chat; his lines are removed'); }
else if (cmd === 'unban') { query("DELETE FROM chat_bans WHERE pid = '" + pid(what) + "'"); console.log(what, 'may write again'); }
else console.log('list [n] | reports | delete <line id> | ban <player id> | unban <player id>');
