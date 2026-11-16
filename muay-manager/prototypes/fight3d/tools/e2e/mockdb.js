// In-memory stand-in for the artifact runtime's db and user, for checks of the online challenge flow.
(() => {
  const store = {}, subs = [];
  const now = Date.now(), look = {shorts: 'blue', trim: 'white', pattern: 'plain', gloves: 'blue', head: 'none', hair: 'natural'};
  store['board/other1'] = {name: 'คู่แข่ง ออนไลน์', rp: 1010, w: 3, l: 2, ko: 1, body: 'h', style: 'kicker', look, stats: {pow: 45, kick: 58, spd: 50, def: 44, end: 45, chin: 42}, t: now};
  store['challenges/other1'] = {name: 'คู่แข่ง ออนไลน์', list: {me: {toName: 'เพชรนาคา', time: now + 120e3, seed: 4242, venue: 'stadium', spec: {style: 'kicker', stats: {pow: 45, kick: 58, spd: 50, def: 44, end: 45, chin: 42}, sp: ['spKick'], spLv: {spKick: 2}}, look, body: 'h', plan: {ag: 'attack', range: 'mixed', target: 'mixed'}, created: now}}};
  const snapDoc = (p) => ({id: p.split('/').pop(), exists: p in store, data: () => store[p] && JSON.parse(JSON.stringify(store[p]))});
  const coll = (cp) => Object.keys(store).filter(p => p.startsWith(cp + '/') && p.split('/').length === cp.split('/').length + 1);
  const fire = () => subs.forEach(s => s.next({docs: coll(s.path).map(snapDoc), docChanges: () => []}));
  const docRef = (p) => ({get: async () => snapDoc(p), set: async (d) => { store[p] = JSON.parse(JSON.stringify(d)); setTimeout(fire, 10); }, update: async (d) => { store[p] = Object.assign(store[p] || {}, d); setTimeout(fire, 10); }, delete: async () => { delete store[p]; setTimeout(fire, 10); }});
  const query = (path, ord, lim) => ({orderBy: (f, dir) => query(path, [f, dir], lim), limit: (n) => query(path, ord, n), where: () => query(path, ord, lim),
    get: async () => { let d = coll(path).map(snapDoc); if (ord) d.sort((a, b) => (b.data()[ord[0]] - a.data()[ord[0]]) * (ord[1] === 'desc' ? 1 : -1)); return {docs: d.slice(0, lim || 999)}; },
    onSnapshot: (next) => { const s = {path, next}; subs.push(s); setTimeout(() => next({docs: coll(path).map(snapDoc), docChanges: () => []}), 20); return () => {}; },
    doc: (id) => docRef(path + '/' + id)});
  const db = {collection: (p) => query(p), doc: (p) => docRef(p)};
  window.__mock = {store, fire};
  window.claude = {use: async (n) => n === 'db' ? db : n === 'user' ? {id: async () => 'me', isOwner: () => true} : null};
})();
