import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { addSpirit, exploreEfficiency, exploreGiveExp, exploreHours, exploreLoot, exploreMonsters, newHero, spiritOf, starterBox, type ContentBundle, type ExploreState } from '@shared/index';

const content = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'public', 'content', 'content.json'), 'utf8')) as ContentBundle;
const H = 3_600_000;
const forest = ['poring', 'rocker', 'poring', 'drops', 'king'];

function setup(lv: number, n: number) {
  const b = starterBox(content, newHero(content));
  const uids = [];
  for (let i = 0; i < n; i++) { const s = addSpirit(b, content, 'pixie', 'wind')!; s.lv = lv; uids.push(s.uid); }
  return { b, uids };
}

describe('spirit expedition (offline farming)', () => {
  it('bosses stay home; only normal monsters are farmed', () => {
    expect(exploreMonsters(content, forest).map((m) => m.id)).not.toContain('king');
  });

  it('loot grows with time, stops at the cap, and is the same when recomputed', () => {
    const { b, uids } = setup(10, 3);
    const st: ExploreState = { room: 'forest', uids, start: 0, seed: 42 };
    const one = exploreLoot(content, b, st, forest, 1 * H), six = exploreLoot(content, b, st, forest, 6 * H);
    expect(one.kills).toBeGreaterThan(10);
    expect(six.kills).toBeGreaterThan(one.kills * 5);
    expect(six.soul).toBeGreaterThan(one.soul);
    expect(Object.keys(six.items).length).toBeGreaterThan(0); // the map's normal drop table
    expect(exploreHours(content, st, 48 * H)).toBe(12);
    expect(exploreLoot(content, b, st, forest, 48 * H)).toEqual(exploreLoot(content, b, st, forest, 12 * H));
    expect(exploreLoot(content, b, st, forest, 6 * H)).toEqual(six);
    expect(exploreHours(content, st, -5)).toBe(0); // clock moved back: nothing
  });

  it('stronger and more spirits gather more', () => {
    const weak = setup(1, 1), strong = setup(20, 3), mons = exploreMonsters(content, ['fish', 'jellyfish', 'crab', 'eel']);
    expect(exploreEfficiency(content, strong.b, strong.uids, mons)).toBeGreaterThan(exploreEfficiency(content, weak.b, weak.uids, mons) * 2);
  });

  it('the sent spirits share the EXP', () => {
    const { b, uids } = setup(1, 2);
    const st: ExploreState = { room: 'forest', uids, start: 0, seed: 1 };
    exploreGiveExp(content, b, st, exploreLoot(content, b, st, forest, 4 * H));
    expect(spiritOf(b, uids[0])!.lv).toBeGreaterThan(1);
  });
});
