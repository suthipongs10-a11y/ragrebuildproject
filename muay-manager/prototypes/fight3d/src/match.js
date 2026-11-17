// What a match between two players is worked out from. Shared by the game in the browser (game.js) and by the server
// (functions/api), so both clean what a player sends the same way and get the same fight from it.
// Nothing here touches the page, the clock or a random number.
import { PLAN, STYLES, VENUE_RULES, LIVE, SPECIALS, SP_MAX } from './data.js';

export const STAT_KEYS = ['pow', 'kick', 'spd', 'def', 'end', 'chin'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// is v one of the names in this table? (a string that is the table's own key: 'constructor' or ['attack'] is not)
export const own = (map, v) => typeof v === 'string' && Object.prototype.hasOwnProperty.call(map, v);

// A corner's plan as sent by a player: anything that is not one of the choices becomes the default
export const cleanPlan = p => { p = p || {}; return {ag: own(PLAN.ag, p.ag) ? p.ag : 'balanced', range: own(PLAN.range, p.range) ? p.range : 'mixed', target: own(PLAN.target, p.target) ? p.target : 'mixed'}; };
// stats as sent by a player: whole numbers from 20 to 100, 40 where one is missing
export function cleanStats(st) { const o = {}; STAT_KEYS.forEach(k => { o[k] = clamp(Math.round(+(st && st[k]) || 40), 20, 100); }); return o; }
// a fighter as sent by a player: a known style, cleaned stats, at most three known signature moves at levels 1..SP_MAX
export function cleanSpec(sp, name) {
  sp = sp || {}; const lv = {}; for (const k of SPECIALS) if (sp.spLv && sp.spLv[k]) lv[k] = clamp(Math.round(+sp.spLv[k]) || 1, 1, SP_MAX);
  return {name, first: name, style: STYLES.some(s => s.id === sp.style) ? sp.style : 'tech', stats: cleanStats(sp.stats), skin: 0, sp: (Array.isArray(sp.sp) ? sp.sp : []).filter(k => SPECIALS.includes(k)).slice(0, 3), spLv: lv};
}
// The input of simulate() for a match. sides: [{name, spec, plans: [round 1, round 2?, round 3?]}, ...] (challenger
// first). A round with no plan of its own keeps the plan of the round before.
export function matchCfg(seed, sides, venue) {
  const rounds = x => { const p = Array.isArray(x.plans) ? x.plans : [], p1 = cleanPlan(p[0]), p2 = p[1] ? cleanPlan(p[1]) : p1, p3 = p[2] ? cleanPlan(p[2]) : p2; return [p1, p2, p3]; };
  return {seed: (seed >>> 0) || 1, specs: sides.map(x => cleanSpec(x.spec, x.name)), plans: sides.map(rounds), rules: own(VENUE_RULES, venue) ? VENUE_RULES[venue] : null};
}
// When each rest of a live match starts, in seconds after its bell on the shared clock (the rests before it included).
// The rest after round n is restWalls(fight)[n - 1]; it lasts LIVE.rest seconds.
export function restWalls(fight) {
  const out = []; for (const e of fight.events) if (e.type === 'phase' && e.phase === 'rest') out.push(e.t + LIVE.cornerIn + out.length * LIVE.rest);
  return out;
}
