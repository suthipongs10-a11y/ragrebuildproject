// Runes in the save: drops, equip / unequip, upgrades (gold), selling, the starter gift. Numbers live in core/runes.ts.
import type { SaveData } from './save';
import type { StageDef } from '../core/types';
import { ZONES } from '../core/data';
import { RUNE_DROP, RUNE_MAX_LVL, rollRune, runeBonus, runeSellPrice, runeUpCost, runeOffCost, upgradeRune, type Rune, type RuneBonus, type RuneSlot } from '../core/runes';

export const RUNE_CAP = 300; // inventory size (drops stop at the cap; sell to make room)
export const runesOf = (s: SaveData, uid: number) => s.runes.filter(r => r.on === uid).sort((a, b) => a.slot - b.slot);
export const runeBonusOf = (s: SaveData, uid: number): RuneBonus | undefined => { const rs = runesOf(s, uid); return rs.length ? runeBonus(rs) : undefined; };
export const runeById = (s: SaveData, id: number) => s.runes.find(r => r.id === id);

/** what putting rune `id` on monster `uid` takes off (paid): the rune itself if another monster wears it, and the rune
 *  already in that slot. An empty slot with a rune from the bag is free. */
export function equipCost(s: SaveData, id: number, uid: number): { gold: number; off: Rune[] } {
  const r = runeById(s, id); if (!r) return { gold: 0, off: [] };
  const off = [...(r.on && r.on !== uid ? [r] : []), ...s.runes.filter(x => x.on === uid && x.slot === r.slot && x !== r)];
  return { gold: off.reduce((t, x) => t + runeOffCost(x), 0), off };
}
/** put a rune on a monster, paying for every rune that comes off (false = not enough gold) */
export function equipRune(s: SaveData, id: number, uid: number): boolean {
  const r = runeById(s, id); if (!r || !s.mons.some(m => m.uid === uid)) return false;
  const c = equipCost(s, id, uid); if (s.gold < c.gold) return false;
  s.gold -= c.gold; for (const x of c.off) if (x !== r) delete x.on;
  r.on = uid; return true;
}
/** take a rune off into the bag: costs runeOffCost (false = not worn / not enough gold) */
export function unequipRune(s: SaveData, id: number): boolean {
  const r = runeById(s, id); if (!r || !r.on) return false;
  const g = runeOffCost(r); if (s.gold < g) return false;
  s.gold -= g; delete r.on; return true;
}
/** runes on monsters that no longer exist (eaten as evolve / skill / level food) go back to the bag */
export function freeRunes(s: SaveData) { for (const r of s.runes) if (r.on && !s.mons.some(m => m.uid === r.on)) delete r.on; }

/** one paid attempt: false = not enough gold / already max */
export function tryUpgrade(s: SaveData, id: number, rnd: () => number = Math.random) {
  const r = runeById(s, id); if (!r || r.lvl >= RUNE_MAX_LVL) return null;
  const cost = runeUpCost(r); if (s.gold < cost) return null;
  s.gold -= cost; s.stats.runeUp++;
  return { cost, ...upgradeRune(r, rnd) };
}
export function sellRune(s: SaveData, id: number): number {
  const r = runeById(s, id); if (!r) return 0;
  const g = runeSellPrice(r); s.gold += g; s.runes = s.runes.filter(x => x !== r); return g;
}
export function addRune(s: SaveData, r: Rune): Rune { r.id = s.nextRuneId++; s.runes.push(r); return r; }

/** stage drops: one roll per win (boss stages two), first clear always drops one */
export function dropRunes(s: SaveData, st: StageDef, first: boolean, boss: boolean, rnd: () => number): Rune[] {
  const d = st.diff || 0, realm = ZONES.find(z => z.id === st.zone)?.realm || '1', out: Rune[] = [];
  for (let i = 0; i < (boss ? 2 : 1); i++) {
    if (s.runes.length >= RUNE_CAP) break;
    if (!(first && i === 0) && rnd() >= RUNE_DROP.chance[d]) continue;
    const star = (RUNE_DROP.realmStar[realm] || 1) + (rnd() < 0.5 ? 1 : 0) + d;
    out.push(addRune(s, rollRune(rnd, star, RUNE_DROP.gradeW[d])));
  }
  return out;
}
/** the first look at runes: a small set so the tab is never empty (2 × fang + 2 × vital, ★2 rare) */
export function runeGift(s: SaveData) {
  if (s.runeGift) return; s.runeGift = true;
  const mk = (slot: RuneSlot, set: Rune['set'], main: Rune['main'], sub: Rune['subs'][number]): Rune => ({ id: 0, slot, set, grade: 'rare', star: 2, lvl: 0, main, subs: [sub] });
  for (const r of [mk(1, 'fang', 'atk', { k: 'crit', v: 2 }), mk(2, 'fang', 'hp', { k: 'atkP', v: 3 }), mk(3, 'vital', 'hpP', { k: 'spd', v: 2 }), mk(4, 'vital', 'cdmg', { k: 'hp', v: 40 })]) addRune(s, r);
}
