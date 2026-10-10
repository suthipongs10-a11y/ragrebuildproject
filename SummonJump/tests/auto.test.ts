import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { autoPlan, createEnemy, createRng, derive, newHero, newSkillRuntime, type ContentBundle, type Enemy } from '@shared/index';

const content = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'public', 'content', 'content.json'), 'utf8')) as ContentBundle;
const poring = content.monsters.find((m) => m.id === 'poring')!;
const hero = { x: 100, y: 100, w: 28, h: 48, vx: 0, vy: 0, onGround: true, dir: 1 as 1 | -1 };
const mon = (x: number): Enemy => { const e = createEnemy('p', poring, x, 100, createRng(1)); e.y = 100 + hero.h - e.h; return e; };
const setup = () => { const data = newHero(content); return { content, data, rt: newSkillRuntime(100), derived: derive(data, content), hp: 100, maxHp: 100, hero: { ...hero } }; };

describe('auto battle', () => {
  it('faces the nearest monster and attacks only in reach', () => {
    const a = setup();
    expect(autoPlan({ ...a, enemies: [] })).toEqual({ face: 0, attack: false, skill: null });
    const far = autoPlan({ ...a, enemies: [mon(-200), mon(400)] });
    expect(far.face).toBe(1); expect(far.attack).toBe(false);
    const near = autoPlan({ ...a, enemies: [mon(60), mon(400)] });
    expect(near.face).toBe(-1); expect(near.attack).toBe(true);
  });

  it('heals under 60 % HP, never when healthy; respects cooldown and SP', () => {
    const a = setup();
    expect(autoPlan({ ...a, enemies: [] }).skill).toBeNull();
    expect(autoPlan({ ...a, hp: 40, enemies: [] }).skill).toBe('first_aid');
    a.rt.cds.first_aid = 5;
    expect(autoPlan({ ...a, hp: 40, enemies: [] }).skill).toBeNull();
    a.rt.cds = {}; a.rt.sp = 0;
    expect(autoPlan({ ...a, hp: 40, enemies: [] }).skill).toBeNull();
  });

  it('fires an attack skill when a monster is close', () => {
    const a = setup();
    a.data.job = 'swordsman'; a.data.skills.power_slash = 5; a.data.slots = ['power_slash', null, null];
    expect(autoPlan({ ...a, enemies: [mon(400)] }).skill).toBeNull();
    expect(autoPlan({ ...a, enemies: [mon(160)] }).skill).toBe('power_slash');
  });
});
