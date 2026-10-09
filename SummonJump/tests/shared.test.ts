import { describe, expect, it } from 'vitest';
import { createRng, elementMultiplier, rollDamage, rollRefine, refineAttackBonus, attack, maxHp, expToNext, type HeroBuild } from '../shared';

const build = (o: Partial<HeroBuild> = {}): HeroBuild => ({
  level: 1, stats: { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 }, weaponAtk: 6, bonusAtk: 0, bonusDef: 0, bonusHp: 0, bonusCrit: 0, ...o,
});

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = createRng(42), b = createRng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
});

describe('elements', () => {
  it('follows water > fire > earth > wind > water', () => {
    expect(elementMultiplier('water', 'fire')).toBe(1.5);
    expect(elementMultiplier('fire', 'water')).toBe(0.75);
    expect(elementMultiplier('wind', 'water')).toBe(1.5);
    expect(elementMultiplier('neutral', 'fire')).toBe(1);
    expect(elementMultiplier('holy', 'dark')).toBe(1.5);
  });
});

describe('damage', () => {
  it('crit is red-number damage and >= normal', () => {
    const r = rollDamage({ base: 100, attackElement: 'neutral', defendElement: 'neutral', defense: 0, critRate: 100, dex: 1 }, createRng(1));
    expect(r.crit).toBe(true); expect(r.kind).toBe('crit'); expect(r.amount).toBeGreaterThanOrEqual(140);
  });
  it('weak element is labelled weak', () => {
    const r = rollDamage({ base: 100, attackElement: 'water', defendElement: 'fire', defense: 0, critRate: 0, dex: 1 }, createRng(2));
    expect(r.kind).toBe('weak'); expect(r.amount).toBeGreaterThan(130);
  });
  it('never below 1', () => {
    const r = rollDamage({ base: 1, attackElement: 'neutral', defendElement: 'neutral', defense: 999, critRate: 0, dex: 1 }, createRng(3));
    expect(r.amount).toBe(1);
  });
});

describe('stats', () => {
  it('level 1 starter matches prototype ballpark', () => {
    expect(attack(build())).toBe(8 + 2 + 0 + 1 + 6);
    expect(maxHp(build())).toBe(110);
    expect(expToNext(1)).toBe(12);
  });
});

describe('refine', () => {
  it('safe up to +4', () => {
    const rng = createRng(9);
    let lv = 0;
    for (let i = 0; i < 4; i++) lv = rollRefine(lv, rng).level;
    expect(lv).toBe(4);
  });
  it('breaks at +10 without protection on failure', () => {
    const rng = { next: () => 0.99, range: () => 0, chance: () => false };
    expect(rollRefine(10, rng).outcome).toBe('break');
    expect(rollRefine(10, rng, true).outcome).toBe('downgrade');
    expect(rollRefine(6, rng).outcome).toBe('downgrade');
  });
  it('bonus grows', () => { expect(refineAttackBonus(4)).toBe(12); expect(refineAttackBonus(5)).toBe(18); });
});
