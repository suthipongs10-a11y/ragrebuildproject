import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { newHero, questRoom, CALM_AFTER, createHeroCombat, derive, newSkillRuntime, stepSkills, type ContentBundle, type HeroData } from '@shared/index';

const content = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'public', 'content', 'content.json'), 'utf8')) as ContentBundle;

const hero = (job: HeroData['job'], lv: number): HeroData => { const h = newHero(content); h.job = job; h.baseLv = lv; return h; };

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
