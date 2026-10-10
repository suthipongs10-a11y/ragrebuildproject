import type { ContentBundle, MonsterDef } from '../content/types';
import { createRng } from '../rng';
import { rollKill } from './drops';
import { cfg, spiritOf, type SpiritBox } from '../spirits/model';
import { giveSpiritExp } from '../spirits/box';

/**
 * Spirit expedition (owner request: farm while offline, SW style). Up to 3 spirits that are NOT in the team go to a
 * map the hero has visited and beat its normal monsters while time passes — game open or closed — up to
 * `explore_cap_h` hours. Loot uses the map's normal drop tables (same rates as playing), soul stones and part of the
 * EXP for the spirits. Pure + seeded so the Phase 6 server can recompute it from (room, spirits, start, seed).
 */
export interface ExploreState { room: string; uids: number[]; start: number; seed: number }
export interface ExploreLoot { hours: number; kills: number; soul: number; exp: number; items: Record<string, number>; cards: Record<string, number> }

export const EXPLORE_MAX = 3;

/** Normal monsters of a room (bosses stay for the player). */
export function exploreMonsters(c: ContentBundle, monsters: readonly string[]): MonsterDef[] {
  return monsters.map((id) => c.monsters.find((m) => m.id === id)).filter((m): m is MonsterDef => !!m && m.tier === 'normal');
}

/** 0..1 — how well these spirits handle the room (their level vs the monsters' level) × how many went. */
export function exploreEfficiency(c: ContentBundle, b: SpiritBox, uids: readonly number[], mons: readonly MonsterDef[]): number {
  const sp = uids.map((u) => spiritOf(b, u)).filter((s) => !!s);
  if (!sp.length || !mons.length) return 0;
  const lv = sp.reduce((a, s) => a + (s?.lv ?? 1) + (s?.star ?? 1) * 2, 0) / sp.length;
  const mlv = mons.reduce((a, m) => a + m.level, 0) / mons.length;
  const strength = Math.max(cfg(c, 'explore_min_eff', 0.25), Math.min(1, lv / Math.max(1, mlv)));
  return strength * [0, 0.5, 0.8, 1][Math.min(EXPLORE_MAX, sp.length)]!;
}

export const exploreHours = (c: ContentBundle, st: ExploreState, now: number): number =>
  Math.max(0, Math.min(cfg(c, 'explore_cap_h', 12), (now - st.start) / 3_600_000));

/** What the expedition has gathered by `now` (no side effects). */
export function exploreLoot(c: ContentBundle, b: SpiritBox, st: ExploreState, monsters: readonly string[], now: number): ExploreLoot {
  const mons = exploreMonsters(c, monsters), hours = exploreHours(c, st, now);
  const loot: ExploreLoot = { hours, kills: 0, soul: 0, exp: 0, items: {}, cards: {} };
  if (!mons.length) return loot;
  loot.kills = Math.floor(hours * cfg(c, 'explore_kills_h', 40) * exploreEfficiency(c, b, st.uids, mons));
  const rng = createRng((st.seed ^ Math.floor(st.start / 1000)) >>> 0);
  for (let i = 0; i < loot.kills; i++) {
    const m = mons[Math.floor(rng.next() * mons.length)] as MonsterDef;
    const r = rollKill(m, c.drops, rng, 1);
    loot.soul += r.soul; loot.exp += r.exp;
    for (const d of r.drops) { const bag = d.kind === 'card' ? loot.cards : loot.items; bag[d.id] = (bag[d.id] ?? 0) + d.count; }
  }
  return loot;
}

/** Hand the spirits their share of EXP. Items / soul stones / cards are added by the caller (hero bag, save). */
export function exploreGiveExp(c: ContentBundle, b: SpiritBox, st: ExploreState, loot: ExploreLoot): void {
  const each = Math.floor((loot.exp * cfg(c, 'explore_exp_share', 0.6)) / Math.max(1, st.uids.length));
  for (const u of st.uids) { const s = spiritOf(b, u); if (s) giveSpiritExp(s, each); }
}
