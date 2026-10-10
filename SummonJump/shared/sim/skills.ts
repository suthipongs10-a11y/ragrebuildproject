import type { ContentBundle, SkillDef } from '../content/types';
import type { Element } from '../formulas/elements';
import { evalExpr, fx } from '../formulas/expr';
import { attack, magicAttack, maxHp, maxSp, type HeroBuild } from '../formulas/stats';
import { TILE, type TileGrid } from '../platformer/grid';
import { moveBody, type Body } from '../platformer/motion';
import type { Rng } from '../rng';
import type { Buff, Derived, HeroData } from '../progression/hero';
import { hitEnemy, overlap, type Box, type CombatEvent, type HeroCombat } from './combat';
import type { Enemy, Shot } from './enemy';

/** Bosses shrug off stun / freeze (RO bosses are status-immune): 20 % of the duration. */
const statusMult = (e: Enemy): number => (e.def.tier === 'normal' ? 1 : 0.2);

/**
 * Active skills at runtime: SP, cooldowns, cast time, and the effect kinds used by skills.csv `target`:
 * heal, buff, front, aoe, dash, bolt, rain, zone. Passives are applied by `derive()`.
 */
export interface Zone { id: number; skill: string; x: number; y: number; w: number; h: number; until: number; tick: number; nextTick: number; base: number; el: Element; magic: boolean; trap: boolean; stun: number; pneuma: boolean }

export interface SkillRuntime {
  sp: number; cds: Record<string, number>; buffs: Buff[]; zones: Zone[]; time: number;
  cast: { id: string; t: number; total: number } | null; regenT: number; zoneN: number;
}

export type SkillFail = 'sp' | 'cooldown' | 'casting' | 'passive' | 'unknown' | 'dead' | 'weapon';
export type SkillEvent =
  | { kind: 'cast_start'; id: string; total: number }
  | { kind: 'cast'; skill: SkillDef; x: number; y: number; dir: number }
  | { kind: 'heal'; amount: number; x: number; y: number }
  | { kind: 'buff'; skill: SkillDef }
  | { kind: 'fail'; id: string; why: SkillFail }
  | { kind: 'zone'; zone: Zone }
  | CombatEvent;

export const newSkillRuntime = (sp: number): SkillRuntime => ({ sp, cds: {}, buffs: [], zones: [], time: 0, cast: null, regenT: 0, zoneN: 0 });

export interface SkillCtx {
  hero: Body & { dir: number }; combat: HeroCombat; data: HeroData; derived: Derived; content: ContentBundle;
  enemies: Enemy[]; shots: Shot[]; grid: TileGrid; rng: Rng;
}

const skill = (c: ContentBundle, id: string) => c.skills.find((s) => s.id === id);
const lvOf = (ctx: SkillCtx, id: string) => ctx.data.skills[id] ?? 0;

export function spCost(s: SkillDef, lv: number): number { return Math.max(0, Math.round(evalExpr(s.sp, { lv }))); }

/** Try to start a skill. Casting skills fire after `cast` seconds (see `stepSkills`). */
export function useSkill(rt: SkillRuntime, ctx: SkillCtx, id: string): SkillEvent[] {
  const s = skill(ctx.content, id), lv = lvOf(ctx, id);
  if (!s || lv <= 0) return [{ kind: 'fail', id, why: 'unknown' }];
  if (ctx.combat.dead) return [{ kind: 'fail', id, why: 'dead' }];
  if (s.type !== 'active') return [{ kind: 'fail', id, why: 'passive' }];
  if (rt.cast) return [{ kind: 'fail', id, why: 'casting' }];
  if ((rt.cds[id] ?? 0) > rt.time) return [{ kind: 'fail', id, why: 'cooldown' }];
  // RO: arrow skills need a bow in hand
  if (s.effects.bow && !(ctx.derived.ranged && !ctx.derived.magic)) return [{ kind: 'fail', id, why: 'weapon' }];
  const cost = spCost(s, lv);
  if (rt.sp < cost) return [{ kind: 'fail', id, why: 'sp' }];
  rt.sp -= cost; rt.cds[id] = rt.time + s.cd;
  const castTime = s.cast * (1 - Math.min(0.5, ctx.derived.build.stats.dex * 0.01));
  if (castTime > 0.05) { rt.cast = { id, t: 0, total: castTime }; return [{ kind: 'cast_start', id, total: castTime }]; }
  return fire(rt, ctx, s, lv);
}

/** Out-of-combat regen: after this many seconds without damage, +6 % HP and +4 % SP every 2 s. */
export const CALM_AFTER = 4, CALM_HP = 0.06, CALM_SP = 0.04;

/** Advance cast bars, zones, buffs, regen. Call every frame. */
export function stepSkills(rt: SkillRuntime, ctx: SkillCtx, dt: number): SkillEvent[] {
  const ev: SkillEvent[] = [];
  rt.time += dt;
  if (rt.cast) {
    rt.cast.t += dt;
    if (rt.cast.t >= rt.cast.total) { const { id } = rt.cast; rt.cast = null; const s = skill(ctx.content, id); if (s) ev.push(...fire(rt, ctx, s, lvOf(ctx, id))); }
  }
  rt.buffs = rt.buffs.filter((b) => b.until > rt.time);
  const b = ctx.derived.build;
  rt.regenT += dt;
  if (rt.regenT >= 2 && !ctx.combat.dead) {
    rt.regenT = 0;
    rt.sp = Math.min(maxSp(b), rt.sp + 1 + b.stats.int / 6 + ctx.derived.spRegen);
    // out of combat (no hit for 4 s): fast regen so players rarely need potions between fights
    const calm = (ctx.combat.calm ?? 0) >= CALM_AFTER;
    if (ctx.combat.inv <= 0) ctx.combat.hp = Math.min(maxHp(b), ctx.combat.hp + Math.max(1, maxHp(b) / 200) + ctx.derived.hpRegen * 2 + (calm ? maxHp(b) * CALM_HP : 0));
    if (calm) rt.sp = Math.min(maxSp(b), rt.sp + maxSp(b) * CALM_SP);
  }
  for (const z of rt.zones) {
    if (z.pneuma) { for (const s of ctx.shots) if (s.hostile && overlap({ x: s.x - s.r, y: s.y - s.r, w: s.r * 2, h: s.r * 2 }, z)) s.life = 0; continue; }
    if (rt.time < z.nextTick) continue;
    let hitAny = false;
    for (const e of ctx.enemies) {
      if (e.dead || !overlap(z, e)) continue;
      hitAny = true;
      ev.push(hitEnemy(e, z.base, z.el, b, ctx.rng, z.trap ? 0 : 120, 0.02, z.x + z.w / 2, false, z.magic));
      if (z.stun > 0) e.stun = Math.max(e.stun, z.stun * statusMult(e));
    }
    if (z.trap) { if (hitAny) z.until = 0; } else z.nextTick = rt.time + z.tick;
  }
  rt.zones = rt.zones.filter((z) => z.until > rt.time);
  return ev;
}

function fire(rt: SkillRuntime, ctx: SkillCtx, s: SkillDef, lv: number): SkillEvent[] {
  const { hero, derived } = ctx, b = derived.build, e = s.effects;
  const magic = !!e.magic;
  const el: Element = !s.element || s.element === 'weapon' ? derived.element : (s.element as Element);
  const base = (magic ? magicAttack(b) : attack(b)) * evalExpr(s.power, { lv });
  const cx = hero.x + hero.w / 2, cy = hero.y + hero.h / 2;
  const ev: SkillEvent[] = [{ kind: 'cast', skill: s, x: cx, y: cy, dir: hero.dir }];
  const kb = fx(e.knockback, lv);
  const hitAll = (box: Box, hits = Math.max(1, s.hit_count), center = false, r = 0) => {
    for (const en of ctx.enemies) {
      if (en.dead) continue;
      const inside = center ? Math.hypot(en.x + en.w / 2 - cx, en.y + en.h / 2 - cy) < r + en.w / 2 : overlap(box, en);
      if (!inside) continue;
      if (e.debuff === 'provoke') { en.defDown = fx(e.def_down, lv); en.defDownT = fx(e.dur, lv); en.flash = 0.2; continue; }
      if (e.freeze) en.stun = Math.max(en.stun, fx(e.freeze, lv) * statusMult(en));
      for (let i = 0; i < hits && !en.dead; i++) ev.push(hitEnemy(en, base, el, b, ctx.rng, kb, 0.06, cx, false, magic));
    }
  };
  switch (s.target) {
    case 'heal': {
      const amount = Math.round(evalExpr(s.power, { lv }) * (1 + b.stats.int * fx(e.int_scale, lv)));
      ctx.combat.hp = Math.min(maxHp(b), ctx.combat.hp + amount);
      ev.push({ kind: 'heal', amount, x: cx, y: hero.y });
      break;
    }
    case 'buff': {
      const effects: Record<string, number> = {};
      for (const [k, v] of Object.entries(e)) if (k !== 'buff' && k !== 'dur') effects[k] = fx(v, lv);
      rt.buffs = rt.buffs.filter((x) => x.id !== e.buff);
      rt.buffs.push({ id: String(e.buff), until: rt.time + fx(e.dur, lv), effects });
      if (effects.absorb) ctx.combat.shield = effects.absorb;
      ev.push({ kind: 'buff', skill: s });
      break;
    }
    case 'front': { const reach = fx(e.reach ?? 84, lv); hitAll({ x: hero.dir > 0 ? hero.x + hero.w - 4 : hero.x + 4 - reach, y: hero.y - 16, w: reach, h: hero.h + 24 }); break; }
    case 'aoe': hitAll({ x: 0, y: 0, w: 0, h: 0 }, Math.max(1, s.hit_count), true, fx(e.radius ?? 120, lv)); break;
    case 'dash': {
      const dist = fx(e.distance, lv), x0 = hero.x;
      const vx = hero.vx; hero.vx = hero.dir * dist; moveBody(hero, 1, ctx.grid, false, hero.y + hero.h); hero.vx = vx * 0.3;
      const left = Math.min(x0, hero.x), right = Math.max(x0, hero.x) + hero.w;
      hitAll({ x: left - 10, y: hero.y - 10, w: right - left + 20, h: hero.h + 20 });
      break;
    }
    case 'bolt': {
      const n = Math.max(1, Math.round(fx(e.bolts ?? 1, lv)));
      const target = nearestEnemy(ctx, cx, cy, hero.dir, derived.range + 200);
      const falling = magic && (el === 'fire' || el === 'water' || el === 'wind');
      for (let i = 0; i < n; i++) {
        if (falling && target) {
          const tx = target.x + target.w / 2 + (ctx.rng.next() - 0.5) * 24, ty = target.y + target.h / 2;
          ctx.shots.push({ x: tx - 120, y: ty - 360, vx: 120 / 0.35, vy: 360 / 0.35, r: 22, color: 0, dmg: 0, life: 0.5, hostile: false, ghost: true, el, base: evalExpr(s.power, { lv }), magic, kb, delay: i * 0.12, kind: s.vfx ?? s.id });
        } else {
          const ang = target ? Math.atan2(target.y + target.h / 2 - cy, target.x + target.w / 2 - cx) : (hero.dir > 0 ? 0 : Math.PI);
          ctx.shots.push({ x: cx, y: cy - 8 + (i % 2) * 10, vx: Math.cos(ang) * 720, vy: Math.sin(ang) * 720, r: 12, color: 0, dmg: 0, life: (derived.range + 200) / 720,
            hostile: false, ghost: !!e.arrow ? false : true, el, base: evalExpr(s.power, { lv }), magic, kb, delay: i * 0.1, kind: s.vfx ?? s.id });
        }
      }
      break;
    }
    case 'rain': {
      const r = fx(e.radius ?? 120, lv), n = Math.round(fx(e.arrows ?? 6, lv));
      const target = nearestEnemy(ctx, cx, cy, hero.dir, derived.range + 200);
      const tx = target ? target.x + target.w / 2 : cx + hero.dir * 200;
      const ty = target ? target.y + target.h / 2 : hero.y + hero.h - 20;
      for (let i = 0; i < n; i++) {
        const x = tx + (ctx.rng.next() * 2 - 1) * r;
        ctx.shots.push({ x: x - 80, y: ty - 300, vx: 80 / 0.3, vy: 300 / 0.3, r: 26, color: 0, dmg: 0, life: 0.34, hostile: false, ghost: true, el, base: evalExpr(s.power, { lv }), magic, kb: 0, delay: i * 0.05, kind: s.vfx ?? s.id, pierce: true });
      }
      break;
    }
    case 'zone': {
      const w = fx(e.width ?? 96, lv), x = hero.dir > 0 ? hero.x + hero.w + 12 : hero.x - 12 - w;
      const z: Zone = { id: rt.zoneN++, skill: s.id, x, y: hero.y + hero.h - 72, w, h: 72, until: rt.time + fx(e.duration ?? 4, lv), tick: fx(e.tick ?? 0.33, lv), nextTick: rt.time,
        base, el, magic, trap: !!e.trap, stun: fx(e.stun, lv), pneuma: !!e.pneuma };
      if (z.pneuma) { z.x = hero.x + hero.w / 2 - w / 2; z.y = hero.y - 60; z.h = hero.h + 70; }
      rt.zones.push(z);
      ev.push({ kind: 'zone', zone: z });
      break;
    }
  }
  return ev;
}

function nearestEnemy(ctx: SkillCtx, x: number, y: number, dir: number, range: number): Enemy | undefined {
  let best: Enemy | undefined, bd = Infinity;
  for (const e of ctx.enemies) {
    if (e.dead) continue;
    const dx = e.x + e.w / 2 - x, d = Math.hypot(dx, e.y + e.h / 2 - y);
    const penalty = Math.sign(dx) === dir || Math.abs(dx) < TILE ? 0 : range * 0.6; // prefer targets in front
    if (d < range && d + penalty < bd) { bd = d + penalty; best = e; }
  }
  return best;
}

/** Seconds left on a skill's cooldown (for the button overlay). */
export const cooldownLeft = (rt: SkillRuntime, id: string): number => Math.max(0, (rt.cds[id] ?? 0) - rt.time);
