import type { MonsterDef } from '../content/types';
import type { Rng } from '../rng';
import { Cell, isSolidCell, TILE, type TileGrid } from '../platformer/grid';
import { moveBody, type Body } from '../platformer/motion';
import { BOSSES, bossRage, callMinions, enterPhase2, rainOnHero, shockwave } from './bosses';

/**
 * Monster brains. Pure + seeded RNG so the server can re-simulate. Numbers are the prototype's at 2x scale.
 * `ai` comes from monsters.csv: hopper, walker, charger, flyer, swimmer, turret, boss (+ ai_params.script).
 */
export type EnemyPose = 'idle' | 'windup' | 'attack' | 'hurt' | 'skill';
export type EnemyState = 'idle' | 'move' | 'windup' | 'attack' | 'recover' | 'hover' | 'dive' | 'rise';

export interface Enemy extends Body {
  id: string; def: MonsterDef; hp: number; dir: 1 | -1;
  state: EnemyState; t: number; timer: number; ph: number;
  ox: number; oy: number; stun: number; flash: number; jumps: number; air: number; shotT: number;
  dead: boolean; hitWall: boolean; pose: EnemyPose;
  /** provoke: fraction of DEF removed, seconds left */
  defDown: number; defDownT: number;
  /** boss phase (1, then 2 below 50 % HP) */
  phase: number;
  /** seconds to the next minion call (bosses) */
  callT: number;
}

export interface Shot {
  x: number; y: number; vx: number; vy: number; r: number; color: number; dmg: number; life: number; hostile: boolean; ghost: boolean; el: string;
  /** friendly shots (hero skills / arrows): damage multiplier base, magic flag, knockback, delay before it starts moving, visual kind */
  base?: number; magic?: boolean; kb?: number; delay?: number; kind?: string; pierce?: boolean; hit?: string[];
  /** spirit shots: flat damage base (spirit ATK x power), crit rate, on-hit stun seconds / DEF-down fraction */
  power?: number; crit?: number; critDmg?: number; stun?: number; defDown?: number;
}

export interface EnemyCtx {
  grid: TileGrid; rng: Rng;
  hero: { x: number; y: number; w: number; h: number };
  water: boolean;
  shots: Shot[];
  /** spawn a minion (boss scripts); returns false when the cap is hit */
  summon: (monsterId: string, x: number, y: number) => void;
  count: (monsterId: string) => number;
  events: EnemyEvent[];
}
export type EnemyEvent = { kind: 'slam'; x: number; y: number } | { kind: 'shoot'; x: number; y: number } | { kind: 'phase'; enemy: Enemy } | { kind: 'call'; enemy: Enemy };

const G = 2200, MAX_FALL = 800;
export const num = (d: MonsterDef, k: string, dflt: number): number => (typeof d.ai_params[k] === 'number' ? (d.ai_params[k] as number) : dflt);
const FLYING_SCRIPTS = new Set(['harpy_dive', 'kraken_ink', 'storm_roc', 'siren', 'shark']);
export const isFlying = (d: MonsterDef): boolean => d.ai === 'flyer' || d.ai === 'swimmer' || FLYING_SCRIPTS.has(String(d.ai_params.script ?? ''));

/** `x` = bottom-center spawn point (ground monsters stand on it, flyers hover around it). */
export function createEnemy(id: string, def: MonsterDef, x: number, y: number, rng: Rng): Enemy {
  const w = def.hitbox.w * 2, h = def.hitbox.h * 2;
  const fly = isFlying(def);
  const ex = x - w / 2, ey = fly ? y - h - TILE / 2 : y - h;
  return {
    id, def, hp: def.hp, dir: -1, x: ex, y: ey, w, h, vx: 0, vy: 0, onGround: false,
    state: fly && def.ai === 'boss' ? 'hover' : 'idle', t: 0, timer: rng.range(0.5, 1.5), ph: rng.next() * 6,
    ox: ex, oy: ey, stun: 0, flash: 0, jumps: 0, air: 0, shotT: 1.5, dead: false, hitWall: false, pose: 'idle', defDown: 0, defDownT: 0, phase: 1,
    callT: num(def, 'minion_cd', 10) * 0.5,
  };
}

export function setState(e: Enemy, s: EnemyState, t = 0): void { e.state = s; e.t = t; }

export function fall(e: Enemy, dt: number, grid: TileGrid, maxFall = MAX_FALL): void {
  e.vy = Math.min(maxFall, e.vy + G * dt);
  e.hitWall = moveBody(e, dt, grid, false, e.y + e.h);
}

/** Wall or ledge ahead (ground walkers turn around). */
export function blockedAhead(e: Enemy, grid: TileGrid): boolean {
  if (e.hitWall) return true;
  if (!e.onGround) return false;
  const fx = e.dir > 0 ? e.x + e.w + 1 : e.x - 1;
  const c = grid.get(Math.floor(fx / TILE), Math.floor((e.y + e.h + 2) / TILE));
  return !isSolidCell(c) && c !== Cell.OneWay;
}

export function stepEnemy(e: Enemy, ctx: EnemyCtx, dt: number): void {
  if (e.dead) return;
  const d = e.def, hx = ctx.hero.x + ctx.hero.w / 2, ex = e.x + e.w / 2, dx = hx - ex, dy = ctx.hero.y - e.y;
  e.ph += dt; e.t += dt;
  if (e.defDownT > 0) { e.defDownT -= dt; if (e.defDownT <= 0) e.defDown = 0; }
  if (e.flash > 0) e.flash -= dt;
  if (e.stun > 0) {
    e.stun -= dt; e.pose = 'hurt';
    if (!isFlying(d)) { fall(e, dt, ctx.grid); e.vx *= Math.pow(0.05, dt); } else { e.x += e.vx * dt * 0.5; e.vx *= Math.pow(0.05, dt); }
    return;
  }
  const script = d.ai === 'boss' ? String(d.ai_params.script ?? '') : '';
  if (d.tier !== 'normal') { dt *= bossRage(e); callMinions(e, ctx, dt, dx); }
  if (d.ai === 'hopper' || script === 'king_slam') hopper(e, ctx, dt, dx, script === 'king_slam');
  else if (d.ai === 'walker' || d.ai === 'charger') walker(e, ctx, dt, dx, dy, d.ai === 'charger');
  else if (d.ai === 'flyer') flyer(e, ctx, dt, dx, dy);
  else if (d.ai === 'swimmer') swimmer(e, ctx, dt, dx, dy);
  else if (d.ai === 'turret') turret(e, ctx, dt, dx);
  else if (script === 'harpy_dive') harpy(e, ctx, dt, dx, hx);
  else if (script === 'kraken_ink') kraken(e, ctx, dt, dx);
  else if (BOSSES[script]) BOSSES[script](e, ctx, dt, dx, dy);
  else fall(e, dt, ctx.grid);
  e.x = Math.max(0, Math.min(ctx.grid.pxW - e.w, e.x));
}

function hopper(e: Enemy, ctx: EnemyCtx, dt: number, dx: number, king: boolean): void {
  const d = e.def, wasAir = !e.onGround;
  if (king) enterPhase2(e, ctx);
  if (e.onGround) {
    e.vx *= Math.pow(king ? 0.01 : 0.02, dt);
    e.timer -= dt;
    e.pose = e.timer < 0.3 ? 'windup' : 'idle';
    if (e.timer <= 0) {
      const range = num(d, 'range', 170) * 2;
      e.dir = king || Math.abs(dx) < range ? ((Math.sign(dx) || 1) as 1 | -1) : (ctx.rng.chance(0.5) ? -1 : 1);
      e.vx = e.dir * (king ? 190 : num(d, 'hop', 240) * 0.46);
      e.vy = king ? -800 : -480;
      const enraged = king && e.hp < d.hp / 2;
      e.timer = king ? (enraged ? 0.8 : 1.2) : ctx.rng.range(0.8, 2);
      e.jumps++;
    }
  } else e.pose = e.vy < 0 ? 'attack' : 'idle';
  fall(e, dt, ctx.grid, king ? 1000 : MAX_FALL);
  if (king && wasAir && e.onGround && e.air > 0.2) { ctx.events.push({ kind: 'slam', x: e.x + e.w / 2, y: e.y + e.h }); if (e.phase === 2) shockwave(ctx, e); }
  e.air = e.onGround ? 0 : e.air + dt;
}

/** Walks, chases when the hero is near, then telegraphs a lunge: windup → attack → recover. */
function walker(e: Enemy, ctx: EnemyCtx, dt: number, dx: number, dy: number, charger: boolean): void {
  const d = e.def, near = Math.abs(dx) < num(d, 'range', 130) * 2 && Math.abs(dy) < 80;
  const walk = num(d, 'speed', 32) * 2, chase = num(d, charger ? 'charge' : 'chase', charger ? 64 : 48) * 2;
  switch (e.state) {
    case 'windup':
      e.vx = 0; e.pose = 'windup';
      if (e.t > 0.35) { setState(e, 'attack'); e.vx = e.dir * (charger ? 420 : 300); }
      break;
    case 'attack':
      e.pose = 'attack'; e.vx *= Math.pow(0.2, dt);
      if (e.t > 0.28) setState(e, 'recover');
      break;
    case 'recover':
      e.pose = 'idle'; e.vx *= Math.pow(0.01, dt);
      if (e.t > 0.5) setState(e, 'move');
      break;
    default:
      e.pose = 'idle';
      if (near) e.dir = (Math.sign(dx) || 1) as 1 | -1;
      e.vx = e.dir * (near ? chase : walk);
      if (near && Math.abs(dx) < (charger ? 170 : 110) && e.onGround && e.timer <= 0) { setState(e, 'windup'); e.timer = 1.2; }
      e.timer -= dt;
  }
  fall(e, dt, ctx.grid);
  if (e.state !== 'attack' && blockedAhead(e, ctx.grid)) e.dir = (-e.dir) as 1 | -1;
}

function flyer(e: Enemy, ctx: EnemyCtx, dt: number, dx: number, dy: number): void {
  const d = e.def, amp = num(d, 'amp', 14) * 2, spd = num(d, 'speed', 45) * 2;
  if (e.state === 'windup') {
    e.pose = 'windup'; e.y -= 40 * dt;
    if (e.t > 0.3) { setState(e, 'dive'); const a = Math.atan2(dy + 20, dx); e.vx = Math.cos(a) * 380; e.vy = Math.sin(a) * 380; }
  } else if (e.state === 'dive') {
    e.pose = 'attack'; e.x += e.vx * dt; e.y += e.vy * dt;
    if (e.t > 0.45 || hitsSolid(e, ctx.grid)) setState(e, 'rise');
  } else if (e.state === 'rise') {
    e.pose = 'idle'; e.y += Math.sign(e.oy - e.y) * Math.min(Math.abs(e.oy - e.y), 160 * dt); e.x += Math.sign(e.ox - e.x) * Math.min(Math.abs(e.ox - e.x), 120 * dt);
    if (Math.abs(e.y - e.oy) < 4) { setState(e, 'idle'); e.timer = 1.6; }
  } else {
    e.pose = 'idle';
    e.x += e.dir * spd * dt;
    if (Math.abs(e.x - e.ox) > 140) e.dir = (Math.sign(e.ox - e.x) || 1) as 1 | -1;
    e.y = e.oy + Math.sin(e.ph * 3) * amp;
    e.timer -= dt;
    if (e.timer <= 0 && Math.abs(dx) < num(d, 'range', 70) * 3 && dy > -20 && dy < 260) setState(e, 'windup');
  }
}

function swimmer(e: Enemy, ctx: EnemyCtx, dt: number, dx: number, dy: number): void {
  const d = e.def, near = Math.abs(dx) < num(d, 'range', 110) * 2 && Math.abs(dy) < 100;
  const fx = e.dir > 0 ? e.x + e.w + 2 : e.x - 2;
  if (isSolidCell(ctx.grid.get(Math.floor(fx / TILE), Math.floor((e.y + e.h / 2) / TILE))) || Math.abs(e.x - e.ox) > 180) e.dir = (-e.dir) as 1 | -1;
  if (near) e.dir = (Math.sign(dx) || 1) as 1 | -1;
  e.x += e.dir * (near ? num(d, 'chase', 55) : num(d, 'speed', 35)) * 2 * dt;
  e.y = e.oy + Math.sin(e.ph * 2) * 16;
  e.pose = near ? (Math.abs(dx) < 90 ? 'attack' : 'windup') : 'idle';
}

function turret(e: Enemy, ctx: EnemyCtx, dt: number, dx: number): void {
  fall(e, dt, ctx.grid);
  e.dir = (Math.sign(dx) || -1) as 1 | -1;
  e.timer -= dt;
  e.pose = e.timer < 0.4 ? 'windup' : 'idle';
  if (e.timer <= 0 && Math.abs(dx) < num(e.def, 'range', 420)) { shootAt(e, ctx, [0], 260, 0x8a5a2a); e.timer = num(e.def, 'cd', 2); e.pose = 'attack'; }
}

function harpy(e: Enemy, ctx: EnemyCtx, dt: number, dx: number, hx: number): void {
  const d = e.def;
  enterPhase2(e, ctx);
  if (e.state === 'hover') {
    const tx = hx + Math.sin(e.ph * 0.8) * 160 - e.w / 2, ty = 92 + Math.sin(e.ph * 2) * 16;
    e.x += Math.sign(tx - e.x) * Math.min(Math.abs(tx - e.x), 180 * dt);
    e.y += Math.sign(ty - e.y) * Math.min(Math.abs(ty - e.y), 140 * dt);
    e.timer -= dt; e.dir = (Math.sign(dx) || 1) as 1 | -1; e.shotT -= dt;
    e.pose = e.timer < 0.4 ? 'windup' : 'idle';
    if (e.shotT <= 0) { e.shotT = e.hp < d.hp / 2 ? 1.1 : 2.2; shootAt(e, ctx, e.hp < d.hp / 2 ? [-0.4, -0.2, 0, 0.2, 0.4] : [-0.2, 0.2], 280, 0xc9a6ff); }
    if (e.timer <= 0) { setState(e, 'dive'); const a = Math.atan2(ctx.hero.y + 20 - (e.y + e.h / 2), dx); e.vx = Math.cos(a) * 540; e.vy = Math.sin(a) * 540; }
  } else if (e.state === 'dive') {
    e.pose = 'attack'; e.x += e.vx * dt; e.y += e.vy * dt;
    if (e.t > 0.85 || e.y > 360) setState(e, 'rise');
  } else {
    e.pose = 'idle'; e.y -= 260 * dt;
    if (e.y < 112) { setState(e, 'hover'); e.timer = ctx.rng.range(1.5, 2.4); }
  }
  e.y = Math.max(16, Math.min(400 - e.h, e.y));
}

function kraken(e: Enemy, ctx: EnemyCtx, dt: number, dx: number): void {
  const d = e.def;
  e.y = e.oy + Math.sin(e.ph * 1.2) * 20; e.dir = (Math.sign(dx) || -1) as 1 | -1; e.timer -= dt;
  e.pose = e.timer < 0.5 ? 'windup' : e.timer > 1.8 ? 'attack' : 'idle';
  enterPhase2(e, ctx);
  if (e.timer <= 0) {
    e.jumps++;
    // phase 2: every 3rd attack is an ink rain over the hero instead of the 3-way spray
    if (e.phase === 2 && e.jumps % 3 === 0) { rainOnHero(ctx, e, 7, 0x2a1838); e.pose = 'skill'; ctx.events.push({ kind: 'slam', x: e.x + e.w / 2, y: e.y + e.h }); }
    else shootAt(e, ctx, e.phase === 2 ? [-0.45, -0.15, 0.15, 0.45] : [-0.3, 0, 0.3], 230, 0x2a1838);
    e.timer = e.phase === 2 ? 1 : 1.8;
  }
}

export function shootAt(e: Enemy, ctx: EnemyCtx, spread: number[], speed: number, color: number): void {
  const sx = e.x + e.w / 2, sy = e.y + e.h * 0.5;
  const a = Math.atan2(ctx.hero.y + ctx.hero.h / 2 - sy, ctx.hero.x + ctx.hero.w / 2 - sx);
  for (const o of spread) ctx.shots.push({ x: sx, y: sy, vx: Math.cos(a + o) * speed, vy: Math.sin(a + o) * speed, r: 9, color, dmg: e.def.atk, life: 4, hostile: true, ghost: true, el: e.def.element });
  ctx.events.push({ kind: 'shoot', x: sx, y: sy });
}

export function hitsSolid(e: Enemy, grid: TileGrid): boolean {
  return isSolidCell(grid.get(Math.floor((e.x + e.w / 2) / TILE), Math.floor((e.y + e.h) / TILE)));
}
