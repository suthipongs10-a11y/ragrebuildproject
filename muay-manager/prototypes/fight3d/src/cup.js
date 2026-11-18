// The players' cup: a knockout tournament between players' fighters at a fixed time every week.
// The server keeps the clock and the list of entries and closes the list before the first bell (functions/api: /api/cup).
// From that list every screen builds the same bracket and works out the same bouts: the draw comes from the cup's
// number, the bouts are deterministic, nobody's plan changes once the list is closed. Places left empty are filled with
// the game's own fighters. No DOM here.
import { simulate } from './sim.js';
import { cleanPlan, cleanSpec, matchCfg, STAT_KEYS } from './match.js';
import { LIVE } from './data.js';

export const CUP_VENUE = 'stadium', CUP_MIN = 2;
export const hash = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const NO_DRAW = {noDraw: true}; // every bout needs a winner
const side = e => ({name: e.name, spec: e.spec, plans: [e.plan]});

// entries: [{id, at, data: {name, body, look, spec, plan, rp}}] as the server lists them.
// filler(seed, total) -> one of the game's own fighters {name, style, body, look, stats}; rng(seed) -> () => 0..1; name(v) cleans a name.
// -> {k, held, n, ents: [{id, name, spec, plan, look, body, rp, bot}], rounds: [[index…]…], res: [[{a, b, w, how, seed, pts}]…], champ}
export function buildCup(k, entries, filler, rng, name) {
  const real = (entries || []).filter(e => e && e.id && e.data && typeof e.data === 'object').sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1)).slice(0, 16).map(e => {
    const n = name(e.data.name) || 'นักมวย';
    return {id: e.id, name: n, spec: cleanSpec(e.data.spec, n), plan: cleanPlan(e.data.plan), look: e.data.look, body: e.data.body, rp: Math.round(+e.data.rp) || 1000};
  });
  if (real.length < CUP_MIN) return {k, held: false, n: 0, ents: real, rounds: [], res: [], champ: null};
  const n = real.length <= 8 ? 8 : 16, seed = hash('cup' + k), R = rng(seed), ents = real.slice();
  const avg = real.reduce((a, e) => a + STAT_KEYS.reduce((x, s) => x + e.spec.stats[s], 0), 0) / real.length;
  for (let i = real.length; i < n; i++) { // the game's own fighters, about as strong as the players' ones
    const f = filler(seed + 7919 * (i + 1), avg * (.9 + .14 * R()));
    ents.push({id: null, bot: true, name: f.name, spec: cleanSpec({style: f.style, stats: f.stats, sp: f.sp}, f.name), plan: cleanPlan(f.plan), look: f.look, body: f.body, rp: 0});
  }
  for (let i = ents.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [ents[i], ents[j]] = [ents[j], ents[i]]; } // the draw
  const rounds = [ents.map((e, i) => i)], res = [];
  for (let r = 0; rounds[r].length > 1; r++) {
    const list = rounds[r], out = [], next = [];
    for (let i = 0; i < list.length; i += 2) {
      const a = list[i], b = list[i + 1], s = hash('cup' + k + ':' + r + ':' + i);
      const f = simulate(matchCfg(s, [side(ents[a]), side(ents[b])], CUP_VENUE, NO_DRAW)).result, w = f.w ? b : a;
      out.push({a, b, w, how: f.how === 'คะแนน' ? 'คะแนน' : f.how + ' ยก ' + f.round, seed: s, pts: f.pts}); next.push(w);
    }
    res.push(out); rounds.push(next);
  }
  return {k, held: true, n, ents, rounds, res, champ: rounds[rounds.length - 1][0]};
}
// How far an entrant got: 0 champion, 1 lost the final, 2 lost a semi-final, 3 went out earlier; -1 not in it
export function cupPlace(cup, id) {
  if (!cup.held) return -1; const i = cup.ents.findIndex(e => e.id === id); if (i < 0) return -1;
  if (cup.champ === i) return 0;
  for (let r = cup.res.length - 1; r >= 0; r--) if (cup.res[r].some(x => (x.a === i || x.b === i) && x.w !== i)) return Math.min(3, cup.res.length - r);
  return 3;
}
// When each round is on, for a cup that starts at `start` with rounds `gap` apart (ms): a bout is live for as long as a
// live match lasts (or until the next round, if that comes sooner), and its result is known on the bracket after that.
export const cupTimes = (cup, start, gap) => { const len = Math.min(gap, LIVE.matchLen * 1e3); return cup.res.map((x, r) => ({start: start + r * gap, end: start + r * gap + len})); };
// The bout as a match the game can show (the same shape as a challenge match)
export function cupMatch(cup, r, i, start) {
  const x = cup.res[r][i], A = cup.ents[x.a], B = cup.ents[x.b], sd = (e, more) => Object.assign({spec: e.spec, plan: e.plan, look: e.look, body: e.body}, more);
  return {key: 'cup:' + cup.k + ':' + r + ':' + i, cup: true, exh: true, noDraw: true, from: A.id || 'x', to: B.id || 'y', e: sd(A, {seed: x.seed, venue: CUP_VENUE}), a: sd(B, {accept: true}), start, fromName: A.name, toName: B.name, venue: CUP_VENUE};
}
