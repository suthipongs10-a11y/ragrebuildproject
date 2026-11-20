// Muay Manager's own small store, for the game when it runs on its own website (Cloudflare Pages Functions + D1).
// The browser side is src/netdb.js. Each player gets an id and a secret on first visit (POST /api/register).
// Anyone may read the shared collections; a player writes only his own document in them (document id = his id)
// and only his own private folder data/users/<his id>/.
//   GET  /api/health                      -> {ok, now}   (now: server time in ms)
//   POST /api/register                    -> {id, secret}
//   GET  /api/db/<collection>?order=&dir=&limit=   -> {docs: [{id, data}]}
//   GET  /api/db/<collection>/<doc>       -> {id, data} (data null when there is no such document)
//   PUT  /api/db/<collection>/<doc>       body: JSON object -> {ok}
//   DELETE /api/db/<collection>/<doc>     -> {ok}
//   POST /api/log                         body: {msg, ver, page} -> {ok}   errors from players' browsers, the last 1000 kept;
//                                         a msg that starts with "FEEDBACK " is a player's note to the developer (the last 2000 kept)
//   POST /api/transfer                    -> {code, expires}   a code that moves this player to another device (10 minutes)
//   POST /api/transfer/claim              body: {code} -> {id, secret}   the new device takes the player over; the old key stops working
//   DELETE /api/me                        -> {ok}   the player and everything stored for him are removed
//   GET  /api/cup                         -> {now, gap, lead, next: {k, start, close, entries}, prev: {k, start, entries}}   the players' cup (below)
//   POST /api/cup                         body: the fighter entered (JSON object) -> {ok, k}   until the list closes; a second POST replaces the first
//   DELETE /api/cup                       -> {ok}   withdraw, until the list closes
import { hasBad, maskBad, scrubNames, NAME_STANDIN } from '../../src/badwords.js'; // the same word list as the game
const SHARED = new Set(['board', 'challenges', 'answers']);
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', CODE_LEN = 8; // transfer codes: no letters that read like digits
const SEG = /^[A-Za-z0-9_\-.~:@+]{1,200}$/, FIELD = /^[A-Za-z0-9_]{1,40}$/, MAX_BODY = 256 * 1024;
// Any origin may call the API: the game inside the iOS / Android app is a local page (capacitor://localhost, https://localhost).
// A player is known by the key he sends in Authorization, never by a cookie, so this opens nothing.
const CORS = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Max-Age': '86400'};
const json = (data, status = 200) => new Response(JSON.stringify(data), {status, headers: Object.assign({'Content-Type': 'application/json', 'Cache-Control': 'no-store'}, CORS)});
// The players' cup: a knockout tournament between players' fighters at a fixed time every week. The server keeps the
// clock and the list: it takes no entry and no change once the list has closed, so every screen builds the same bracket
// from the same list and works the bouts out by itself (the fights are deterministic). Times in ms.
// Cup number k starts at anchor + k * every; its list closes `lead` before that; its rounds follow each other `gap` apart.
// (CUP_* in the environment replace these, for tests.)
const CUP = {every: 7 * 864e5, anchor: Date.UTC(2026, 10, 21, 13, 0, 0), lead: 5 * 60e3, gap: 6 * 60e3, rounds: 4, max: 64}; // Saturdays, 20:00 in Thailand
function cupClock(env, now) {
  const num = (v, d) => (Number.isFinite(+v) && +v > 0 ? +v : d), every = num(env.CUP_EVERY, CUP.every), anchor = num(env.CUP_ANCHOR, CUP.anchor), lead = num(env.CUP_LEAD, CUP.lead), gap = num(env.CUP_GAP, CUP.gap);
  const k = Math.ceil((now - CUP.rounds * gap - anchor) / every), at = n => anchor + n * every; // the cup that is next, or on right now
  return {k, start: at(k), close: at(k) - lead, prevStart: at(k - 1), gap, lead};
}
let ready = false;
async function schema(db) {
  if (ready) return;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, secret_hash TEXT NOT NULL, created INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS docs (coll TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated INTEGER NOT NULL, PRIMARY KEY (coll, id))'),
    db.prepare('CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER NOT NULL, ua TEXT, ver TEXT, msg TEXT)'),
    db.prepare('CREATE TABLE IF NOT EXISTS transfers (code TEXT PRIMARY KEY, id TEXT NOT NULL, expires INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS cups (k INTEGER NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (k, id))'),
    db.prepare('CREATE TABLE IF NOT EXISTS news (id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER NOT NULL, pid TEXT NOT NULL, data TEXT NOT NULL)'),
    db.prepare('CREATE INDEX IF NOT EXISTS news_pid ON news (pid, id)'),
    db.prepare('CREATE TABLE IF NOT EXISTS chat (id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER NOT NULL, pid TEXT NOT NULL, name TEXT NOT NULL, msg TEXT NOT NULL)'),
    db.prepare('CREATE INDEX IF NOT EXISTS chat_pid ON chat (pid, id)'),
    db.prepare('CREATE TABLE IF NOT EXISTS chat_bans (pid TEXT PRIMARY KEY, t INTEGER NOT NULL)'),
    // who is online is asked often: an index on the time each fighter was last seen, so the count reads only those rows
    db.prepare("CREATE INDEX IF NOT EXISTS board_seen ON docs (json_extract(data, '$.seen')) WHERE coll = 'board'")
  ]);
  ready = true;
}
// The news ticker: what players' fighters have just done (a knockout, a belt, a step up). Each game posts its own notable
// results and everyone reads the last ones. Only set words, small numbers and names are kept: never free text.
const NEWS = {keep: 200, list: 30, gap: 8000, kinds: new Set(['ko', 'win', 'draw', 'belt', 'def', 'rev', 'cup', 'pcup', 'up', 'new']), how: new Set(['ko', 'tko', 'pts', 'draw'])};
const newsName = v => (typeof v === 'string' ? v.replace(/[\u0000-\u001f<>&"']/g, '').trim().slice(0, 40) : '');
function newsItem(x) {
  if (!x || typeof x !== 'object' || !NEWS.kinds.has(x.k)) return null;
  const clean = v => { const n = newsName(v); return hasBad(n) ? NAME_STANDIN : n; }, name = clean(x.name), o = clean(x.o), out = {k: x.k, name}; if (name.length < 2) return null;
  if (o) out.o = o; if (NEWS.how.has(x.hw)) out.hw = x.hw; if (x.ch === 1) out.ch = 1;
  if (Number.isInteger(x.rd) && x.rd >= 1 && x.rd <= 5) out.rd = x.rd; if (Number.isInteger(x.n) && x.n >= 0 && x.n <= 999) out.n = x.n;
  return out;
}
// The world chat: short lines from players to everyone. Read along with the challenges list every game already polls (no
// request of its own); a line costs its sender one request. Kept: the last CHAT.keep lines. A line is cleaned here, not
// trusted from the page: length, links out, the coarsest words masked. The name is the fighter's, read from the ranking.
const CHAT = {keep: 200, page: 40, max: 120, gap: 2500, perMin: 8, online: 60e3, cache: 10e3};
const CHAT_LINK = /(https?:\/\/|www\.)\S+|\b[\w-]+\.(com|net|org|io|co|me|xyz|info|th|ly|gg|tv|cc|app|dev|site|online|shop|club|vip|bet)\b(\/\S*)?/gi;
function chatClean(v) {
  // control and invisible characters (zero-width, direction marks, line separators) become spaces
  let t = typeof v === 'string' ? v.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ').replace(/\s+/g, ' ').trim() : '';
  t = t.replace(CHAT_LINK, '[ลิงก์]');
  t = maskBad(t); // src/badwords.js
  return [...t].slice(0, CHAT.max).join(''); // by characters, not halves of them
}
async function chatSince(db, after) { // the lines after one already had, oldest first; with none had, the last page
  const row = r => ({id: r.id, t: r.t, pid: r.pid, name: r.name, msg: r.msg});
  if (after > 0) return (await db.prepare('SELECT id, t, pid, name, msg FROM chat WHERE id > ? ORDER BY id LIMIT ?').bind(after, CHAT.page).all()).results.map(row);
  return (await db.prepare('SELECT id, t, pid, name, msg FROM chat ORDER BY id DESC LIMIT ?').bind(CHAT.page).all()).results.map(row).reverse();
}
// who has the game open now (seen in the last minute): the count and the first names. Worked out afresh every few seconds.
let onlineMemo = {at: 0, v: {n: 0, list: []}};
async function onlineNow(db) {
  const now = Date.now(); if (now - onlineMemo.at < CHAT.cache) return onlineMemo.v;
  const since = now - CHAT.online;
  const [c, l] = await db.batch([
    db.prepare("SELECT COUNT(*) n FROM docs WHERE coll = 'board' AND json_extract(data, '$.seen') > ?").bind(since),
    db.prepare("SELECT id, json_extract(data, '$.name') name FROM docs WHERE coll = 'board' AND json_extract(data, '$.seen') > ? LIMIT 30").bind(since)
  ]);
  onlineMemo = {at: now, v: {n: (c.results[0] || {}).n | 0, list: l.results.map(r => ({id: r.id, name: hasBad(r.name) ? NAME_STANDIN : newsName(r.name).slice(0, 24)}))}};
  return onlineMemo.v;
}
const reportMemo = new Map(); // one report every few seconds from a player (kept in this worker's memory: enough to stop a flood)
async function sha256(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
const rand = n => [...crypto.getRandomValues(new Uint8Array(n))].map(x => x.toString(16).padStart(2, '0')).join('');
async function caller(request, db) {
  const m = /^Bearer ([A-Za-z0-9_]+)\.([0-9a-f]{64})$/.exec(request.headers.get('Authorization') || ''); if (!m) return null;
  const row = await db.prepare('SELECT secret_hash FROM players WHERE id = ?').bind(m[1]).first();
  return row && row.secret_hash === await sha256(m[2]) ? m[1] : null;
}
// may this player write the document coll/id? (his own document in a shared collection, or anything in his private folder)
const canWrite = (who, coll, id) => !!who && ((SHARED.has(coll) && id === who) || coll === 'data/users/' + who);
const canRead = (who, coll) => SHARED.has(coll) || (!!who && coll === 'data/users/' + who);

export async function onRequest({request, env, params}) {
  if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers: CORS});
  const db = env.DB; if (!db) return json({error: 'no database bound as DB'}, 500);
  await schema(db);
  const dec = x => { try { return decodeURIComponent(x); } catch (e) { return ''; } }, route = [].concat(params.route || []).map(dec), method = request.method;
  if (route[0] === 'health') return json({ok: true, now: Date.now()}); // now: the server's clock, so two players' screens can keep the same time
  if (route[0] === 'log' && method === 'POST') {
    const text = (await request.text()).slice(0, 4000); let d = {}; try { d = JSON.parse(text) || {}; } catch (e) { d = {msg: text}; }
    const cut = (v, n) => String(v == null ? '' : v).slice(0, n);
    await db.batch([
      db.prepare('INSERT INTO logs (t, ua, ver, msg) VALUES (?, ?, ?, ?)').bind(Date.now(), cut(request.headers.get('User-Agent'), 200), cut(d.ver, 40), cut(d.msg, 3000)),
      // the last 1000 kept; players' own notes (FEEDBACK ...) are not pushed out by errors, and are capped on their own
      db.prepare("DELETE FROM logs WHERE id <= (SELECT MAX(id) - 1000 FROM logs) AND msg NOT LIKE 'FEEDBACK %' AND msg NOT LIKE 'REPORT %'"),
      db.prepare("DELETE FROM logs WHERE msg LIKE 'FEEDBACK %' AND id NOT IN (SELECT id FROM logs WHERE msg LIKE 'FEEDBACK %' ORDER BY id DESC LIMIT 2000)")
    ]);
    return json({ok: true});
  }
  if (route[0] === 'register' && method === 'POST') {
    const id = 'p_' + rand(10), secret = rand(32);
    await db.prepare('INSERT INTO players (id, secret_hash, created) VALUES (?, ?, ?)').bind(id, await sha256(secret), Date.now()).run();
    return json({id, secret});
  }
  // moving to another device: the old one asks for a code, the new one hands it in and gets a fresh key for the same player
  if (route[0] === 'transfer' && method === 'POST') {
    const now = Date.now();
    if (route[1] === 'claim') {
      let d = {}; try { d = JSON.parse((await request.text()).slice(0, 200)) || {}; } catch (e) { /* no code */ }
      const code = String(d.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const row = code.length === CODE_LEN ? await db.prepare('SELECT id, expires FROM transfers WHERE code = ?').bind(code).first() : null;
      if (!row || row.expires < now) return json({error: 'bad code'}, 404);
      const secret = rand(32);
      await db.batch([db.prepare('UPDATE players SET secret_hash = ? WHERE id = ?').bind(await sha256(secret), row.id), db.prepare('DELETE FROM transfers WHERE id = ?').bind(row.id)]);
      return json({id: row.id, secret});
    }
    const who = await caller(request, db); if (!who) return json({error: 'forbidden'}, 403);
    const pick = crypto.getRandomValues(new Uint8Array(CODE_LEN)), code = [...pick].map(x => CODE_ABC[x % CODE_ABC.length]).join(''), expires = now + 10 * 60e3;
    await db.batch([db.prepare('DELETE FROM transfers WHERE id = ? OR expires < ?').bind(who, now), db.prepare('INSERT INTO transfers (code, id, expires) VALUES (?, ?, ?)').bind(code, who, expires)]);
    return json({code, expires});
  }
  // the player asks to be forgotten: his records in the shared collections, his private folder, his codes and his key
  if (route[0] === 'me' && method === 'DELETE') {
    const who = await caller(request, db); if (!who) return json({error: 'forbidden'}, 403);
    await db.batch([
      db.prepare("DELETE FROM docs WHERE (id = ? AND coll IN ('board', 'challenges', 'answers')) OR coll = ? OR coll LIKE ?").bind(who, 'data/users/' + who, 'data/users/' + who + '/%'),
      db.prepare('DELETE FROM transfers WHERE id = ?').bind(who), db.prepare('DELETE FROM cups WHERE id = ?').bind(who), db.prepare('DELETE FROM news WHERE pid = ?').bind(who), db.prepare('DELETE FROM chat WHERE pid = ?').bind(who), db.prepare('DELETE FROM players WHERE id = ?').bind(who)
    ]);
    return json({ok: true});
  }
  if (route[0] === 'news' && route.length === 1) {
    const now = Date.now();
    if (method === 'GET') { // the last lines, newest first (the game leaves out the ones too old to tell)
      const {results} = await db.prepare('SELECT id, t, pid, data FROM news ORDER BY id DESC LIMIT ?').bind(NEWS.list).all();
      return json({now, items: results.map(r => Object.assign(JSON.parse(r.data), {id: r.id, t: r.t, pid: r.pid}))});
    }
    if (method !== 'POST') return json({error: 'method'}, 405);
    const who = await caller(request, db); if (!who) return json({error: 'forbidden'}, 403);
    const text = await request.text(); if (text.length > 2000) return json({error: 'too large'}, 413);
    let body; try { body = JSON.parse(text); } catch (e) { return json({error: 'not json'}, 400); }
    const items = (body && Array.isArray(body.items) ? body.items : []).slice(0, 2).map(newsItem).filter(Boolean);
    if (!items.length) return json({error: 'nothing to say'}, 400);
    const last = await db.prepare('SELECT t FROM news WHERE pid = ? ORDER BY id DESC LIMIT 1').bind(who).first();
    if (last && now - last.t < NEWS.gap) return json({error: 'too soon'}, 429); // one fight, one post
    await db.batch(items.map(x => db.prepare('INSERT INTO news (t, pid, data) VALUES (?, ?, ?)').bind(now, who, JSON.stringify(x)))
      .concat(db.prepare('DELETE FROM news WHERE id <= (SELECT MAX(id) - ? FROM news)').bind(NEWS.keep)));
    return json({ok: true, n: items.length});
  }
  if (route[0] === 'chat') {
    const now = Date.now();
    if (route.length === 1 && method === 'GET') return json({now, chat: {items: await chatSince(db, +new URL(request.url).searchParams.get('after') || 0)}, on: await onlineNow(db)});
    if (method !== 'POST' || route.length > 2 || (route.length === 2 && route[1] !== 'report')) return json({error: 'not found'}, 404);
    const who = await caller(request, db); if (!who) return json({error: 'forbidden'}, 403);
    const text = await request.text(); if (text.length > 2000) return json({error: 'too large'}, 413);
    let body; try { body = JSON.parse(text); } catch (e) { return json({error: 'not json'}, 400); }
    if (route.length === 2) { // a line somebody finds out of order: written down for the owner to look at
      const id = body && Number.isInteger(body.id) ? body.id : 0, last = reportMemo.get(who) || 0; if (!id) return json({error: 'which line'}, 400);
      if (now - last < 5000) return json({error: 'too soon'}, 429); reportMemo.set(who, now); if (reportMemo.size > 500) reportMemo.clear();
      const m = await db.prepare('SELECT pid, name, msg FROM chat WHERE id = ?').bind(id).first(); if (!m) return json({ok: true, gone: true});
      await db.prepare('INSERT INTO logs (t, ua, ver, msg) VALUES (?, ?, ?, ?)').bind(now, '', '', ('REPORT chat #' + id + ' by ' + who + ': ' + m.pid + ' ' + m.name + ': ' + m.msg).slice(0, 600)).run();
      return json({ok: true});
    }
    const msg = chatClean(body && body.text); if (!msg) return json({error: 'nothing to say'}, 400);
    const [ban, me, rate] = await db.batch([
      db.prepare('SELECT 1 x FROM chat_bans WHERE pid = ?').bind(who),
      db.prepare("SELECT data FROM docs WHERE coll = 'board' AND id = ?").bind(who),
      db.prepare('SELECT COUNT(*) c, MAX(t) last FROM chat WHERE pid = ? AND t > ?').bind(who, now - 60e3)
    ]);
    if (ban.results.length) return json({error: 'banned'}, 403);
    let name = ''; try { name = newsName(JSON.parse(me.results[0].data).name).slice(0, 24); if (hasBad(name)) name = NAME_STANDIN; } catch (e) { /* no fighter yet */ }
    if (name.length < 2) return json({error: 'no fighter'}, 409); // the chat is for players with a fighter on the ranking
    const r = rate.results[0] || {}; if ((r.c | 0) >= CHAT.perMin || (r.last && now - r.last < CHAT.gap)) return json({error: 'too soon'}, 429);
    const ins = await db.prepare('INSERT INTO chat (t, pid, name, msg) VALUES (?, ?, ?, ?) RETURNING id').bind(now, who, name, msg).first();
    await db.prepare('DELETE FROM chat WHERE id <= (SELECT MAX(id) - ? FROM chat)').bind(CHAT.keep).run();
    return json({ok: true, item: {id: ins.id, t: now, pid: who, name, msg}});
  }
  if (route[0] === 'cup' && route.length === 1) {
    const now = Date.now(), c = cupClock(env, now);
    if (method === 'GET') {
      const list = async k => (await db.prepare('SELECT id, data, at FROM cups WHERE k = ? ORDER BY at, id LIMIT ?').bind(k, CUP.max).all()).results.map(r => ({id: r.id, at: r.at, data: JSON.parse(r.data)}));
      return json({now, gap: c.gap, lead: c.lead, next: {k: c.k, start: c.start, close: c.close, entries: await list(c.k)}, prev: {k: c.k - 1, start: c.prevStart, entries: await list(c.k - 1)}});
    }
    const who = await caller(request, db); if (!who) return json({error: 'forbidden'}, 403);
    if (now >= c.close) return json({error: 'closed', k: c.k}, 409); // the list is closed: what is in it is what fights
    if (method === 'DELETE') { await db.prepare('DELETE FROM cups WHERE k = ? AND id = ?').bind(c.k, who).run(); return json({ok: true, k: c.k}); }
    if (method !== 'POST') return json({error: 'method'}, 405);
    const text = await request.text(); if (text.length > 6000) return json({error: 'too large'}, 413);
    let data; try { data = JSON.parse(text); } catch (e) { return json({error: 'not json'}, 400); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return json({error: 'not an object'}, 400);
    scrubNames(data); // a name everyone sees in the bracket
    await db.batch([
      db.prepare('INSERT INTO cups (k, id, data, at) VALUES (?, ?, ?, ?) ON CONFLICT (k, id) DO UPDATE SET data = excluded.data').bind(c.k, who, JSON.stringify(data), now), // a change keeps the first entry's place in the list
      db.prepare('DELETE FROM cups WHERE k < ?').bind(c.k - 3)
    ]);
    return json({ok: true, k: c.k});
  }
  if (route[0] !== 'db' || route.length < 2 || !route.slice(1).every(s => SEG.test(s))) return json({error: 'not found'}, 404);
  const path = route.slice(1), who = await caller(request, db);
  if (path.length % 2 === 1) { // a collection: list it
    const coll = path.join('/'); if (method !== 'GET') return json({error: 'method'}, 405);
    if (!canRead(who, coll)) return json({error: 'forbidden'}, 403);
    const u = new URL(request.url), order = u.searchParams.get('order'), dir = u.searchParams.get('dir') === 'desc' ? 'DESC' : 'ASC';
    const limit = Math.max(1, Math.min(1000, +u.searchParams.get('limit') || 300));
    const sql = order && FIELD.test(order) ? `SELECT id, data FROM docs WHERE coll = ? ORDER BY json_extract(data, '$.${order}') ${dir} LIMIT ?` : 'SELECT id, data FROM docs WHERE coll = ? ORDER BY id LIMIT ?';
    const {results} = await db.prepare(sql).bind(coll, limit).all(), out = {docs: results.map(r => ({id: r.id, data: JSON.parse(r.data)}))};
    // the world chat and who is online ride along with the list every game asks for anyway (chat=<the last line it has>)
    if (coll === 'challenges' && u.searchParams.has('chat')) { out.chat = {items: await chatSince(db, +u.searchParams.get('chat') || 0)}; out.on = await onlineNow(db); }
    return json(out);
  }
  const coll = path.slice(0, -1).join('/'), id = path[path.length - 1];
  if (method === 'GET') {
    if (!canRead(who, coll)) return json({error: 'forbidden'}, 403);
    const row = await db.prepare('SELECT data FROM docs WHERE coll = ? AND id = ?').bind(coll, id).first();
    return json({id, data: row ? JSON.parse(row.data) : null});
  }
  if (!canWrite(who, coll, id)) return json({error: 'forbidden'}, 403);
  if (method === 'DELETE') { await db.prepare('DELETE FROM docs WHERE coll = ? AND id = ?').bind(coll, id).run(); return json({ok: true}); }
  if (method !== 'PUT') return json({error: 'method'}, 405);
  const text = await request.text(); if (text.length > MAX_BODY) return json({error: 'too large'}, 413);
  let data; try { data = JSON.parse(text); } catch (e) { return json({error: 'not json'}, 400); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return json({error: 'not an object'}, 400);
  if (SHARED.has(coll)) scrubNames(data); // what everyone reads carries no bad word in a name (src/badwords.js)
  await db.prepare('INSERT INTO docs (coll, id, data, updated) VALUES (?, ?, ?, ?) ON CONFLICT (coll, id) DO UPDATE SET data = excluded.data, updated = excluded.updated')
    .bind(coll, id, JSON.stringify(data), Date.now()).run();
  return json({ok: true});
}
