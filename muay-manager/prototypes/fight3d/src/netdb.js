// The game's online store when it runs on its own website instead of inside claude.ai: the same small part of the
// artifact db/user API that game.js uses, talking to the site's /api (functions/api/[[route]].js on Cloudflare Pages).
// Each browser gets a player id and a secret on its first visit, kept in localStorage.
// Returns a stand-in for window.claude ({use(name)}), or null when the site has no API (opened as a plain file).
export async function siteRuntime(base = '/api') {
  try { const r = await fetch(base + '/health', {cache: 'no-store'}); if (!r.ok) return null; } catch (e) { return null; }
  let me = null;
  try { me = JSON.parse(localStorage.getItem('muaySitePlayer')); } catch (e) { /* storage blocked: a new id this visit */ }
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
  const snap = (id, data) => ({id, exists: data != null, data: () => (data == null ? undefined : data)});
  const docRef = path => ({
    async get() { const r = await fetch(url(path), {headers: auth, cache: 'no-store'}); if (r.status === 404) return snap(path.split('/').pop(), null); if (!r.ok) fail(r); const j = await r.json(); return snap(j.id, j.data); },
    async set(data) { const r = await fetch(url(path), {method: 'PUT', headers: Object.assign({'Content-Type': 'application/json'}, auth), body: JSON.stringify(data)}); if (!r.ok) fail(r); kick(); },
    async delete() { const r = await fetch(url(path), {method: 'DELETE', headers: auth}); if (!r.ok && r.status !== 404) fail(r); kick(); }
  });
  // a query is read with get(); onSnapshot polls it (more slowly while the tab is hidden)
  const query = (path, ord, lim) => {
    const q = {
      orderBy: (f, dir) => query(path, [f, dir || 'asc'], lim), limit: n => query(path, ord, n), where: () => q,
      doc: id => docRef(path + '/' + id),
      async get() {
        const p = new URLSearchParams(); if (ord) { p.set('order', ord[0]); p.set('dir', ord[1]); } if (lim) p.set('limit', String(lim));
        const r = await fetch(url(path) + '?' + p, {headers: auth, cache: 'no-store'}); if (!r.ok) fail(r);
        const j = await r.json(); return {docs: j.docs.map(d => snap(d.id, d.data)), docChanges: () => []};
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
  return {use: async name => (name === 'db' ? db : name === 'user' ? user : null)};
}
