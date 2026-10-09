import type { ContentBundle, SpiritSkillDef } from '../content/types';
import type { Rng } from '../rng';
import { attack, maxHp, type HeroBuild } from '../formulas/stats';
import type { Body } from '../platformer/motion';
import { cfg, familyOf, sskillOf, autoSkill, spiritStats, type SpiritBox, type SpiritStats } from '../spirits/model';
import { teamSpirits } from '../spirits/box';
import { spiritHit, type CombatEvent, type HeroCombat } from './combat';
import type { Enemy, Shot } from './enemy';

/**
 * Spirits in the world: follow the hero, auto-cast skill 1 at the nearest monster, fill the ultimate gauge,
 * and the leader's ultimate (multi-hit on every monster on screen, COMBO after a hero skill). Pure + seeded RNG.
 * Spirits don't take damage in the world.
 */
export interface SpiritActor {
  uid: number; id: string; el: string; slot: number; x: number; y: number; cd: number; flash: number;
  stats: SpiritStats; skill: SpiritSkillDef | undefined;
}

export interface SpiritWorld {
  actors: SpiritActor[];
  gauge: number; gaugeMax: number; gaugeBonus: number;
  /** time of the hero's last skill (COMBO window) */
  lastSkill: number;
}

export type SpiritEvent =
  | { kind: 'scast'; actor: SpiritActor; tx: number; ty: number; vfx: string }
  | { kind: 'sheal'; amount: number; x: number; y: number }
  | { kind: 'sshield'; amount: number; x: number; y: number };

export function createSpiritWorld(b: SpiritBox, c: ContentBundle, hero: Body, prev?: SpiritWorld): SpiritWorld {
  const actors = teamSpirits(b).map((s, i): SpiritActor => {
    const old = prev?.actors.find((a) => a.uid === s.uid); // keep position / cooldown when only stats changed
    return {
      uid: s.uid, id: s.id, el: s.el, slot: i, x: old?.x ?? hero.x - 30 - i * 30, y: old?.y ?? hero.y - 20, cd: old?.cd ?? 0.6 + i * 0.4, flash: 0,
      stats: spiritStats(c, s, b.runes), skill: autoSkill(c, s),
    };
  });
  const leaderGauge = sskillOf(c, familyOf(c, actors[0]?.id ?? '')?.leader ?? '')?.effects.gauge ?? 0;
  const gaugeBonus = (actors.reduce((n, a) => n + a.stats.gauge, 0) + leaderGauge) / 100;
  return { actors, gauge: Math.min(b.gauge, cfg(c, 'gauge_max', 100)), gaugeMax: cfg(c, 'gauge_max', 100), gaugeBonus, lastSkill: prev?.lastSkill ?? -99 };
}

/** Smoothly trail behind the hero, stacked by slot, gently bobbing. */
export function followSpirits(w: SpiritWorld, hero: Body & { dir: number }, time: number, dt: number): void {
  const k = 1 - Math.exp(-6 * dt);
  for (const a of w.actors) {
    const tx = hero.x + hero.w / 2 - hero.dir * (44 + a.slot * 34);
    const ty = hero.y - 14 - a.slot * 12 + Math.sin(time * 2.4 + a.slot * 1.7) * 6;
    a.x += (tx - a.x) * k; a.y += (ty - a.y) * k;
    if (a.flash > 0) a.flash -= dt;
  }
}

export interface SpiritStepCtx { content: ContentBundle; enemies: Enemy[]; shots: Shot[]; rng: Rng; combat: HeroCombat; build: HeroBuild }

const nearest = (enemies: Enemy[], x: number, y: number, range: number): Enemy | null => {
  let best: Enemy | null = null, bd = range * range;
  for (const e of enemies) {
    if (e.dead) continue;
    const dx = e.x + e.w / 2 - x, dy = e.y + e.h / 2 - y, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
};

/** Auto skills. Bolts become friendly shots (resolved by `stepHeroCombat`); aoe hits land at once. */
export function stepSpirits(w: SpiritWorld, ctx: SpiritStepCtx, dt: number): (CombatEvent | SpiritEvent)[] {
  const out: (CombatEvent | SpiritEvent)[] = [];
  if (ctx.combat.dead) return out;
  const range = cfg(ctx.content, 'auto_range', 380), radius = cfg(ctx.content, 'aoe_radius', 110);
  for (const a of w.actors) {
    const sk = a.skill;
    if (!sk) continue;
    a.cd -= dt * (a.stats.spd / 100);
    if (a.cd > 0) continue;
    const t = nearest(ctx.enemies, a.x, a.y, range);
    if (!t) { a.cd = 0.25; continue; }
    a.cd = sk.cd; a.flash = 0.25;
    const tx = t.x + t.w / 2, ty = t.y + t.h / 2, fx = sk.effects;
    const crit = a.stats.crit + (fx.crit ?? 0);
    out.push({ kind: 'scast', actor: a, tx, ty, vfx: sk.vfx });
    if (sk.target === 'aoe') {
      for (const e of ctx.enemies) {
        if (e.dead || Math.abs(e.x + e.w / 2 - tx) > radius || Math.abs(e.y + e.h / 2 - ty) > radius) continue;
        out.push(spiritHit(e, { power: a.stats.atk * sk.power, crit, critDmg: a.stats.critDmg, el: a.el, stun: fx.stun, defDown: fx.defdown, x: a.x }, ctx.rng));
      }
    } else {
      const dx = tx - a.x, dy = ty - a.y, len = Math.max(1, Math.hypot(dx, dy)), sp = 620;
      ctx.shots.push({
        x: a.x, y: a.y, vx: (dx / len) * sp, vy: (dy / len) * sp, r: 10, color: 0xffffff, dmg: 0, life: range / sp + 0.25, hostile: false, ghost: true, el: a.el,
        kind: `spirit:${sk.vfx}`, power: a.stats.atk * sk.power, crit, critDmg: a.stats.critDmg, stun: fx.stun, defDown: fx.defdown, pierce: (fx.pierce ?? 0) > 0,
      });
    }
    const mh = maxHp(ctx.build);
    if (fx.heal && ctx.combat.hp < mh) {
      const amount = Math.max(1, Math.round(mh * fx.heal));
      ctx.combat.hp = Math.min(mh, ctx.combat.hp + amount);
      out.push({ kind: 'sheal', amount, x: a.x, y: a.y });
    }
    if (fx.shield) {
      const amount = Math.round(mh * fx.shield);
      ctx.combat.shield = Math.min(Math.round(mh * 0.3), ctx.combat.shield + amount);
      out.push({ kind: 'sshield', amount, x: a.x, y: a.y });
    }
  }
  return out;
}

/** Vampire runes: the hero heals by a % of the spirit's damage. */
export function spiritLifesteal(w: SpiritWorld, amount: number): number {
  const ls = w.actors.reduce((n, a) => Math.max(n, a.stats.lifesteal), 0);
  return Math.round((amount * ls) / 100);
}

export type GaugeSource = 'hero' | 'spirit' | 'kill';
export function addGauge(w: SpiritWorld, c: ContentBundle, src: GaugeSource): void {
  const base = cfg(c, src === 'hero' ? 'gauge_hero_hit' : src === 'spirit' ? 'gauge_spirit_hit' : 'gauge_kill');
  w.gauge = Math.min(w.gaugeMax, w.gauge + base * (1 + w.gaugeBonus));
}

export const gaugeReady = (w: SpiritWorld): boolean => w.actors.length > 0 && w.gauge >= w.gaugeMax;

export interface UltResult {
  leader: SpiritActor; skill: SpiritSkillDef; combo: boolean;
  /** hit events in order; `wave` = which of the skill's hits (for staggered display) */
  hits: { wave: number; ev: CombatEvent }[];
  heal: number; shield: number;
}

/**
 * Leader's ultimate on every monster in `targets` (the client passes the ones on screen).
 * Per hit: leader ATK x power + share of hero ATK + share of the other members' ATK; x COMBO if a hero skill was used just before.
 */
export function ultimate(w: SpiritWorld, ctx: SpiritStepCtx, targets: Enemy[], now: number): UltResult | null {
  const leader = w.actors[0];
  const f = leader && familyOf(ctx.content, leader.id), sk = f && sskillOf(ctx.content, f.ult);
  if (!leader || !sk || !gaugeReady(w)) return null;
  const c = ctx.content;
  const combo = now - w.lastSkill <= cfg(c, 'combo_window', 2);
  const others = w.actors.slice(1).reduce((n, a) => n + a.stats.atk, 0);
  const base = (leader.stats.atk * sk.power + attack(ctx.build) * cfg(c, 'ult_hero_atk', 0.5) + others * cfg(c, 'ult_member_atk', 0.5)) * (combo ? cfg(c, 'combo_mult', 1.3) : 1);
  const hits: UltResult['hits'] = [];
  for (let wave = 0; wave < sk.hits; wave++) {
    for (const e of targets) {
      if (e.dead) continue;
      hits.push({ wave, ev: spiritHit(e, { power: base, crit: leader.stats.crit, critDmg: leader.stats.critDmg, el: leader.el, stun: sk.effects.stun, defDown: sk.effects.defdown, x: leader.x }, ctx.rng, 0) });
    }
  }
  const mh = maxHp(ctx.build);
  const heal = sk.effects.heal ? Math.round(mh * sk.effects.heal) : 0;
  const shield = sk.effects.shield ? Math.round(mh * sk.effects.shield) : 0;
  if (heal) ctx.combat.hp = Math.min(mh, ctx.combat.hp + heal);
  if (shield) ctx.combat.shield = Math.min(Math.round(mh * 0.5), ctx.combat.shield + shield);
  w.gauge = 0;
  return { leader, skill: sk, combo, hits, heal, shield };
}
