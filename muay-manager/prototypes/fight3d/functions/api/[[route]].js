// Muay Manager's own small store, for the game when it runs on its own website (Cloudflare Pages Functions + D1).
// The browser side is src/netdb.js. Each player gets an id and a secret on first visit (POST /api/register).
// Anyone may read the shared collections; a player writes only his own document in them (document id = his id)
// and only his own private folder data/users/<his id>/.
//   GET  /api/health                      -> {ok}
//   POST /api/register                    -> {id, secret}
//   GET  /api/db/<collection>?order=&dir=&limit=   -> {docs: [{id, data}]}
//   GET  /api/db/<collection>/<doc>       -> {id, data} (data null when there is no such document)
//   PUT  /api/db/<collection>/<doc>       body: JSON object -> {ok}
//   DELETE /api/db/<collection>/<doc>     -> {ok}
//   POST /api/log                         body: {msg, ver, page} -> {ok}   errors from players' browsers, the last 1000 kept
const SHARED = new Set(['board', 'challenges', 'answers']);
const SEG = /^[A-Za-z0-9_\-.~:@+]{1,200}$/, FIELD = /^[A-Za-z0-9_]{1,40}$/, MAX_BODY = 256 * 1024;
const json = (data, status = 200) => new Response(JSON.stringify(data), {status, headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}});
let ready = false;
async function schema(db) {
  if (ready) return;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, secret_hash TEXT NOT NULL, created INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS docs (coll TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated INTEGER NOT NULL, PRIMARY KEY (coll, id))'),
    db.prepare('CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER NOT NULL, ua TEXT, ver TEXT, msg TEXT)')
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
  const db = env.DB; if (!db) return json({error: 'no database bound as DB'}, 500);
  await schema(db);
  const dec = x => { try { return decodeURIComponent(x); } catch (e) { return ''; } }, route = [].concat(params.route || []).map(dec), method = request.method;
  if (route[0] === 'health') return json({ok: true});
  if (route[0] === 'log' && method === 'POST') {
    const text = (await request.text()).slice(0, 4000); let d = {}; try { d = JSON.parse(text) || {}; } catch (e) { d = {msg: text}; }
    const cut = (v, n) => String(v == null ? '' : v).slice(0, n);
    await db.batch([
      db.prepare('INSERT INTO logs (t, ua, ver, msg) VALUES (?, ?, ?, ?)').bind(Date.now(), cut(request.headers.get('User-Agent'), 200), cut(d.ver, 40), cut(d.msg, 3000)),
      db.prepare('DELETE FROM logs WHERE id <= (SELECT MAX(id) - 1000 FROM logs)')
    ]);
    return json({ok: true});
  }
  if (route[0] === 'register' && method === 'POST') {
    const id = 'p_' + rand(10), secret = rand(32);
    await db.prepare('INSERT INTO players (id, secret_hash, created) VALUES (?, ?, ?)').bind(id, await sha256(secret), Date.now()).run();
    return json({id, secret});
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
