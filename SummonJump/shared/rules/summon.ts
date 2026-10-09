import type { ContentBundle, SummonDef } from '../content/types';
import type { Element } from '../formulas/elements';
import type { Rng } from '../rng';
import { removeItem, type HeroData } from '../progression/hero';
import { addSpirit } from '../spirits/box';
import type { SpiritBox, SpiritInst } from '../spirits/model';

/**
 * Summon rolls (summon.csv). Pure + seeded so the Phase 6 server runs the same code.
 * Star from `rates`; pity: the `pity_n`-th pull in a row without a `pity_star`+ result is forced to `pity_star`.
 * Family: uniform among families whose natural star is the rolled star and that come in the rolled element.
 */
export interface SummonRoll { family: string; el: Element; star: number; pity: boolean }

export const BASIC_ELEMENTS: readonly Element[] = ['water', 'fire', 'earth', 'wind'];
const pick = <T>(list: readonly T[], rng: Rng): T => list[Math.floor(rng.next() * list.length) % list.length] as T;

export function rollSummon(c: ContentBundle, def: SummonDef, rng: Rng, pityCount: number, chosen?: Element): SummonRoll {
  const forced = def.pity_n > 0 && pityCount >= def.pity_n - 1;
  let star = def.pity_star;
  if (!forced) {
    let r = rng.next();
    star = def.rates.findIndex((p) => (r -= p) < 0) + 1;
    if (star <= 0) star = def.rates.reduce((best, p, i) => (p > 0 ? i + 1 : best), 1); // float rounding at the top end
  }
  const els = def.elements.includes('pick') ? [chosen && BASIC_ELEMENTS.includes(chosen) ? chosen : pick(BASIC_ELEMENTS, rng)] : (def.elements as Element[]);
  const el = pick(els, rng);
  const fams = c.spirits.filter((f) => f.base_star === star && f.elements.includes(el));
  const family = pick(fams, rng).id;
  return { family, el, star, pity: forced };
}

export const summonDef = (c: ContentBundle, id: string): SummonDef | undefined => c.summon.find((s) => s.id === id);

/** Spend one scroll from the hero's bag and add the spirit to the box. null if no scroll. */
export function summon(b: SpiritBox, c: ContentBundle, hero: HeroData, id: string, rng: Rng, chosen?: Element): (SummonRoll & { spirit: SpiritInst }) | null {
  const def = summonDef(c, id);
  if (!def || !removeItem(hero, def.item, 1)) return null;
  const r = rollSummon(c, def, rng, b.pity[id] ?? 0, chosen);
  b.pity[id] = def.pity_n > 0 && r.star < def.pity_star ? (b.pity[id] ?? 0) + 1 : 0;
  const spirit = addSpirit(b, c, r.family, r.el) as SpiritInst;
  return { ...r, spirit };
}
