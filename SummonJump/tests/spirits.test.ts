import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  addGauge, addItem, addRune, addSpirit, awaken, canAwaken, canStarUp, countItem, createHeroCombat, createRng, createSpiritWorld, derive, emptyBox,
  equipRune, fodderCandidates, gaugeReady, giveSpiritExp, leaderBonus, mainValue, maxLevel, newHero, rollRune, rollRuneDrop, rollSummon, runeSetBonus,
  setTeam, spiritStats, starUp, starterBox, stepSpirits, summon, teamAbilities, teamExp, ultimate, upgradeRune, createEnemy, attack, BASIC_ELEMENTS,
  type ContentBundle, type SpiritBox,
} from '@shared/index';

const content = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'public', 'content', 'content.json'), 'utf8')) as ContentBundle;
const hero = { x: 100, y: 300, w: 24, h: 56, dir: 1, vx: 0, vy: 0, onGround: true };

describe('spirit content', () => {
  it('15 families; 4-5★ also come in holy/dark', () => {
    expect(content.spirits).toHaveLength(15);
    for (const f of content.spirits) expect(f.elements.length).toBe(f.base_star >= 4 ? 6 : 4);
  });
});

describe('collection', () => {
  it('starter box: sylph/undine/salamander team gives double jump, dive and rock smash; scrolls in the bag', () => {
    const h = newHero(content);
    const b = starterBox(content, h);
    expect(b.team.every((u) => u !== null)).toBe(true);
    expect([...teamAbilities(b, content)].sort()).toEqual(['break', 'dive', 'double']);
    expect(countItem(h, 'scroll_normal')).toBe(10);
    expect(countItem(h, 'scroll_mystic')).toBe(3);
  });

  it('stats grow with level, star and awakening; element changes them a little', () => {
    const b = emptyBox();
    const s = addSpirit(b, content, 'sylph', 'wind')!;
    const lv1 = spiritStats(content, s);
    s.lv = 20; const lv20 = spiritStats(content, s);
    expect(lv20.atk).toBeGreaterThan(lv1.atk);
    s.star = 4; const st4 = spiritStats(content, s);
    expect(st4.atk).toBeGreaterThan(lv20.atk);
    s.awk = true; expect(spiritStats(content, s).atk).toBeGreaterThan(st4.atk);
    const fire = addSpirit(b, content, 'sylph', 'fire')!, water = addSpirit(b, content, 'sylph', 'water')!;
    expect(spiritStats(content, fire).atk).toBeGreaterThanOrEqual(spiritStats(content, water).atk);
    expect(spiritStats(content, water).hp).toBeGreaterThan(spiritStats(content, fire).hp);
    expect(addSpirit(b, content, 'sylph', 'holy')).toBeNull(); // 3★ family: no light/dark variant
  });

  it('EXP levels up to the star cap, team shares kill EXP', () => {
    const b = starterBox(content, null);
    const s = b.spirits[0]!;
    giveSpiritExp(s, 1e9);
    expect(s.lv).toBe(maxLevel(s.star));
    const ups = teamExp(b, 500);
    expect(ups.length).toBe(2); // the other two members level up, the capped one does not
  });

  it('star-up needs max level + `star` fodder of the same star, not in the team', () => {
    const b = emptyBox();
    const t = addSpirit(b, content, 'poring', 'water')!; // 1★
    const f1 = addSpirit(b, content, 'poring', 'fire')!;
    expect(canStarUp(b, t.uid, [f1.uid])).toBe('notMaxLv');
    t.lv = maxLevel(1);
    setTeam(b, 0, f1.uid);
    expect(canStarUp(b, t.uid, [f1.uid])).toBe('inTeam');
    setTeam(b, 0, null);
    expect(fodderCandidates(b, t.uid).map((x) => x.uid)).toEqual([f1.uid]);
    expect(starUp(b, t.uid, [f1.uid])).toBe(true);
    expect(t.star).toBe(2); expect(t.lv).toBe(1);
    expect(b.spirits).toHaveLength(1);
    t.lv = maxLevel(2);
    const a = addSpirit(b, content, 'pixie', 'wind')!, z = addSpirit(b, content, 'poring', 'earth')!;
    expect(canStarUp(b, t.uid, [a.uid, z.uid])).toBe('fodderStar');
  });

  it('awakening costs element + magic essence and boosts the spirit', () => {
    const b = emptyBox(), h = newHero(content);
    const s = addSpirit(b, content, 'salamander', 'fire')!;
    expect(canAwaken(b, content, h, s.uid)).toBe('essence');
    addItem(h, content, 'ess_fire', 16); addItem(h, content, 'ess_magic', 8);
    const before = spiritStats(content, s).atk;
    expect(awaken(b, content, h, s.uid)).toBe(true);
    expect(s.awk).toBe(true);
    expect(countItem(h, 'ess_fire')).toBe(0);
    expect(spiritStats(content, s).atk).toBeGreaterThan(before);
    expect(canAwaken(b, content, h, s.uid)).toBe('awakened');
  });

  it('team slots swap; leader gives its element to a neutral weapon and its leader skill', () => {
    const b = starterBox(content, null);
    const [a, z] = [b.team[0], b.team[1]];
    setTeam(b, 0, z ?? null);
    expect(b.team[0]).toBe(z); expect(b.team[1]).toBe(a);
    const h = newHero(content);
    const lb = leaderBonus(b, content);
    expect(lb.element).toBe('water'); // undine leads now
    expect(derive(h, content, [], 0, lb).element).toBe('water');
    const sal = b.spirits.find((s) => s.id === 'salamander')!;
    setTeam(b, 0, sal.uid);
    const base = attack(derive(h, content).build), led = attack(derive(h, content, [], 0, leaderBonus(b, content)).build);
    expect(led).toBeGreaterThan(base);
  });
});

describe('runes', () => {
  it('slot 1/3/5 have fixed flat mains; rarity = number of subs; no duplicate stats', () => {
    const rng = createRng(3);
    for (let i = 0; i < 300; i++) {
      const r = rollRune(content, rng, 1 + (i % 6), i % 5);
      if (r.slot === 1) expect(r.main.stat).toBe('atk');
      if (r.slot === 3) expect(r.main.stat).toBe('def');
      if (r.slot === 5) expect(r.main.stat).toBe('hp');
      expect(r.subs.length).toBe(i % 5);
      expect(new Set([r.main.stat, ...r.subs.map((s) => s.stat)]).size).toBe(1 + r.subs.length);
    }
  });

  it('upgrade raises the main stat, adds subs at +3/6/9/12, max +15', () => {
    const rng = createRng(9);
    const r = rollRune(content, rng, 6, 0, 'fatal', 1);
    let guard = 0;
    while (r.lv < 15 && guard++ < 5000) upgradeRune(content, r, rng);
    expect(r.lv).toBe(15);
    expect(r.main.v).toBe(mainValue(content, r));
    expect(r.main.v).toBe(18);
    expect(r.subs.length).toBe(4);
    expect(upgradeRune(content, r, rng)).toBe(false);
  });

  it('equip replaces the same slot; sets add bonuses; runes change stats', () => {
    const b = emptyBox(), rng = createRng(5);
    const s = addSpirit(b, content, 'wolf', 'dark')!;
    const base = spiritStats(content, s, b.runes);
    const r1 = addRune(b, rollRune(content, rng, 6, 0, 'fatal', 1));
    const r1b = addRune(b, rollRune(content, rng, 6, 0, 'energy', 1));
    equipRune(b, r1.uid, s.uid); equipRune(b, r1b.uid, s.uid);
    expect(r1.on).toBeNull(); expect(r1b.on).toBe(s.uid);
    for (let sl = 2; sl <= 5; sl++) equipRune(b, addRune(b, rollRune(content, rng, 6, 0, 'fatal', sl)).uid, s.uid);
    expect(runeSetBonus(content, b.runes.filter((r) => r.on === s.uid)).atk_p).toBe(35);
    expect(spiritStats(content, s, b.runes).atk).toBeGreaterThan(base.atk);
  });

  it('drops: bosses always drop, normal monsters rarely', () => {
    const rng = createRng(11);
    let n = 0;
    for (let i = 0; i < 10000; i++) if (rollRuneDrop(content, 'normal', rng)) n++;
    expect(n / 10000).toBeGreaterThan(0.03); expect(n / 10000).toBeLessThan(0.05);
    expect(rollRuneDrop(content, 'mvp', rng)?.star).toBeGreaterThanOrEqual(4);
  });
});

describe('summon', () => {
  it('100k rolls match the rate table (±0.5% abs) and families fit star + element', () => {
    let bad = 0;
    for (const def of content.summon) {
      const rng = createRng(1234), N = 100_000, got = [0, 0, 0, 0, 0];
      for (let i = 0; i < N; i++) {
        const r = rollSummon(content, def, rng, 0, 'fire');
        got[r.star - 1]!++;
        const fam = content.spirits.find((f) => f.id === r.family)!;
        const elOk = def.elements.includes('pick') ? r.el === 'fire' : def.elements.includes(r.el);
        if (fam.base_star !== r.star || !fam.elements.includes(r.el) || !elOk) bad++;
      }
      def.rates.forEach((p, i) => expect(Math.abs((got[i] as number) / N - p)).toBeLessThan(0.005));
    }
    expect(bad).toBe(0);
  }, 30_000);

  it('pity: never more than pity_n pulls in a row without a pity-star spirit', () => {
    const def = content.summon.find((s) => s.id === 'mystic')!;
    const rng = createRng(77);
    let run = 0, worst = 0, pity = 0;
    for (let i = 0; i < 100_000; i++) {
      const r = rollSummon(content, def, rng, pity);
      if (r.star >= def.pity_star) { pity = 0; worst = Math.max(worst, run + 1); run = 0; } else { pity++; run++; }
    }
    expect(worst).toBeLessThanOrEqual(def.pity_n);
    expect(worst).toBe(def.pity_n); // with a 0.5% rate the pity does trigger
  }, 30_000);

  it('summon spends a scroll, adds the spirit and tracks pity', () => {
    const b: SpiritBox = emptyBox(), h = newHero(content), rng = createRng(1);
    addItem(h, content, 'scroll_mystic', 2);
    const r = summon(b, content, h, 'mystic', rng)!;
    expect(r.spirit.star).toBeGreaterThanOrEqual(3);
    expect(b.spirits).toHaveLength(1);
    expect(countItem(h, 'scroll_mystic')).toBe(1);
    expect(b.pity.mystic).toBe(r.star >= 5 ? 0 : 1);
    summon(b, content, h, 'mystic', rng);
    expect(summon(b, content, h, 'mystic', rng)).toBeNull();
    expect(BASIC_ELEMENTS).toContain(r.el);
  });
});

describe('spirits in the world', () => {
  const setup = () => {
    const b = starterBox(content, null), h = newHero(content), build = derive(h, content).build;
    const rng = createRng(2), mon = content.monsters.find((m) => m.id === 'poring')!;
    const enemies = [createEnemy('a', mon, 200, 340, rng), createEnemy('b', mon, 260, 340, rng)];
    const w = createSpiritWorld(b, content, hero);
    return { b, build, rng, enemies, w, combat: createHeroCombat(build), shots: [] as never[] };
  };

  it('auto skills shoot at the nearest monster', () => {
    const { build, rng, enemies, w, combat, shots } = setup();
    const ev = stepSpirits(w, { content, enemies, shots, rng, combat, build }, 2);
    expect(ev.filter((e) => e.kind === 'scast').length).toBe(3);
    expect(shots.length).toBeGreaterThan(0);
  });

  it('gauge fills, ultimate hits every target hits times, COMBO after a hero skill', () => {
    const { build, rng, enemies, w, combat, shots } = setup();
    expect(gaugeReady(w)).toBe(false);
    for (let i = 0; i < 40; i++) addGauge(w, content, 'hero');
    expect(gaugeReady(w)).toBe(true);
    for (const e of enemies) e.hp = 1e6;
    w.lastSkill = 10;
    const r = ultimate(w, { content, enemies, shots, rng, combat, build }, enemies, 11)!;
    expect(r.combo).toBe(true);
    expect(r.hits.length).toBe(r.skill.hits * enemies.length);
    expect(w.gauge).toBe(0);
    expect(ultimate(w, { content, enemies, shots, rng, combat, build }, enemies, 12)).toBeNull();
  });
});
