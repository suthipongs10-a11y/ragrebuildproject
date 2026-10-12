// SaveService: local only in P0 (swap for a server-backed implementation in P2).
import { STARTERS, natStars, SPECIES, levelCap } from '../core/data';
import type { EggTier } from '../core/data';

/** one owned monster (SW style: copies are separate units — food for skill-ups and evolution). sk = skill levels */
export interface MonSave { uid: number; sid: string; lvl: number; exp: number; stars: number; sk: number[]; rare?: boolean }
/** named = species known (crafted / starter) · mystery = species hidden until hatch, tier = shell pattern.
 *  sid and rare are rolled when the egg is created, so reloading can't re-roll a hatch. */
export interface EggSave { id: number; sid: string; kind: 'named' | 'mystery'; tier?: EggTier; rare?: boolean }
export interface SaveData {
  v: 2;
  gold: number;
  mons: MonSave[];
  team: number[];                   // monster uids, leader first
  nextUid: number;
  items: { soul: number };          // soul crystal: +1 skill level on any monster
  dex: string[];                    // species ever obtained (monster book) — kept even after a unit is used as food
  eggs: EggSave[];
  eggPity: number;                  // mystery eggs in a row without gold+
  frags: Record<string, number>;
  stages: Record<string, number>;   // best stars per stage
  nextEggId: number;
  settings: { sound: boolean; quality: 'low' | 'mid' | 'high'; skipUlt: boolean; speed: number; auto: boolean };
}
const KEY = 'eggbound-p0-save';

export const newMon = (uid: number, sid: string, lvl = 1, stars = natStars(sid), rare = false): MonSave =>
  ({ uid, sid, lvl, exp: 0, stars, sk: [1, 1, 1], ...(rare ? { rare } : {}) });
export function newSave(): SaveData {
  const mons = STARTERS.map((sid, i) => newMon(i + 1, sid, 5, 1));
  return { v: 2, gold: 500, mons, team: [1, 2, 3, 4], nextUid: mons.length + 1, items: { soul: 0 }, dex: [...STARTERS], eggs: [{ id: 1, sid: 'A01', kind: 'named' }], eggPity: 0, frags: {}, stages: {}, nextEggId: 2,
    settings: { sound: true, quality: 'high', skipUlt: false, speed: 1, auto: false } };
}
export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && (s.v === 1 || s.v === 2)) {
        if (s.v === 1) migrateV1(s);
        const d: SaveData = Object.assign(newSave(), s);
        for (const e of d.eggs) if (!e.kind) e.kind = 'named'; // P0 eggs were all species-known
        d.mons = d.mons.filter(m => SPECIES[m.sid]);
        for (const m of d.mons) { m.stars = Math.max(m.stars, natStars(m.sid)); m.sk ||= [1, 1, 1]; m.lvl = Math.min(m.lvl, levelCap(m.stars)); } // level caps per star (SW) // natural stars by rarity (2026-10-12)
        d.dex = [...new Set([...(d.dex || []), ...d.mons.map(m => m.sid)])]; // monster book: everything owned counts as seen
        const seen = new Set<string>(); // team rule: one per species (older saves could hold copies)
        d.team = d.team.filter(u => { const m = d.mons.find(x => x.uid === u); if (!m || seen.has(m.sid)) return false; seen.add(m.sid); return true; });
        return d;
      }
    }
  } catch (e) { /* storage unavailable */ }
  return newSave();
}
/** v1 kept one entry per species ({sid: {lvl,exp,stars}}) and a team of species ids → v2 units with uids */
function migrateV1(s: any) {
  const mons: MonSave[] = []; let uid = 1; const map: Record<string, number> = {};
  for (const sid of Object.keys(s.mons || {})) { const m = s.mons[sid]; map[sid] = uid; mons.push({ uid: uid++, sid, lvl: m.lvl, exp: m.exp || 0, stars: Math.min(6, m.stars || 1), sk: [1, 1, 1], ...(m.rare ? { rare: true } : {}) }); }
  s.mons = mons; s.team = (s.team || []).map((sid: string) => map[sid]).filter(Boolean); s.nextUid = uid; s.items = { soul: 0 }; s.v = 2;
}
export function writeSave(s: SaveData) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ } }
export function resetSave(): SaveData { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } return newSave(); }
