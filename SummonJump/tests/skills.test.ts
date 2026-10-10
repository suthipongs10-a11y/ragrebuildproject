import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { addItem, equip, Cell, TILE, TileGrid, createEnemy, createHero, createHeroCombat, createRng, derive, newHero, newSkillRuntime, stepHeroCombat, stepShots, stepSkills, useSkill, maxSp, type ContentBundle, type Enemy, type HeroData, type SkillCtx, type Shot } from '@shared/index';

const content = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'public', 'content', 'content.json'), 'utf8')) as ContentBundle;
const def = (id: string) => content.monsters.find((m) => m.id === id)!;

function setup(job: HeroData['job'], skills: Record<string, number>, weapon?: string) {
  const g = new TileGrid(30, 17); for (let x = 0; x < 30; x++) { g.set(x, 15, Cell.Solid); g.set(x, 16, Cell.Solid); }
  const data = newHero(content); data.job = job; data.baseLv = 20; data.skills = { ...data.skills, ...skills }; data.stats.int = 20; data.stats.dex = 10;
  if (weapon) { const w = addItem(data, content, weapon, 1); if (w) equip(data, content, w.uid); }
  const derived = derive(data, content);
  const hero = createHero(8 * TILE, 15 * TILE - 56); hero.onGround = true; hero.dir = 1;
  const combat = createHeroCombat(derived.build);
  const enemies: Enemy[] = [createEnemy('a', { ...def('mantis'), hp: 5000 }, 11 * TILE, 15 * TILE, createRng(1))];
  const shots: Shot[] = [];
  const ctx: SkillCtx = { hero, combat, data, derived, content, enemies, shots, grid: g, rng: createRng(2) };
  const rt = newSkillRuntime(maxSp(derived.build));
  return { ctx, rt, enemies, shots, hero, combat };
}
const tick = (s: ReturnType<typeof setup>, secs: number) => {
  for (let i = 0; i < secs * 60; i++) {
    stepSkills(s.rt, s.ctx, 1 / 60); stepShots(s.shots, 1 / 60);
    stepHeroCombat(s.combat, s.hero, s.ctx.derived.build, s.enemies, s.shots, { attackPressed: false, attackHeld: false, jumpHeld: false }, false, s.ctx.rng, 1 / 60);
    for (const e of s.enemies) e.x = 11 * TILE; // keep the target still
  }
};

describe('skills runtime', () => {
  it('SP and cooldown gate repeated casts', () => {
    const s = setup('swordsman', { power_slash: 5 });
    expect(useSkill(s.rt, s.ctx, 'power_slash').some((e) => e.kind === 'cast')).toBe(true);
    expect(useSkill(s.rt, s.ctx, 'power_slash')[0]).toMatchObject({ kind: 'fail', why: 'cooldown' });
    s.rt.sp = 0; s.rt.cds = {};
    expect(useSkill(s.rt, s.ctx, 'power_slash')[0]).toMatchObject({ kind: 'fail', why: 'sp' });
  });
  it('power slash hits the enemy in front', () => {
    const s = setup('swordsman', { power_slash: 10 }); s.enemies[0]!.x = s.hero.x + 40;
    const ev = useSkill(s.rt, s.ctx, 'power_slash');
    expect(ev.some((e) => e.kind === 'hit')).toBe(true);
  });
  it('mage fire bolt casts, then falling bolts damage the target', () => {
    const s = setup('mage', { fire_bolt: 3 });
    const hp0 = s.enemies[0]!.hp;
    expect(useSkill(s.rt, s.ctx, 'fire_bolt')[0]!.kind).toBe('cast_start');
    tick(s, 1.5);
    expect(s.enemies[0]!.hp).toBeLessThan(hp0);
  });
  it('archer double strafe fires two arrows', () => {
    const bare = setup('archer', { double_strafe: 1 });
    expect(useSkill(bare.rt, bare.ctx, 'double_strafe')[0]).toMatchObject({ kind: 'fail', why: 'weapon' }); // RO: arrow skills need a bow
    const s = setup('archer', { double_strafe: 1 }, 'wpn_bow_short');
    useSkill(s.rt, s.ctx, 'double_strafe');
    expect(s.shots.filter((x) => !x.hostile).length).toBe(2);
    const hp0 = s.enemies[0]!.hp; tick(s, 1); expect(s.enemies[0]!.hp).toBeLessThan(hp0);
  });
  it('heal restores HP; blessing adds a buff that derive() applies', () => {
    const s = setup('acolyte', { heal: 5, blessing: 3 });
    s.combat.hp = 10; useSkill(s.rt, s.ctx, 'heal'); expect(s.combat.hp).toBeGreaterThan(10);
    useSkill(s.rt, s.ctx, 'blessing');
    expect(s.rt.buffs[0]?.effects.str).toBe(3);
    expect(derive(s.ctx.data, content, s.rt.buffs, s.rt.time).build.stats.str).toBe(s.ctx.data.stats.str + 3);
  });
  it('fire wall zone ticks damage; ankle trap stuns once then disappears', () => {
    const s = setup('mage', { fire_bolt: 4, fire_wall: 1 }); s.enemies[0]!.x = s.hero.x + s.hero.w + 20;
    useSkill(s.rt, s.ctx, 'fire_wall'); const hp0 = s.enemies[0]!.hp;
    for (let i = 0; i < 90; i++) { stepSkills(s.rt, s.ctx, 1 / 60); s.enemies[0]!.x = s.hero.x + s.hero.w + 20; }
    expect(s.enemies[0]!.hp).toBeLessThan(hp0);
    const a = setup('archer', { owl_eye: 1, ankle_trap: 1 }); a.enemies[0]!.x = a.hero.x + a.hero.w + 20;
    useSkill(a.rt, a.ctx, 'ankle_trap'); stepSkills(a.rt, a.ctx, 1 / 60);
    expect(a.enemies[0]!.stun).toBeGreaterThan(0.5); stepSkills(a.rt, a.ctx, 1 / 60);
    expect(a.rt.zones.length).toBe(0);
  });
  it('energy shield absorbs damage', () => {
    const s = setup('mage', { soul_strike: 2, energy_shield: 5 });
    s.rt.cds = {}; useSkill(s.rt, s.ctx, 'energy_shield'); tick(s, 1);
    expect(s.combat.shield).toBeGreaterThan(0);
  });
});
