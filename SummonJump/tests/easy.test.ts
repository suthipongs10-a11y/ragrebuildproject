import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { addItem, autoSkills, autoStats, changeJob, equipBest, gearScore, isUpgrade, newHero, questRoom, CALM_AFTER, createHeroCombat, derive, newSkillRuntime, stepSkills, type ContentBundle, type HeroData } from '@shared/index';

const content = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'public', 'content', 'content.json'), 'utf8')) as ContentBundle;

const hero = (job: HeroData['job'], lv: number): HeroData => { const h = newHero(content); h.job = job; h.baseLv = lv; return h; };

describe('easy mode: one-tap growth', () => {
  it('auto stats follow the job weights and spend what they can', () => {
    const h = hero('mage', 20); h.statPoints = 80;
    expect(autoStats(h, content)).toBeGreaterThan(20);
    expect(h.stats.int).toBeGreaterThan(h.stats.dex);
    expect(h.stats.dex).toBeGreaterThan(h.stats.vit);
    expect(h.stats.str).toBe(1);
    expect(h.statPoints).toBeLessThan(10);
  });

  it('auto skills follow the plan (novice: basic skill → job change possible)', () => {
    const h = hero('novice', 10); h.jobLv = 10; h.skillPoints = 9;
    expect(autoSkills(h, content)).toBe(9);
    expect(h.skills.basic_skill).toBe(9);
    expect(changeJob(h, content, 'swordsman')).toBe(true);
    h.skillPoints = 6;
    autoSkills(h, content);
    expect(h.skills.power_slash).toBe(5);
    expect(h.slots).toContain('power_slash');
  });

  it('equip best wears the stronger armor and flags upgrades', () => {
    const h = hero('swordsman', 20);
    const it = addItem(h, content, 'a_knight', 1)!;
    expect(isUpgrade(h, content, it.uid)).toBe(true);
    const before = gearScore(h, content);
    expect(equipBest(h, content)).toBeGreaterThan(0);
    expect(h.equip.armor).toBe(it.uid);
    expect(gearScore(h, content)).toBeGreaterThan(before);
    expect(isUpgrade(h, content, it.uid)).toBe(false);
  });
});

describe('easy mode: guide travel + calm regen', () => {
  const rooms = [{ id: 'town', monsters: [] }, { id: 'forest', monsters: ['poring', 'rocker'] }, { id: 'deep', monsters: ['king', 'boar'] }, { id: 'sky1', monsters: ['bird'] }];
  it('quest destinations', () => {
    const q = (id: string) => content.quests.find((x) => x.id === id)!;
    expect(questRoom(content, q('q_poring'), rooms, 1)).toBe('forest');
    expect(questRoom(content, q('q_king'), rooms, 8)).toBe('deep');
    expect(questRoom(content, q('q_summon'), rooms, 5)).toBe('town');
    expect(questRoom(content, q('q_sky'), rooms, 10)).toBe('sky1');
    expect(questRoom(content, q('q_lv5'), rooms, 2)).toBe('forest');
  });

  it('out of combat the hero heals fast', () => {
    const h = hero('swordsman', 20), d = derive(h, content), combat = createHeroCombat(d.build), rt = newSkillRuntime(10);
    combat.hp = 10;
    const ctx = { hero: { x: 0, y: 0, w: 10, h: 10, vx: 0, vy: 0, onGround: true, dir: 1 }, combat, data: h, derived: d, content, enemies: [], shots: [], grid: null, rng: null } as never;
    stepSkills(rt, ctx, 2.1);
    const slow = combat.hp;
    combat.calm = CALM_AFTER + 1;
    stepSkills(rt, ctx, 2.1);
    expect(combat.hp - slow).toBeGreaterThan(slow - 10 + 5);
  });
});
