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
    db.prepare('CREATE TABLE IF NOT EXISTS cups (k INTEGER NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (k, id))')
  ]);
  ready = true;
}
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
      db.prepare("DELETE FROM logs WHERE id <= (SELECT MAX(id) - 1000 FROM logs) AND msg NOT LIKE 'FEEDBACK %'"),
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
      db.prepare('DELETE FROM transfers WHERE id = ?').bind(who), db.prepare('DELETE FROM cups WHERE id = ?').bind(who), db.prepare('DELETE FROM players WHERE id = ?').bind(who)
    ]);
    return json({ok: true});
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
    const {results} = await db.prepare(sql).bind(coll, limit).all();
    return json({docs: results.map(r => ({id: r.id, data: JSON.parse(r.data)}))});
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
  await db.prepare('INSERT INTO docs (coll, id, data, updated) VALUES (?, ?, ?, ?) ON CONFLICT (coll, id) DO UPDATE SET data = excluded.data, updated = excluded.updated')
    .bind(coll, id, JSON.stringify(data), Date.now()).run();
  return json({ok: true});
}
