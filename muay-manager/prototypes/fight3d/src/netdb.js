// The game's online store when it runs on its own website instead of inside claude.ai: the same small part of the
// artifact db/user API that game.js uses, talking to the site's /api (functions/api/[[route]].js on Cloudflare Pages).
// Each browser gets a player id and a secret on its first visit, kept in localStorage.
// Returns a stand-in for window.claude ({use(name)}), or null when the site has no API (opened as a plain file).
// spare: the player's key as the save kept it (game.js), used when the stored one is gone and the save is still here,
// so a device keeps its player instead of signing up a new one (seen on Safari, 26 Nov 2026: a new id mid-career)
export async function siteRuntime(base = (typeof window !== 'undefined' && window.MUAY_API) || '/api', spare = null) { // inside the app the shell sets MUAY_API to the game's website
  let skew = 0; // the server's clock minus this device's (ms): players' devices are seldom set to the same second
  try { const t0 = Date.now(), r = await fetch(base + '/health', {cache: 'no-store'}); if (!r.ok) return null; const j = await r.json().catch(() => null); if (j && j.now) skew = Math.round(j.now - (t0 + Date.now()) / 2); } catch (e) { return null; }
  let me = null;
  try { me = JSON.parse(localStorage.getItem('muaySitePlayer')); } catch (e) { /* storage blocked: a new id this visit */ }
  if ((!me || !me.id || !me.secret) && spare && spare.id && spare.secret) { me = {id: spare.id, secret: spare.secret}; try { localStorage.setItem('muaySitePlayer', JSON.stringify(me)); } catch (e) { /* this visit */ } }
  if (!me || !me.id || !me.secret) {
    const r = await fetch(base + '/register', {method: 'POST'}); if (!r.ok) return null;
    me = await r.json();
    try { localStorage.setItem('muaySitePlayer', JSON.stringify(me)); } catch (e) { /* kept for this visit only */ }
  }
  const auth = {Authorization: 'Bearer ' + me.id + '.' + me.secret};
  const url = p => base + '/db/' + p.split('/').map(encodeURIComponent).join('/');
  const fail = r => { throw {code: r.status === 403 ? 'permission_denied' : r.status === 413 ? 'invalid_argument' : 'unavailable'}; };
  // live queries, refreshed at once after this player writes so his own change shows without waiting for the next poll
  const live = new Set(), kick = () => setTimeout(() => live.forEach(f => f()), 150);
  // a rider: more asked for, and more given back, with a list that is polled anyway (the world chat with the challenges)
  const riders = {}, ride = (path, ask, got) => { riders[path] = {ask, got}; };
  const snap = (id, data) => ({id, exists: data != null, data: () => (data == null ? undefined : data)});
  const docRef = path => ({
    async get() { const r = await fetch(url(path), {headers: auth, cache: 'no-store'}); if (r.status === 404) return snap(path.split('/').pop(), null); if (!r.ok) fail(r); const j = await r.json(); return snap(j.id, j.data); },
    // opt.keepalive: the write is allowed to finish after the page has gone (the "I am leaving" note; small bodies only)
    async set(data, opt) { const r = await fetch(url(path), {method: 'PUT', headers: Object.assign({'Content-Type': 'application/json'}, auth), body: JSON.stringify(data), keepalive: !!(opt && opt.keepalive)}); if (!r.ok) fail(r); kick(); },
    async delete() { const r = await fetch(url(path), {method: 'DELETE', headers: auth}); if (!r.ok && r.status !== 404) fail(r); kick(); }
  });
  // a query is read with get(); onSnapshot polls it (more slowly while the tab is hidden)
  const query = (path, ord, lim) => {
    const q = {
      orderBy: (f, dir) => query(path, [f, dir || 'asc'], lim), limit: n => query(path, ord, n), where: () => q,
      doc: id => docRef(path + '/' + id),
      async get() {
        const p = new URLSearchParams(), rd = riders[path]; if (ord) { p.set('order', ord[0]); p.set('dir', ord[1]); } if (lim) p.set('limit', String(lim));
        if (rd) { const more = rd.ask() || {}; for (const k in more) p.set(k, String(more[k])); }
        const r = await fetch(url(path) + '?' + p, {headers: auth, cache: 'no-store'}); if (!r.ok) fail(r);
        const j = await r.json(); if (rd) { try { rd.got(j); } catch (e) { /* the list itself still counts */ } }
        return {docs: j.docs.map(d => snap(d.id, d.data)), docChanges: () => []};
      },
      onSnapshot(next, error) {
        let stop = false, timer = 0, busy = false, again = false; // one read at a time; a refresh asked for mid-read runs right after it
        const tick = async () => {
          if (stop) return; if (busy) { again = true; return; }
          busy = true; clearTimeout(timer);
          try { next(await q.get()); } catch (e) { if (error) error(e); }
          busy = false; if (again) { again = false; return tick(); }
          if (!stop) timer = setTimeout(tick, document.hidden ? 30000 : 8000);
        };
        live.add(tick); tick(); return () => { stop = true; live.delete(tick); clearTimeout(timer); };
      }
    };
    return q;
  };
  const db = {collection: p => query(p), doc: p => docRef(p)};
  const user = {id: async () => me.id, isOwner: () => false, canEdit: () => false};
  // the player himself: a code to move to another device, taking one in, and being forgotten
  const post = async (p, body, withKey) => { const r = await fetch(base + p, {method: 'POST', headers: Object.assign({'Content-Type': 'application/json'}, withKey ? auth : {}), body: JSON.stringify(body || {})}); return r.ok ? r.json() : null; };
  const account = {
    transferCode: () => post('/transfer', null, true),
    async claim(code) { const j = await post('/transfer/claim', {code}); if (!j || !j.id || !j.secret) return false; try { localStorage.setItem('muaySitePlayer', JSON.stringify({id: j.id, secret: j.secret})); } catch (e) { return false; } return true; },
    forget() { try { localStorage.removeItem('muaySitePlayer'); } catch (e) { /* a new id next visit anyway */ } }, // this device lets go of a player it can no longer open
    async remove() { const r = await fetch(base + '/me', {method: 'DELETE', headers: auth}); if (!r.ok) return false; try { localStorage.removeItem('muaySitePlayer'); } catch (e) { /* gone with the page */ } return true; }
  };
  // any other call to the site's API as this player (the players' cup): the answer as JSON with its status, or null when the site cannot be reached
  const call = async (p, method, body) => { try { const r = await fetch(base + p, {method: method || 'GET', cache: 'no-store', headers: Object.assign(body ? {'Content-Type': 'application/json'} : {}, auth), body: body ? JSON.stringify(body) : undefined}); const j = await r.json().catch(() => null); return j ? Object.assign(j, {status: r.status}) : null; } catch (e) { return null; } };
  return {skew, site: true, key: {id: me.id, secret: me.secret}, account, call, ride, use: async name => (name === 'db' ? db : name === 'user' ? user : null)};
}
