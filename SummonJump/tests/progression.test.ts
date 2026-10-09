import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { addItem, canChangeJob, canSocket, changeJob, derive, equip, evalExpr, gainExp, learnSkill, newHero, raiseStat, refineAttackBonus, setSlot, socketCard, statCost, useItem, attack, maxHp, maxSp, magicAttack, type ContentBundle } from '@shared/index';

const content = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'public', 'content', 'content.json'), 'utf8')) as ContentBundle;

describe('formula evaluator', () => {
  it('handles operators, precedence, functions and variables', () => {
    expect(evalExpr('2.0+0.4*lv', { lv: 5 })).toBeCloseTo(4);
    expect(evalExpr('ceil(lv/2)', { lv: 5 })).toBe(3);
    expect(evalExpr('(1+2)*3-4/2')).toBe(7);
    expect(evalExpr('-lv+max(2, 3)', { lv: 1 })).toBe(2);
  });
  it('rejects unsafe or broken input', () => {
    expect(() => evalExpr('alert(1)')).toThrow();
    expect(() => evalExpr('lv;1', { lv: 1 })).toThrow();
    expect(() => evalExpr('foo', {})).toThrow();
  });
});

describe('hero progression', () => {
  it('new hero: novice lv1, training sword equipped, potions', () => {
    const h = newHero(content);
    expect(h.job).toBe('novice'); expect(h.equip.weapon).toBeDefined();
    expect(h.bag.find((b) => b.id === 'potion_red')?.count).toBe(5);
  });
  it('exp raises base and job levels with points', () => {
    const h = newHero(content);
    const r = gainExp(h, content, 10_000, 10_000);
    expect(r.baseUps).toBeGreaterThan(5); expect(h.statPoints).toBeGreaterThan(20);
    expect(h.jobLv).toBe(10); expect(h.skillPoints).toBe(9); // novice caps at job 10
  });
  it('stat cost rises RO-style and points are spent', () => {
    expect(statCost(1)).toBe(2); expect(statCost(11)).toBe(3);
    const h = newHero(content); const before = h.statPoints;
    expect(raiseStat(h, 'str')).toBe(true); expect(h.stats.str).toBe(2); expect(h.statPoints).toBe(before - 2);
    h.statPoints = 0; expect(raiseStat(h, 'str')).toBe(false);
  });
  it('job change needs Novice job 10 + Basic Skill 9, gives the starter weapon', () => {
    const h = newHero(content);
    expect(canChangeJob(h, content, 'mage')).toBe('joblv');
    gainExp(h, content, 0, 100_000);
    expect(canChangeJob(h, content, 'mage')).toBe('basic');
    for (let i = 0; i < 9; i++) learnSkill(h, content, 'basic_skill');
    expect(canChangeJob(h, content, 'mage')).toBeNull();
    expect(changeJob(h, content, 'mage')).toBe(true);
    const w = h.bag.find((b) => b.uid === h.equip.weapon);
    expect(w?.id).toBe('wpn_staff_wood');
    expect(canChangeJob(h, content, 'archer')).toBe('path');
  });
  it('skill tree requirements and slots', () => {
    const h = newHero(content); h.job = 'swordsman'; h.skillPoints = 10;
    expect(learnSkill(h, content, 'magnum_burst')).toBe(false); // needs power_slash 2
    learnSkill(h, content, 'power_slash'); learnSkill(h, content, 'power_slash');
    expect(learnSkill(h, content, 'magnum_burst')).toBe(true);
    expect(h.slots).toContain('power_slash'); expect(h.slots).toContain('magnum_burst');
    expect(learnSkill(h, content, 'fire_bolt')).toBe(false); // other job
    expect(setSlot(h, content, 0, 'magnum_burst')).toBe(true);
    expect(h.slots.filter((s) => s === 'magnum_burst').length).toBe(1);
  });
});

describe('equipment, refine, cards', () => {
  it('job and level restrictions', () => {
    const h = newHero(content);
    const bow = addItem(h, content, 'wpn_bow_short')!;
    expect(equip(h, content, bow.uid)).toBe(false); // novice can't use bows
    h.job = 'archer';
    expect(equip(h, content, bow.uid)).toBe(true);
    const gale = addItem(h, content, 'wpn_bow_gale')!;
    expect(equip(h, content, gale.uid)).toBe(false); // level 20
  });
  it('refine and passives change derived stats', () => {
    const h = newHero(content); const base = derive(h, content).build;
    const w = h.bag.find((b) => b.uid === h.equip.weapon)!; w.refine = 7;
    expect(attack(derive(h, content).build)).toBe(attack(base) + refineAttackBonus(7));
    h.job = 'swordsman'; h.skills.sword_mastery = 5;
    expect(attack(derive(h, content).build)).toBe(attack(base) + refineAttackBonus(7) + 20);
  });
  it('job factors: mage has more SP and MATK, swordsman more HP', () => {
    const h = newHero(content); h.baseLv = 30;
    h.job = 'mage'; const m = derive(h, content).build;
    h.job = 'swordsman'; const s = derive(h, content).build;
    expect(maxSp(m)).toBeGreaterThan(maxSp(s)); expect(maxHp(s)).toBeGreaterThan(maxHp(m));
    expect(magicAttack(m)).toBeGreaterThan(0);
  });
  it('cards: type restriction, slot count, effect applied', () => {
    const h = newHero(content); const owned = { card_mantis: 2, card_poring: 1 };
    const w = h.equip.weapon!;
    expect(canSocket(h, content, w, 'card_poring')).toBe('type');
    const atk0 = attack(derive(h, content).build);
    expect(socketCard(h, content, w, 'card_mantis', owned)).toBe(true);
    expect(owned.card_mantis).toBe(1);
    expect(attack(derive(h, content).build)).toBe(atk0 + 5 + 2 * 2); // +5 atk, +2 str
    expect(socketCard(h, content, w, 'card_mantis', owned)).toBe(false); // 1 slot only
  });
  it('potions stack and are consumed', () => {
    const h = newHero(content); const p = h.bag.find((b) => b.id === 'potion_red')!;
    addItem(h, content, 'potion_red', 3); expect(p.count).toBe(8);
    expect(useItem(h, content, p.uid)?.heal).toBe(45); expect(p.count).toBe(7);
  });
});
