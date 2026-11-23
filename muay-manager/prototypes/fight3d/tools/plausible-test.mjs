// The server's plausibility guard (functions/api/[[route]].js): what a player may and may not write to the ranking, a
// challenge and the cup. Talks to a running server (server/server.mjs) on a database of its own; leaves test players
// in it (use a throw-away database).   usage: node tools/plausible-test.mjs [http://127.0.0.1:8788]
const BASE = (process.argv[2] || 'http://127.0.0.1:8788') + '/api';
let bad = 0, n = 0;
const ok = (c, what, got) => { n++; if (!c) bad++; console.log((c ? 'ok   ' : 'FAIL ') + what + (got !== undefined ? ' → ' + got : '')); };
const call = async (path, method = 'GET', body, key) => {
  const r = await fetch(BASE + path, {method, headers: Object.assign({'Content-Type': 'application/json'}, key ? {Authorization: 'Bearer ' + key} : {}), body: body ? JSON.stringify(body) : undefined});
  let j = null; try { j = await r.json(); } catch (e) { /* none */ } return {status: r.status, j};
};
const player = async () => { const {j} = await call('/register', 'POST'); return {id: j.id, key: j.id + '.' + j.secret}; };
const stats = v => ({pow: v, kick: v, spd: v, def: v, end: v, chin: v}); // src/game.js KEYS
const line = (o = {}) => Object.assign({name: 'ทดสอบ ' + Math.random().toString(36).slice(2, 6), rp: 1000, w: 0, l: 0, d: 0, ko: 0, body: 'c', style: 'tech', look: {}, stats: stats(50), t: Date.now(), seen: Date.now(), in: '', vip: false, tag: ''}, o);
const put = (p, coll, data) => call('/db/' + coll + '/' + p.id, 'PUT', data, p.key);

// ---- the ranking line
const a = await player();
ok((await put(a, 'board', line())).status === 200, 'a new fighter\'s line is taken');
ok((await put(a, 'board', line({w: 2, ko: 1, rp: 1050}))).status === 200, 'two wins and +50 rating are taken');
let r = await put(a, 'board', line({w: 3, ko: 1, rp: 1200}));
ok(r.status === 422, 'one more win worth +150 rating is refused', r.j && r.j.why);
r = await put(a, 'board', line({w: 200, ko: 1, rp: 1050}));
ok(r.status === 422, 'two hundred wins at once are refused', r.j && r.j.why);
r = await put(a, 'board', line({w: 2, ko: 1, rp: 1050, stats: Object.assign(stats(50), {pow: 99})}));
ok(r.status === 422, 'a stat over the camp\'s cap (97) is refused', r.j && r.j.why);
r = await put(a, 'board', line({w: 1, ko: 1, rp: 1020}));
ok(r.status === 422, 'a record that goes back is refused', r.j && r.j.why);
r = await put(a, 'board', line({w: 2, ko: 3, rp: 1050}));
ok(r.status === 422, 'more knockouts than wins are refused', r.j && r.j.why);
ok((await put(a, 'board', line({w: 3, l: 1, ko: 2, rp: 1070, stats: stats(97)}))).status === 200, 'a win and a loss more, stats at the cap: taken');
// deleting the line does not wipe what was allowed
await call('/db/board/' + a.id, 'DELETE', null, a.key);
r = await put(a, 'board', line({w: 60, ko: 1, rp: 2900}));
ok(r.status === 422, 'deleted and written again with sixty wins: still refused', r.j && r.j.why);
ok((await put(a, 'board', line())).status === 200, 'starting over with a new fighter (nothing, 1000) is taken');
r = await put(a, 'board', line({w: 40, ko: 1, rp: 2000}));
ok(r.status === 422, 'and the new fighter cannot jump ahead either', r.j && r.j.why);
const list = (await call('/db/board?order=rp&dir=desc&limit=50')).j.docs, mine = list.find(d => d.id === a.id);
ok(mine && mine.data.rp === 1000, 'the ranking shows the last line that was taken', mine && mine.data.rp);

// ---- a challenge: the stats carried are the line's (good mood +4%, a little slack)
const b = await player(); await put(b, 'board', line({stats: stats(60)}));
const ch = (v, extra) => ({list: Object.assign({[a.id]: {toName: 'x', time: Date.now() + 60e3, seed: 5, venue: 'stadium', spec: {name: 'b', stats: stats(v), style: 'tech'}, plan: {}, created: Date.now()}}, extra || {})});
ok((await put(b, 'challenges', ch(63))).status === 200, 'a challenge with the line\'s stats (and a good day) is taken');
r = await put(b, 'challenges', ch(90));
ok(r.status === 422, 'a challenge with stats far over the line is refused', r.j && r.j.why);
ok((await put(b, 'answers', {list: {[a.id]: {accept: true, at: Date.now(), seed: 5, spec: {stats: stats(61)}}}})).status === 200, 'an answer with the line\'s stats is taken');
r = await put(b, 'answers', {list: {[a.id]: {accept: true, at: Date.now(), seed: 5, spec: {stats: stats(99)}}}});
ok(r.status === 422, 'an answer with stats far over the line is refused', r.j && r.j.why);

// ---- the cup
const cup = v => ({name: 'b', body: 'c', look: {}, spec: {style: 'tech', stats: stats(v), sp: [], spLv: {}}, plan: {}, rp: 1000});
const c1 = await call('/cup', 'POST', cup(60), b.key);
ok(c1.status === 200 || (c1.status === 409 && c1.j.error === 'closed'), 'a cup entry with the line\'s stats is taken (or the list is closed)', c1.status);
if (c1.status === 200) { r = await call('/cup', 'POST', cup(95), b.key); ok(r.status === 422, 'a cup entry with stats over the line is refused', r.j && r.j.why); }

// ---- the reasons are kept for the owner (tools/rank-admin.mjs refused)
console.log(bad ? `${bad} of ${n} checks FAILED` : `all ${n} checks passed`);
process.exit(bad ? 1 : 0);
