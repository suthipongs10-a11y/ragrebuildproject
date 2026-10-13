// Energy (พลังงาน): only AUTO battles cost it — playing by hand is always free (owner's rule, 2026-10-13).
// Stored as a value + the time it was last settled; it refills one point every ENERGY_REGEN_MS up to ENERGY_MAX
// (offline too). An AUTO battle pays its stage's energy cost once, the first time AUTO is switched on in that fight.
// Gems can refill it a few times per local day (ENERGY_REFILL_DAILY).
import { ENERGY_MAX, ENERGY_REGEN_MS, ENERGY_REFILL_GEMS, ENERGY_REFILL_DAILY } from '../core/data';
import { dayKey } from './quests';
import type { StageDef } from '../core/types';
import type { SaveData } from './save';

/** bring the stored value up to date (whole points only; the partial point keeps ticking) */
function settle(s: SaveData, now: number) {
  const e = s.energy;
  if (e.v >= ENERGY_MAX) { e.t = now; return; }
  const gained = Math.floor(Math.max(0, now - e.t) / ENERGY_REGEN_MS);
  if (e.v + gained >= ENERGY_MAX) { e.v = ENERGY_MAX; e.t = now; } else { e.v += gained; e.t += gained * ENERGY_REGEN_MS; }
}
export function energyNow(s: SaveData, now = Date.now()): number { settle(s, now); return s.energy.v; }
/** ms until the next point (0 when full) */
export function energyNext(s: SaveData, now = Date.now()): number { settle(s, now); return s.energy.v >= ENERGY_MAX ? 0 : ENERGY_REGEN_MS - (now - s.energy.t); }
/** what AUTO costs on this stage */
export const autoCost = (st: StageDef) => st.stamina;
/** pay for AUTO; false (nothing spent) when there is not enough */
export function payAuto(s: SaveData, st: StageDef, now = Date.now()): boolean {
  settle(s, now); const c = autoCost(st);
  if (s.energy.v < c) return false;
  const wasFull = s.energy.v >= ENERGY_MAX; s.energy.v -= c; if (wasFull) s.energy.t = now; // refilling starts from the moment it drops below full
  return true;
}
/** gem refills already bought today / still allowed today (resets at local midnight, like the rush ladder) */
export const refillsToday = (s: SaveData, now = Date.now()) => s.enBuy && s.enBuy.day === dayKey(now) ? s.enBuy.n : 0;
export const refillsLeft = (s: SaveData, now = Date.now()) => Math.max(0, ENERGY_REFILL_DAILY - refillsToday(s, now));
/** buy one refill: +ENERGY_MAX for ENERGY_REFILL_GEMS gems; may pass the cap (no regen while above it) */
export function buyEnergy(s: SaveData, now = Date.now()): boolean {
  if (!refillsLeft(s, now) || s.gems < ENERGY_REFILL_GEMS) return false;
  settle(s, now); const n = refillsToday(s, now);
  s.gems -= ENERGY_REFILL_GEMS; s.energy.v += ENERGY_MAX; s.energy.t = now; s.enBuy = { day: dayKey(now), n: n + 1 };
  return true;
}
