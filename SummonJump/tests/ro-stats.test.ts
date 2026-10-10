import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { addItem, attack, canEquip, createHero, createHeroCombat, createRng, derive, equip, magicAttack, newHero, stepHeroCombat, TileGrid, type ContentBundle, type HeroData, type Shot } from '@shared/index';

const content = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'public', 'content', 'content.json'), 'utf8')) as ContentBundle;

function hero(job: HeroData['job'], weapon: string | null, stats: Partial<HeroData['stats']>): HeroData {
  const h = newHero(content); h.job = job; h.baseLv = 30; Object.assign(h.stats, stats);
  h.equip = {}; h.bag = [];
  if (weapon) { const w = addItem(h, content, weapon, 1); if (w) equip(h, content, w.uid); }
  return h;
}

describe('RO-style attack stats', () => {
  it('melee and staff attacks scale with STR, bows with DEX', () => {
    const atk = (job: HeroData['job'], w: string, s: Partial<HeroData['stats']>) => attack(derive(hero(job, w, s), content).build);
    expect(atk('swordsman', 'w_iron', { str: 40 })).toBeGreaterThan(atk('swordsman', 'w_iron', { str: 1 }) + 70);
    expect(atk('archer', 'wpn_bow_short', { dex: 40 })).toBeGreaterThan(atk('archer', 'wpn_bow_short', { dex: 1 }) + 70);
    expect(atk('archer', 'wpn_bow_short', { str: 40 }) - atk('archer', 'wpn_bow_short', { str: 1 })).toBeLessThan(10);
    // a mage who never raised STR hits weakly with the staff, even with high INT
    expect(atk('mage', 'wpn_staff_wood', { int: 60, str: 1 })).toBeLessThan(atk('mage', 'wpn_staff_wood', { int: 1, str: 40 }));
  });

  it('MATK comes from INT; a staff adds MATK and +15 %, a sword gives none', () => {
    const matk = (w: string, int: number) => magicAttack(derive(hero('mage', w, { int }), content).build);
    expect(matk('wpn_staff_wood', 50)).toBeGreaterThan(matk('wpn_staff_wood', 10) * 2);
    expect(matk('wpn_staff_wood', 40)).toBeGreaterThan(matk('w_iron', 40) * 1.2);
  });

  it('staves shoot (magic-looking shots), bows shoot arrows, swords and maces hit in melee', () => {
    const d = (job: HeroData['job'], w: string) => derive(hero(job, w, {}), content);
    expect(d('mage', 'wpn_staff_wood')).toMatchObject({ ranged: true, magic: true });
    expect(d('archer', 'wpn_bow_short')).toMatchObject({ ranged: true, magic: false });
    expect(d('mage', 'w_iron')).toMatchObject({ ranged: false });
    expect(d('acolyte', 'wpn_mace_iron')).toMatchObject({ ranged: false });
  });

  it('RO weapon access: mage/acolyte can hold a basic sword and staves, archers bows only among ranged', () => {
    const can = (job: HeroData['job'], w: string) => { const h = hero(job, null, {}); const it = addItem(h, content, w, 1); return it ? canEquip(h, content, it.uid) : 'none'; };
    expect(can('mage', 'w_iron')).toBeNull();
    expect(can('acolyte', 'wpn_staff_wood')).toBeNull();
    expect(can('mage', 'wpn_bow_short')).not.toBeNull();
    expect(can('swordsman', 'wpn_mace_iron')).toBeNull();
  });

  it('a staff attack fires a magic-looking shot instead of a slash', () => {
    const d = derive(hero('mage', 'wpn_staff_wood', {}), content), shots: Shot[] = [];
    const h = createHero(100, 100); h.onGround = true;
    stepHeroCombat(createHeroCombat(d.build), h, d.build, [], shots, { attackPressed: true, attackHeld: false, jumpHeld: false }, false, createRng(1), 0.016,
      { ranged: d.ranged, range: d.range, magicShot: d.magic });
    expect(shots.map((x) => x.kind)).toEqual(['magic_shot']);
  });
});
