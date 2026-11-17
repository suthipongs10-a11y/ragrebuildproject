// A stand-in for Cloudflare D1 on Node's own SQLite (node:sqlite), with just the calls the API handler makes:
// prepare(sql).bind(...).first() / .all() / .run(), and batch([...]) as one transaction.
import { DatabaseSync } from 'node:sqlite';

export function openDb(file) {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000;');
  const cache = new Map();
  // prepared on first use, not when asked for: the handler builds its statements before its tables exist
  const stmt = sql => { let s = cache.get(sql); if (!s) { s = db.prepare(sql); cache.set(sql, s); } return s; };
  const run = (sql, args) => { const r = stmt(sql).run(...args); return {success: true, meta: {changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid)}}; };
  const all = (sql, args) => ({success: true, results: stmt(sql).all(...args)});
  const make = (sql, args) => ({
    sql, args,
    bind: (...a) => make(sql, a),
    first: async () => stmt(sql).get(...args) ?? null,
    all: async () => all(sql, args),
    run: async () => run(sql, args)
  });
  return {
    prepare: sql => make(sql, []),
    // nothing else runs between BEGIN and COMMIT: the calls below are synchronous
    batch: async list => {
      db.exec('BEGIN IMMEDIATE');
      try { const out = list.map(q => /^\s*(select|with)\b/i.test(q.sql) ? all(q.sql, q.args) : run(q.sql, q.args)); db.exec('COMMIT'); return out; }
      catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    // a whole copy of the database in one file, safe to take while the server runs
    backupTo: to => { db.exec("VACUUM INTO '" + String(to).replace(/'/g, "''") + "'"); },
    close: () => { cache.clear(); db.close(); }
  };
}
