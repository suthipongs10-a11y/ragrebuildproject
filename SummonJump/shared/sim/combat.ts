import type { Rng } from '../rng';
import type { Element } from '../formulas/elements';
import { rollDamage, CRIT_MULTIPLIER, type DamageKind } from '../formulas/damage';
import { attack, attackCooldown, critRate, defense, magicAttack, maxHp, type HeroBuild } from '../formulas/stats';
import type { Body } from '../platformer/motion';
import type { Enemy, Shot } from './enemy';

/** Hero side of combat: 3-hit combo, hitboxes, stomp, contact damage, i-frames. Pure; the client renders events. */
export interface HeroCombat {
  hp: number; inv: number; atkT: number; atkCd: number;
  /** seconds since the hero last took damage (out-of-combat regen) */
  calm: number;
  /** 0,1,2 = attack1..3 of the current combo; reset when the chain window closes */
  combo: number; chainT: number; hitSet: Set<string>; dead: boolean;
  /** energy shield pool (absorbs damage) */
  shield: number;
  /** attack press buffered during the cooldown */
  buf: number;
}

export interface AttackSpec { clip: 'attack1' | 'attack2' | 'attack3'; dur: number; mult: number; kb: number; reach: number; hitstop: number }
export const COMBO: readonly AttackSpec[] = [
  { clip: 'attack1', dur: 0.16, mult: 1, kb: 140, reach: 60, hitstop: 0.035 },
  { clip: 'attack2', dur: 0.16, mult: 1.1, kb: 140, reach: 60, hitstop: 0.04 },
  { clip: 'attack3', dur: 0.22, mult: 1.6, kb: 320, reach: 80, hitstop: 0.09 },
];
const CHAIN_WINDOW = 0.45;

export type CombatEvent =
  | { kind: 'swing'; spec: AttackSpec; x: number; y: number; dir: number }
  | { kind: 'hit'; enemy: Enemy; amount: number; dmg: DamageKind; x: number; y: number; hitstop: number; killed: boolean; stomp: boolean; spirit?: boolean }
  | { kind: 'hurt'; amount: number; x: number; y: number }
  | { kind: 'died' };

export interface Box { x: number; y: number; w: number; h: number }
export const overlap = (a: Box, b: Box): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export function createHeroCombat(build: HeroBuild): HeroCombat {
  return { hp: maxHp(build), inv: 0, calm: 0, atkT: 0, atkCd: 0, combo: 0, chainT: 0, hitSet: new Set(), dead: false, buf: 0, shield: 0 };
}

export const currentSpec = (c: HeroCombat): AttackSpec => COMBO[c.combo] as AttackSpec;

export function attackBox(h: Body & { dir: number }, spec: AttackSpec): Box {
  return { x: h.dir > 0 ? h.x + h.w - 4 : h.x + 4 - spec.reach, y: h.y - 8, w: spec.reach, h: h.h + 12 };
}

export interface HeroCombatInput { attackPressed: boolean; attackHeld: boolean; jumpHeld: boolean }
/** Equipment-derived options: weapon element, bows shoot arrows (staves: magic bolts), Endure ignores knockback. */
export interface HeroCombatOpts { element?: Element; ranged?: boolean; range?: number; noKnockback?: boolean; blocked?: boolean; /** staff: the shot looks like magic */ magicShot?: boolean }

/**
 * Advance timers, start attacks, resolve hero hitboxes and contact/stomp/shots against enemies.
 * Mutates hero (bounce/knockback), enemies (hp/stun/flash) and shots.
 */
export function stepHeroCombat(
  c: HeroCombat, hero: Body & { dir: number; canDouble: boolean; prevBottom: number }, build: HeroBuild,
  enemies: Enemy[], shots: Shot[], inp: HeroCombatInput, water: boolean, rng: Rng, dt: number, opts: HeroCombatOpts = {},
): CombatEvent[] {
  const el = opts.element ?? 'neutral';
  const ev: CombatEvent[] = [];
  if (c.dead) return ev;
  if (c.inv > 0) c.inv -= dt;
  c.calm += dt;
  if (c.atkCd > 0) c.atkCd -= dt;
  if (c.chainT > 0) c.chainT -= dt; else if (c.atkT <= 0) c.combo = 0;

  if (inp.attackPressed) c.buf = 0.25; else if (c.buf > 0) c.buf -= dt;
  if ((c.buf > 0 || inp.attackHeld) && c.atkCd <= 0 && c.atkT <= 0 && !opts.blocked) {
    c.buf = 0;
    if (c.chainT <= 0) c.combo = 0;
    const spec = currentSpec(c);
    c.atkT = spec.dur; c.atkCd = attackCooldown(build) * (c.combo === 2 ? 1.6 : 1); c.hitSet = new Set();
    ev.push({ kind: 'swing', spec, x: hero.x + hero.w / 2 + hero.dir * 16, y: hero.y + hero.h * 0.42, dir: hero.dir });
    if (opts.ranged) { // bows / staves: every attack is a shot instead of a melee box
      shots.push({ x: hero.x + hero.w / 2 + hero.dir * 20, y: hero.y + hero.h * 0.4, vx: hero.dir * 760, vy: 0, r: 8, color: 0xfff2cc, dmg: 0, life: (opts.range ?? 300) / 760 + 0.15,
        hostile: false, ghost: false, el, base: spec.mult, kb: spec.kb, kind: opts.magicShot ? 'magic_shot' : 'arrow' });
      c.hitSet.add('*');
    }
  }
  if (c.atkT > 0) {
    const spec = currentSpec(c);
    c.atkT -= dt;
    const box = attackBox(hero, spec);
    for (const e of enemies) {
      if (c.hitSet.has('*') || e.dead || c.hitSet.has(e.id) || !overlap(box, e)) continue;
      c.hitSet.add(e.id);
      ev.push(hitEnemy(e, attack(build) * spec.mult, el, build, rng, spec.kb, spec.hitstop, hero.x + hero.w / 2, false));
    }
    // the chain window opens after the cooldown, so the next hit of the combo is never lost to it
    if (c.atkT <= 0) { c.chainT = Math.max(0, c.atkCd) + CHAIN_WINDOW; c.combo = (c.combo + 1) % COMBO.length; }
  }

  // body contact: stomp from above, otherwise the monster hurts the hero
  for (const e of enemies) {
    if (e.dead || !overlap(hero, e)) continue;
    if (e.def.stompable && hero.vy > 0 && hero.prevBottom <= e.y + 16) {
      ev.push(hitEnemy(e, Math.max(attack(build) * 1.6, 18), 'neutral', build, rng, 0, 0.05, hero.x + hero.w / 2, true));
      hero.vy = water ? -520 : inp.jumpHeld ? -860 : -640; hero.canDouble = true;
    } else hurtHero(c, hero, build, e.def.atk, e.x + e.w / 2, water, rng, ev, opts.noKnockback);
  }
  for (const s of shots) {
    if (s.life <= 0 || (s.delay ?? 0) > 0) continue;
    const box = { x: s.x - s.r, y: s.y - s.r, w: s.r * 2, h: s.r * 2 };
    if (s.hostile) { if (overlap(box, hero)) { hurtHero(c, hero, build, s.dmg, s.x, water, rng, ev, opts.noKnockback); s.life = 0; } continue; }
    for (const e of enemies) {
      if (e.dead || !overlap(box, e) || s.hit?.includes(e.id)) continue;
      if (s.power !== undefined) { ev.push(spiritHit(e, s, rng)); if (s.pierce) (s.hit ??= []).push(e.id); else { s.life = 0; break; } continue; }
      const base = (s.magic ? magicAttack(build) : attack(build)) * (s.base ?? 1);
      ev.push(hitEnemy(e, base, s.el as Element, build, rng, s.kb ?? 0, 0.03, s.x - s.vx * 0.01, false, s.magic));
      if (s.pierce) (s.hit ??= []).push(e.id); else { s.life = 0; break; }
    }
  }
  return ev;
}

export function hitEnemy(e: Enemy, base: number, el: Element, build: HeroBuild, rng: Rng, kb: number, hitstop: number, fromX: number, stomp: boolean, magic = false): CombatEvent {
  const def = e.def.def * (1 - e.defDown) * (magic ? 0.5 : 1);
  const r = rollDamage({ base, attackElement: el, defendElement: e.def.element, defense: def, critRate: critRate(build), dex: build.stats.dex, canCrit: !stomp && !magic }, rng);
  e.hp -= r.amount; e.flash = 0.14;
  const boss = e.def.tier !== 'normal';
  if (!boss) { e.vx = (e.x + e.w / 2 < fromX ? -1 : 1) * Math.max(kb, 140); if (kb > 150) e.vy = -320; e.stun = Math.max(e.stun, kb > 150 ? 0.35 : 0.14); }
  const killed = e.hp <= 0;
  if (killed) e.dead = true;
  return { kind: 'hit', enemy: e, amount: r.amount, dmg: r.kind, x: e.x + e.w / 2, y: e.y + e.h * 0.3, hitstop: r.crit ? Math.max(hitstop, 0.07) : hitstop, killed, stomp };
}

/** A spirit's hit (auto skill shot, aoe or ultimate): flat base, the spirit's own crit, optional stun / DEF-down. */
export function spiritHit(e: Enemy, s: Pick<Shot, 'power' | 'crit' | 'critDmg' | 'el' | 'stun' | 'defDown' | 'x'>, rng: Rng, hitstop = 0.02): CombatEvent {
  const def = e.def.def * (1 - e.defDown);
  const r = rollDamage({ base: s.power ?? 1, attackElement: s.el as Element, defendElement: e.def.element, defense: def, critRate: s.crit ?? 0, dex: 0 }, rng);
  const amount = r.crit ? Math.round((r.amount * (1 + (s.critDmg ?? 60) / 100)) / CRIT_MULTIPLIER) : r.amount; // crit damage % from runes replaces the default x1.6
  e.hp -= amount; e.flash = 0.14;
  if (e.def.tier === 'normal' && s.stun) e.stun = Math.max(e.stun, s.stun);
  if (s.defDown) { e.defDown = Math.max(e.defDown, s.defDown); e.defDownT = Math.max(e.defDownT, 6); }
  const killed = e.hp <= 0;
  if (killed) e.dead = true;
  return { kind: 'hit', enemy: e, amount: Math.max(1, amount), dmg: r.kind, x: e.x + e.w / 2, y: e.y + e.h * 0.3, hitstop: r.crit ? 0.05 : hitstop, killed, stomp: false, spirit: true };
}

export function hurtHero(c: HeroCombat, hero: Body, build: HeroBuild, atk: number, srcX: number, water: boolean, rng: Rng, ev: CombatEvent[], noKnockback = false): void {
  if (c.inv > 0 || c.dead) return;
  let amount = Math.max(1, Math.round(atk * rng.range(0.9, 1.1) - defense(build) * 0.6));
  if (c.shield > 0) { const a = Math.min(c.shield, amount); c.shield -= a; amount -= a; }
  c.hp -= amount; c.inv = 1; c.calm = 0;
  if (!noKnockback) { hero.vx = (hero.x + hero.w / 2 < srcX ? -1 : 1) * 320; hero.vy = water ? -240 : -440; }
  ev.push({ kind: 'hurt', amount, x: hero.x + hero.w / 2, y: hero.y });
  if (c.hp <= 0) { c.hp = 0; c.dead = true; ev.push({ kind: 'died' }); }
}

/** Move hostile/friendly shots; solid tiles stop non-ghost shots (checked by the caller). */
export function stepShots(shots: Shot[], dt: number): void {
  for (const s of shots) {
    if ((s.delay ?? 0) > 0) { s.delay = (s.delay as number) - dt; continue; }
    s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
  }
}
