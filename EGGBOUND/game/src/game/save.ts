// SaveService: local only in P0 (swap for a server-backed implementation in P2).
import { STARTERS } from '../core/data';
import type { EggTier } from '../core/data';

export interface MonSave { lvl: number; exp: number; stars: number; rare?: boolean }
/** named = species known (crafted / starter) · mystery = species hidden until hatch, tier = shell pattern.
 *  sid and rare are rolled when the egg is created, so reloading can't re-roll a hatch. */
export interface EggSave { id: number; sid: string; kind: 'named' | 'mystery'; tier?: EggTier; rare?: boolean }
export interface SaveData {
  v: 1;
  gold: number;
  mons: Record<string, MonSave>;
  team: string[];
  eggs: EggSave[];
  eggPity: number;                  // mystery eggs in a row without gold+
  frags: Record<string, number>;
  stages: Record<string, number>;   // best stars per stage
  nextEggId: number;
  settings: { sound: boolean; quality: 'low' | 'mid' | 'high'; skipUlt: boolean; speed: number; auto: boolean };
}
const KEY = 'eggbound-p0-save';

export function newSave(): SaveData {
  const mons: Record<string, MonSave> = {};
  for (const sid of STARTERS) mons[sid] = { lvl: 5, exp: 0, stars: 1 };
  return { v: 1, gold: 500, mons, team: ['A01', 'A02', 'A03', 'A04'], eggs: [{ id: 1, sid: 'A01', kind: 'named' }], eggPity: 0, frags: {}, stages: {}, nextEggId: 2,
    settings: { sound: true, quality: 'high', skipUlt: false, speed: 1, auto: false } };
}
export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.v === 1) {
        const d: SaveData = Object.assign(newSave(), s);
        for (const e of d.eggs) if (!e.kind) e.kind = 'named'; // P0 eggs were all species-known
        return d;
      }
    }
  } catch (e) { /* storage unavailable */ }
  return newSave();
}
export function writeSave(s: SaveData) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ } }
export function resetSave(): SaveData { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } return newSave(); }
