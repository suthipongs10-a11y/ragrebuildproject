import type { DropDef, MonsterDef } from '../content/types';
import type { Rng } from '../rng';

export interface DropRoll { kind: 'item' | 'card'; id: string; count: number }
export interface KillReward { exp: number; jobExp: number; soul: number; drops: DropRoll[] }

/** Server-authoritative later (Phase 6); same code runs on both sides. `luck` multiplies non-boss rates. */
export function rollKill(m: MonsterDef, table: readonly DropDef[], rng: Rng, luck = 1): KillReward {
  const boss = m.tier !== 'normal';
  const drops: DropRoll[] = [];
  for (const d of table) {
    if (d.monster_id !== m.id) continue;
    if (rng.next() < Math.min(1, d.rate * (boss ? 1 : luck))) drops.push({ kind: 'item', id: d.item_id, count: d.min + Math.floor(rng.next() * (d.max - d.min + 1)) });
  }
  if (m.card_id && rng.next() < Math.min(1, m.card_rate * (boss ? 1 : luck))) drops.push({ kind: 'card', id: m.card_id, count: 1 });
  const soul = Math.round(m.soul_min + rng.next() * (m.soul_max - m.soul_min));
  return { exp: m.exp, jobExp: m.job_exp, soul, drops };
}
